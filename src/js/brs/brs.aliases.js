/**
 * @depends {brs.js}
 */

import { BRS } from '.'
import { NxtAddress } from '../util/nxtaddress'

import {
    reloadCurrentPage,
    pageLoaded
} from './brs'

import {
    sendRequest
} from './brs.server'

import {
    convertToNXT,
    formatAmount,
    formatTimestamp,
    getAccountTitle,
    getAccountFormatted,
    dataLoadFinished,
    createInfoTable,
    getUnconfirmedTransactionsFromCache,
    hasTransactionUpdates
} from './brs.util'

// TODO change to pagination?
// $(window).scroll(function () {
//     if ($(window).scrollTop() + $(window).height() > $(document).height() - 100 && BRS.is_loading_aliases == false && $('#search_aliases').val().length == 0) {
//         const aliases = $('#aliases_table tbody')
//         if (aliases[0].childElementCount >= BRS.alias_page_elements) {
//             BRS.is_loading_aliases = true
//             $('#loading_aliases').html('<span data-i18n="loading_aliases">Loading aliases</span>... <i class="fa fa-spinner fa-pulse fa-fw" style="color:red;"></i>')
//             if ($('#search_aliases').val().length == 0) {
//                 sendRequest('getAliases+', {
//                     account: BRS.account,
//                     timestamp: 0,
//                     firstIndex: aliases[0].childElementCount,
//                     lastIndex: aliases[0].childElementCount + BRS.alias_page_elements - 1
//                 }, function (response) {
//                     BRS.is_loading_aliases = false
//                     $('#loading_aliases').empty()
//                     if (response.aliases && response.aliases.length) {
//                         const aliases = response.aliases

//                         if (BRS.unconfirmedTransactions.length) {
//                             for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
//                                 if (unconfirmedTransaction.type === 1 && (unconfirmedTransaction.subtype === 1 || unconfirmedTransaction.subtype === 7)) {
//                                     let found = false

//                                     for (let j = 0; j < aliases.length; j++) {
//                                         if (aliases[j].aliasName === unconfirmedTransaction.attachment.alias) {
//                                             aliases[j].aliasURI = unconfirmedTransaction.attachment.uri
//                                             aliases[j].tentative = true
//                                             found = true
//                                             break
//                                         }
//                                     }

//                                     if (!found) {
//                                         aliases.push({
//                                             aliasName: unconfirmedTransaction.attachment.alias,
//                                             aliasURI: (unconfirmedTransaction.attachment.uri ? unconfirmedTransaction.attachment.uri : ''),
//                                             tentative: true
//                                         })
//                                     }
//                                 }
//                             }
//                         }
//                         aliases.sort(function (a, b) {
//                             const a_low = a.aliasName.toLowerCase()
//                             const b_low = b.aliasName.toLowerCase()
//                             if (a_low > b_low) {
//                                 return 1
//                             }
//                             if (a_low < b_low) {
//                                 return -1
//                             }

//                             return 0
//                         })
//                         let rows = ''
//                         for (const alias of aliases) {
//                             alias.status = '/'

//                             const unconfirmedTransaction = getUnconfirmedTransactionsFromCache(1, 6, {
//                                 alias: alias.aliasName
//                             }, true)

//                             if (unconfirmedTransaction) {
//                                 alias.tentative = true
//                                 if (unconfirmedTransaction.recipient) {
//                                     alias.buyer = unconfirmedTransaction.recipient
//                                 }
//                                 alias.priceNQT = unconfirmedTransaction.priceNQT
//                             }

//                             if (!alias.aliasURI) {
//                                 alias.aliasURI = ''
//                             }

//                             if (alias.aliasURI.length > 100) {
//                                 alias.shortAliasURI = alias.aliasURI.substring(0, 100) + '...'
//                                 alias.shortAliasURI = alias.shortAliasURI.escapeHTML()
//                             } else {
//                                 alias.shortAliasURI = alias.aliasURI.escapeHTML()
//                             }

//                             alias.aliasURI = alias.aliasURI.escapeHTML()

//                             let allowCancel = false

