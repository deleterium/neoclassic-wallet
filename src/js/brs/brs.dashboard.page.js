import { BRS } from "."
import { formatTimestampAsDateTime } from "./brs.numbers"
import { getTransactionDetails } from "./brs.transactions"

export function incomingUpdateDashboardTransactions(newTransactions, unconfirmed) {
    if (newTransactions.length) {
        let onlyUnconfirmed = true;

        const rows = newTransactions.reduce((prev, currTr) => {
            if (!currTr.unconfirmed) {
                onlyUnconfirmed = false;
            }
            return prev + getTransactionRowDashboardHTML(currTr);
        }, '');

        if (onlyUnconfirmed) {
            $('#dashboard_transactions_table tbody tr.tentative').remove();
            $('#dashboard_transactions_table tbody').prepend(rows);
        } else {
            $('#dashboard_transactions_table tbody').empty().append(rows);
        }

        const $parent = $('#dashboard_transactions_table').parent();

        if ($parent.hasClass('data-empty')) {
            $parent.removeClass('data-empty');
            if ($parent.data('no-padding')) {
                $parent.parent().addClass('no-padding');
            }
        }
    } else if (unconfirmed) {
        $('#dashboard_transactions_table tbody tr.tentative').remove();
    }
}

function getTransactionRowDashboardHTML (transaction) {
    const details = getTransactionDetails(transaction)

    let confirmationHTML = String(transaction.confirmations).escapeHTML()
    if (transaction.unconfirmed) {
        confirmationHTML = BRS.pendingTransactionHTML
    } else if (transaction.confirmations > 10) {
        confirmationHTML = '10+'
    }

    let rowStr = ''
    rowStr += "<tr class='" + (transaction.unconfirmed ? 'tentative' : 'confirmed') + "'>"
    rowStr += "<td><a href='#' data-transaction='" + String(transaction.transaction).escapeHTML() + "' data-timestamp='" + String(transaction.timestamp).escapeHTML() + "'>" + formatTimestampAsDateTime(transaction.timestamp) + '</a></td>'
    rowStr += '<td>' + details.nameOfTransaction + (details.hasMessage ? " + <i class='far fa-envelope-open'></i>&nbsp;" : '') + '</td>'
    rowStr += '<td>' + details.circleText + '</td>'
    rowStr += `<td ${details.colorClass}>${details.amountToFromViewerHTML}</td>`
    rowStr += `<td>${details.accountLink}</td>`
    rowStr += `<td class='confirmations'>${confirmationHTML}</td>`
    rowStr += '</tr>'

    return rowStr
}
