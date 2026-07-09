import { BRS } from '..'

import { NxtAddress } from '../../util/nxtaddress'

import { sendRequestA } from '../core/send_request'

import { formatNQTAsAmount, formatTimestampAsDateTime } from '../core/numbers'

import { createInfoTable } from '../core/util'

import { GetAliasResponse, PostResponse, ShowBootstrapModalEvent } from '../typings'
import { notify } from '../core/notifications'

export function evAliasModalOnShowBsModal(e: JQuery.TriggeredEvent) {
    const $invoker = $((e as ShowBootstrapModalEvent).relatedTarget)
    const modal = e.target

    const alias = String($invoker.data('alias'))

    $(modal).find('input[name=aliasName]').val(alias)
    $(modal).find('.alias_name_display').html(alias)
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

export function formsSellAliasComplete(response: PostResponse, data: any) {
    const $row = $('#aliases_table tr[data-alias=' + String(data.aliasName).toLowerCase().escapeHTML() + ']')

    $row.addClass('tentative')

    // transfer
    if (data.priceNQT === '0') {
        if (data.recipient === BRS.account) {
            $row.find('td.status').html("<span class='label label-small label-info'>" + $.t('cancelling_sale') + '</span>')
            $row.find('a.cancel_alias_sale').remove()
        } else {
            $row.find('td.status').html("<span class='label label-small label-info'>" + $.t('transfer_in_progress') + '</span>')
        }
    } else {
        if (data.recipient !== BRS.genesis) {
            $row.find('td.status').html("<span class='label label-small label-info'>" + $.t('for_sale_direct') + '</span>')
        } else {
            $row.find('td.status').html("<span class='label label-small label-info'>" + $.t('for_sale_indirect') + '</span>')
        }
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

    const response: GetAliasResponse = await sendRequestA('getAlias', {
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

export function formsBuyAliasComplete(response: PostResponse, data: any) {
    // Not needed if correct 'incoming' supporting pending transactions
    if (BRS.currentPage !== 'aliases') {
        return
    }

    data.aliasName = String(data.aliasName).escapeHTML()
    data.aliasURI = ''

    $('#aliases_table tbody').prepend(`
        <tr class='tentative' data-alias='${data.aliasName.toLowerCase()}'>
          <td class='alias'>${data.aliasName}</td>
          <td class='uri'>${data.aliasURI}</td>
          <td>/</td>
          <td style='white-space:nowrap'>
            <a class='btn btn-xs btn-default' href='#'>${$.t('edit')}</a> 
            <a class='btn btn-xs btn-default' href='#'>${$.t('transfer')}</a> 
            <a class='btn btn-xs btn-default' href='#'>${$.t('sell')}</a>
          </td>
        </tr>`)
    if ($('#aliases_table').parent().hasClass('data-empty')) {
        $('#aliases_table').parent().removeClass('data-empty')
    }
}

export async function evRegisterAliasModalOnShowBsModal(e: JQuery.TriggeredEvent) {
    const $invoker = $((e as ShowBootstrapModalEvent).relatedTarget)

    const alias = $invoker.data('alias')

    if (alias) {
        BRS.fetchingModalData = true
        const response: GetAliasResponse = await sendRequestA('getAlias', {
            aliasName: alias,
        })
        BRS.fetchingModalData = false
        if (response.errorCode) {
            e.preventDefault()
            notify($.t('error_alias_not_found'), { type: 'danger' })
        } else {
            let aliasURI: RegExpExecArray | null
            const reg = /^https?:\/\//i
            if (reg.test(response.aliasURI)) {
                setAliasType('uri', response.aliasURI)
            } else if ((aliasURI = /acct:(.*)@burst/.exec(response.aliasURI)) || (aliasURI = /nacc:(.*)/.exec(response.aliasURI))) {
                setAliasType('account', response.aliasURI)
                response.aliasURI = String(aliasURI[1]).toUpperCase()
            } else {
                setAliasType('general', response.aliasURI)
            }

            $('#register_alias_modal h4.modal-title').html($.t('update_alias'))
            $('#register_alias_modal .btn-primary').html($.t('update'))
            $('#register_alias_alias').val(alias.escapeHTML()).hide()
            $('#register_alias_alias_noneditable').html(alias.escapeHTML()).show()
            $('#register_alias_alias_update').val(1)
        }
        return
    }
    // no alias given
    $('#register_alias_modal h4.modal-title').html($.t('register_alias'))
    $('#register_alias_modal .btn-primary').html($.t('register'))

    const prefill = $invoker.data('prefill-alias')

    if (prefill) {
        $('#register_alias_alias').val(prefill).show()
    } else {
        $('#register_alias_alias').val('').show()
    }
    $('#register_alias_alias_noneditable').html('').hide()
    $('#register_alias_alias_update').val(0)
    setAliasType('uri', '')
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

    sendRequestA('getAlias', {
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

export function formsSetAliasComplete(response: PostResponse, data: any) {
    // Not needed if unconfirmed is handled in alias page
    if (BRS.currentPage !== 'aliases') {
        return
    }
    data.aliasName = String(data.aliasName).escapeHTML()
    data.aliasURI = String(data.aliasURI)

    if (data.aliasURI.length > 100) {
        data.shortAliasURI = data.aliasURI.substring(0, 100) + '...'
        data.shortAliasURI = data.shortAliasURI.escapeHTML()
    } else {
        data.shortAliasURI = data.aliasURI.escapeHTML()
    }

    data.aliasURI = data.aliasURI.escapeHTML()

    const $table = $('#aliases_table tbody')

    const $row = $table.find('tr[data-alias=' + data.aliasName.toLowerCase() + ']')

    if ($row.length) {
        $row.addClass('tentative')
        $row.find('td.alias').html(data.aliasName)

        if (data.aliasURI && data.aliasURI.indexOf('http') === 0) {
            $row.find('td.uri').html("<a href='" + data.aliasURI + "' target='_blank'>" + data.shortAliasURI + '</a>')
        } else {
            $row.find('td.uri').html(data.shortAliasURI)
        }

        notify($.t('success_alias_update'), { type: 'success' })
        return
    }
    const $rows = $table.find('tr')

    const rowToAdd =
        "<tr class='tentative' data-alias='" +
        data.aliasName.toLowerCase() +
        "'><td class='alias'>" +
        data.aliasName +
        "</td><td class='uri'>" +
        (data.aliasURI && data.aliasURI.indexOf('http') === 0
            ? "<a href='" + data.aliasURI + "' target='_blank'>" + data.shortAliasURI + '</a>'
            : data.shortAliasURI) +
        "</td><td>/</td><td style='white-space:nowrap'><a class='btn btn-xs btn-default' href='#'>" +
        $.t('edit') +
        "</a> <a class='btn btn-xs btn-default' href='#'>" +
        $.t('transfer') +
        "</a> <a class='btn btn-xs btn-default' href='#'>" +
        $.t('sell') +
        '</a></td></tr>'

    let rowAdded = false

    const newAlias = data.aliasName.toLowerCase()

    if ($rows.length) {
        $rows.each(function () {
            const alias = $(this).data('alias')

            if (newAlias < alias) {
                $(this).before(rowToAdd)
                rowAdded = true
                return false
            }
        })
    }

    if (!rowAdded) {
        $table.append(rowToAdd)
    }

    if ($('#aliases_table').parent().hasClass('data-empty')) {
        $('#aliases_table').parent().removeClass('data-empty')
    }

    notify($.t('success_alias_register'), { type: 'success' })
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
    const response: GetAliasResponse = await sendRequestA('getAlias', {
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
        account: response.accountRS,
        last_updated: formatTimestampAsDateTime(response.timestamp),
        data_formatted_html: String(response.aliasURI),
    }
    const aliasCallout = getAliasStatus(response)
    $('#alias_sale_callout').html(aliasCallout)
    $('#alias_sale_callout').show()
    $('#alias_info_table tbody').append(createInfoTable(data))
    $('#alias_info_modal').modal('show')
    BRS.fetchingModalData = false
}
