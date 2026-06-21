/**
 * @module BRS
 */

import $ from 'jquery'
import i18next from 'i18next'
import jqueryI18next from 'jquery-i18next'
import i18nHttpApi from 'i18next-http-backend'

import '../util/string.extensions'

import { pagesSettings } from './pages/settings'

import { pagesLatestBlocks, incomingLatestBlocks } from './pages/blockchain.latest_blocks'

import { pagesForgedBlocks } from './pages/mining.forged_blocks'

import { pagesBlockInfo } from './pages/blockchain.block_info'

import {
    formsSellAlias,
    formsSellAliasComplete,
    formsBuyAliasError,
    formsBuyAliasComplete,
    formsSetAlias,
    formsSetAliasError,
    formsSetAliasComplete,
} from './modals/aliases'

import { pagesAliases, incomingAliases } from './pages/aliases'

import { pagesAt } from './pages/payments.at'

import { formsAddContact, formsUpdateContact, formsDeleteContact } from './modals/contacts'

import { pagesContacts } from './pages/contacts'

import { formsSendMoneyEscrow, pagesEscrow } from './pages/payments.escrow'

import { formsAddCommitment } from './core/forms'

import { addEventListeners } from './core/event_listeners'

import { pagesAssetExchange, formsAddAssetBookmark, incomingAssetExchange, formsOrderAssetComplete } from './pages/assets.asset_exchange'

import { pagesTransferHistory } from './pages/assets.transfer_history'

import {
    formsOrderAsset,
    formsIssueAsset,
    formsAssetExchangeChangeGroupName,
    formsAssetExchangeGroup,
    formsTransferAssetMulti,
    formsTransferAsset,
    formsTransferAssetComplete,
    formsCancelOrder,
    formsCancelOrderComplete,
} from './modals/assets'

import { pagesOpenOrders, incomingOpenOrders } from './pages/assets.open_orders'

import { pagesMyAssets, incomingMyAssets } from './pages/assets.my_assets'

import { pagesTransactions } from './pages/transactions'

import { pagesMessages, incomingMessages } from './pages/messages'

import { formsSendMessageComplete, formsDecryptMessages } from './modals/messages'

import { pagesPeers, incomingPeers } from './pages/peers'

import { formsSendMoneyComplete, formsSendMoneyMulti } from './modals/sendmoney'

import { pagesSubscription } from './pages/payments.subscription'

import { formsSetAccountInfoComplete } from './modals/account_info'

import { formsBroadcastTransactionComplete, formsParseTransactionComplete, formsParseTransactionError } from './modals/advanced'

import { formsSignModalButtonClicked, formsSignMessage, formsVerifyMessage } from './modals/sign_message'

import { reloadCurrentPage } from './core/navigation'

import { init } from './core/lockscreen'

import { pagesSearchResults } from './pages/search_results.page'

import { formsClearData } from './modals/clear_data'

import {
    BlockchainStatus,
    BrsSettings,
    DBAsset,
    DBContact,
    DecryptedTransactionsCache,
    GetAccountResponse,
    GetAssetResponse,
    GetBlockResponse,
    Transaction,
} from './typings'

import { formRequestBurst } from './modals/request_coins'

import { RequestController } from './core/request_controller'

