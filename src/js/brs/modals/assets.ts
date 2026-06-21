import { BRS } from '..';
import { PostResponse, ShowBootstrapModalEvent } from '../typings';
import { reloadCurrentPage } from '../core/navigation';
import { loadAssetExchangeSidebar } from '../pages/assets.asset_exchange';
import { dbPut } from '../core/database';
import { formatNQTAsAmount, formatOrderTotal, formatQNTAsQuantity, parsePriceQuantityToPriceNQT, parseQuantityToQNT } from '../core/numbers';
import { getTranslatedFieldName } from '../core/util';

export function populateTransferAssetSelector($invoker: JQuery<HTMLElement>) {
    const assetId = $invoker.data('asset') ?? '';
    const assetName = $invoker.data('name') ?? '?';
    const decimals = $invoker.data('decimals') ?? '';
    if (assetId === '') {
        return;
    }
    let $formGroup = $invoker.closest('.row');
    if ($formGroup.length === 0) {
        // click was not in dropdown-menu... Assume new "transfer asset"
        $formGroup = $('#form-transfer-asset');
    }

    $formGroup.find('input[name=asset]').val(assetId);
    $formGroup.find('input[name=decimals]').val(decimals);
    $formGroup.find('span[name=asset-name]').html(String(assetName).escapeHTML());
    $formGroup.find('input[name=name_plus_asset]').val(assetName + ' - ' + assetId);
    $('#transfer_asset_name_plus_asset').val(assetName + ' - ' + assetId);

    let confirmedBalance = '';
    let unconfirmedBalance = '';
    if (BRS.accountInfo.assetBalances) {
        BRS.accountInfo.assetBalances.find(assetBalance => {
            if (assetBalance.asset === assetId) {
                confirmedBalance = assetBalance.balanceQNT;
                return true;
            }
            return false;
        });
    }
    if (BRS.accountInfo.unconfirmedAssetBalances) {
        BRS.accountInfo.unconfirmedAssetBalances.find(assetBalance => {
            if (assetBalance.asset === assetId) {
                unconfirmedBalance = assetBalance.unconfirmedBalanceQNT;
                return true;
            }
            return false;
        });
    }
    let availableAssetsMessage = '';
    if (confirmedBalance === unconfirmedBalance) {
        availableAssetsMessage = $.t('available_for_transfer', {
            qty: formatQNTAsQuantity(confirmedBalance, decimals)
        });
    } else {
        availableAssetsMessage = $.t('available_for_transfer', {
            qty: formatQNTAsQuantity(unconfirmedBalance, decimals)
        }) + ' (' + formatQNTAsQuantity(confirmedBalance, decimals) + ' ' + $.t('total_lowercase') + ')';
    }
    $formGroup.find('span[name=transfer_asset_available]').html(availableAssetsMessage);
}

export function formsTransferAssetMulti(data: any) {
    data.assetIdsAndQuantities = '';
    let items = 0;
    let showWarning = false;
    for (let i = 0; i < 4; i++) {
        if (data.asset[i] === '' || Number(data.quantity[i]) === 0) {
            continue;
        }
        if (items > 0) {
            data.assetIdsAndQuantities += ';';
        }
        items++;
        if (Number(data.quantity[i]) > Number(BRS.settings.asset_transfer_warning) &&
            BRS.settings.asset_transfer_warning !== '0') {
            showWarning = true;
        }
        try {
            data.assetIdsAndQuantities += data.asset[i] + ':' +
                parseQuantityToQNT(data.quantity[i], data.decimals[i]);
        } catch (e) {
            return {
                error: $.t('error_incorrect_quantity_plus', {
                    err: (e  as Error).message.escapeHTML()
                })
            };
        }
    }
    if (items < 2) {
        return { error: $.t('error_multi_transfer_minimum') };
    }
    delete data.asset;
    delete data.quantity;
    delete data.decimals;
    delete data.name_plus_asset;
    if (!data.amountNXT) {
        data.amountNXT = '0';
    }
    if (!BRS.showedFormWarning && showWarning) {
        BRS.showedFormWarning = true;
        return {
            error: $.t('error_max_asset_transfer_warning', {
                qty: String(BRS.settings.asset_transfer_warning).escapeHTML()
            })
        };
    }
    return {
        data
    };
}