//                             if ('priceNQT' in alias) {
//                                 if (alias.priceNQT === '0') {
//                                     if (alias.buyer === BRS.account) {
//                                         alias.status = $.t('cancelling_sale')
//                                     } else {
//                                         alias.status = $.t('transfer_in_progress')
//                                     }
//                                 } else {
//                                     if (!alias.tentative) {
//                                         allowCancel = true
//                                     }

//                                     if (typeof alias.buyer !== 'undefined') {
//                                         alias.status = $.t('for_sale_direct')
//                                     } else {
//                                         alias.status = $.t('for_sale_indirect')
//                                     }
//                                 }
//                             }

//                             if (alias.status !== '/') {
//                                 alias.status = "<span class='label label-small label-info'>" + alias.status + '</span>'
//                             }
//                             const aliasName = String(alias.aliasName).escapeHTML()
//                             rows += '<tr' + (alias.tentative ? " class='tentative'" : '') +
//                                               " data-alias='" + aliasName.toLowerCase() +
//                                               "'><td class='alias'>" + aliasName +
//                                               "</td><td class='uri'>" +
//                                               (alias.aliasURI.indexOf('http') === 0
//                                                   ? "<a href='" + alias.aliasURI + "' target='_blank'>" + alias.shortAliasURI + '</a>'
//                                                   : alias.shortAliasURI) +
//                                               "</td><td class='status'>" + alias.status +
//                                               "</td><td style='white-space:nowrap'><a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#register_alias_modal' data-alias='" +
//                                               aliasName + "'>" +
//                                               $.t('edit') +
//                                               "</a> <a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#transfer_alias_modal' data-alias='" +
//                                               aliasName + "'>" +
//                                               $.t('transfer') +
//                                               "</a> <a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#sell_alias_modal' data-alias='" +
//                                               aliasName + "'>" +
//                                               $.t('sell') +
//                                               '</a>' + (allowCancel ? " <a class='btn btn-xs btn-default cancel_alias_sale' href='#' data-toggle='modal' data-target='#cancel_alias_sale_modal' data-alias='" + aliasName + "'>" + $.t('cancel_sale') + '</a>' : '') +
//                                               '</td></tr>'
//                         }

//                         $('#aliases_table tbody').append(rows)
//                     }
//                 })
//             }
//         }
//     }
// })

