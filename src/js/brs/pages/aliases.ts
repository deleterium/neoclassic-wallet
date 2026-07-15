import { BRS } from '..'
import { GetAliasesResponse } from '../typings'
import { goToPage, pageLoaded, reloadCurrentPage } from '../core/navigation'
import { sendRequest } from '../core/send_request'
import { getUnconfirmedTransactionsFromCache, dataLoadFinished } from '../core/util'

// Current page is 'aliases'
// Do not process unconfirmed.

export async function pagesAliases() {
    const response: GetAliasesResponse = await sendRequest('getAliases+', {
        account: BRS.account,
        timestamp: 0,
        firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
        lastIndex: BRS.pageSize * BRS.pageNumber,
    })

    if (!response.aliases || !response.aliases.length) {
        $('#aliases_table tbody').empty()
        dataLoadFinished($('#aliases_table'))
        $('#alias_account_count, #alias_uri_count, #empty_alias_count, #alias_count').html('0').removeClass('loading_dots')
        pageLoaded()
        return
    }
    if (response.aliases.length > BRS.pageSize) {
        BRS.hasMorePages = true
        response.aliases.pop()
    }

    // TODO Add support for unconfirmed!!!
    // if (BRS.unconfirmedTransactions.length) {
    //     for (let i = 0; i < BRS.unconfirmedTransactions.length; i++) {
    //         const unconfirmedTransaction = BRS.unconfirmedTransactions[i];

    //         if (unconfirmedTransaction.type === 1 && (unconfirmedTransaction.subtype === 1 || unconfirmedTransaction.subtype === 7)) {
    //             let found = false;

    //             for (let j = 0; j < aliases.length; j++) {
    //                 if (aliases[j].aliasName === unconfirmedTransaction.attachment.alias) {
    //                     aliases[j].aliasURI = unconfirmedTransaction.attachment.uri;
    //                     aliases[j].tentative = true;
    //                     found = true;
    //                     break;
    //                 }
    //             }

    //             if (!found) {
    //                 aliases.push({
    //                     aliasName: unconfirmedTransaction.attachment.alias,
    //                     aliasURI: (unconfirmedTransaction.attachment.uri ? unconfirmedTransaction.attachment.uri : ''),
    //                     tentative: true
    //                 });
    //             }
    //         }
    //     }
    // }

    let rows = ''
    for (const alias of response.aliases) {
        let status = '/'
        let tentative = false
        let shortAliasURI = ''

        const unconfirmedTransaction = getUnconfirmedTransactionsFromCache(1, 6, {
            alias: alias.aliasName,
        })

        if (unconfirmedTransaction) {
            tentative = true
            if (unconfirmedTransaction[0].recipient) {
                alias.buyer = unconfirmedTransaction[0].recipient
            }
            alias.priceNQT = unconfirmedTransaction[0].attachment?.priceNQT
        }

        if (!alias.aliasURI) {
            alias.aliasURI = ''
        }

        if (alias.aliasURI.length > 100) {
            shortAliasURI = alias.aliasURI.substring(0, 98) + '...'
            shortAliasURI = shortAliasURI
        } else {
            shortAliasURI = alias.aliasURI
        }

        alias.aliasURI = alias.aliasURI

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

        const aliasName = alias.aliasName
        const tentativeClass = tentative ? " class='tentative'" : ''
        const editButton = `
            <a href="#"
              class="btn btn-xs btn-default"
              data-toggle="modal"
              data-target="#register_alias_modal"
              data-alias="${aliasName}">
              ${$.t('edit')}
            </a>`
        const transferButton = `
            <a href="#"
              class="btn btn-xs btn-default"
              data-toggle="modal"
              data-target="#transfer_alias_modal"
              data-alias="${aliasName}">
              ${$.t('transfer')}
            </a>`
        const sellButton = `
            <a href="#"
              class="btn btn-xs btn-default"
              data-toggle="modal"
              data-target="#sell_alias_modal"
              data-alias="${aliasName}">
              ${$.t('sell')}
            </a>`
        let cancelSaleButton = ''
        if (allowCancel) {
            cancelSaleButton = `
                <a href="#"
                  class="btn btn-xs btn-default cancel_alias_sale"
                  data-toggle="modal"
                  data-target="#cancel_alias_sale_modal"
                  data-alias="${aliasName}">
                  ${$.t('cancel_sale')}
                </a>`
        }

        rows += `
            <tr ${tentativeClass} data-alias="${aliasName.toLowerCase()}">
              <td class='alias'>
                <a href="#" data-alias="${alias.alias}">${aliasName}</a>
              </td>
              <td>${alias.tldName}</td>
              <td class='uri'>
                ${alias.aliasURI.indexOf('http') === 0 ? `<a href="${alias.aliasURI}" target="_blank">${shortAliasURI}</a>` : shortAliasURI}
              </td>
              <td class='status'>
                ${status}
              </td>
              <td style="white-space:nowrap">
                ${editButton}
                ${transferButton}
                ${sellButton}
                ${cancelSaleButton}
              </td>
            </tr>`
    }

    $('#aliases_table tbody').empty().append(rows)
    dataLoadFinished($('#aliases_table'))
    if (BRS.pageNumber === 1) {
        let count = response.aliases.length.toString()
        if (BRS.hasMorePages) {
            count += '+'
        }
        $('#alias_count').text(count).removeClass('loading_dots')
    }
    pageLoaded()
}

export function incomingAliases() {
    if (BRS.checkIncoming.newTransactions) {
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