export const BRS = {
    version: '1.0.0',
    server: '',
    blockchainStatus: undefined as undefined | BlockchainStatus,
    blocks: [] as GetBlockResponse[],
    genesis: '0',
    genesisRS: 'S-2222-2222-2222-22222',
    genesisSeconds: Date.UTC(2014, 7, 11, 2, 0, 0, 0) / 1000,
    minimumFee: 0.01,

    // must match js/util/nxtaddress.js,
    rsRegEx: /^(BURST-|S-|TS-)([0-9A-Z]{3,5}-[0-9A-Z]{3,5}-[0-9A-Z]{3,5}-[0-9A-Z]{4,6})?(?:-([0-9A-Z]+))?$/,
    idRegEx: /^[0-9]{1,20}$/,

    account: '',
    accountRS: '',
    accountRSExtended: '',
    publicKey: '',
    accountInfo: {} as GetAccountResponse,

    database: null as IDBDatabase | null,
    databaseSupport: false,

    settings: {} as BrsSettings,
    contacts: {} as Record<string, DBContact>,

    isTestNet: false,
    prefix: 'S-',
    valueSuffix: 'SIGNA',

    // Number formatting in chose locale.
    decimalSign: '.',
    groupSeparator: ',',
    durationFormatter: new Intl.DurationFormat('en', { style: 'short' }),
    volumeFormatter: new Intl.NumberFormat('en', {
        maximumSignificantDigits: 3,
        minimumSignificantDigits: 1,
    }),
    timeUnits: {
        day: 'd',
        hour: 'h',
        minute: 'm',
        second: 's',
    },

    downloadingBlockchain: false, // More than 4 days from last block
    rescaningBlockchain: false, // More than 1 hour from last block

    selectedContext: null as null | JQuery<HTMLElement>,

    // Used by 'pages' logic and RequestController
    currentPage: 'dashboard',
    currentSubPage: '',

    // Used for checkIncoming
    checkIncoming: {
        newBlock: false,
        newTransactions: false,
        latestsTransactionsIds: '',
        unconfirmedChanged: false,
        unconfirmedTransactionIds: '',
        forceDashboardUpdate: false,
    },
    // Used for pagination
    pageNumber: 1,
    pageSize: 25,
    showPageNumbers: false,
    hasMorePages: false,

    pages: {
        settings: pagesSettings,
        forged_blocks: pagesForgedBlocks,
        block_info: pagesBlockInfo,
        latest_blocks: pagesLatestBlocks,
        aliases: pagesAliases,
        at: pagesAt,
        contacts: pagesContacts,
        escrow: pagesEscrow,
        asset_exchange: pagesAssetExchange,
        transfer_history: pagesTransferHistory,
        my_assets: pagesMyAssets,
        open_orders: pagesOpenOrders,
        transactions: pagesTransactions,
        peers: pagesPeers,
        subscription: pagesSubscription,
        search_results: pagesSearchResults,
        messages: pagesMessages,
    },
    incoming: {
        latest_blocks: incomingLatestBlocks,
        aliases: incomingAliases,
        asset_exchange: incomingAssetExchange,
        my_assets: incomingMyAssets,
        open_orders: incomingOpenOrders,
        transactions: reloadCurrentPage,
        peers: incomingPeers,
        messages: incomingMessages,
    },
    forms: {
        sellAlias: formsSellAlias,
        sellAliasComplete: formsSellAliasComplete,
        buyAliasError: formsBuyAliasError,
        buyAliasComplete: formsBuyAliasComplete,
        setAlias: formsSetAlias,
        setAliasError: formsSetAliasError,
        setAliasComplete: formsSetAliasComplete,
        addContact: formsAddContact,
        updateContact: formsUpdateContact,
        deleteContact: formsDeleteContact,
        addCommitment: formsAddCommitment,
        addAssetBookmark: formsAddAssetBookmark,
        orderAsset: formsOrderAsset,
        orderAssetComplete: formsOrderAssetComplete,
        issueAsset: formsIssueAsset,
        assetExchangeChangeGroupName: formsAssetExchangeChangeGroupName,
        assetExchangeGroup: formsAssetExchangeGroup,
        transferAssetMulti: formsTransferAssetMulti,
        transferAsset: formsTransferAsset,
        transferAssetComplete: formsTransferAssetComplete,
        cancelOrder: formsCancelOrder,
        cancelOrderComplete: formsCancelOrderComplete,
        sendMoneyComplete: formsSendMoneyComplete,
        sendMoneyMulti: formsSendMoneyMulti,
        sendMoneyEscrow: formsSendMoneyEscrow,
        sendMessageComplete: formsSendMessageComplete,
        decryptMessages: formsDecryptMessages,
        setAccountInfoComplete: formsSetAccountInfoComplete,
        clearData: formsClearData,
        broadcastTransactionComplete: formsBroadcastTransactionComplete,
        parseTransactionComplete: formsParseTransactionComplete,
        parseTransactionError: formsParseTransactionError,
        signModalButtonClicked: formsSignModalButtonClicked,
        signMessage: formsSignMessage,
        verifyMessage: formsVerifyMessage,
        requestBurst: formRequestBurst,
    },

    hasLocalStorage: true,
    inApp: false,
    appVersion: '',
    appPlatform: '',
    assetTableKeys: [],

    loadingDotsHTML: '<span>.</span><span>.</span><span>.</span>',
    pendingTransactionHTML: '<i class="fas fa-spinner my-fa-spin"></i>',
    minimumFeeNumber: 0.01,

    stateInterval: null as null | number,
    stateIntervalSeconds: 30,

    nodes: [
        // First must be localhost mainnet!
        { address: 'http://localhost:8125', testnet: false },
        { address: 'https://latam.signum.network', testnet: false },
        { address: 'https://us-east.signum.network', testnet: false },
        { address: 'https://singapore.signum.network', testnet: false },
        { address: 'https://australia.signum.network', testnet: false },
        { address: 'https://europe.signum.network', testnet: false },
        { address: 'https://brazil.signum.network', testnet: false },
        { address: 'https://europe1.signum.network', testnet: false },
        { address: 'https://ru.signum.network', testnet: false },
        { address: 'https://canada.signum.network', testnet: false },
        { address: 'https://europe3.testnet.signum.network', testnet: true },
        { address: 'http://localhost:6876', testnet: true },
    ],

    // from brs.settings
    defaultSettings: {
        submit_on_enter: false,
        fee_warning: '200000000',
        amount_warning: '100000000000',
        asset_transfer_warning: '10000',
        theme_dark: false,
        small_text: false,
        remember_passphrase: false,
        remember_account: false,
        automatic_node_selection: true,
        page_size: '25',
        prefered_node: '',
        language: 'en',
        last_remembered_account: '',
        rate_limiter: '9',
    } as BrsSettings,

    // from brs.server
    requestController: null as null | RequestController,

    // from login
    newlyCreatedAccount: false,

    // from brs.aliases
    alias_page_elements: 500,
    is_loading_aliases: false,

    // from encryption
    _password: '',
    _decryptionPassword: '',
    _decryptedTransactions: {} as DecryptedTransactionsCache,
    _publicKeys: {} as { [key: string]: string },

    // from assetexchange
    assets: [] as DBAsset[],
    closedGroups: [] as string[],
    assetSearch: false as false | string[],
    currentAsset: {} as DBAsset,
    currentAssetID: 'undefined',

    // from transactions
    lastTransactions: '',
    unconfirmedTransactions: [] as Transaction[],
    transactionsPageType: '',

    // from messages
    _messages: {} as {
        [userID: string]: Transaction[]
    },

    // from modals
    fetchingModalData: false,
    _encryptedNote: null as null | Transaction,
    showedFormWarning: false,

    // from modals.account
    userInfoModal: null as null | {
        modalAccount: GetAccountResponse
        assetsDetails: GetAssetResponse[]
        issuedAssets: GetAssetResponse[]
    },
}

// @ts-expect-error: Browser only
window.jQuery = window.$ = $

document.addEventListener('DOMContentLoaded', function () {
    i18next.use(i18nHttpApi).init(
        {
            fallbackLng: 'en',
            lowerCaseLng: true,
            backend: {
                loadPath: './locales/__lng__.json',
            },
            debug: false,
            load: 'currentOnly',
            interpolation: {
                prefix: '__',
                suffix: '__',
            },
        },
        function () {
            jqueryI18next.init(i18next, $, {
                tName: 't', // --> appends $.t = i18next.t
                i18nName: 'i18n', // --> appends $.i18n = i18next
                handleName: 'localize', // --> appends $(selector).localize(opts);
                selectorAttr: 'data-i18n', // selector for translating elements
                targetAttr: 'i18n-target', // data-() attribute to grab target element to translate (if diffrent then itself)
                optionsAttr: 'i18n-options', // data-() attribute that contains options, will load/set if useOptionsAttr = true
                useOptionsAttr: false, // see optionsAttr
                parseDefaultValueFromContent: true, // parses default values from content ele.val or ele.text
            })
            addEventListeners()
            init()
        },
    )
})
