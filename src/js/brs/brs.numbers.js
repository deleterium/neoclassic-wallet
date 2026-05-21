/*
 * Check file ./doc.md for values conventions: Amount, Quantity, NQT, QNT, PriceNQT and PriceQuantity
 */

import { BRS } from ".";

// Temporary until removal of BigInteger
function anyToBigint(input) {
    try {
        if (typeof input === 'object') {
            // BigInteger
            return BigInt(input.toString())
        }
        if (typeof input === 'string' || typeof input === 'number') {
            return BigInt(input)
        }
        if (typeof input === 'bigint') {
            return input
        }
        console.error('Verify here!')
        return 0n
    } catch {
        console.error('Verify here!')
        return 0n
    }
}

/**
 * Formats a volume in bytes into a human-readable string with appropriate units (B, KB, MB, GB, TB).
 * The output is localized based on the current language setting.
 * 
 * @param {number} volume - Volume in bytes.
 * @returns {string} Formatted volume string (e.g., "1.23 KB").
 */
export function formatVolume(volume) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (volume === 0) return '0 B';

    // Calculate the magnitude to determine the appropriate unit
    const magnitude = Math.floor(Math.log(volume) / Math.log(1024));
    const size = sizes[magnitude];

    // Convert volume to the appropriate unit
    const scaledVolume = volume / Math.pow(1024, magnitude);

    // Use Intl.NumberFormat for formatting with 3 significant digits
    const formatter = new Intl.NumberFormat(BRS.settings.language, {
        maximumSignificantDigits: 3,
        minimumSignificantDigits: 1,
    });

    return `${formatter.format(scaledVolume)} ${size}`;
}

/**
 * Formats a number into a string using the current locale settings for grouping and decimal separators.
 * 
 * @param {number} num - The number to format.
 * @returns {string} Formatted number string (e.g., "1,234.56" in en-US or "1.234,56" in de-DE).
 */
export function formatNumber(num) {
    return num.toLocaleString(BRS.settings.language)
}

/**
 * Converts a price from NQT per QNT format to Amount per Quantity format, fully localized with group separators.
 *
 * @param {string|number|bigint} priceNQT - Price in NQT per QNT format.
 * @param {number} decimals - Number of decimals for the asset.
 * @returns {string} Formatted price string (e.g., "1,234.56" in en-US).
 */
export function formatPriceNQTAsPriceQuantity(priceNQT, decimals) {
    let biPrice = anyToBigint(priceNQT)
    const power = BigInt(Math.pow(10, decimals))
    return format(convertNQTToNumberObject(biPrice * power))
}

/**
 * Converts a human-readable price (Amount per Quantity) to blockchain format (NQT per QNT).
 *
 * @param {string|number} priceQuantity - Human-friendly price in Amount per Quantity format. May be user input.
 * @param {number} decimals - Number of decimals for the asset.
 * @returns {string} Price in NQT per QNT format.
 */
export function parsePriceQuantityToPriceNQT(priceQuantity, decimals) {
    priceQuantity = String(priceQuantity)
    const priceNQTperQuantity = parseAmountToNQT(priceQuantity)
    let priceNQTperQNT
    if (decimals) {
        const toRemove = priceNQTperQuantity.slice(-decimals)
        if (!/^[0]+$/.test(toRemove)) {
            console.error('invalid input. Check here')
        }
        priceNQTperQNT = priceNQTperQuantity.slice(0, -decimals)
    } else {
        priceNQTperQNT = priceNQTperQuantity
    }
    return priceNQTperQNT
}

/**
 * Calculates the total amount in NQT given a quantity (in QNT) and a price (in NQT).
 *
 * @param {string|number|bigint} quantityQNT - Quantity in QNT format.
 * @param {string|number|bigint} priceNQT - Price in NQT format.
 * @returns {string} Total amount in NQT as a string.
 */
export function calculateOrderTotalNQT(quantityQNT, priceNQT) {
    const quantity = anyToBigint(quantityQNT)
    const price = anyToBigint(priceNQT)
    return (quantity * price).toString()
}

