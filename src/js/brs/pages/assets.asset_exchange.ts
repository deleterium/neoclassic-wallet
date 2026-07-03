import { BRS } from '..'

import { addPagination, goToPage, pageLoaded } from '../core/navigation'

import { sendRequestA } from '../core/send_request'

import { dbPut } from '../core/database'

import {
    formatPriceNQTAsPriceQuantity,
    calculateOrderTotalNQT,
    formatOrderTotal,
    parseQuantityToQNT,
    formatQNTAsQuantity,
    formatNQTAsAmount,
    formatTimestampAsDateTime,
    parsePriceQuantityToPriceNQT,
} from '../core/numbers'

import { getAccountTitleFromObject, getAccountRSFromObject, dataLoadFinished } from '../core/util'

import { closeContextMenu } from '../core/context_menu'

import { cacheAsset, getAssetDetails } from '../tools/assets'

import { AnyAssetOrder, DBAsset, GetAssetResponse, GetTradesResponse, PostResponse } from '../typings'
import { notify } from '../core/notifications'

export function pagesAssetExchange(callback: () => void) {
    if (BRS.currentSubPage) {
        updateMiniTradeHistory()
        return
    }
    $('#asset_details').hide()
    loadAssetExchangeSidebar(callback)
}

export function bookmarkAllUserAssets() {
    // check owned assets, adding all to bookmarks
    const assetsToBookmark: DBAsset[] = []
    const idsToFetchAndBookmark: string[] = []

    if (!BRS.accountInfo.unconfirmedAssetBalances) {
        return
    }
    for (const userAsset of BRS.accountInfo.unconfirmedAssetBalances) {
        const foundAsset = BRS.assets.find((tkn) => tkn.asset === userAsset.asset)
        if (foundAsset) {
            assetsToBookmark.push(foundAsset)
        } else {
            idsToFetchAndBookmark.push(userAsset.asset)
        }
    }
    if (assetsToBookmark.length + idsToFetchAndBookmark.length === 0) {
        return
    }

    for (const eachAsset of idsToFetchAndBookmark) {
        // Not all are cached, so request info about missing.
        sendRequestA('getAsset+', {
            asset: eachAsset,
        }).then((response: GetAssetResponse) => {
            if (!response.errorCode) {
                cacheAsset(response)
            }
        })
    }
    if (idsToFetchAndBookmark.length) {
        // TODO Add translation
        notify('Some assets not bookmarked, because their details are still beeing processing. Try again in 10 seconds!', {
            type: 'danger',
        })
    }
    // Finish with only cached assets.
    saveAssetBookmarks(assetsToBookmark, notifyAndGoToAsset)
}

export async function formsAddAssetBookmark(data: any) {
    data.id = data.id.trim()

    if (!data.id) {
        return {
            error: $.t('error_asset_or_account_id_required'),
        }
    }

    if (!BRS.idRegEx.test(data.id)) {
        return {
            error: $.t('no_asset_found'),
        }
    }
    const foundAsset = await getAssetDetails(data.id)
    if (foundAsset === undefined) {
        return {
            error: $.t('no_asset_found'),
        }
    }
    saveAssetBookmarks([foundAsset], notifyAndGoToAsset)

    return { stop: true, hide: true }
}

function notifyAndGoToAsset(newAssets: DBAsset[], submittedAssets: DBAsset[]) {
    BRS.assetSearch = false
    if (newAssets.length === 0) {
        notify(
            $.t('error_asset_already_bookmarked', {
                count: submittedAssets.length,
            }),
            { type: 'danger' },
        )
        goToAsset(submittedAssets[0].asset)
    } else if (newAssets.length === 1) {
        notify($.t('success_asset_bookmarked'), { type: 'success' })
        goToAsset(newAssets[0].asset)
    } else {
        notify($.t('success_asset_bookmarked_plural'), { type: 'success' })
        goToAsset(newAssets[0].asset)
    }
}

export function saveAssetBookmarks(assets: DBAsset[], callback: (newAssets: DBAsset[], assets: DBAsset[]) => void) {
    const newAssets: DBAsset[] = []

    for (const asset of assets) {
        const foundAsset = BRS.assets.find((Obj) => Obj.asset === asset.asset)
        if (foundAsset) {
            if (foundAsset.bookmarked === false) {
                foundAsset.bookmarked = true
                newAssets.push(foundAsset)
            }
        }
    }
    if (BRS.databaseSupport) {
        dbPut('assets', newAssets)
    }
    if (callback) {
        callback(newAssets, assets)
    }
}

