import { BRS } from '.';
import { reloadCurrentPage } from './brs.navigation';
import { formatQNTAsQuantity, formatPriceNQTAsPriceQuantity, calculateOrderTotalNQT, formatNQTAsAmount } from './brs.numbers';
import { sendRequest } from './brs.sendRequest';
import { dataLoaded } from './brs.util';
import { GetAskOrdersResponse, GetAssetResponse, GetBidOrdersResponse, MyAssetDetails } from '../typings';

export function pagesMyAssets() {
    if (!BRS.accountInfo.assetBalances || !BRS.accountInfo.assetBalances.length) {
        dataLoaded();
        return;
    }
    const myAssets: MyAssetDetails[] = []
    const count = {
        total_assets: BRS.accountInfo.assetBalances.length,
        cachedAssets: 0,
        requestedAssets: 0,
        ignored_assets: 0
    };

    // First, fetch and display all asset details
    for (const myAsset of BRS.accountInfo.assetBalances) {
        if (myAsset.balanceQNT === '0') {
            count.ignored_assets++;
            continue;
        }

        const foundAsset = BRS.assets.find(asset => asset.asset === myAsset.asset);
        if (foundAsset) {
            myAssets.push({ balanceQNT: myAsset.balanceQNT, ...foundAsset })
            count.cachedAssets++;
            continue;
        }

        sendRequest('getAsset+', {
            asset: myAsset.asset,
            _extra: {
                balanceQNT: myAsset.balanceQNT
            }
        }, function (asset: GetAssetResponse, input: { asset: string, _extra: { balanceQNT: string }}) {
            if (BRS.currentPage !== 'my_assets') {
                return;
            }
            myAssets.push({balanceQNT: input._extra.balanceQNT, ...asset});
            count.requestedAssets++;
            if (checkMyAssetsPageLoaded()) {
                myAssetsPageLoaded(myAssets);
            }
        });
    }
    if (checkMyAssetsPageLoaded()) {
        myAssetsPageLoaded(myAssets);
    }

    function checkMyAssetsPageLoaded() {
        return count.cachedAssets + count.requestedAssets + count.ignored_assets === count.total_assets;
    }
}


function myAssetsPageLoaded(myAssets: MyAssetDetails[]) {
    let rows = '';

    myAssets.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

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
            </tr>`;
    }

    // Initial page loaded, fetch order details asynchronously
    for (const asset of myAssets) {
        sendRequest('getAskOrders+', {
            asset: asset.asset,
            firstIndex: 0,
            lastIndex: 0
        }, function (response: GetAskOrdersResponse, input: any) {
            if (BRS.currentPage !== 'my_assets') {
                return;
            }

            if (response.errorCode || !response.askOrders || response.askOrders.length === 0) {
                updateAskOrderCell(input.asset);
                return;
            }
            updateAskOrderCell(response.askOrders[0].asset, response.askOrders[0].priceNQT, response.askOrders[0].decimals);
        });

        sendRequest('getBidOrders+', {
            asset: asset.asset,
            firstIndex: 0,
            lastIndex: 0,
            _extra: {
                balanceQNT: asset.balanceQNT
            }
        }, function (response: GetBidOrdersResponse, input: any) {
            if (BRS.currentPage !== 'my_assets') {
                return;
            }

            if (response.errorCode || !response.bidOrders || response.bidOrders.length === 0) {
                updateBidOrderCell(input.asset);
                return;
            }
            updateBidOrderCell(response.bidOrders[0].asset, response.bidOrders[0].priceNQT, response.bidOrders[0].decimals, input._extra.balanceQNT);
        });
    }

    dataLoaded(rows);
}

function updateAskOrderCell(assetId: string, priceNQT?: string, decimals?: number) {
    const cellSelector = '#ask-order-' + assetId.escapeHTML();
    if (!priceNQT || ! decimals) {
        $(cellSelector).text('--');
        return;
    }
    $(cellSelector).text(formatPriceNQTAsPriceQuantity(priceNQT, decimals));
}

function updateBidOrderCell(assetId: string, priceNQT?: string, decimals?: number, userBalanceQNT?: string) {
    const orderSelector = '#bid-order-' + assetId.escapeHTML();
    const valueSelector = '#value-order-' + assetId.escapeHTML();
    if (!priceNQT || ! decimals || !userBalanceQNT) {
        $(orderSelector).text('--');
        $(valueSelector).text('--');
        return;
    }
    $(orderSelector).text(formatPriceNQTAsPriceQuantity(priceNQT, decimals));
    const totalNQT = calculateOrderTotalNQT(userBalanceQNT, priceNQT);
    $(valueSelector).text(formatNQTAsAmount(totalNQT));
}

export function incomingMyAssets() {
    reloadCurrentPage();
}
