import { BRS } from '..'

import { sendRequest } from '../core/send_request'

import { formatNQTAsAmount, formatTimestampAsDateTime, convertSecondsToDuration } from '../core/numbers'

import { dataLoaded, getAccountTitleFromObject, getUnconfirmedTransactionsFromCache } from '../core/util'

import { GetAccountSubscriptionsResponse, Subscription } from '../typings'
import { isAliasSubscription } from '../tools/subscriptions'
import { reloadCurrentPage } from '../core/navigation'

// Current page is 'subscription'
// Processing unconfirmed!

export async function pagesSubscription() {
    const response: GetAccountSubscriptionsResponse = await sendRequest('getAccountSubscriptions', {
        account: BRS.account,
    })
    if (response.errorCode) {
        dataLoaded(response.errorDescription)
    }

    const unconfirmedTX = getUnconfirmedTransactionsFromCache(21, 3) ?? []

    const unconfSubscriptions: Subscription[] = unconfirmedTX.map((tx) => {
        return {
            id: tx.transaction,
            sender: tx.sender,
            senderRS: tx.senderRS,
            recipient: tx.recipient as string,
            recipientRS: tx.recipientRS as string,
            amountNQT: tx.amountNQT,
            frequency: tx.attachment.frequency,
            timeNext: tx.timestamp,
            timestamp: tx.timestamp,
        }
    })

    const subscriptions = unconfSubscriptions.concat(response.subscriptions)

    if (subscriptions.length === 0) {
        dataLoaded('')
    }
    let rows = ''
    for (const subscription of subscriptions) {
        const subscriptionId = subscription.id
        const timeInterval = convertSecondsToDuration(subscription.frequency)
        let isAlias = '/'
        if (isAliasSubscription(subscription)) {
            isAlias = subscription.aliasName
            if (subscription.tld !== '0') {
                isAlias += '.' + subscription.tldName
            }
        }
        let actions = ''
        if (subscription.sender === BRS.account) {
            actions = `<a href="#modal=subscription_cancel&subscription=${subscriptionId}"><i class="fas fa-trash"></i></a>`
        }
        if (subscription.timestamp === subscription.timeNext) {
            actions = BRS.pendingTransactionHTML
        }
        rows += `
            <tr>
              <td>${subscriptionId}</td>
              <td>${getAccountTitleFromObject(subscription, 'sender')}</td>
              <td>${getAccountTitleFromObject(subscription, 'recipient')}</td>
              <td>${isAlias}</td>
              <td>${formatNQTAsAmount(subscription.amountNQT)}</td>
              <td>${BRS.durationFormatter.format({ seconds: subscription.frequency })} - ${BRS.durationFormatter.format(timeInterval)}</td>
              <td>${formatTimestampAsDateTime(subscription.timeNext)}</td>
              <td>${actions}</td>
            </tr>`
    }
    dataLoaded(rows)
}

export function incomingSubscription() {
    if (BRS.checkIncoming.newTransactions || BRS.checkIncoming.unconfirmedChanged) {
        reloadCurrentPage()
    }
}
