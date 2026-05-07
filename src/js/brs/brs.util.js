/**
 * @depends {brs.js}
 */

/* global BigInteger */

import { BRS } from '.'
import { NxtAddress } from '../util/nxtaddress'

import { pageLoaded } from './brs'

import { sendRequest } from './brs.server'

export function formatVolume (volume) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (volume === 0) return '0 B'
    const magnitude = parseInt(Math.floor(Math.log(volume) / Math.log(1024)))

    volume = Math.round(volume / Math.pow(1024, magnitude), 2)
    const size = sizes[magnitude]

    const digits = []
    let formattedVolume = ''
    do {
        digits[digits.length] = volume % 10
        volume = Math.floor(volume / 10)
    } while (volume > 0)
    for (let i = 0; i < digits.length; i++) {
        if (i > 0 && i % 3 === 0) {
            formattedVolume = ',' + formattedVolume
        }
        formattedVolume = digits[i] + formattedVolume
    }
    return formattedVolume + ' ' + size
}

export function formatOrderPricePerWholeQNT (price, decimals) {
    price = calculateOrderPricePerWholeQNT(price, decimals, true)

    return format(price)
}

export function calculateOrderPricePerWholeQNT (price, decimals, returnAsObject) {
    if (typeof price !== 'object') {
        price = new BigInteger(String(price))
    }

    return convertToNXT(price.multiply(new BigInteger('' + Math.pow(10, decimals))), returnAsObject)
}

export function calculatePricePerWholeQNT (price, decimals) {
    price = String(price)

    if (decimals) {
        const toRemove = price.slice(-decimals)

        if (!/^[0]+$/.test(toRemove)) {
            // return new Big(price).div(new Big(Math.pow(10, decimals))).round(8, 0);
            throw new Error('Invalid input.')
        } else {
            return price.slice(0, -decimals)
        }
    } else {
        return price
    }
}

export function calculateOrderTotalNQT (quantityQNT, priceNQT) {
    if (typeof quantityQNT !== 'object') {
        quantityQNT = new BigInteger(String(quantityQNT))
    }

    if (typeof priceNQT !== 'object') {
        priceNQT = new BigInteger(String(priceNQT))
    }

    const orderTotal = quantityQNT.multiply(priceNQT)

    return orderTotal.toString()
}

export function calculateOrderTotal (quantityQNT, priceNQT) {
    if (typeof quantityQNT !== 'object') {
        quantityQNT = new BigInteger(String(quantityQNT))
    }

    if (typeof priceNQT !== 'object') {
        priceNQT = new BigInteger(String(priceNQT))
    }

    return convertToNXT(quantityQNT.multiply(priceNQT))
}

export function calculatePercentage (a, b) {
    try {
        a = Number(a) * 100
        b = Number(b)
        const result = a / b
        return result.toFixed(2)
    } catch (e) {
        return e.message.escapeHTML()
    }
}

export function convertToNXT (amount, returnAsObject) {
    let negative = ''
    let afterComma = ''

    if (typeof amount !== 'object') {
        amount = new BigInteger(String(amount))
    }

    const fractionalPart = amount.mod(new BigInteger('100000000')).toString() // .replace(/0+$/, ""); //todo: check if equal to zero first

    amount = amount.divide(new BigInteger('100000000'))

    if (amount.compareTo(BigInteger.ZERO) < 0) {
        amount = amount.abs()
        negative = '-'
    }

    if (fractionalPart && fractionalPart !== '0') {
        afterComma = '.'

        for (let i = fractionalPart.length; i < 8; i++) {
            afterComma += '0'
        }

        afterComma += fractionalPart.replace(/0+$/, '')
    }

    amount = amount.toString()

    if (returnAsObject) {
        return {
            negative,
            amount,
            afterComma
        }
    } else {
        return negative + amount + afterComma
    }
}

