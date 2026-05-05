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
    getSavedPassword,
    sendRequest
} from './brs.server'

import {
    ByteArray,
    HexString,
    Transaction
} from '../typings'

type CryptoOptions = {
    nonce: HexString,
    privateKey: HexString,
    publicKey: HexString,
    isText: boolean
}

// region Public Key

export function generatePublicKey (secretPhrase?: string) {
    const passphrase = secretPhrase ?? getSavedPassword()
    if (!passphrase) {
        throw $.t('error_generate_public_key_noBRS._password')
    }
    return getPublicKeyFromPassphrase(secretPhrase)
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
 * @param {String} secretphrase in hexString format
 * @returns publicKey in hexString format
 */
export function getPublicKeyFromPassphrase (secretphrase?: string) : HexString {
    if (!secretphrase) {
        throw $.t('error_generate_public_key_no_password')
    }
    const secretPhraseBytes = converters.stringToByteArray(secretphrase)
    const digest = sha256.digest(secretPhraseBytes)
    return converters.byteArrayToHexString(curve25519.keygen(digest).p)
}

// region Private Key

function getPrivateKey (secretPhrase: string) : HexString {
    const pk = sha256.digest(converters.stringToByteArray(secretPhrase))
    curve25519.clamp(pk)
    return converters.byteArrayToHexString(pk)
}

// region Accound ID

export function getAccountId (secretPhrase: string) {
    const publicKey = getPublicKeyFromPassphrase(secretPhrase)
    const accountId = getAccountIdFromPublicKey(publicKey, false)
    return accountId
}

export function getAccountIdFromPublicKey (publicKey: HexString, isRSFormat: boolean) {
    const accountBA = sha256.digest(converters.hexStringToByteArray(publicKey))
    const accountId = converters.byteArrayToBigInteger(accountBA.slice(0, 8)).toString()
    if (isRSFormat) {
        const address = new NxtAddress(accountId)
        return address.getAccountRS(BRS.prefix)
    } else {
        return accountId
    }
}

// region CryptoOption

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

export function createEncryptionToOtherOptions (
    otherAccount: string,
    otherPublicKey: HexString,
    isText: boolean,
    secretPhrase?: string
) : CryptoOptions {
    const publicKey = otherPublicKey || getAccountPublicKey(otherAccount)
    if (publicKey.length !== 64) {
        throw {
            message: $.t('error_public_key_not_specified'),
        }
    }
    const password = secretPhrase || getDecryptionPassword()
    if (!password) {
        throw {
                message: $.t('error_decryption_passphrase_required')
            }
    }
    const privateKey = getPrivateKey(password)
    const nonce = new Uint8Array(32)
    window.crypto.getRandomValues(nonce)
    return {
        publicKey,
        privateKey,
        isText,
        nonce: converters.byteArrayToHexString(nonce)
    }
}

export function createEncryptionToSelfOptions (isText: boolean, secretPhrase?: string) : CryptoOptions {
    const password = secretPhrase || getDecryptionPassword()
    if (!password) {
        throw {
            message: $.t('error_decryption_passphrase_required')
        }
    }
    const privateKey = getPrivateKey(password)
    const publicKey = getPublicKeyFromPassphrase(password)
    const nonce = new Uint8Array(32)
    window.crypto.getRandomValues(nonce)
    return {
        publicKey,
        privateKey,
        isText,
        nonce: converters.byteArrayToHexString(nonce)
    }
}

// region Sign / Verify

function doubleHash (data1, data2) {
    const combined = new Uint8Array(data1.length + data2.length)
    combined.set(data1)
    combined.set(data2, data1.length)
    return sha256.digest(combined)
}

function areByteArraysEqual (bytes1: ByteArray, bytes2: ByteArray) : boolean {
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

export function signBytes (message: HexString, secretPhrase: string) : HexString {
    const messageBytes = converters.hexStringToByteArray(message)
    const secretPhraseBytes = converters.stringToByteArray(secretPhrase)
    const digest = sha256.digest(secretPhraseBytes)
    const s = curve25519.keygen(digest).s
    const m = sha256.digest(messageBytes)
    const x = doubleHash(m, s)
    const y = curve25519.keygen(x).p
    const h = doubleHash(m, y)
    const v = curve25519.sign(h, x, s)
    return converters.byteArrayToHexString(v.concat(h))
}

export function verifyBytes (signature: HexString, message: HexString, publicKey: HexString) : boolean {
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

// region Passphrase helper

export function setEncryptionPassword (password: string) : void {
    BRS._password = password
}

export function getEncryptionPassword () : string {
    return BRS._password
}

export function setDecryptionPassword (password: string) : void {
    BRS._decryptionPassword = password
}

export function getDecryptionPassword () : string | undefined {
    if (BRS.rememberPassword) {
        return BRS._password
    }
    if (BRS._decryptionPassword) {
        return BRS._decryptionPassword
    }
    return undefined
}

// region Decryption cache

export function addDecryptedTransactionToCache (identifier: string, content: any) {
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
export function getDecryptedMessageFromCache (txid: string, field: 'encryptedMessage' | 'encryptToSelfMessage') : string | undefined {
    if (!BRS._decryptedTransactions || !BRS._decryptedTransactions[txid] || !BRS._decryptedTransactions[txid][field]) {
        return undefined
    }
    return BRS._decryptedTransactions[txid][field]
}

// region Decryption process

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
export /* async */ function decryptAttachmentField (tx: Transaction, field: 'encryptedMessage' | 'encryptToSelfMessage', throwOnError: boolean, password: string) : string {
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

function decryptNote (message: HexString, options: CryptoOptions) {
    const decryptedData = decryptData(converters.hexStringToByteArray(message), options)
    if (options.isText) {
        return converters.byteArrayToString(decryptedData)
    }
    return converters.byteArrayToHexString(decryptedData)
}

function decryptData (data: ByteArray, options: CryptoOptions) {
    const compressedDecrypted = aesDecrypt(data, options)
    const compressedDecryptedBA = new Uint8Array(compressedDecrypted)
    const decrypted = pako.inflate(compressedDecryptedBA)
    return decrypted
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

// region Encryption process

export function encryptNote (message: HexString, options: CryptoOptions) {
    try {
        const dataToEncrypt = options.isText ? converters.stringToByteArray(message) : converters.hexStringToByteArray(message)
        const encrypted = encryptData(dataToEncrypt, options)
        return {
            message: converters.byteArrayToHexString(encrypted),
            nonce: options.nonce
        }
    } catch (err) {
        throw {
            message: $.t('error_message_encryption')
        }
    }
}

function encryptData (data: ByteArray, options: CryptoOptions) : ByteArray {
    const compressedData = pako.gzip(new Uint8Array(data))
    const encrypted = aesEncrypt(compressedData, options)
    return encrypted
}

function aesEncrypt (plaintext: Uint8Array, options: CryptoOptions) : ByteArray {
    // CryptoJS likes WordArray parameters
    const text = converters.byteArrayToWordArray(plaintext)
    const sharedKey = curve25519.sharedkey(
        converters.hexStringToByteArray(options.privateKey),
        converters.hexStringToByteArray(options.publicKey)
    )
    const nonceBA = converters.hexStringToByteArray(options.nonce)
    for (let i = 0; i < 32; i++) {
        sharedKey[i] ^= nonceBA[i]
    }
    const key = converters.byteArrayToWordArray(sha256.digest(sharedKey))
    const tmp = new Uint8Array(16)
    window.crypto.getRandomValues(tmp)
    const iv = converters.byteArrayToWordArray(tmp)
    const encrypted = CryptoJS.AES.encrypt(text, key, {
        iv
    })
    const ivOut = converters.wordArrayToByteArray(encrypted.iv)
    const ciphertextOut = converters.wordArrayToByteArray(encrypted.ciphertext)
    return ivOut.concat(ciphertextOut)
}
