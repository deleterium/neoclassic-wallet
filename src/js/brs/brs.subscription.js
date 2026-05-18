/**
 * @depends {brs.js}
 */
import { BRS } from '.'

import { sendRequest } from './brs.server'

import {
    formatNQTAsAmount,
    formatTimestampAsDateTime
} from './brs.numbers'

import {
    dataLoaded
} from './brs.util'

export function pagesSubscription () {
    sendRequest('getAccountSubscriptions', {
        account: BRS.account
    }, function (response) {
        let rows = ''
        if (response.subscriptions && response.subscriptions.length) {
            for (let i = 0; i < response.subscriptions.length; i++) {
                rows += "<tr><td><a href='#' data-subscription='" + String(response.subscriptions[i].id).escapeHTML() + "'>" + String(response.subscriptions[i].id).escapeHTML() + '</a></td><td>' + String(response.subscriptions[i].senderRS).escapeHTML() + '</td><td>' + String(response.subscriptions[i].recipientRS).escapeHTML() + '</td><td>' + formatNQTAsAmount(response.subscriptions[i].amountNQT) + '</td><td>' + response.subscriptions[i].frequency + '</td><td>' + formatTimestampAsDateTime(response.subscriptions[i].timeNext) + '</td></tr>'
            }
        }
        dataLoaded(rows)
    })
}
