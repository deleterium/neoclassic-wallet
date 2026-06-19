import converters from '../util/converters'

import { BRS } from '.'

import { getSavedPassword, sendRequest } from './brs.sendRequest'

import {
    getAccountIdFromPublicKey,
    getAccountPublicKey,
    getPublicKeyFromPassphrase,
    signBytes,
    verifyBytes
} from './brs.encryption'

import { HexString, ParseTransactionResponse } from '../typings'

export function formsSignModalButtonClicked () {
    if ($('#sign_message_nav').hasClass('active')) {
        BRS.forms.signMessage()
    } else {
        BRS.forms.verifyMessage()
    }
}

export function formsSignMessage () {
    $('#sign_message_output').hide()
    const isHex = $('#sign_message_data_is_hex').is(':checked')
    const inputData = $('#sign_message_data').val() as string
    let passphrase = $('#sign_message_password').val() as string
    if (passphrase === '') passphrase = getSavedPassword()
    if (passphrase === '') {
        $('#sign_message_error').text($.t('error_passphrase_required'))
        $('#sign_message_error').show()
        return { stop: true, hide: false }
    }

    const publicKey = getPublicKeyFromPassphrase(passphrase)
    const account = getAccountIdFromPublicKey(publicKey, true)
    let hexData: string
    if (!isHex) {
        hexData = converters.stringToHexString(inputData)
    } else {
        hexData = inputData.replace(/[\n\s\r\t]/g, '')
    }
    sendRequest('parseTransaction', { transactionBytes: hexData }, function (result: ParseTransactionResponse) {
        const signature = signBytes(hexData, passphrase)
        if (!result.errorCode) {
            // Detected as transaction bytes
            $('#sign_message_error').text($.t('warning_sign_transaction'))
            $('#sign_message_error').show()
            $('#sign_message_parsed_transaction_or_signed_message').val(JSON.stringify(result, null, 2))
            const signedTransaction = hexData.slice(0, 192) + signature + hexData.slice(320);
            $('#sign_message_output_signed_transaction').text(signedTransaction).show()
            $('#sign_message_output_signature').text(signature).show()
            $('#sign_message_output_public_key').text(publicKey).show()
            $('#sign_message_output').show()
        } else {
            $('#sign_message_error').hide()
            $('#sign_message_parsed_transaction_or_signed_message').val(createSignedMessage(
                account,
                inputData,
                signature,
                isHex
            ))
            $('#sign_message_output_signed_transaction').text('').hide()
            $('#sign_message_output_signature').hide()
            $('#sign_message_output_public_key').hide()
            $('#sign_message_output').hide()
        }
    }, false)
    return { stop: true, hide: false }
}

export function formsVerifyMessage () {
    const isHex = $('#verify_message_data_is_hex').is(':checked')
    const data = $('#verify_message_data').val() as string
    const signature = String($('#verify_message_signature').val()).trim()
    let publicKey = String($('#verify_message_public_key').val()).trim()
    const isTransaction = $('#verify_message_data_is_transaction').is(':checked')
    if (isTransaction ) {
        const result = verifyBytes(signature, data, publicKey)
        if (result) {
            $('#verify_message_error').hide()
            $('#verify_message_output').text($.t('signature_is_valid'))
            $('#verify_message_output').show()
            return { stop: true, hide: false }
        }
        $('#verify_message_output').hide()
        return { error: $.t('signature_is_invalid') }
    }
    try {
        const signedMessage = parseSignedMessage(data, isHex)
        publicKey = getAccountPublicKey(signedMessage.user)
        const blockchainID = getAccountIdFromPublicKey(publicKey, true)
        if (signedMessage.user !== blockchainID) {
            return { error: $.t('error_public_key_different_account_id') }
        }
        const result = verifyBytes(signedMessage.signature, signedMessage.message, publicKey)
        if (result) {
            $('#verify_message_error').hide()
            $('#verify_message_output').text($.t('signature_is_valid'))
            $('#verify_message_output').show()
            return { stop: true, hide: false }
        }
    } catch (error) {
        return { error: (error as Error).message }
    }
    $('#verify_message_output').hide()
    return { error: $.t('signature_is_invalid') }
}

/**
 * Creates a signed message string from account, input data, and signature.
 *
 * @param {string} account - The user's account identifier.
 * @param {string} inputData - The input data.
 * @param {string} signature - The signature generated for the input data.
 * @param {boolean} isHex - Indicates if the input data should be treated as hexadecimal.
 * @returns {string} A formatted signed message string.
 */
function createSignedMessage(account: string, inputData: string, signature: string, isHex: boolean) : string {
    let slicedHexInput = '';
    if (isHex) {
        const longInput = inputData.replace(/[\n\s\r\t]/g, '')
        for (let i = 0; i < longInput.length; i += 64) {
            const chunk = longInput.slice(i, i + 64);
            slicedHexInput += chunk + '\n';
        }
        slicedHexInput = slicedHexInput.trim(); // Remove the trailing newline
    }
    return `FROM: ${account}\n` +
        `${isHex ? slicedHexInput : inputData}\n` +
        `SIGNATURE:\n${signature.slice(0, 64)}\n${signature.slice(64)}`
}

/**
 * Parses a signed message input string to extract user, message, and signature.
 *
 * @param {string} input - The signed message input string.
 * @param {boolean} isHex - Indicates if the message should be treated as hexadecimal.
 * @returns {{ user: string, message: HexString, signature: HexString }} An object containing the parsed user, message, and signature.
 * @throws {Error} Throws an error if the input does not match the expected signed message format.
 */
function parseSignedMessage(input: string, isHex: boolean): { user: string, message: HexString, signature: HexString } {
    const lines = input.trim().split('\n');
    let user = '';
    let message = '';
    let signature = '';

    let curLine = 0;
    let lineText = lines[curLine].trim();
    
    // Collect the user
    if (!lineText.startsWith('FROM:')) {
        throw new Error($.t('invalid_signed_message'))
    }
    user = lineText.substring(5).trim();

    // Collect the message
    const messageLines: string[] = [];
    curLine++;
    while (curLine < lines.length) {
        lineText = lines[curLine].trim();
        if (lineText.startsWith('SIGNATURE:')) {
            break;
        }
        messageLines.push(lineText);
        curLine++;
    }
    message = messageLines.join('\n');
    if (isHex) {
        message = message.replace(/[\n\s\r\t]/g, '')
    } else {
        message = converters.stringToHexString(message)
    }

    // Collect the signature
    lineText = lines[curLine].trim();
    if (!lineText.startsWith('SIGNATURE:')) {
        throw new Error($.t('invalid_signed_message'))
    }
    curLine++;
    const signatureLines: string[] = [];
    while (curLine < lines.length) {
        lineText = lines[curLine].trim();
        signatureLines.push(lineText);
        curLine++;
    }
    signature = signatureLines.join('').trim();

    if (!user || !message || !signature) {
        throw new Error($.t('invalid_signed_message'))
    }
    return { user, message, signature };
}

export function evVerifyMessageDataIsTransactionClick (e: JQuery.ClickEvent) {
    const target = $(e.target as HTMLInputElement);
    const state = target.is(':checked')
    $('#verify_message_data_is_hex').prop('checked', state)
    if (state) {
        $('#verify_message_data_is_hex').attr('disabled', 1);
        $('#verify_message_public_key').parent().show();
        $('#verify_message_signature').parent().show();
    } else {
        $('#verify_message_public_key').parent().hide();
        $('#verify_message_signature').parent().hide();
        $('#verify_message_data_is_hex').removeAttr('disabled');
    }
}