export function amountToPrecision (amount, decimals) {
    amount = String(amount)

    const parts = amount.split('.')

    // no fractional part
    if (parts.length === 1) {
        return parts[0]
    } else if (parts.length === 2) {
        let fraction = parts[1]
        fraction = fraction.replace(/0+$/, '')

        if (fraction.length > decimals) {
            fraction = fraction.substring(0, decimals)
        }

        return parts[0] + '.' + fraction
    } else {
        throw new Error('Invalid input.')
    }
}

export function convertToNQT (currency) {
    if (typeof currency === 'string') {
        currency = parseFloat(currency.replace(/,/g, ''), 10)
        currency = currency.toFixed(8) ///  this fixes rounding issues (for the Total field on modals)
    } else {
        currency = currency.toFixed(8)
    } ///  this fixes rounding issues (for the Total field on modals)

    const parts = currency.split('.')

    const amount = parts[0]

    // no fractional part
    let fraction
    if (parts.length === 1) {
        fraction = '00000000'
    } else if (parts.length === 2) {
        if (parts[1].length <= 8) {
            fraction = parts[1]
        } else {
            fraction = parts[1].substring(0, 8)
        }
    } else {
        throw new Error('Invalid input.')
    }
    for (let i = fraction.length; i < 8; i++) {
        fraction += '0'
    }

    let result = amount + '' + fraction

    // in case there's a comma or something else in there.. at this point there should only be numbers
    if (!/^\d+$/.test(result)) {
        throw new Error('Invalid input.')
    }

    // remove leading zeroes
    result = result.replace(/^0+/, '')

    if (result === '') {
        result = '0'
    }

    return result
}

export function convertToQNTf (quantity, decimals, returnAsObject) {
    quantity = String(quantity)

    if (quantity.length < decimals) {
        for (let i = quantity.length; i < decimals; i++) {
            quantity = '0' + quantity
        }
    }

    let afterComma = ''

    if (decimals) {
        afterComma = '.' + quantity.substring(quantity.length - decimals)
        quantity = quantity.substring(0, quantity.length - decimals)

        if (!quantity) {
            quantity = '0'
        }

        afterComma = afterComma.replace(/0+$/, '')

        if (afterComma === '.') {
            afterComma = ''
        }
    }

    if (returnAsObject) {
        return {
            amount: quantity,
            afterComma
        }
    } else {
        return quantity + afterComma
    }
}

export function convertToQNT (quantity, decimals) {
    quantity = String(quantity)

    const parts = quantity.split('.')

    let qnt = parts[0]

    // no fractional part
    if (parts.length === 1) {
        if (decimals) {
            for (let i = 0; i < decimals; i++) {
                qnt += '0'
            }
        }
    } else if (parts.length === 2) {
        let fraction = parts[1]
        if (fraction.length > decimals) {
            throw $.t('error_fraction_decimals', {
                decimals
            })
        } else if (fraction.length < decimals) {
            for (let i = fraction.length; i < decimals; i++) {
                fraction += '0'
            }
        }
        qnt += fraction
    } else {
        throw $.t('error_invalid_input')
    }

    // in case there's a comma or something else in there.. at this point there should only be numbers
    if (!/^\d+$/.test(qnt)) {
        throw $.t('error_invalid_input_numbers')
    }

    // remove leading zeroes
    return qnt.replace(/^0+/, '')
}

export function format (params, no_escaping) {
    let amount

    if (typeof params !== 'object') {
        amount = String(params)
        const negative = amount.charAt(0) === '-' ? '-' : ''
        if (negative) {
            amount = amount.substring(1)
        }
        params = {
            amount,
            negative,
            afterComma: ''
        }
    }

    amount = String(params.amount)

    const digits = amount.split('').reverse()
    let formattedAmount = ''

    for (let i = 0; i < digits.length; i++) {
        if (i > 0 && i % 3 === 0) {
            formattedAmount = ',' + formattedAmount
        }
        formattedAmount = digits[i] + formattedAmount
    }

    let output = (params.negative ? params.negative : '') + formattedAmount + params.afterComma

    if (!no_escaping) {
        output = output.escapeHTML()
    }

    return output
}