// TODO there are duplicated code
export function pagesAliases () {
    sendRequest('getAliases+', {
        account: BRS.account,
        timestamp: 0
    }, function (response) {
        if (response.aliases && response.aliases.length) {
            const aliases = response.aliases
            if (BRS.unconfirmedTransactions.length) {
                for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
                    if (unconfirmedTransaction.type === 1 && (unconfirmedTransaction.subtype === 1 || unconfirmedTransaction.subtype === 7)) {
                        let found = false

                        for (let j = 0; j < aliases.length; j++) {
                            if (aliases[j].aliasName === unconfirmedTransaction.attachment.alias) {
                                aliases[j].aliasURI = unconfirmedTransaction.attachment.uri
                                aliases[j].tentative = true
                                found = true
                                break
                            }
                        }

                        if (!found) {
                            aliases.push({
                                aliasName: unconfirmedTransaction.attachment.alias,
                                aliasURI: (unconfirmedTransaction.attachment.uri ? unconfirmedTransaction.attachment.uri : ''),
                                tentative: true
                            })
                        }
                    }
                }
            }
            let alias_account_count = 0
            let alias_uri_count = 0
            let empty_alias_count = 0
            const alias_count = aliases.length

            for (const alias of aliases) {
                if (!alias.aliasURI) {
                    alias.aliasURI = ''
                }
                alias.aliasURI = alias.aliasURI.escapeHTML()

                if (!alias.aliasURI) {
                    empty_alias_count++
                } else if (alias.aliasURI.indexOf('http') === 0) {
                    alias_uri_count++
                } else if (alias.aliasURI.indexOf('acct:') === 0 || alias.aliasURI.indexOf('nacc:') === 0) {
                    alias_account_count++
                }
            }
            $('#alias_account_count').html(alias_account_count).removeClass('loading_dots')
            $('#alias_uri_count').html(alias_uri_count).removeClass('loading_dots')
            $('#empty_alias_count').html(empty_alias_count).removeClass('loading_dots')
            $('#alias_count').html(alias_count).removeClass('loading_dots')
        }
    })
    sendRequest('getAliases+', {
        account: BRS.account,
        timestamp: 0,
        firstIndex: 0,
        lastIndex: BRS.alias_page_elements - 1
    }, function (response) {
        if (response.aliases && response.aliases.length) {
            const aliases = response.aliases

            if (BRS.unconfirmedTransactions.length) {
                for (let i = 0; i < BRS.unconfirmedTransactions.length; i++) {
                    const unconfirmedTransaction = BRS.unconfirmedTransactions[i]

                    if (unconfirmedTransaction.type === 1 && (unconfirmedTransaction.subtype === 1 || unconfirmedTransaction.subtype === 7)) {
                        let found = false

                        for (let j = 0; j < aliases.length; j++) {
                            if (aliases[j].aliasName === unconfirmedTransaction.attachment.alias) {
                                aliases[j].aliasURI = unconfirmedTransaction.attachment.uri
                                aliases[j].tentative = true
                                found = true
                                break
                            }
                        }

                        if (!found) {
                            aliases.push({
                                aliasName: unconfirmedTransaction.attachment.alias,
                                aliasURI: (unconfirmedTransaction.attachment.uri ? unconfirmedTransaction.attachment.uri : ''),
                                tentative: true
                            })
                        }
                    }
                }
            }

            aliases.sort(function (a, b) {
                const a_low = a.aliasName.toLowerCase()
                const b_low = b.aliasName.toLowerCase()
                if (a_low > b_low) {
                    return 1
                }
                if (a_low < b_low) {
                    return -1
                }

                return 0
            })

            let rows = ''

            // let alias_account_count = 0
            // let alias_uri_count = 0
            // let empty_alias_count = 0
            // const alias_count = aliases.length

            for (const alias of aliases) {
                alias.status = '/'

                const unconfirmedTransaction = getUnconfirmedTransactionsFromCache(1, 6, {
                    alias: alias.aliasName
                }, true)

                if (unconfirmedTransaction) {
                    alias.tentative = true
                    if (unconfirmedTransaction.recipient) {
                        alias.buyer = unconfirmedTransaction.recipient
                    }
                    alias.priceNQT = unconfirmedTransaction.priceNQT
                }

                if (!alias.aliasURI) {
                    alias.aliasURI = ''
                }

                if (alias.aliasURI.length > 100) {
                    alias.shortAliasURI = alias.aliasURI.substring(0, 100) + '...'
                    alias.shortAliasURI = alias.shortAliasURI.escapeHTML()
                } else {
                    alias.shortAliasURI = alias.aliasURI.escapeHTML()
                }

                alias.aliasURI = alias.aliasURI.escapeHTML()

                let allowCancel = false

                if ('priceNQT' in alias) {
                    if (alias.priceNQT === '0') {
                        if (alias.buyer === BRS.account) {
                            alias.status = $.t('cancelling_sale')
                        } else {
                            alias.status = $.t('transfer_in_progress')
                        }
                    } else {
                        if (!alias.tentative) {
                            allowCancel = true
                        }

                        if (typeof alias.buyer !== 'undefined') {
                            alias.status = $.t('for_sale_direct')
                        } else {
                            alias.status = $.t('for_sale_indirect')
                        }
                    }
                }

                if (alias.status !== '/') {
                    alias.status = "<span class='label label-small label-info'>" + alias.status + '</span>'
                }
                const aliasName = String(alias.aliasName).escapeHTML()
                rows += '<tr' + (alias.tentative ? " class='tentative'" : '') +
                                " data-alias='" + aliasName.toLowerCase() +
                                "'><td class='alias'>" + aliasName +
                                "</td><td class='uri'>" +
                                (alias.aliasURI.indexOf('http') === 0
                                    ? "<a href='" + alias.aliasURI + "' target='_blank'>" + alias.shortAliasURI + '</a>'
                                    : alias.shortAliasURI) +
                                "</td><td class='status'>" + alias.status +
                                "</td><td style='white-space:nowrap'><a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#register_alias_modal' data-alias='" +
                                aliasName + "'>" +
                                $.t('edit') +
                                "</a> <a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#transfer_alias_modal' data-alias='" +
                                aliasName + "'>" +
                                $.t('transfer') +
                                "</a> <a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#sell_alias_modal' data-alias='" +
                                aliasName + "'>" +
                                $.t('sell') +
                                '</a>' + (allowCancel ? " <a class='btn btn-xs btn-default cancel_alias_sale' href='#' data-toggle='modal' data-target='#cancel_alias_sale_modal' data-alias='" + aliasName + "'>" + $.t('cancel_sale') + '</a>' : '') +
                                '</td></tr>'

                // if (!alias.aliasURI) {
                //     empty_alias_count++
                // } else if (alias.aliasURI.indexOf('http') === 0) {
                //     alias_uri_count++
                // } else if (alias.aliasURI.indexOf('acct:') === 0 || alias.aliasURI.indexOf('nacc:') === 0) {
                //     alias_account_count++
                // }
            }

            $('#aliases_table tbody').empty().append(rows)
            dataLoadFinished($('#aliases_table'))
        } else {
            $('#aliases_table tbody').empty()
            dataLoadFinished($('#aliases_table'))

            $('#alias_account_count, #alias_uri_count, #empty_alias_count, #alias_count').html('0').removeClass('loading_dots')
        }

        pageLoaded()
    })
}

