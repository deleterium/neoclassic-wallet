import { BRS } from '.'

import { sendRequest } from './brs.sendRequest'

import {
    formatNQTAsAmount,
    formatTimestampAsDateTime
} from './brs.numbers'

import { Subscription, GetSubscriptionResponse } from '../typings'

export function showSubscriptionCancelModal (subscription: string | Subscription) {
    if (BRS.fetchingModalData) {
        return
    }
    if (typeof subscription !== 'object') {
        BRS.fetchingModalData = true
        sendRequest('getSubscription', {
            subscription
        }, function (response: GetSubscriptionResponse) {
            BRS.fetchingModalData = false
            if (response.errorCode) {
                $.notify($.t('no_transactions_found'))
                return
            }
            processSubscriptionCancelModalData(response)
        })
        return
    }
    processSubscriptionCancelModalData(subscription)
}

function processSubscriptionCancelModalData (subscription: Subscription) {
    $('#subscription_cancel_subscription_text').val(subscription.id)
    $('#subscription_cancel_subscription').val(subscription.id)
    $('#subscription_cancel_sender').text(subscription.senderRS)
    $('#subscription_cancel_recipient').text(subscription.recipientRS)
    $('#subscription_cancel_amount').text(formatNQTAsAmount(subscription.amountNQT))
    $('#subscription_cancel_frequency').text(subscription.frequency)
    $('#subscription_cancel_time_next').text(formatTimestampAsDateTime(subscription.timeNext))

    $('#subscription_cancel_modal').modal('show')
}
