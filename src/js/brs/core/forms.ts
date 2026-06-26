import { BRS } from '..'

import { sendRequestA } from './send_request'

import { encryptNote, createEncryptionToOtherOptions, createEncryptionToSelfOptions } from './encryption'

import { parseAmountToNQT, formatNQTAsAmount } from './numbers'

import { getTranslatedFieldName } from './util'

import { lockModal, unlockModal } from './lockable_modal'
import { PostResponse, RequestType } from '../typings'
import { checkIncomingNow } from './check_incoming'

/**
 * There are the 'requestType' in forms that will check if node is in sync before proceed.
 */
const submitOnlyWhenInSync = {
    addAssetBookmark: false,
    addCommitment: true,
    addContact: false,
    assetExchangeChangeGroupName: false,
    assetExchangeGroup: false,
    broadcastTransaction: true,
    buyAlias: true,
    cancelOrder: true,
    clearData: false,
    decryptMessages: false,
    deleteContact: false,
    escrowSign: true,
    issueAsset: true,
    orderAsset: true,
    requestBurst: false,
    sellAlias: true,
    sendMessage: true,
    sendMoney: true,
    sendMoneyEscrow: true,
    sendMoneyMulti: true,
    sendMoneySubscription: true,
    setAccountInfo: true,
    setAlias: true,
    setRewardRecipient: true,
    signMessage: false,
    subscriptionCancel: true,
    transferAsset: true,
    transferAssetMulti: true,
    updateContact: false,
    verifyMessage: false,
}

function getSuccessMessage(requestType: RequestType) {
    const key = 'success_' + requestType
    if ($.i18n.exists(key)) {
        return $.t(key)
    }
    return ''
}

function getErrorMessage(requestType: RequestType) {
    const key = 'error_' + requestType
    if ($.i18n.exists(key)) {
        return $.t(key)
    }
    return ''
}

async function addMessageData(data: any, requestType: string) {
    if (requestType === 'sendMessage') {
        data.add_message = true
        data.message_is_text = 'on'
    }

    if (!data.add_message && !data.add_note_to_self) {
        delete data.message
        delete data.note_to_self
        delete data.message_is_text
        delete data.note_to_self_is_text
        delete data.encrypt_message
        delete data.add_message
        delete data.add_note_to_self

        return data
    } else if (!data.add_message) {
        delete data.message
        delete data.encrypt_message
        delete data.message_is_text
        delete data.add_message
    } else if (!data.add_note_to_self) {
        delete data.note_to_self
        delete data.note_to_self_is_text
        delete data.add_note_to_self
    }

    data._extra = {
        message: data.message,
        note_to_self: data.note_to_self,
        message_is_text: data.message_is_text,
        note_to_self_is_text: data.note_to_self_is_text,
    }

    if (data.add_message && data.message) {
        if (data.encrypt_message) {
            let account = ''
            if (data.recipient) {
                account = data.recipient
            } else if (data.encryptedMessageRecipient) {
                account = data.encryptedMessageRecipient
                delete data.encryptedMessageRecipient
            }
            const options = await createEncryptionToOtherOptions(account, data.publicKey, data.message_is_text === 'on', data.secretPhrase)
            const encrypted = await encryptNote(data.message, options)
            data.encryptedMessageData = encrypted.message
            data.encryptedMessageNonce = encrypted.nonce
            data.messageToEncryptIsText = data.message_is_text === 'on' ? 'true' : 'false'
            delete data.message
            delete data.message_is_text
        } else {
            data.messageIsText = data.message_is_text === 'on' ? 'true' : 'false'
            delete data.message_is_text
        }
    } else {
        delete data.message
        delete data.message_is_text
    }

    if (data.add_note_to_self && data.note_to_self) {
        const options = await createEncryptionToSelfOptions(data.note_to_self_is_text === 'on', data.secretPhrase)
        const encrypted = await encryptNote(data.note_to_self, options)
        data.encryptToSelfMessageData = encrypted.message
        data.encryptToSelfMessageNonce = encrypted.nonce
        data.messageToEncryptToSelfIsText = data.note_to_self_is_text === 'on' ? 'true' : 'false'
        delete data.note_to_self
        delete data.note_to_self_is_text
    } else {
        delete data.note_to_self
        delete data.note_to_self_is_text
    }

    delete data.add_message
    delete data.encrypt_message
    delete data.add_note_to_self

    return data
}