export function formatQuantity (quantity, decimals, no_escaping) {
    return format(convertToQNTf(quantity, decimals, true), no_escaping)
}

/** If amount is string or BigInteger, then assume it is NQT
 *  If the amount is Number, then assume it is NOT NQT
 */
export function formatAmount (amount, round, no_escaping) {
    if (typeof amount === 'undefined') {
        return '0'
    } else if (typeof amount === 'string') {
        amount = new BigInteger(amount)
    }

    let negative = ''
    let afterComma = ''

    if (typeof amount === 'object') {
        const params = convertToNXT(amount, true)

        negative = params.negative
        amount = params.amount
        afterComma = params.afterComma
    } else {
        // rounding only applies to non-nqt
        if (round) {
            amount = (Math.round(amount * 100) / 100)
        }

        if (amount < 0) {
            amount = Math.abs(amount)
            negative = '-'
        }

        amount = '' + amount

        if (amount.indexOf('.') !== -1) {
            afterComma = amount.substr(amount.indexOf('.'))
            amount = amount.replace(afterComma, '')
        } else {
            afterComma = ''
        }
    }

    return format({
        negative,
        amount,
        afterComma
    }, no_escaping)
}

export function formatTimestamp (timestamp, date_only) {
    let date
    if (timestamp instanceof Date) {
        date = timestamp
    } else {
        date = new Date(Date.UTC(2014, 7, 11, 2, 0, 0, 0) + timestamp * 1000)
    }
    if (date_only) {
        return date.toLocaleDateString()
    }
    return date.toLocaleString()
}

// BRS.formatTime(timestamp) {
//     const date = new Date(Date.UTC(2013, 10, 24, 12, 0, 0, 0) + timestamp * 1000)

//     if (!isNaN(date) && typeof (date.getFullYear) === 'function') {
//         let res = ''

//         let hours = date.getHours()
//         let minutes = date.getMinutes()
//         let seconds = date.getSeconds()

//         if (hours < 10) {
//             hours = '0' + hours
//         }
//         if (minutes < 10) {
//             minutes = '0' + minutes
//         }
//         if (seconds < 10) {
//             seconds = '0' + seconds
//         }
//         res += ' ' + hours + ':' + minutes + ':' + seconds

//         return res
//     } else {
//         return date.toLocaleString()
//     }
// }

export function convertFromHex16 (hex) {
    let j
    const hexes = hex.match(/.{1,4}/g) || []
    let back = ''
    for (j = 0; j < hexes.length; j++) {
        back += String.fromCharCode(parseInt(hexes[j], 16))
    }

    return back
}

export function convertFromHex8 (hex) {
    hex = hex.toString() // force conversion
    let str = ''
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
    }
    return str
}

export function convertNumericToRSAccountFormat (account) {
    const address = new NxtAddress(account)
    return address.getAccountRS(BRS.prefix)
}

export function convertRSAccountToNumeric (account) {
    const address = new NxtAddress(account)
    return address.getAccountId()
}

/**
 * @param {String} inVal base36 string
 * @returns same value but as hexString (64 chars)
 */
export function convertPublicKeyFromBase36ToBase16 (inVal) {
    function convert (value) {
        return [...value.toString()]
            .reduce((r, v) => r * 36n + BigInt(parseInt(v, 36)), 0n)
    }
    return convert(inVal).toString(16).padStart(64, '0')
}

export function getAccountLink (object, acc) {
    if (acc === 'multiple') {
        return $.t('multiple')
    }
    if (typeof object[acc + 'RS'] === 'undefined') {
        if (object.type === 2 && object.subtype === 1) {
            return 'Burn address'
        }
        return '/'
    } else {
        return "<a href='#' data-user='" + String(object[acc + 'RS']).escapeHTML() + "' class='user-info'>" + getAccountTitle(object, acc) + '</a>'
    }
}

