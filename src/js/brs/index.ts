/**
 * @module BRS
*/

import $ from 'jquery'
import i18next from 'i18next'
import jqueryI18next from 'jquery-i18next'
import i18nHttpApi from 'i18next-http-backend'

import '../util/string.extensions'

import {
    pagesSettings
} from './brs.settings'

import {
    pagesBlocksForged,
    pagesBlockInfo,
    pagesBlocks,
    incomingBlocks
} from './brs.blocks'

import {
    pagesAliases,
    formsSellAlias,
    formsSellAliasComplete,
    formsBuyAliasError,
    formsBuyAliasComplete,
    incomingAliases,
    formsSetAlias,
    formsSetAliasError,
    formsSetAliasComplete
} from './brs.aliases'

import { pagesAt } from './brs.at'

import {
    pagesContacts,
    formsAddContact,
    formsUpdateContact,
    formsDeleteContact
} from './brs.contacts'

import { formsSendMoneyEscrow, pagesEscrow } from './brs.escrow'

import {
    formsAddCommitment
} from './brs.forms'

import { addEventListeners } from './brs.eventlisteners'

import {
    pagesAssetExchange,
    formsAddAssetBookmark,
    incomingAssetExchange,
    formsOrderAssetComplete
} from './brs.asset.page.assetexchange'

import { pagesTransferHistory } from './brs.asset.page.transferhistory'

import {
    formsOrderAsset,
    formsIssueAsset,
    formsAssetExchangeChangeGroupName,
    formsAssetExchangeGroup,
    formsTransferAssetMulti,
    formsTransferAsset,
    formsTransferAssetComplete,
    formsCancelOrder,
    formsCancelOrderComplete
} from './brs.modals.assets'

import {
    pagesOpenOrders,
    incomingOpenOrders
} from './brs.asset.page.openorders'

import {
    pagesMyAssets,
    incomingMyAssets
} from './brs.asset.page.myassets'

import {
    incomingUpdateDashboardTransactions,
    pagesTransactions,
} from './brs.transactions'

import {
    pagesMessages,
    incomingMessages,
    formsSendMessageComplete,
    formsDecryptMessages
} from './brs.messages'

import {
    pagesPeers,
    incomingPeers
} from './brs.peers'

import {
    formsSendMoneyComplete,
    formsSendMoneyMulti
} from './brs.modal.sendmoney'

import {
    pagesSubscription
} from './brs.subscription'

import {
    formsSetAccountInfoComplete
} from './brs.modals.accountinfo'

import {
    formsBroadcastTransactionComplete,
    formsParseTransactionComplete,
    formsParseTransactionError
} from './brs.modals.advanced'

import {
    formsSignModalButtonClicked,
    formsSignMessage,
    formsVerifyMessage
} from './brs.modals.signmessage'

import { init, reloadCurrentPage } from './brs'

import { pagesSearchResults } from './brs.search'

import { formsClearData } from './brs.modal.cleardata'

import {
    BlockchainStatus,
    BrsSettings,
    DBAsset,
    DBContact,
    DecryptedTransactionsCache,
    GetAccountResponse,
    GetAssetResponse,
    GetBlockResponse,
    Transaction
} from '../typings'

import { formRequestBurst } from './brs.modals.request'

import { RequestController } from './brs.requestcontroller'

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
    durationFormatter: new Intl.DurationFormat('en', { style: "short" }),
    volumeFormatter: new Intl.NumberFormat('en', {
        maximumSignificantDigits: 3,
        minimumSignificantDigits: 1,
    }),
    timeUnits: {
        day: 'd',
        hour: 'h',
        minute: 'm',
        second: 's'
    },

    downloadingBlockchain: false, // More than 4 days from last block
    rescaningBlockchain: false, // More than 1 hour from last block

    selectedContext: null as null | JQuery<HTMLElement>,

    // Used by 'pages' logic and RequestController
    currentPage: 'dashboard',
    currentSubPage: '',
    pageNumber: 1,
    pageSize: 25,
    showPageNumbers: false,
    hasMorePages: false,

    pages: {
        settings: pagesSettings,
        blocks_forged: pagesBlocksForged,
        block_info: pagesBlockInfo,
        blocks: pagesBlocks,
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
        messages: pagesMessages
    },
    incoming: {
        blocks: incomingBlocks,
        aliases: incomingAliases,
        asset_exchange: incomingAssetExchange,
        my_assets: incomingMyAssets,
        open_orders: incomingOpenOrders,
        updateDashboardTransactions: incomingUpdateDashboardTransactions,
        transactions: reloadCurrentPage,
        peers: incomingPeers,
        messages: incomingMessages
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
        requestBurst: formRequestBurst
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
        { address: 'http://localhost:6876', testnet: true }
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
        rate_limiter: '9'
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
    _publicKeys: {} as { [key: string]: string},

    // from assetexchange
    assets: [] as DBAsset[],
    closedGroups: [] as string[],
    assetSearch: false as false | string[],
    currentAsset: {} as DBAsset,
    currentAssetID: 'undefined',

    // from transactions
    lastTransactions: '',
    unconfirmedTransactions: [] as Transaction[],
    unconfirmedTransactionIds: '',
    unconfirmedTransactionsChange: true,
    transactionsPageType: null,

    // from messages
    _messages: {},

    // from modals
    fetchingModalData: false,
    _encryptedNote: null as null | Transaction,
    showedFormWarning: false,

    // from modals.account
    userInfoModal: null as null | {
        modalAccount: GetAccountResponse
        assetsDetails: GetAssetResponse[]
        issuedAssets: GetAssetResponse[]
    }
}

// @ts-expect-error: Browser only
window.jQuery = window.$ = $

document.addEventListener('DOMContentLoaded', function () {
    i18next.use(i18nHttpApi).init({
        fallbackLng: 'en',
        lowerCaseLng: true,
        backend: {
            loadPath: './locales/__lng__.json'
        },
        debug: false,
        load: 'currentOnly',
        interpolation: {
            prefix: '__',
            suffix: '__'
        }
    }, function () {
        jqueryI18next.init(i18next, $, {
            tName: 't', // --> appends $.t = i18next.t
            i18nName: 'i18n', // --> appends $.i18n = i18next
            handleName: 'localize', // --> appends $(selector).localize(opts);
            selectorAttr: 'data-i18n', // selector for translating elements
            targetAttr: 'i18n-target', // data-() attribute to grab target element to translate (if diffrent then itself)
            optionsAttr: 'i18n-options', // data-() attribute that contains options, will load/set if useOptionsAttr = true
            useOptionsAttr: false, // see optionsAttr
            parseDefaultValueFromContent: true // parses default values from content ele.val or ele.text
        })
        addEventListeners()
        init()
    })
})