/**
 * Verify every input at the given form for custom rules.
 * @param {*} $form
 * @returns
 */
function checkInvalidFormFields($form: JQuery<HTMLFormElement>) {
    function hasAttr(DOM: JQuery<HTMLElement>, name: string) {
        return DOM.attr(name) !== undefined
    }

    let errorMessage = ''

    $form.find(':input').each(function () {
        const name = String($(this).attr('name')).replace('NXT', '').replace('NQT', '').capitalize()
        const value = $(this).val() as string
        if (hasAttr($(this), 'max')) {
            // Only one case using max: Issue asset -> decimals
            if (!/^[-\d.]+$/.test(value)) {
                errorMessage = $.t('error_not_a_number', {
                    field: getTranslatedFieldName(name).toLowerCase(),
                }).capitalize()
                return
            } else {
                const max = $(this).attr('max')
                if (!max) return
                if (Number(value) > Number(max)) {
                    errorMessage = $.t('error_max_value', {
                        field: getTranslatedFieldName(name).toLowerCase(),
                        max,
                    }).capitalize()
                    return
                }
            }
        }
        if (hasAttr($(this), 'min')) {
            try {
                const inputNQT = BigInt(parseAmountToNQT(value))
                const min = $(this).attr('min') || '0'
                if (inputNQT < BigInt(Number(min) * 1e8)) {
                    errorMessage = $.t('error_min_value', {
                        field: getTranslatedFieldName(name).toLowerCase(),
                        min,
                    }).capitalize()
                    return
                }
            } catch (e) {
                errorMessage = $.t('error_at_field', {
                    field: getTranslatedFieldName(name).toLowerCase(),
                    errorMessage: (e as Error).message,
                }).capitalize()
                return
            }
        }
    })

    return errorMessage
}

