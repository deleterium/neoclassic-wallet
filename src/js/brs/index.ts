/**
 * @module BRS
 */

import $ from 'jquery'
import i18next from 'i18next'
import jqueryI18next from 'jquery-i18next'
import i18nHttpApi from 'i18next-http-backend'

import '../util/string.extensions'

import { addEventListeners } from './core/event_listeners'

import { init } from './core/lockscreen'

import {
    BlockchainStatus,
    BrsSettings,
    DBAsset,
    DBContact,
    DecryptedTransactionsCache,
    GetAccountResponse,
    GetAssetResponse,
    GetBlockResponse,
    Note,
    Transaction,
} from './typings'

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
        /** `true` if there is new block in chain. */
        newBlock: false,
        /** `true` if there is new transactions to the account. Only `true` if `newBlock` is `true` too */
        newTransactions: false,
        latestsTransactionsIds: '',
        /** `true` if there is new pending transactions to the account, or if pending transactions were processed and removed from queue. */
        unconfirmedChanged: false,
        unconfirmedTransactionIds: '',
        forceDashboardUpdate: false,
    },
    // Used for pagination
    pageNumber: 1,
    pageSize: 25,
    showPageNumbers: false,
    hasMorePages: false,

    // Used for notifications
    _notifications: [] as Note[],

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
