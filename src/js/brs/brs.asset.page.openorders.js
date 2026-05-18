import { BRS } from '.';
import { pageLoaded, reloadCurrentPage } from './brs';
import { getAssetDetails } from './brs.asset.tools';
import { calculateOrderTotalNQT, formatQNTAsQuantity, formatPriceNQTAsPriceQuantity, formatNQTAsAmount } from './brs.numbers';
import { sendRequest } from './brs.server';
import { dataLoadFinished, hasTransactionUpdates } from './brs.util';

export function pagesOpenOrders() {
    let loaded = 0;
    function allLoaded() {
        loaded++;
        if (loaded === 2) {
            pageLoaded();
        }
    }
    getOpenOrders('ask', allLoaded);
    getOpenOrders('bid', allLoaded);
}

function getOpenOrders(type, callback) {
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);

    const getCurrentOrderIds = `getAccountCurrent${capitalizedType}OrderIds+`;
    const orderIds = `${type}OrderIds`;
    const getOrder = `get${capitalizedType}Order+`;

    const orders = [];

    function allOrdersLoaded() {
        if (BRS.currentPage !== 'open_orders') {
            return;
        }
        openOrdersLoaded(orders.concat(getUnconfirmedOrders(type)), type, callback);
    }

    sendRequest(getCurrentOrderIds, {
        account: BRS.account
    }, function (response) {
        if (response[orderIds] === undefined || response[orderIds].length === 0) {
            allOrdersLoaded();
            return;
        }
        let nr_orders = 0;
        for (const eachOrder of response[orderIds]) {
            sendRequest(getOrder, {
                order: eachOrder
            }, function (order) {
                sendRequest('getTransaction', {
                    transaction: eachOrder
                }, function (originalOrder) {
                    if (originalOrder.errorCode === undefined) {
                        order.originalQuantityQNT = originalOrder.attachment.quantityQNT;
                    }
                    orders.push(order);
                    nr_orders++;
                    if (nr_orders === response[orderIds].length) {
                        allOrdersLoaded();
                    }
                });
            });
            if (BRS.currentPage !== 'open_orders') {
                return;
            }
        }
    });
}

function getUnconfirmedOrders(type) {
    const unconfirmedOrders = [];
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
            });
        }
    }
    return unconfirmedOrders;
}

function openOrdersLoaded(orders, type, callback) {
    if (!orders.length) {
        $('#open_' + type + '_orders_table tbody').empty();
        dataLoadFinished($('#open_' + type + '_orders_table'));

        callback();

        return;
    }

    orders.forEach(obj => {
        const assetDetails = getAssetDetails(obj.asset);
        if (assetDetails) {
            obj.assetName = assetDetails.name;
            obj.assetDecimals = assetDetails.decimals;
        } else {
            obj.assetName = 'undefined';
            obj.assetDecimals = 0;
        }
    });
    orders.sort(function (a, b) {
        if (a.assetName.toLowerCase() > b.assetName.toLowerCase()) {
            return 1;
        } else if (a.assetName.toLowerCase() < b.assetName.toLowerCase()) {
            return -1;
        } else {
            if (a.quantity * a.price > b.quantity * b.price) {
                return 1;
            } else if (a.quantity * a.price < b.quantity * b.price) {
                return -1;
            } else {
                return 0;
            }
        }
    });

    let rows = '';

    for (const completeOrder of orders) {
        let cancelled = false;
        for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
            if (unconfirmedTransaction.type === 2 &&
                unconfirmedTransaction.subtype === (type === 'ask' ? 4 : 5) &&
                unconfirmedTransaction.attachment.order === completeOrder.order) {
                cancelled = true;
                break;
            }
        }

        completeOrder.priceNQT = new BigInteger(completeOrder.priceNQT);
        completeOrder.quantityQNT = new BigInteger(completeOrder.quantityQNT);
        completeOrder.totalNQT = new BigInteger(calculateOrderTotalNQT(completeOrder.quantityQNT, completeOrder.priceNQT));
        completeOrder.originalQuantityQNT = new BigInteger(completeOrder.originalQuantityQNT);
        const filled = new BigInteger('100').subtract(completeOrder.quantityQNT.multiply(new BigInteger('100')).divide(completeOrder.originalQuantityQNT)).toString() + '%';

        let rowClass = '';
        if (cancelled) {
            rowClass = "class='tentative tentative-crossed'";
        } else {
            if (completeOrder.tentative) {
                rowClass = "class='tentative'";
            }
        }
        let cancelText = '';
        if (rowClass === '') {
            cancelText = `<a href='#' data-toggle='modal' data-target='#cancel_order_modal' data-order='${completeOrder.order}' data-type='${type}'><i class="fas fa-trash"></i></a>`;
        }

        rows += `
            <tr data-order='${completeOrder.order}' ${rowClass}>
                <td><a href='#' data-goto-asset='${completeOrder.asset}'>${completeOrder.assetName}</a></td>
                <td>${formatQNTAsQuantity(completeOrder.originalQuantityQNT, completeOrder.assetDecimals)}</td>
                <td>${filled}</td>
                <td>${formatPriceNQTAsPriceQuantity(completeOrder.priceNQT, completeOrder.assetDecimals)}</td>
                <td>${formatNQTAsAmount(completeOrder.totalNQT)}</td>
                <td class='cancel'>${cancelText}</td>
            </tr>`;
    }

    $('#open_' + type + '_orders_table tbody').empty().append(rows);

    dataLoadFinished($('#open_' + type + '_orders_table'));
    orders = {};

    callback();
}

export function incomingOpenOrders(transactions) {
    if (hasTransactionUpdates(transactions)) {
        reloadCurrentPage();
    }
}
