import { BRS } from '..';
import { BlockDetails } from '../typings';
import { formatTimestampAsDateTime, formatNQTAsAmount, formatNumber, formatVolume, parseAmountToNQT } from '../core/numbers';
import { getAccountRSFromObject, getAccountTitleFromObject, formatStyledAmount, dataLoaded } from '../core/util';

/**
 * Draws the page 'Blockchain' -> 'Latest blocks' or the page 'Mining' -> 'Forged blocks'
 * @param blockheight Blocks to show in current page.
 */
export function drawBlocksInCurrentPage(blocks: BlockDetails[]) {
    let rows = '';
    let totalAmount = 0n;
    let totalFees = 0n;
    let totalTransactions = 0;
    let time: number;
    let endingTime: number;
    let startingTime: number;

    for (const block of blocks) {
        // Update totals
        totalAmount += BigInt(block.totalAmountNQT);
        totalFees += BigInt(block.totalFeeNQT);
        totalTransactions += block.numberOfTransactions;

        // Format values for display
        const height = String(block.height).escapeHTML();
        const blockId = String(block.block).escapeHTML();
        const isBold = block.numberOfTransactions > 0 ? " style='font-weight:bold'" : '';
        const timestamp = formatTimestampAsDateTime(block.timestamp);
        const amount = formatNQTAsAmount(block.totalAmountNQT);
        const fee = formatNQTAsAmount(block.totalFeeNQT);
        const transactions = formatNumber(block.numberOfTransactions);
        const generatorDisplay = block.generator !== BRS.genesis
            ? `<a href='#' data-user='${getAccountRSFromObject(block, 'generator')}' class='user_info'>${getAccountTitleFromObject(block, 'generator')}</a>`
            : $.t('genesis');
        const volume = formatVolume(block.payloadLength);
        const percentage = Math.round(Number(block.baseTarget) / 153722867 * 100).toString().padStart(4, '0') + ' %';

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
            </tr>`;
    }

    if (blocks.length) {
        startingTime = blocks[blocks.length - 1].timestamp;
        endingTime = blocks[0].timestamp;
        time = endingTime - startingTime;
    } else {
        startingTime = endingTime = time = 0;
    }
    let averageFee: string;
    let averageAmount: string;
    let blockCount: string;
    if (blocks.length) {
        averageFee = formatNQTAsAmount(totalFees / BigInt(blocks.length));
        averageAmount = formatNQTAsAmount(totalAmount / BigInt(blocks.length));
    } else {
        averageFee = '0';
        averageAmount = '0';
    }

    averageFee = parseAmountToNQT(averageFee);
    averageAmount = parseAmountToNQT(averageAmount);

    if (BRS.currentPage === 'forged_blocks') {
        if (blocks.length >= BRS.pageSize) {
            blockCount = BRS.pageSize + '+';
        } else {
            blockCount = blocks.length.toString();
        }
        $('#forged_blocks_average_fee').html(formatStyledAmount(averageFee)).removeClass('loading_dots');
        $('#forged_blocks_average_amount').html(formatStyledAmount(averageAmount)).removeClass('loading_dots');
        $('#forged_blocks_total').html(blockCount).removeClass('loading_dots');
        $('#forged_fees_total').html(formatStyledAmount(BRS.accountInfo.forgedBalanceNQT)).removeClass('loading_dots');
    } else {
        if (time === 0) {
            $('#latest_blocks_transactions_per_hour').html('0').removeClass('loading_dots');
        } else {
            $('#latest_blocks_transactions_per_hour').html((Math.round(totalTransactions / (time / 60) * 60)).toString()).removeClass('loading_dots');
        }
        $('#latest_blocks_average_fee').html(formatStyledAmount(averageFee)).removeClass('loading_dots');
        $('#latest_blocks_average_amount').html(formatStyledAmount(averageAmount)).removeClass('loading_dots');
        $('#latest_blocks_average_generation_time').html(Math.round(time / 100) + 's').removeClass('loading_dots');
    }

    dataLoaded(rows);
}
