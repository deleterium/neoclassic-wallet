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
    incomingUpdateDashboardBlocks,
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

import { pagesEscrow } from './brs.escrow'

import {
    formsAddCommitment
} from './brs.forms'

import { addEventListeners } from './brs.eventlisteners'

import {
    pagesAssetExchange,
    formsAddAssetBookmark,
    incomingAssetExchange,
    formsOrderAsset,
    formsOrderAssetComplete,
    formsIssueAsset,
    formsAssetExchangeChangeGroupName,
    formsAssetExchangeGroup,
    pagesTransferHistory,
    pagesMyAssets,
    incomingMyAssets,
    formsTransferAssetMulti,
    formsTransferAsset,
    formsTransferAssetComplete,
    pagesOpenOrders,
    incomingOpenOrders,
    formsCancelOrder,
    formsCancelOrderComplete
} from './brs.assetexchange'

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
} from './brs.recipient'

import {
    pagesSubscription
} from './brs.subscription'

import {
    formsSetAccountInfoComplete
} from './brs.modals.accountinfo'

import {
    formsBroadcastTransactionComplete,
    formsParseTransactionComplete,
    formsParseTransactionError,
    formsCalculateFullHashComplete,
    formsCalculateFullHashError
} from './brs.modals.advanced'

import {
    formsSignModalButtonClicked,
    formsSignMessage,
    formsVerifyMessage
} from './brs.modals.signmessage'
import { init, reloadCurrentPage } from './brs'
import { formsClearData } from './brs.modal.cleardata'
import { Transaction } from '../typings'

export const BRS = {
    version: '1.0.0',
    server: '',
    state: {},
    blocks: [],
    genesis: '0',
    genesisRS: 'S-2222-2222-2222-22222',
    minimumFee: 0.01,

    // must match js/util/nxtaddress.js,
    rsRegEx: /^(BURST-|S-|TS-)([0-9A-Z]{3,5}-[0-9A-Z]{3,5}-[0-9A-Z]{3,5}-[0-9A-Z]{4,6})?(?:-([0-9A-Z]+))?$/,
    idRegEx: /^[0-9]{1,20}$/,

    account: '',
    accountRS: '',
    publicKey: '',
    accountInfo: {},

    database: null,
    databaseSupport: false,

    settings: {},
    contacts: {},

    isTestNet: false,
    prefix: 'S-',
    valueSuffix: 'SIGNA',

    lastBlockHeight: 0,
    downloadingBlockchain: false,

    rememberPassword: false,
    selectedContext: null,

    currentPage: 'dashboard',
    // TODO: currentSubPage is not implemented. Implement or just remove?
    currentSubPage: '',
    pageNumber: 1,
    pageSize: 25,
    showPageNumbers: false,

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
        messages: pagesMessages
    },
    incoming: {
        updateDashboardBlocks: incomingUpdateDashboardBlocks,
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
        sendMessageComplete: formsSendMessageComplete,
        decryptMessages: formsDecryptMessages,
        setAccountInfoComplete: formsSetAccountInfoComplete,
        clearData: formsClearData,
        broadcastTransactionComplete: formsBroadcastTransactionComplete,
        parseTransactionComplete: formsParseTransactionComplete,
        parseTransactionError: formsParseTransactionError,
        calculateFullHashComplete: formsCalculateFullHashComplete,
        calculateFullHashError: formsCalculateFullHashError,
        signModalButtonClicked: formsSignModalButtonClicked,
        signMessage: formsSignMessage,
        verifyMessage: formsVerifyMessage
    },

    hasLocalStorage: true,
    inApp: false,
    appVersion: '',
    appPlatform: '',
    assetTableKeys: [],

    loadingDotsHTML: '<span>.</span><span>.</span><span>.</span>',
    pendingTransactionHTML: '<i class="fas fa-spinner my-fa-spin"></i>',
    minimumFeeNumber: 0.01,

    stateInterval: 0,
    stateIntervalSeconds: 30,
    isScanning: false,

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
        fee_warning: '100000000000',
        amount_warning: '10000000000000',
        asset_transfer_warning: '10000',
        theme_dark: false,
        small_text: false,
        remember_passphrase: 0,
        remember_account: 0,
        automatic_node_selection: 1,
        page_size: 25,
        prefered_node: '',
        language: 'en'
    },

    // from brs.server
    multiQueue: null,

    // from login
    newlyCreatedAccount: false,

    // from blocks
    tempBlocks: [],
    trackBlockchain: false,

    // from brs.aliases
    alias_page_elements: 500,
    is_loading_aliases: false,

    // from encryption
    _password: '',
    _decryptionPassword: '',
    _decryptedTransactions: {} as { [key: string]: any},
    _publicKeys: {} as { [key: string]: string},

    // from assetexchange
    assets: [],
    closedGroups: [],
    assetSearch: false,
    currentAsset: {},
    currentAssetID: 'undefined',

    // from transactions
    lastTransactions: '',
    unconfirmedTransactions: [],
    unconfirmedTransactionIds: '',
    unconfirmedTransactionsChange: true,
    transactionsPageType: null,

    // from messages
    _messages: {},

    // from modals
    fetchingModalData: false,
    _encryptedNote: null as null | Transaction,

    // from modals.account
    userInfoModal: {
        user: 0
    }
}

