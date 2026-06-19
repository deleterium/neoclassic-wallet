/*
 * Check file ./doc.md for values conventions: Amount, Quantity, NQT, QNT, PriceNQT and PriceQuantity
 */

import { BRS } from ".";

interface ParsedNumberObject {
    integer: string;
    fractional: string;
}

/**
 * Formats a volume in bytes into a human-readable string with appropriate units (B, KB, MB, GB, TB).
 * The output is localized based on the current language setting.
 * 
 * @param {number} volume - Volume in bytes.
 * @returns {string} Formatted volume string (e.g., "1.23 KB").
 */
export function formatVolume (volume: number) : string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (volume === 0) return '0 B';

    // Calculate the magnitude to determine the appropriate unit
    const magnitude = Math.floor(Math.log(volume) / Math.log(1024));
    const size = sizes[magnitude];

    // Convert volume to the appropriate unit
    const scaledVolume = volume / Math.pow(1024, magnitude);

    return `${BRS.volumeFormatter.format(scaledVolume)} ${size}`;
}

/**
 * Formats a number into a string using the current locale settings for grouping and decimal separators.
 * 
 * @param {number} num - The number to format.
 * @returns {string} Formatted number string (e.g., "1,234.56" in en-US or "1.234,56" in de-DE).
 */
export function formatNumber (num: number) : string {
    if (typeof num !== 'number') {
        console.error('Verify here')
        return '-0'
    }
    return num.toLocaleString(BRS.settings.language)
}

/**
 * Converts a price from NQT per QNT format to Amount per Quantity format, fully localized with group separators.
 *
 * @param {string|number|bigint} priceNQT - Price in NQT per QNT format.
 * @param {number} decimals - Number of decimals for the asset.
 * @returns {string} Formatted price string (e.g., "1,234.56" in en-US).
 */
export function formatPriceNQTAsPriceQuantity (priceNQT: string | number | bigint, decimals: number) : string {
    const biPrice = BigInt(priceNQT)
    const power = BigInt(Math.pow(10, decimals))
    return format(convertNQTToNumberObject(biPrice * power))
}

/**
 * Converts a human-readable price (Amount per Quantity) to blockchain format (NQT per QNT).
 *
 * @param {string | number | string[] | undefined} priceQuantity - Human-friendly price in Amount per Quantity format. May be user input.
 * @param {number} decimals - Number of decimals for the asset.
 * @returns {string} Price in NQT per QNT format.
 * @throws {Error} on invalid input
 */
export function parsePriceQuantityToPriceNQT (priceQuantity: string | number | string[] | undefined, decimals: number) : string {
    const priceNQTperQuantity = parseAmountToNQT(priceQuantity)
    if (decimals === 0) {
        return priceNQTperQuantity
    }
    const toRemove = priceNQTperQuantity.slice(-decimals)
    if (!/^[0]+$/.test(toRemove)) {
        throw new Error($.t('error_fraction_decimals', {
            decimals: 8 - decimals
        }))
    }
    const retVal = priceNQTperQuantity.slice(0, -decimals)

    if (!retVal) return '0'
    return retVal
}

/**
 * Calculates the total amount in NQT given a quantity (in QNT) and a price (in NQT).
 *
 * @param {string|number|bigint} quantityQNT - Quantity in QNT format.
 * @param {string|number|bigint} priceNQT - Price in NQT format.
 * @returns {string} Total amount in NQT as a string.
 */
