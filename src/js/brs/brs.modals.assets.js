import { BRS } from '.';
import { reloadCurrentPage } from './brs';
import { loadAssetExchangeSidebar } from './brs.assetexchange';
import { dbPut } from './brs.database';
import { formatNQTAsAmount, formatOrderTotal, formatQNTAsQuantity, parsePriceQuantityToPriceNQT, parseQuantityToQNT } from './brs.numbers';
import { getTranslatedFieldName } from './brs.util';

export function evTransferAssetModalOnShowBsModal(e) {
    let $invoker = $(e.relatedTarget);
    if (e.relatedTarget === null) {
        $invoker = $(e.currentTarget);
    }
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

export function formsTransferAssetMulti(data) {
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
        if (Number(data.quantity[i]) > BRS.settings.asset_transfer_warning &&
            BRS.settings.asset_transfer_warning !== 0) {
            showWarning = true;
        }
        try {
            data.assetIdsAndQuantities += data.asset[i] + ':' +
                parseQuantityToQNT(data.quantity[i], data.decimals[i]);
        } catch (e) {
            return {
                error: $.t('error_incorrect_quantity_plus', {
                    err: e.escapeHTML()
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

export function formsTransferAsset(data) {
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

    if (!BRS.showedFormWarning) {
        if (BRS.settings.asset_transfer_warning && BRS.settings.asset_transfer_warning !== 0) {
            if (Number(data.quantity) > Number(BRS.settings.asset_transfer_warning)) {
                BRS.showedFormWarning = true;
                return {
                    error: $.t('error_max_asset_transfer_warning', {
                        qty: String(BRS.settings.asset_transfer_warning).escapeHTML()
                    })
                };
            }
        }
    }

    try {
        data.quantityQNT = parseQuantityToQNT(data.quantity, data.decimals);
    } catch (e) {
        return {
            error: $.t('error_incorrect_quantity_plus', {
                err: e.escapeHTML()
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

export function formsCancelOrder(data) {
    const requestType = data.cancel_order_type
    delete data.cancel_order_type
    return {
        data,
        requestType
    }
}

export function formsCancelOrderComplete(response, data) {
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

export function formsAssetExchangeGroup() {
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

export function formsIssueAsset(data) {
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

export function formsAssetExchangeChangeGroupName() {
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

export function evAssetOrderModalOnShowBsModal(e) {
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
        quantityQNT = parseQuantityToQNT(quantity, BRS.currentAsset.decimals)
        priceNQT = parsePriceQuantityToPriceNQT(String($('#' + orderType + '_asset_price').val()), BRS.currentAsset.decimals)
        totalNXT = formatOrderTotal(quantityQNT, priceNQT)
    } catch {
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

export function formsOrderAsset(data) {
    const requestType = data.asset_order_type
    delete data.asset_order_type
    return {
        requestType,
        successMessage: (requestType === 'placeBidOrder' ? $.t('success_buy_order_asset') : $.t('success_sell_order_asset')),
        errorMessage: $.t('error_order_asset')
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
export function evAssetSelectorButtonClick() {
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
