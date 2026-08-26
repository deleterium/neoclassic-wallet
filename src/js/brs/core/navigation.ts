import { BRS } from '..'
import { pagesAliases } from '../pages/aliases'
import { loadAssetExchangeSubPage, pagesAssetExchange } from '../pages/assets.asset_exchange'
import { pagesMyAssets } from '../pages/assets.my_assets'
import { pagesOpenOrders } from '../pages/assets.open_orders'
import { pagesTransferHistory } from '../pages/assets.transfer_history'
import { pagesBlockInfo } from '../pages/blockchain.block_info'
import { pagesLatestBlocks } from '../pages/blockchain.latest_blocks'
import { pagesContacts } from '../pages/contacts'
import { loadMessagesSubPage, pagesMessages } from '../pages/messages'
import { pagesForgedBlocks } from '../pages/mining.forged_blocks'
import { pagesNotifications } from '../pages/notifications'
import { pagesAt } from '../pages/payments.at'
import { pagesEscrow } from '../pages/payments.escrow'
import { pagesSubscription } from '../pages/payments.subscription'
import { pagesPeers } from '../pages/peers'
import { pagesSearchResults } from '../pages/search_results.page'
import { pagesSettings } from '../pages/settings'
import { pagesTransactions } from '../pages/transactions'
import { pagesAssestAdministration } from '../pages/assets.asset_administration'
import {
    showAddAssetTreasuryAccountModal,
    showAssetHoldersModal,
    showAssetOrderModal,
    showCancelOrderModal,
    showDistributeToAssetHoldersModal,
    showMintAssetModal,
    showTransferAssetModal,
    showTransferAssetOwnershipModal,
} from '../modals/assets'
import { showSendMoneyModal } from '../modals/sendmoney'
import { showTransactionModal } from '../modals/transaction'
import { showAccountModal } from '../modals/account'
import { showModal } from './modals'
import {
    showAliasInfoModal,
    showAliasOperationModal,
    showBuyAliasModal,
    showRegisterAliasModal,
    showUpdateAliasModal,
} from '../modals/aliases'
import { showBlockInfoModal } from '../modals/block'
import { showServerInfoModal } from '../modals/server_info'
import { showAddContactModal, showDeleteContactModal, showUpdateContactModal } from '../modals/contacts'
import { showEscrowDecisionModal } from '../modals/escrow'
import { showRawTransactionModal } from '../modals/advanced'
import { showRequestBurstQrModal } from '../modals/request_coins'
import { showSendMessageModal } from '../modals/messages'
import { showSubscriptionCancelModal } from '../modals/subscription'
import { activateAccount } from './activate_account'

const pageFunctions = {
    aliases: pagesAliases,
    asset_exchange: pagesAssetExchange,
    asset_administration: pagesAssestAdministration,
    at: pagesAt,
    block_info: pagesBlockInfo,
    contacts: pagesContacts,
    dashboard: () => {},
    escrow: pagesEscrow,
    forged_blocks: pagesForgedBlocks,
    latest_blocks: pagesLatestBlocks,
    messages: pagesMessages,
    my_assets: pagesMyAssets,
    notifications: pagesNotifications,
    open_orders: pagesOpenOrders,
    peers: pagesPeers,
    search_results: pagesSearchResults,
    settings: pagesSettings,
    subscription: pagesSubscription,
    transactions: pagesTransactions,
    transfer_history: pagesTransferHistory,
}

async function executePage(page: string) {
    pageLoading()
    if (!pageFunctions[page]) {
        console.error(`Unknow page '${page}'`)
        pageLoaded()
        return
    }
    await pageFunctions[page]()
}

/** Load a page for first time (setting up global variables) */
async function loadPage(page: string, pageNumber: number) {
    BRS.currentPage = page
    BRS.currentSubPage = ''
    BRS.pageNumber = pageNumber
    await executePage(page)
}

/** Reload current page, keeping variables like pagination */
export function reloadCurrentPage(): void {
    executePage(BRS.currentPage)
}

