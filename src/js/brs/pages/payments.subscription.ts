import { BRS } from '..'

import { sendRequest } from '../core/send_request'

import { formatNQTAsAmount, formatTimestampAsDateTime, convertSecondsToDuration } from '../core/numbers'

import { dataLoaded, getAccountTitleFromObject } from '../core/util'

import { GetAccountSubscriptionsResponse } from '../typings'
import { isAliasSubscription } from '../tools/subscriptions'

// Current page is 'subscriptions'
// Do not handle unconfirmed neither new blocks nor transactions.

export async function pagesSubscription() {
    const response: GetAccountSubscriptionsResponse = await sendRequest('getAccountSubscriptions', {
        account: BRS.account,
    })

    if (!response.subscriptions || response.subscriptions.length === 0) {
        dataLoaded('')
    }
    let rows = ''
    for (const subscription of response.subscriptions) {
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
