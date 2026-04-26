/**
 * @depends {brs.js}
 */

/* global BigInteger */

import { BRS } from '.'

import {
    reloadCurrentPage,
    goToPage,
    pageLoaded
} from './brs'

import {
    sendRequest
} from './brs.server'

import {
    dbGet,
    dbPut
} from './brs.database'

import {
    formatOrderPricePerWholeQNT,
    calculateOrderPricePerWholeQNT,
    calculatePricePerWholeQNT,
    calculateOrderTotalNQT,
    calculateOrderTotal,
    convertToNXT,
    convertToNQT,
    convertToQNTf,
    convertToQNT,
    formatQuantity,
    formatAmount,
    formatTimestamp,
    getAccountTitle,
    getAccountFormatted,
    dataLoaded,
    dataLoadFinished,
    getSelectedText,
    hasTransactionUpdates,
    getTranslatedFieldName
} from './brs.util'

import {
    closeContextMenu
} from './brs.sidebar'

export function loadClosedGroupsFromDB () {
    if (!BRS.databaseSupport) return

    dbGet('data', { id: 'closed_groups' }, function (error, result) {
        if (error) {
            console.error('Error loading closed groups:', error)
            return
        }
        // If no data exists, insert a default record
        if (!result) {
            dbPut('data', { id: 'closed_groups', contents: '' }, function (error) {
                if (error) console.error('Error initializing closed groups:', error)
            })
            return
        }
        BRS.closedGroups = result.contents.split('#')
    })
}

export function pagesAssetExchange (callback) {
    $('.content.content-stretch:visible').width($('.page:visible').width())

    loadAssetExchangeSidebar(callback)
}

export function loadAssetsFromDB () {
    if (!BRS.databaseSupport) return

    dbGet('assets', function (error, assets) {
        if (error === null) {
            BRS.assets = assets
        }
    })
}

function notifyErrorSaveAsset () {
    $.notify($.t('error_assets_save_db'), { type: 'danger' })
}

export function saveCachedAssets () {
    if (!BRS.databaseSupport) return

    const assetsToUpdate = []
    dbGet('assets', function (error, dbAssets) {
        if (error) {
            notifyErrorSaveAsset()
            return
        }
        for (const cachedAsset of BRS.assets) {
            const dbAsset = dbAssets.find(asset => asset.asset === cachedAsset.asset)
            if (!dbAsset) {
                assetsToUpdate.push(cachedAsset)
                continue
            }
            if (
                dbAsset.quantityCirculatingQNT !== cachedAsset.quantityCirculatingQNT ||
                dbAsset.bookmarked !== cachedAsset.bookmarked ||
                dbAsset.groupName !== cachedAsset.groupName
            ) {
                assetsToUpdate.push(cachedAsset)
            }
        }

        if (assetsToUpdate.length === 0) return

        dbPut('assets', assetsToUpdate, function (error) {
            if (error) {
                notifyErrorSaveAsset()
            }
        })
    })
}

/** Try to fetch details from cache. If not found, send a sync request.
 * @param assetId {String}
 * @returns {assetDetails}
 * @error returns undefined
 */
export function getAssetDetails (assetId) {
    const async = false
    const asset = BRS.assets.find((tkn) => tkn.asset === assetId)
    if (asset) return asset
    sendRequest('getAsset', {
        asset: assetId
    }, function (response) {
        if (!response.errorCode) {
            cacheAsset(response)
        }
    }, async)
    return BRS.assets.find((tkn) => tkn.asset === assetId)
}

export function cacheUserAssets () {
    if (BRS.accountInfo.assetBalances === undefined) {
        return
    }
    BRS.accountInfo.assetBalances.forEach(userAssetTuple => {
        const foundAsset = BRS.assets.find((tkn) => tkn.asset === userAssetTuple.asset)
        if (!foundAsset) {
            sendRequest('getAsset', {
                asset: userAssetTuple.asset
            }, function (response) {
                if (!response.errorCode) {
                    cacheAsset(response)
                }
            })
        }
    })
}

export function sortCachedAssets () {
    // sort by name ignoring case
    BRS.assets.sort((a, b) => {
        const nameA = a.name.toUpperCase()
        const nameB = b.name.toUpperCase()
        if (nameA < nameB) return -1
        if (nameA > nameB) return 1
        return 0
    })
}

export function bookmarkAllUserAssets () {
    // check owned assets, adding all to bookmarks
    const assetsToBookmark = []
    const idsToFetchAndBookmark = []

    if (!BRS.accountInfo.unconfirmedAssetBalances) {
        return
    }
    for (const userAsset of BRS.accountInfo.unconfirmedAssetBalances) {
        const foundAsset = BRS.assets.find(tkn => tkn.asset === userAsset.asset)
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
        sendRequest('getAsset+', {
            asset: eachAsset
        }, function (response) {
            if (!response.errorCode) {
                cacheAsset(response)
            }
        })
    }
    if (idsToFetchAndBookmark.length) {
        // TODO Add translation
        $.notify('Some assets not bookmarked, because their details are still beeing processing. Try again in 10 seconds!', { type: 'danger' })
    }
    // Finish with only cached assets.
    saveAssetBookmarks(assetsToBookmark, formsAddAssetBookmarkComplete)
}

/**
 * Stores or updates an asset in memory based on server response.
 * If the asset already exists in the cache, it updates its quantity and circulating quantity.
 * Otherwise, it inserts a new asset into the cache with default options.
 *
 * @param {Object} asset - The asset object from the server response.
 */
function cacheAsset (asset) {
    const foundAsset = BRS.assets.find((tkn) => tkn.asset === asset.asset)
    if (foundAsset) {
        // update info
        foundAsset.quantityQNT = String(asset.quantityQNT)
        foundAsset.quantityCirculatingQNT = String(asset.quantityCirculatingQNT)
        return foundAsset
    }

    // insert new asset
    asset = {
        asset: String(asset.asset),
        name: String(asset.name),
        description: String(asset.description),
        groupName: '',
        account: String(asset.account),
        accountRS: String(asset.accountRS),
        quantityQNT: String(asset.quantityQNT),
        quantityCirculatingQNT: String(asset.quantityCirculatingQNT),
        decimals: parseInt(asset.decimals, 10),
        bookmarked: false
    }

    BRS.assets.push(asset)
}

export function formsAddAssetBookmark (data) {
    data.id = $.trim(data.id)

    if (!data.id) {
        return {
            error: $.t('error_asset_or_account_id_required')
        }
    }

    if (!BRS.idRegEx.test(data.id)) {
        return {
            error: $.t('no_asset_found')
        }
    }
    const foundAsset = getAssetDetails(data.id)
    if (foundAsset === undefined) {
        return {
            error: $.t('no_asset_found')
        }
    }
    saveAssetBookmarks([foundAsset], formsAddAssetBookmarkComplete)

    return { stop: true, hide: true }
}

function formsAddAssetBookmarkComplete (newAssets, submittedAssets) {
    BRS.assetSearch = false
    if (newAssets.length === 0) {
        $.notify($.t('error_asset_already_bookmarked', {
            count: submittedAssets.length
        }), { type: 'danger' })
        goToAsset(submittedAssets[0].asset)
    } else if (newAssets.length === 1) {
        $.notify($.t('success_asset_bookmarked'), { type: 'success' })
        goToAsset(newAssets[0].asset)
    } else {
        $.notify($.t('success_asset_bookmarked_plural'), { type: 'success' })
        goToAsset(newAssets[0].asset)
    }
}

