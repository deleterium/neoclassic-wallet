import { BRS } from '..'

import { NxtAddress } from '../../util/nxtaddress'

import { sendRequest } from '../core/send_request'

import { formatNQTAsAmount, formatTimestampAsDateTime } from '../core/numbers'

import { createInfoTable, getAccountTitle } from '../core/util'

import { GetAliasResponse, PostResponse, ShowBootstrapModalEvent } from '../typings'
import { notify } from '../core/notifications'
import { showModal } from '../core/modals'

export function evAliasModalOnShowBsModal(e: JQuery.TriggeredEvent) {
    const $invoker = $((e as ShowBootstrapModalEvent).relatedTarget)
    const modal = e.target

    const alias = String($invoker.data('alias'))
    const aliasName = String($invoker.data('alias-name'))
    const tld = String($invoker.data('tld'))

    $(modal).find('input[name=alias]').val(alias)
    $(modal).find('.alias_name_display').text(aliasName)
    $(modal).find('.alias_tld_display').text(tld)
}

export function showAliasOperationModal(modalName: 'transfer_alias', alias: string, aliasName: string, tld: string) {
    const $targetModal = $(`#${modalName}_modal`)

    $targetModal.find('input[name=alias]').val(alias)
    $targetModal.find('.alias_name_display').text(aliasName)
    $targetModal.find('.alias_tld_display').text(tld)

    showModal(modalName)
}

export function formsSellAlias(data: any) {
    let successMessage = ''
    let errorMessage = ''

    if (data.modal === 'cancel_alias_sale') {
        data.priceNXT = '0'
        data.recipient = BRS.accountRS
        successMessage = $.t('success_cancel_alias')
        errorMessage = $.t('error_cancelAlias')
    } else if (data.modal === 'transfer_alias') {
        data.priceNXT = '0'
        successMessage = $.t('success_transferAlias')
        errorMessage = $.t('error_transferAlias')
    } else {
        successMessage = $.t('success_sellAlias')
        errorMessage = $.t('error_sellAlias')
        if (data.sell_to_specific) {
            if (!data.recipient) {
                return {
                    error: $.t('error_not_specified', {
                        name: $.t('recipient').toLowerCase(),
                    }).capitalize(),
                }
            }
            delete data.sell_to_specific
        } else {
            // No recipient in this transaction type
            if (!data.priceNXT || data.priceNXT === '0') {
                return {
                    error: $.t('error_not_specified', {
                        name: $.t('price').toLowerCase(),
                    }).capitalize(),
                }
            }
            if (data.add_message && data.encrypt_message) {
                return {
                    error: $.t('error_recipient_no_public_key').capitalize(),
                }
            }
            delete data.recipient
        }
    }

    delete data.modal

    return {
        data,
        successMessage,
        errorMessage,
    }
}

export function evSellAliasSellToSpecificClick(e: JQuery.ClickEvent) {
    const element = e.currentTarget
    const $form = $(element).closest('form')
    $form.find('.account_info').hide()
    $form.find('input[name=recipient]').val('')
    $form.find('input[name=converted_account_id]').val('')
}

/**
 * Called when showing "Buy Alias Modal". Invoker is "<a>" with "data-buy-alias" set. Fetches the alias details and shows them.
 * @param {*} e Event
 */
export async function evBuyAliasModalOnShowBsModal(e: JQuery.TriggeredEvent) {
    const $modal = $(e.target)
    const $invoker = $((e as ShowBootstrapModalEvent).relatedTarget)

    BRS.fetchingModalData = true

    const alias = String($invoker.data('buy-alias'))

    const response: GetAliasResponse = await sendRequest('getAlias', {
        alias: alias,
    })
    BRS.fetchingModalData = false

    if (response.errorCode) {
        e.preventDefault()
        notify($.t('error_alias_not_found'), { type: 'danger' })
        return
    }
    if (!response.priceNQT) {
        e.preventDefault()
        notify($.t('error_alias_not_for_sale'), { type: 'danger' })
        return
    }
    if (typeof response.buyer !== 'undefined' && response.buyer !== BRS.account) {
        e.preventDefault()
        notify($.t('error_alias_sale_different_account'), { type: 'danger' })
        return
    }
    $modal.find('input[name=alias]').val(response.alias)
    $modal.find('.alias_id_display').html(response.alias)
    $modal.find('.alias_name_display').html(response.aliasName)
    $modal.find('.alias_tld_display').html(response.tldName)
    $modal.find('input[name=amountNXT]').val(formatNQTAsAmount(response.priceNQT)).prop('readonly', true)
}