/**
 * Calculates and formats the total amount (in Signa) of a quantity (in QNT) given a price (in NQT/QNT).
 * The output is fully localized with group separators.
 *
 * @param {string|number|bigint} quantityQNT - Quantity in QNT format.
 * @param {string|number|bigint} priceNQT - Price in NQT format.
 * @returns {string} Formatted total amount in Signa (e.g., "1,234.56" in en-US).
 */
export function formatOrderTotal(quantityQNT, priceNQT) {
    const quantity = anyToBigint(quantityQNT)
    const price = anyToBigint(priceNQT)

    return format(convertNQTToNumberObject(quantity * price))
}

/**
 * Simple percentage calculation.
 * @param {number|string} a 
 * @param {number|string} b 
 * @returns The percentage `a` relative to `b` with two decimals.
 */
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

/**
 * Converts an amount in NQT format into a NumberObject for internal formatting.
 *
 * @param {string|number|bigint} amountNQT - Amount in NQT format.
 * @returns {Object} NumberObject with properties:
 *   - `negative` (string): "-" if the amount is negative, otherwise empty.
 *   - `amount` (string): Integer part of the amount.
 *   - `afterComma` (string): Fractional part after the decimal separator.
 */
function convertNQTToNumberObject(amountNQT) {
    let negative = ''
    let afterComma = ''

    let biAmount = anyToBigint(amountNQT)

    let fractionalPart = biAmount % 100000000n
    let integerPart = biAmount / 100000000n

    if (biAmount < 0) {
        negative = '-'
        fractionalPart = -fractionalPart
        integerPart = -integerPart
    }

    if (fractionalPart !== 0n) {
        afterComma = BRS.decimalSign
        afterComma += fractionalPart.toString().padStart(8, '0')
        afterComma = afterComma.replace(/0+$/, '')
    }
    const amountStr = integerPart.toString()
    return {
        negative,
        amount: amountStr,
        afterComma
    }
}

/**
 * Parses a human-readable Amount (with group separators or other characters) into NQT format.
 *
 * @param {string|number} amount - Human-readable Amount (e.g., "1,234.56" or 1234.56).
 * @returns {string} Amount in NQT format.
 */
export function parseAmountToNQT(amount) {
    let parts
    if (typeof amount === 'string') {
        const cleanedValue = amount.replace(
            new RegExp('[^0-9' + BRS.decimalSign.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ']', 'g'),
            ''
        );
        parts = cleanedValue.split(BRS.decimalSign)
    } else {
        const jsString = amount.toFixed(8)
        parts = jsString.split('.')

    }
    const integer = parts[0]
    let fraction
    if (parts.length === 1) {
        // no fractional part
        fraction = '00000000'
    } else if (parts.length === 2) {
        if (parts[1].length <= 8) {
            fraction = parts[1].padEnd(8, '0')
        } else {
            fraction = parts[1].substring(0, 8)
        }
    } else {
        throw new Error($.t('error_invalid_input'))
    }
    // Combine and remove leading zeros
    const result = (integer + fraction).replace(/^0+/, '')
    if (result === '') {
        return '0'
    }
    return result
}

/**
 * Converts an asset quantity in QNT format into a NumberObject for internal formatting.
 *
 * @param {string|number} quantityQNT - Quantity in QNT format.
 * @param {number} decimals - Number of decimals for the asset.
 * @returns {Object} NumberObject with properties:
 *   - `negative` (string): "-" if the amount is negative, otherwise empty.
 *   - `amount` (string): Integer part of the quantity.
 *   - `afterComma` (string): Fractional part after the decimal separator.
 */