export function evAliasModalOnShowBsModal (e) {
    const $invoker = $(e.relatedTarget)

    const alias = String($invoker.data('alias'))

    $(this).find('input[name=aliasName]').val(alias.escapeHTML())
    $(this).find('.alias_name_display').html(alias.escapeHTML())
}

export function formsSellAlias (data) {
    let successMessage = ''
    let errorMessage = ''

    if (data.modal === 'cancel_alias_sale') {
        data.priceNXT = '0'
        data.recipient = BRS.accountRS
        successMessage = $.t('success_cancel_alias')
        errorMessage = $.t('error_cancel_alias')
    } else if (data.modal === 'transfer_alias') {
        data.priceNXT = '0'
        successMessage = $.t('success_transfer_alias')
        errorMessage = $.t('error_transfer_alias')
    } else {
        successMessage = $.t('success_sell_alias')
        errorMessage = $.t('error_sell_alias')
        if (data.sell_to_specific) {
            if (!data.recipient) {
                return {
                    error: $.t('error_not_specified', {
                        name: $.t('recipient').toLowerCase()
                    }).capitalize()
                }
            }
            delete data.sell_to_specific
        } else {
            // No recipient in this transaction type
            if (!data.priceNXT || data.priceNXT === '0') {
                return {
                    error: $.t('error_not_specified', {
                        name: $.t('price').toLowerCase()
                    }).capitalize()
                }
            }
            if (data.add_message && data.encrypt_message) {
                return {
                    error: $.t('error_recipient_no_public_key').capitalize()
                }
            }
            delete data.recipient
        }
    }

    delete data.modal

    return {
        data,
        successMessage,
        errorMessage
    }
}

