/**
 * @depends {brs.js}
 * @depends {brs.modals.js}
 */

import { BRS } from '.'

import { sendRequest } from './brs.server'

import {
    formatAmount,
    formatTimestamp
} from './brs.util'

export function showSubscriptionCancelModal (subscription) {
    if (BRS.fetchingModalData) {
        return
    }

    BRS.fetchingModalData = true

    if (typeof subscription !== 'object') {
        sendRequest('getSubscription', {
            subscription
        }, function (response) {
            processSubscriptionCancelModalData(response)
        })
    } else {
        processSubscriptionCancelModalData(subscription)
    }
}

export function processSubscriptionCancelModalData (subscription) {
    $('#subscription_cancel_subscription_text').val(subscription.id)
    $('#subscription_cancel_subscription').val(subscription.id)
    $('#subscription_cancel_sender').html(subscription.senderRS)
    $('#subscription_cancel_recipient').html(subscription.recipientRS)
    $('#subscription_cancel_amount').html(formatAmount(subscription.amountNQT))
    $('#subscription_cancel_frequency').html(subscription.frequency)
    $('#subscription_cancel_time_next').html(formatTimestamp(subscription.timeNext))

    $('#subscription_cancel_modal').modal('show')
    BRS.fetchingModalData = false
}
