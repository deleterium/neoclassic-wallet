import { BRS } from '..'

import { sendRequestA } from '../core/send_request'

import { formatNQTAsAmount, formatTimestampAsDateTime, convertSecondsToDuration } from '../core/numbers'

import { dataLoaded } from '../core/util'

import { GetAccountSubscriptionsResponse } from '../typings'

export async function pagesSubscription() {
    const response: GetAccountSubscriptionsResponse = await sendRequestA('getAccountSubscriptions', {
        account: BRS.account,
    })

    if (!response.subscriptions || response.subscriptions.length === 0) {
        dataLoaded('')
    }
    let rows = ''
    for (const subscription of response.subscriptions) {
        const subscriptionId = String(subscription.id).escapeHTML()
        const timeInterval = convertSecondsToDuration(subscription.frequency)
        rows += `
            <tr>
              <td>
                <a href="#" data-subscription="${subscriptionId}">
                    ${subscriptionId}
                </a>
              </td>
              <td>${String(subscription.senderRS).escapeHTML()}</td>
              <td>${String(subscription.recipientRS).escapeHTML()}</td>
              <td>${formatNQTAsAmount(subscription.amountNQT)}</td>
              <td>${BRS.durationFormatter.format({ seconds: subscription.frequency })} - ${BRS.durationFormatter.format(timeInterval)}</td>
              <td>${formatTimestampAsDateTime(subscription.timeNext)}</td>
            </tr>`
    }
    dataLoaded(rows)
}
