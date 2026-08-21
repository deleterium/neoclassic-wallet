import { BRS } from '..'
import { GetAssetAccountsResponse, GetTransactionResponse } from '../typings'
import { loadAssetExchangeSidebar } from '../pages/assets.asset_exchange'
import { dbPut } from '../core/database'
import {
    calculatePercentage,
    formatNQTAsAmount,
    formatOrderTotal,
    formatQNTAsQuantity,
    parsePriceQuantityToPriceNQT,
    parseQuantityToQNT,
} from '../core/numbers'
import { getAccountTitleFromObject, getTranslatedFieldName } from '../core/util'
import { notify } from '../core/notifications'
import { getAssetDetails, getAssetFromCache } from '../tools/assets'
import { sendRequest } from '../core/send_request'
import { showModal } from '../core/modals'

export function populateAssetSelector(assetId: string, assetName: string, decimals: string, $formGroup: JQuery<HTMLElement>) {
    if (assetId === '') {
        $formGroup.find(`span[name=available]`).empty()
        return
    }

    $formGroup.find('input[name=asset]').val(assetId)
    $formGroup.find('input[name=decimals]').val(decimals)
    $formGroup.find('span[name=asset-name]').text(assetName)
    $formGroup.find('input[name=name_plus_asset]').val(assetName + ' - ' + assetId)

    if ($formGroup.closest('form').attr('id') === 'form-mint-asset') {
        const selectedAsset = getAssetFromCache(assetId)
        if (!selectedAsset) return
        $formGroup
            .find('span[name=available]')
            .text($.t('quantity_circulating') + ': ' + formatQNTAsQuantity(selectedAsset.quantityCirculatingQNT, selectedAsset.decimals))
        return
    }
    let confirmedBalance = ''
    let unconfirmedBalance = ''
    if (BRS.accountInfo.assetBalances) {
        BRS.accountInfo.assetBalances.find((assetBalance) => {
            if (assetBalance.asset === assetId) {
                confirmedBalance = assetBalance.balanceQNT
                return true
            }
            return false
        })
    }
    if (BRS.accountInfo.unconfirmedAssetBalances) {
        BRS.accountInfo.unconfirmedAssetBalances.find((assetBalance) => {
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
            qty: formatQNTAsQuantity(confirmedBalance, Number(decimals)),
        })
    } else {
        availableAssetsMessage =
            $.t('available_for_transfer', {
                qty: formatQNTAsQuantity(unconfirmedBalance, Number(decimals)),
            }) +
            ' (' +
            formatQNTAsQuantity(confirmedBalance, Number(decimals)) +
            ' ' +
            $.t('total_lowercase') +
            ')'
    }
    $formGroup.find(`span[name=available]`).html(availableAssetsMessage)
}

export function showDistributeToAssetHoldersModal(assetId: string, assetName: string, decimals: string) {
    const $formGroup = $('#form-distribute_to_asset_holders').first()

    if (!assetId) {
        $formGroup.find('input[name=holders_asset]').empty().addClass('is-invalid')
    } else {
        $formGroup.find('input[name=holders_asset]').val(assetId).removeClass('is-invalid')
    }
    $formGroup.find('input[name=holders_decimals]').val(decimals)
    $formGroup.find('span[name=holders_asset_name]').text(assetName)

    showModal('distribute_to_asset_holders')
}

export async function evDistributeToAssetHoldersHoldersAssetInput(e: JQuery.TriggeredEvent) {
    const assetInput: string = $(e.target).val()
    const chainAsset = await getAssetDetails(assetInput)
    const $formGroup = $('#form-distribute_to_asset_holders')
    if (!chainAsset) {
        $('#distribute_to_asset_holders_holders_asset').addClass('is-invalid')
        $formGroup.find('input[name=holders_decimals]').empty()
        $formGroup.find('span[name=holders_asset_name]').text('?')
        return
    }
    $formGroup.find('input[name=holders_asset]').val(chainAsset.asset).removeClass('is-invalid')
    $formGroup.find('input[name=holders_decimals]').val(chainAsset.decimals)
    $formGroup.find('span[name=holders_asset_name]').text(chainAsset.name)
}

