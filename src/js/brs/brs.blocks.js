/**
 * @depends {brs.js}
 */

/* global BigInteger */

import { BRS } from '.'

import {
    setStateInterval,
    reloadCurrentPage,
    updateBlockchainDownloadProgress,
    checkIfOnAFork
} from './brs'

import {
    sendRequest
} from './brs.server'

import {
    formatVolume,
    convertToNQT,
    formatAmount,
    formatTimestamp,
    getAccountTitle,
    getAccountFormatted,
    dataLoaded,
    dataLoadFinished,
    formatStyledAmount
} from './brs.util'

import {
    getTransactionDetails
} from './brs.transactions'

export function getBlock (blockID, callback, pageRequest) {
    sendRequest('getBlock' + (pageRequest ? '+' : ''), {
        block: blockID
    }, function (response) {
        if (response.errorCode && response.errorCode === -1) {
            getBlock(blockID, callback, pageRequest)
        } else {
            if (callback) {
                response.block = blockID
                callback(response)
            }
        }
    }, true)
}

export function handleInitialBlocks (response) {
    if (response.errorCode) {
        dataLoadFinished($('#dashboard_blocks_table'))
        return
    }

    BRS.blocks.push(response)

    if (BRS.blocks.length < 10 && response.previousBlock) {
        getBlock(response.previousBlock, handleInitialBlocks)
    } else {
        checkBlockHeight(BRS.blocks[0].height)

        if (BRS.state) {
            // if no new blocks in 6 hours, show blockchain download progress..
            const timeDiff = BRS.state.time - BRS.blocks[0].timestamp
            if (timeDiff > 60 * 60 * 18) {
                if (timeDiff > 60 * 60 * 24 * 14) {
                    setStateInterval(30)
                } else if (timeDiff > 60 * 60 * 24 * 7) {
                    // second to last week
                    setStateInterval(15)
                } else {
                    // last week
                    setStateInterval(10)
                }
                BRS.downloadingBlockchain = true
                $('#downloading_blockchain').show()
                updateBlockchainDownloadProgress()
            } else {
                // continue with faster state intervals if we still haven't reached current block from within 1 hour
                if (timeDiff < 60 * 60) {
                    setStateInterval(30)
                    BRS.trackBlockchain = false
                } else {
                    setStateInterval(10)
                    BRS.trackBlockchain = true
                }
            }
        }

        let rows = ''

        for (let i = 0; i < BRS.blocks.length; i++) {
            const block = BRS.blocks[i]

            rows += "<tr><td><a href='#' data-block='" + String(block.height).escapeHTML() + "' data-blockid='" + String(block.block).escapeHTML() + "' class='block'" + (block.numberOfTransactions > 0 ? " style='font-weight:bold'" : '') + '>' + String(block.height).escapeHTML() + "</a></td><td data-timestamp='" + String(block.timestamp).escapeHTML() + "'>" + formatTimestamp(block.timestamp) + '</td><td>' + formatAmount(block.totalAmountNQT) + ' + ' + formatAmount(block.totalFeeNQT) + '</td><td>' + formatAmount(block.numberOfTransactions) + '</td></tr>'
        }

        $('#dashboard_blocks_table tbody').empty().append(rows)
        dataLoadFinished($('#dashboard_blocks_table'))
    }
}

