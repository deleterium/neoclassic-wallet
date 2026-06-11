import { BRS } from '.';
import { PostResponse } from '../typings';
import { getContactByName } from './brs.contacts';
import { evCheckNumberInput } from './brs.modals';
import { parseAmountToNQT, formatNQTAsAmount } from './brs.numbers';
import { convertRSAccountToNumeric, getAccountRSFromObject } from './brs.util';

import {
    evSpanRecipientSelectorClickButton,
    evSpanRecipientSelectorClickUlLiA
} from './brs.recipient';

export function formsSendMoneyComplete(_response: PostResponse, data: any) {
    if (!(data._extra && data._extra.convertedAccount) && !(data.recipient in BRS.contacts)) {
        $.notify(
            `${$.t('success_sendMoney', { valueSuffix: BRS.valueSuffix })}
            <a href='#'
              data-account='${getAccountRSFromObject(data, 'recipient')}'
              data-toggle='modal'
              data-target='#add_contact_modal'
              style='text-decoration:underline'>
              ${$.t('add_recipient_to_contacts_q')}
            </a>`,
            {
                type: 'success'
            }
        );
        return;
    }
    $.notify($.t('success_sendMoney', { valueSuffix: BRS.valueSuffix }), { type: 'success' });
}

/** 
 * Converts a recipient to accountId, looking for the name in contacts too
 * On error, returns ''. It means invalid rsAddress, or name not found in contacts
 */
export function recipientToId(recipient: string): string {
    if (BRS.rsRegEx.test(recipient)) {
        return convertRSAccountToNumeric(recipient)
    }
    if (BRS.idRegEx.test(recipient)) {
        return recipient
    }
    const foundContact = getContactByName(recipient)
    if (foundContact) {
        return foundContact.account
    }
    return ''
}

/**
 * Adjusts data from 'Send Money Modal' form, returning it in a way good to be requested.
 * @param data Form from
 * @returns Object with the adjusted fields 'data' and 'requestType', or object with fiel 'error' on error.
 */

export function formsSendMoneyMulti(data: any) {
    data.recipients = ''
    let items = 0
    let biTotalAmount = 0n
    let rowAmountNQT: string

    let requestType = 'sendMoneyMulti'
    if (data.same_out_checkbox === '1') {
        requestType = 'sendMoneyMultiSame'
        try {
            rowAmountNQT = parseAmountToNQT(data.amount_multi_out_same)
        } catch {
            return { error: 'Invalid amount' }
        }
        data.amountNXT = data.amount_multi_out_same
        for (const recipient of data.recipient_multi_out_same) {
            if (recipient === '') continue
            const accountId = recipientToId(recipient)
            if (accountId === '') {
                return {
                    error: $.t('name_not_in_contacts', { name: recipient })
                }
            }
            if (items > 0) {
                data.recipients += ';'
            }
            items++
            if (items === 64) {
                return { error: $.t('error_max_recipients', { max: items }) }
            }
            data.recipients += accountId
            biTotalAmount += BigInt(rowAmountNQT)
        }
    } else {
        for (let i = 0; i < data.recipient_multi_out.length; i++) {
            if (data.recipient_multi_out[i] === '' ||
                data.amount_multi_out[i] === '') {
                continue
            }
            const accountId = recipientToId(data.recipient_multi_out[i])
            if (accountId === '') {
                return {
                    error: $.t('name_not_in_contacts', { name: data.recipient_multi_out[i] })
                }
            }
            try {
                rowAmountNQT = parseAmountToNQT(data.amount_multi_out[i])
            } catch {
                return { error: 'Invalid amount' }
            }
            if (rowAmountNQT === '0') {
                return { error: 'Invalid amount' }
            }
            if (items > 0) {
                data.recipients += ';'
            }
            items++
            if (items === 128) {
                return { error: $.t('error_max_recipients', { max: items }) }
            }
            data.recipients += accountId + ':' + rowAmountNQT
            biTotalAmount += BigInt(rowAmountNQT)
        }
    }
    if (items < 2) {
        return { error: $.t('error_multi_out_minimum_recipients') }
    }
    const singleRecipients = new Set(data.recipients.split(';').map(item => item.split(':')[0]))
    if (singleRecipients.size !== items) {
        return { error: $.t('error_multi_out_duplicate_recipient') }
    }
    if (!BRS.showedFormWarning &&
        Number(BRS.settings.amount_warning) !== 0 &&
        biTotalAmount >= BigInt(BRS.settings.amount_warning)) {
        BRS.showedFormWarning = true
        return {
            error: $.t('error_max_amount_warning', {
                burst: formatNQTAsAmount(BRS.settings.amount_warning),
                valueSuffix: BRS.valueSuffix
            })
        }
    }

    delete data.same_out_checkbox
    delete data.amount_multi_out
    delete data.amount_multi_out_same
    delete data.recipient_multi_out
    delete data.recipient_multi_out_same

    return {
        requestType,
        data
    }
}

