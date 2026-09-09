import { BRS } from '..'

import { sendRequest } from '../core/send_request'

import { formatNQTAsAmount, formatTimestampAsDateTime, parseAmountToNumber } from '../core/numbers'

import { Subscription, GetSubscriptionResponse } from '../typings'
import { notify } from '../core/notifications'
import { showModal } from '../core/modals'

export async function showSubscriptionCancelModal(subscription: string | Subscription) {
    if (BRS.fetchingModalData) {
        return
    }
    if (typeof subscription === 'object') {
        subscriptionCancelDataReady(subscription)
        return
    }
    BRS.fetchingModalData = true
    const response: GetSubscriptionResponse = await sendRequest('getSubscription', {
        subscription,
    })
    BRS.fetchingModalData = false
    if (response.errorCode) {
        notify($.t('no_transactions_found'))
        return
    }
    subscriptionCancelDataReady(response)
}

function subscriptionCancelDataReady(subscription: Subscription) {
    $('#subscription_cancel_subscription_text').val(subscription.id)
    $('#subscription_cancel_subscription').val(subscription.id)
    $('#subscription_cancel_sender').text(subscription.senderRS)
    $('#subscription_cancel_recipient').text(subscription.recipientRS)
    $('#subscription_cancel_amount').text(formatNQTAsAmount(subscription.amountNQT))
    $('#subscription_cancel_frequency').text(subscription.frequency)
    $('#subscription_cancel_time_next').text(formatTimestampAsDateTime(subscription.timeNext))

    showModal('subscription_cancel')
}

export function formsSendMoneySubscription(data: any) {
    // Calculate frequency in seconds from the inputs
    let totalSeconds = 0
    try {
        totalSeconds += parseAmountToNumber(data.frequencySeconds)
        totalSeconds += 60 * parseAmountToNumber(data.frequencyMinutes)
        totalSeconds += 60 * 60 * parseAmountToNumber(data.frequencyHours)
        totalSeconds += 24 * 60 * 60 * parseAmountToNumber(data.frequencyDays)
    } catch {
        return {
            error: $.t('error_invalid_field', { field: $.t('frequency') }),
        }
    }
    delete data.frequencySeconds
    delete data.frequencyMinutes
    delete data.frequencyHours
    delete data.frequencyDays
    data.frequency = totalSeconds

    return {
        data,
    }
}
