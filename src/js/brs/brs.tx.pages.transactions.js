import { BRS } from '.';
import { getContactByName } from './brs.contacts';
import { sendRequest } from './brs.server';
import { getUnconfirmedTransactionsFromCache, dataLoaded } from './brs.util';
import { reloadCurrentPage } from './brs';
import { formatNumber, formatTimestampAsDateTime, formatNQTAsAmount } from './brs.numbers';
import { getTransactionDetails } from './brs.transactions';

export function pagesTransactions() {
    function getFrom() {
        const from = $('input[name=transactions_from_account]:checked').val();
        if (from === 'me') {
            return BRS.account;
        }
        // from 'others'
        const fromWho = $('#transaction_from_account_account').val().trim();
        if (BRS.rsRegEx.test(fromWho) || BRS.idRegEx.test(fromWho)) {
            return fromWho;
        }
        const foundContact = getContactByName(fromWho);
        if (foundContact) {
            return foundContact.accountRS;
        }
        return '';
    }

    const account = getFrom();
    if (!account) {
        $.notify(
            $.t('name_not_in_contacts', { name: account }),
            { type: 'danger' }
        );
        return;
    }

    if (BRS.transactionsPageType === 'unconfirmed') {
        displayUnconfirmedTransactions(account);
        return;
    }

    let rows = '';
    let unconfirmedTransactions;
    const params = {
        account,
        firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
        lastIndex: BRS.pageSize * BRS.pageNumber,
        includeIndirect: true
    };

    if (BRS.transactionsPageType) {
        params.type = BRS.transactionsPageType.type;
        params.subtype = BRS.transactionsPageType.subtype;
        unconfirmedTransactions = getUnconfirmedTransactionsFromCache(params.type, params.subtype);
    } else {
        unconfirmedTransactions = BRS.unconfirmedTransactions;
    }

    if (unconfirmedTransactions && BRS.pageNumber === 1) {
        rows = unconfirmedTransactions.reduce((prev, currTr) => prev + getTransactionRowHTML(currTr, account), '');
    }

    sendRequest('getAccountTransactions+', params, (response) => {
        if (response.transactions && response.transactions.length) {
            if (response.transactions.length > BRS.pageSize) {
                BRS.hasMorePages = true;
                response.transactions.pop();
            }
            rows += response.transactions.reduce((prev, currTr) => prev + getTransactionRowHTML(currTr, account), '');
        }
        dataLoaded(rows);
    });
}

function displayUnconfirmedTransactions(viewAccount) {
    sendRequest('getUnconfirmedTransactions', function (response) {
        let rows = '';

        if (response.unconfirmedTransactions && response.unconfirmedTransactions.length) {
            rows = response.unconfirmedTransactions.reduce((prev, currTr) => prev + getTransactionRowHTML(currTr, viewAccount), '');
        }

        dataLoaded(rows);
    });
}

function getTransactionRowHTML(transaction, viewAccount) {
    const details = getTransactionDetails(transaction, viewAccount);

    let confirmationHTML = formatNumber(transaction.confirmations);
    if (transaction.unconfirmed) {
        confirmationHTML = BRS.pendingTransactionHTML;
    }
    let rowStr = '';
    rowStr += '<tr ' + ((transaction.unconfirmed && details.toFromViewer) ? " class='tentative'" : '') + '>';
    rowStr += "<td><a href='#' data-transaction='" + String(transaction.transaction).escapeHTML() + "'>" + String(transaction.transaction).escapeHTML() + '</a></td>';
    rowStr += '<td>' + (details.hasMessage ? "<i class='far fa-envelope-open'></i>&nbsp;" : '') + '</td>';
    rowStr += '<td>' + formatTimestampAsDateTime(transaction.timestamp) + '</td>';
    rowStr += '<td>' + details.nameOfTransaction + '</td>';
    rowStr += '<td>' + details.circleText + '</td>';
    rowStr += `<td ${details.colorClass}>${details.amountToFromViewerHTML}</td>`;
    rowStr += '<td>' + formatNQTAsAmount(transaction.feeNQT) + '</td>';
    rowStr += `<td>${details.accountLink}</td>`;
    rowStr += '<td>' + confirmationHTML + '</td>';
    rowStr += '</tr>';

    return rowStr;
}

export function evTransactionsPageTypeClick(e) {
    e.preventDefault()

    let type = $(this).data('type')

    if (!type) {
        BRS.transactionsPageType = null
    } else if (type === 'unconfirmed') {
        BRS.transactionsPageType = 'unconfirmed'
    } else {
        type = type.split(':')
        BRS.transactionsPageType = {
            type: type[0],
            subtype: type[1]
        }
    }

    BRS.pageNumber = 1
    BRS.hasMorePages = false

    $(this).parents('.btn-group').find('.text').text($(this).text())

    $('.popover').remove()

    reloadCurrentPage()
}
