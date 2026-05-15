/**
 * @depends {brs.js}
 */

import { BRS } from '.'

export function evGenerateQrButtonClick (e) {
    e.preventDefault()
    const amount = Number($('#request_burst_amount').val())
    if (((!amount || amount < 0.00000001) && $('#request_burst_immutable').is(':checked'))) {
        $('#request_burst_qr_modal').find('.error_message').html($.t('error_invalid_input')).show()
        return
    }
    const fee = Number($('#request_burst_fee').val())
    if ((!fee || fee < BRS.minimumFeeNumber)) {
        $('#request_burst_qr_modal').find('.error_message').html($.t('error_invalid_input')).show()
        return
    }
    const amountNQT = amount * 100000000
    const feeNQT = fee * 100000000
    const receiverId = BRS.accountRS
    let immutable = ''
    $('#request_burst_immutable_response').html($.t('no'))
    if ($('#request_burst_immutable').is(':checked')) {
        immutable = '&immutable=true'
        $('#request_burst_immutable_response').html($.t('yes'))
    }
    $('#request_burst_qrcode_response').html(`<img src="${BRS.server}/burst?requestType=generateSendTransactionQRCode&receiverId=${receiverId}&amountNQT=${amountNQT}&feeNQT=${feeNQT}${immutable}"/>`)
    $('#request_burst_fee_response').html($('#request_burst_fee').val())

    $('#generate_qr_button').hide()
    $('#new_qr_button').show()
    $('#request_burst_recipient_response').html(receiverId)
    if ($('#request_burst_amount').val()) {
        $('#request_burst_amount_response').html($('#request_burst_amount').val() + ' ' + BRS.valueSuffix)
    }
    $('#request_burst_div').hide()
    $('#request_burst_response_div').show()
}