// @ts-expect-error: Browser only
window.jQuery = window.$ = $

document.addEventListener('DOMContentLoaded', function () {
    let done = 0
    const pages = [
        { location: 'body', path: 'html/sidebar_context.html' },
        { location: 'body', path: 'html/modals/account.html' },
        { location: 'body', path: 'html/modals/alias.html' },
        { location: 'body', path: 'html/modals/asset.html' },
        { location: 'body', path: 'html/modals/block_info.html' },
        { location: 'body', path: 'html/modals/brs.html' },
        { location: 'body', path: 'html/modals/contact.html' },
        { location: 'body', path: 'html/modals/escrow.html' },
        { location: 'body', path: 'html/modals/raw_transaction.html' },
        { location: 'body', path: 'html/modals/request_burst_qr.html' },
        { location: 'body', path: 'html/modals/mining.html' },
        { location: 'body', path: 'html/modals/send_message.html' },
        { location: 'body', path: 'html/modals/send_money.html' },
        { location: 'body', path: 'html/modals/subscription.html' },
        { location: 'body', path: 'html/modals/transaction_info.html' },
        { location: 'body', path: 'html/modals/user_info.html' },
        { location: 'body', path: 'html/modals/sign_message.html' },
        { location: '#header_nav', path: 'html/header.html' },
        { location: '#sidebar', path: 'html/sidebar.html' },
        { location: '#content', path: 'html/pages/dashboard.html' },
        { location: '#content', path: 'html/pages/transactions.html' },
        { location: '#content', path: 'html/pages/aliases.html' },
        { location: '#content', path: 'html/pages/messages.html' },
        { location: '#content', path: 'html/pages/contacts.html' },
        { location: '#content', path: 'html/pages/asset_exchange.html' },
        { location: '#content', path: 'html/pages/settings.html' },
        { location: '#content', path: 'html/pages/peers.html' },
        { location: '#content', path: 'html/pages/blocks.html' },
        { location: '#lockscreen', path: 'html/pages/lockscreen.html' }
    ]
    function loadHTMLOn (domName: string, path: string) {
        $.get(path, '', (data) => {
            $(domName).prepend(data)
            $('#loading_bar').val(80 + (done / pages.length) * 20)
            ++done
            if (done === pages.length) {
                loadingDone()
            }
        })
    }
    function loadingDone () {
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
            $('#loading_bar').val(100)
            init()
        })
    }
    for (const page of pages) {
        loadHTMLOn(page.location, page.path)
    }
})