export async function populateReferencedAsset(assetId: string, formName: string) {
    $(`#${formName}_name_plus_asset`).val($.t('loading_please_wait')).addClass('is-invalid')
    $(`#${formName}_referenced_transaction`).val($.t('loading_please_wait')).addClass('is-invalid')

    const issueAssetTx: GetTransactionResponse = await sendRequest('getTransaction', { transaction: assetId })
    if (issueAssetTx.errorCode) {
        $(`#${formName}_name_plus_asset`).val($.t('error'))
        $(`#${formName}_referenced_transaction`).val($.t('error'))
        return
    }

    $(`#${formName}_name_plus_asset`)
        .val(assetId + ' - ' + issueAssetTx.attachment.name)
        .removeClass('is-invalid')
    $(`#${formName}_referenced_transaction`).val(issueAssetTx.fullHash).removeClass('is-invalid')
}

export function formsTransferAssetOwnership(data: any) {
    delete data.name_plus_asset
    return {
        data,
    }
}

export function formsAddAssetTreasuryAccount(data: any) {
    delete data.name_plus_asset
    return {
        data,
    }
}

export function formsTransferAssetMulti(data: any) {
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
        if (Number(data.quantity[i]) > Number(BRS.settings.asset_transfer_warning) && BRS.settings.asset_transfer_warning !== '0') {
            showWarning = true
        }
        try {
            data.assetIdsAndQuantities += data.asset[i] + ':' + parseQuantityToQNT(data.quantity[i], Number(data.decimals[i]))
        } catch (e) {
            return {
                error: $.t('error_incorrect_quantity_plus', {
                    err: (e as Error).message.escapeHTML(),
                }),
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
                qty: BRS.settings.asset_transfer_warning,
            }),
        }
    }
    return {
        data,
    }
}

export function formsTransferAsset(data: any) {
    if (!data.quantity) {
        return {
            error: $.t('error_not_specified', {
                name: getTranslatedFieldName('quantity').toLowerCase(),
            }).capitalize(),
        }
    }
    if (!data.amountNXT) {
        data.amountNXT = '0'
    }

    if (
        !BRS.showedFormWarning &&
        BRS.settings.asset_transfer_warning !== '0' &&
        Number(data.quantity) > Number(BRS.settings.asset_transfer_warning)
    ) {
        BRS.showedFormWarning = true
        return {
            error: $.t('error_max_asset_transfer_warning', {
                qty: BRS.settings.asset_transfer_warning,
            }),
        }
    }

    try {
        data.quantityQNT = parseQuantityToQNT(data.quantity, Number(data.decimals))
    } catch (e) {
        return {
            error: $.t('error_incorrect_quantity_plus', {
                err: (e as Error).message.escapeHTML(),
            }),
        }
    }

    delete data.quantity
    delete data.decimals
    delete data.name_plus_asset

    return {
        data,
    }
}

export function formsCancelOrder(data: any) {
    const requestType = data.cancel_order_type
    delete data.cancel_order_type
    let successMessage = $.t('success_cancelBuyOrder')
    if (requestType === 'cancelAskOrder') {
        successMessage = $.t('success_cancelAskOrder')
    }
    return {
        data,
        requestType,
        successMessage,
    }
}