export function formsTransferAsset(data: any) {
    if (!data.quantity) {
        return {
            error: $.t('error_not_specified', {
                name: getTranslatedFieldName('quantity').toLowerCase()
            }).capitalize()
        };
    }
    if (!data.amountNXT) {
        data.amountNXT = '0';
    }

    if (!BRS.showedFormWarning &&
        BRS.settings.asset_transfer_warning !== '0' &&
        Number(data.quantity) > Number(BRS.settings.asset_transfer_warning)
    ) {
        BRS.showedFormWarning = true;
        return {
            error: $.t('error_max_asset_transfer_warning', {
                qty: String(BRS.settings.asset_transfer_warning).escapeHTML()
            })
        };
    }

    try {
        data.quantityQNT = parseQuantityToQNT(data.quantity, data.decimals);
    } catch (e) {
        return {
            error: $.t('error_incorrect_quantity_plus', {
                err: (e as Error).message.escapeHTML()
            })
        };
    }

    delete data.quantity;
    delete data.decimals;
    delete data.name_plus_asset;

    return {
        data
    };
}

export function formsTransferAssetComplete() {
    if (BRS.currentPage === 'my_assets') {
        reloadCurrentPage();
    }
}

export function formsCancelOrder(data: any) {
    const requestType = data.cancel_order_type
    delete data.cancel_order_type
    return {
        data,
        requestType
    }
}

export function formsCancelOrderComplete(response: PostResponse, data: any) {
    if (data.requestType === 'cancelAskOrder') {
        $.notify($.t('success_cancelSellOrder'), { type: 'success' })
    } else {
        $.notify($.t('success_cancelBuyOrder'), { type: 'success' })
    }
    $('#open_orders_page tr[data-order=' + String(data.order).escapeHTML() + ']').addClass('text-muted text-line-through').find('td.cancel').html(BRS.pendingTransactionHTML)
}

export function formsAssetExchangeGroup(data: any) {
    function successMessageAndReloadSidebar() {
        setTimeout(function () {
            loadAssetExchangeSidebar()
            if (!groupName) {
                $.notify($.t('success_asset_group_removal'), { type: 'success' })
            } else {
                $.notify($.t('success_asset_group_add'), { type: 'success' })
            }
        }, 50)
    }

    const assetId: string = data.asset_exchange_group_asset
    let groupName: string = data.asset_exchange_group_group

    if (groupName === '0') {
        groupName = ''
    } else if (groupName === '-1') {
        groupName = data.asset_exchange_group_new_group
    }

    const foundAsset = BRS.assets.find((tkn) => tkn.asset === assetId)
    if (foundAsset) {
        foundAsset.groupName = groupName
    }

    if (!BRS.databaseSupport) {
        successMessageAndReloadSidebar()
        return {
            stop: true,
            hide: true
        }
    }

    dbPut('assets', {
        asset: assetId,
        groupName
    }, function (error) {
        if (error) return
        successMessageAndReloadSidebar()
    })

    return {
        stop: true,
        hide: true
    }
}

export function formsIssueAsset(data: any) {
    const description: string = data.description.trim() 
    if (!description) {
        return {
            error: $.t('error_description_required')
        }
    }
    data.description = description

    if (!/^[a-zA-Z0-9]{1,10}$/.test(data.name)) {
        return {
            error: $.t('error_incorrect_name', { name: 'name' })
        }
    }

    if (data.mintable) {
        data.mintable = true
    }

    try {
        const decimals = Number(data.decimals)
        data.quantityQNT = parseQuantityToQNT(data.quantity, decimals)
        data.decimals = decimals
    } catch (e) {
        return {
            error: (e as Error).message
        }
    }
    delete data.quantity

    return {
        data
    }
}

export function formsAssetExchangeChangeGroupName(data: any) {
    const oldGroupName = data.asset_exchange_change_group_name_old
    const newGroupName = data.asset_exchange_change_group_name_new

    if (!newGroupName.match(/^[a-z0-9 ]+$/i)) {
        return {
            error: $.t('error_group_name')
        }
    }

    const itemsToUpdate: { asset: string, groupName: string }[] = []
    BRS.assets.forEach(asset => {
        if (!asset.bookmarked) return
        if (asset.groupName === oldGroupName) {
            asset.groupName = newGroupName
            itemsToUpdate.push({ asset: asset.asset, groupName: newGroupName })
        }
    })

    if (!BRS.databaseSupport) {
        $.notify($.t('success_group_name_update'), { type: 'success' })
        loadAssetExchangeSidebar()
        return {
            stop: true,
            hide: true
        }
    }

    dbPut('assets', itemsToUpdate, function (error) {
        if (error) {
            $.notify($.t('error_save_db'), { type: 'danger' })
            return
        }
        loadAssetExchangeSidebar()
        $.notify($.t('success_group_name_update'), { type: 'success' })
    })

    return {
        stop: true,
        hide: true
    }
}