export function handleNewBlocks (response) {
    if (BRS.downloadingBlockchain) {
        // new round started...
        if (BRS.tempBlocks.length === 0 && BRS.state.lastBlock !== response.block) {
            return
        }
    }

    // we have all blocks
    if (response.height - 1 === BRS.lastBlockHeight || BRS.tempBlocks.length === 99) {
        let newBlocks = []

        // there was only 1 new block (response)
        if (BRS.tempBlocks.length === 0) {
            // remove oldest block, add newest block
            BRS.blocks.unshift(response)
            newBlocks.push(response)
        } else {
            BRS.tempBlocks.push(response);
            // remove oldest blocks, add newest blocks
            [].unshift.apply(BRS.blocks, BRS.tempBlocks)
            newBlocks = BRS.tempBlocks
            BRS.tempBlocks = []
        }

        if (BRS.blocks.length > 100) {
            BRS.blocks = BRS.blocks.slice(0, 100)
        }

        checkBlockHeight(BRS.blocks[0].height)

        BRS.incoming.updateDashboardBlocks(newBlocks)
    } else {
        BRS.tempBlocks.push(response)
        getBlock(response.previousBlock, handleNewBlocks)
    }
}

export function checkBlockHeight (blockHeight) {
    if (blockHeight) {
        BRS.lastBlockHeight = blockHeight
    }

    // no checks needed at the moment
}

// we always update the dashboard page..
export function incomingUpdateDashboardBlocks (newBlocks) {
    let newBlockCount = newBlocks.length

    if (newBlockCount > 10) {
        newBlocks = newBlocks.slice(0, 10)
        newBlockCount = newBlocks.length
    }
    let timeDiff
    if (BRS.downloadingBlockchain) {
        if (BRS.state) {
            timeDiff = BRS.state.time - BRS.blocks[0].timestamp
            if (timeDiff < 60 * 60 * 18) {
                if (timeDiff < 60 * 60) {
                    setStateInterval(30)
                } else {
                    setStateInterval(10)
                    BRS.trackBlockchain = true
                }
                BRS.downloadingBlockchain = false
                $('#dashboard_message').hide()
                $('#downloading_blockchain').hide()
                $.notify($.t('success_blockchain_up_to_date'), { type: 'success' })
                checkIfOnAFork()
            } else {
                if (timeDiff > 60 * 60 * 24 * 14) {
                    setStateInterval(30)
                } else if (timeDiff > 60 * 60 * 24 * 7) {
                    // second to last week
                    setStateInterval(15)
                } else {
                    // last week
                    setStateInterval(10)
                }

                updateBlockchainDownloadProgress()
            }
        }
    } else if (BRS.trackBlockchain) {
        timeDiff = BRS.state.time - BRS.blocks[0].timestamp

        // continue with faster state intervals if we still haven't reached current block from within 1 hour
        if (timeDiff < 60 * 60) {
            setStateInterval(30)
            BRS.trackBlockchain = false
        } else {
            setStateInterval(10)
        }
    }

    let rows = ''

    for (let i = 0; i < newBlockCount; i++) {
        const block = newBlocks[i]

        rows += "<tr><td><a href='#' data-block='" + String(block.height).escapeHTML() + "' data-blockid='" + String(block.block).escapeHTML() + "' class='block'" + (block.numberOfTransactions > 0 ? " style='font-weight:bold'" : '') + '>' + String(block.height).escapeHTML() + "</a></td><td data-timestamp='" + String(block.timestamp).escapeHTML() + "'>" + formatTimestamp(block.timestamp) + '</td><td>' + formatAmount(block.totalAmountNQT) + ' + ' + formatAmount(block.totalFeeNQT) + '</td><td>' + formatAmount(block.numberOfTransactions) + '</td></tr>'
    }

    if (newBlockCount === 1) {
        $('#dashboard_blocks_table tbody tr:last').remove()
    } else if (newBlockCount === 10) {
        $('#dashboard_blocks_table tbody').empty()
    } else {
        $('#dashboard_blocks_table tbody tr').slice(10 - newBlockCount).remove()
    }

    $('#dashboard_blocks_table tbody').prepend(rows)

    // update number of confirmations... perhaps we should also update it in tne BRS.transactions array
    $('#dashboard_transactions_table tr.confirmed td.confirmations').each(function () {
        if ($(this).data('incoming')) {
            $(this).removeData('incoming')
            return true
        }

        const confirmations = parseInt($(this).data('confirmations'), 10)

        let nrConfirmations = confirmations + newBlocks.length

        if (confirmations <= 10) {
            $(this).data('confirmations', nrConfirmations)
            $(this).attr('data-content', $.t('x_confirmations', {
                x: formatAmount(nrConfirmations, false, true)
            }))

            if (nrConfirmations > 10) {
                nrConfirmations = '10+'
            }
            $(this).html(nrConfirmations)
        } else {
            $(this).attr('data-content', $.t('x_confirmations', {
                x: formatAmount(nrConfirmations, false, true)
            }))
        }
    })
}

