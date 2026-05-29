/**
 * @depends {brs.js}
 */

import { BRS } from '.'

import {
    sendRequest
} from './brs.server'

import { formatNQTAsAmount } from './brs.numbers'

import {
    dataLoaded,
    getAccountTitle
} from './brs.util'

import { GetAccountEscrowTransactionsResponse } from '../typings'

export function pagesEscrow () {
    sendRequest('getAccountEscrowTransactions', {
        account: BRS.account
    }, function (response: GetAccountEscrowTransactionsResponse) {
        if (!response.escrows || response.escrows.length === 0 ) {
            dataLoaded()
            return
        }
        let rows = ''
        for (const escrow of response.escrows) {
            rows += `
                <tr>
                  <td><a href='#' data-escrow='${escrow.id.escapeHTML()}'>${escrow.id.escapeHTML()}</a></td>
                  <td>${getAccountTitle(escrow, 'sender')}</td>
                  <td>${getAccountTitle(escrow, 'recipient')}</td>
                  <td>`
            for (let i=0; i< escrow.signers.length; i++) {
                if (i !== 0) rows += '<br>'
                rows += getAccountTitle(escrow.signers[i], 'id')
            }
            rows += `
                  </td>
                  <td>${formatNQTAsAmount(escrow.amountNQT)}</td>
                </tr>`
        }
        dataLoaded(rows)
    })
}
