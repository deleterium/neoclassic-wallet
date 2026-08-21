import { BRS } from '..'

import { sendRequest } from '../core/send_request'

import { formatNQTAsAmount } from '../core/numbers'

import { createInfoTable, dataLoadFinished } from '../core/util'

import { getTransactionDetails } from '../tools/transactions'
import { GetBlockResponse, Transaction } from '../typings'
import { notify } from '../core/notifications'
import { showModal } from '../core/modals'

export async function showBlockInfoModal(block: string | GetBlockResponse) {
    if (BRS.fetchingModalData) {
        return
    }
    if (typeof block === 'object') {
        blockInfoDataReady(block)
        return
    }
    const blockDetails: GetBlockResponse = await sendRequest('getBlock+', {
        height: block,
        includeTransactions: 'true',
    })
    BRS.fetchingModalData = false
    if (blockDetails.errorCode) {
        notify($.t('invalid_blockheight'), { type: 'danger' })
        return
    }
    blockInfoDataReady(blockDetails)
    return
}

function blockInfoDataReady(block: GetBlockResponse) {
    $('#block_info_modal_block').text(block.height)
    const blockDetails = $.extend({}, block) as any
    delete blockDetails.transactions
    delete blockDetails.previousBlockHash
    delete blockDetails.nextBlockHash
    $('#block_info_details_table tbody').html(createInfoTable(blockDetails))
    ;(block.transactions as Transaction[]).sort(function (a: Transaction, b: Transaction) {
        return a.timestamp - b.timestamp
    })
    let rows = ''
    for (const transaction of block.transactions as Transaction[]) {
        const details = getTransactionDetails(transaction)
        const transactionId = transaction.transaction
        const shortId = transaction.transaction.slice(0, 7) + '…'
        rows += `
            <tr>
                <td>
                    <a href='#modal=transaction_info&transaction=${transactionId}'>${shortId}</a><br>
                    ${details.nameOfTransaction}
                </td>
                <td>${details.senderHTML}</td>
                <td>${details.recipientHTML}</td>
                <td ${details.colorClass}>${details.amountToFromViewerHTML}</td>
                <td>${formatNQTAsAmount(transaction.feeNQT)}</td>
            </tr>`
    }
    $('#block_info_transactions_table tbody').html(rows)
    $('#block_info_modal_transactions_tab').tab('show')
    dataLoadFinished($('#block_info_transactions_table'))

    showModal('block_info')
}