export function getAssetLink (asset) {
    if (!asset || !asset.asset) {
        return '/'
    }
    return `${asset.name} <a href='#' data-goto-asset='${asset.asset}'>${asset.asset}</a>`
}

export function fullHashToId (fullHash) {
    if (fullHash.length < 16) {
        fullHash = fullHash.padEnd(16, '0')
    }
    let ret = new BigInteger('0')
    let base = new BigInteger('1')
    const bi256 = new BigInteger('256')
    for (let i = 0; i < 16; i += 2) {
        if (i !== 0) {
            base = base.multiply(bi256)
        }
        const d1 = new BigInteger(fullHash.slice(i, i + 2), 16)
        ret = ret.add(base.multiply(d1))
    }
    return ret.toString(10)
}

export function getAccountTitle (object, acc) {
    const type = typeof object

    let formattedAcc = ''

    if (acc === 'multiple') {
        return $.t('multiple')
    }
    if (type === 'string' || type === 'number') {
        formattedAcc = object
        object = null
    } else {
        if (typeof object[acc + 'RS'] === 'undefined') {
            return '/'
        } else {
            formattedAcc = String(object[acc + 'RS']).escapeHTML()
        }
    }

    if (formattedAcc === BRS.account || formattedAcc === BRS.accountRS) {
        return $.t('you')
    } else if (formattedAcc in BRS.contacts) {
        return BRS.contacts[formattedAcc].name.escapeHTML()
    } else {
        return String(formattedAcc).escapeHTML()
    }
}

export function getAccountFormatted (object, acc) {
    const type = typeof object

    if (type === 'string' || type === 'number') {
        return String(object).escapeHTML()
    } else {
        if (typeof object[acc + 'RS'] === 'undefined') {
            return ''
        } else {
            return String(object[acc + 'RS']).escapeHTML()
        }
    }
}

