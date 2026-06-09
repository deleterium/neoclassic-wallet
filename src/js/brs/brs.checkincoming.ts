import { BRS } from '.';
import { sendRequest } from './brs.server';
import { incomingUpdateDashboardTransactions } from './brs.dashboard.page';
import { handleNewBlocks } from './brs.blocks';
import { getAccountInfo } from './brs';
import { cacheUserAssets, saveCachedAssets } from './brs.asset.tools';
import { GetAccountTransactionIdsResponse, GetAccountTransactionsResponse, GetBlochainStatusResponse, GetUnconfirmedTransactionsResponse, Transaction, UnconfirmedTransaction } from '../typings';

export function setStateInterval (seconds : number ) : void {
    if (seconds === BRS.stateIntervalSeconds && BRS.stateInterval) {
        return
    }
    if (BRS.stateInterval) {
        clearInterval(BRS.stateInterval)
    }
    BRS.stateIntervalSeconds = seconds
    BRS.stateInterval = setInterval(checkBlocksAndTransactions, 1000 * seconds)
}

/**
 * Runs constantly to check blockchain details, conections 
 * @param callback 
 */
function checkBlocksAndTransactions () : void {
    BRS.checkIncoming.newBlock = false
    BRS.checkIncoming.newTransactions = false
    BRS.checkIncoming.unconfirmedChanged = false
    BRS.checkIncoming.forceDashboardUpdate = true

    sendRequest('getBlockchainStatus', function (response: GetBlochainStatusResponse ) {
        if (response.errorCode) {
            $.notify($.t('could_not_connect_to', { server: BRS.server }))
            return
        }
        const previousLastBlock = BRS.blockchainStatus?.lastBlock ||  '0'
        BRS.blockchainStatus = response
        if (previousLastBlock !== BRS.blockchainStatus.lastBlock) {
            // New block in chain!
            BRS.checkIncoming.newBlock = true
            handleNewBlocks()
            getAccountInfo(false, cacheUserAssets)
            getNewTransactions()
            return
        }

        addUnconfirmedAndHandleIncoming([])
    })
    saveCachedAssets()
}

/* Done only once at login */
export function getInitialTransactions() {
    BRS.checkIncoming.forceDashboardUpdate = true;
    fetchAndHandleLatestTransactions();
}

/* New block detected, start looking for transaction changes
   BRS.blocks[0] is still the previous block, because the new one was
   not updated yet. */
function getNewTransactions() {
    // check if there is a new transaction..
    sendRequest('getAccountTransactionIds', {
        account: BRS.account,
        timestamp: BRS.blocks[0].timestamp + 1,
        firstIndex: 0,
        lastIndex: 0
    }, function (response: GetAccountTransactionIdsResponse) {
        if (response.transactionIds && response.transactionIds.length) {
            BRS.checkIncoming.newTransactions = true;
            fetchAndHandleLatestTransactions();
            return
        }
        addUnconfirmedAndHandleIncoming([]);
    });
}

function fetchAndHandleLatestTransactions() {
    sendRequest('getAccountTransactions', {
        account: BRS.account,
        firstIndex: 0,
        lastIndex: 9,
        includeIndirect: true
    }, function (response: GetAccountTransactionsResponse ) {
        if (response.transactions && response.transactions.length) {
            BRS.checkIncoming.latestsTransactionsIds = response.transactions.map(tr => tr.transaction).join();
            addUnconfirmedAndHandleIncoming(response.transactions);
        } else {
            addUnconfirmedAndHandleIncoming([]);
        }
    });
}

/* Define a function to transform UnconfirmedTransaction to Transaction.
   Unconfirmed can be identified by properties:
   * unconfirmed: false
   * height: 2147483647
   * block: ''
   * blockTimestamp: -1 */
function mapUnconfirmedToTransaction(unconfirmed: UnconfirmedTransaction): Transaction {
    return {
        ...unconfirmed,
        block: "",
        blockTimestamp: -1
    };
}

function addUnconfirmedAndHandleIncoming(confirmedTransactions: Transaction[]) {
    sendRequest('getUnconfirmedTransactions', {
        account: BRS.account,
        includeIndirect: true
    }, function (response: GetUnconfirmedTransactionsResponse) {
        const sortedTransactions = response.unconfirmedTransactions?.sort((x, y) => y.timestamp - x.timestamp) || [];
        const transactionIdString = sortedTransactions.map(t => t.transaction).join();
        const ConfUnconfTransactions = sortedTransactions.map(mapUnconfirmedToTransaction);

        BRS.checkIncoming.unconfirmedChanged = transactionIdString !== (BRS.checkIncoming.unconfirmedTransactionIds);
        BRS.unconfirmedTransactions = sortedTransactions;
        BRS.checkIncoming.unconfirmedTransactionIds = transactionIdString;

        handleIncomingTransactions(confirmedTransactions.concat(ConfUnconfTransactions));
    });
}

function handleIncomingTransactions(transactions: Transaction[]) {

    transactions.sort((x, y) => y.timestamp - x.timestamp);

    if (BRS.checkIncoming.newTransactions) {
        $.notify($.t('new_confirmed_transaction'));
    }
    if (BRS.checkIncoming.unconfirmedChanged && !BRS.checkIncoming.newBlock) {
        $.notify($.t('new_unconfirmed_transaction'));
    }

    if (BRS.checkIncoming.forceDashboardUpdate ||
        BRS.checkIncoming.newTransactions ||
        BRS.checkIncoming.unconfirmedChanged
    ) {
        incomingUpdateDashboardTransactions(transactions);
    }
    if (BRS.checkIncoming.newBlock || BRS.checkIncoming.unconfirmedChanged) {
        if (BRS.incoming[BRS.currentPage]) {
            BRS.incoming[BRS.currentPage](transactions);
        }
    }

    // These handlers must be used in respective `incomingFunctions`

    // always unconfirmed transactions..
    // if (BRS.currentPage === 'transactions' && BRS.transactionsPageType === 'unconfirmed') {
    //     BRS.incoming.transactions()
    // } else {
    //     if (BRS.currentPage !== 'messages' && (!oldBlock || BRS.unconfirmedTransactionsChange)) {
    //         if (BRS.incoming[BRS.currentPage]) {
    //             BRS.incoming[BRS.currentPage](transactions)
    //         }
    //     }
    // }
    // // always call incoming for messages to enable message notifications
    // if (!oldBlock || BRS.unconfirmedTransactionsChange) {
    //     BRS.incoming.messages(transactions)
    // }
}