function convertQNTToNumberObject(quantityQNT, decimals) {
    quantityQNT = String(quantityQNT)

    if (quantityQNT.length < decimals) {
        for (let i = quantityQNT.length; i < decimals; i++) {
            quantityQNT = '0' + quantityQNT
        }
    }

    let afterComma = ''

    if (decimals) {
        afterComma = BRS.decimalSign + quantityQNT.substring(quantityQNT.length - decimals)
        quantityQNT = quantityQNT.substring(0, quantityQNT.length - decimals)

        if (!quantityQNT) {
            quantityQNT = '0'
        }

        afterComma = afterComma.replace(/0+$/, '')

        if (afterComma === BRS.decimalSign) {
            afterComma = ''
        }
    }

    return {
        negative: '',
        amount: quantityQNT,
        afterComma
    }
}

/**
 * Parses a human-readable asset Quantity (with group separators) into QNT format.
 *
 * @param {string|number} quantity - Human-readable Quantity (e.g., "1,234.56" or 1234.56).
 * @param {number} decimals - Number of decimals for the asset.
 * @returns {string} Quantity in QNT format.
 */
export function parseQuantityToQNT(quantity, decimals) {
    quantity = String(quantity)
    const cleanedValue = quantity.replace(
        new RegExp('[^0-9' + BRS.decimalSign.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ']', 'g'),
        ''
    );
    const parts = cleanedValue.split(BRS.decimalSign)

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
            throw new Error($.t('error_fraction_decimals', {
                decimals
            }))
        } else if (fraction.length < decimals) {
            for (let i = fraction.length; i < decimals; i++) {
                fraction += '0'
            }
        }
        qnt += fraction
    } else {
        throw new Error($.t('error_invalid_input'))
    }
    // remove leading zeroes
    const retQNT = qnt.replace(/^0+/, '')
    if (retQNT === '') {
        return '0'
    }
    return retQNT
}

/**
 * Formats a NumberObject into a localized string for display.
 *
 * @param {Object} params - NumberObject with properties:
 *   - `negative` (string): "-" if negative, otherwise empty.
 *   - `amount` (string): Integer part of the number.
 *   - `afterComma` (string): Fractional part after the decimal separator.
 * @returns {string} Formatted number string (e.g., "1,234.56" in en-US).
 */
function format (params) {
    const formattedAmount = BigInt(params.amount).toLocaleString(BRS.settings.language)
    let output = params.negative + formattedAmount + params.afterComma
    return output
}

/**
 * Converts an asset quantity from QNT format to Quantity format and formats it for display.
 *
 * @param {string|number} quantityQNT - Quantity in QNT format.
 * @param {number} decimals - Number of decimals for the asset.
 * @returns {string} Formatted Quantity string (e.g., "1,234.56" in en-US).
 */
export function formatQNTAsQuantity(quantityQNT, decimals) {
    if (typeof quantityQNT !== 'string') {
        console.error("Verify here")
    }
    return format(convertQNTToNumberObject(quantityQNT, decimals))
}

/**
 * Converts an amount from NQT format to Amount (Signa) format and formats it for display.
 *
 * @param {string|number|bigint} amountNQT - Amount in NQT format.
 * @returns {string} Formatted Amount string (e.g., "1,234.56" in en-US).
 */
export function formatNQTAsAmount(amountNQT) {
    if (typeof amountNQT === 'number') {
        console.error("Do not use number here")
        amountNQT *= 1E8
    }
    const biAmountNQT = anyToBigint(amountNQT)
    if (biAmountNQT === 0n) {
        return '0'
    }
    return format(convertNQTToNumberObject(biAmountNQT))
}

/**
 * Formats a timestamp (seconds since genesis) into a localized date or datetime string.
 *
 * @param {number} timestamp - Seconds since the genesis time.
 * @param {boolean} date_only - If true, returns only the date; otherwise, includes time.
 * @returns {string} Formatted date or datetime string (e.g., "2023-10-01" or "2023-10-01 14:30").
 */
export function formatTimestampAsDateTime(timestamp, date_only = false) {
    let date
    if (typeof timestamp !== 'number') {
        console.error("Verify here")
        date = timestamp
    } else {
        date = new Date((BRS.genesisSeconds + timestamp) * 1000)
    }
    if (date_only) {
        return date.toLocaleDateString(BRS.settings.language)
    }
    return date.toLocaleString(BRS.settings.language)
}
