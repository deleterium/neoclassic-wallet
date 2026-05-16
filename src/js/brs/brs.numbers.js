/* global BigInteger */

export function formatVolume(volume) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (volume === 0) return '0 B';
    const magnitude = parseInt(Math.floor(Math.log(volume) / Math.log(1024)));

    volume = Math.round(volume / Math.pow(1024, magnitude), 2);
    const size = sizes[magnitude];

    const digits = [];
    let formattedVolume = '';
    do {
        digits[digits.length] = volume % 10;
        volume = Math.floor(volume / 10);
    } while (volume > 0);
    for (let i = 0; i < digits.length; i++) {
        if (i > 0 && i % 3 === 0) {
            formattedVolume = ',' + formattedVolume;
        }
        formattedVolume = digits[i] + formattedVolume;
    }
    return formattedVolume + ' ' + size;
}

export function formatOrderPricePerWholeQNT(price, decimals) {
    price = calculateOrderPricePerWholeQNT(price, decimals, true)

    return format(price)
}

export function calculateOrderPricePerWholeQNT(price, decimals, returnAsObject) {
    if (typeof price !== 'object') {
        price = new BigInteger(String(price))
    }

    return convertToNXT(price.multiply(new BigInteger('' + Math.pow(10, decimals))), returnAsObject)
}

export function calculatePricePerWholeQNT(price, decimals) {
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

export function calculateOrderTotalNQT(quantityQNT, priceNQT) {
    if (typeof quantityQNT !== 'object') {
        quantityQNT = new BigInteger(String(quantityQNT))
    }

    if (typeof priceNQT !== 'object') {
        priceNQT = new BigInteger(String(priceNQT))
    }

    const orderTotal = quantityQNT.multiply(priceNQT)

    return orderTotal.toString()
}

export function calculateOrderTotal(quantityQNT, priceNQT) {
    if (typeof quantityQNT !== 'object') {
        quantityQNT = new BigInteger(String(quantityQNT))
    }

    if (typeof priceNQT !== 'object') {
        priceNQT = new BigInteger(String(priceNQT))
    }

    return convertToNXT(quantityQNT.multiply(priceNQT))
}

export function calculatePercentage(a, b) {
    try {
        a = Number(a) * 100
        b = Number(b)
        const result = a / b
        return result.toFixed(2)
    } catch (e) {
        return e.message.escapeHTML()
    }
}

export function convertToNXT(amount, returnAsObject) {
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

export function amountToPrecision(amount, decimals) {
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

export function convertToNQT(currency) {
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

export function convertToQNTf(quantity, decimals, returnAsObject) {
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

export function convertToQNT(quantity, decimals) {
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

export function format(params, no_escaping) {
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

export function formatQuantity(quantity, decimals, no_escaping) {
    return format(convertToQNTf(quantity, decimals, true), no_escaping)
}

/** If amount is string or BigInteger, then assume it is NQT
 *  If the amount is Number, then assume it is NOT NQT
 */
export function formatAmount(amount, round, no_escaping) {
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

export function formatTimestamp(timestamp, date_only) {
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