export function calculateOrderTotalNQT (
    quantityQNT: string | number | bigint,
    priceNQT: string | number | bigint
) : string {
    const quantity = BigInt(quantityQNT)
    const price = BigInt(priceNQT)

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
export function formatOrderTotal (quantityQNT: string | number | bigint, priceNQT: string | number | bigint) : string {
    const quantity = BigInt(quantityQNT)
    const price = BigInt(priceNQT)

    return format(convertNQTToNumberObject(quantity * price))
}

/**
 * Simple percentage calculation.
 * @param {number|string} a 
 * @param {number|string} b 
 * @returns The percentage `a` relative to `b` with two decimals.
 */
export function calculatePercentage(a: number | string, b: number | string) {
    try {
        a = Number(a) * 100
        b = Number(b)
        const result = a / b
        return result.toFixed(2)
    } catch (e) {
        return (e as Error).message.escapeHTML()
    }
}

/**
 * Converts an amount in NQT format into a NumberObject for internal formatting.
 *
 * @param {string|number|bigint} amountNQT - Amount in NQT format.
 * @returns {ParsedNumberObject}
 */
function convertNQTToNumberObject (amountNQT: string | number | bigint) : ParsedNumberObject {
    return convertQNTToNumberObject(amountNQT, 8)
}
/**
 * Parses a human-readable Amount (with group separators and/or decimal sign) into NQT format.
 *
 * @param {string|number|undefined|string[]} amount - Human-readable Amount (e.g., "1,234.56" or 1234.56).
 * @returns {string} Amount in NQT format.
 * @throws Error if invalid input is found
 */
export function parseAmountToNQT(amount: string | number | undefined | string[]): string {
    return parseQuantityToQNT(amount, 8)
}


/**
 * Converts an asset quantity in QNT format into a NumberObject for internal formatting.
 *
 * @param quantityQNT - Quantity in QNT format.
 * @param decimals - Number of decimals for the asset.
 * @returns {ParsedNumberObject}
 */
function convertQNTToNumberObject (quantityQNT: string | number | bigint, decimals: number) : ParsedNumberObject {
    let biQNT = BigInt(quantityQNT)
    if (biQNT < 0) {
        console.error('Negative amount should not be used!')
        biQNT = -biQNT
    }

    const base = BigInt(Math.pow(10, decimals))
    const fractionalPart = biQNT % base
    const integerPart = biQNT / base

    let afterComma = ''
    if (fractionalPart !== 0n) {
        afterComma = fractionalPart.toString()
        afterComma = afterComma.padStart(decimals, '0')
        afterComma = afterComma.replace(/0+$/, '')
    }

    return {
        integer: integerPart.toString(),
        fractional: afterComma
    }
}

/**
 * Parses a human-readable asset Quantity (with group separators) into QNT format.
 *
 * @param {string|number|undefined|string[]} quantity - Human-readable Amount (e.g., "1,234.56" or 1234.56).
 * @param {number} decimals - Number of decimals for the asset.
 * @returns {string} Quantity in QNT format.
 * @throws {Error} if invalid input is found
 */
export function parseQuantityToQNT(quantity: string | number | undefined | string[], decimals: number): string {
    // decimals validation
    if (typeof decimals !== 'number') {
        console.error('Wrong decimal type')
        decimals = Number(decimals)
    }
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 8) {
        console.error('Decimals must be integers between 0 and 8')
        throw new Error($.t('error_invalid_input'))
    }

    // quantity validation
    let numberObj: ParsedNumberObject
    switch (typeof quantity) {
    case 'string': {
        numberObj = extractPartsFromString(quantity.trim())
        break
    }
    case 'number': {
        const jsString = quantity.toFixed(8)
        const parts = jsString.split('.')
        numberObj = {
            integer: parts[0],
            fractional: parts[1]
        }
        break
    }
    default:
        // Should happen only for devs
        console.error('Invalid argument value.')
        // Fail silently
        return '0'
    }
    if (numberObj.fractional.length > decimals) {
        throw new Error($.t('error_fraction_decimals', {
            decimals
        }))
    }
    const retQNT = (numberObj.integer + numberObj.fractional.padEnd(decimals, '0')).replace(/^0+/, '')
    if (retQNT === '') {
        return '0'
    }
    return retQNT
}

/**
 * Formats a NumberObject into a localized string for display.
 *
 * @param {ParsedNumberObject} params
 * @returns {string} Formatted number string (e.g., "1,234.56" in en-US).
 */