function createBookmarkSidebarHTMLItem(asset: DBAsset, quantityHTML: string) {
    if (quantityHTML === '0') {
        return asset.name + '<br>&nbsp;'
    }
    return `${asset.name}<br><small>${$.t('quantity_abbr')}: ${quantityHTML}</small>`
}

/** It does not redraw, it only updates values */
function updateQuantitiesInAssetExchangeSidebarContent() {
    $('#asset_exchange_vtab  a').each(function () {
        const $eachElement = $(this)
        const assetId = $eachElement.data('asset')
        if (!assetId) {
            return
        }
        getAssetDetails(assetId).then((asset) => {
            if (!asset) {
                return
            }
            const accountAsset = BRS.accountInfo.assetBalances?.find((Obj) => Obj.asset === asset.asset)
            const userAssetQuantity = accountAsset === undefined ? '0' : formatQNTAsQuantity(accountAsset.balanceQNT, asset.decimals)

            $eachElement.html(createBookmarkSidebarHTMLItem(asset, userAssetQuantity))
            if (userAssetQuantity === '0') {
                $eachElement.addClass('not_owns_asset').removeClass('owns_asset')
            } else {
                $eachElement.addClass('owns_asset').removeClass('not_owns_asset')
            }
        })
    })
}

// called on opening the asset exchange page and automatic refresh
export function loadAssetExchangeSidebar(callback?: () => void) {
    const bookmarkedAssets = BRS.assets.filter((token) => token.bookmarked === true)
    let rows = ''

    $('#asset_exchange_page').removeClass('no_assets')

    bookmarkedAssets.sort(function (a, b) {
        // First level: Group name A->Z. No group is last
        // Second level: Asset name A->Z.
        if (!a.groupName && !b.groupName) {
            return a.name.localeCompare(b.name)
        } else if (!a.groupName) {
            return 1
        } else if (!b.groupName) {
            return -1
        } else if (a.groupName > b.groupName) {
            return 1
        } else if (a.groupName < b.groupName) {
            return -1
        } else {
            return a.name.localeCompare(b.name)
        }
    })

    let lastGroup = ''
    let ungrouped = true
    let isClosedGroup = false

    for (const asset of bookmarkedAssets) {
        if (BRS.assetSearch !== false && BRS.assetSearch.indexOf(asset.asset) === -1) {
            continue
        }

        if (asset.groupName !== lastGroup) {
            lastGroup = asset.groupName
            const to_check = asset.groupName ? asset.groupName : 'undefined'
            if (BRS.closedGroups.indexOf(to_check) !== -1) {
                isClosedGroup = true
            } else {
                isClosedGroup = false
            }

            const angleDirection = isClosedGroup ? 'right' : 'down'
            if (asset.groupName) {
                ungrouped = false
                rows += `
                    <a href='#'
                    class='nav-link list-group-item-action'
                    data-context='asset_exchange_vtab_group_context'
                    data-groupname='${asset.groupName.escapeHTML()}'
                    data-closed='${isClosedGroup}'>
                        <strong>
                            ${asset.groupName.escapeHTML()}
                            <i class='right fas pull-right fa-angle-${angleDirection}'></i>
                        </strong>
                    </a>`
            } else {
                ungrouped = true
                rows += `
                    <a href='#' 
                    class='nav-link list-group-item-action no-context' 
                    data-closed='${isClosedGroup}'>
                        <strong class='list-group-item-heading'>
                            ${$.t('ungrouped')}
                            <i class='right fa pull-right fa-angle-${angleDirection}'></i>
                        </strong>
                    </a>`
            }
        }

        const accountAsset = BRS.accountInfo.assetBalances?.find((Obj) => Obj.asset === asset.asset)
        const userAssetQuantity = accountAsset === undefined ? '0' : formatQNTAsQuantity(accountAsset.balanceQNT, asset.decimals)
        let itemClass = 'nav-link list-group-item-'
        itemClass += ungrouped ? 'ungrouped' : 'grouped'
        itemClass += userAssetQuantity === '0' ? ' not_owns_asset' : ' owns_asset'
        const dataGroupname = ungrouped ? '' : ` data-groupname="${asset.groupName.escapeHTML()}"`
        const hideClosedGroup = isClosedGroup ? 'style="display:none"' : ''
        rows += `
            
            <a href='#'
            class='${itemClass}'
            data-asset='${String(asset.asset).escapeHTML()}'
            data-context='asset_exchange_vtab_context'
            ${dataGroupname}
            ${hideClosedGroup}
            data-closed='${isClosedGroup}'>
                ${createBookmarkSidebarHTMLItem(asset, userAssetQuantity)}
            </a>`
    }

    let active = ''
    if ($('#asset_exchange_vtab a.active').length) {
        active = $('#asset_exchange_vtab a.active').data('asset')
    }

    $('#asset_exchange_vtab').html(rows)
    $('#asset_exchange_vtab_search').show()

    if (BRS.assetSearch !== false) {
        if (active && BRS.assetSearch.indexOf(active) !== -1) {
            // check if currently selected asset is in search results, if so keep it at that
            $('#asset_exchange_vtab a[data-asset=' + active + ']').addClass('active')
        } else if (BRS.assetSearch.length === 1) {
            // if there is only 1 search result, click it
            $('#asset_exchange_vtab a[data-asset=' + BRS.assetSearch[0] + ']')
                .addClass('active')
                .trigger('click')
        }
    } else if (active) {
        $('#asset_exchange_vtab a[data-asset=' + active + ']').addClass('active')
    }

    if (BRS.assetSearch !== false || bookmarkedAssets.length >= 10) {
        $('#asset_exchange_vtab_search').show()
    } else {
        $('#asset_exchange_vtab_search').hide()
    }

    if (BRS.assetSearch !== false && BRS.assetSearch.length === 0) {
        $('#no_asset_search_results').show()
        $('#asset_details, #no_asset_selected, #no_assets_available').hide()
    } else if (!bookmarkedAssets.length) {
        $('#no_asset_selected, #loading_asset_data, #no_asset_search_results, #asset_details').hide()
        $('#no_assets_available').show()
    } else if (!$('#asset_exchange_vtab  a.active').length) {
        $('#no_asset_selected').show()
        $('#asset_details, #no_assets_available, #no_asset_search_results').hide()
    } else if (active) {
        $('#no_assets_available, #no_asset_selected, #no_asset_search_results').hide()
    }

    $('#asset_exchange_bookmark_this_asset').hide()

    showHideBookmarkAllAssetsButton()

    pageLoaded(callback)
}

