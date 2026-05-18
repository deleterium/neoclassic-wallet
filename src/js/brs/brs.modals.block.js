/**
 * @depends {brs.js}
 * @depends {brs.modals.js}
 */

import { BRS } from '.'

import { sendRequest } from './brs.server'

import { formatNQTAsAmount } from './brs.numbers'

import {
    createInfoTable
} from './brs.util'

import { getTransactionDetails } from './brs.transactions'

export function evBlocksTableClick (event) {
    event.preventDefault()
    if (BRS.fetchingModalData) {
        return
    }
    BRS.fetchingModalData = true
    const blockHeight = $(this).data('block')
    sendRequest('getBlock+', {
        height: blockHeight,
        includeTransactions: 'true'
    }, function (response) {
        showBlockModal(response)
    })
}

export function showBlockModal (block) {
    $('#block_info_modal_block').html(String(block.block).escapeHTML())
    const blockDetails = $.extend({}, block)
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
    $('#block_info_transactions_table').show()
    block.transactions.sort(function (a, b) {
        return a.timestamp - b.timestamp
    })
    let rows = ''
    for (const transaction of block.transactions) {
        const details = getTransactionDetails(transaction)
        rows += '<tr>'

        rows += "<td><a href='#' data-transaction='" + String(transaction.transaction).escapeHTML() + "'>" + String(transaction.transaction.slice(0, 7) + '…').escapeHTML() + '</a><br>'
        rows += details.nameOfTransaction + '</td>'
        rows += '<td>' + details.senderHTML + '</td>'
        rows += '<td>' + details.recipientHTML + '</td>'
        rows += `<td ${details.colorClass}>${details.amountToFromViewerHTML}</td>`
        rows += '<td>' + formatNQTAsAmount(transaction.feeNQT) + '</td>'
        rows += '</tr>'
    }
    $('#block_info_transactions_table tbody').empty().append(rows)
    $('#block_info_modal').modal('show')
    BRS.fetchingModalData = false
}
