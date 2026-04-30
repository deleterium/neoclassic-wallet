/**
 * @depends {brs.js}
 */

/* global BigInteger CryptoJS */

import { BRS } from '.'
import { NxtAddress } from '../util/nxtaddress'
import pako from 'pako'

import curve25519 from '../crypto/curve25519'
import * as jssha from '../crypto/jssha256'
import converters from '../util/converters'

import {
    sendRequest
} from './brs.server'

import {
    getTranslatedFieldName
} from './brs.util'

export function generatePublicKey (secretPhrase) {
    if (!secretPhrase) {
        if (BRS.rememberPassword) {
            secretPhrase = BRS._password
        } else {
            throw $.t('error_generate_public_key_noBRS._password')
        }
    }

    return getPublicKey(converters.stringToHexString(secretPhrase))
}

export function getAccountPublicKey (account) {
    let publicKey = ''
    // synchronous!
    sendRequest('getAccountPublicKey', {
        account
    }, function (response) {
        if (!response.publicKey) {
            throw $.t('error_no_public_key')
        } else {
            publicKey = response.publicKey
        }
    }, false)
    return publicKey
}

/**
 * @param {String} hexSecretPhrase in hexString format
 * @returns publicKey in hexString format
 */
export function getPublicKey (hexSecretPhrase) {
    const secretPhraseBytes = converters.hexStringToByteArray(hexSecretPhrase)
    const digest = jssha.SHA256_hash(secretPhraseBytes)
    return converters.byteArrayToHexString(curve25519.keygen(digest).p)
}

function getPrivateKey (secretPhrase) {
    const pk = jssha.SHA256_hash(converters.stringToByteArray(secretPhrase))
    curve25519.clamp(pk)
    return converters.byteArrayToHexString(pk)
}

export function getAccountId (secretPhrase) {
    return getAccountIdFromPublicKey(getPublicKey(converters.stringToHexString(secretPhrase)))
}

export function getAccountIdFromPublicKey (publicKey, RSFormat) {
    const accountBA = jssha.SHA256_hash(converters.hexStringToByteArray(publicKey))

    const accountId = byteArrayToBigInteger(accountBA.slice(0, 8)).toString()

    if (RSFormat) {
        const address = new NxtAddress(accountId)
        return address.getAccountRS(BRS.prefix)
    } else {
        return accountId
    }
}

export function encryptNote (message, options, secretPhrase) {
    try {
        if (!options.sharedKey) {
            if (!options.privateKey) {
                if (!secretPhrase) {
                    if (BRS.rememberPassword) {
                        secretPhrase = BRS._password
                    } else {
                        throw {
                            message: $.t('error_encryption_passphrase_required'),
                            errorCode: 1
                        }
                    }
                }

                options.privateKey = converters.hexStringToByteArray(getPrivateKey(secretPhrase))
            }

            if (!options.publicKey) {
                if (!options.account) {
                    throw {
                        message: $.t('error_account_id_not_specified'),
                        errorCode: 2
                    }
                }

                try {
                    options.publicKey = converters.hexStringToByteArray(getAccountPublicKey(options.account))
                } catch (err) {
                    const nxtAddress = new NxtAddress(options.account)

                    if (!nxtAddress.isOk()) {
                        throw {
                            message: $.t('error_invalid_account_id'),
                            errorCode: 3
                        }
                    } else {
                        throw {
                            message: $.t('error_public_key_not_specified'),
                            errorCode: 4
                        }
                    }
                }
            } else if (typeof options.publicKey === 'string') {
                options.publicKey = converters.hexStringToByteArray(options.publicKey)
            }
        }

        const dataToEncrypt = options.isText ? converters.stringToByteArray(message) : converters.hexStringToByteArray(message)
        const encrypted = encryptData(dataToEncrypt, options)

        return {
            message: converters.byteArrayToHexString(encrypted.data),
            nonce: converters.byteArrayToHexString(encrypted.nonce)
        }
    } catch (err) {
        if (err.errorCode && err.errorCode < 5) {
            throw err
        } else {
            throw {
                message: $.t('error_message_encryption'),
                errorCode: 5
            }
        }
    }
}

// BRS.decryptData = function (data, options, secretPhrase) {
//     try {
//         const message = ''
//         return BRS.decryptNote(message, options, secretPhrase)
//     } catch (err) {
//         const mesage = String(err.message ? err.message : err)

//         if (err.errorCode && err.errorCode == 1) {
//             return false
//         } else {
//             if (options.title) {
//                 let translatedTitle = getTranslatedFieldName(options.title).toLowerCase()
//                 if (!translatedTitle) {
//                     translatedTitle = String(options.title).escapeHTML().toLowerCase()
//                 }

