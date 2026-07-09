import { BRS } from '..'

import { NxtAddress } from '../../util/nxtaddress'

import { isErrorResponse, sendRequestA } from './send_request'

import { getContactByName } from '../tools/contacts'

import { getAccountIdFromPublicKey } from './encryption'

import { formatNQTAsAmount, formatTimestampAsDateTime } from './numbers'

import { getAccountRSFromObject, convertPublicKeyFromBase36ToBase16 } from './util'

import { GetAccountResponse, GetAliasResponse } from '../typings'

import { evMultiOutSameAmountChange, evMultiOutAmountChange } from '../modals/sendmoney'

import { evCheckNumberInput } from './modals'

export function automaticallyCheckRecipient() {
    const $recipientFields = $(
        '#add_contact_account_id, #update_contact_account_id, #buy_alias_recipient, #escrow_create_recipient, #inline_message_recipient, #reward_assignment_recipient, #sell_alias_recipient, #send_message_recipient, #send_money_recipient, #subscription_cancel_recipient, #subscription_create_recipient, #transfer_alias_recipient, #transfer_asset_recipient, #transfer_asset_multi_recipient',
    )

    $recipientFields.on('blur', function () {
        $(this).trigger('checkRecipientEvent')
    })

    $recipientFields.on('checkRecipientEvent', function () {
        const value = $(this).val()
        const form = $(this).closest('form')
        if (value) {
            checkRecipient(String(value), form)
        } else {
            form.find('.account_info').hide()
        }
    })
}

/**
 * Checks the type of a given account. To be used when user enters an address and the modal shall be updated with the account info.
 *
 * @param accountIdOrRs Account ID or RS.
 * @param callback Function to be called async with the response
 */
async function getAccountTypeAndMessage(accountIdOrRs: string): Promise<{
    type: 'danger' | 'warning' | 'info'
    message: string
    publicKeyNeeded: 'needed' | 'info' | 'hide'
    account: GetAccountResponse | null
}> {
    if (accountIdOrRs === '0' || accountIdOrRs.endsWith('2222-2222-2222-22222')) {
        return {
            type: 'warning',
            message: $.t('recipient_burning_address'),
            account: null,
            publicKeyNeeded: 'hide',
        }
    }

    const response: GetAccountResponse = await sendRequestA('getAccount', { account: accountIdOrRs })

    if (isErrorResponse(response)) {
        switch (response.errorCode) {
            case 4:
                return {
                    type: 'danger',
                    message: $.t('recipient_malformed'),
                    account: null,
                    publicKeyNeeded: 'hide',
                }
            case 5:
                return {
                    type: 'warning',
                    message: $.t('recipient_unknown_pka'),
                    account: null,
                    publicKeyNeeded: 'needed',
                }
        }
        return {
            type: 'danger',
            message: $.t('recipient_problem') + ' ' + String(response.errorDescription).escapeHTML(),
            account: null,
            publicKeyNeeded: 'hide',
        }
    }
    if (response.isAT) {
        return {
            type: 'info',
            message: $.t('recipient_smart_contract', {
                burst: formatNQTAsAmount(response.balanceNQT),
                valueSuffix: BRS.valueSuffix,
            }),
            account: response,
            publicKeyNeeded: 'hide',
        }
    }
    if (response.isSecured === false) {
        return {
            type: 'warning',
            message: $.t('recipient_no_public_key', {
                burst: formatNQTAsAmount(response.unconfirmedBalanceNQT),
                valueSuffix: BRS.valueSuffix,
            }),
            account: response,
            publicKeyNeeded: 'needed',
        }
    }
    return {
        type: 'info',
        message: $.t('recipient_info', {
            burst: formatNQTAsAmount(response.unconfirmedBalanceNQT),
            valueSuffix: BRS.valueSuffix,
        }),
        account: response,
        publicKeyNeeded: 'info',
    }
}

export function evMalformedAddressClick(el: JQuery.ClickEvent) {
    $(el.currentTarget)
        .closest('form')
        .find('input[name=recipient],input[name=account_id]')
        .val($(el.currentTarget).data('address'))
        .trigger('blur')
}

function formatRecipientPublicKey(toType: 'needed' | 'info' | 'hide', form: JQuery<HTMLFormElement>, publicKey?: string) {
    switch (toType) {
        case 'needed':
            form.find('input[name=recipientPublicKey]').val('').prop('disabled', false)
            form.find('.recipient_public_key').show()
            break
        case 'hide':
            form.find('input[name=recipientPublicKey]').val('').prop('disabled', false)
            form.find('.recipient_public_key').hide()
            break
        default:
            // info
            form.find('input[name=recipientPublicKey]')
                .val(publicKey ?? '')
                .prop('disabled', true)
            form.find('.recipient_public_key').show()
    }
}

