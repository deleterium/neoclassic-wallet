import { BRS } from '.'

import { checkMinimumFee } from './brs.navigation'

import { formatNQTAsAmount, parseAmountToNQT } from './brs.numbers'

export function formRequestBurst (data: any) {
    let amountNQT: string
    let feeNQT: string
    try {
        amountNQT = parseAmountToNQT(data.amountNXT)
        feeNQT = parseAmountToNQT(checkMinimumFee(data.feeNXT))
    } catch (error) {
        $('#request_burst_qr_modal').find('.error_message').html($.t('error_invalid_input')).show()
        return { error: (error as Error).message }
    }

    const receiverId = BRS.accountRS
    let immutable = 'false'
    $('#request_burst_immutable_response').html($.t('no'))
    if (data.immutable !== 'on') {
        immutable = 'true'
        $('#request_burst_immutable_response').html($.t('yes'))
    }
    $('#request_burst_qrcode_response').html(`<img src="${BRS.server}/burst?requestType=generateSendTransactionQRCode&receiverId=${receiverId}&amountNQT=${amountNQT}&feeNQT=${feeNQT}&immutable=${immutable}"/>`)
    $('#request_burst_fee_response').text(formatNQTAsAmount(feeNQT))

    $('#generate_qr_button').hide()
    $('#new_qr_button').show()
    $('#request_burst_recipient_response').html(receiverId)
    if ($('#request_burst_amount').val()) {
        $('#request_burst_amount_response').text(formatNQTAsAmount(amountNQT) + ' ' + BRS.valueSuffix)
    }
    $('#request_burst_div').hide()
    $('#request_burst_response_div').show()

    return { stop: true, hide: false }
}