//                 return $.t('error_could_not_decrypt_var', {
//                     var: translatedTitle
//                 }).capitalize()
//             } else {
//                 return $.t('error_could_not_decrypt')
//             }
//         }
//     }
// }

function decryptNote (message, options, secretPhrase) {
    try {
        if (!options.sharedKey) {
            if (!options.privateKey) {
                if (!secretPhrase) {
                    if (BRS.rememberPassword) {
                        secretPhrase = BRS._password
                    } else if (BRS._decryptionPassword) {
                        secretPhrase = BRS._decryptionPassword
                    } else {
                        throw {
                            message: $.t('error_decryption_passphrase_required'),
                            errorCode: 1
                        }
                    }
                }

                options.privateKey = converters.hexStringToByteArray(getPrivateKey(secretPhrase))
            }

            if (!options.publicKey) {
                if (!options.account) {
                    throw {
                        message: $.t('error_account_id_not_specified'),
                        errorCode: 2
                    }
                }

                options.publicKey = converters.hexStringToByteArray(getAccountPublicKey(options.account))
            }
        }

        options.nonce = converters.hexStringToByteArray(options.nonce)

        return decryptData(converters.hexStringToByteArray(message), options)
    } catch (err) {
        if (err.errorCode && err.errorCode < 3) {
            throw err
        } else {
            throw {
                message: $.t('error_message_decryption'),
                errorCode: 3
            }
        }
    }
}

// BRS.getSharedKeyWithAccount = function (account) {
//     if (account in BRS._sharedKeys) {
//         return BRS._sharedKeys[account]
//     }

//     let secretPhrase

//     if (BRS.rememberPassword) {
//         secretPhrase = BRS._password
//     } else if (BRS._decryptionPassword) {
//         secretPhrase = BRS._decryptionPassword
//     } else {
//         throw {
//             message: $.t('error_passphrase_required'),
//             errorCode: 3
//         }
//     }

//     const privateKey = converters.hexStringToByteArray(getPrivateKey(secretPhrase))

//     const publicKey = converters.hexStringToByteArray(getPublicKey(account, true))

//     const sharedKey = curve25519.sharedKeyGen(privateKey, publicKey)

//     const sharedKeys = Object.keys(BRS._sharedKeys)

//     if (sharedKeys.length > 50) {
//         delete BRS._sharedKeys[sharedKeys[0]]
//     }

//     BRS._sharedKeys[account] = sharedKey
// }

export function signBytes (message, hexSecretPhrase) {
    const messageBytes = converters.hexStringToByteArray(message)
    const secretPhraseBytes = converters.hexStringToByteArray(hexSecretPhrase)

    const digest = jssha.SHA256_hash(secretPhraseBytes)
    const s = curve25519.keygen(digest).s

    const m = jssha.SHA256_hash(messageBytes)

    const x = jssha.SHA256_double_hash(m, s)

    const y = curve25519.keygen(x).p

    const h = jssha.SHA256_double_hash(m, y)

    const v = curve25519.sign(h, x, s)

    return converters.byteArrayToHexString(v.concat(h))
}

export function verifyBytes (signature, message, publicKey) {
    const signatureBytes = converters.hexStringToByteArray(signature)
    const messageBytes = converters.hexStringToByteArray(message)
    const publicKeyBytes = converters.hexStringToByteArray(publicKey)
    const v = signatureBytes.slice(0, 32)
    const h = signatureBytes.slice(32)
    const y = curve25519.verify(v, h, publicKeyBytes)

    const m = jssha.SHA256_hash(messageBytes)

    const h2 = jssha.SHA256_double_hash(m, y)

    return areByteArraysEqual(h, h2)
}

export function setEncryptionPassword (password) {
    BRS._password = password
}

export function getEncryptionPassword () {
    return BRS._password
}

export function setDecryptionPassword (password) {
    BRS._decryptionPassword = password
}

export function addDecryptedTransaction (identifier, content) {
    if (!BRS._decryptedTransactions[identifier]) {
        BRS._decryptedTransactions[identifier] = content
    }
}

export function tryToDecryptMessage (message) {
    if (BRS._decryptedTransactions && BRS._decryptedTransactions[message.transaction]) {
        return BRS._decryptedTransactions[message.transaction].encryptedMessage
    }

    if (!message.attachment.encryptedMessage.data) {
        return $.t('message_empty')
    }
    return decryptNote(message.attachment.encryptedMessage.data, {
        nonce: message.attachment.encryptedMessage.nonce,
        account: (message.recipient === BRS.account ? message.sender : message.recipient)
    })
}