async function checkRecipient(account: string, form: JQuery<HTMLFormElement>) {
    const callout = form.find('.account_info').first()
    const accountInputField = form.find('input[name=converted_account_id]')
    const merchantInfoField = form.find('input[name=merchant_info]')

    accountInputField.val('')
    merchantInfoField.val('')
    account = account.trim()

    const accountParts = BRS.rsRegEx.exec(account)
    if (accountParts !== null) {
        // Account seems to be RS Address
        const address = new NxtAddress(accountParts[2])
        if (address.isOk()) {
            // Account is a valid RS Address
            if (accountParts[3] !== undefined) {
                // Account is extended RS Address. Verify the public key
                const publicKey = convertPublicKeyFromBase36ToBase16(accountParts[3])
                const checkRS = getAccountIdFromPublicKey(publicKey, true)
                if (!checkRS.includes(accountParts[2])) {
                    // Public key does not match RS Address
                    formatRecipientPublicKey('hide', form)
                    updateCallout(callout, 'alert-danger', $.t('recipient_malformed'))
                    return
                }
                // Address matches given public key!
                const response = await getAccountTypeAndMessage(address.getAccountId())
                if (!response.account) {
                    // Expected if first time sending funds to a new account
                    formatRecipientPublicKey('info', form, publicKey)
                    updateCallout(callout, 'alert-' + response.type, $.t('recipient_info_extended') + ' ' + response.message)
                    return
                }
                if (response.account.publicKey && response.account.publicKey !== publicKey) {
                    // Rare, same id but two different public keys
                    formatRecipientPublicKey('hide', form)
                    updateCallout(callout, 'alert-danger', $.t('error_public_key_different_account_id'))
                    return
                }
                // Given public key matches the registered public key.
                checkForMerchant(response.account?.description, form)
                formatRecipientPublicKey('info', form, publicKey)
                updateCallout(callout, 'alert-' + response.type, $.t('recipient_info_extended') + ' ' + response.message)
                return
            }

            // Account has no extended address.
            const response = await getAccountTypeAndMessage(address.getAccountId())
            formatRecipientPublicKey(response.publicKeyNeeded, form, response.account?.publicKey)
            checkForMerchant(response.account?.description, form)
            updateCallout(callout, 'alert-' + response.type, response.message)
            return
        }

        // Account seems to be RS Address but there is an error
        const guessedAddresses = address.getGuesses(BRS.prefix)
        if (guessedAddresses.length > 0) {
            // Error correction found suggestions
            let html = $.t('recipient_malformed_suggestion_plural') + '<ul>'
            for (const guess of guessedAddresses) {
                html += `
                    <li>
                      <span
                        class='malformed_address pointer'
                        data-address='${guess}'>
                        ${address.formatGuess(guess, account)}
                      </span>
                    </li>`
            }
            html += '</ul>'
            updateCallout(callout, 'alert-danger', html)
            callout.find('.malformed_address').on('click', evMalformedAddressClick)
            return
        }

        // Account is too wrong that there are no error correction suggestion
        updateCallout(callout, 'alert-danger', $.t('recipient_malformed'))
        return
    }

    if (BRS.idRegEx.test(account)) {
        // Account matches numeric ID
        const response = await getAccountTypeAndMessage(account)
        formatRecipientPublicKey(response.publicKeyNeeded, form, response.account?.publicKey)
        updateCallout(callout, 'alert-' + response.type, response.message.escapeHTML())
        return
    }

    if (account.charAt(0) === '@') {
        // Supposed to be an alias
        checkRecipientAlias(account.substring(1), form)
        return
    }

    const contact = getContactByName(account)
    if (contact) {
        // Account found in the contacts!
        const response = await getAccountTypeAndMessage(contact.account)
        formatRecipientPublicKey(response.publicKeyNeeded, form, response.account?.publicKey)
        checkForMerchant(response.account?.description, form)
        const message =
            $.t('contact_account_link', { account_id: getAccountRSFromObject(contact, 'account') }) + ' ' + response.message.escapeHTML()
        updateCallout(callout, 'alert-' + response.type, message)
        if (response.type === 'info' || response.type === 'warning') {
            accountInputField.val(contact.accountRS)
        }
        return
    }

    // No idea what the input is, guess that it's a contact wrongly typed. Strange because there are the contacts selector.
    const msg = $.t('name_not_in_contacts', { name: account }) + ' ' + $.t('recipient_alias_suggestion')
    updateCallout(callout, 'alert-danger', msg)
}

