/**
 * @depends {brs.js}
 * @depends {brs.modals.js}
 */

import { BRS } from '.'

import { sendRequest } from './brs.sendRequest'

import { formatNQTAsAmount } from './brs.numbers'

import {
    createInfoTable
} from './brs.util'

import { getTransactionDetails } from './brs.tx.tools'
import { GetBlockResponse, Transaction } from '../typings'

export function evBlocksTableClick (event: Event) {
    event.preventDefault()
    if (BRS.fetchingModalData) {
        return
    }
    BRS.fetchingModalData = true
    const blockHeight = $(event.target as HTMLElement).data('block')
    sendRequest('getBlock+', {
        height: blockHeight,
        includeTransactions: 'true'
    }, function (response: GetBlockResponse) {
        showBlockModal(response)
    })
}

export function showBlockModal (block: GetBlockResponse) {
    $('#block_info_modal_block').text(block.block)
    const blockDetails = $.extend({}, block) as any
    delete blockDetails.transactions
    delete blockDetails.previousBlockHash
    delete blockDetails.nextBlockHash
    delete blockDetails.block
    $('#block_info_details_table tbody').empty().append(createInfoTable(blockDetails))
    $('#block_info_details_table').show()
    if (block.transactions.length === 0) {
        $('#block_info_transactions_none').show()
        $('#block_info_transactions_table').hide()
        $('#block_info_modal').modal('show')
        BRS.fetchingModalData = false
        return
    }
    $('#block_info_transactions_none').hide()
    $('#block_info_transactions_table').show();
    (block.transactions as Transaction[]).sort(function (a: Transaction, b: Transaction) {
        return a.timestamp - b.timestamp
    })
    let rows = ''
    for (const transaction of block.transactions as Transaction[]) {
        const details = getTransactionDetails(transaction)
        const transactionId = String(transaction.transaction).escapeHTML()
        const shortId = String(transaction.transaction.slice(0, 7) + '…').escapeHTML()
        rows += `
            <tr>
                <td>
                    <a href='#' data-transaction='${transactionId}'>${shortId}</a><br>
                    ${details.nameOfTransaction}
                </td>
                <td>${details.senderHTML}</td>
                <td>${details.recipientHTML}</td>
                <td ${details.colorClass}>${details.amountToFromViewerHTML}</td>
                <td>${formatNQTAsAmount(transaction.feeNQT)}</td>
            </tr>`
    }
    $('#block_info_transactions_table tbody').html(rows)
    $('#block_info_modal').modal('show')
    BRS.fetchingModalData = false
}
