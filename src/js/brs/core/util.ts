import { BRS } from '..'

import { AjaxResponse, AssetDetails, Transaction } from '../typings'

import { NxtAddress } from '../../util/nxtaddress'

import { pageLoaded } from './navigation'

import { formatQNTAsQuantity, formatNQTAsAmount } from './numbers'

// region converter

export function convertNumericToRSAccountFormat (account: string) {
    const address = new NxtAddress(account)
    return address.getAccountRS(BRS.prefix)
}

export function convertRSAccountToNumeric (account: string) {
    const address = new NxtAddress(account)
    return address.getAccountId()
}

/**
 * @param {String} inVal base36 string
 * @returns same value but as hexString (64 chars)
 */
export function convertPublicKeyFromBase36ToBase16 (inVal: string) {
    function convert (value: string) {
        return [...value.toString()]
            .reduce((r, v) => r * 36n + BigInt(parseInt(v, 36)), 0n)
    }
    return convert(inVal).toString(16).padStart(64, '0')
}

// region getLink

export function getAccountLink (object: Transaction, acc: string) {
    if (acc === 'multiple') {
        return $.t('multiple')
    }
    if (typeof object[acc + 'RS'] === 'undefined') {
        if (object.type === 2 && object.subtype === 1) {
            return $.t('burn_address')
        }
        return '/'
    } else {
        return `<a href='#' data-user='${String(object[acc + 'RS']).escapeHTML()}' class='user-info'>${getAccountTitleFromObject(object, acc)}</a>`
    }
}

export function getAssetLink (asset: AssetDetails) {
    if (!asset || !asset.asset) {
        return '/'
    }
    return `${asset.name} <a href='#' data-goto-asset='${asset.asset}'>${asset.asset}</a>`
}

// region getAccount

export function getAccountTitleFromObject (object: object, acc: string) {
    let accountRS = ''

    if (acc === 'multiple') {
        return $.t('multiple')
    }
    if (typeof object[acc + 'RS'] === 'undefined') {
        return '/'
    } else {
        accountRS = String(object[acc + 'RS']).escapeHTML()
    }

    return getAccountTitle(accountRS)
}

export function getAccountTitle (accountRS: string) {
    if (accountRS === BRS.accountRS) {
        return $.t('you')
    }
    if (accountRS in BRS.contacts) {
        return BRS.contacts[accountRS].name.escapeHTML()
    }
    if (accountRS.endsWith('2222-2222-2222-22222')) {
        return $.t('burn_address')
    }
    return accountRS.escapeHTML()
}

export function getAccountRSFromObject (object: object, acc: string) {
    if (typeof object[acc + 'RS'] === 'undefined') {
        return ''
    }
    return String(object[acc + 'RS']).escapeHTML()
}

// region clipboard