export function sendMoneyCalculateTotal(element: JQuery<HTMLElement>) {
    try {
        const current_amount = BigInt(parseAmountToNQT($('#send_money_amount').val()));
        const current_fee = BigInt(parseAmountToNQT($('#send_money_fee').val()));
        $(element).closest('.modal').find('.total_amount_ordinary').text(formatNQTAsAmount(current_amount + current_fee) + ' ' + BRS.valueSuffix);
    } catch {
        $(element).closest('.modal').find('.total_amount_ordinary').text('??? ' + BRS.valueSuffix);
    }
}

export function evMultiOutAmountChange() {
    // get amount for each recipient
    try {
        let amount_total = 0n
        $('#multi_out_recipients .row').each(function (index, row) {
            const recipient = $(row).find('input[name=recipient_multi_out]').val()
            const value = $(row).find('input[name=amount_multi_out]').val()
            const current_amount = BigInt(parseAmountToNQT(value))
            if (recipient !== '') {
                amount_total += current_amount
            }
        })
        const current_fee = BigInt(parseAmountToNQT($('#multi_out_fee').val()))
        amount_total += current_fee
        $('#total_amount_multi_out').text(formatNQTAsAmount(amount_total) + ' ' + BRS.valueSuffix)
    } catch {
        $('#total_amount_multi_out').text('??? ' + BRS.valueSuffix)
    }
}

export function evMultiOutSameAmountChange() {
    try {
        let amount_total = 0n
        const current_amount = BigInt(parseAmountToNQT($('#multi_out_same_amount').val()))
        const current_fee = BigInt(parseAmountToNQT($('#multi_out_fee').val()))
        $('#multi_out_same_recipients input[name=recipient_multi_out_same]').each(function () {
            if ($(this).val() !== '') {
                amount_total += current_amount
            }
        })
        amount_total += current_fee
        $('#total_amount_multi_out').text(formatNQTAsAmount(amount_total) + ' ' + BRS.valueSuffix)
    } catch {
        $('#total_amount_multi_out').text('??? ' + BRS.valueSuffix)
    }
}

export function evSameOutCheckboxChange(event: JQuery.ChangeEvent) {
    const element = event.target
    $('#total_amount_multi_out').html('?')
    if ($(element).is(':checked')) {
        $('#multi_out_same_recipients').fadeIn()
        $('#row_multi_out_same_amount').fadeIn()
        $('#multi_out_recipients').hide()
        evMultiOutSameAmountChange()
    } else {
        $('#multi_out_same_recipients').hide()
        $('#row_multi_out_same_amount').hide()
        $('#multi_out_recipients').fadeIn()
        evMultiOutAmountChange()
    }
}

export function evMultiOutFeeChange() {
    if ($('#send_money_same_out_checkbox').is(':checked')) {
        evMultiOutSameAmountChange()
    } else {
        evMultiOutAmountChange()
    }
}

export function resetModalMultiOut() {
    $('#multi_out_recipients').empty()
    $('#multi_out_same_recipients').empty()
    $('#multi_out_same_recipients').hide()
    $('#row_multi_out_same_amount').hide()
    $('#multi_out_recipients').fadeIn()
    $('#multi_out_recipients').append($('#additional_multi_out_recipient').html())
    $('#multi_out_recipients').append($('#additional_multi_out_recipient').html())
    $('#multi_out_same_recipients').append($('#additional_multi_out_same_recipient').html())
    $('#multi_out_same_recipients').append($('#additional_multi_out_same_recipient').html())
    $('#send_money_modal .ev-check-number-input').off('input').on('input', evCheckNumberInput)
    $('#multi_out_same_recipients input[name=recipient_multi_out_same]').off('blur').on('blur', evMultiOutSameAmountChange)
    $('#multi_out_recipients input[name=recipient_multi_out]').off('blur').on('blur', evMultiOutAmountChange)
    $('#multi_out_recipients input[name=amount_multi_out]').off('blur').on('blur', evMultiOutAmountChange)
    $('span.recipient_selector').on('click', 'button', evSpanRecipientSelectorClickButton)
    $('span.recipient_selector').on('click', 'ul li a', evSpanRecipientSelectorClickUlLiA)
    $('#send_multi_out .remove_recipient').each(function () {
        $(this).remove()
    })
    $('#send_money_same_out_checkbox').prop('checked', false)
    $('#multi_out_same_amount').val('')
    $('#send_ordinary_tab').tab('show')
}