export function incomingAssetExchange() {
    loadAsset(BRS.currentAsset, false, true)
    updateQuantitiesInAssetExchangeSidebarContent()
}

export async function evAssetExchangeSidebarClick(e: JQuery.ClickEvent) {
    const element = e.currentTarget
    e.preventDefault()

    const assetClicked = String($(element).data('asset')).escapeHTML()
    if (assetClicked !== 'undefined') {
        // Only update if clicked on sidebar. Click in "load my orders only
        // refreshes current asset.
        BRS.currentAssetID = assetClicked
    } else {
        // clicked on a group
        if (BRS.databaseSupport) {
            let group = $(element).data('groupname')
            const closed = $(element).data('closed')
            let $links: JQuery<HTMLElement>

            if (!group) {
                $links = $('#asset_exchange_vtab a.list-group-item-ungrouped')
            } else {
                $links = $("#asset_exchange_vtab a.list-group-item-grouped[data-groupname='" + group.escapeHTML() + "']")
            }

            if (!group) {
                group = 'undefined'
            }
            if (closed) {
                const pos = BRS.closedGroups.indexOf(group)
                if (pos >= 0) {
                    BRS.closedGroups.splice(pos)
                }
                $(element).data('closed', '')
                $(element).find('i').removeClass('fa-angle-right').addClass('fa-angle-down')
                $links.show()
            } else {
                BRS.closedGroups.push(group)
                $(element).data('closed', true)
                $(element).find('i').removeClass('fa-angle-down').addClass('fa-angle-right')
                $links.hide()
            }

            dbPut('data', {
                id: 'closed_groups',
                contents: BRS.closedGroups.join('#'),
            })
        }
        return
    }

    const foundAsset = BRS.assets.find((tkn) => tkn.asset === BRS.currentAssetID)
    if (foundAsset) {
        loadAsset(foundAsset, true, true)
    } else {
        const response: GetAssetResponse = await sendRequestA('getAsset+', {
            asset: BRS.currentAssetID,
        })

        if (!response.errorCode && response.asset === BRS.currentAssetID) {
            const addedAsset = cacheAsset(response)
            loadAsset(addedAsset, true, false)
        }
    }
}