function format (params: ParsedNumberObject) : string {
    const formattedAmount = BigInt(params.integer).toLocaleString(BRS.settings.language)
    if (params.fractional.length) {
        return formattedAmount + BRS.decimalSign + params.fractional
    }
    return formattedAmount
}

/**
 * Converts an asset quantity from QNT format to Quantity format and formats it for display.
 *
 * @param {string|number} quantityQNT - Quantity in QNT format.
 * @param {number} decimals - Number of decimals for the asset.
 * @returns {string} Formatted Quantity string (e.g., "1,234.56" in en-US).
 */
export function formatQNTAsQuantity(quantityQNT: string | number, decimals: number): string {
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
export function formatNQTAsAmount(amountNQT: string | number | bigint): string {
    if (typeof amountNQT === 'number') {
        console.error("Do not use number here")
        amountNQT *= 1E8
    }
    const biAmountNQT = BigInt(amountNQT)
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
export function formatTimestampAsDateTime(timestamp: number, date_only: boolean = false): string {
    const date = new Date((BRS.genesisSeconds + timestamp) * 1000)
    if (date_only) {
        return date.toLocaleDateString(BRS.settings.language)
    }
    return date.toLocaleString(BRS.settings.language)
}

/**
 * Checks an user input amount and returns its integer and fractional parts.
 * @param amount String that is supposed to be a localized number.
 * @returns string[] with integer part, and fractional part, if any.
 * @throws {Error} if invalid input is found.
 */
function extractPartsFromString (amount: string) : ParsedNumberObject{
    if (amount === '') {
        return {
            integer: '0',
            fractional: ''
        }
    }
    // Check for invalid characters before cleaning
    const allowedChars = new RegExp(
        '^[0-9'
        + BRS.decimalSign.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        + BRS.groupSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ']+$'
    );
    if (!allowedChars.test(amount)) {
        // Find the first invalid character
        const invalidChar = amount.split('').find(char => !allowedChars.test(char));
        throw new Error($.t('error_invalid_char', { char: invalidChar }));
    }

    const cleanedValue = amount.replace(
        new RegExp('[^0-9' + BRS.decimalSign.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ']', 'g'),
        ''
    );
    const parts = cleanedValue.split(BRS.decimalSign)
    if (parts.length > 2) {
        // More than one decimal sign found
        throw new Error($.t('error_invalid_input'))
    }
    return {
        integer: parts[0],
        fractional: parts[1] || ''
    }
}

/**
 * Converts a human-readable number (localized) to Number.
 *
 * @param {string|number} userNumber - Human-friendly number. May be user input.
 * @returns {number} a javascript number.
 * @throws {Error} on invalid input
 */
export function parseAmountToNumber (userNumber: string | number | undefined | string[]) : number {
    let numberObj: ParsedNumberObject
    switch (typeof userNumber) {
    case 'string': {
        numberObj = extractPartsFromString(userNumber.trim())
        break
    }
    case 'number': {
        return userNumber
    }
    default:
        // Should happen only for devs
        console.error('Invalid argument value.')
        // Fail silently
        return 0
    }
    return Number(numberObj.integer + '.' + numberObj.fractional)
}

export function convertSecondsToDuration(durationInSeconds: number) {
    const days = Math.floor(durationInSeconds / (24 * 60 * 60))
    const remainingSecondsAfterDays = durationInSeconds % (24 * 60 * 60)

    // Calculate hours
    const hours = Math.floor(remainingSecondsAfterDays / (60 * 60))
    const remainingSecondsAfterHours = remainingSecondsAfterDays % (60 * 60)

    // Calculate minutes and seconds
    const minutes = Math.floor(remainingSecondsAfterHours / 60)
    const seconds = remainingSecondsAfterHours % 60

    return {
        days: days,
        hours: hours,
        minutes: minutes,
        seconds: seconds,
    }
}