/** Updates sidebar menu */
export function updateSidebarActiveItem(page: string): void {
    $('[data-widget="treeview"] a.active').removeClass('active')
    let $link = $('[data-widget="treeview"] a[href*="#page=' + page + '"]')

    if ($link.length > 1) {
        // if there are many pages in menubar
        if ($link.last().is(':visible')) {
            // Select last one if it is visible
            $link = $link.last()
        } else {
            $link = $link.first()
        }
    }
    if ($link.length === 1) {
        $link.addClass('active')
        return
    }
    // It's, a hidden page like "search_results"
}

export function pageLoading(): void {
    BRS.hasMorePages = false
    const $pageHeader = $('#' + BRS.currentPage + '_page .content-header h1')
    $pageHeader.find('.loading_dots').remove()
    $pageHeader.append("<span class='loading_dots'>" + BRS.loadingDotsHTML + '</span>')
    const $pageContainer = $('#' + BRS.currentPage + '_page .data-container')
    if (BRS.currentSubPage === '') {
        // Only redraw entire page if there is no subpage.
        $pageContainer.addClass('data-loading')
    }
}

export function pageLoaded(callback?: () => void) {
    const $currentPage = $('#' + BRS.currentPage + '_page')
    $currentPage.find('.content-header h1 .loading_dots').remove()
    if ($currentPage.hasClass('paginated')) {
        addPagination()
    }
    window.scrollTo({
        top: 0,
        behavior: 'smooth',
    })
    if (callback) {
        callback()
    }
}

export function addPagination(): void {
    function createListElement(pageNumber: number, extClass: string, content: string) {
        return `<li class="page-item ${extClass}"><a class="page-link" href='#page=${BRS.currentPage}&subPage=${BRS.currentSubPage}&pageNumber=${pageNumber}'>${content}</a></li>`
    }

    let output = '<ul class="pagination justify-content-center">'

    if (BRS.pageNumber === 1) {
        output += createListElement(1, 'disabled', '<i class="fa fa-fast-backward" aria-hidden="true"></i>')
        output += createListElement(1, 'disabled', '<i class="fa fa-step-backward" aria-hidden="true"></i>')
    } else {
        output += createListElement(1, '', '<i class="fa fa-fast-backward" aria-hidden="true"></i>')
        output += createListElement(BRS.pageNumber - 1, '', '<i class="fa fa-step-backward" aria-hidden="true"></i>')
    }

    output += createListElement(BRS.pageNumber, '', BRS.pageNumber.toString())

    if (BRS.hasMorePages) {
        output += createListElement(BRS.pageNumber + 1, '', '<i class="fa fa-step-forward" aria-hidden="true"></i>')
    } else {
        output += createListElement(BRS.pageNumber + 1, 'disabled', '<i class="fa fa-step-forward" aria-hidden="true"></i>')
    }

    const $paginationContainer = $('#' + BRS.currentPage + '_page .data-pagination')

    if ($paginationContainer.length) {
        if (BRS.pageNumber === 1 && !BRS.hasMorePages) {
            $paginationContainer.html('')
        } else {
            $paginationContainer.html(output + '</ul>')
        }
    }
}

export function goToPageNumber(pageNumber: number) {
    BRS.pageNumber = pageNumber
    executePage(BRS.currentPage)
}

export function checkLocationHash() {
    const locationHash = window.location.hash.replace('#', '')
    if (!locationHash) {
        let loc = '#page=' + BRS.currentPage
        if (BRS.currentSubPage) {
            loc += '&subPage=' + BRS.currentSubPage
        }
        if (BRS.pageNumber !== 1) {
            loc += '&pageNumber=' + BRS.pageNumber.toString()
        }
        window.location.hash = loc
        return
    }

    const params = new URLSearchParams(locationHash)
    if (params.has('page')) {
        pageRouter(params)
        return
    }
    if (params.has('modal')) {
        modalRouter(params)
        return
    }
    if (params.has('action')) {
        actionRouter(params)
        return
    }
    console.log('Unknown hash action.')
}

