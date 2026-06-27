import { BRS } from '..'
import { AnyAssetOrder, GetTransactionResponse, UNCONFIRMED_HEIGHT } from '../typings'
import { pageLoaded, reloadCurrentPage } from '../core/navigation'
import { getAssetDetails } from '../tools/assets'
import { calculateOrderTotalNQT, formatQNTAsQuantity, formatPriceNQTAsPriceQuantity, formatNQTAsAmount } from '../core/numbers'
import { sendRequestA } from '../core/send_request'
import { dataLoadFinished } from '../core/util'

export async function pagesOpenOrders() {
    const askOrders = await getOpenOrders('ask')
    const bidOrders = await getOpenOrders('bid')

    pageLoaded()

    const allOrders = [...askOrders, ...bidOrders]
    fetchAllTransactionDetails(allOrders)
}

async function getOpenOrders(type: 'ask' | 'bid') {
    const getCurrentOrders = `getAccountCurrent${type.capitalize()}Orders+`
    const typeOrderName = `${type}Orders`

    const response = await sendRequestA(getCurrentOrders, {
        account: BRS.account,
    })

    if (response[typeOrderName] === undefined || response[typeOrderName].length === 0) {
        drawOrdersTable(await getUnconfirmedOrders(type), type)
        return []
    }

    const anyOrders: AnyAssetOrder[] = response[typeOrderName]
    anyOrders.sort(function (a, b) {
        if (a.name.toLowerCase() > b.name.toLowerCase()) {
            return 1
        }
        if (a.name.toLowerCase() < b.name.toLowerCase()) {
            return -1
        }
        if (BigInt(a.priceNQT) > BigInt(b.priceNQT)) {
            return 1
        }
        if (BigInt(a.priceNQT) > BigInt(b.priceNQT)) {
            return -1
        }
        return 0
    })

    drawOrdersTable(response[typeOrderName].concat(getUnconfirmedOrders(type)), type)
    return anyOrders
}

async function fetchAllTransactionDetails(orders: AnyAssetOrder[]) {
    orders.forEach(async (order) => {
        const startingOrder: GetTransactionResponse = await sendRequestA('getTransaction+', {
            transaction: order.order,
        })
        fillOrderDetails(
            order.order,
            order.decimals,
            order.quantityQNT,
            startingOrder.errorCode ? undefined : startingOrder.attachment.quantityQNT,
        )
    })
}

function fillOrderDetails(orderId: string, decimals: number, currentQNT: string, startingQNT?: string) {
    if (!startingQNT) {
        $(`#order${orderId}percent`).text('??')
        return
    }
    $(`#order${orderId}total`).text(formatQNTAsQuantity(startingQNT, decimals))
    $(`#order${orderId}percent`).text((100n - (BigInt(currentQNT) * 100n) / BigInt(startingQNT)).toString() + '%')
}

async function getUnconfirmedOrders(type: 'ask' | 'bid') {
    const unconfirmedOrders: AnyAssetOrder[] = []
    for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
        if (unconfirmedTransaction.type === 2 && unconfirmedTransaction.subtype === (type === 'ask' ? 2 : 3)) {
            const foundAsset = await getAssetDetails(unconfirmedTransaction.attachment.asset)
            unconfirmedOrders.push({
                account: unconfirmedTransaction.sender,
                accountRS: unconfirmedTransaction.senderRS,
                asset: unconfirmedTransaction.attachment.asset,
                name: foundAsset ? foundAsset.name : '',
                decimals: foundAsset ? foundAsset.decimals : 0,
                height: UNCONFIRMED_HEIGHT, // indicate that transaction is unconfirmed!
                order: unconfirmedTransaction.transaction,
                priceNQT: unconfirmedTransaction.attachment.priceNQT,
                quantityQNT: unconfirmedTransaction.attachment.quantityQNT,
                type,
                price: '',
            })
        }
    }
    return unconfirmedOrders
}

function drawOrdersTable(orders: AnyAssetOrder[], type: 'ask' | 'bid') {
    if (!orders.length) {
        $('#open_' + type + '_orders_table tbody').empty()
        dataLoadFinished($('#open_' + type + '_orders_table'))
        return
    }

    let rows = ''

    for (const completeOrder of orders) {
        let cancelled = false
        for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
            if (
                unconfirmedTransaction.type === 2 &&
                unconfirmedTransaction.subtype === (type === 'ask' ? 4 : 5) &&
                unconfirmedTransaction.attachment.order === completeOrder.order
            ) {
                cancelled = true
                break
            }
        }

        const totalNQT = calculateOrderTotalNQT(completeOrder.quantityQNT, completeOrder.priceNQT)

        let rowClass = ''
        if (cancelled) {
            rowClass = "class='text-muted text-line-through'"
        } else {
            if (completeOrder.height === 0) {
                rowClass = "class='text-muted'"
            }
        }
        let cancelText = ''
        if (rowClass === '') {
            cancelText = `<a href='#' data-toggle='modal' data-target='#cancel_order_modal' data-order='${completeOrder.order}' data-type='${type}'><i class="fas fa-trash"></i></a>`
        } else {
            cancelText = BRS.pendingTransactionHTML
        }

        rows += `
            <tr data-order='${completeOrder.order}' ${rowClass}>
                <td><a href='#' data-goto-asset='${completeOrder.asset.escapeHTML()}'>${completeOrder.name.escapeHTML()}</a></td>
                <td id='order${completeOrder.order}total'>${formatQNTAsQuantity(completeOrder.quantityQNT, completeOrder.decimals)}</td>
                <td id='order${completeOrder.order}percent'>${completeOrder.height === 0 ? '' : BRS.pendingTransactionHTML}</td>
                <td>${formatPriceNQTAsPriceQuantity(completeOrder.priceNQT, completeOrder.decimals)}</td>
                <td>${formatNQTAsAmount(totalNQT)}</td>
                <td class='cancel'>${cancelText}</td>
            </tr>`
    }

    $('#open_' + type + '_orders_table tbody')
        .empty()
        .append(rows)

    dataLoadFinished($('#open_' + type + '_orders_table'))
}

export function incomingOpenOrders() {
    if (BRS.checkIncoming.newTransactions || BRS.checkIncoming.unconfirmedChanged) {
        reloadCurrentPage()
    }
}
