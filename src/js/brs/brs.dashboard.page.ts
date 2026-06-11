import { BRS } from "."
import { Transaction } from "../typings";

import {
    formatNQTAsAmount,
    formatNumber,
    formatTimestampAsDateTime
} from "./brs.numbers"

import { getTransactionDetails } from "./brs.transactions"

export function incomingUpdateDashboardTransactions(newTransactions: Transaction[]) {
    if (!newTransactions.length) {
        return
    }
    let hasConfirmed = false;

    const rows = newTransactions.reduce((prev, currTr) => {
        if (currTr.unconfirmed === false) {
            hasConfirmed = true;
        }
        return prev + getTransactionRowDashboardHTML(currTr);
    }, '');

    if (hasConfirmed) {
        $('#dashboard_transactions_table tbody').empty().append(rows);
    } else {
        $('#dashboard_transactions_table tbody tr.tentative').remove();
        $('#dashboard_transactions_table tbody').prepend(rows);
    }

    const $parent = $('#dashboard_transactions_table').parent();

    if ($parent.hasClass('data-empty')) {
        $parent.removeClass('data-empty');
        if ($parent.data('no-padding')) {
            $parent.parent().addClass('no-padding');
        }
    }
}

function getTransactionRowDashboardHTML (transaction: Transaction) {
    const details = getTransactionDetails(transaction)

    let confirmationHTML = String(transaction.confirmations).escapeHTML()
    if (transaction.unconfirmed) {
        confirmationHTML = BRS.pendingTransactionHTML
    } else if (transaction.confirmations > 10) {
        confirmationHTML = '10+'
    }

    const rowClass = transaction.unconfirmed ? 'tentative' : 'confirmed';
    const messageIcon = details.hasMessage ? " + <i class='far fa-envelope-open'></i>&nbsp;" : '';

    return `
        <tr class='${rowClass}'>
            <td><a href='#' data-transaction='${String(transaction.transaction).escapeHTML()}' data-timestamp='${String(transaction.timestamp).escapeHTML()}'>${formatTimestampAsDateTime(transaction.timestamp)}</a></td>
            <td>${details.nameOfTransaction}${messageIcon}</td>
            <td>${details.circleText}</td>
            <td ${details.colorClass}>${details.amountToFromViewerHTML}</td>
            <td>${details.accountLink}</td>
            <td class='confirmations'>${confirmationHTML}</td>
        </tr>
    `;
}

/**
 * Update the blocks table in dashboard with the blocks available at `BRS.blocks`
 */

export function updateDashboardBlocks() {
    let rows = ''
    for (const block of BRS.blocks) {
        const isBold = block.numberOfTransactions > 0 ? "style='font-weight:bold'" : ''
        const height = String(block.height).escapeHTML()
        const blockId = String(block.block).escapeHTML()
        const timestamp = String(block.timestamp).escapeHTML()
        const formattedTimestamp = formatTimestampAsDateTime(block.timestamp)
        const totalAmount = formatNQTAsAmount(block.totalAmountNQT)
        const totalFee = formatNQTAsAmount(block.totalFeeNQT)
        const transactionCount = formatNumber(block.numberOfTransactions)

        rows += `
            <tr>
              <td>
                <a href='#' data-block='${height}' data-blockid='${blockId}' class='block' ${isBold}>
                  ${height}
                </a>
              </td>
              <td data-timestamp='${timestamp}'>${formattedTimestamp}</td>
              <td>${totalAmount} + ${totalFee}</td>
              <td>${transactionCount}</td>
            </tr>`
    }
    $('#dashboard_blocks_table tbody').html(rows)
}

export function updateConfirmationsInDashboardTransactions(numberToAdd: number) {
    $('#dashboard_transactions_table tr.confirmed td.confirmations').each(function () {
        if ($(this).data('incoming')) {
            $(this).removeData('incoming')
            return
        }

        const confirmations = parseInt($(this).text(), 10)

        const nrConfirmations = confirmations + numberToAdd

        if (confirmations <= 10) {
            if (nrConfirmations > 10) {
                $(this).text('10+')
                return
            }
            $(this).text(nrConfirmations)
            return
        }
        $(this).text('10+')
    })
}

