import { goToAsset, loadAssetExchangeSubPage, pagesAssetExchange } from '../pages/assets.asset_exchange'

import { BRS } from '..'
import { pagesAliases } from '../pages/aliases'
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
import { showAssetHoldersModal, showAssetOrderModal, showCancelOrderModal, showTransferAssetModal } from '../modals/assets'
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

const pageFunctions = {
    aliases: pagesAliases,
    asset_exchange: pagesAssetExchange,
    asset_administration: pagesAssestAdministration,
    at: pagesAt,
    block_info: pagesBlockInfo,
    contacts: pagesContacts,
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

// TODO remove after upgrading location logic.
export function checkLocationHashOld(): void {
    if (!window.location.hash) {
        return
    }
    const hash = window.location.hash.replace('#', '').split(':')
    let $modal: JQuery<HTMLElement> | undefined
    if (hash.length !== 2) {
        return
    }
    if (hash[0] === 'message') {
        $modal = $('#send_message_modal')
    } else if (hash[0] === 'send') {
        $modal = $('#send_money_modal')
    } else if (hash[0] === 'asset') {
        goToAsset(hash[1])
        return
    }

    if ($modal) {
        let account_id = hash[1].trim()
        if (!/^\d+$/.test(account_id) && account_id.indexOf('@') !== 0) {
            account_id = '@' + account_id
        }
        $modal.find('input[name=recipient]').val(account_id.unescapeHTML()).trigger('blur')
        $modal.modal('show')
    }
    window.location.hash = '#'
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

function modalRouter(params: URLSearchParams) {
    const modalName = params.get('modal')
    switch (modalName) {
        case 'asset_holders':
            if (params.has('asset')) {
                const assetID = params.get('asset') ?? ''
                if (assetID) {
                    showAssetHoldersModal(params.get('asset') as string)
                    return
                }
            }
            console.log('Missing or invalid asset for modal "asset_holders".')
            window.location.hash = '#'
            return
        case 'send_money':
            showSendMoneyModal(params.get('recipient') ?? '', params.get('amount') ?? '')
            return
        case 'transaction_info':
            if (params.has('transaction')) {
                const txid = params.get('transaction')
                if (txid) {
                    showTransactionModal(txid)
                    return
                }
            }
            console.log('Missing or invalid transaction for modal "transaction_info".')
            window.location.hash = '#'
            return
        case 'user_info':
            if (params.has('user')) {
                const account = params.get('user')
                if (account) {
                    showAccountModal(account)
                    return
                }
            }
            console.log('Missing or invalid user for modal "user_info".')
            window.location.hash = '#'
            return
        case 'clear_data':
        case 'add_asset_bookmark':
            showModal(modalName)
            return
        case 'transfer_alias':
        case 'sell_alias':
        case 'cancel_alias_sale':
            if (params.has('alias')) {
                const alias = params.get('alias')
                const aliasName = params.get('aliasName') || ''
                const tld = params.get('tld')
                if (alias && tld) {
                    showAliasOperationModal(modalName, alias, aliasName, tld)
                    return
                }
            }
            console.log(`Missing or invalid options for modal "${modalName}".`)
            window.location.hash = '#'
            return
        case 'update_alias':
            if (params.has('alias')) {
                const alias = params.get('alias')
                if (alias) {
                    showUpdateAliasModal(alias)
                    return
                }
            }
            console.log('Missing or invalid alias for modal "update_alias".')
            window.location.hash = '#'
            return
        case 'register_alias':
            showRegisterAliasModal()
            return
        case 'buy_alias':
            if (params.has('alias')) {
                const alias = params.get('alias')
                if (alias) {
                    showBuyAliasModal(alias)
                    return
                }
            }
            console.log('Missing or invalid alias for modal "buy_alias".')
            window.location.hash = '#'
            return
        case 'register_tld':
            showModal('register_tld')
            return
        case 'alias_info':
            if (params.has('alias')) {
                const alias = params.get('alias')
                if (alias) {
                    showAliasInfoModal(alias)
                    return
                }
            }
            console.log('Missing or invalid alias for modal "alias_info".')
            window.location.hash = '#'
            return
        case 'cancel_order':
            if (params.has('order')) {
                const order = params.get('order')
                const type = params.get('type')
                if (order && (type === 'bid' || type === 'ask')) {
                    showCancelOrderModal(order, type)
                    return
                }
            }
            console.log('Missing or invalid parameters for modal "cancel_order".')
            window.location.hash = '#'
            return
        case 'asset_order':
            if (params.has('asset')) {
                const asset = params.get('asset')
                const type = params.get('type')
                if (asset && (type === 'buy' || type === 'sell')) {
                    showAssetOrderModal(asset, type)
                    return
                }
            }
            console.log('Missing or invalid parameters for modal "asset_order".')
            window.location.hash = '#'
            return
        case 'transfer_asset':
            if (params.has('asset')) {
                const assetId = params.get('asset') ?? ''
                const assetName = params.get('name') ?? '?'
                const decimals = params.get('decimals') ?? ''
                showTransferAssetModal(assetId, assetName, decimals)
                return
            }
            showTransferAssetModal('', '?', '')
            return
    }
}

/** Checks if a Number is valid and greater than minimum fee. If not, return minimum fee */
export function checkMinimumFee(value: number): number {
    return isNaN(value) ? BRS.minimumFeeNumber : value < BRS.minimumFeeNumber ? BRS.minimumFeeNumber : value
}