export function formsAssetExchangeGroup(data: any) {
    function successMessageAndReloadSidebar() {
        setTimeout(function () {
            loadAssetExchangeSidebar()
            if (!groupName) {
                notify($.t('success_asset_group_removal'), { type: 'success' })
            } else {
                notify($.t('success_asset_group_add'), { type: 'success' })
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
            hide: true,
        }
    }

    dbPut(
        'assets',
        {
            asset: assetId,
            groupName,
        },
        function (error) {
            if (error) return
            successMessageAndReloadSidebar()
        },
    )

    return {
        stop: true,
        hide: true,
    }
}

export function formsIssueAsset(data: any) {
    const description: string = data.description.trim()
    if (!description) {
        return {
            error: $.t('error_description_required'),
        }
    }
    data.description = description

    if (!/^[a-zA-Z0-9]{1,10}$/.test(data.name)) {
        return {
            error: $.t('error_incorrect_name', { name: 'name' }),
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
            error: (e as Error).message,
        }
    }
    delete data.quantity

    return {
        data,
    }
}

export function formsAssetExchangeChangeGroupName(data: any) {
    const oldGroupName = data.old_group_name
    const newGroupName = data.new_group_name

    if (!newGroupName.match(/^[a-z0-9 ]+$/i)) {
        return {
            error: $.t('error_group_name'),
        }
    }

    const itemsToUpdate: { asset: string; groupName: string }[] = []
    BRS.assets.forEach((asset) => {
        if (!asset.bookmarked) return
        if (asset.groupName === oldGroupName) {
            asset.groupName = newGroupName
            itemsToUpdate.push({ asset: asset.asset, groupName: newGroupName })
        }
    })

    if (!BRS.databaseSupport) {
        notify($.t('success_group_name_update'), { type: 'success' })
        loadAssetExchangeSidebar()
        return {
            stop: true,
            hide: true,
        }
    }

    dbPut('assets', itemsToUpdate, function (error) {
        if (error) {
            notify($.t('error_save_db'), { type: 'danger' })
            return
        }
        loadAssetExchangeSidebar()
        notify($.t('success_group_name_update'), { type: 'success' })
    })

    return {
        stop: true,
        hide: true,
    }
}

export function showAssetOrderModal(assetId: string, orderType: 'buy' | 'sell') {
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
        notify('Invalid input.', { type: 'danger' })
        return
    }

    if (priceNQT === '0' || quantityQNT === '0') {
        notify($.t('error_amount_price_required'), { type: 'danger' })
        return
    }

    const priceNQTPerWholeQNT = BigInt(priceNQT) * BigInt(Math.pow(10, BRS.currentAsset.decimals))
    let description: string
    let tooltipTitle: string
    if (orderType === 'buy') {
        description = $.t('buy_order_description', {
            quantity: formatQNTAsQuantity(quantityQNT, BRS.currentAsset.decimals),
            asset_name: $('#asset_name').html().escapeHTML(),
            burst: formatNQTAsAmount(priceNQTPerWholeQNT),
            valueSuffix: BRS.valueSuffix,
        })
        tooltipTitle = $.t('buy_order_description_help', {
            burst: formatNQTAsAmount(priceNQTPerWholeQNT),
            total_burst: totalNXT,
            valueSuffix: BRS.valueSuffix,
        })
    } else {
        description = $.t('sell_order_description', {
            quantity: formatQNTAsQuantity(quantityQNT, BRS.currentAsset.decimals),
            asset_name: $('#asset_name').html().escapeHTML(),
            burst: formatNQTAsAmount(priceNQTPerWholeQNT),
            valueSuffix: BRS.valueSuffix,
        })
        tooltipTitle = $.t('sell_order_description_help', {
            burst: formatNQTAsAmount(priceNQTPerWholeQNT),
            total_burst: totalNXT,
            valueSuffix: BRS.valueSuffix,
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
            trigger: 'hover',
        })
    } else {
        $('#asset_order_total_tooltip').hide()
    }

    // Set modal form values ()
    $('#asset_order_type').val(orderType === 'buy' ? 'placeBidOrder' : 'placeAskOrder')
    $('#asset_order_asset').val(assetId)
    $('#asset_order_quantity').val(quantityQNT)
    $('#asset_order_price').val(priceNQT)

    showModal('asset_order')
}

export function formsOrderAsset(data: any) {
    const requestType = data.asset_order_type
    delete data.asset_order_type
    return {
        requestType,
        successMessage: requestType === 'placeBidOrder' ? $.t('success_buyOrderAsset') : $.t('success_sellOrderAsset'),
        errorMessage: $.t('error_orderAsset'),
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
            $list.append(
                `<li><a class='dropdown-item' href='#' data-name='${asset.name}' data-asset='${asset.asset}' data-decimals='${asset.decimals}'>${asset.name} - ${asset.asset}</a></li>`,
            )
        }
    }
}

export function formsMintAsset(data: any) {
    if (!data.quantity) {
        return {
            error: $.t('error_not_specified', {
                name: getTranslatedFieldName('quantity').toLowerCase(),
            }).capitalize(),
        }
    }

    try {
        data.quantityQNT = parseQuantityToQNT(data.quantity, Number(data.decimals))
    } catch (e) {
        return {
            error: $.t('error_incorrect_quantity_plus', {
                err: (e as Error).message.escapeHTML(),
            }),
        }
    }

    delete data.quantity
    delete data.decimals
    delete data.name_plus_asset

    return {
        data,
    }
}

