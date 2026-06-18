import { BRS } from '.';
import { sendRequest } from './brs.sendRequest';

import {
    incomingUpdateDashboardTransactions,
    updateConfirmationsInDashboardTransactions,
    updateDashboardBlocks
} from './brs.dashboard.page';

import { getAndUpdateAccountDetails } from './brs.checkincoming.account';

import { cacheUserAssets, saveCachedAssets } from './brs.asset.tools';

import {
    GetAccountTransactionIdsResponse,
    GetAccountTransactionsResponse,
    GetBlochainStatusResponse,
    GetBlocksResponse,
    GetUnconfirmedTransactionsResponse,
    Transaction,
    UnconfirmedTransaction
} from '../typings';

export function setCheckIncomingInterval (seconds : number ) : void {
    if (seconds === BRS.stateIntervalSeconds && BRS.stateInterval) {
        return
    }
    if (BRS.stateInterval) {
        clearInterval(BRS.stateInterval)
    }
    BRS.stateIntervalSeconds = seconds
    BRS.stateInterval = setInterval(checkIncomingBlocksAndTransactions, 1000 * seconds)
}

/**
 * Execute NOW the check for incoming transactions and blocks. Reset the interval.
 */
export function checkIncomingNow() {
    if (!BRS.stateInterval) {
        checkIncomingBlocksAndTransactions()
        return
    }
    clearInterval(BRS.stateInterval)
    checkIncomingBlocksAndTransactions()
    BRS.stateInterval = setInterval(checkIncomingBlocksAndTransactions, 1000 * BRS.stateIntervalSeconds)
}

/**
 * Runs constantly to check blockchain details, conections 
 * @param callback 
 */
function checkIncomingBlocksAndTransactions () : void {
    BRS.checkIncoming.newBlock = false
    BRS.checkIncoming.newTransactions = false
    BRS.checkIncoming.unconfirmedChanged = false
    BRS.checkIncoming.forceDashboardUpdate = true

    sendRequest('getBlockchainStatus', {}, function (response: GetBlochainStatusResponse ) {
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
            getAndUpdateAccountDetails(false, cacheUserAssets)
            getNewTransactions()
            return
        }

        addUnconfirmedAndHandleIncoming([])
    })
    saveCachedAssets()
}
/**
 * Called when it is detected a new block on blockchain. Checks sync progress and update dashboard information.
 */
export function handleNewBlocks () {
    sendRequest('getBlocks', {
        firstIndex: 0,
        lastIndex: 10
    }, function (response: GetBlocksResponse) {
        if (response.errorCode) {
            return
        }
        if (!BRS.blocks || BRS.blocks.length === 0) {
            // If first time, or if changed network type
            BRS.blocks = response.blocks
        }
        const blockheightDiff = response.blocks[0].height - BRS.blocks[0].height
        BRS.blocks = response.blocks
        checkSyncProcess()
        updateDashboardBlocks()
        updateConfirmationsInDashboardTransactions(blockheightDiff)
    })
}

/**
 * Execute verifications for sync process, showing warnings and managing the interval to check it again.
 * @returns 
 */
function checkSyncProcess() {
    if (!BRS.blockchainStatus) return

    const secondsBehind = BRS.blockchainStatus.time - BRS.blocks[0].timestamp

    if (secondsBehind > 60 * 60 * 24  * 4) {
        // RESYNC! Estimated that it is more than 1440 blocks behind
        setCheckIncomingInterval(30)
        BRS.downloadingBlockchain = true
        $('#downloading_blockchain').show()
        // update progress bar
        let percentage = 0
        if (BRS.blockchainStatus.lastBlockchainFeederHeight) {
            // lastBlockchainFeederHeight is zero if node has not find feeders
            percentage = Math.trunc((BRS.blockchainStatus.numberOfBlocks / BRS.blockchainStatus.lastBlockchainFeederHeight) * 100)
        }
        $('#downloading_blockchain .progress-bar').css('width', percentage + '%')
        return
    }

    BRS.downloadingBlockchain = false
    $('#downloading_blockchain').hide()

    if (secondsBehind > 60 * 60) {
        // Rescanning!
        setCheckIncomingInterval(10)
        BRS.rescaningBlockchain = true
        return
    }

    // Sync seems to be ok (less than one hour behind)
    setCheckIncomingInterval(30)
    BRS.rescaningBlockchain = false

    // Check if it is on a fork
    const onAFork = BRS.blocks.every(block => block.generator === BRS.blocks[0].generator)
    if (onAFork) {
        $.notify($.t('fork_warning'), { type: 'danger' })
    }
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
   * height: 2147483647
   * confirmations: -1
   * block: ''
   * blockTimestamp: -1 */
export function mapUnconfirmedToTransaction(unconfirmed: UnconfirmedTransaction): Transaction {
    return {
        ...unconfirmed,
        confirmations: -1,
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
        BRS.unconfirmedTransactions = ConfUnconfTransactions;
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