function getClipboardText (type) {
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

export function dataLoaded (data, noPageLoad) {
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

export function dataLoadFinished ($el, fadeIn) {
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
        if ($.trim($el.html()).length === 0) {
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

export function createInfoTable (data) {
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
        } else if (key === 'quantity' && $.isArray(value)) {
            if ($.isArray(value)) {
                value = formatQuantity(value[0], value[1])
            } else {
                value = formatQuantity(value, 0)
            }
        } else if (key === 'price' || key === 'total' || key === 'amount' || key === 'fee' || key === 'refund' || key === 'discount') {
            value = formatAmount(new BigInteger(String(value))) + ' ' + BRS.valueSuffix
        } else if (key === 'sender' || key === 'recipient' || key === 'account' || key === 'seller' || key === 'buyer') {
            value = "<a href='#' data-user='" + String(value).escapeHTML() + "'>" + getAccountTitle(value) + '</a>'
        } else {
            value = String(value).escapeHTML().nl2br()
        }

        rows += "<tr><td style='font-weight:bold;'>" + $.t(key).escapeHTML() + (type ? ' ' + type.escapeHTML() : '') + ":</td><td style='word-break: break-word;'>" + value + '</td></tr>'
    }

    return rows
}

export function getSelectedText () {
    let t = ''
    if (window.getSelection) {
        t = window.getSelection().toString()
    } else if (document.getSelection) {
        t = document.getSelection().toString()
    } else if (document.selection) {
        t = document.selection.createRange().text
    }
    return t
}

export function formatStyledAmount (amount, round) {
    amount = formatAmount(amount, round)

    amount = amount.split('.')
    if (amount.length === 2) {
        amount = amount[0] + "<span style='font-size:12px'>." + amount[1] + '</span>'
    } else {
        amount = amount[0]
    }

    return amount
}

export function getUnconfirmedTransactionsFromCache (type, subtype, fields, single) {
    if (!BRS.unconfirmedTransactions.length) {
        return false
    }

    if (typeof type === 'number') {
        type = [type]
    }

    if (typeof subtype === 'number') {
        subtype = [subtype]
    }

    const unconfirmedTransactions = []

    for (let i = 0; i < BRS.unconfirmedTransactions.length; i++) {
        const unconfirmedTransaction = BRS.unconfirmedTransactions[i]

        if (type.indexOf(unconfirmedTransaction.type) === -1 || subtype.indexOf(unconfirmedTransaction.subtype) === -1) {
            continue
        }

        if (fields) {
            for (const key in fields) {
                if (unconfirmedTransaction[key] === fields[key]) {
                    if (single) {
                        return completeUnconfirmedTransactionDetails(unconfirmedTransaction)
                    } else {
                        unconfirmedTransactions.push(unconfirmedTransaction)
                    }
                }
            }
        } else {
            if (single) {
                return completeUnconfirmedTransactionDetails(unconfirmedTransaction)
            } else {
                unconfirmedTransactions.push(unconfirmedTransaction)
            }
        }
    }

    if (single || unconfirmedTransactions.length === 0) {
        return false
    } else {
        $.each(unconfirmedTransactions, function (key, val) {
            unconfirmedTransactions[key] = completeUnconfirmedTransactionDetails(val)
        })

        return unconfirmedTransactions
    }
}

function completeUnconfirmedTransactionDetails (unconfirmedTransaction) {
    if (unconfirmedTransaction.type === 3 && unconfirmedTransaction.subtype === 4 && !unconfirmedTransaction.name) {
        sendRequest('getDGSGood', {
            goods: unconfirmedTransaction.attachment.goods
        }, function (response) {
            unconfirmedTransaction.name = response.name
            unconfirmedTransaction.buyer = unconfirmedTransaction.sender
            unconfirmedTransaction.buyerRS = unconfirmedTransaction.senderRS
            unconfirmedTransaction.seller = response.seller
            unconfirmedTransaction.sellerRS = response.sellerRS
        }, false)
    } else if (unconfirmedTransaction.type === 3 && unconfirmedTransaction.subtype === 0) {
        unconfirmedTransaction.goods = unconfirmedTransaction.transaction
    }

    return unconfirmedTransaction
}

export function hasTransactionUpdates (transactions) {
    return ((transactions && transactions.length) || BRS.unconfirmedTransactionsChange)
}

/** Handles treeview menu logic (called once on initialization) */
export function treeViewHandler () {
    return this.each(function () {
        const btn = $(this).children('a').first()
        const menu = $(this).children('.treeview-menu').first()
        const isActive = $(this).hasClass('is-open')

        // initialize already active menus
        if (isActive) {
            menu.show()
            btn.find('.fa-angle-right').first().removeClass('fa-angle-right').addClass('fa-angle-down')
        }
        // Slide open or close the menu on link click
        btn.on('click', function (e) {
            e.preventDefault()
            const active = $(this.parentNode).hasClass('is-open')
            if (active) {
                // Slide up to close menu
                menu.slideUp()
                btn.find('.fa-angle-down').first().removeClass('fa-angle-down').addClass('fa-angle-right')
                btn.parent('li').removeClass('is-open')
            } else {
                // Slide down to open menu
                menu.slideDown()
                btn.find('.fa-angle-right').first().removeClass('fa-angle-right').addClass('fa-angle-down')
                btn.parent('li').addClass('is-open')
            }
        })
    })
}

export function translateServerError (response) {
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

    let match

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
            const translatedFieldNames = []

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

export function getTranslatedFieldName (name) {
    let nameKey = String(name).replace(/Planck|NQT|QNT|RS$/, '').replace(/\s+/g, '').replace(/([A-Z])/g, function ($1) {
        return '_' + $1.toLowerCase()
    })

    if (nameKey.charAt(0) === '_') {
        nameKey = nameKey.substring(1)
    }

    if ($.i18n.exists(nameKey)) {
        return $.t(nameKey).escapeHTML()
    } else {
        return nameKey.replace(/_/g, ' ').escapeHTML()
    }
}
