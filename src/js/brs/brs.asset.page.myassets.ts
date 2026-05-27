import { BRS } from '.';
import { reloadCurrentPage } from './brs';
import { formatQNTAsQuantity, formatPriceNQTAsPriceQuantity, calculateOrderTotalNQT, formatNQTAsAmount } from './brs.numbers';
import { sendRequest } from './brs.server';
import { dataLoaded } from './brs.util';

export function pagesMyAssets() {
    if (!BRS.accountInfo.assetBalances || !BRS.accountInfo.assetBalances.length) {
        dataLoaded();
        return;
    }
    const result = {
        assets: [],
        bid_orders: {},
        ask_orders: {}
    };
    const count = {
        total_assets: BRS.accountInfo.assetBalances.length,
        cachedAssets: 0,
        requestedAssets: 0,
        ignored_assets: 0
    };

    // First, fetch and display all asset details
    for (let i = 0; i < BRS.accountInfo.assetBalances.length; i++) {
        if (BRS.accountInfo.assetBalances[i].balanceQNT === '0') {
            count.ignored_assets++;
            continue;
        }

        const foundAsset = BRS.assets.find(asset => asset.asset === BRS.accountInfo.assetBalances[i].asset);
        if (foundAsset) {
            result.assets.push({
                asset: foundAsset.asset,
                name: foundAsset.name,
                quantityCirculatingQNT: foundAsset.quantityCirculatingQNT,
                balanceQNT: new BigInteger(BRS.accountInfo.assetBalances[i].balanceQNT),
                quantityQNT: new BigInteger(foundAsset.quantityQNT),
                decimals: foundAsset.decimals
            });
            count.cachedAssets++;
            continue;
        }

        sendRequest('getAsset+', {
            asset: BRS.accountInfo.assetBalances[i].asset,
            _extra: {
                balanceQNT: BRS.accountInfo.assetBalances[i].balanceQNT
            }
        }, function (asset, input) {
            if (BRS.currentPage !== 'my_assets') {
                return;
            }

            asset.asset = input.asset;
            asset.balanceQNT = new BigInteger(input._extra.balanceQNT);
            asset.quantityQNT = new BigInteger(asset.quantityQNT);

            result.assets.push(asset);
            count.requestedAssets++;

            if (checkMyAssetsPageLoaded(count)) {
                myAssetsPageLoaded(result);
            }
        });
    }
    if (checkMyAssetsPageLoaded(count)) {
        myAssetsPageLoaded(result);
    }
}

function checkMyAssetsPageLoaded(count) {
    return count.cachedAssets + count.requestedAssets + count.ignored_assets === count.total_assets;
}

function myAssetsPageLoaded(result) {
    let rows = '';

    result.assets.sort(function (a, b) {
        if (a.name.toLowerCase() > b.name.toLowerCase()) {
            return 1;
        } else if (a.name.toLowerCase() < b.name.toLowerCase()) {
            return -1;
        } else {
            return 0;
        }
    });

    for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];

        rows += `
            <tr data-asset="${String(asset.asset).escapeHTML()}">
                <td><a href='#' data-goto-asset='${String(asset.asset).escapeHTML()}'>${String(asset.name).escapeHTML()}</a></td>
                <td class="quantity">${formatQNTAsQuantity(asset.balanceQNT, asset.decimals)}</td>
                <td>${formatQNTAsQuantity(asset.quantityCirculatingQNT, asset.decimals)}</td>
                <td id="ask-order-${String(asset.asset).escapeHTML()}">${BRS.pendingTransactionHTML}</i></td>
                <td id="bid-order-${String(asset.asset).escapeHTML()}">${BRS.pendingTransactionHTML}</td>
                <td id="value-order-${String(asset.asset).escapeHTML()}">${BRS.pendingTransactionHTML}</td>
                <td><a href='#' data-toggle='modal' data-target='#transfer_asset_modal' data-asset='${String(asset.asset).escapeHTML()}' data-name='${String(asset.name).escapeHTML()}' data-decimals='${String(asset.decimals).escapeHTML()}'>${$.t('transfer')}</a></td>
            </tr>`;
    }

    // Initial page loaded, fetch order details asynchronously
    for (let i = 0; i < BRS.accountInfo.assetBalances.length; i++) {
        if (BRS.accountInfo.assetBalances[i].balanceQNT === '0') {
            continue;
        }

        const assetId = BRS.accountInfo.assetBalances[i].asset;

        sendRequest('getAskOrders+', {
            asset: assetId,
            firstIndex: 0,
            lastIndex: 0
        }, function (response, input) {
            if (BRS.currentPage !== 'my_assets') {
                return;
            }

            if (response.errorCode || !response.askOrders || response.askOrders.length === 0) {
                updateAskOrderCell(input.asset, null);
                return;
            }
            updateAskOrderCell(response.askOrders[0].asset, response.askOrders[0].priceNQT, response.askOrders[0].decimals);
        });

        sendRequest('getBidOrders+', {
            asset: assetId,
            firstIndex: 0,
            lastIndex: 0,
            _extra: {
                balanceQNT: BRS.accountInfo.assetBalances[i].balanceQNT
            }
        }, function (response, input) {
            if (BRS.currentPage !== 'my_assets') {
                return;
            }

            if (response.errorCode || !response.bidOrders || response.bidOrders.length === 0) {
                updateBidOrderCell(input.asset, null);
                return;
            }
            updateBidOrderCell(response.bidOrders[0].asset, response.bidOrders[0].priceNQT, response.bidOrders[0].decimals, input._extra.balanceQNT);
        });
    }

    dataLoaded(rows);
}

function updateAskOrderCell(assetId, priceNQT, decimals) {
    const cellSelector = '#ask-order-' + assetId.escapeHTML();
    if (priceNQT === null) {
        $(cellSelector).text('--');
        return;
    }
    $(cellSelector).text(formatPriceNQTAsPriceQuantity(priceNQT, decimals));
}

function updateBidOrderCell(assetId, priceNQT, decimals, userBalanceQNT) {
    const orderSelector = '#bid-order-' + assetId.escapeHTML();
    const valueSelector = '#value-order-' + assetId.escapeHTML();
    if (priceNQT === null) {
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