export function evAssetOrderModalOnShowBsModal(e: JQuery.TriggeredEvent) {
    const $invoker = $((e as ShowBootstrapModalEvent).relatedTarget)

    const orderType: string = String($invoker.data('type')).toLowerCase()
    const assetId: string = $invoker.data('asset')
    let quantityQNT: string
    let priceNQT: string
    let totalNXT: string
    let quantity: string

    try {
        // Get info from form inside asset exchange page
        quantity = String($('#' + orderType + '_asset_quantity').val())
        quantityQNT = parseQuantityToQNT(quantity, BRS.currentAsset.decimals)
        priceNQT = parsePriceQuantityToPriceNQT(String($('#' + orderType + '_asset_price').val()), BRS.currentAsset.decimals)
        totalNXT = formatOrderTotal(quantityQNT, priceNQT)
    } catch {
        $.notify('Invalid input.', { type: 'danger' })
        return e.preventDefault()
    }

    if (priceNQT === '0' || quantityQNT === '0') {
        $.notify($.t('error_amount_price_required'), { type: 'danger' })
        return e.preventDefault()
    }

    const priceNQTPerWholeQNT = BigInt(priceNQT) * (BigInt(Math.pow(10, BRS.currentAsset.decimals)))
    let description: string
    let tooltipTitle: string
    if (orderType === 'buy') {
        description = $.t('buy_order_description', {
            quantity: formatQNTAsQuantity(quantityQNT, BRS.currentAsset.decimals),
            asset_name: $('#asset_name').html().escapeHTML(),
            burst: formatNQTAsAmount(priceNQTPerWholeQNT),
            valueSuffix: BRS.valueSuffix
        })
        tooltipTitle = $.t('buy_order_description_help', {
            burst: formatNQTAsAmount(priceNQTPerWholeQNT),
            total_burst: totalNXT,
            valueSuffix: BRS.valueSuffix
        })
    } else {
        description = $.t('sell_order_description', {
            quantity: formatQNTAsQuantity(quantityQNT, BRS.currentAsset.decimals),
            asset_name: $('#asset_name').html().escapeHTML(),
            burst: formatNQTAsAmount(priceNQTPerWholeQNT),
            valueSuffix: BRS.valueSuffix
        })
        tooltipTitle = $.t('sell_order_description_help', {
            burst: formatNQTAsAmount(priceNQTPerWholeQNT),
            total_burst: totalNXT,
            valueSuffix: BRS.valueSuffix
        })
    }

    // Set modal text
    $('#asset_order_description').html(description)
    $('#asset_order_total').html(totalNXT + ' ' + BRS.valueSuffix)
    $('#asset_order_modal_button').text($.t(`${orderType}_asset`))

    // Prepare the tooltip
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

    // Set modal form values ()
    $('#asset_order_type').val((orderType === 'buy' ? 'placeBidOrder' : 'placeAskOrder'))
    $('#asset_order_asset').val(assetId)
    $('#asset_order_quantity').val(quantityQNT)
    $('#asset_order_price').val(priceNQT)
}

export function formsOrderAsset(data: any) {
    const requestType = data.asset_order_type
    delete data.asset_order_type
    return {
        requestType,
        successMessage: (requestType === 'placeBidOrder' ? $.t('success_buyOrderAsset') : $.t('success_sellOrderAsset')),
        errorMessage: $.t('error_orderAsset')
    }
}

function sortCachedAssets() {
    // sort by name ignoring case
    BRS.assets.sort((a, b) => {
        const nameA = a.name.toUpperCase()
        const nameB = b.name.toUpperCase()
        if (nameA < nameB) return -1
        if (nameA > nameB) return 1
        return 0
    })
}

/** Populates the drop-down list with the user assets, in alphabetical order.
 * It is used in places like "transfer token", so user can pick one easily. */
export function evAssetSelectorButtonClick(e: JQuery.ClickEvent) {
    const $list = $(e.target).parent().find('ul')
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