function getClipboardText (type: string) {
    switch (type) {
    case 'account_id':
        return BRS.account
    case 'account_rs':
        if (BRS.accountInfo.errorCode) {
            return BRS.accountRSExtended
        }
        return BRS.accountRS
    case 'message_link':
        return document.URL.replace(/#.*$/, '') + '#message:' + BRS.account
    case 'send_link':
        return document.URL.replace(/#.*$/, '') + '#send:' + BRS.account
    case 'asset_id':
        return $('#asset_id').text()
    case 'asset_link':
        return document.URL.replace(/#.*/, '') + '#asset:' + $('#asset_id').text()
    default:
        return ''
    }
}

export function setupClipboardFunctionality () {
    const $el = $('.copy_link')

    if (BRS.inApp) {
        $el.on('click', function () {
            parent.postMessage({
                type: 'copy',
                text: getClipboardText($(this).data('type'))
            }, '*')

            $.notify($.t('success_clipboard_copy'), { type: 'success' })
        })
    } else {
        // Handle click events directly
        $el.on('click', function () {
            const text = getClipboardText($(this).data('type'))

            navigator.clipboard.writeText(text)
                .then(() => {
                    $.notify($.t('success_clipboard_copy'), { type: 'success' })
                })
                .catch(err => {
                    $('#asset_id_dropdown .dropdown-menu').remove()
                    $('#asset_id').data('toggle', '')
                    $.notify($.t('error_clipboard_copy'), { type: 'danger' })
                    console.error('Failed to copy: ', err)
                })
        })
    }
}

// region dataLoad

export function dataLoaded (data: string = '', noPageLoad: boolean = false) {
    let $el = $('#' + BRS.currentPage + '_contents')

    if ($el.length) {
        $el.empty().append(data)
    } else {
        $el = $('#' + BRS.currentPage + '_table')
        $el.find('tbody').empty().append(data)
    }

    dataLoadFinished($el)

    if (!noPageLoad) {
        pageLoaded()
    }
}

export function dataLoadFinished ($el: JQuery<HTMLElement>, fadeIn: boolean = false) {
    const $parent = $el.parent()

    if (fadeIn) {
        $parent.hide()
    }

    $parent.removeClass('data-loading')

    const extra = $parent.data('extra')

    let empty = false

    if ($el.is('table')) {
        if ($el.find('tbody tr').length > 0) {
            $parent.removeClass('data-empty')
            if ($parent.data('no-padding')) {
                $parent.parent().addClass('no-padding')
            }

            if (extra) {
                $(extra).show()
            }
        } else {
            empty = true
        }
    } else {
        if (($el.html()).trim().length === 0) {
            empty = true
        }
    }

    if (empty) {
        $parent.addClass('data-empty')
        if ($parent.data('no-padding')) {
            $parent.parent().removeClass('no-padding')
        }
        if (extra) {
            $(extra).hide()
        }
    } else {
        $parent.removeClass('data-empty')
    }

    if (fadeIn) {
        $parent.stop(true, true).fadeIn(400, function () {
            $parent.show()
        })
    }
}

export function createInfoTable (data: object) {
    let rows = ''

    for (let key in data) {
        let value = data[key]

        const match = key.match(/(.*)(NQT|QNT|RS)$/)
        let type = ''

        if (match && match[1]) {
            key = match[1]
            type = (match[2] === 'NQT' ? 'Planck' : match[2])
        }

        key = key.replace(/\s+/g, '').replace(/([A-Z])/g, function ($1) {
            return '_' + $1.toLowerCase()
        })

        // no need to mess with input, already done if Formatted is at end of key
        if (/_formatted_html$/i.test(key)) {
            key = key.replace('_formatted_html', '')
            value = String(value)
        } else if (/_formatted$/i.test(key)) {
            key = key.replace('_formatted', '')
            value = String(value).escapeHTML()
        } else if (key === 'quantity') {
            if ('decimals' in data) {
                value = formatQNTAsQuantity(value, data['decimals'] as number)
            } else {
                value = formatQNTAsQuantity(value, 0)
            }
        } else if (key === 'price' || key === 'total' || key === 'amount' || key === 'fee' || key === 'refund' || key === 'discount') {
            value = formatNQTAsAmount(value) + ' ' + BRS.valueSuffix
        } else if (key === 'sender' || key === 'recipient' || key === 'account' || key === 'seller' || key === 'buyer') {
            value = "<a href='#' data-user='" + String(value).escapeHTML() + "'>" + getAccountTitle(value) + '</a>'
        } else {
            value = String(value).escapeHTML().nl2br()
        }

        const escapedKey = $.t(key).escapeHTML();
        const escapedType = type ? ' ' + type.escapeHTML() : '';
        rows += `
            <tr>
              <td style='font-weight:bold;'>${escapedKey}${escapedType}</td>
              <td style='word-break: break-word;'>${value}</td>
            </tr>`;
    }

    return rows
}

export function formatStyledAmount (amount: string) {
    const parts = formatNQTAsAmount(amount).split(BRS.decimalSign)
    if (parts.length === 2) {
        return `${parts[0]}<span style='font-size:12px'>${BRS.decimalSign}${parts[1]}</span>`
    }
    return parts[0]
}

// region unconfirmed

export function getUnconfirmedTransactionsFromCache (
    type: number,
    subtype: number,
    fields?: any
) {
    if (!BRS.unconfirmedTransactions.length) {
        return
    }

    const unconfirmedTransactions: Transaction[] = []

    for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
        if (type !== unconfirmedTransaction.type || subtype !== unconfirmedTransaction.subtype) {
            continue
        }

        if (fields) {
            for (const key in fields) {
                if (unconfirmedTransaction[key] === fields[key]) {
                    unconfirmedTransactions.push(unconfirmedTransaction)
                }
            }
        } else {
            unconfirmedTransactions.push(unconfirmedTransaction)
        }
    }

    if (unconfirmedTransactions.length === 0) {
        return
    }
    return unconfirmedTransactions
}

// region translate

export function translateServerError (response: AjaxResponse) {
    if (!response.errorDescription) {
        if (response.errorMessage) {
            response.errorDescription = response.errorMessage
        } else if (response.error) {
            if (typeof response.error === 'string') {
                response.errorDescription = response.error
                response.errorCode = -1
            } else {
                return $.t('error_unknown')
            }
        } else {
            return $.t('error_unknown')
        }
    }

    let match: RegExpMatchArray | null

    switch (response.errorCode) {
    case -1:
        switch (response.errorDescription) {
        case 'Invalid ordinary payment':
            return $.t('error_invalid_ordinary_payment')
        case 'Missing alias name':
            return $.t('error_missing_alias_name')
        case 'Transferring aliases to Genesis account not allowed':
            return $.t('error_alias_transfer_genesis')
        case 'Ask order already filled':
            return $.t('error_ask_order_filled')
        case 'Bid order already filled':
            return $.t('error_bid_order_filled')
        case 'Only text encrypted messages allowed':
            return $.t('error_encrypted_text_messages_only')
        case 'Missing feedback message':
            return $.t('error_missing_feedback_message')
        case 'Only text public messages allowed':
            return $.t('error_public_text_messages_only')
        case 'Purchase does not exist yet or not yet delivered':
            return $.t('error_purchase_delivery')
        case 'Purchase does not exist or is not delivered or is already refunded':
            return $.t('error_purchase_refund')
        case 'Recipient account does not have a public key, must attach a public key announcement':
            return $.t('error_recipient_no_public_key_announcement')
        case 'Transaction is not signed yet':
            return $.t('error_transaction_not_signed')
        case 'Transaction already signed':
            return $.t('error_transaction_already_signed')
        case 'PublicKeyAnnouncement cannot be attached to transactions with no recipient':
            return $.t('error_public_key_announcement_no_recipient')
        case 'Announced public key does not match recipient accountId':
            return $.t('error_public_key_different_account_id')
        case 'Public key for this account has already been announced':
            return $.t('error_public_key_already_announced')
        default:
            if (response.errorDescription.indexOf('Alias already owned by another account') !== -1) {
                return $.t('error_alias_owned_by_other_account')
            } else if (response.errorDescription.indexOf('Invalid alias sell price') !== -1) {
                return $.t('error_invalid_alias_sell_price')
            } else if (response.errorDescription.indexOf("Alias hasn't been registered yet") !== -1) {
                return $.t('error_alias_not_yet_registered')
            } else if (response.errorDescription.indexOf("Alias doesn't belong to sender") !== -1) {
                return $.t('error_alias_not_from_sender')
            } else if (response.errorDescription.indexOf('Alias is owned by account other than recipient') !== -1) {
                return $.t('error_alias_not_from_recipient')
            } else if (response.errorDescription.indexOf('Alias is not for sale') !== -1) {
                return $.t('error_alias_not_for_sale')
            } else if (response.errorDescription.indexOf('Invalid alias name') !== -1) {
                return $.t('error_invalid_alias_name')
            } else if (response.errorDescription.indexOf('Invalid URI length') !== -1) {
                return $.t('error_invalid_alias_uri_length')
            } else if (response.errorDescription.indexOf('Invalid ask order') !== -1) {
                return $.t('error_invalid_ask_order')
            } else if (response.errorDescription.indexOf('Invalid bid order') !== -1) {
                return $.t('error_invalid_bid_order')
            } else if (response.errorDescription.indexOf('Goods price or quantity changed') !== -1) {
                return $.t('error_dgs_price_quantity_changed')
            } else if (response.errorDescription.indexOf('Invalid digital goods price change') !== -1) {
                return $.t('error_invalid_dgs_price_change')
            } else if (response.errorDescription.indexOf('Invalid digital goods refund') !== -1) {
                return $.t('error_invalid_dgs_refund')
            } else if (response.errorDescription.indexOf('Purchase does not exist yet, or already delivered') !== -1) {
                return $.t('error_purchase_not_exist_or_delivered')
            } else if (response.errorDescription.match(/Goods.*not yet listed or already delisted/)) {
                return $.t('error_dgs_not_listed')
            } else if (response.errorDescription.match(/Delivery deadline has already expired/)) {
                return $.t('error_dgs_delivery_deadline_expired')
            } else if (response.errorDescription.match(/Invalid effective balance leasing:.*recipient account.*not found or no public key published/)) {
                return $.t('error_invalid_balance_leasing_no_public_key')
            } else if (response.errorDescription.indexOf('Invalid effective balance leasing') !== -1) {
                return $.t('error_invalid_balance_leasing')
            } else if (response.errorDescription.match(/Wrong buyer for.*expected:.*/)) {
                return $.t('error_wrong_buyer_for_alias')
            }
            return response.errorDescription
        }
    case 1:
        switch (response.errorDescription) {
        case 'This request is only accepted using POST!':
            return $.t('error_post_only')
        case 'Incorrect request':
            return $.t('error_incorrect_request')
        default:
            return response.errorDescription
        }
    case 2:
        return response.errorDescription
    case 3:
        match = response.errorDescription.match(/"([^"]+)" not specified/i)
        if (match && match[1]) {
            return $.t('error_not_specified', {
                name: getTranslatedFieldName(match[1]).toLowerCase()
            }).capitalize()
        }

        match = response.errorDescription.match(/At least one of \[(.*)\] must be specified/i)
        if (match && match[1]) {
            const fieldNames = match[1].split(',')
            const translatedFieldNames: string[] = []

            for (const fieldName of fieldNames) {
                translatedFieldNames.push(getTranslatedFieldName(fieldName).toLowerCase())
            }

            const translatedFieldNamesJoined = translatedFieldNames.join(', ')

            return $.t('error_not_specified_plural', {
                names: translatedFieldNamesJoined,
                count: translatedFieldNames.length
            }).capitalize()
        }
        return response.errorDescription

    case 4:
        match = response.errorDescription.match(/Incorrect "([^"]+)"/i)
        if (match && match[1]) {
            return $.t('error_incorrect_name', {
                name: getTranslatedFieldName(match[1]).toLowerCase()
            }).capitalize()
        }
        
        match = response.errorDescription.match(/Transaction fee (\d+) less than minimum fee (\d+) at height (\d+)/)
        if (match) {
            return $.t('error_transaction_fee', {
                currentFee: formatNQTAsAmount(match[1]),
                minimumFee: formatNQTAsAmount(match[2]),
                height: Number(match[3]).toLocaleString(BRS.settings.language)
            }).capitalize();
        }

        return response.errorDescription
    case 5:
        match = response.errorDescription.match(/Unknown (.*)/i)
        if (match && match[1]) {
            return $.t('error_unknown_name', {
                name: getTranslatedFieldName(match[1]).toLowerCase()
            }).capitalize()
        }
        return response.errorDescription
    case 6:
        switch (response.errorDescription) {
        case 'Not enough assets':
            return $.t('error_not_enough_assets')
        case 'Not enough funds':
            return $.t('error_not_enough_funds')
        default:
            return response.errorDescription
        }
    case 7:
        if (response.errorDescription === 'Not allowed') {
            return $.t('error_not_allowed')
        }
        return response.errorDescription
    case 8:
        switch (response.errorDescription) {
        case 'Goods have not been delivered yet':
            return $.t('error_goods_not_delivered_yet')
        case 'Feedback already sent':
            return $.t('error_feedback_already_sent')
        case 'Refund already sent':
            return $.t('error_refund_already_sent')
        case 'Purchase already delivered':
            return $.t('error_purchase_already_delivered')
        case 'Decryption failed':
            return $.t('error_decryption_failed')
        case 'No attached message found':
            return $.t('error_no_attached_message')
        case 'recipient account does not have public key':
            return $.t('error_recipient_no_public_key')
        default:
            return response.errorDescription
        }
    case 9:
        if (response.errorDescription === 'Feature not available') {
            return $.t('error_feature_not_available')
        }
        return response.errorDescription
    default:
        return response.errorDescription
    }
}

export function getTranslatedFieldName (name: string) {
    let nameKey = String(name).replace(/Planck|NQT|QNT|RS$/, '').replace(/\s+/g, '').replace(/([A-Z])/g, function ($1) {
        return '_' + $1.toLowerCase()
    })

    if (nameKey.charAt(0) === '_') {
        nameKey = nameKey.substring(1)
    }

    if ($.i18n.exists(nameKey)) {
        return $.t(nameKey).escapeHTML()
    }
    return nameKey.replace(/_/g, ' ').escapeHTML()
}
