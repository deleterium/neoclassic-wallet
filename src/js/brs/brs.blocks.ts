import { BRS } from '.'

import {
    reloadCurrentPage,
} from './brs'

import {
    sendRequest
} from './brs.server'

import {
    formatVolume,
    parseAmountToNQT,
    formatNQTAsAmount,
    formatTimestampAsDateTime,
    formatNumber
} from './brs.numbers'

import {
    getAccountTitle,
    getAccountFormatted,
    dataLoaded,
    formatStyledAmount
} from './brs.util'

import {
    getTransactionDetails
} from './brs.tx.tools'

import { BlockDetails, GetAccountBlocksResponse, GetBlockResponse, GetBlocksResponse, Transaction } from '../typings'

/**
 * Draws the page 'Mining' -> 'Forged block'.
 */
export function pagesBlocksForged () {
    sendRequest('getAccountBlocks+', {
        account: BRS.account,
        firstIndex: 0,
        lastIndex: BRS.pageSize,
        timestamp: 0
    }, function (response: GetAccountBlocksResponse) {
        if (!response.blocks || response.blocks.length === 0) {
            blocksPageLoaded([])
            return
        }
        // We have blocks!
        blocksPageLoaded(response.blocks)
    })
}

/**
 * Draws the page 'Blockchain' -> 'Blocks Info' with latest block available.
 * @param blockheight Block to show
 */
export function pagesBlockInfo () {
    blocksInfoLoad('')
}

/**
 * Draws the page 'Blockchain' -> 'Blocks Info'
 * @param blockheight Block to show
 */
export function blocksInfoLoad (blockheight: number | '') {
    if (blockheight === '') {
        blockheight = BRS.blocks[0].height
    }

    sendRequest('getBlock+', {
        height: blockheight,
        includeTransactions: true
    }, function (response: GetBlockResponse) {
        if (response.errorCode) {
            $.notify($.t('invalid_blockheight'), { type: 'danger' })
            dataLoaded('')
            return
        }
        $('#block_info_input_block').val(blockheight)
        const rows = response.transactions.reduce((prev, currTr) => prev + getTransactionInBlocksRowHTML(currTr as Transaction), '')
        dataLoaded(rows)
    })
}

function getTransactionInBlocksRowHTML (transaction: Transaction) {
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

/**
 * Draws the page 'Blockchain' -> 'Latest blocks'
 * @param blockheight Block to show
 */
export function pagesBlocks () {
    sendRequest('getBlocks', {
        firstIndex: 0,
        lastIndex: BRS.pageSize
    }, function (response: GetBlocksResponse) {
        if (response.errorCode) {
            blocksPageLoaded([])
            return
        }
        blocksPageLoaded(response.blocks)
    })
}

export function incomingBlocks () {
    reloadCurrentPage()
}

/**
 * Draws the page 'Blockchain' -> 'Latest blocks' or the page 'Mining' -> 'Forged blocks'
 * @param blockheight Blocks to show in current page.
 */
function blocksPageLoaded (blocks: BlockDetails[]) {
    let rows = ''
    let totalAmount = 0n
    let totalFees = 0n
    let totalTransactions = 0
    let time: number
    let endingTime: number
    let startingTime: number

    for (const block of blocks) {
        // Update totals
        totalAmount += BigInt(block.totalAmountNQT)
        totalFees += BigInt(block.totalFeeNQT)
        totalTransactions += block.numberOfTransactions

        // Format values for display
        const height = String(block.height).escapeHTML()
        const blockId = String(block.block).escapeHTML()
        const isBold = block.numberOfTransactions > 0 ? " style='font-weight:bold'" : ''
        const timestamp = formatTimestampAsDateTime(block.timestamp)
        const amount = formatNQTAsAmount(block.totalAmountNQT)
        const fee = formatNQTAsAmount(block.totalFeeNQT)
        const transactions = formatNumber(block.numberOfTransactions)
        const generatorDisplay = block.generator !== BRS.genesis
            ? `<a href='#' data-user='${getAccountFormatted(block, 'generator')}' class='user_info'>${getAccountTitle(block, 'generator')}</a>`
            : $.t('genesis')
        const volume = formatVolume(block.payloadLength)
        const percentage = Math.round(Number(block.baseTarget) / 153722867 * 100).toString().padStart(4, '0') + ' %'

        // Build row
        rows += `
            <tr>
                <td><a href='#' data-block='${height}' data-blockid='${blockId}' class='block'${isBold}>${height}</a></td>
                <td>${timestamp}</td>
                <td>${amount}</td>
                <td>${fee}</td>
                <td>${transactions}</td>
                <td>${generatorDisplay}</td>
                <td>${volume}</td>
                <td>${percentage}</td>
            </tr>`
    }

    if (blocks.length) {
        startingTime = blocks[blocks.length - 1].timestamp
        endingTime = blocks[0].timestamp
        time = endingTime - startingTime
    } else {
        startingTime = endingTime = time = 0
    }
    let averageFee: string
    let averageAmount: string
    let blockCount: string
    if (blocks.length) {
        averageFee = formatNQTAsAmount(totalFees / BigInt(blocks.length))
        averageAmount = formatNQTAsAmount(totalAmount / BigInt(blocks.length))
    } else {
        averageFee = '0'
        averageAmount = '0'
    }

    averageFee = parseAmountToNQT(averageFee)
    averageAmount = parseAmountToNQT(averageAmount)

    if (BRS.currentPage === 'blocks_forged') {
        if (blocks.length >= BRS.pageSize) {
            blockCount = BRS.pageSize + '+'
        } else {
            blockCount = blocks.length.toString()
        }
        $('#blocks_forged_average_fee').html(formatStyledAmount(averageFee)).removeClass('loading_dots')
        $('#blocks_forged_average_amount').html(formatStyledAmount(averageAmount)).removeClass('loading_dots')
        $('#forged_blocks_total').html(blockCount).removeClass('loading_dots')
        $('#forged_fees_total').html(formatStyledAmount(BRS.accountInfo.forgedBalanceNQT)).removeClass('loading_dots')
    } else {
        if (time === 0) {
            $('#blocks_transactions_per_hour').html('0').removeClass('loading_dots')
        } else {
            $('#blocks_transactions_per_hour').html((Math.round(totalTransactions / (time / 60) * 60)).toString()).removeClass('loading_dots')
        }
        $('#blocks_average_fee').html(formatStyledAmount(averageFee)).removeClass('loading_dots')
        $('#blocks_average_amount').html(formatStyledAmount(averageAmount)).removeClass('loading_dots')
        $('#blocks_average_generation_time').html(Math.round(time / 100) + 's').removeClass('loading_dots')
    }

    dataLoaded(rows)
}