async function pageRouter(params: URLSearchParams) {
    const hashPage = params.get('page') || ''
    const hashSubPage = params.get('subPage') || ''
    const hashPageNumberInput = params.get('pageNumber') || '1'

    // Check if the page number input is a valid integer and within the specified range
    let hashPageNumber = Number(hashPageNumberInput)
    if (!Number.isInteger(hashPageNumber) || hashPageNumber < 1 || hashPageNumber > Number.MAX_SAFE_INTEGER) {
        hashPageNumber = 1
    }

    if (hashPage === BRS.currentPage) {
        if (hashSubPage === BRS.currentSubPage) {
            if (hashPageNumber === BRS.pageNumber) {
                return
            }
            goToPageNumber(hashPageNumber)
            return
        }
    } else {
        $('.page').hide()
        $('#' + hashPage + '_page').show()
        updateSidebarActiveItem(hashPage)
        await loadPage(hashPage, hashPageNumber)
    }
    if (!hashSubPage) {
        return
    }
    switch (hashPage) {
        case 'asset_exchange':
            loadAssetExchangeSubPage(hashSubPage)
            return
        case 'messages':
            loadMessagesSubPage(hashSubPage)
            return
        default:
            console.log('Page ' + hashPage + ' has no subPage action.')
            window.location.hash = '#'
            return
    }
}

interface ModalConfig {
    requiredParams?: string[]
    handler: (params: URLSearchParams) => void
}