/** Returns error message. Rmpty string is success */
function checkMerchantField(requestType: RequestType, data: any) {
    if (requestType !== 'sendMoney' && requestType !== 'transferAsset') {
        return ''
    }
    let merchantInfo = data.merchant_info
    const result = merchantInfo.match(/#merchant:(.*)#/i)
    if (result === null || result[1] === undefined) {
        return ''
    }
    let regexp: RegExp
    merchantInfo = result[1].trim()
    if (!data.add_message || !data.message) {
        return $.t('info_merchant_message_required')
    }
    if (merchantInfo === 'numeric') {
        merchantInfo = '[0-9]+'
    } else if (merchantInfo === 'alphanumeric') {
        merchantInfo = '[a-zA-Z0-9]+'
    }
    let regexParts = merchantInfo.match(/^\/(.*?)\/(.*)$/)
    if (!regexParts) {
        regexParts = ['', merchantInfo, '']
    }
    let strippedRegex = regexParts[1].replace(/^[\^(]*/, '').replace(/[$)]*$/, '')
    if (regexParts[1].charAt(0) !== '^') {
        regexParts[1] = '^' + regexParts[1]
    }
    if (regexParts[1].slice(-1) !== '$') {
        regexParts[1] = regexParts[1] + '$'
    }
    if (regexParts[2].indexOf('i') !== -1) {
        regexp = new RegExp(regexParts[1], 'i')
    } else {
        regexp = new RegExp(regexParts[1])
    }
    if (regexp.test(data.message)) {
        // Message is OK!
        return ''
    }
    let regexType: 'numeric' | 'alphanumeric' | 'custom'
    let lengthRequirement = strippedRegex.match(/\{(.*)\}/)
    if (lengthRequirement) {
        strippedRegex = strippedRegex.replace(lengthRequirement[0], '+')
    }
    if (strippedRegex === '[0-9]+') {
        regexType = 'numeric'
    } else if (strippedRegex === '[a-z0-9]+' || strippedRegex.toLowerCase() === '[a-za-z0-9]+' || strippedRegex === '[a-z0-9]+') {
        regexType = 'alphanumeric'
    } else {
        regexType = 'custom'
    }
    if (lengthRequirement) {
        let minLength: number
        let maxLength: number
        if (lengthRequirement[1].indexOf(',') !== -1) {
            lengthRequirement = lengthRequirement[1].split(',')
            minLength = parseInt(lengthRequirement[0], 10)
            if (lengthRequirement[1]) {
                maxLength = parseInt(lengthRequirement[1], 10)
                return $.t('error_merchant_message_' + regexType + '_range_length', {
                    minLength,
                    maxLength,
                })
            }
            return $.t('error_merchant_message_' + regexType + '_min_length', {
                minLength,
            })
        }
        const requiredLength = parseInt(lengthRequirement[1], 10)
        return $.t('error_merchant_message_' + regexType + '_length', {
            length: requiredLength,
        })
    }
    return $.t('error_merchant_message_' + regexType)
}

/** Function called when a submit button is clicked on modals.
 *  Checks for all kinds of modals.
 *  Specific modals are coded at BRS.forms.FORMNAME and form data is passed as parameter.
 */
export async function submitForm($btn: JQuery<HTMLButtonElement>) {
    let formFunctionError: ((response: any, arg1: any) => void) | false
    let $form: JQuery<HTMLFormElement>
    let data: any
    const $modal = $btn.closest('.modal')

    lockModal($modal, $btn)

    if ($btn.data('form')) {
        $form = $modal.find('form#' + $btn.data('form'))
        if (!$form.length) {
            $form = $modal.find('form:first')
        }
    } else {
        $form = $modal.find('form:first')
    }

    function endWithError(errorMsg: string) {
        $form.find('.error_message').html(errorMsg).show()
        if (formFunctionError) {
            formFunctionError(
                {
                    errorCode: -1,
                    errorDescription: errorMsg,
                },
                data,
            )
        }
        unlockModal($modal, $btn, false)
    }

    let requestType = $form.find('input[name=request_type]').val() as RequestType | undefined
    if (requestType === undefined) {
        endWithError('Missing requestType in this form!')
        return
    }

    let successMessage = getSuccessMessage(requestType)
    let errorMessage = getErrorMessage(requestType)

    const formFunction = BRS.forms[requestType]
    formFunctionError = BRS.forms[requestType + 'Error']

    if (typeof formFunctionError !== 'function') {
        formFunctionError = false
    }

    const originalRequestType = requestType

    const checkSync: boolean | undefined = submitOnlyWhenInSync[requestType]
    if (checkSync === undefined) {
        console.error('Unknow request type')
        return
    }
    if (checkSync) {
        if (BRS.downloadingBlockchain) {
            endWithError($.t('error_blockchain_downloading'))
            return
        }
        if (BRS.rescaningBlockchain) {
            endWithError($.t('error_form_blockchain_rescanning'))
            return
        }
    }

    let errorStr = checkInvalidFormFields($form)
    if (errorStr) {
        endWithError(errorStr)
        return
    }

    data = getFormData($form)

    if (typeof formFunction === 'function') {
        const output = await formFunction(data)
        if (output.error) {
            endWithError(output.error.escapeHTML())
            return
        }
        if (output.requestType) {
            requestType = output.requestType as RequestType
        }
        if (output.data) {
            data = output.data
        }
        if ('successMessage' in output) {
            successMessage = output.successMessage
        }
        if ('errorMessage' in output) {
            errorMessage = output.errorMessage
        }
        if (output.stop) {
            unlockModal($modal, $btn, output.hide)
            return
        }
    }

    if (data.recipient) {
        data.recipient = (data.recipient as string).trim()
        if (BRS.idRegEx.test(data.recipient) === false && BRS.rsRegEx.test(data.recipient) === false) {
            if (data.converted_account_id && (BRS.idRegEx.test(data.converted_account_id) || BRS.rsRegEx.test(data.converted_account_id))) {
                data.recipient = data.converted_account_id
                data._extra = {
                    convertedAccount: true,
                }
            } else {
                endWithError($.t('error_account_id'))
                return
            }
        }
    }

    errorStr = checkMerchantField(requestType, data)
    if (errorStr) {
        endWithError(errorStr)
        return
    }

    try {
        data = await addMessageData(data, requestType)
    } catch (err) {
        errorStr = (err as Error).message
        endWithError(errorStr.escapeHTML())
        return
    }

    if (data.deadline) {
        data.deadline = String(Number(data.deadline) * 60) // hours to minutes
    }

    if (data.doNotBroadcast) {
        data.broadcast = 'false'
        delete data.doNotBroadcast
        if (data.secretPhrase === '') {
            delete data.secretPhrase
        }
    }

    if ('secretPhrase' in data && !data.secretPhrase.length && !BRS.settings.remember_passphrase) {
        endWithError($.t('error_passphrase_required'))
        return
    }

    if ('amountNXT' in data && data.amountNXT === '') {
        data.amountNXT = '0'
    }

    if (!BRS.showedFormWarning) {
        if ('amountNXT' in data && BRS.settings.amount_warning && BRS.settings.amount_warning !== '0') {
            if (BigInt(parseAmountToNQT(data.amountNXT)) > BigInt(BRS.settings.amount_warning)) {
                BRS.showedFormWarning = true
                endWithError(
                    $.t('error_max_amount_warning', {
                        burst: formatNQTAsAmount(BRS.settings.amount_warning),
                        valueSuffix: BRS.valueSuffix,
                    }),
                )
                return
            }
        }

        if ('feeNXT' in data && BRS.settings.fee_warning && BRS.settings.fee_warning !== '0') {
            if (BigInt(parseAmountToNQT(data.feeNXT)) > BigInt(BRS.settings.fee_warning)) {
                BRS.showedFormWarning = true
                endWithError(
                    $.t('error_max_fee_warning', {
                        burst: formatNQTAsAmount(BRS.settings.fee_warning),
                        valueSuffix: BRS.valueSuffix,
                    }),
                )
                return
            }
        }
    }

    delete data.request_type
    delete data.converted_account_id
    delete data.merchant_info

    const response: PostResponse = await sendRequestA(requestType, data)

    let formFunctionComplete: undefined | ((response: any, data: any) => void)
    if (response.errorCode) {
        $form.find('.error_message').html(String(response.errorDescription).escapeHTML()).show()
        if (formFunctionError) {
            formFunctionError(response, data)
        }
        unlockModal($modal, $btn, false)
        return
    }
    if (response.fullHash) {
        // fullHash only present if the message was signed.
        unlockModal($modal, $btn, false)

        if (!$modal.hasClass('modal-no-hide')) {
            $modal.modal('hide')
        }

        if (successMessage) {
            $.notify(successMessage.escapeHTML(), { type: 'success' })
        }

        formFunctionComplete = BRS.forms[originalRequestType + 'Complete']

        if (typeof formFunctionComplete === 'function' && response.broadcasted) {
            data.requestType = requestType
            formFunctionComplete(response, data)
        }

        // Adds the new unconfirmed message in pages
        checkIncomingNow()

        if (BRS.accountInfo && !BRS.accountInfo.publicKey) {
            $('#dashboard_message').hide()
        }
    } else {
        // no errorCode but response was not signed. Is this part executed?
        let sentToFunction = false

        if (!errorMessage) {
            formFunctionComplete = BRS.forms[originalRequestType + 'Complete']

            if (typeof formFunctionComplete === 'function') {
                sentToFunction = true
                data.requestType = requestType

                unlockModal($modal, $btn, false)

                if (!$modal.hasClass('modal-no-hide')) {
                    $modal.modal('hide')
                }
                formFunctionComplete(response, data)
            } else {
                errorMessage = $.t('error_unknown')
            }
        }

        if (!sentToFunction) {
            unlockModal($modal, $btn, true)

            $.notify(errorMessage.escapeHTML(), { type: 'danger' })
        }
    }
}

export function formsAddCommitment(data: any) {
    let requestType = 'addCommitment'
    if (data.removeCommitment) {
        requestType = 'removeCommitment'
        delete data.removeCommitment
    }
    return {
        requestType,
        data,
    }
}

function getFormData($form: JQuery<HTMLFormElement>): object {
    const serialized = $form.serializeArray()
    const data = {}
    for (const s in serialized) {
        if (data[serialized[s].name] === undefined) {
            data[serialized[s].name] = serialized[s].value
        } else if (typeof data[serialized[s].name] !== 'object') {
            data[serialized[s].name] = [data[serialized[s].name], serialized[s].value]
        } else {
            data[serialized[s].name].push(serialized[s].value)
        }
    }
    return data
}
