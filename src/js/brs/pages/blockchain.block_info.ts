import { BRS } from '..'
import { GetBlockResponse, Transaction } from '../typings'
import { formatTimestampAsDateTime, formatNQTAsAmount } from '../core/numbers'
import { sendRequestA } from '../core/send_request'
import { getTransactionDetails } from '../tools/transactions'
import { dataLoaded } from '../core/util'

/**
 * Draws the page 'Blockchain' -> 'Blocks Info' with latest block available.
 * @param blockheight Block to show
 */
export function pagesBlockInfo() {
    blockInfoLoad('')
}

/**
 * Draws the page 'Blockchain' -> 'Blocks Info'
 * @param blockheight Block to show
 */
export async function blockInfoLoad(blockheight: number | '') {
    if (blockheight === '') {
        blockheight = BRS.blocks[0].height
    }

    const response: GetBlockResponse = await sendRequestA('getBlock+', {
        height: blockheight,
        includeTransactions: true,
    })

    if (response.errorCode) {
        $.notify($.t('invalid_blockheight'), { type: 'danger' })
        dataLoaded('')
        return
    }
    $('#block_info_input_block').val(blockheight)
    const rows = (response.transactions as Transaction[]).reduce(
        (prev, currTr) => prev + getTransactionInBlocksRowHTML(currTr as Transaction),
        '',
    )
    dataLoaded(rows)
}

function getTransactionInBlocksRowHTML(transaction: Transaction) {
    const details = getTransactionDetails(transaction)
    const transactionId = String(transaction.transaction).escapeHTML()
    const hasMessage = details.hasMessage ? "<i class='far fa-envelope-open'></i>&nbsp;" : ''
    const timestamp = formatTimestampAsDateTime(transaction.timestamp)
    const fee = formatNQTAsAmount(transaction.feeNQT)

    return `
        <tr>
          <td><a href='#' data-transaction='${transactionId}'>${transactionId}</a></td>
          <td>${hasMessage}</td>
          <td>${timestamp}</td>
          <td>${details.nameOfTransaction}</td>
          <td>${details.senderHTML}</td>
          <td>${details.recipientHTML}</td>
          <td>${details.circleText}</td>
          <td ${details.colorClass}>${details.amountToFromViewerHTML}</td>
          <td>${fee}</td>
        </tr>`
}