export function saveAssetBookmarks (assets, callback) {
    const newAssets = []

    for (const asset of assets) {
        const foundAsset = BRS.assets.find(Obj => Obj.asset === asset.asset)
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

function createBookmarkSidebarHTMLItem (asset, quantityHTML) {
    return `${asset.name}<br>
            <small>${$.t('quantity_abbr')}: ${quantityHTML}</small>`
}

/** It does not redraw, it only updates values */
function updateQuantitiesInAssetExchangeSidebarContent () {
    $('#asset_exchange_sidebar_content a').each(function () {
        const assetId = $(this).data('asset')
        if (!assetId) {
            return
        }
        const asset = getAssetDetails(assetId)
        if (!asset) {
            return
        }
        const accountAsset = BRS.accountInfo.assetBalances?.find((Obj) => Obj.asset === asset.asset)
        const userAssetQuantity = accountAsset === undefined ? '0' : formatQuantity(accountAsset.balanceQNT, asset.decimals)

        $(this).html(createBookmarkSidebarHTMLItem(asset, userAssetQuantity))
        if (userAssetQuantity === '0') {
            $(this).addClass('not_owns_asset').removeClass('owns_asset')
        } else {
            $(this).addClass('owns_asset').removeClass('not_owns_asset')
        }
    })
}

// called on opening the asset exchange page and automatic refresh
function loadAssetExchangeSidebar (callback) {
    const bookmarkedAssets = BRS.assets.filter(token => token.bookmarked === true)
    let rows = ''

    $('#asset_exchange_page').removeClass('no_assets')

    bookmarkedAssets.sort(function (a, b) {
        if (!a.groupName && !b.groupName) {
            if (a.name > b.name) {
                return 1
            } else if (a.name < b.name) {
                return -1
            } else {
                return 0
            }
        } else if (!a.groupName) {
            return 1
        } else if (!b.groupName) {
            return -1
        } else if (a.groupName > b.groupName) {
            return 1
        } else if (a.groupName < b.groupName) {
            return -1
        } else {
            if (a.name > b.name) {
                return 1
            } else if (a.name < b.name) {
                return -1
            } else {
                return 0
            }
        }
    })

    let lastGroup = ''
    let ungrouped = true
    let isClosedGroup = false

    const isSearch = BRS.assetSearch !== false
    // let searchResults = 0

    for (const asset of bookmarkedAssets) {
        if (isSearch) {
            if (BRS.assetSearch.indexOf(asset.asset) === -1) {
                continue
            // } else {
            //     searchResults++
            }
        }

        if (asset.groupName !== lastGroup) {
            const to_check = (asset.groupName ? asset.groupName : 'undefined')

            if (BRS.closedGroups.indexOf(to_check) !== -1) {
                isClosedGroup = true
            } else {
                isClosedGroup = false
            }

            if (asset.groupName) {
                ungrouped = false
                rows += "<a href='#' class='list-group-item list-group-item-action" + (asset.groupName === 'Ignore List' ? ' no-context' : '') + "'" + (asset.groupName !== 'Ignore List' ? " data-context='asset_exchange_sidebar_group_context' " : "data-context=''") + " data-groupname='" + asset.groupName.escapeHTML() + "' data-closed='" + isClosedGroup + "'><strong>" + asset.groupName.escapeHTML() + "<i class='right fas pull-right fa-angle-" + (isClosedGroup ? 'right' : 'down') + "'></i></strong></a>"
            } else {
                ungrouped = true
                rows += "<a href='#' class='list-group-item list-group-item-action no-context' data-closed='" + isClosedGroup + "'><strong class='list-group-item-heading'>" + $.t('ungrouped') + "<i class='right fa pull-right fa-angle-" + (isClosedGroup ? 'right' : 'down') + "'></i></strong></a>"
            }

            lastGroup = asset.groupName
        }

        const accountAsset = BRS.accountInfo.assetBalances?.find((Obj) => Obj.asset === asset.asset)
        const userAssetQuantity = accountAsset === undefined ? '0' : formatQuantity(accountAsset.balanceQNT, asset.decimals)
        rows += "<a href='#' class='list-group-item list-group-item-" +
                (ungrouped ? 'ungrouped' : 'grouped') +
                (userAssetQuantity === '0' ? ' not_owns_asset' : ' owns_asset') +
                "' data-asset='" + String(asset.asset).escapeHTML() + "'" +
                (!ungrouped ? " data-groupname='" + asset.groupName.escapeHTML() + "'" : '') +
                (isClosedGroup ? " style='display:none'" : '') +
                " data-closed='" + isClosedGroup +
                "'>"
        rows += createBookmarkSidebarHTMLItem(asset, userAssetQuantity)
        rows += '</a>'
    }

    let active = $('#asset_exchange_sidebar a.active')

    if (active.length) {
        active = active.data('asset')
    } else {
        active = false
    }

    $('#asset_exchange_sidebar_content').empty().append(rows)
    $('#asset_exchange_sidebar_search').show()

    if (isSearch) {
        if (active && BRS.assetSearch.indexOf(active) !== -1) {
            // check if currently selected asset is in search results, if so keep it at that
            $('#asset_exchange_sidebar a[data-asset=' + active + ']').addClass('active')
        } else if (BRS.assetSearch.length === 1) {
            // if there is only 1 search result, click it
            $('#asset_exchange_sidebar a[data-asset=' + BRS.assetSearch[0] + ']').addClass('active').trigger('click')
        }
    } else if (active) {
        $('#asset_exchange_sidebar a[data-asset=' + active + ']').addClass('active')
    }

    if (isSearch || bookmarkedAssets.length >= 10) {
        $('#asset_exchange_sidebar_search').show()
    } else {
        $('#asset_exchange_sidebar_search').hide()
    }

    if (isSearch && BRS.assetSearch.length === 0) {
        $('#no_asset_search_results').show()
        $('#asset_details, #no_asset_selected, #no_assets_available').hide()
    } else if (!bookmarkedAssets.length) {
        $('#no_asset_selected, #loading_asset_data, #no_asset_search_results, #asset_details').hide()
        $('#no_assets_available').show()
    } else if (!$('#asset_exchange_sidebar a.active').length) {
        $('#no_asset_selected').show()
        $('#asset_details, #no_assets_available, #no_asset_search_results').hide()
    } else if (active) {
        $('#no_assets_available, #no_asset_selected, #no_asset_search_results').hide()
    }

    $('#asset_exchange_bookmark_this_asset').hide()

    showHideBookmarkAllAssetsButton()

    pageLoaded(callback)
}

export function incomingAssetExchange () {
    loadAsset(BRS.currentAsset, false, true)
    updateQuantitiesInAssetExchangeSidebarContent()
}

export function evAssetExchangeSidebarClick (e, data) {
    e.preventDefault()

    const assetClicked = String($(this).data('asset')).escapeHTML()
    if (assetClicked !== 'undefined') {
        // Only update if clicked on sidebar. Click in "load my orders only
        // refreshes current asset.
        BRS.currentAssetID = assetClicked
    } else {
        // clicked on a group
        if (BRS.databaseSupport) {
            let group = $(this).data('groupname')
            const closed = $(this).data('closed')
            let $links

            if (!group) {
                $links = $('#asset_exchange_sidebar a.list-group-item-ungrouped')
            } else {
                $links = $("#asset_exchange_sidebar a.list-group-item-grouped[data-groupname='" + group.escapeHTML() + "']")
            }

            if (!group) {
                group = 'undefined'
            }
            if (closed) {
                const pos = BRS.closedGroups.indexOf(group)
                if (pos >= 0) {
                    BRS.closedGroups.splice(pos)
                }
                $(this).data('closed', '')
                $(this).find('i').removeClass('fa-angle-right').addClass('fa-angle-down')
                $links.show()
            } else {
                BRS.closedGroups.push(group)
                $(this).data('closed', true)
                $(this).find('i').removeClass('fa-angle-down').addClass('fa-angle-right')
                $links.hide()
            }

            dbPut('data', {
                id: 'closed_groups',
                contents: BRS.closedGroups.join('#')
            })
        }
        return
    }

    const foundAsset = BRS.assets.find((tkn) => tkn.asset === BRS.currentAssetID)
    if (foundAsset) {
        loadAsset(foundAsset, true, true)
    } else {
        sendRequest('getAsset+', {
            asset: BRS.currentAssetID
        }, function (response) {
            if (!response.errorCode && response.asset === BRS.currentAssetID) {
                loadAsset(response, true, false)
            }
        })
    }
}

function loadAsset (asset, refreshHTML, refreshAsset) {
    if (!asset?.asset) {
        return
    }
    const assetId = asset.asset

    BRS.currentAsset = asset

    if (refreshHTML) {
        $('#asset_exchange_sidebar a.active').removeClass('active')
        $('#asset_exchange_sidebar a[data-asset=' + assetId + ']').addClass('active')

        $('#no_asset_selected, #loading_asset_data, #no_assets_available, #no_asset_search_results').hide()
        $('#asset_details').show().parent().animate({
            scrollTop: 0
        }, 0)

        $('#asset_account').html("<a href='#' data-user='" + getAccountFormatted(asset, 'account') + "' class='user_info'>" + getAccountTitle(asset, 'account') + '</a>')
        $('#asset_id').html(assetId.escapeHTML())
        $('#asset_decimals').html(String(asset.decimals).escapeHTML())
        $('#asset_name').html(String(asset.name).escapeHTML())
        $('#asset_description').html(String(asset.description).escapeHTML())
        $('#asset_quantity').html(formatQuantity(asset.quantityCirculatingQNT, asset.decimals))

        $('.asset_name').html(String(asset.name).escapeHTML())
        $('#sell_asset_button').data('asset', assetId)
        $('#buy_asset_button').data('asset', assetId)
        $('#sell_asset_for_burst').html($.t('sell_asset_for_burst', {
            assetName: String(asset.name).escapeHTML(),
            valueSuffix: BRS.valueSuffix
        }))
        $('#buy_asset_with_burst').html($.t('buy_asset_with_burst', {
            assetName: String(asset.name).escapeHTML(),
            valueSuffix: BRS.valueSuffix
        }))
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

        $('#asset_exchange_duplicates_warning').html($.t('asset_exchange_duplicates_warning', {
            count: nrDuplicates
        }))

        if (asset.bookmarked) {
            $('#asset_exchange_bookmark_this_asset').hide()
        } else {
            $('#asset_exchange_bookmark_this_asset').show()
            $('#asset_exchange_bookmark_this_asset').data('assetId', assetId)
        }
        showHideBookmarkAllAssetsButton()
    }

    if (refreshAsset) {
        sendRequest('getAsset', {
            asset: assetId
        }, function (response) {
            if (!response.errorCode) {
                cacheAsset(response)
                $('#asset_quantity').html(formatQuantity(response.quantityCirculatingQNT, response.decimals))
            } else {
                $('#asset_exchange_sidebar a.active').removeClass('active')
                $('#no_asset_selected').show()
                $('#asset_details, #no_assets_available, #no_asset_search_results').hide()
                $.notify($.t('invalid_asset'), { type: 'danger' })
            }
        })
    }

    if (BRS.accountInfo.unconfirmedBalanceNQT === '0') {
        $('#your_burst_balance').html('0')
        $('#buy_automatic_price').addClass('zero').removeClass('nonzero')
    } else {
        $('#your_burst_balance').html(formatAmount(BRS.accountInfo.unconfirmedBalanceNQT))
        $('#buy_automatic_price').addClass('nonzero').removeClass('zero')
    }

    if (BRS.accountInfo.unconfirmedAssetBalances) {
        for (let i = 0; i < BRS.accountInfo.unconfirmedAssetBalances.length; i++) {
            const balance = BRS.accountInfo.unconfirmedAssetBalances[i]

            if (balance.asset === assetId) {
                BRS.currentAsset.yourBalanceNQT = balance.unconfirmedBalanceQNT
                $('#your_asset_balance').html(formatQuantity(balance.unconfirmedBalanceQNT, BRS.currentAsset.decimals))
                if (balance.unconfirmedBalanceQNT === '0') {
                    $('#sell_automatic_price').addClass('zero').removeClass('nonzero')
                } else {
                    $('#sell_automatic_price').addClass('nonzero').removeClass('zero')
                }
                break
            }
        }
    }

    if (!BRS.currentAsset.yourBalanceNQT) {
        BRS.currentAsset.yourBalanceNQT = '0'
        $('#your_asset_balance').html('0')
    }

    loadAssetOrders('ask', assetId, refreshHTML | refreshAsset)
    loadAssetOrders('bid', assetId, refreshHTML | refreshAsset)

    updateMiniTradeHistory()
}

function showHideBookmarkAllAssetsButton () {
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

export function updateMiniTradeHistory () {
    // todo BRS.currentSubPageID ??...
    sendRequest('getTrades+', {
        asset: BRS.currentAsset.asset,
        account: ($('#ae_show_my_trades_only').is(':checked')) ? BRS.account : '',
        firstIndex: 0,
        lastIndex: 49
    }, function (response, input) {
        if (response.trades && response.trades.length) {
            let rows = ''
            for (const trade of response.trades) {
                trade.priceNQT = new BigInteger(trade.priceNQT)
                trade.quantityQNT = new BigInteger(trade.quantityQNT)
                trade.totalNQT = new BigInteger(calculateOrderTotalNQT(trade.priceNQT, trade.quantityQNT))
                rows += '<tr>'
                rows += '<td>' + formatTimestamp(trade.timestamp) + '</td>'
                rows += '<td>' + formatQuantity(trade.quantityQNT, BRS.currentAsset.decimals) + '</td>'
                rows += "<td class='asset_price'>" + formatOrderPricePerWholeQNT(trade.priceNQT, BRS.currentAsset.decimals) + '</td>'
                rows += '<td>' + formatAmount(trade.totalNQT) + '</td>'
                rows += "<td><a href='#' data-transaction='" + trade.askOrder + "'>" + trade.askOrder.slice(0, 8) + '...</a></td>'
                rows += "<td><a href='#' data-transaction='" + String(trade.bidOrder).escapeHTML() + "'>" + trade.bidOrder.slice(0, 8) + '...</a></td>'
                rows += '</tr>'
            }
            $('#asset_exchange_trade_history_table tbody').empty().append(rows)
            dataLoadFinished($('#asset_exchange_trade_history_table'), true)
        } else {
            $('#asset_exchange_trade_history_table tbody').empty()
            dataLoadFinished($('#asset_exchange_trade_history_table'), true)
        }
    })
}

function loadAssetOrders (type, assetId, refresh) {
    type = type.toLowerCase()

    sendRequest('get' + type.capitalize() + 'Orders+', {
        asset: assetId,
        firstIndex: 0,
        lastIndex: 49
    }, function (response, input) {
        let orders = response[type + 'Orders']
        let i
        if (!orders) {
            orders = []
        }
        let typeAction = 'buy'
        if (type === 'ask') {
            typeAction = 'sell'
        }

        if (BRS.unconfirmedTransactions.length) {
            let added = false

            for (i = 0; i < BRS.unconfirmedTransactions.length; i++) {
                const unconfirmedTransaction = BRS.unconfirmedTransactions[i]
                unconfirmedTransaction.order = unconfirmedTransaction.transaction

                if (unconfirmedTransaction.type === 2 && (type === 'ask' ? unconfirmedTransaction.subtype === 2 : unconfirmedTransaction.subtype === 3) && unconfirmedTransaction.asset === assetId) {
                    orders.push($.extend(true, {}, unconfirmedTransaction)) // make sure it's a deep copy
                    added = true
                }
            }

            if (added) {
                orders.sort(function (a, b) {
                    if (type === 'ask') {
                        // lowest price at the top
                        return new BigInteger(a.priceNQT).compareTo(new BigInteger(b.priceNQT))
                    } else {
                        // highest price at the top
                        return new BigInteger(b.priceNQT).compareTo(new BigInteger(a.priceNQT))
                    }
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
            order.priceNQT = new BigInteger(order.priceNQT)
            order.quantityQNT = new BigInteger(order.quantityQNT)
            order.totalNQT = new BigInteger(calculateOrderTotalNQT(order.quantityQNT, order.priceNQT))

            if (first && !refresh) {
                $(`#${typeAction}_asset_price`).val(calculateOrderPricePerWholeQNT(order.priceNQT, BRS.currentAsset.decimals))
            }

            const className = (order.account === BRS.account ? 'your-order' : '') + (order.unconfirmed ? ' tentative' : (isUserCancelledOrder(order) ? ' tentative tentative-crossed' : ''))

            let accountHTML = ''
            if (order.unconfirmed) {
                accountHTML = `${BRS.pendingTransactionHTML} <strong>${$.t('you')}</strong>`
            } else if (order.account === BRS.account) {
                accountHTML = `<strong>${$.t('you')}</strong>`
            } else {
                accountHTML = "<a href='#' data-user='" + getAccountFormatted(order, 'account') + "' class='user_info'>"
                if (order.account === BRS.currentAsset.account) {
                    accountHTML += $.t('asset_issuer')
                } else {
                    accountHTML += getAccountTitle(order, 'account')
                }
                accountHTML += '</a>'
            }

            rows += `<tr class='${className}' data-transaction='${order.order}' data-quantity='${order.quantityQNT.toString()}' data-price='${order.priceNQT.toString()}'>`
            if (type === 'ask') {
                rows += "<td class='bold red-asset'>" + formatOrderPricePerWholeQNT(order.priceNQT, BRS.currentAsset.decimals) + '</td>'
                rows += '<td>' + formatQuantity(order.quantityQNT, BRS.currentAsset.decimals) + '</td>'
                rows += '<td>' + formatAmount(order.totalNQT) + '</td>'
                rows += `<td>${accountHTML}</td>`
            } else {
                rows += `<td>${accountHTML}</td>`
                rows += '<td>' + formatAmount(order.totalNQT) + '</td>'
                rows += '<td>' + formatQuantity(order.quantityQNT, BRS.currentAsset.decimals) + '</td>'
                rows += "<td class='bold green-asset'>" + formatOrderPricePerWholeQNT(order.priceNQT, BRS.currentAsset.decimals) + '</td>'
            }
            rows += '</tr>'
            first = false
        }

        $(`#asset_exchange_${type}_orders_table tbody`).html(rows)

        dataLoadFinished($(`#asset_exchange_${type}_orders_table`), !refresh)
    })
}

function isUserCancelledOrder (order) {
    if (BRS.unconfirmedTransactions.length) {
        for (let i = 0; i < BRS.unconfirmedTransactions.length; i++) {
            const unconfirmedTransaction = BRS.unconfirmedTransactions[i]

            if (unconfirmedTransaction.type === 2 && (order.type === 'ask' ? unconfirmedTransaction.subtype === 4 : unconfirmedTransaction.subtype === 5) && unconfirmedTransaction.attachment.order === order.order) {
                return true
            }
        }
    }

    return false
}

export function evAssetExchangeSearchInput (e) {
    const input = $.trim($(this).val()).toUpperCase()

    if (!input) {
        BRS.assetSearch = false
        loadAssetExchangeSidebar()
        $('#asset_exchange_clear_search').hide()
    } else {
        BRS.assetSearch = []

        for (const asset of BRS.assets) {
            if (asset.bookmarked === true &&
                    (asset.account === input || asset.asset === input || asset.name.toUpperCase().includes(input) || asset.accountRS.includes(input))) {
                BRS.assetSearch.push(asset.asset)
            }
        };

        loadAssetExchangeSidebar()
        $('#asset_exchange_clear_search').show()
    }
}

export function evAssetExchangeOrdersTableClick (e) {
    const $target = $(e.target)
    let totalNQT
    if ($target.prop('tagName').toLowerCase() === 'a') {
        return
    }

    const type = ($target.closest('table').attr('id') === 'asset_exchange_bid_orders_table' ? 'sell' : 'buy')

    const $tr = $target.closest('tr')

    try {
        const priceNQT = new BigInteger(String($tr.data('price')))
        const quantityQNT = new BigInteger(String($tr.data('quantity')))
        totalNQT = new BigInteger(calculateOrderTotalNQT(quantityQNT, priceNQT))

        $('#' + type + '_asset_price').val(calculateOrderPricePerWholeQNT(priceNQT, BRS.currentAsset.decimals))
        $('#' + type + '_asset_quantity').val(convertToQNTf(quantityQNT, BRS.currentAsset.decimals))
        $('#' + type + '_asset_total').val(convertToNXT(totalNQT))
    } catch (err) {
        return
    }
    let balanceNQT
    if (type === 'sell') {
        try {
            balanceNQT = new BigInteger(BRS.accountInfo.unconfirmedBalanceNQT)
        } catch (err) {
            return
        }

        if (totalNQT.compareTo(balanceNQT) > 0) {
            $('#' + type + '_asset_total').css({
                background: '#ED4348',
                color: 'white'
            })
        } else {
            $('#' + type + '_asset_total').css({
                background: '',
                color: ''
            })
        }
    }

    const box = $('#' + type + '_asset_box')

    if (box.hasClass('collapsed-card')) {
        box.removeClass('collapsed-card')
        box.find('.card-body').slideDown()
    }
}

export function evSellBuyAutomaticPriceClick (e) {
    try {
        const type = ($(this).attr('id') === 'sell_automatic_price' ? 'sell' : 'buy')
        const assetMult = BigInt('1'.padEnd(BRS.currentAsset.decimals + 1, '0'))
        const userInputPrice = $('#' + type + '_asset_price').val()
        let priceNQT = BigInt(convertToNQT(userInputPrice === '' ? '0' : userInputPrice)) / assetMult
        const balance = BigInt(type === 'buy' ? BRS.accountInfo.unconfirmedBalanceNQT : BRS.currentAsset.yourBalanceNQT)
        const balanceNQT = BigInt(BRS.accountInfo.unconfirmedBalanceNQT)
        const maxQuantity = BigInt(BRS.currentAsset.quantityCirculatingQNT)

        if (priceNQT === 0n) {
            // get minimum price if no offers exist, based on asset decimals..
            priceNQT = assetMult
            $('#' + type + '_asset_price').val(convertToNXT(priceNQT))
        }
        let quantityQNT = (type === 'buy' ? balanceNQT / priceNQT : balance)
        if (quantityQNT > maxQuantity) {
            quantityQNT = maxQuantity
        }
        if (type === 'sell') {
            const maxUserQuantity = balance
            if (maxUserQuantity > quantityQNT) {
                quantityQNT = maxQuantity
            }
        }
        const total = quantityQNT * priceNQT

        $('#' + type + '_asset_quantity').val(convertToQNTf(quantityQNT, BRS.currentAsset.decimals))
        $('#' + type + '_asset_total').val(convertToNXT(total.toString()))
        $('#' + type + '_asset_total').css({
            background: '',
            color: ''
        })
    } catch (err) {}
}

function isControlKey (charCode) {
    if (charCode >= 32) {
        return false
    }
    if (charCode === 10) {
        return false
    }
    if (charCode === 13) {
        return false
    }

    return true
}

export function evAssetExchangeQuantityPriceKeydown (e) {
    const charCode = !e.charCode ? e.which : e.charCode

    if (isControlKey(charCode) || e.ctrlKey || e.metaKey) {
        return
    }

    const isQuantityField = /_quantity/i.test($(this).attr('id'))

    const maxFractionLength = (isQuantityField ? BRS.currentAsset.decimals : 8 - BRS.currentAsset.decimals)

    if (maxFractionLength) {
        // allow 1 single period character
        if (charCode === 110 || charCode === 190) {
            if ($(this).val().indexOf('.') !== -1) {
                e.preventDefault()
                return false
            } else {
                return
            }
        }
    } else {
        // do not allow period
        if (charCode === 110 || charCode === 190 || charCode === 188) {
            $.notify($.t('error_fractions'), { type: 'danger' })
            e.preventDefault()
            return false
        }
    }

    const input = $(this).val() + String.fromCharCode(charCode)

    const afterComma = input.match(/\.(\d*)$/)

    // only allow as many as there are decimals allowed..
    if (afterComma && afterComma[1].length > maxFractionLength) {
        const selectedText = getSelectedText()

        if (selectedText !== $(this).val()) {
            let errorMessage

            if (isQuantityField) {
                errorMessage = $.t('error_asset_decimals', {
                    count: (0 + BRS.currentAsset.decimals)
                })
            } else {
                errorMessage = $.t('error_decimals', {
                    count: (8 - BRS.currentAsset.decimals)
                })
            }

            $.notify(errorMessage, { type: 'danger' })

            e.preventDefault()
            return false
        }
    }

    // numeric characters, left/right key, backspace, delete
    if (charCode === 8 || charCode === 37 || charCode === 39 || charCode === 46 ||
        (charCode >= 48 && charCode <= 57 && !isNaN(String.fromCharCode(charCode))) || (charCode >= 96 && charCode <= 105)) {
        return
    }
    // comma
    if (charCode === 188) {
        $.notify($.t('error_comma_not_allowed'), { type: 'danger' })
    }
    e.preventDefault()
    return false
}

// calculate preview price (calculated on every keypress)
export function evCalculatePricePreviewKeyup (e) {
    const orderType = $(this).data('type').toLowerCase()

    try {
        const quantityQNT = new BigInteger(convertToQNT(String($('#' + orderType + '_asset_quantity').val()), BRS.currentAsset.decimals))
        const priceNQT = new BigInteger(calculatePricePerWholeQNT(convertToNQT(String($('#' + orderType + '_asset_price').val())), BRS.currentAsset.decimals))

        if (priceNQT.toString() === '0' || quantityQNT.toString() === '0') {
            $('#' + orderType + '_asset_total').val('0')
        } else {
            const total = calculateOrderTotal(quantityQNT, priceNQT, BRS.currentAsset.decimals)
            $('#' + orderType + '_asset_total').val(total.toString())
        }
    } catch (err) {
        $('#' + orderType + '_asset_total').val('0')
    }
}

export function evAssetOrderModalOnShowBsModal (e) {
    const $invoker = $(e.relatedTarget)

    let orderType = $invoker.data('type')
    const assetId = $invoker.data('asset')
    let quantityQNT
    let priceNQT
    let totalNXT
    let quantity
    $('#asset_order_modal_button').html(orderType + ' Asset').data('resetText', orderType + ' Asset')

    orderType = orderType.toLowerCase()

    try {
        // TODO
        quantity = String($('#' + orderType + '_asset_quantity').val())
        quantityQNT = new BigInteger(convertToQNT(quantity, BRS.currentAsset.decimals))
        priceNQT = new BigInteger(calculatePricePerWholeQNT(convertToNQT(String($('#' + orderType + '_asset_price').val())), BRS.currentAsset.decimals))
        totalNXT = formatAmount(calculateOrderTotalNQT(quantityQNT, priceNQT, BRS.currentAsset.decimals), false, true)
    } catch (err) {
        $.notify('Invalid input.', { type: 'danger' })
        return e.preventDefault()
    }

    if (priceNQT.toString() === '0' || quantityQNT.toString() === '0') {
        $.notify($.t('error_amount_price_required'), { type: 'danger' })
        return e.preventDefault()
    }

    const priceNQTPerWholeQNT = priceNQT.multiply(new BigInteger('' + Math.pow(10, BRS.currentAsset.decimals)))
    let description
    let tooltipTitle
    if (orderType === 'buy') {
        description = $.t('buy_order_description', {
            quantity: formatQuantity(quantityQNT, BRS.currentAsset.decimals, true),
            asset_name: $('#asset_name').html().escapeHTML(),
            burst: formatAmount(priceNQTPerWholeQNT),
            valueSuffix: BRS.valueSuffix
        })
        tooltipTitle = $.t('buy_order_description_help', {
            burst: formatAmount(priceNQTPerWholeQNT, false, true),
            total_burst: totalNXT,
            valueSuffix: BRS.valueSuffix
        })
    } else {
        description = $.t('sell_order_description', {
            quantity: formatQuantity(quantityQNT, BRS.currentAsset.decimals, true),
            asset_name: $('#asset_name').html().escapeHTML(),
            burst: formatAmount(priceNQTPerWholeQNT),
            valueSuffix: BRS.valueSuffix
        })
        tooltipTitle = $.t('sell_order_description_help', {
            burst: formatAmount(priceNQTPerWholeQNT, false, true),
            total_burst: totalNXT,
            valueSuffix: BRS.valueSuffix
        })
    }

    $('#asset_order_description').html(description)
    $('#asset_order_total').html(totalNXT + ' ' + BRS.valueSuffix)

    if (quantity !== '1') {
        $('#asset_order_total_tooltip').show()
        $('#asset_order_total_tooltip').popover('hide')
        $('#asset_order_total_tooltip').data('content', tooltipTitle)
        $('#asset_order_total_tooltip').popover({
            content: tooltipTitle,
            trigger: 'hover'
        })
    } else {
        $('#asset_order_total_tooltip').hide()
    }

    $('#asset_order_type').val((orderType === 'buy' ? 'placeBidOrder' : 'placeAskOrder'))
    $('#asset_order_asset').val(assetId)
    $('#asset_order_quantity').val(quantityQNT.toString())
    $('#asset_order_price').val(priceNQT.toString())
}

export function formsOrderAsset (data) {
    const requestType = data.asset_order_type
    delete data.asset_order_type
    return {
        requestType,
        successMessage: (requestType === 'placeBidOrder' ? $.t('success_buy_order_asset') : $.t('success_sell_order_asset')),
        errorMessage: $.t('error_order_asset')
    }
}

export function formsOrderAssetComplete (response, data) {
    if (response.alreadyProcessed) {
        return
    }
    let $table
    if (data.requestType === 'placeBidOrder') {
        $table = $('#asset_exchange_bid_orders_table tbody')
    } else {
        $table = $('#asset_exchange_ask_orders_table tbody')
    }

    if ($table.find(`tr[data-transaction='${response.transaction}']`).length) {
        return
    }

    const $rows = $table.find('tr')

    data.quantityQNT = new BigInteger(data.quantityQNT)
    data.priceNQT = new BigInteger(data.priceNQT)
    data.totalNQT = new BigInteger(calculateOrderTotalNQT(data.quantityQNT, data.priceNQT))

    let rowToAdd = `<tr class='tentative' data-transaction='${response.transaction}' data-quantity='${data.quantityQNT.toString()}' data-price='${data.priceNQT.toString()}'>`
    if (data.requestType === 'placeBidOrder') {
        rowToAdd += `<td>${BRS.pendingTransactionHTML} <strong>${$.t('you')}</strong></td>`
        rowToAdd += '<td>' + formatAmount(data.totalNQT) + '</td>'
        rowToAdd += '<td>' + formatQuantity(data.quantityQNT, BRS.currentAsset.decimals) + '</td>'
        rowToAdd += '<td>' + formatOrderPricePerWholeQNT(data.priceNQT, BRS.currentAsset.decimals) + '</td>'
    } else {
        rowToAdd += '<td>' + formatOrderPricePerWholeQNT(data.priceNQT, BRS.currentAsset.decimals) + '</td>'
        rowToAdd += '<td>' + formatQuantity(data.quantityQNT, BRS.currentAsset.decimals) + '</td>'
        rowToAdd += '<td>' + formatAmount(data.totalNQT) + '</td>'
        rowToAdd += `<td>${BRS.pendingTransactionHTML} <strong>${$.t('you')}</strong></td>`
    }
    rowToAdd += '</tr>'

    let rowAdded = false

    if ($rows.length) {
        $rows.each(function () {
            const rowPrice = new BigInteger(String($(this).data('price')))

            if (data.requestType === 'placeBidOrder' && data.priceNQT.compareTo(rowPrice) > 0) {
                $(this).before(rowToAdd)
                rowAdded = true
                return false
            } else if (data.requestType === 'placeAskOrder' && data.priceNQT.compareTo(rowPrice) < 0) {
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

export function formsIssueAsset (data) {
    data.description = $.trim(data.description)
    if (!data.description) {
        return {
            error: $.t('error_description_required')
        }
    }
    if (!/^[a-zA-Z0-9]{3,10}$/.test(data.name)) {
        return {
            error: $.t('error_incorrect_name', { name: 'name' })
        }
    }
    if (!/^\d+$/.test(data.quantity)) {
        return {
            error: $.t('error_whole_quantity')
        }
    }
    if (data.mintable) {
        data.mintable = true
    }
    data.quantityQNT = String(data.quantity)
    if (data.decimals > 0) {
        for (let i = 0; i < data.decimals; i++) {
            data.quantityQNT += '0'
        }
    }
    delete data.quantity
    return {
        data
    }
}

export function formsAssetExchangeChangeGroupName () {
    const oldGroupName = $('#asset_exchange_change_group_name_old').val()
    const newGroupName = $('#asset_exchange_change_group_name_new').val()

    if (!newGroupName.match(/^[a-z0-9 ]+$/i)) {
        return {
            error: $.t('error_group_name')
        }
    }

    const itemsToUpdate = []
    BRS.assets.forEach(asset => {
        if (!asset.bookmarked) return
        if (asset.groupName === oldGroupName) {
            asset.groupName = newGroupName
            itemsToUpdate.push({ asset: asset.asset, groupName: newGroupName })
        }
    })
    dbPut('assets', itemsToUpdate, function (error) {
        if (error) {
            $.notify($.t('error_save_db'), { type: 'danger' })
            return
        }
        reloadCurrentPage()
        $.notify($.t('success_group_name_update'), { type: 'success' })
    })

    return {
        stop: true,
        hide: true
    }
}

export function evAssetExchangeSidebarContextClick (e) {
    e.preventDefault()

    const assetId = BRS.selectedContext.data('asset')
    const option = $(this).data('option')

    closeContextMenu()

    const asset = BRS.assets.find(tkn => tkn.asset === assetId)
    if (!asset) {
        console.log('OPA!')
        return
    }

    if (option === 'add_to_group') {
        $('#asset_exchange_group_asset').val(assetId)
        $('#asset_exchange_group_title').html(String(asset.name).escapeHTML())

        const groupNames = [...new Set(BRS.assets
            .filter(tkn => tkn.groupName)
            .map(tkn => tkn.groupName))]
        groupNames.sort((a, b) => a.localeCompare(b))

        const groupSelect = $('#asset_exchange_group_group')
        groupSelect.empty()

        groupNames.forEach(groupName => {
            groupSelect.append(`<option value='${groupName.escapeHTML()}' ${asset.groupName === groupName ? " selected='selected'" : ''}>${groupName.escapeHTML()}</option>`)
        })

        groupSelect.append("<option value='0'" + (!asset.groupName ? " selected='selected'" : '') + '></option>')
        groupSelect.append(`<option value='-1'>${$.t('new_group')}</option>`)

        $('#asset_exchange_group_modal').modal('show')
    } else if (option === 'remove_from_group') {
        asset.groupName = ''
        dbPut('assets', asset, function (error) {
            if (error) {
                $.notify($.t('error_save_db'), { type: 'danger' })
                return
            }
            loadAssetExchangeSidebar()
            $.notify($.t('success_asset_group_removal'), { type: 'success' })
        })
    } else if (option === 'remove_from_bookmarks') {
        asset.bookmarked = false
        dbPut('assets', asset, function (error) {
            if (error) {
                $.notify($.t('error_save_db'), { type: 'danger' })
                return
            }
            loadAssetExchangeSidebar()
            $.notify($.t('success_asset_bookmark_removal'), { type: 'success' })
        })
    }
}

export function formsAssetExchangeGroup () {
    const assetId = $('#asset_exchange_group_asset').val()
    let groupName = $('#asset_exchange_group_group').val()

    if (groupName === '0') {
        groupName = ''
    } else if (groupName === '-1') {
        groupName = $('#asset_exchange_group_new_group').val()
    }

    dbPut('assets', {
        asset: assetId,
        groupName
    }, function (error, item) {
        if (error) return
        const foundAsset = BRS.assets.find((tkn) => tkn.asset === item.asset)
        if (foundAsset) {
            foundAsset.groupName = groupName
        }
        setTimeout(function () {
            loadAssetExchangeSidebar()
            // reloadCurrentPage()
            if (!groupName) {
                $.notify($.t('success_asset_group_removal'), { type: 'success' })
            } else {
                $.notify($.t('success_asset_group_add'), { type: 'success' })
            }
        }, 50)
    })

    return {
        stop: true,
        hide: true
    }
}

/* TRANSFER HISTORY PAGE */
export function pagesTransferHistory () {
    sendRequest('getAssetTransfers+', {
        account: BRS.accountRS,
        firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
        lastIndex: BRS.pageSize * BRS.pageNumber
    }, function (response, input) {
        if (response.transfers && response.transfers.length) {
            if (response.transfers.length > BRS.pageSize) {
                BRS.hasMorePages = true
                response.transfers.pop()
            }

            const transfers = response.transfers

            let rows = ''

            for (let i = 0; i < transfers.length; i++) {
                transfers[i].quantityQNT = new BigInteger(transfers[i].quantityQNT)

                const type = (transfers[i].recipientRS === BRS.accountRS ? 'receive' : 'send')

                rows += "<tr><td><a href='#' data-transaction='" + String(transfers[i].assetTransfer).escapeHTML() + "'>" + String(transfers[i].assetTransfer).escapeHTML() + "</a></td><td><a href='#' data-goto-asset='" + String(transfers[i].asset).escapeHTML() + "'>" + String(transfers[i].name).escapeHTML() + '</a></td><td>' + formatTimestamp(transfers[i].timestamp) + "</td><td style='color:" + (type === 'receive' ? 'green' : 'red') + "'>" + formatQuantity(transfers[i].quantityQNT, transfers[i].decimals) + '</td>' +
                        "<td><a href='#' data-user='" + getAccountFormatted(transfers[i], 'recipient') + "' class='user_info'>" + getAccountTitle(transfers[i], 'recipient') + '</a></td>' +
                        "<td><a href='#' data-user='" + getAccountFormatted(transfers[i], 'sender') + "' class='user_info'>" + getAccountTitle(transfers[i], 'sender') + '</a></td>' +
                        '</tr>'
            }

            dataLoaded(rows)
        } else {
            dataLoaded()
        }
    })
}

/** Populates the drop-down list with the user assets, in alphabetical order.
 * It is used in places like "transfer token", so user can pick one easily. */
export function evAssetSelectorButtonClick (e) {
    const $list = $(this).parent().find('ul')
    $list.empty()
    if (!BRS.accountInfo.assetBalances) {
        $list.append(`<li><a class='dropdown-item' href='#' data-name='' data-asset='' data-decimals=''>${$.t('no_asset_found')}</a></li>`)
        return
    }
    sortCachedAssets()
    for (const asset of BRS.assets) {
        const foundAsset = BRS.accountInfo.assetBalances.find((tkn) => tkn.asset === asset.asset)
        if (foundAsset) {
            $list.append(`<li><a class='dropdown-item' href='#' data-name='${asset.name}' data-asset='${asset.asset}' data-decimals='${asset.decimals}'>${asset.name} - ${asset.asset}</a></li>`)
        }
    }
}

/* MY ASSETS PAGE */
export function pagesMyAssets () {
    if (!BRS.accountInfo.assetBalances || !BRS.accountInfo.assetBalances.length) {
        dataLoaded()
        return
    }
    const result = {
        assets: [],
        bid_orders: {},
        ask_orders: {}
    }
    const count = {
        total_assets: BRS.accountInfo.assetBalances.length,
        cachedAssets: 0,
        requestedAssets: 0,
        ignored_assets: 0
    }

    // First, fetch and display all asset details
    for (let i = 0; i < BRS.accountInfo.assetBalances.length; i++) {
        if (BRS.accountInfo.assetBalances[i].balanceQNT === '0') {
            count.ignored_assets++
            continue
        }

        const foundAsset = BRS.assets.find(asset => asset.asset === BRS.accountInfo.assetBalances[i].asset)
        if (foundAsset) {
            result.assets.push({
                asset: foundAsset.asset,
                name: foundAsset.name,
                quantityCirculatingQNT: foundAsset.quantityCirculatingQNT,
                balanceQNT: new BigInteger(BRS.accountInfo.assetBalances[i].balanceQNT),
                quantityQNT: new BigInteger(foundAsset.quantityQNT),
                decimals: foundAsset.decimals
            })
            count.cachedAssets++
            continue
        }

        sendRequest('getAsset+', {
            asset: BRS.accountInfo.assetBalances[i].asset,
            _extra: {
                balanceQNT: BRS.accountInfo.assetBalances[i].balanceQNT
            }
        }, function (asset, input) {
            if (BRS.currentPage !== 'my_assets') {
                return
            }

            asset.asset = input.asset
            asset.balanceQNT = new BigInteger(input._extra.balanceQNT)
            asset.quantityQNT = new BigInteger(asset.quantityQNT)

            result.assets.push(asset)
            count.requestedAssets++

            if (checkMyAssetsPageLoaded(count)) {
                myAssetsPageLoaded(result)
            }
        })
    }
    if (checkMyAssetsPageLoaded(count)) {
        myAssetsPageLoaded(result)
    }
}

function checkMyAssetsPageLoaded (count) {
    return count.assets + count.requestedAssets + count.ignored_assets === count.total_assets
}

function myAssetsPageLoaded (result) {
    let rows = ''

    result.assets.sort(function (a, b) {
        if (a.name.toLowerCase() > b.name.toLowerCase()) {
            return 1
        } else if (a.name.toLowerCase() < b.name.toLowerCase()) {
            return -1
        } else {
            return 0
        }
    })

    for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i]

        rows += `<tr data-asset="${String(asset.asset).escapeHTML()}">`
        rows += `<td><a href='#' data-goto-asset='${String(asset.asset).escapeHTML()}'>${String(asset.name).escapeHTML()}</a></td>`
        rows += `<td class="quantity">${formatQuantity(asset.balanceQNT, asset.decimals)}</td>`
        rows += `<td>${formatQuantity(asset.quantityCirculatingQNT, asset.decimals)}</td>`
        rows += `<td id="ask-order-${String(asset.asset).escapeHTML()}"><i class="fas fa-spinner my-fa-spin"></i></td>`
        rows += `<td id="bid-order-${String(asset.asset).escapeHTML()}"><i class="fas fa-spinner my-fa-spin"></i></td>`
        rows += `<td id="value-order-${String(asset.asset).escapeHTML()}"><i class="fas fa-spinner my-fa-spin"></i></td>`
        rows += `<td><a href='#' data-toggle='modal' data-target='#transfer_asset_modal' data-asset='${String(asset.asset).escapeHTML()}' data-name='${String(asset.name).escapeHTML()}' data-decimals='${String(asset.decimals).escapeHTML()}'>${$.t('transfer')}</a></td>`
        rows += '</tr>'
    }

    // Initial page loaded, fetch order details asynchronously
    for (let i = 0; i < BRS.accountInfo.assetBalances.length; i++) {
        if (BRS.accountInfo.assetBalances[i].balanceQNT === '0') {
            continue
        }

        const assetId = BRS.accountInfo.assetBalances[i].asset

        sendRequest('getAskOrders+', {
            asset: assetId,
            firstIndex: 0,
            lastIndex: 0
        }, function (response, input) {
            if (BRS.currentPage !== 'my_assets') {
                return
            }

            if (response.errorCode || !response.askOrders[0]) {
                updateAskOrderCell(input.asset, null)
                return
            }
            updateAskOrderCell(response.askOrders[0].asset, response.askOrders[0].priceNQT, response.askOrders[0].decimals)
        })

        sendRequest('getBidOrders+', {
            asset: assetId,
            firstIndex: 0,
            lastIndex: 0,
            _extra: {
                balanceQNT: BRS.accountInfo.assetBalances[i].balanceQNT
            }
        }, function (response, input) {
            if (BRS.currentPage !== 'my_assets') {
                return
            }

            if (response.errorCode || !response.bidOrders[0]) {
                updateBidOrderCell(input.asset, null)
                return
            }
            updateBidOrderCell(response.bidOrders[0].asset, response.bidOrders[0].priceNQT, response.bidOrders[0].decimals, input._extra.balanceQNT)
        })
    }

    dataLoaded(rows)
}

function updateAskOrderCell (assetId, priceNQT, decimals) {
    const cellSelector = '#ask-order-' + assetId.escapeHTML()
    if (priceNQT === null) {
        $(cellSelector).text('--')
        return
    }
    $(cellSelector).text(formatOrderPricePerWholeQNT(priceNQT, decimals))
}

function updateBidOrderCell (assetId, priceNQT, decimals, userBalanceQNT) {
    const orderSelector = '#bid-order-' + assetId.escapeHTML()
    const valueSelector = '#value-order-' + assetId.escapeHTML()
    if (priceNQT === null) {
        $(orderSelector).text('--')
        $(valueSelector).text('--')
        return
    }
    $(orderSelector).text(formatOrderPricePerWholeQNT(priceNQT, decimals))
    const totalNQT = calculateOrderTotalNQT(userBalanceQNT, priceNQT)
    $(valueSelector).text(formatAmount(totalNQT))
}

export function incomingMyAssets () {
    reloadCurrentPage()
}

export function evTransferAssetModalOnShowBsModal (e) {
    let $invoker = $(e.relatedTarget)
    if (e.relatedTarget === null) {
        $invoker = $(e.currentTarget)
    }
    const assetId = $invoker.data('asset') ?? ''
    const assetName = $invoker.data('name') ?? '?'
    const decimals = $invoker.data('decimals') ?? ''
    if (assetId === '') {
        return
    }
    let $formGroup = $invoker.closest('.row')
    if ($formGroup.length === 0) {
        // click was not in dropdown-menu... Assume new "transfer asset"
        $formGroup = $('#form-transfer-asset')
    }

    $formGroup.find('input[name=asset]').val(assetId)
    $formGroup.find('input[name=decimals]').val(decimals)
    $formGroup.find('span[name=asset-name]').html(String(assetName).escapeHTML())
    $formGroup.find('input[name=name_plus_asset]').val(assetName + ' - ' + assetId)
    $('#transfer_asset_name_plus_asset').val(assetName + ' - ' + assetId)

    let confirmedBalance = ''
    let unconfirmedBalance = ''
    if (BRS.accountInfo.assetBalances) {
        BRS.accountInfo.assetBalances.find(assetBalance => {
            if (assetBalance.asset === assetId) {
                confirmedBalance = assetBalance.balanceQNT
                return true
            }
            return false
        })
    }
    if (BRS.accountInfo.unconfirmedAssetBalances) {
        BRS.accountInfo.unconfirmedAssetBalances.find(assetBalance => {
            if (assetBalance.asset === assetId) {
                unconfirmedBalance = assetBalance.unconfirmedBalanceQNT
                return true
            }
            return false
        })
    }
    let availableAssetsMessage = ''
    if (confirmedBalance === unconfirmedBalance) {
        availableAssetsMessage = $.t('available_for_transfer', {
            qty: formatQuantity(confirmedBalance, decimals)
        })
    } else {
        availableAssetsMessage = $.t('available_for_transfer', {
            qty: formatQuantity(unconfirmedBalance, decimals)
        }) + ' (' + formatQuantity(confirmedBalance, decimals) + ' ' + $.t('total_lowercase') + ')'
    }
    $formGroup.find('span[name=transfer_asset_available]').html(availableAssetsMessage)
}

export function formsTransferAssetMulti (data) {
    data.assetIdsAndQuantities = ''
    let items = 0
    let showWarning = false
    for (let i = 0; i < 4; i++) {
        if (data.asset[i] === '' || Number(data.quantity[i]) === 0) {
            continue
        }
        if (items > 0) {
            data.assetIdsAndQuantities += ';'
        }
        items++
        if (Number(data.quantity[i]) > BRS.settings.asset_transfer_warning &&
                BRS.settings.asset_transfer_warning !== 0) {
            showWarning = true
        }
        try {
            data.assetIdsAndQuantities += data.asset[i] + ':' +
                    convertToQNT(data.quantity[i], data.decimals[i])
        } catch (e) {
            return {
                error: $.t('error_incorrect_quantity_plus', {
                    err: e.escapeHTML()
                })
            }
        }
    }
    if (items < 2) {
        return { error: $.t('error_multi_transfer_minimum') }
    }
    delete data.asset
    delete data.quantity
    delete data.decimals
    delete data.name_plus_asset
    if (!data.amountNXT) {
        data.amountNXT = '0'
    }
    if (!BRS.showedFormWarning && showWarning) {
        BRS.showedFormWarning = true
        return {
            error: $.t('error_max_asset_transfer_warning', {
                qty: String(BRS.settings.asset_transfer_warning).escapeHTML()
            })
        }
    }
    return {
        data
    }
}

export function formsTransferAsset (data) {
    if (!data.quantity) {
        return {
            error: $.t('error_not_specified', {
                name: getTranslatedFieldName('quantity').toLowerCase()
            }).capitalize()
        }
    }
    if (!data.amountNXT) {
        data.amountNXT = '0'
    }

    if (!BRS.showedFormWarning) {
        if (BRS.settings.asset_transfer_warning && BRS.settings.asset_transfer_warning !== 0) {
            if (Number(data.quantity) > Number(BRS.settings.asset_transfer_warning)) {
                BRS.showedFormWarning = true
                return {
                    error: $.t('error_max_asset_transfer_warning', {
                        qty: String(BRS.settings.asset_transfer_warning).escapeHTML()
                    })
                }
            }
        }
    }

    try {
        data.quantityQNT = convertToQNT(data.quantity, data.decimals)
    } catch (e) {
        return {
            error: $.t('error_incorrect_quantity_plus', {
                err: e.escapeHTML()
            })
        }
    }

    delete data.quantity
    delete data.decimals
    delete data.name_plus_asset

    return {
        data
    }
}

export function formsTransferAssetComplete (response, data) {
    if (BRS.currentPage === 'my_assets') {
        // TODO Why only in my_assets?
        reloadCurrentPage()
    }
}

export function goToAsset (asset) {
    if (BRS.currentPage !== 'asset_exchange') {
        goToPage('asset_exchange')
    }

    BRS.assetSearch = false
    $('#asset_exchange_sidebar_search input[name=q]').val('')
    $('#asset_exchange_clear_search').hide()

    $('#asset_exchange_sidebar a.list-group-item.active').removeClass('active')
    $('#no_asset_selected, #asset_details, #no_assets_available, #no_asset_search_results').hide()
    $('#loading_asset_data').show()

    const foundAsset = BRS.assets.find((tkn) => tkn.asset === asset)
    if (foundAsset) {
        loadAssetExchangeSidebar(function () {
            loadAsset(foundAsset, true, true)
        })
        return
    }
    sendRequest('getAsset+', {
        asset
    }, function (response) {
        if (!response.errorCode) {
            cacheAsset(response)
            loadAssetExchangeSidebar(function () {
                loadAsset(response, true, false)
            })
            return
        }
        $.notify($.t('error_asset_not_found'), { type: 'danger' })
        loadAssetExchangeSidebar()
        $('#loading_asset_data').hide()
    })
}

/* OPEN ORDERS PAGE */
export function pagesOpenOrders () {
    let loaded = 0
    function allLoaded () {
        loaded++
        if (loaded === 2) {
            pageLoaded()
        }
    }
    getOpenOrders('ask', allLoaded)
    getOpenOrders('bid', allLoaded)
}

function getOpenOrders (type, callback) {
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1)

    const getCurrentOrderIds = `getAccountCurrent${capitalizedType}OrderIds+`
    const orderIds = `${type}OrderIds`
    const getOrder = `get${capitalizedType}Order+`

    const orders = []

    function allOrdersLoaded () {
        if (BRS.currentPage !== 'open_orders') {
            return
        }
        openOrdersLoaded(orders.concat(getUnconfirmedOrders(type)), type, callback)
    }

    sendRequest(getCurrentOrderIds, {
        account: BRS.account
    }, function (response) {
        if (response[orderIds] === undefined || response[orderIds].length === 0) {
            allOrdersLoaded()
            return
        }
        let nr_orders = 0
        for (const eachOrder of response[orderIds]) {
            sendRequest(getOrder, {
                order: eachOrder
            }, function (order) {
                sendRequest('getTransaction', {
                    transaction: eachOrder
                }, function (originalOrder) {
                    if (originalOrder.errorCode === undefined) {
                        order.originalQuantityQNT = originalOrder.attachment.quantityQNT
                    }
                    orders.push(order)
                    nr_orders++
                    if (nr_orders === response[orderIds].length) {
                        allOrdersLoaded()
                    }
                })
            })
            if (BRS.currentPage !== 'open_orders') {
                return
            }
        }
    })
};

function getUnconfirmedOrders (type) {
    const unconfirmedOrders = []
    for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
        if (unconfirmedTransaction.type === 2 && unconfirmedTransaction.subtype === (type === 'ask' ? 2 : 3)) {
            unconfirmedOrders.push({
                account: unconfirmedTransaction.sender,
                asset: unconfirmedTransaction.attachment.asset,
                assetName: '',
                decimals: 0,
                height: 0,
                order: unconfirmedTransaction.transaction,
                priceNQT: unconfirmedTransaction.attachment.priceNQT,
                quantityQNT: unconfirmedTransaction.attachment.quantityQNT,
                originalQuantityQNT: unconfirmedTransaction.attachment.quantityQNT,
                tentative: true
            })
        }
    }
    return unconfirmedOrders
};

function openOrdersLoaded (orders, type, callback) {
    if (!orders.length) {
        $('#open_' + type + '_orders_table tbody').empty()
        dataLoadFinished($('#open_' + type + '_orders_table'))

        callback()

        return
    }

    orders.forEach(obj => {
        const assetDetails = getAssetDetails(obj.asset)
        if (assetDetails) {
            obj.assetName = assetDetails.name
            obj.assetDecimals = assetDetails.decimals
        } else {
            obj.assetName = 'undefined'
            obj.assetDecimals = 0
        }
    })
    orders.sort(function (a, b) {
        if (a.assetName.toLowerCase() > b.assetName.toLowerCase()) {
            return 1
        } else if (a.assetName.toLowerCase() < b.assetName.toLowerCase()) {
            return -1
        } else {
            if (a.quantity * a.price > b.quantity * b.price) {
                return 1
            } else if (a.quantity * a.price < b.quantity * b.price) {
                return -1
            } else {
                return 0
            }
        }
    })

    let rows = ''

    for (const completeOrder of orders) {
        let cancelled = false
        for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
            if (unconfirmedTransaction.type === 2 &&
                    unconfirmedTransaction.subtype === (type === 'ask' ? 4 : 5) &&
                    unconfirmedTransaction.attachment.order === completeOrder.order) {
                cancelled = true
                break
            }
        }

        completeOrder.priceNQT = new BigInteger(completeOrder.priceNQT)
        completeOrder.quantityQNT = new BigInteger(completeOrder.quantityQNT)
        completeOrder.totalNQT = new BigInteger(calculateOrderTotalNQT(completeOrder.quantityQNT, completeOrder.priceNQT))
        completeOrder.originalQuantityQNT = new BigInteger(completeOrder.originalQuantityQNT)
        const filled = new BigInteger('100').subtract(completeOrder.quantityQNT.multiply(new BigInteger('100')).divide(completeOrder.originalQuantityQNT)).toString() + '%'

        let rowClass = ''
        if (cancelled) {
            rowClass = "class='tentative tentative-crossed'"
        } else {
            if (completeOrder.tentative) {
                rowClass = "class='tentative'"
            }
        }
        let cancelText = ''
        if (rowClass === '') {
            cancelText = `<a href='#' data-toggle='modal' data-target='#cancel_order_modal' data-order='${completeOrder.order}' data-type='${type}'><i class="fas fa-trash"></i></a>`
        }

        rows += `<tr data-order='${completeOrder.order}' ${rowClass}>`
        rows += `<td><a href='#' data-goto-asset='${completeOrder.asset}'>${completeOrder.assetName}</a></td>`
        rows += `<td>${formatQuantity(completeOrder.originalQuantityQNT, completeOrder.assetDecimals)}</td>`
        rows += `<td>${filled}</td>`
        rows += `<td>${formatOrderPricePerWholeQNT(completeOrder.priceNQT, completeOrder.assetDecimals)}</td>`
        rows += `<td>${formatAmount(completeOrder.totalNQT)}</td>`
        rows += `<td class='cancel'>${cancelText}</td>`
        rows += '</tr>'
    }

    $('#open_' + type + '_orders_table tbody').empty().append(rows)

    dataLoadFinished($('#open_' + type + '_orders_table'))
    orders = {}

    callback()
};

export function incomingOpenOrders (transactions) {
    if (hasTransactionUpdates(transactions)) {
        reloadCurrentPage()
    }
}

export function formsCancelOrder (data) {
    const requestType = data.cancel_order_type
    delete data.cancel_order_type
    return {
        data,
        requestType
    }
}

export function formsCancelOrderComplete (response, data) {
    if (data.requestType === 'cancelAskOrder') {
        $.notify($.t('success_cancel_sell_order'), { type: 'success' })
    } else {
        $.notify($.t('success_cancel_buy_order'), { type: 'success' })
    }

    if (response.alreadyProcessed) {
        return
    }

    $('#open_orders_page tr[data-order=' + String(data.order).escapeHTML() + ']').addClass('tentative tentative-crossed').find('td.cancel').html('/')
}
