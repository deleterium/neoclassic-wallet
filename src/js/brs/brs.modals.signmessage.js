/**
 * @depends {brs.js}
 * @depends {brs.modals.js}
 */

import converters from '../util/converters'

import { BRS } from '.'

import { sendRequest } from './brs.server'

import {
    getPublicKeyFromPassphrase,
    signBytes,
    verifyBytes
} from './brs.encryption'

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
    let data = $('#sign_message_data').val()
    const passphrase = $('#sign_message_passphrase').val()
    if (!isHex) {
        data = converters.stringToHexString(data)
    }
    sendRequest('parseTransaction', { transactionBytes: data }, function (result) {
        console.log(result)
        let signedTransaction = ''
        const signature = signBytes(data, passphrase)
        if (result.errorCode === null) {
            $('#sign_message_error').text($.t('warning_sign_transaction'))
            $('#sign_message_error').show()
            signedTransaction = data.substr(0, 192) + signature + data.substr(320)
        }
        $('#sign_message_output_signature').text(signature)
        $('#sign_message_output_public_key').text(getPublicKeyFromPassphrase(passphrase))
        $('#sign_message_output_signed_transaction').text(signedTransaction)
        $('#sign_message_output').show()
    }, false)
    return { stop: true, hide: false }
}

export function formsVerifyMessage () {
    const isHex = $('#verify_message_data_is_hex').is(':checked')
    let data = $('#verify_message_data').val()
    const signature = $('#verify_message_signature').val().trim()
    const publicKey = $('#verify_message_public_key').val().trim()
    if (!isHex) {
        data = converters.stringToHexString(data)
    }
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
