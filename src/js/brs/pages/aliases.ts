import { BRS } from '..'
import { Alias, GetAliasesResponse, GetAliasResponse } from '../typings'
import { goToPage, pageLoaded, reloadCurrentPage } from '../core/navigation'
import { sendRequest } from '../core/send_request'
import { dataLoadFinished } from '../core/util'
import { findTLDNameByTLDId } from '../tools/aliases'

// Current page is 'aliases'
// Processing unconfirmed!.

export async function pagesAliases() {
    const response: GetAliasesResponse = await sendRequest('getAliases+', {
        account: BRS.account,
        timestamp: 0,
        firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
        lastIndex: BRS.pageSize * BRS.pageNumber,
    })

    let rows = ''
    if (BRS.pageNumber === 1 && BRS.myTlds.length > 0) {
        for (const tld of BRS.myTlds) {
            rows += `
            <tr>
              <td class='alias'></td>
              <td><a href="#" data-show-alias="${tld.alias}">${tld.aliasName}</a></td>
              <td class='uri'></td>
              <td class='status'></td>
              <td style="white-space:nowrap">
                <a href="#"
                  class="btn btn-xs btn-default"
                  data-toggle="modal"
                  data-target="#transfer_alias_modal"
                  data-alias="${tld.alias}"
                  data-alias-name=""
                  data-tld="${tld.aliasName}">
                  ${$.t('transfer')}
                </a>
                <a href="#"
                  class="btn btn-xs btn-default"
                  data-toggle="modal"
                  data-target="#sell_alias_modal"
                  data-alias="${tld.alias}"
                  data-alias-name=""
                  data-tld="${tld.aliasName}">
                  ${$.t('sell')}
                </a>
                <a href="#"
                  class="btn btn-xs btn-default cancel_alias_sale"
                  data-toggle="modal"
                  data-target="#cancel_alias_sale_modal"
                  data-alias="${tld.alias}"
                  data-alias-name=""
                  data-tld="${tld.aliasName}">
                  ${$.t('cancel_sale')}
                </a>
              </td>
            </tr>`
        }
    }

    if (response.errorCode) {
        $('#aliases_table tbody').empty().append(rows)
        dataLoadFinished($('#aliases_table'))
        $('#alias_account_count, #alias_uri_count, #empty_alias_count, #alias_count').html('0').removeClass('loading_dots')
        pageLoaded()
        return
    }
    if (response.aliases.length > BRS.pageSize) {
        BRS.hasMorePages = true
        response.aliases.pop()
    }
    const aliases = response.aliases

    for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
        if (unconfirmedTransaction.type !== 1) continue
        if (unconfirmedTransaction.subtype === 1 || unconfirmedTransaction.subtype === 7 || unconfirmedTransaction.subtype === 8) {
            // 1: setAlias, 7: buyAlias, 8: setTLD
            let found = false
            for (const alias of aliases) {
                if (alias.aliasName === unconfirmedTransaction.attachment.alias) {
                    alias.aliasURI = unconfirmedTransaction.attachment.uri
                    alias.timestamp = -1
                    found = true
                    break
                }
            }
            if (!found) {
                const newAlias: Alias = {
                    account: unconfirmedTransaction.sender,
                    accountRS: unconfirmedTransaction.senderRS,
                    aliasName: unconfirmedTransaction.attachment.alias ?? '', // setTLD has no alias name
                    timestamp: -1,
                    alias: unconfirmedTransaction.transaction,
                    aliasURI: unconfirmedTransaction.attachment.uri ?? '',
                    tld: unconfirmedTransaction.attachment.tld,
                    tldName: findTLDNameByTLDId(unconfirmedTransaction.attachment.tld),
                }
                if ('priceNQT' in unconfirmedTransaction.attachment) {
                    newAlias['priceNQT'] = unconfirmedTransaction.attachment.priceNQT
                }
                if ('buyer' in unconfirmedTransaction.attachment) {
                    newAlias['buyer'] = unconfirmedTransaction.attachment.buyer
                }
                aliases.push(newAlias)
            }
        }
        if (unconfirmedTransaction.subtype === 6) {
            // 6: sellAlias
            let found = false
            for (const alias of aliases) {
                if (alias.alias === unconfirmedTransaction.attachment.alias) {
                    if (unconfirmedTransaction.recipient) {
                        alias['buyer'] = unconfirmedTransaction.recipient
                    }
                    alias['priceNQT'] = unconfirmedTransaction.attachment.priceNQT
                    alias.timestamp = -1
                    found = true
                    break
                }
            }
            if (!found) {
                const incomingAlias: GetAliasResponse = await sendRequest('getAlias', { alias: unconfirmedTransaction.attachment.alias })
                const newAlias: Alias = {
                    account: unconfirmedTransaction.sender,
                    accountRS: unconfirmedTransaction.senderRS,
                    aliasName: incomingAlias.errorCode ? '?' : incomingAlias.aliasName,
                    timestamp: -1,
                    alias: unconfirmedTransaction.attachment.alias,
                    aliasURI: incomingAlias.errorCode ? '?' : incomingAlias.aliasURI || '',
                    tld: incomingAlias.errorCode ? '' : incomingAlias.tld,
                    tldName: incomingAlias.errorCode ? '?' : findTLDNameByTLDId(incomingAlias.tld),
                }
                if ('priceNQT' in unconfirmedTransaction.attachment) {
                    newAlias['priceNQT'] = unconfirmedTransaction.attachment.priceNQT
                }
                if (unconfirmedTransaction.recipient) {
                    newAlias['buyer'] = unconfirmedTransaction.recipient
                }
                aliases.push(newAlias)
            }
        }
    }

    for (const alias of aliases) {
        let status = '/'
        let tentative = false

        if (alias.timestamp === -1) {
            tentative = true
        }

        if (!alias.aliasURI) {
            alias.aliasURI = ''
        }
        let shortAliasURI = alias.aliasURI
        if (alias.aliasURI.length > 100) {
            shortAliasURI = alias.aliasURI.substring(0, 98) + '...'
        }

        let allowCancel = false

        if ('priceNQT' in alias) {
            if (alias.priceNQT === '0') {
                if (alias.buyer === BRS.account) status = $.t('cancelling_sale')
                else status = $.t('transfer_in_progress')
            } else {
                if (!tentative) allowCancel = true
                if (typeof alias.buyer !== 'undefined') status = $.t('for_sale_direct')
                else status = $.t('for_sale_indirect')
            }
        }

        if (status !== '/') {
            status = "<span class='label label-small label-info'>" + status + '</span>'
        }

        const tentativeClass = tentative ? " class='tentative'" : ''
        const editButton = `
            <a href="#"
              class="btn btn-xs btn-default"
              data-toggle="modal"
              data-target="#register_alias_modal"
              data-alias="${alias.alias}"
              data-alias-name="${alias.aliasName}"
              data-tld="${alias.tldName}">
              ${$.t('edit')}
            </a>`
        const transferButton = `
            <a href="#"
              class="btn btn-xs btn-default"
              data-toggle="modal"
              data-target="#transfer_alias_modal"
              data-alias="${alias.alias}"
              data-alias-name="${alias.aliasName}"
              data-tld="${alias.tldName}">
              ${$.t('transfer')}
            </a>`
        const sellButton = `
            <a href="#"
              class="btn btn-xs btn-default"
              data-toggle="modal"
              data-target="#sell_alias_modal"
              data-alias="${alias.alias}"
              data-alias-name="${alias.aliasName}"
              data-tld="${alias.tldName}">
              ${$.t('sell')}
            </a>`
        let cancelSaleButton = ''
        if (allowCancel) {
            cancelSaleButton = `
                <a href="#"
                  class="btn btn-xs btn-default cancel_alias_sale"
                  data-toggle="modal"
                  data-target="#cancel_alias_sale_modal"
                  data-alias="${alias.alias}"
                  data-alias-name="${alias.aliasName}"
                  data-tld="${alias.tldName}">
                  ${$.t('cancel_sale')}
                </a>`
        }

        rows += `
            <tr ${tentativeClass}>
              <td class='alias'>
                <a href="#" data-show-alias="${alias.alias}">${alias.aliasName}</a>
              </td>
              <td>${alias.tldName}</td>
              <td class='uri'>
                ${alias.aliasURI.indexOf('http') === 0 ? `<a href="${alias.aliasURI}" target="_blank">${shortAliasURI}</a>` : shortAliasURI}
              </td>
              <td class='status'>
                ${status}
              </td>
              <td style="white-space:nowrap">
                ${tentative ? BRS.pendingTransactionHTML : editButton}
                ${tentative ? '' : transferButton}
                ${tentative ? '' : sellButton}
                ${tentative ? '' : cancelSaleButton}
              </td>
            </tr>`
    }

    $('#aliases_table tbody').empty().append(rows)
    dataLoadFinished($('#aliases_table'))
    if (BRS.pageNumber === 1) {
        let count = (response.aliases.length + BRS.myTlds.length).toString()
        if (BRS.hasMorePages) {
            count += '+'
        }
        $('#alias_count').text(count).removeClass('loading_dots')
    }
    pageLoaded()
}

export function incomingAliases() {
    if (BRS.checkIncoming.newTransactions || BRS.checkIncoming.unconfirmedChanged) {
        reloadCurrentPage()
    }
}

export function evAliasSearchSubmit(e: JQuery.SubmitEvent) {
    e.preventDefault()
    const alias = $('#alias_search input[name=q]').val()
    $('#search_box input').val('alias:' + alias)
    // Execute the search via "search pages"
    goToPage('search_results')
}