export function pagesBlocksForged () {
    sendRequest('getAccountBlockIds+', {
        account: BRS.account,
        timestamp: 0
    }, function (response) {
        if (!response.blockIds || response.blockIds.length === 0) {
            blocksPageLoaded([])
            return
        }
        // We have blocks!
        let blocks = []
        let nrBlocks = 0

        const blockIds = response.blockIds.slice(0, 100)

        if (response.blockIds.length > 100) {
            $('#blocks_page_forged_warning').show()
        }

        for (let i = 0; i < blockIds.length; i++) {
            sendRequest('getBlock+', {
                block: blockIds[i],
                _extra: {
                    nr: i
                }
            }, function (block, input) {
                if (BRS.currentPage !== 'blocks_forged') {
                    blocks = {}
                    return
                }

                block.block = input.block
                blocks[input._extra.nr] = block
                nrBlocks++

                if (nrBlocks === blockIds.length) {
                    blocksPageLoaded(blocks)
                }
            })
        }
    })
}

export function pagesBlockInfo () {
    blocksInfoLoad('')
}

export function blocksInfoLoad (blockheight) {
    if (blockheight === '') {
        blockheight = BRS.blocks[0].height.toString()
    }
    sendRequest('getBlock+', {
        height: blockheight,
        includeTransactions: true
    }, function (response) {
        if (response.errorCode) {
            $.notify($.t('invalid_blockheight'), { type: 'danger' })
            dataLoaded('')
            return
        }
        $('#block_info_input_block').val(blockheight)
        const rows = response.transactions.reduce((prev, currTr) => prev + getTransactionInBlocksRowHTML(currTr), '')
        dataLoaded(rows)
    })
}

function getTransactionInBlocksRowHTML (transaction) {
    const details = getTransactionDetails(transaction)

    let rowStr = ''
    rowStr += '<tr>'
    rowStr += "<td><a href='#' data-transaction='" + String(transaction.transaction).escapeHTML() + "'>" + String(transaction.transaction).escapeHTML() + '</a></td>'
    rowStr += '<td>' + (details.hasMessage ? "<i class='far fa-envelope-open'></i>&nbsp;" : '') + '</td>'
    rowStr += '<td>' + formatTimestamp(transaction.timestamp) + '</td>'
    rowStr += '<td>' + details.nameOfTransaction + '</td>'
    rowStr += '<td>' + details.senderHTML + '</td>'
    rowStr += '<td>' + details.recipientHTML + '</td>'
    rowStr += '<td>' + details.circleText + '</td>'
    rowStr += `<td ${details.colorClass}>${details.amountToFromViewerHTML}</td>`
    rowStr += '<td>' + formatAmount(transaction.feeNQT) + '</td>'
    rowStr += '</tr>'

    return rowStr
};

export function pagesBlocks () {
    if (BRS.blocks.length >= 100 || BRS.downloadingBlockchain) {
        // Just show what we have
        blocksPageLoaded(BRS.blocks)
        return
    }
    if (BRS.blocks.length < 2) {
        // should never happens because dashboard already loaded 10 of them
        // buuut then show nothing
        blocksPageLoaded([])
        return
    }
    // partial blocks only, fetch 100 of them
    const previousBlock = BRS.blocks[BRS.blocks.length - 1].previousBlock
    // if previous block is undefined, dont try add it
    if (typeof previousBlock !== 'undefined') {
        getBlock(previousBlock, finish100Blocks, true)
    }
}

