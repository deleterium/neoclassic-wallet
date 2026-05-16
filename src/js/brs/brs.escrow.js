/**
 * @depends {brs.js}
 */

import { BRS } from '.'

import {
    sendRequest
} from './brs.server'

import { formatAmount } from './brs.numbers'

import {
    dataLoaded
} from './brs.util'

export function pagesEscrow () {
    sendRequest('getAccountEscrowTransactions', {
        account: BRS.account
    }, function (response) {
        let rows = ''
        if (response.escrows && response.escrows.length) {
            for (const escrow of response.escrows) {
                rows += '<tr>'
                rows += `<td><a href='#' data-escrow='${escrow.id}'>${escrow.id}</a></td>`
                rows += `<td>${escrow.senderRS}</td>`
                rows += `<td>${escrow.recipientRS}</td>`
                rows += `<td>${formatAmount(escrow.amountNQT)}</td>`
                rows += '</tr>'
            }
        }
        dataLoaded(rows)
    })
}