export function formsBuyAliasError() {
    $('#buy_alias_modal').find('input[name=priceNXT]').prop('readonly', false)
}

export async function showUpdateAliasModal(alias: string) {
    BRS.fetchingModalData = true
    const response: GetAliasResponse = await sendRequest('getAlias', {
        alias: alias,
    })
    BRS.fetchingModalData = false
    if (response.errorCode) {
        notify($.t('error_alias_not_found'), { type: 'danger' })
        return
    }
    let aliasURI: RegExpExecArray | null
    const reg = /^https?:\/\//i
    let responseURI = response.aliasURI.unescapeHTML()
    if (reg.test(responseURI)) {
        setAliasType('uri', responseURI)
    } else if ((aliasURI = /acct:(.*)@burst/.exec(responseURI)) || (aliasURI = /nacc:(.*)/.exec(responseURI))) {
        setAliasType('account', responseURI)
        responseURI = String(aliasURI[1]).toUpperCase()
    } else {
        setAliasType('general', responseURI)
    }

    $('#register_alias_modal h4.modal-title').html($.t('update_alias'))
    $('#register_alias_modal .btn-primary').html($.t('update'))
    $('#register_alias_alias_noneditable').text(response.aliasName).show()
    $('#register_alias_alias_name').val(response.aliasName).hide()
    $('#register_alias_tld').val(response.tldName).hide()
    $('#register_alias_tld_noneditable').text(response.tldName).show()
    $('#register_alias_tld_help').hide()
    $('#register_alias_alias_update').val(1)
    $('#register_alias_uri').val(responseURI)
    showModal('register_alias')
}

export async function showRegisterAliasModal() {
    $('#register_alias_modal h4.modal-title').html($.t('register_alias'))
    $('#register_alias_modal .btn-primary').html($.t('register'))
    $('#register_alias_alias_name').val('').show()

    $('#register_alias_alias_noneditable').html('').hide()
    $('#register_alias_alias_update').val(0)
    $('#register_alias_tld').val('').show()
    $('#register_alias_tld_noneditable').text('').hide()
    $('#register_alias_tld_help').show()
    setAliasType('uri', '')
    showModal('register_alias')
}

export function formsSetAlias(data: any) {
    data.aliasURI = data.aliasURI.toLowerCase().trim()

    if (data.type === 'account' && !/(acct:.*@burst|nacc:.*)/.test(data.aliasURI)) {
        if (BRS.rsRegEx.test(data.aliasURI.toUpperCase())) {
            const address = new NxtAddress(data.aliasURI)
            if (!address.isOk()) {
                return {
                    error: $.t('error_invalid_account_id'),
                }
            }
            data.aliasURI = 'acct:' + data.aliasURI + '@burst'
        } else if (BRS.idRegEx.test(data.aliasURI)) {
            data.aliasURI = 'acct:' + data.aliasURI + '@burst'
        } else {
            return {
                error: $.t('error_invalid_account_id'),
            }
        }
    }

    delete data.type

    return {
        data,
    }
}

export function setAliasType(type: string, uri: string) {
    $('#register_alias_type').val(type)

    if (type === 'uri') {
        $('#register_alias_uri_label').html($.t('uri'))
        $('#register_alias_uri').prop('placeholder', $.t('uri'))
        const reg = /^https?:\/\//i
        if (uri) {
            if (uri === BRS.accountRS) {
                $('#register_alias_uri').val('https://')
            } else if (!reg.test(uri)) {
                $('#register_alias_uri').val('https://' + uri)
            } else {
                $('#register_alias_uri').val(uri)
            }
        } else {
            $('#register_alias_uri').val('https://')
        }
        $('#register_alias_help').hide()
    } else if (type === 'account') {
        $('#register_alias_uri_label').html($.t('account_id'))
        $('#register_alias_uri').prop('placeholder', $.t('account_id'))
        $('#register_alias_uri').val('')

        if (uri) {
            let match = uri.match(/acct:(.*)@burst/i)
            if (!match) {
                match = uri.match(/nacc:(.*)/i)
            }

            if (match && match[1]) {
                uri = match[1]
            }

            if (/^\d+$/.test(uri)) {
                const address = new NxtAddress(uri)
                uri = address.getAccountRS(BRS.prefix)
            } else if (!BRS.rsRegEx.test(uri.toUpperCase())) {
                uri = BRS.accountRS
            }

            uri = uri.toUpperCase()

            $('#register_alias_uri').val(uri)
        } else {
            $('#register_alias_uri').val(BRS.accountRS)
        }
        $('#register_alias_help').html($.t('alias_account_help')).show()
    } else {
        $('#register_alias_uri_label').html($.t('data'))
        $('#register_alias_uri').prop('placeholder', $.t('data'))
        if (uri) {
            if (uri === BRS.accountRS) {
                $('#register_alias_uri').val('')
            } else if (uri === 'https://') {
                $('#register_alias_uri').val('')
            } else {
                $('#register_alias_uri').val(uri)
            }
        }
        $('#register_alias_help').html($.t('alias_data_help')).show()
    }
}