export function incomingBlocks () {
    reloadCurrentPage()
}

export function finish100Blocks (response) {
    BRS.blocks.push(response)
    if (BRS.blocks.length < 100 && typeof response.previousBlock !== 'undefined') {
        getBlock(response.previousBlock, finish100Blocks, true)
    } else {
        blocksPageLoaded(BRS.blocks)
    }
}

export function blocksPageLoaded (blocks) {
    let rows = ''
    let totalAmount = new BigInteger('0')
    let totalFees = new BigInteger('0')
    let totalTransactions = 0
    let time
    let endingTime
    let startingTime

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]

        totalAmount = totalAmount.add(new BigInteger(block.totalAmountNQT))

        totalFees = totalFees.add(new BigInteger(block.totalFeeNQT))

        totalTransactions += block.numberOfTransactions

        rows += "<tr><td><a href='#' data-block='" + String(block.height).escapeHTML() + "' data-blockid='" + String(block.block).escapeHTML() + "' class='block'" + (block.numberOfTransactions > 0 ? " style='font-weight:bold'" : '') + '>' + String(block.height).escapeHTML() + '</a></td><td>' + formatTimestamp(block.timestamp) + '</td><td>' + formatAmount(block.totalAmountNQT) + '</td><td>' + formatAmount(block.totalFeeNQT) + '</td><td>' + formatAmount(block.numberOfTransactions) + '</td><td>' + (block.generator !== BRS.genesis ? "<a href='#' data-user='" + getAccountFormatted(block, 'generator') + "' class='user_info'>" + getAccountTitle(block, 'generator') + '</a>' : $.t('genesis')) + '</td><td>' + formatVolume(block.payloadLength) + '</td><td>' + Math.round(block.baseTarget / 153722867 * 100).toString().padStart(4, '0') + ' %</td></tr>'
    }

    if (blocks.length) {
        startingTime = blocks[blocks.length - 1].timestamp
        endingTime = blocks[0].timestamp
        time = endingTime - startingTime
    } else {
        startingTime = endingTime = time = 0
    }
    let averageFee
    let averageAmount
    let blockCount
    if (blocks.length) {
        averageFee = formatAmount(totalFees.divide(new BigInteger((String(blocks.length)))))
        averageAmount = formatAmount(totalAmount.divide(new BigInteger((String(blocks.length)))))
    } else {
        averageFee = 0
        averageAmount = 0
    }

    averageFee = convertToNQT(averageFee)
    averageAmount = convertToNQT(averageAmount)

    if (BRS.currentPage === 'blocks_forged') {
        if (blocks.length === 100) {
            blockCount = blocks.length + '+'
        } else {
            blockCount = blocks.length
        }
        $('#blocks_forged_average_fee').html(formatStyledAmount(averageFee)).removeClass('loading_dots')
        $('#blocks_forged_average_amount').html(formatStyledAmount(averageAmount)).removeClass('loading_dots')
        $('#forged_blocks_total').html(blockCount).removeClass('loading_dots')
        $('#forged_fees_total').html(formatStyledAmount(BRS.accountInfo.forgedBalanceNQT)).removeClass('loading_dots')
    } else {
        if (time === 0) {
            $('#blocks_transactions_per_hour').html('0').removeClass('loading_dots')
        } else {
            $('#blocks_transactions_per_hour').html(Math.round(totalTransactions / (time / 60) * 60)).removeClass('loading_dots')
        }
        $('#blocks_average_fee').html(formatStyledAmount(averageFee)).removeClass('loading_dots')
        $('#blocks_average_amount').html(formatStyledAmount(averageAmount)).removeClass('loading_dots')
        $('#blocks_average_generation_time').html(Math.round(time / 100) + 's').removeClass('loading_dots')
    }

    dataLoaded(rows)
}