export function formsDistributeToAssetHolders(data: any) {
    if (!data.quantity && !data.amountNXT) {
        return {
            error: $.t('error_not_specified', {
                name: getTranslatedFieldName('quantity_and_or_amount').toLowerCase(),
            }).capitalize(),
        }
    }
    if (!data.holders_asset) {
        return {
            error: $.t('error_not_specified', {
                name: getTranslatedFieldName('to_holders_of').toLowerCase(),
            }).capitalize(),
        }
    }
    if (!data.quantityMinimum) {
        data.quantityMinimumQNT = '0'
    } else {
        if (!data.holders_decimals) {
            return {
                error: $.t('error_not_specified', {
                    name: getTranslatedFieldName('to_holders_of').toLowerCase(),
                }).capitalize(),
            }
        }
        try {
            data.quantityMinimumQNT = parseQuantityToQNT(data.quantityMinimum, Number(data.holders_decimals))
        } catch (e) {
            return {
                error: $.t('error_incorrect_quantity_plus', {
                    err: (e as Error).message.escapeHTML(),
                }),
            }
        }
    }
    if (!data.asset) {
        data.asset = '0'
        data.quantityQNT = '0'
    } else {
        try {
            data.quantityQNT = parseQuantityToQNT(data.quantity, Number(data.decimals))
        } catch (e) {
            return {
                error: $.t('error_incorrect_quantity_plus', {
                    err: (e as Error).message.escapeHTML(),
                }),
            }
        }
    }

    delete data.quantity
    delete data.decimals
    delete data.name_plus_asset
    data.assetToDistribute = data.asset
    data.asset = data.holders_asset
    delete data.holders_asset
    delete data.holders_decimals
    delete data.quantityMinimum

    return {
        data,
    }
}

export async function showAssetHoldersModal(asset: string) {
    if (BRS.fetchingModalData) {
        return
    }
    BRS.fetchingModalData = true
    const response: GetAssetAccountsResponse = await sendRequest('getAssetAccounts', {
        asset,
        ignoreTreasury: false,
        firstIndex: 0,
        lastIndex: BRS.pageSize,
    })
    BRS.fetchingModalData = false
    if (response.errorCode) {
        $('#asset_holders_modal_table tbody').text($.t('error_asset_not_found'))
        $('#asset_holders_modal').modal('show')
        return
    }
    if (response.accountAssets.length === 0) {
        $('#asset_holders_modal_table tbody').text('')
        $('#asset_holders_modal').modal('show')
        return
    }
    const assetDetails = getAssetFromCache(response.accountAssets[0].asset)
    if (!assetDetails) {
        return
    }
    const treasuryHTML = `&nbsp;<i title="${$.t('treasury_account')}" class="fas fa-briefcase"></i>`
    let qnt = 0n
    let rows = ''
    for (const holder of response.accountAssets) {
        rows += `
            <tr>
              <td><a href='#modal=user_info&user=${holder.accountRS}'>${getAccountTitleFromObject(holder, 'account')}</a> ${holder.isTreasury ? treasuryHTML : ''}</td>
              <td>${formatQNTAsQuantity(holder.quantityQNT, assetDetails.decimals)}</td>
              <td>${holder.isTreasury ? '/' : calculatePercentage(holder.quantityQNT, assetDetails.quantityCirculatingQNT) + '%'}</td>
            </tr>`
        if (!holder.isTreasury) {
            qnt += BigInt(holder.quantityQNT)
        }
    }
    if (qnt !== BigInt(assetDetails.quantityCirculatingQNT)) {
        const otherQNT = (BigInt(assetDetails.quantityCirculatingQNT) - qnt).toString()
        rows += `
            <tr>
              <td>${$.t('others')}</td>
              <td>${formatQNTAsQuantity(otherQNT, assetDetails.decimals)}</td>
              <td>${calculatePercentage(otherQNT, assetDetails.quantityCirculatingQNT) + '%'}</td>
            </tr>`
    }

    $('#asset_holders_modal_table tbody').html(rows)
    showModal('asset_holders')
}

export function showCancelOrderModal(orderId: string, orderType: 'bid' | 'ask') {
    if (orderType === 'bid') {
        $('#cancel_order_type').val('cancelBidOrder')
    } else {
        $('#cancel_order_type').val('cancelAskOrder')
    }
    $('#cancel_order_order').val(orderId)
    showModal('cancel_order')
}

export function showTransferAssetModal(asset: string, name: string, decimals: string) {
    const $formGroupOrdinary = $('#form-transfer-asset .form-group').first()
    populateAssetSelector(asset, name, decimals, $formGroupOrdinary)
    const $formGroupMulti = $('#form-multi-transfer .form-group').first()
    populateAssetSelector(asset, name, decimals, $formGroupMulti)

    showModal('transfer_asset')
}

export function showMintAssetModal(asset: string, name: string, decimals: string) {
    const $formGroup = $('#form-mint-asset .form-group').first()
    populateAssetSelector(asset, name, decimals, $formGroup)

    showModal('mint_asset')
}

export function showTransferAssetOwnershipModal(asset: string) {
    showModal('transfer_asset_ownership')

    populateReferencedAsset(asset, 'transfer_asset_ownership')
}

export function showAddAssetTreasuryAccountModal(asset: string) {
    showModal('add_asset_treasury_account')

    populateReferencedAsset(asset, 'add_asset_treasury_account')
}