function loadAsset(asset: DBAsset, refreshHTML: boolean, refreshAsset: boolean) {
    if (!asset?.asset) {
        return
    }
    const assetId = asset.asset

    BRS.currentSubPage = asset.asset
    BRS.currentAsset = asset

    if (refreshHTML) {
        $('#asset_exchange_vtab a.active').removeClass('active')
        $('#asset_exchange_vtab a[data-asset=' + assetId + ']').addClass('active')

        $('#no_asset_selected, #loading_asset_data, #no_assets_available, #no_asset_search_results').hide()
        $('#asset_details').show().parent().animate(
            {
                scrollTop: 0,
            },
            0,
        )

        $('#asset_account').html(
            "<a href='#' data-user='" +
                getAccountRSFromObject(asset, 'account') +
                "' class='user_info'>" +
                getAccountTitleFromObject(asset, 'account') +
                '</a>',
        )
        $('#asset_id').html(assetId.escapeHTML())
        $('#asset_decimals').html(String(asset.decimals).escapeHTML())
        $('#asset_name').html(String(asset.name).escapeHTML())
        $('#asset_description').html(String(asset.description).escapeHTML())
        $('#asset_quantity').html(formatQNTAsQuantity(asset.quantityCirculatingQNT, asset.decimals))

        $('.asset_name').html(String(asset.name).escapeHTML())
        $('#sell_asset_button').data('asset', assetId)
        $('#buy_asset_button').data('asset', assetId)
        $('#sell_asset_for_burst').html(
            $.t('sell_asset_for_burst', {
                assetName: String(asset.name).escapeHTML(),
                valueSuffix: BRS.valueSuffix,
            }),
        )
        $('#buy_asset_with_burst').html(
            $.t('buy_asset_with_burst', {
                assetName: String(asset.name).escapeHTML(),
                valueSuffix: BRS.valueSuffix,
            }),
        )
        $('#sell_asset_price, #buy_asset_price').val('')
        $('#sell_asset_quantity, #sell_asset_total, #buy_asset_quantity, #buy_asset_total').val('0')

        $('#asset_exchange_ask_orders_table tbody').empty()
        $('#asset_exchange_bid_orders_table tbody').empty()
        $('#asset_exchange_trade_history_table tbody').empty()
        $('#asset_exchange_ask_orders_table').parent().addClass('data-loading').removeClass('data-empty')
        $('#asset_exchange_bid_orders_table').parent().addClass('data-loading').removeClass('data-empty')
        $('#asset_exchange_trade_history_table').parent().addClass('data-loading').removeClass('data-empty')

        $('.data-loading img.loading').hide()

        setTimeout(function () {
            $('.data-loading img.loading').fadeIn(200)
        }, 200)

        let nrDuplicates = 0

        $.each(BRS.assets, function (key, singleAsset) {
            if (String(singleAsset.name) === String(asset.name) && singleAsset.asset !== assetId) {
                nrDuplicates++
            }
        })

        $('#asset_exchange_duplicates_warning').html(
            $.t('asset_exchange_duplicates_warning', {
                count: nrDuplicates,
            }),
        )

        if (asset.bookmarked) {
            $('#asset_exchange_bookmark_this_asset').hide()
        } else {
            $('#asset_exchange_bookmark_this_asset').show()
            $('#asset_exchange_bookmark_this_asset').data('assetId', assetId)
        }
        showHideBookmarkAllAssetsButton()
    }

    if (refreshAsset) {
        sendRequestA('getAsset+', {
            asset: assetId,
        }).then((response: GetAssetResponse) => {
            if (!response.errorCode) {
                cacheAsset(response)
                $('#asset_quantity').html(formatQNTAsQuantity(response.quantityCirculatingQNT, response.decimals))
            } else {
                $('#asset_exchange_vtab a.active').removeClass('active')
                $('#no_asset_selected').show()
                $('#asset_details, #no_assets_available, #no_asset_search_results').hide()
                notify($.t('invalid_asset'), { type: 'danger' })
            }
        })
    }

    let userAssetBlance = '0'
    if (BRS.accountInfo.unconfirmedAssetBalances) {
        for (const balance of BRS.accountInfo.unconfirmedAssetBalances) {
            if (balance.asset !== assetId) {
                continue
            }
            userAssetBlance = balance.unconfirmedBalanceQNT
            break
        }
    }

    $('#your_asset_balance').html(formatQNTAsQuantity(userAssetBlance, BRS.currentAsset.decimals))
    $('#your_burst_balance').html(formatNQTAsAmount(BRS.accountInfo.unconfirmedBalanceNQT))

    window.scrollTo({
        top: 0,
        behavior: 'smooth',
    })

    loadAssetOrders('ask', assetId, refreshHTML || refreshAsset)
    loadAssetOrders('bid', assetId, refreshHTML || refreshAsset)

    updateMiniTradeHistory()
}

