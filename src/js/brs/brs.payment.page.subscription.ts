import { BRS } from '.'

import { sendRequest } from './brs.sendRequest'

import {
    formatNQTAsAmount,
    formatTimestampAsDateTime
} from './brs.numbers'

import {
    dataLoaded
} from './brs.util'

import { GetAccountSubscriptionsResponse } from '../typings'

import { secondsToDuration } from './brs'

export function pagesSubscription () {
    sendRequest('getAccountSubscriptions', {
        account: BRS.account
    }, function (response: GetAccountSubscriptionsResponse) {
        if (!response.subscriptions || response.subscriptions.length === 0) {
            dataLoaded('')
        }
        let rows = '';
        for (const subscription of response.subscriptions) {
            const subscriptionId = String(subscription.id).escapeHTML()
            const timeInterval = secondsToDuration(subscription.frequency)
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
                  <td>${BRS.durationFormatter.format({seconds: subscription.frequency})} - ${BRS.durationFormatter.format(timeInterval)}</td>
                  <td>${formatTimestampAsDateTime(subscription.timeNext)}</td>
                </tr>`
        }
        dataLoaded(rows)
    })
}