export function tryToDecrypt (transaction, fields, account, options) {
    let showDecryptionForm = false

    if (!options) {
        options = {}
    }

    const nrFields = Object.keys(fields).length

    const formEl = (options.formEl ? String(options.formEl).escapeHTML() : '#transaction_info_output_bottom')
    const outputEl = (options.outputEl ? String(options.outputEl).escapeHTML() : '#transaction_info_output_bottom')

    let output = ''

    const identifier = (options.identifier ? transaction[options.identifier] : transaction.transaction)

    // check in cache first..
    if (BRS._decryptedTransactions && BRS._decryptedTransactions[identifier]) {
        const decryptedTransaction = BRS._decryptedTransactions[identifier]

        $.each(fields, function (key, title) {
            if (typeof title !== 'string') {
                title = title.title
            }

            if (key in decryptedTransaction) {
                output += "<div style='" + (!options.noPadding && title ? 'padding-left:5px;' : '') + "'>" + (title ? '<label' + (nrFields > 1 ? " style='margin-top:5px'" : '') + "><i class='fas fa-lock'></i> " + String(title).escapeHTML() + '</label>' : '') + "<div class='modal-text-box'>" + String(decryptedTransaction[key]).escapeHTML().nl2br() + '</div></div>'
            } else {
                // if a specific key was not found, the cache is outdated..
                output = ''
                delete BRS._decryptedTransactions[identifier]
                return false
            }
        })
    }

    if (!output) {
        $.each(fields, function (key, title) {
            let data = ''

            let encrypted = ''
            let nonce = ''
            let isText = true
            const nonceField = (typeof title !== 'string' ? title.nonce : key + 'Nonce')

            if (key === 'encryptedMessage' || key === 'encryptToSelfMessage') {
                encrypted = transaction.attachment[key].data
                nonce = transaction.attachment[key].nonce
                isText = transaction.attachment[key].isText
            } else if (transaction.attachment && transaction.attachment[key]) {
                encrypted = transaction.attachment[key]
                nonce = transaction.attachment[nonceField]
            } else if (transaction[key] && typeof transaction[key] === 'object') {
                encrypted = transaction[key].data
                nonce = transaction[key].nonce
            } else if (transaction[key]) {
                encrypted = transaction[key]
                nonce = transaction[nonceField]
            } else {
                encrypted = ''
            }

            if (encrypted) {
                if (typeof title !== 'string') {
                    title = title.title
                }

                try {
                    let destinationAccount = account
                    if (key === 'encryptToSelfMessage') {
                        destinationAccount = BRS.account
                    }
                    data = decryptNote(encrypted, {
                        nonce,
                        account: destinationAccount,
                        isText
                    })
                } catch (err) {
                    if (err.errorCode && err.errorCode === 1) {
                        showDecryptionForm = true
                        return false
                    } else {
                        if (title) {
                            let translatedTitle = getTranslatedFieldName(title).toLowerCase()
                            if (!translatedTitle) {
                                translatedTitle = String(title).escapeHTML().toLowerCase()
                            }

                            data = $.t('error_could_not_decrypt_var', {
                                var: translatedTitle
                            }).capitalize()
                        } else {
                            data = $.t('error_could_not_decrypt')
                        }
                    }
                }

                output += "<div style='" + (!options.noPadding && title ? 'padding-left:5px;' : '') + "'>" + (title ? '<label' + (nrFields > 1 ? " style='margin-top:5px'" : '') + "><i class='fas fa-lock'></i> " + String(title).escapeHTML() + '</label>' : '') + "<div class='modal-text-box'>" + String(data).escapeHTML().nl2br() + '</div></div>'
            }
        })
    }

    if (showDecryptionForm) {
        BRS._encryptedNote = {
            transaction,
            fields,
            account,
            options,
            identifier
        }

        $('#decrypt_note_form_container').detach().appendTo(formEl)

        $('#decrypt_note_form_container, ' + formEl).show()
    } else {
        removeDecryptionForm()
        $(outputEl).append(output).show()
    }
}

export function removeDecryptionForm ($modal) {
    if (($modal && $modal.find('#decrypt_note_form_container').length) || (!$modal && $('#decrypt_note_form_container').length)) {
        $('#decrypt_note_form_container input').val('')
        $('#decrypt_note_form_container').find('.callout').html($.t('passphrase_required_to_decrypt_data'))
        $('#decrypt_note_form_container').hide().detach().appendTo('body')
    }
}

