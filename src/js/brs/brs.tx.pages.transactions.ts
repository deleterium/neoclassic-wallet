import { BRS } from '.';
import { getContactByName } from './brs.contacts.tools';
import { sendRequest } from './brs.sendRequest';
import { getUnconfirmedTransactionsFromCache, dataLoaded } from './brs.util';
import { reloadCurrentPage } from './brs';
import { formatNumber, formatTimestampAsDateTime, formatNQTAsAmount } from './brs.numbers';
import { getTransactionDetails } from './brs.tx.tools';
import { GetAccountTransactionsResponse, GetUnconfirmedTransactionsResponse, Transaction, UNCONFIRMED_HEIGHT } from '../typings';
import { mapUnconfirmedToTransaction } from './brs.checkincoming';

export function pagesTransactions() {
    function getFrom() {
        const from = $('input[name=transactions_from_account]:checked').val();
        if (from === 'me') {
            return BRS.account;
        }
        // from 'others'
        const fromWho = ($('#transaction_from_account_account').val() as string).trim();
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
    let unconfirmedTransactions: Transaction[] | undefined;
    const params: {
        account: string
        firstIndex: number;
        lastIndex: number;
        includeIndirect: boolean;
        type?: string;
        subtype?: string
    } = {
        account,
        firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
        lastIndex: BRS.pageSize * BRS.pageNumber,
        includeIndirect: true
    };

    if (BRS.transactionsPageType) {
        const types = BRS.transactionsPageType.split(':')
        params.type = types[0];
        params.subtype = types[1];
        unconfirmedTransactions = getUnconfirmedTransactionsFromCache(Number(params.type), Number(params.subtype));
    } else {
        unconfirmedTransactions = BRS.unconfirmedTransactions;
    }

    if (unconfirmedTransactions && BRS.pageNumber === 1) {
        rows = unconfirmedTransactions.reduce((prev, currTr) => prev + getTransactionRowHTML(currTr, account), '');
    }

    sendRequest('getAccountTransactions+', params, (response: GetAccountTransactionsResponse) => {
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

function displayUnconfirmedTransactions(viewAccount: string) {
    sendRequest('getUnconfirmedTransactions', {}, function (response: GetUnconfirmedTransactionsResponse) {
        let rows = '';

        if (response.unconfirmedTransactions && response.unconfirmedTransactions.length) {
            rows = response.unconfirmedTransactions.reduce((prev, currTr) => prev + getTransactionRowHTML(mapUnconfirmedToTransaction(currTr), viewAccount), '');
        }

        dataLoaded(rows);
    });
}

function getTransactionRowHTML(transaction: Transaction, viewAccount: string) {
    const details = getTransactionDetails(transaction, viewAccount);

    let confirmationHTML = BRS.pendingTransactionHTML;
    if (transaction.height !== UNCONFIRMED_HEIGHT) {
        confirmationHTML = formatNumber(transaction.confirmations)
    }
    const rowClass = (transaction.height === UNCONFIRMED_HEIGHT && details.toFromViewer) ? " class='tentative'" : '';
    const messageIcon = details.hasMessage ? "<i class='far fa-envelope-open'></i>&nbsp;" : '';

    return `
        <tr ${rowClass}>
          <td><a href='#' data-transaction='${transaction.transaction}'>${transaction.transaction}</a></td>
          <td>${messageIcon}</td>
          <td>${formatTimestampAsDateTime(transaction.timestamp)}</td>
          <td>${details.nameOfTransaction}</td>
          <td>${details.circleText}</td>
          <td ${details.colorClass}>${details.amountToFromViewerHTML}</td>
          <td>${formatNQTAsAmount(transaction.feeNQT)}</td>
          <td>${details.accountLink}</td>
          <td>${confirmationHTML}</td>
        </tr>`
}

export function evTransactionsPageTypeClick(e: JQuery.ClickEvent) {
    e.preventDefault()
    const element = e.target

    const type = $(element).data('type')

    if (!type) {
        BRS.transactionsPageType = ''
    } else if (type === 'unconfirmed') {
        BRS.transactionsPageType = 'unconfirmed'
    } else {
        BRS.transactionsPageType = type
    }

    BRS.pageNumber = 1
    BRS.hasMorePages = false

    $(element).parents('.btn-group').find('.text').text($(element).text())

    $('.popover').remove()

    reloadCurrentPage()
}