async function checkRecipientAlias(account: string, form: JQuery<HTMLFormElement>) {
    const callout = form.find('.account_info').first()
    const accountInputField = form.find('input[name=converted_account_id]')

    accountInputField.val('')

    const response: GetAliasResponse = await sendRequestA('getAlias', { aliasName: account })

    if (response.errorCode) {
        updateCallout(callout, 'alert-danger', $.t('error_invalid_alias_name'))
        return
    }

    if (response.aliasURI) {
        const alias = String(response.aliasURI)
        const timestamp = response.timestamp

        const regex_1 = /acct:(.*)@burst/
        const regex_2 = /nacc:(.*)/
        const match = alias.match(regex_1) || alias.match(regex_2)

        if (match && match[1]) {
            const address = new NxtAddress(String(match[1]).toUpperCase())
            if (!address.isOk()) {
                updateCallout(callout, 'alert-danger', $.t('invalid_account_alias'))
                return
            }

            const response2 = await getAccountTypeAndMessage(address.getAccountId())
            formatRecipientPublicKey(response2.publicKeyNeeded, form, response2.account?.publicKey)
            checkForMerchant(response2.account?.description, form)

            accountInputField.val(address.getAccountRS(BRS.prefix))
            let text = $.t('alias_account_link', { account_id: address.getAccountRS(BRS.prefix) })
            text += '.<br>'
            text += $.t('alias_last_adjusted', { timestamp: formatTimestampAsDateTime(timestamp) })
            text += `<br>${response2.message}`
            updateCallout(callout, 'alert-' + response2.type, text)
            return
        }

        let msg = $.t('alias_account_no_link')
        msg += !alias ? $.t('error_uri_empty') : $.t('uri_is', { uri: String(alias).escapeHTML() })
        updateCallout(callout, 'alert-danger', msg)
        return
    }

    if (response.aliasName) {
        updateCallout(callout, 'alert-danger', $.t('error_alias_empty_uri'))
        return
    }

    const msg = response.errorDescription ? $.t('error') + ': ' + response.errorDescription : $.t('error_alias')
    updateCallout(callout, 'alert-danger', msg)
}

function updateCallout(callout: JQuery<HTMLElement>, alertClass: string, message: string) {
    callout.removeClass('alert-info alert-danger alert-warning').addClass(alertClass).html(message).show()
    if (alertClass === 'alert-danger') {
        callout.closest('form').find('input[name="recipient"]').addClass('is-invalid')
    } else {
        callout.closest('form').find('input[name="recipient"]').removeClass('is-invalid')
    }
}

function checkForMerchant(accountInfo: string | undefined, form: JQuery<HTMLFormElement>) {
    if (!accountInfo) return
    const requestType = form.find('input[name=request_type]').val()
    if (requestType !== 'sendMoney' && requestType !== 'transferAsset') {
        return
    }
    if (!accountInfo.match(/merchant/i)) {
        return
    }
    form.find('input[name=merchant_info]').val(accountInfo)
    const checkbox = form.find('input[name=add_message]')
    if (!checkbox.is(':checked')) {
        checkbox.prop('checked', true).trigger('change')
    }
}

export function evSpanRecipientSelectorClickButton(event: JQuery.ClickEvent) {
    const element = event.target
    const $list = $(element).parent().find('ul')
    if (!Object.keys(BRS.contacts).length) {
        $list.html(`<li><a class='dropdown-item' href='#' data-contact=''>${$.t('error_no_contacts_available')}</a></li>`)
        return
    }
    $list.empty()
    const names: string[] = []
    for (const accountId in BRS.contacts) {
        names.push(BRS.contacts[accountId].name)
    }
    names.sort((a, b) => {
        const nameA = a.toUpperCase()
        const nameB = b.toUpperCase()
        if (nameA < nameB) return -1
        if (nameA > nameB) return 1
        return 0
    })
    for (const name of names) {
        $list.append("<li><a class='dropdown-item' href='#' data-contact='" + name.escapeHTML() + "'>" + name.escapeHTML() + '</a></li>')
    }
}

export function evSpanRecipientSelectorClickUlLiA(e: JQuery.ClickEvent) {
    const element = e.target
    e.preventDefault()
    $(element).closest('form').find('input[name=converted_account_id]').val('')
    $(element).closest('.input-group').find('input').not('[type=hidden]').val($(element).data('contact')).trigger('blur')
}

export function evAddRecipientsClick(e: JQuery.ClickEvent) {
    e.preventDefault()
    if ($('#send_money_same_out_checkbox').is(':checked')) {
        $('#multi_out_same_recipients').append($('#additional_multi_out_same_recipient').html()) // add input box
    } else {
        $('#multi_out_recipients').append($('#additional_multi_out_recipient').html()) // add input box
    }
    $('input[name=recipient_multi_out_same]').off('blur').on('blur', evMultiOutSameAmountChange)
    $('input[name=recipient_multi_out]').off('blur').on('blur', evMultiOutAmountChange)
    $('input[name=amount_multi_out]').off('blur').on('blur', evMultiOutAmountChange)
    $('#send_money_modal .ev-check-number-input').off('input').on('input', evCheckNumberInput)
    $('.remove_recipient .remove_recipient_button').off('click').on('click', evDocumentOnClickRemoveRecipient)

    $('span.recipient_selector').on('click', 'button', evSpanRecipientSelectorClickButton)
    $('span.recipient_selector').on('click', 'ul li a', evSpanRecipientSelectorClickUlLiA)
}

export function evDocumentOnClickRemoveRecipient(e: JQuery.ClickEvent) {
    const element = e.target
    e.preventDefault()
    $(element).parent().parent('div').remove()

    if ($('#send_money_same_out_checkbox').is(':checked')) {
        evMultiOutSameAmountChange()
    } else {
        evMultiOutAmountChange()
    }
}