export function decryptNoteFormSubmit () {
    const $form = $('#decrypt_note_form_container')

    if (!BRS._encryptedNote) {
        $form.find('.callout').html($.t('error_encrypted_note_not_found')).show()
        return
    }

    let password = $form.find('input[name=secretPhrase]').val()

    if (!password) {
        if (BRS.rememberPassword) {
            password = BRS._password
        } else if (BRS._decryptionPassword) {
            password = BRS._decryptionPassword
        } else {
            $form.find('.callout').html($.t('error_passphrase_required')).show()
            return
        }
    }

    const accountId = getAccountId(password)
    if (accountId !== BRS.account) {
        $form.find('.callout').html($.t('error_incorrect_passphrase')).show()
        return
    }

    const rememberPassword = $form.find('input[name=rememberPassword]').is(':checked')

    const otherAccount = BRS._encryptedNote.account

    let output = ''
    let decryptionError = false
    const decryptedFields = {}

    const nrFields = Object.keys(BRS._encryptedNote.fields).length

    $.each(BRS._encryptedNote.fields, function (key, title) {
        let data = ''

        let encrypted = ''
        let nonce = ''
        const nonceField = (typeof title !== 'string' ? title.nonce : key + 'Nonce')

        if (key === 'encryptedMessage' || key === 'encryptToSelfMessage') {
            encrypted = BRS._encryptedNote.transaction.attachment[key].data
            nonce = BRS._encryptedNote.transaction.attachment[key].nonce
        } else if (BRS._encryptedNote.transaction.attachment && BRS._encryptedNote.transaction.attachment[key]) {
            encrypted = BRS._encryptedNote.transaction.attachment[key]
            nonce = BRS._encryptedNote.transaction.attachment[nonceField]
        } else if (BRS._encryptedNote.transaction[key] && typeof BRS._encryptedNote.transaction[key] === 'object') {
            encrypted = BRS._encryptedNote.transaction[key].data
            nonce = BRS._encryptedNote.transaction[key].nonce
        } else if (BRS._encryptedNote.transaction[key]) {
            encrypted = BRS._encryptedNote.transaction[key]
            nonce = BRS._encryptedNote.transaction[nonceField]
        } else {
            encrypted = ''
        }

        if (encrypted) {
            if (typeof title !== 'string') {
                title = title.title
            }

            try {
                let destinationAccount = otherAccount
                if (key === 'encryptToSelfMessage') {
                    destinationAccount = BRS.account
                }
                data = decryptNote(encrypted, {
                    nonce,
                    account: destinationAccount
                }, password)

                decryptedFields[key] = data
            } catch (err) {
                decryptionError = true
                const message = String(err.message ? err.message : err)

                $form.find('.callout').html(message.escapeHTML())
                return false
            }

            output += "<div style='" + (!BRS._encryptedNote.options.noPadding && title ? 'padding-left:5px;' : '') + "'>" + (title ? '<label' + (nrFields > 1 ? " style='margin-top:5px'" : '') + "><i class='fas fa-lock'></i> " + String(title).escapeHTML() + '</label>' : '') + "<div class='modal-text-box'>" + String(data).escapeHTML().nl2br() + '</div></div>'
        }
    })

    if (decryptionError) {
        return
    }

    BRS._decryptedTransactions[BRS._encryptedNote.identifier] = decryptedFields

    // only save 150 decryptions maximum in cache...
    const decryptionKeys = Object.keys(BRS._decryptedTransactions)

    if (decryptionKeys.length > 150) {
        delete BRS._decryptedTransactions[decryptionKeys[0]]
    }

    removeDecryptionForm()

    const outputEl = (BRS._encryptedNote.options.outputEl ? String(BRS._encryptedNote.options.outputEl).escapeHTML() : '#transaction_info_output_bottom')

    $(outputEl).append(output).show()

    BRS._encryptedNote = null

    if (rememberPassword) {
        BRS._decryptionPassword = password
    }
}

export function decryptAllMessages (messages, password) {
    if (!password) {
        throw {
            message: $.t('error_passphrase_required'),
            errorCode: 1
        }
    } else {
        const accountId = getAccountId(password)
        if (accountId !== BRS.account) {
            throw {
                message: $.t('error_incorrect_passphrase'),
                errorCode: 2
            }
        }
    }

    let success = 0
    let error = 0

    for (let i = 0; i < messages.length; i++) {
        const message = messages[i]

        if (message.attachment.encryptedMessage && !BRS._decryptedTransactions[message.transaction]) {
            try {
                const otherUser = (message.sender === BRS.account ? message.recipient : message.sender)

                const decoded = decryptNote(message.attachment.encryptedMessage.data, {
                    nonce: message.attachment.encryptedMessage.nonce,
                    account: otherUser
                }, password)

                BRS._decryptedTransactions[message.transaction] = {
                    encryptedMessage: decoded
                }

                success++
            } catch (err) {
                BRS._decryptedTransactions[message.transaction] = {
                    encryptedMessage: $.t('error_decryption_unknown')
                }
                error++
            }
        }
    }

    if (success || !error) {
        return true
    } else {
        return false
    }
}

