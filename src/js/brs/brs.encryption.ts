/**
 * @depends {brs.js}
 */

/* global CryptoJS */

import { BRS } from '.'
import { NxtAddress } from '../util/nxtaddress'
import pako from 'pako'
import sha256 from 'js-sha256'

import curve25519 from '../crypto/curve25519'
import converters from '../util/converters'

import {
    sendRequest
} from './brs.server'

import { ByteArray, HexString, Transaction } from '../typings'

type CryptoOptions = {
    nonce: HexString,
    privateKey: HexString,
    publicKey: HexString,
    isText: boolean
}

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

export function getAccountPublicKey (account: string) {
    let publicKey = ''
    // synchronous!
    sendRequest('getAccountPublicKey', {
        account
    }, function (response) {
        if (!response.publicKey) {
            throw {
                brsErrorMessage: $.t('error_no_public_key')
            }
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
    const digest = sha256.digest(secretPhraseBytes)
    return converters.byteArrayToHexString(curve25519.keygen(digest).p)
}

function getPrivateKey (secretPhrase) {
    const pk = sha256.digest(converters.stringToByteArray(secretPhrase))
    curve25519.clamp(pk)
    return converters.byteArrayToHexString(pk)
}

export function getAccountId (secretPhrase) {
    return getAccountIdFromPublicKey(getPublicKey(converters.stringToHexString(secretPhrase)))
}

export function getAccountIdFromPublicKey (publicKey, RSFormat) {
    const accountBA = sha256.digest(converters.hexStringToByteArray(publicKey))

    const accountId = converters.byteArrayToBigInteger(accountBA.slice(0, 8)).toString()

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

function decryptNote (message: HexString, options: CryptoOptions) {
    const decryptedData = decryptData(converters.hexStringToByteArray(message), options)
    if (options.isText) {
        return converters.byteArrayToString(decryptedData)
    }
    return converters.byteArrayToHexString(decryptedData)
}

function createCryptoOptions (otherUser: string, nonce: HexString, isText: boolean, secretPhrase?: string) : CryptoOptions {
    const publicKey = getAccountPublicKey(otherUser)
    const password = secretPhrase || getDecryptionPassword()
    if (!password) {
        throw {
                brsErrorMessage: $.t('error_decryption_passphrase_required')
            }
    }
    const privateKey = getPrivateKey(password)
    return {
        nonce,
        publicKey,
        privateKey,
        isText
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

function doubleHash (data1, data2) {
    const combined = new Uint8Array(data1.length + data2.length)
    combined.set(data1)
    combined.set(data2, data1.length)
    return sha256.digest(combined)
}

export function signBytes (message, hexSecretPhrase) {
    const messageBytes = converters.hexStringToByteArray(message)
    const secretPhraseBytes = converters.hexStringToByteArray(hexSecretPhrase)

    const digest = sha256.digest(secretPhraseBytes)
    const s = curve25519.keygen(digest).s

    const m = sha256.digest(messageBytes)

    const x = doubleHash(m, s)

    const y = curve25519.keygen(x).p

    const h = doubleHash(m, y)

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

    const m = sha256.digest(messageBytes)

    const h2 = doubleHash(m, y)

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

export function getDecryptionPassword () {
    if (BRS.rememberPassword) {
        return BRS._password
    }
    if (BRS._decryptionPassword) {
        return BRS._decryptionPassword
    }
    return undefined
}

export function addDecryptedTransactionToCache (identifier, content) {
    if (!BRS._decryptedTransactions[identifier]) {
        BRS._decryptedTransactions[identifier] = content
    } else {
        // Merge content
        Object.assign(BRS._decryptedTransactions[identifier], content);
    }
}

/** Get a decoded from cache.
 * @param {TransactionID} TransactionID from blockchain
 * @returns {string|undefined} Decoded message, or undefined if no decoded message found
 */
export function getDecryptedMessageFromCache (txid, field) {
    if (!BRS._decryptedTransactions || !BRS._decryptedTransactions[txid] || !BRS._decryptedTransactions[txid][field]) {
        return undefined
    }
    return BRS._decryptedTransactions[txid][field]
}

/**
 * Decrypt the encrypted message of the given transaction.
 * @param {Transaction} tx - The transaction containing the encrypted message.
 * @param {boolean} throwOnError - Set true to throw exception on error. If false, the error is returned as decoded message.
 * @param {string} password - User password
 * @returns {string} The message decrypted. If the message was not text, it returns the decoded hex string.
 * 
 * @description
 * * This function decrypts the encrypted message from a transaction using the provided password.
 * If the transaction already was decoded, return it.
 * It checks if the account ID derived from the password matches the current user's account.
 * If the message is successfully decrypted, it updates the decrypted messages cache.
 * In case of an error during decryption, it can return the error, or, if throwOnError, throws an object with prop `brsError` with the error message.
 */
export /* async */ function decryptAttachmentField (tx: Transaction, field: 'encryptedMessage' | 'encryptToSelfMessage', throwOnError: boolean, password: string) {
    const messageInCache = getDecryptedMessageFromCache(tx.transaction, field)
    if (messageInCache) {
        return messageInCache
    }
    const accountId = getAccountId(password)
    if (accountId !== BRS.account) {
        if (throwOnError) {
            throw { brsError: $.t('error_incorrect_passphrase') }
        }
        return $.t('error_incorrect_passphrase')
    }
    if (!tx.attachment[field]) {
        if (throwOnError) {
            throw { brsError: $.t('message_empty') }
        }
        return ''
    }
    try {
        let recipientID = BRS.account
        if (field === 'encryptedMessage') {
            recipientID = (tx.sender === BRS.account ? tx.recipient : tx.sender) as string
        }
        const options = createCryptoOptions(
            recipientID,
            tx.attachment[field].nonce,
            tx.attachment[field].isText,
            password
        )
        const decoded = decryptNote(tx.attachment[field].data, options)
        addDecryptedTransactionToCache(tx.transaction, { [field]: decoded })
        return decoded
    } catch (err: any) {
        if (err.brsErrorMessage) {
            if (throwOnError) {
                throw err
            }
            return err.brsErrorMessage
        }
        console.error(err)
        if (throwOnError) {
            throw { brsError: $.t('error_decryption_unknown') }
        }
        return $.t('error_decryption_unknown')
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

    const key = converters.byteArrayToWordArray(sha256.digest(sharedKey))

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

function aesDecrypt (ivCiphertext: ByteArray, options: CryptoOptions) {
    if (ivCiphertext.length < 16 || ivCiphertext.length % 16 !== 0) {
        throw {
            name: 'invalid ciphertext'
        }
    }

    const iv = converters.byteArrayToWordArray(ivCiphertext.slice(0, 16))
    const ciphertext = converters.byteArrayToWordArray(ivCiphertext.slice(16))

    const sharedKey = curve25519.sharedkey(
        converters.hexStringToByteArray(options.privateKey),
        converters.hexStringToByteArray(options.publicKey)
    )

    const nonce = converters.hexStringToByteArray(options.nonce)
    for (let i = 0; i < 32; i++) {
        sharedKey[i] ^= nonce[i]
    }

    const key = converters.byteArrayToWordArray(sha256.digest(sharedKey))

    const encrypted = CryptoJS.lib.CipherParams.create({
        ciphertext,
        iv,
        key
    })

    const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
        iv
    })

    const decryptedBA = converters.wordArrayToByteArray(decrypted)

    return decryptedBA
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


function decryptData (data: ByteArray, options: CryptoOptions) {
    const compressedDecrypted = aesDecrypt(data, options)
    const compressedDecryptedBA = new Uint8Array(compressedDecrypted)
    const decrypted = pako.inflate(compressedDecryptedBA)
    return decrypted
}