function showHideBookmarkAllAssetsButton() {
    if (!BRS.accountInfo.assetBalances) {
        $('#asset_exchange_add_all_assets_bookmark').hide()
        return
    }
    let show = false
    for (const userAsset of BRS.accountInfo.assetBalances) {
        if (BRS.assets.findIndex((tkn) => tkn.asset === userAsset.asset && tkn.bookmarked === true) === -1) {
            show = true
            break
        }
    }
    if (show) $('#asset_exchange_add_all_assets_bookmark').show()
    else $('#asset_exchange_add_all_assets_bookmark').hide()
}

export async function updateMiniTradeHistory() {
    const myTrades = $('#ae_show_my_trades_only').is(':checked')
    const response: GetTradesResponse = await sendRequestA('getTrades+', {
        asset: BRS.currentAsset.asset,
        account: myTrades ? BRS.account : '',
        firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
        lastIndex: BRS.pageSize * BRS.pageNumber,
    })

    if (!response.trades || !response.trades.length) {
        $('#asset_exchange_trade_history_table tbody').empty()
        dataLoadFinished($('#asset_exchange_trade_history_table'), true)
        return
    }
    if (response.trades.length > BRS.pageSize) {
        BRS.hasMorePages = true
        response.trades.pop()
    }
    let rows = ''
    for (const trade of response.trades) {
        const totalNQT = calculateOrderTotalNQT(trade.priceNQT, trade.quantityQNT)
        rows += `
            <tr>
              <td>${formatTimestampAsDateTime(trade.timestamp)}</td>
              <td>${formatQNTAsQuantity(trade.quantityQNT, BRS.currentAsset.decimals)}</td>
              <td class='asset_price'>${formatPriceNQTAsPriceQuantity(trade.priceNQT, BRS.currentAsset.decimals)}</td>
              <td>${formatNQTAsAmount(totalNQT)}</td>
              <td><a href='#' data-transaction='${trade.askOrder}'>${trade.askOrder.slice(0, 8)}...</a></td>
              <td><a href='#' data-transaction='${trade.bidOrder}'>${trade.bidOrder.slice(0, 8)}...</a></td>
            </tr>`
    }
    $('#asset_exchange_trade_history_table tbody').empty().append(rows)
    dataLoadFinished($('#asset_exchange_trade_history_table'), true)
    addPagination()
}