export function formsSetAliasError(response: PostResponse, data: any) {
    if (!response.errorCode || response.errorCode !== 8) {
        return
    }

    const errorDescription = String(response.errorDescription)

    $('#register_alias_modal')
        .find('.error_message')
        .html(errorDescription + '. ' + BRS.pendingTransactionHTML)

    sendRequest('getAlias', {
        aliasName: data.aliasName,
    }).then((response: GetAliasResponse) => {
        if (response.errorCode) {
            $('#register_alias_modal')
                .find('.error_message')
                .html(errorDescription + '. ' + (response.errorDescription || ''))
            return
        }
        const message = getAliasStatus(response)

        $('#register_alias_modal')
            .find('.error_message')
            .html(errorDescription + '. ' + message)
    })
}

export function formsSetTLDComplete(response: PostResponse, data: any) {
    BRS.tlds[data.tld] = response.transaction
}

/**
 * Opens a "Alias Modal" with the given alias.
 * @param {string|Alias} alias - If string, the alias ID to be requested and shown. If the object, just show it.
 * @returns
 */
export async function showAliasModal(alias: string | GetAliasResponse) {
    if (BRS.fetchingModalData) {
        return
    }
    if (typeof alias === 'object') {
        aliasModalDataReady(alias)
        return
    }
    BRS.fetchingModalData = true
    const response: GetAliasResponse = await sendRequest('getAlias', {
        alias: alias,
    })
    BRS.fetchingModalData = false
    if (response.errorCode) {
        notify(`${$.t('error_alias_not_found')} - ${String(alias).escapeHTML()}`)
        return
    }
    aliasModalDataReady(response)
}

function getAliasStatus(alias: GetAliasResponse) {
    let message = ''
    if (!alias.priceNQT) {
        return $.t('alias_not_on_sale')
    }
    if (!alias.buyer) {
        message = $.t('alias_sale_indirect_offer', {
            burst: formatNQTAsAmount(alias.priceNQT),
            valueSuffix: BRS.valueSuffix,
        })
        message += ` <a href='#' data-buy-alias='${alias.alias}' data-toggle='modal' data-target='#buy_alias_modal'>${$.t('buy_it_q')}</a>`
        return message
    }
    if (alias.buyer === BRS.account) {
        message = $.t('alias_sale_direct_offer', {
            burst: formatNQTAsAmount(alias.priceNQT),
            valueSuffix: BRS.valueSuffix,
        })
        message += ` <a href='#' data-buy-alias='${alias.alias}' data-toggle='modal' data-target='#buy_alias_modal'>${$.t('buy_it_q')}</a>`
        return message
    }
    return $.t('error_alias_sale_different_account')
}

/**
 * Draws the data into "Alias Modal"
 * @param {import('../typings').Alias} response - Alias data
 */
function aliasModalDataReady(response: GetAliasResponse) {
    $('#alias_info_table tbody').empty()
    $('#alias_info_modal_alias').text(response.aliasName)
    const data = {
        account: getAccountTitle(response.accountRS),
        alias_name: response.tldName ? (response.aliasName ?? '') : '',
        tld: response.tldName || response.aliasName,
        last_updated: formatTimestampAsDateTime(response.timestamp),
        data_formatted_html: response.aliasURI ?? '',
    }
    const aliasCallout = getAliasStatus(response)
    $('#alias_sale_callout').html(aliasCallout)
    $('#alias_sale_callout').show()
    $('#alias_info_table tbody').append(createInfoTable(data))
    $('#alias_info_modal').modal('show')
    BRS.fetchingModalData = false
}
