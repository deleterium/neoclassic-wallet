import { BRS } from '.';
import { PostResponse } from '../typings';
import { getContactByName } from './brs.contacts';
import { parseAmountToNQT, formatNQTAsAmount } from './brs.numbers';
import { convertRSAccountToNumeric, getAccountFormatted } from './brs.util';

export function formsSendMoneyComplete(_response: PostResponse, data: any) {
    if (!(data._extra && data._extra.convertedAccount) && !(data.recipient in BRS.contacts)) {
        $.notify(
            `${$.t('success_send_money', { valueSuffix: BRS.valueSuffix })}
            <a href='#'
              data-account='${getAccountFormatted(data, 'recipient')}'
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
    $.notify($.t('success_send_money', { valueSuffix: BRS.valueSuffix }), { type: 'success' });
}

/** 
 * Converts a recipient to accountId, looking for the name in contacts too
 * On error, returns ''. It means invalid rsAddress, or name not found in contacts
 */
function recipientToId(recipient: string): string {
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
