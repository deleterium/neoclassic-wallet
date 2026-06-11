import { BRS } from "."
import { Transaction } from "../typings";
import { formatTimestampAsDateTime } from "./brs.numbers"
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