async function loadAssetOrders(type: 'ask' | 'bid', assetId: string, refresh: boolean) {
    const response: any = await sendRequestA('get' + type.capitalize() + 'Orders+', {
        asset: assetId,
        firstIndex: 0,
        lastIndex: 49,
    })

    let orders: AnyAssetOrder[] = []
    if (response[type + 'Orders']) {
        orders = response[type + 'Orders']
    }
    let typeAction = 'buy'
    if (type === 'ask') {
        typeAction = 'sell'
    }

    if (BRS.unconfirmedTransactions.length) {
        let added = false

        for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
            if (
                unconfirmedTransaction.type === 2 &&
                (type === 'ask' ? unconfirmedTransaction.subtype === 2 : unconfirmedTransaction.subtype === 3) &&
                unconfirmedTransaction.attachment.asset === assetId
            ) {
                // transform the current pending transaction into a supposed order.
                // Note: height, name, decimals and price are incorrect!!!
                orders.push({
                    order: unconfirmedTransaction.transaction,
                    asset: unconfirmedTransaction.attachment.asset,
                    account: unconfirmedTransaction.sender,
                    accountRS: unconfirmedTransaction.senderRS,
                    quantityQNT: unconfirmedTransaction.attachment.quantityQNT,
                    priceNQT: unconfirmedTransaction.attachment.priceNQT,
                    height: 0,
                    name: '',
                    decimals: -1,
                    price: '',
                    type: unconfirmedTransaction.subtype === 2 ? 'ask' : 'bid',
                })
                added = true
            }
        }

        if (added) {
            orders.sort(function (a, b) {
                let invert = 1
                if (type === 'bid') {
                    // highest price at the top
                    invert = -1
                }
                const priceA = BigInt(a.priceNQT)
                const priceB = BigInt(b.priceNQT)
                if (priceA > priceB) return 1 * invert
                if (priceA < priceB) return -1 * invert
                return 0
            })
        }
    }

    if (orders.length === 0) {
        $(`#asset_exchange_${type}_orders_table tbody`).empty()
        if (!refresh) {
            $(`#${typeAction}_asset_price`).val('0')
        }
        $(`#${typeAction}_orders_count`).html('')
        dataLoadFinished($(`#asset_exchange_${type}_orders_table`), !refresh)
        return
    }

    $(`#${typeAction}_orders_count`).html('(' + orders.length + (orders.length === 50 ? '+' : '') + ')')

    let rows = ''
    let first = true
    for (const order of orders) {
        const totalNQT = calculateOrderTotalNQT(order.quantityQNT, order.priceNQT)

        if (first && !refresh) {
            $(`#${typeAction}_asset_price`).val(formatPriceNQTAsPriceQuantity(order.priceNQT, BRS.currentAsset.decimals))
        }

        const toBeCancelled = hasCancelOrder(order)
        let className = ''
        if (order.account === BRS.account) {
            className += 'your-order'
        }
        if (order.height === 0) {
            className += ' text-muted'
        }
        if (toBeCancelled) {
            className += ' text-line-through'
        }

        let accountHTML = ''
        if (order.height === 0 || toBeCancelled) {
            accountHTML = BRS.pendingTransactionHTML + '&nbsp;'
        }
        if (order.account === BRS.currentAsset.account) {
            accountHTML += $.t('asset_issuer')
        } else {
            accountHTML += getAccountTitleFromObject(order, 'account')
        }
        accountHTML = `<a href='#' data-user='${getAccountRSFromObject(order, 'account')}' class='user_info'>${accountHTML}</a>`

        rows += `
            <tr class='${className}'
              data-transaction='${order.order}'
              data-quantity='${order.quantityQNT.toString()}'
              data-price='${order.priceNQT.toString()}'>`
        if (type === 'ask') {
            rows += `
              <td class='bold red-asset'>${formatPriceNQTAsPriceQuantity(order.priceNQT, BRS.currentAsset.decimals)}</td>
              <td>${formatQNTAsQuantity(order.quantityQNT, BRS.currentAsset.decimals)}</td>
              <td>${formatNQTAsAmount(totalNQT)}</td>
              <td>${accountHTML}</td>
            </tr>`
        } else {
            rows += `
              <td>${accountHTML}</td>
              <td>${formatNQTAsAmount(totalNQT)}</td>
              <td>${formatQNTAsQuantity(order.quantityQNT, BRS.currentAsset.decimals)}</td>
              <td class='bold green-asset'>${formatPriceNQTAsPriceQuantity(order.priceNQT, BRS.currentAsset.decimals)}</td>
            </tr>`
        }
        first = false
    }

    $(`#asset_exchange_${type}_orders_table tbody`).html(rows)
    dataLoadFinished($(`#asset_exchange_${type}_orders_table`), !refresh)
}

function hasCancelOrder(order: AnyAssetOrder) {
    if (!BRS.unconfirmedTransactions.length) {
        return false
    }
    for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
        if (
            unconfirmedTransaction.type === 2 &&
            (order.type === 'ask' ? unconfirmedTransaction.subtype === 4 : unconfirmedTransaction.subtype === 5) &&
            unconfirmedTransaction.attachment.order === order.order
        ) {
            return true
        }
    }
    return false
}

