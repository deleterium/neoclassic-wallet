import { BRS } from '..'
import { formatQNTAsQuantity, formatPriceNQTAsPriceQuantity, calculateOrderTotalNQT, formatNQTAsAmount } from '../core/numbers'
import { sendRequestA } from '../core/send_request'
import { dataLoaded } from '../core/util'
import { AssetBalance, GetAskOrdersResponse, GetAssetResponse, GetBidOrdersResponse, MyAssetDetails } from '../typings'

export async function pagesMyAssets() {
    if (!BRS.accountInfo.assetBalances || !BRS.accountInfo.assetBalances.length) {
        dataLoaded()
        return
    }
    const myAssets: MyAssetDetails[] = []
    const nonCachedAssets: AssetBalance[] = []

    if (BRS.requestController?.getPendingRequestsCount()) {
        // Wait until all assets are fetched on first login. Once that done, all user assets will be cached.
        await sendRequestA('getBlockchainStatus+', {})
    }

    for (const myAsset of BRS.accountInfo.assetBalances) {
        if (myAsset.balanceQNT === '0') {
            // Ignore this asset.
            continue
        }

        const foundAsset = BRS.assets.find((asset) => asset.asset === myAsset.asset)
        if (foundAsset) {
            myAssets.push({ balanceQNT: myAsset.balanceQNT, ...foundAsset })
        } else {
            nonCachedAssets.push(myAsset)
        }
    }

    // There was some error fetchins some assets during login. Try fetch assets again
    const fetchPromises = nonCachedAssets.map(async (myAsset) => {
        const asset: GetAssetResponse = await sendRequestA('getAsset+', {
            asset: myAsset.asset,
        })
        return { balanceQNT: myAsset.balanceQNT, ...asset }
    })

    const results = await Promise.allSettled(fetchPromises)

    // Process the results
    for (const result of results) {
        if (result.status === 'fulfilled' && !result.value.errorCode) {
            myAssets.push(result.value)
        }
    }

    myAssetsPageLoaded(myAssets)
}

function myAssetsPageLoaded(myAssets: MyAssetDetails[]) {
    if (BRS.currentPage !== 'my_assets') return

    myAssets.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

    let rows = ''
    for (const asset of myAssets) {
        rows += `
            <tr data-asset="${String(asset.asset).escapeHTML()}">
              <td><a href='#' data-goto-asset='${String(asset.asset).escapeHTML()}'>
                ${String(asset.name).escapeHTML()}</a>
              </td>
              <td class="quantity">${formatQNTAsQuantity(asset.balanceQNT, asset.decimals)}</td>
              <td>${formatQNTAsQuantity(asset.quantityCirculatingQNT, asset.decimals)}</td>
              <td id="ask-order-${String(asset.asset).escapeHTML()}">${BRS.pendingTransactionHTML}</i></td>
              <td id="bid-order-${String(asset.asset).escapeHTML()}">${BRS.pendingTransactionHTML}</td>
              <td id="value-order-${String(asset.asset).escapeHTML()}">${BRS.pendingTransactionHTML}</td>
              <td>
                <a href='#'
                  data-toggle='modal'
                  data-target='#transfer_asset_modal'
                  data-asset='${String(asset.asset).escapeHTML()}'
                  data-name='${String(asset.name).escapeHTML()}'
                  data-decimals='${String(asset.decimals).escapeHTML()}'>
                  ${$.t('transfer')}
                </a>
              </td>
            </tr>`
    }

    // Initial page loaded, fetch order details asynchronously
    for (const asset of myAssets) {
        sendRequestA('getAskOrders+', {
            asset: asset.asset,
            firstIndex: 0,
            lastIndex: 0,
        }).then((response: GetAskOrdersResponse) => {
            if (BRS.currentPage !== 'my_assets') {
                return
            }

            if (response.errorCode || !response.askOrders || response.askOrders.length === 0) {
                updateAskOrderCell(asset.asset)
                return
            }
            updateAskOrderCell(response.askOrders[0].asset, response.askOrders[0].priceNQT, response.askOrders[0].decimals)
        })

        sendRequestA('getBidOrders+', {
            asset: asset.asset,
            firstIndex: 0,
            lastIndex: 0,
        }).then((response: GetBidOrdersResponse) => {
            if (BRS.currentPage !== 'my_assets') {
                return
            }

            if (response.errorCode || !response.bidOrders || response.bidOrders.length === 0) {
                updateBidOrderCell(asset.asset)
                return
            }
            updateBidOrderCell(
                response.bidOrders[0].asset,
                response.bidOrders[0].priceNQT,
                response.bidOrders[0].decimals,
                asset.balanceQNT,
            )
        })
    }

    dataLoaded(rows)
}

function updateAskOrderCell(assetId: string, priceNQT?: string, decimals?: number) {
    const cellSelector = '#ask-order-' + assetId.escapeHTML()
    if (!priceNQT || !decimals) {
        $(cellSelector).text('--')
        return
    }
    $(cellSelector).text(formatPriceNQTAsPriceQuantity(priceNQT, decimals))
}

function updateBidOrderCell(assetId: string, priceNQT?: string, decimals?: number, userBalanceQNT?: string) {
    const orderSelector = '#bid-order-' + assetId.escapeHTML()
    const valueSelector = '#value-order-' + assetId.escapeHTML()
    if (!priceNQT || !decimals || !userBalanceQNT) {
        $(orderSelector).text('--')
        $(valueSelector).text('--')
        return
    }
    $(orderSelector).text(formatPriceNQTAsPriceQuantity(priceNQT, decimals))
    const totalNQT = calculateOrderTotalNQT(userBalanceQNT, priceNQT)
    $(valueSelector).text(formatNQTAsAmount(totalNQT))
}

export function incomingMyAssets() {
    // reloadCurrentPage()
}