const MODAL_CONFIG: Record<string, ModalConfig> = {
    asset_holders: {
        requiredParams: ['asset'],
        handler: (params) => showAssetHoldersModal(params.get('asset') as string),
    },
    send_money: {
        handler: (params) => showSendMoneyModal(params.get('recipient') ?? '', params.get('amount') ?? ''),
    },
    transaction_info: {
        requiredParams: ['transaction'],
        handler: (params) => showTransactionModal(params.get('transaction') as string),
    },
    user_info: {
        requiredParams: ['user'],
        handler: (params) => showAccountModal(params.get('user') as string),
    },
    clear_data: {
        handler: () => showModal('clear_data'),
    },
    add_asset_bookmark: {
        handler: () => showModal('add_asset_bookmark'),
    },
    issue_asset: {
        handler: () => showModal('issue_asset'),
    },
    escrow_create: {
        handler: () => showModal('escrow_create'),
    },
    reward_assignment: {
        handler: () => showModal('reward_assignment'),
    },
    commitment: {
        handler: () => showModal('commitment'),
    },
    messages_decrypt: {
        handler: () => showModal('messages_decrypt'),
    },
    subscription_create: {
        handler: () => showModal('subscription_create'),
    },
    sign_message: {
        handler: () => showModal('sign_message'),
    },
    transfer_alias: {
        requiredParams: ['alias', 'tld'],
        handler: (params) =>
            showAliasOperationModal(
                'transfer_alias',
                params.get('alias') as string,
                params.get('aliasName') || '',
                params.get('tld') as string,
            ),
    },
    sell_alias: {
        requiredParams: ['alias', 'tld'],
        handler: (params) =>
            showAliasOperationModal(
                'sell_alias',
                params.get('alias') as string,
                params.get('aliasName') || '',
                params.get('tld') as string,
            ),
    },
    cancel_alias_sale: {
        requiredParams: ['alias', 'tld'],
        handler: (params) =>
            showAliasOperationModal(
                'cancel_alias_sale',
                params.get('alias') as string,
                params.get('aliasName') || '',
                params.get('tld') as string,
            ),
    },
    update_alias: {
        requiredParams: ['alias'],
        handler: (params) => showUpdateAliasModal(params.get('alias') as string),
    },
    register_alias: {
        handler: () => showRegisterAliasModal(),
    },
    server_info: {
        handler: () => showServerInfoModal(),
    },
    buy_alias: {
        requiredParams: ['alias'],
        handler: (params) => showBuyAliasModal(params.get('alias') as string),
    },
    register_tld: {
        handler: () => showModal('register_tld'),
    },
    alias_info: {
        requiredParams: ['alias'],
        handler: (params) => showAliasInfoModal(params.get('alias') as string),
    },
    cancel_order: {
        requiredParams: ['order', 'type'],
        handler: (params) => {
            const type = params.get('type')
            if (type !== 'bid' && type !== 'ask') {
                console.log(`Invalid type "${type}" for modal "cancel_order".`)
                window.location.hash = '#'
                return
            }
            showCancelOrderModal(params.get('order') as string, type)
        },
    },
    asset_order: {
        requiredParams: ['asset', 'type'],
        handler: (params) => {
            const type = params.get('type')
            if (type !== 'buy' && type !== 'sell') {
                console.log(`Invalid type "${type}" for modal "asset_order".`)
                window.location.hash = '#'
                return
            }
            showAssetOrderModal(params.get('asset') as string, type)
        },
    },
    transfer_asset: {
        handler: (params) => showTransferAssetModal(params.get('asset') ?? '', params.get('name') ?? '?', params.get('decimals') ?? ''),
    },
    mint_asset: {
        requiredParams: ['asset', 'name', 'decimals'],
        handler: (params) =>
            showMintAssetModal(params.get('asset') as string, params.get('name') as string, params.get('decimals') as string),
    },
    distribute_to_asset_holders: {
        handler: (params) =>
            showDistributeToAssetHoldersModal(params.get('asset') ?? '', params.get('name') ?? '?', params.get('decimals') ?? ''),
    },
    transfer_asset_ownership: {
        requiredParams: ['asset'],
        handler: (params) => showTransferAssetOwnershipModal(params.get('asset') as string),
    },
    add_asset_treasury_account: {
        requiredParams: ['asset'],
        handler: (params) => showAddAssetTreasuryAccountModal(params.get('asset') as string),
    },
    block_info: {
        requiredParams: ['block'],
        handler: (params) => showBlockInfoModal(params.get('block') as string),
    },
    add_contact: {
        handler: (params) => showAddContactModal(params.get('account') ?? ''),
    },
    update_contact: {
        requiredParams: ['account'],
        handler: (params) => showUpdateContactModal(params.get('account') as string),
    },
    delete_contact: {
        requiredParams: ['account'],
        handler: (params) => showDeleteContactModal(params.get('account') as string),
    },
    escrow_decision: {
        requiredParams: ['escrow'],
        handler: (params) => showEscrowDecisionModal(params.get('escrow') as string),
    },
    raw_transaction: {
        handler: () => showRawTransactionModal('', ''),
    },
    request_burst_qr: {
        handler: () => showRequestBurstQrModal(),
    },
    send_message: {
        handler: (params) => showSendMessageModal(params.get('recipient') ?? '', params.get('content') ?? ''),
    },
    subscription_cancel: {
        requiredParams: ['subscription'],
        handler: (params) => showSubscriptionCancelModal(params.get('subscription') as string),
    },
}

function modalRouter(params: URLSearchParams) {
    const modalName = params.get('modal') ?? ''
    const config = MODAL_CONFIG[modalName]
    if (!config) {
        console.log(`Unknown modal "${modalName}".`)
        window.location.hash = '#'
        return
    }
    // Check required parameters
    for (const param of config.requiredParams ?? []) {
        if (!params.has(param)) {
            console.log(`Missing or invalid ${param} for modal "${modalName}".`)
            window.location.hash = '#'
            return
        }
    }
    config.handler(params)
}

function actionRouter(params: URLSearchParams) {
    const action = params.get('action') as string

    if (action === 'activate') {
        activateAccount()
        return
    }
    console.log('Unknow action ' + action)
    window.location.hash = '#'
}

/** Checks if a Number is valid and greater than minimum fee. If not, return minimum fee */
export function checkMinimumFee(value: number): number {
    return isNaN(value) ? BRS.minimumFeeNumber : value < BRS.minimumFeeNumber ? BRS.minimumFeeNumber : value
}