export function evAssetExchangeSearchInput(e: JQuery.TriggeredEvent) {
    let input: string = $(e.target).val()
    input = input.toUpperCase()

    if (!input) {
        BRS.assetSearch = false
        loadAssetExchangeSidebar()
        $('#asset_exchange_clear_search').hide()
        return
    }

    BRS.assetSearch = []
    for (const asset of BRS.assets) {
        if (
            asset.bookmarked === true &&
            (asset.account === input ||
                asset.asset === input ||
                asset.name.toUpperCase().includes(input) ||
                asset.accountRS.includes(input))
        ) {
            BRS.assetSearch.push(asset.asset)
        }
    }

    loadAssetExchangeSidebar()
    $('#asset_exchange_clear_search').show()
}

export function evAssetExchangeOrdersTableClick(e: JQuery.ClickEvent) {
    const $target = $(e.target)
    if ($target.prop('tagName').toLowerCase() === 'a') {
        return
    }

    const type = $target.closest('table').attr('id') === 'asset_exchange_bid_orders_table' ? 'sell' : 'buy'

    const $tr = $target.closest('tr')

    const priceNQT = String($tr.data('price'))
    const quantityQNT = String($tr.data('quantity'))
    const totalNQT = calculateOrderTotalNQT(quantityQNT, priceNQT)

    $('#' + type + '_asset_price').val(formatPriceNQTAsPriceQuantity(priceNQT, BRS.currentAsset.decimals))
    $('#' + type + '_asset_quantity').val(formatQNTAsQuantity(quantityQNT, BRS.currentAsset.decimals))
    $('#' + type + '_asset_total').val(formatNQTAsAmount(totalNQT))

    if (type === 'sell') {
        const balanceNQT = BRS.accountInfo.unconfirmedBalanceNQT ?? '0'

        if (BigInt(totalNQT) > BigInt(balanceNQT)) {
            $('#' + type + '_asset_total').css({
                background: '#ED4348',
                color: 'white',
            })
        } else {
            $('#' + type + '_asset_total').css({
                background: '',
                color: '',
            })
        }
    }

    const box = $('#' + type + '_asset_box')

    if (box.hasClass('collapsed-card')) {
        box.removeClass('collapsed-card')
        box.find('.card-body').slideDown()
    }
}

export function evCalculatePricePreviewInput(e: JQuery.TriggeredEvent) {
    const orderType = $(e.target).data('type').toLowerCase()
    $('#' + orderType + '_asset_total').val($.t('error'))
    let quantityQNT: string
    let priceNQT: string
    try {
        quantityQNT = parseQuantityToQNT(String($('#' + orderType + '_asset_quantity').val()), BRS.currentAsset.decimals)
    } catch (e) {
        $('#' + orderType + '_asset_quantity').addClass('is-invalid')
        notify((e as Error).message)
        return
    }
    try {
        priceNQT = parsePriceQuantityToPriceNQT($('#' + orderType + '_asset_price').val(), BRS.currentAsset.decimals)
    } catch (e) {
        $('#' + orderType + '_asset_price').addClass('is-invalid')
        notify((e as Error).message)
        return
    }
    const total = formatOrderTotal(quantityQNT, priceNQT)
    $('#' + orderType + '_asset_total').val(total.toString())
}

export function formsOrderAssetComplete(response: PostResponse, data: any) {
    let $table: JQuery<HTMLElement>
    if (data.requestType === 'placeBidOrder') {
        $table = $('#asset_exchange_bid_orders_table tbody')
    } else {
        $table = $('#asset_exchange_ask_orders_table tbody')
    }

    if ($table.find(`tr[data-transaction='${response.transaction}']`).length) {
        return
    }

    const $rows = $table.find('tr')

    const totalNQT = calculateOrderTotalNQT(data.quantityQNT, data.priceNQT)

    let rowToAdd = `
        <tr class='tentative'
          data-transaction='${response.transaction}'
          data-quantity='${data.quantityQNT.toString()}'
          data-price='${data.priceNQT.toString()}'>`
    if (data.requestType === 'placeBidOrder') {
        rowToAdd += `
          <td>${BRS.pendingTransactionHTML} <strong>${$.t('you')}</strong></td>
          <td>${formatNQTAsAmount(totalNQT)}</td>
          <td>${formatQNTAsQuantity(data.quantityQNT, BRS.currentAsset.decimals)}</td>
          <td>${formatPriceNQTAsPriceQuantity(data.priceNQT, BRS.currentAsset.decimals)}</td>
        </tr>`
    } else {
        rowToAdd += `
          <td>${formatPriceNQTAsPriceQuantity(data.priceNQT, BRS.currentAsset.decimals)}</td>
          <td>${formatQNTAsQuantity(data.quantityQNT, BRS.currentAsset.decimals)}</td>
          <td>${formatNQTAsAmount(totalNQT)}</td>
          <td>${BRS.pendingTransactionHTML} <strong>${$.t('you')}</strong></td>
        </tr>`
    }

    let rowAdded = false

    if ($rows.length) {
        $rows.each(function () {
            const rowPrice = BigInt($(this).data('price'))

            if (data.requestType === 'placeBidOrder' && BigInt(data.priceNQT) > rowPrice) {
                $(this).before(rowToAdd)
                rowAdded = true
                return false
            } else if (data.requestType === 'placeAskOrder' && BigInt(data.priceNQT) < rowPrice) {
                $(this).before(rowToAdd)
                rowAdded = true
                return false
            }
        })
    }

    if (!rowAdded) {
        $table.append(rowToAdd)
        $table.parent().parent().removeClass('data-empty').parent().addClass('no-padding')
    }
}