function areByteArraysEqual (bytes1, bytes2) {
    if (bytes1.length !== bytes2.length) {
        return false
    }

    for (let i = 0; i < bytes1.length; ++i) {
        if (bytes1[i] !== bytes2[i]) {
            return false
        }
    }

    return true
}

function byteArrayToBigInteger (byteArray, startIndex) {
    let value = new BigInteger('0', 10)
    let temp1, temp2
    for (let i = byteArray.length - 1; i >= 0; i--) {
        temp1 = value.multiply(new BigInteger('256', 10))
        temp2 = temp1.add(new BigInteger(byteArray[i].toString(10), 10))
        value = temp2
    }

    return value
}

function aesEncrypt (plaintext, options) {
    if (!window.crypto && !window.msCrypto) {
        throw {
            errorCode: -1,
            message: $.t('error_encryption_browser_support')
        }
    }

    // CryptoJS likes WordArray parameters
    const text = converters.byteArrayToWordArray(plaintext)
    let sharedKey
    if (!options.sharedKey) {
        sharedKey = curve25519.sharedkey(options.privateKey, options.publicKey)
    } else {
        sharedKey = options.sharedKey.slice(0) // clone
    }

    for (let i = 0; i < 32; i++) {
        sharedKey[i] ^= options.nonce[i]
    }

    const key = converters.byteArrayToWordArray(jssha.SHA256_hash(sharedKey))

    const tmp = new Uint8Array(16)

    if (window.crypto) {
        window.crypto.getRandomValues(tmp)
    } else {
        window.msCrypto.getRandomValues(tmp)
    }

    const iv = converters.byteArrayToWordArray(tmp)
    const encrypted = CryptoJS.AES.encrypt(text, key, {
        iv
    })

    const ivOut = converters.wordArrayToByteArray(encrypted.iv)

    const ciphertextOut = converters.wordArrayToByteArray(encrypted.ciphertext)

    return ivOut.concat(ciphertextOut)
}

function aesDecrypt (ivCiphertext, options) {
    if (ivCiphertext.length < 16 || ivCiphertext.length % 16 !== 0) {
        throw {
            name: 'invalid ciphertext'
        }
    }

    const iv = converters.byteArrayToWordArray(ivCiphertext.slice(0, 16))
    const ciphertext = converters.byteArrayToWordArray(ivCiphertext.slice(16))

    let sharedKey
    if (!options.sharedKey) {
        sharedKey = curve25519.sharedkey(options.privateKey, options.publicKey)
    } else {
        sharedKey = options.sharedKey.slice(0) // clone
    }

    for (let i = 0; i < 32; i++) {
        sharedKey[i] ^= options.nonce[i]
    }

    const key = converters.byteArrayToWordArray(jssha.SHA256_hash(sharedKey))

    const encrypted = CryptoJS.lib.CipherParams.create({
        ciphertext,
        iv,
        key
    })

    const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
        iv
    })

    const plaintext = converters.wordArrayToByteArray(decrypted)

    return plaintext
}

function encryptData (plaintext, options) {
    if (!window.crypto && !window.msCrypto) {
        throw {
            errorCode: -1,
            message: $.t('error_encryption_browser_support')
        }
    }

    if (!options.sharedKey) {
        options.sharedKey = curve25519.sharedkey(options.privateKey, options.publicKey)
    }

    const compressedPlaintext = pako.gzip(new Uint8Array(plaintext))

    options.nonce = new Uint8Array(32)

    if (window.crypto) {
        window.crypto.getRandomValues(options.nonce)
    } else {
        window.msCrypto.getRandomValues(options.nonce)
    }

    const data = aesEncrypt(compressedPlaintext, options)

    return {
        nonce: options.nonce,
        data
    }
}

function decryptData (data, options) {
    if (!options.sharedKey) {
        options.sharedKey = curve25519.sharedkey(options.privateKey, options.publicKey)
    }

    const compressedPlaintext = aesDecrypt(data, options)

    const binData = new Uint8Array(compressedPlaintext)

    const data2 = pako.inflate(binData)

    if (options.isText) {
        return converters.byteArrayToString(data2)
    }
    return converters.byteArrayToHexString(data2)
}