export function formsSellAliasComplete (response, data) {
    if (response.alreadyProcessed) {
        return
    }

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

export function evSellAliasSellToSpecificClick (e) {
    const $form = $(this).closest('form')
    $form.find('.account_info').hide()
    $form.find('input[name=recipient]').val('')
    $form.find('input[name=converted_account_id]').val('')
}

export function evBuyAliasModalOnShowBsModal (e) {
    const $modal = $(this)

    const $invoker = $(e.relatedTarget)

    BRS.fetchingModalData = true

    const alias = String($invoker.data('alias'))

    sendRequest('getAlias', {
        aliasName: alias
    }, function (response) {
        BRS.fetchingModalData = false

        if (response.errorCode) {
            e.preventDefault()
            $.notify($.t('error_alias_not_found'), { type: 'danger' })
        } else {
            if (!('priceNQT' in response)) {
                e.preventDefault()
                $.notify($.t('error_alias_not_for_sale'), { type: 'danger' })
            } else if (typeof response.buyer !== 'undefined' && response.buyer !== BRS.account) {
                e.preventDefault()
                $.notify($.t('error_alias_sale_different_account'), { type: 'danger' })
            } else {
                $modal.find('input[name=aliasName]').val(alias.escapeHTML())
                $modal.find('.alias_name_display').html(alias.escapeHTML())
                $modal.find('input[name=amountNXT]').val(convertToNXT(response.priceNQT)).prop('readonly', true)
            }
        }
    }, false)
}

export function formsBuyAliasError () {
    $('#buy_alias_modal').find('input[name=priceNXT]').prop('readonly', false)
}

export function formsBuyAliasComplete (response, data) {
    if (response.alreadyProcessed) {
        return
    }

    if (BRS.currentPage !== 'aliases') {
        return
    }

    data.aliasName = String(data.aliasName).escapeHTML()
    data.aliasURI = ''

    $('#aliases_table tbody').prepend("<tr class='tentative' data-alias='" + data.aliasName.toLowerCase() + "'><td class='alias'>" + data.aliasName + "</td><td class='uri'>" + (data.aliasURI && data.aliasURI.indexOf('http') === 0 ? "<a href='" + data.aliasURI + "' target='_blank'>" + data.aliasURI + '</a>' : data.aliasURI) + "</td><td>/</td><td style='white-space:nowrap'><a class='btn btn-xs btn-default' href='#'>" + $.t('edit') + "</a> <a class='btn btn-xs btn-default' href='#'>" + $.t('transfer') + "</a> <a class='btn btn-xs btn-default' href='#'>" + $.t('sell') + '</a></td></tr>')

    if ($('#aliases_table').parent().hasClass('data-empty')) {
        $('#aliases_table').parent().removeClass('data-empty')
    }
}

export function evRegisterAliasModalOnShowBsModal (e) {
    const $invoker = $(e.relatedTarget)

    let alias = $invoker.data('alias')

    if (alias) {
        BRS.fetchingModalData = true

        alias = String(alias)

        sendRequest('getAlias', {
            aliasName: alias
        }, function (response) {
            BRS.fetchingModalData = false
            if (response.errorCode) {
                e.preventDefault()
                $.notify($.t('error_alias_not_found'), { type: 'danger' })
            } else {
                let aliasURI
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
        }, false)
    } else {
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
}

export function incomingAliases (transactions) {
    if (hasTransactionUpdates(transactions)) {
        reloadCurrentPage()
    }
}

export function formsSetAlias (data) {
    data.aliasURI = $.trim(data.aliasURI).toLowerCase()

    if (data.type === 'account') {
        if (!(/acct:(.*)@burst/.test(data.aliasURI)) && !(/nacc:(.*)/.test(data.aliasURI))) {
            if (BRS.rsRegEx.test(data.aliasURI.toUpperCase())) {
                const address = new NxtAddress(data.aliasURI)
                if (!address.isOk()) {
                    return {
                        error: $.t('error_invalid_account_id')
                    }
                } else {
                    data.aliasURI = 'acct:' + data.aliasURI + '@burst'
                }
            } else if (BRS.idRegEx.test(data.aliasURI)) {
                data.aliasURI = 'acct:' + data.aliasURI + '@burst'
            } else {
                return {
                    error: $.t('error_invalid_account_id')
                }
            }
        }
    }

    delete data.type

    return {
        data
    }
}

export function setAliasType (type, uri) {
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

export function formsSetAliasError (response, data) {
    if (response && response.errorCode && response.errorCode === 8) {
        const errorDescription = response.errorDescription.escapeHTML()

        sendRequest('getAlias', {
            aliasName: data.aliasName
        }, function (response) {
            let message

            if (!response.errorCode) {
                if ('priceNQT' in response) {
                    if (response.buyer === BRS.account) {
                        message = $.t('alias_sale_direct_offer', {
                            burst: formatAmount(response.priceNQT),
                            valueSuffix: BRS.valueSuffix
                        }) + " <a href='#' data-alias='" + String(response.aliasName).escapeHTML() + "' data-toggle='modal' data-target='#buy_alias_modal'>" + $.t('buy_it_q') + '</a>'
                    } else if (typeof response.buyer === 'undefined') {
                        message = $.t('alias_sale_indirect_offer', {
                            burst: formatAmount(response.priceNQT),
                            valueSuffix: BRS.valueSuffix
                        }) + " <a href='#' data-alias='" + String(response.aliasName).escapeHTML() + "' data-toggle='modal' data-target='#buy_alias_modal'>" + $.t('buy_it_q') + '</a>'
                    } else {
                        message = $.t('error_alias_sale_different_account')
                    }
                } else {
                    message = "<a href='#' data-user='" + getAccountFormatted(response, 'account') + "'>" + $.t('view_owner_info_q') + '</a>'
                }

                $('#register_alias_modal').find('.error_message').html(errorDescription + '. ' + message)
            }
        }, false)
    }
}

export function formsSetAliasComplete (response, data) {
    if (response.alreadyProcessed) {
        return
    }

    if (BRS.currentPage === 'aliases') {
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

            $.notify($.t('success_alias_update'), { type: 'success' })
        } else {
            const $rows = $table.find('tr')

            const rowToAdd = "<tr class='tentative' data-alias='" + data.aliasName.toLowerCase() + "'><td class='alias'>" + data.aliasName + "</td><td class='uri'>" + (data.aliasURI && data.aliasURI.indexOf('http') === 0 ? "<a href='" + data.aliasURI + "' target='_blank'>" + data.shortAliasURI + '</a>' : data.shortAliasURI) + "</td><td>/</td><td style='white-space:nowrap'><a class='btn btn-xs btn-default' href='#'>" + $.t('edit') + "</a> <a class='btn btn-xs btn-default' href='#'>" + $.t('transfer') + "</a> <a class='btn btn-xs btn-default' href='#'>" + $.t('sell') + '</a></td></tr>'

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

            $.notify($.t('success_alias_register'), { type: 'success' })
        }
    }
}

export function evAliasSearchSubmit (e) {
    e.preventDefault()

    if (BRS.fetchingModalData) {
        return
    }

    BRS.fetchingModalData = true

    const alias = $.trim($('#alias_search input[name=q]').val())

    sendRequest('getAlias', {
        aliasName: alias
    }, function (response, input) {
        if (response.errorCode) {
            $.notify($.t('error_alias_not_found') +
                    " <a href='#' data-toggle='modal' data-target='#register_alias_modal' data-prefill-alias='" +
                    String(alias).escapeHTML() + "'>" +
                    $.t('register_q') + '</a>', { type: 'danger' })
            BRS.fetchingModalData = false
            return
        }
        evAliasShowSearchResult(response)
    })
}

export function evAliasShowSearchResult (response) {
    $('#alias_info_table tbody').empty()
    $('#alias_info_modal_alias').html(String(response.aliasName).escapeHTML())
    const data = {
        account: getAccountTitle(response, 'account'),
        last_updated: formatTimestamp(response.timestamp),
        data_formatted_html: String(response.aliasURI)
    }
    if ('priceNQT' in response) {
        if (response.buyer === BRS.account) {
            $('#alias_sale_callout').html($.t('alias_sale_direct_offer', {
                burst: formatAmount(response.priceNQT),
                value_suffix: BRS.valueSuffix
            }) + " <a href='#' data-alias='" + String(response.aliasName).escapeHTML() + "' data-toggle='modal' data-target='#buy_alias_modal'>" + $.t('buy_it_q') + '</a>').show()
        } else if (typeof response.buyer === 'undefined') {
            $('#alias_sale_callout').html($.t('alias_sale_indirect_offer', {
                burst: formatAmount(response.priceNQT),
                value_suffix: BRS.valueSuffix
            }) + " <a href='#' data-alias='" + String(response.aliasName).escapeHTML() + "' data-toggle='modal' data-target='#buy_alias_modal'>" + $.t('buy_it_q') + '</a>').show()
        } else {
            $('#alias_sale_callout').html($.t('error_alias_sale_different_account')).show()
        }
    } else {
        $('#alias_sale_callout').hide()
    }
    $('#alias_info_table tbody').append(createInfoTable(data))
    $('#alias_info_modal').modal('show')
    BRS.fetchingModalData = false
}