export function evAssetExchangeSidebarContextClick(e: JQuery.ClickEvent) {
    e.preventDefault()

    if (!BRS.selectedContext) return

    const assetId = BRS.selectedContext.data('asset')
    const option = $(e.target).data('option')

    closeContextMenu()

    const asset = BRS.assets.find((tkn) => tkn.asset === assetId)
    if (!asset) {
        console.error('OPA!')
        return
    }

    if (option === 'add_to_group') {
        $('#asset_exchange_group_asset').val(assetId)
        $('#asset_exchange_group_title').html(String(asset.name).escapeHTML())

        const groupNames = [...new Set(BRS.assets.filter((tkn) => tkn.groupName).map((tkn) => tkn.groupName))]
        groupNames.sort((a, b) => a.localeCompare(b))

        const groupSelect = $('#asset_exchange_group_group')
        groupSelect.empty()

        groupNames.forEach((groupName) => {
            groupSelect.append(
                `<option value='${groupName.escapeHTML()}' ${asset.groupName === groupName ? " selected='selected'" : ''}>${groupName.escapeHTML()}</option>`,
            )
        })

        groupSelect.append("<option value='0'" + (!asset.groupName ? " selected='selected'" : '') + '></option>')
        groupSelect.append(`<option value='-1'>${$.t('new_group')}</option>`)

        $('#asset_exchange_group_modal').modal('show')
    } else if (option === 'remove_from_group') {
        asset.groupName = ''
        dbPut('assets', asset, function (error) {
            if (error) {
                notify($.t('error_save_db'), { type: 'danger' })
                return
            }
            loadAssetExchangeSidebar()
            notify($.t('success_asset_group_removal'), { type: 'success' })
        })
    } else if (option === 'remove_from_bookmarks') {
        asset.bookmarked = false
        dbPut('assets', asset, function (error) {
            if (error) {
                notify($.t('error_save_db'), { type: 'danger' })
                return
            }
            loadAssetExchangeSidebar()
            notify($.t('success_asset_bookmark_removal'), { type: 'success' })
        })
    }
}

export async function goToAsset(asset: string) {
    if (BRS.currentPage !== 'asset_exchange') {
        goToPage('asset_exchange')
    }

    BRS.assetSearch = false
    $('#asset_exchange_vtab_search input[name=q]').val('')
    $('#asset_exchange_clear_search').hide()

    $('#asset_exchange_vtab a.list-group-item.active').removeClass('active')
    $('#no_asset_selected, #asset_details, #no_assets_available, #no_asset_search_results').hide()
    $('#loading_asset_data').show()

    const foundAsset = BRS.assets.find((tkn) => tkn.asset === asset)
    if (foundAsset) {
        loadAssetExchangeSidebar(function () {
            loadAsset(foundAsset, true, true)
        })
        return
    }
    const response: GetAssetResponse = await sendRequestA('getAsset+', {
        asset,
    })
    if (!response.errorCode) {
        const addedAsset = cacheAsset(response)
        loadAssetExchangeSidebar(function () {
            loadAsset(addedAsset, true, false)
        })
        return
    }
    notify($.t('error_asset_not_found'), { type: 'danger' })
    loadAssetExchangeSidebar()
    $('#loading_asset_data').hide()
}
