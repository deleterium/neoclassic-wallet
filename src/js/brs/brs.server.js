/**
 * @depends {brs.js}
 */

import converters from '../util/converters'
import { BRS } from '.'
import { NxtAddress } from '../util/nxtaddress'

import {
    generatePublicKey,
    getAccountId,
    signBytes,
    verifyBytes
} from './brs.encryption'

import {
    convertPublicKeyFromBase36ToBase16,
    convertToNQT,
    translateServerError
} from './brs.util'

import { showRawTransactionModal } from './brs.modals.advanced'

export function setServerPassword (password) {
    BRS._password = password
}

export function getServerPassword () {
    return BRS._password
}

export function sendOutsideRequest (url, data, callback, async) {
    if ($.isFunction(data)) {
        async = callback
        callback = data
        data = {}
    } else {
        data = data || {}
    }

    $.support.cors = true

    $.ajax({
        url,
        crossDomain: true,
        dataType: 'json',
        type: 'GET',
        timeout: 30000,
        async: (async === undefined ? true : async),
        data
    }).done(function (json) {
        // why is this necessary??..
        if (json.errorCode && !json.errorDescription) {
            json.errorDescription = (json.errorMessage ? json.errorMessage : $.t('server_error_unknown'))
        }
        if (callback) {
            callback(json, data)
        }
    }).fail(function (xhr, textStatus, error) {
        if (callback) {
            callback({
                errorCode: -1,
                errorDescription: error
            }, {})
        }
    })
}

function convertNxtToNqt (data) {
    // convert NXT to NQT...
    let field
    try {
        const nxtFields = ['feeNXT', 'amountNXT', 'priceNXT', 'refundNXT', 'discountNXT', 'minActivationAmountNXT']
        for (let i = 0; i < nxtFields.length; i++) {
            const nxtField = nxtFields[i]
            field = nxtField.replace('NXT', '')
            if (nxtField in data) {
                data[field + 'NQT'] = convertToNQT(data[nxtField])
                delete data[nxtField]
            }
        }
        return { data }
    } catch (err) {
        return {
            errorDescription: err + ' (Field: ' + field + ')'
        }
    }
}

function addUnconfirmedProperty (response, requestType) {
    if (!response || response.errorCode) {
        return response
    }
    switch (requestType) {
    case 'getTransaction':
        if (response.block === undefined) {
            response.unconfirmed = true
            break
        }
        response.unconfirmed = false
        break
    case 'getUnconfirmedTransactions':
        if (response.unconfirmedTransactions) {
            // eslint-disable-next-line no-return-assign
            response.unconfirmedTransactions.forEach(transaction => transaction.unconfirmed = true)
        }
        break
    case 'getAccountTransactions':
        if (response.transactions) {
            response.transactions.forEach(trans => {
                if (trans.block === undefined) {
                    trans.unconfirmed = true
                } else {
                    trans.unconfirmed = false
                }
            })
        }
        break
    default:
        response.unconfirmed = false
    }
    return response
}

export function sendRequest (requestType, data, callback, async) {
    if (requestType === undefined) {
        return
    }

    if ($.isFunction(data)) {
        async = callback
        callback = data
        data = {}
    } else {
        data = data || {}
    }

    $.each(data, function (key, val) {
        if (key !== 'secretPhrase') {
            if (typeof val === 'string') {
                data[key] = $.trim(val)
            }
        }
    })

    const retObj = convertNxtToNqt(data)
    if (retObj.errorDescription !== undefined) {
        if (callback) {
            callback({
                errorCode: 1,
                errorDescription: retObj.errorDescription
            })
        }
        return
    }
    data = retObj.data

    if (!data.recipientPublicKey) {
        delete data.recipientPublicKey
    }
    if (!data.referencedTransactionFullHash) {
        delete data.referencedTransactionFullHash
    }

    // check to see if secretPhrase supplied matches logged in account, if not - show error.
    if ('secretPhrase' in data) {
        const accountId = getAccountId(BRS.rememberPassword ? BRS._password : data.secretPhrase)
        if (accountId !== BRS.account) {
            if (callback) {
                callback({
                    errorCode: 1,
                    errorDescription: $.t('error_passphrase_incorrect')
                })
            }
            return
        }
    }

    processAjaxRequest(requestType, data, callback, async)
}

export function processAjaxRequest (requestType, data, callback, async) {
    let extra
    if (data._extra) {
        extra = data._extra
        delete data._extra
    } else {
        extra = null
    }

    let currentPage = null
    let currentSubPage = null

    // means it is a page request, not a global request.. Page requests can be aborted.
    if (requestType.slice(-1) === '+') {
        requestType = requestType.slice(0, -1)
        currentPage = BRS.currentPage
    }

    if (currentPage && BRS.currentSubPage) {
        currentSubPage = BRS.currentSubPage
    }

    let type = (('secretPhrase' in data) || (data.broadcast === 'false')) ? 'POST' : 'GET'
    const url = BRS.server + '/burst?requestType=' + requestType

    if (type === 'GET') {
        // It’s challenging to manage caching in XMLHttpRequest.
        // Appending a random query string value to bypass the browser cache.
        data._ = $.now()
    }

    let secretPhrase = ''

    // unknown account..
    if (type === 'POST' && (BRS.accountInfo.errorCode && BRS.accountInfo.errorCode === 5)) {
        if (callback) {
            callback({
                errorCode: 2,
                errorDescription: $.t('error_new_account')
            }, data)
        } else {
            $.notify($.t('error_new_account'), { type: 'danger' })
        }
        return
    }

    if (data.referencedTransactionFullHash) {
        if (!/^[a-z0-9]{64}$/.test(data.referencedTransactionFullHash)) {
            const errorMessage = $.t('error_invalid_referenced_transaction_hash')
            if (callback) {
                callback({
                    errorCode: -1,
                    errorDescription: errorMessage
                }, data)
                return
            }
            $.notify(errorMessage, { type: 'danger' })
            return
        }
    }

    if (type === 'POST') {
        if (BRS.rememberPassword) {
            secretPhrase = BRS._password
        } else {
            secretPhrase = data.secretPhrase
        }
        delete data.secretPhrase

        if (BRS.accountInfo && BRS.accountInfo.publicKey) {
            data.publicKey = BRS.accountInfo.publicKey
        } else {
            data.publicKey = generatePublicKey(secretPhrase)
            BRS.accountInfo.publicKey = data.publicKey
        }
    }
    if (data.secretPhrase) {
        // Last fence to avoid sending plain text passphrases!!!
        if (!confirm($.t('confirm_send_passphrase'))) {
            return
        }
    }

    $.support.cors = true

    let ajaxCall = $.ajax
    if (type === 'GET') {
        ajaxCall = BRS.multiQueue.queue
    }

    if (requestType === 'broadcastTransaction') {
        type = 'POST'
    }

    async = (async === undefined ? true : async)
    if (async === false && type === 'GET') {
        const client = new XMLHttpRequest()
        client.open('GET', url + '&' + $.param(data), false)
        client.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8')
        client.data = data
        client.send()
        let response = JSON.parse(client.responseText)
        response = addUnconfirmedProperty(response, requestType)
        callback(response, data)
        return
    }
    ajaxCall({
        url,
        crossDomain: true,
        dataType: 'json',
        type,
        timeout: 30000,
        async: true,
        currentPage,
        currentSubPage,
        shouldRetry: (type === 'GET' ? 2 : undefined),
        data
    }).done(function (response, status, xhr) {
        response = addUnconfirmedProperty(response, requestType)

        if (secretPhrase && response.unsignedTransactionBytes && !response.errorCode && !response.error) {
            const publicKey = generatePublicKey(secretPhrase)
            const signature = signBytes(response.unsignedTransactionBytes, converters.stringToHexString(secretPhrase))
            if (!verifyBytes(signature, response.unsignedTransactionBytes, publicKey)) {
                const errorMessage = $.t('error_signature_verification_client')
                if (callback) {
                    callback({
                        errorCode: 1,
                        errorDescription: errorMessage
                    }, data)
                } else {
                    $.notify(errorMessage, { type: 'danger' })
                }
                return
            }
            const payload = verifyAndSignTransactionBytes(response.unsignedTransactionBytes, signature, requestType, data)
            if (payload.length === 0) {
                const errorMessage = $.t('error_signature_verification_server')
                if (callback) {
                    callback({
                        errorCode: 1,
                        errorDescription: errorMessage
                    }, data)
                } else {
                    $.notify(errorMessage, { type: 'danger' })
                }
                return
            }
            if (data.broadcast === 'false') {
                response.transactionBytes = payload
                showRawTransactionModal(response)
                return
            }
            if (callback) {
                if (extra) {
                    data._extra = extra
                }
                broadcastTransactionBytes(payload, callback, response, data)
            } else {
                broadcastTransactionBytes(payload, null, response, data)
            }
            return
        }
        // Request sucessfull but there was an error in response.
        if (response.errorCode || response.errorDescription || response.errorMessage || response.error) {
            response.errorDescription = translateServerError(response)
            delete response.fullHash
            if (!response.errorCode) {
                response.errorCode = -1
            }
        }
        if (response.broadcasted === false) {
            showRawTransactionModal(response)
        } else {
            if (callback) {
                if (extra) {
                    data._extra = extra
                }
                callback(response, data)
            }
            if (data.referencedTransactionFullHash && !response.errorCode) {
                $.notify($.t('info_referenced_transaction_hash'), { type: 'info' })
            }
        }
    }).fail(function (xhr, textStatus, error) {
        if ((error === 'error' || textStatus === 'error') && (xhr.status === 404 || xhr.status === 0)) {
            if (type === 'POST') {
                $.notify($.t('error_server_connect'), { type: 'danger' })
            }
        }

        if (error === 'abort') {
            return
        }
        if (callback) {
            if (error === 'timeout') {
                error = $.t('error_request_timeout')
            }
            callback({
                errorCode: -1,
                errorDescription: error
            }, {})
        }
    })
}

export function verifyAndSignTransactionBytes (transactionBytes, signature, requestType, data) {
    // this will be the reconstructed base transaction
    const transaction = {}
    // position to start attachment (if any)
    let pos = 184
    const byteArray = converters.hexStringToByteArray(transactionBytes)
    // This will bring the info to check type, subtype and attachment for a given requestType
    let attachmentSpec
    const ERROR = true
    const SUCCESS = false

    function verifyAndSignTransactionBytesMain () {
        createBaseTransaction()
        prepareData()
        attachmentSpec = getAttachmentSpec(requestType)
        if (checkBaseTransaction()) return ''
        if (checkAttachment()) return ''
        if (checkMessage()) return ''
        if (checkEncryptedMessage()) return ''
        if (checkRecipientPublicKey()) return ''
        if (checkEncryptToSelfMessage()) return ''
        return transactionBytes.substr(0, 192) + signature + transactionBytes.substr(320)
    }

    function createBaseTransaction () {
        transaction.type = byteArray[0]
        transaction.version = (byteArray[1] & 0xF0) >> 4
        transaction.subtype = byteArray[1] & 0x0F
        transaction.timestamp = String(converters.byteArrayToSignedInt32(byteArray, 2))
        transaction.deadline = String(converters.byteArrayToSignedShort(byteArray, 6))
        transaction.publicKey = converters.byteArrayToHexString(byteArray.slice(8, 40))
        transaction.recipient = String(converters.byteArrayToBigInteger(byteArray, 40))
        transaction.amountNQT = String(converters.byteArrayToBigInteger(byteArray, 48))
        transaction.feeNQT = String(converters.byteArrayToBigInteger(byteArray, 56))
        transaction.referencedTransactionFullHash = converters.byteArrayToHexString(byteArray.slice(64, 96))
        if (/^0+$/.test(transaction.referencedTransactionFullHash)) {
            transaction.referencedTransactionFullHash = ''
        }
        transaction.flags = 0
        if (transaction.version > 0) {
            transaction.flags = converters.byteArrayToSignedInt32(byteArray, 160)
            transaction.ecBlockHeight = String(converters.byteArrayToSignedInt32(byteArray, 164))
            transaction.ecBlockId = String(converters.byteArrayToBigInteger(byteArray, 168))
        }
    }

    function prepareData () {
        if (!('amountNQT' in data)) {
            data.amountNQT = '0'
        }
        if (!('recipient' in data)) {
            data.recipient = '0'
            data.recipientRS = BRS.prefix + '2222-2222-2222-22222'
        }
        if (BRS.rsRegEx.test(data.recipient)) {
            // wrong data type... Fix
            const parts = BRS.rsRegEx.exec(data.recipient)
            const address = new NxtAddress(parts[1] + parts[2])
            data.recipient = address.getAccountId()
            data.recipientRS = address.getAccountRS(BRS.prefix)
            if (parts[3]) {
                data.recipientPublicKey = convertPublicKeyFromBase36ToBase16(parts[3])
            }
        }
    }

    function checkBaseTransaction () {
        if (transaction.publicKey !== BRS.accountInfo.publicKey ||
                transaction.deadline !== data.deadline ||
                transaction.feeNQT !== data.feeNQT ||
                transaction.version === 0 ||
                transaction.type !== attachmentSpec.type ||
                transaction.subtype !== attachmentSpec.subtype) {
            return ERROR
        }
        if (transaction.recipient !== data.recipient) {
            const requestTypeWithoutRecipientInData = ['buyAlias']
            if (requestTypeWithoutRecipientInData.indexOf(requestType) === -1) {
                return ERROR
            }
        }
        if (transaction.amountNQT !== data.amountNQT) {
            // These transactions check data.amountNQT in attachment or thru postCheck()
            const requestTypeWithSeperatedAmountNQTCalculation = ['sendMoneyMulti', 'sendMoneyMultiSame', 'sendMoneyEscrow', 'addCommitment', 'removeCommitment']
            if (requestTypeWithSeperatedAmountNQTCalculation.indexOf(requestType) === -1) {
                return ERROR
            }
        }
        if ('referencedTransactionFullHash' in data) {
            if (transaction.referencedTransactionFullHash !== data.referencedTransactionFullHash) {
                return ERROR
            }
        } else if (transaction.referencedTransactionFullHash !== '') {
            return ERROR
        }
        return SUCCESS
    }

    function getAttachmentSpecV2 (rqType) {
        switch (rqType) {
        case 'issueAsset':
            return {
                type: 2,
                subtype: 0,
                attachmentInfo: [
                    { type: 'ByteString*1', value: [data.name] },
                    { type: 'ShortString*1', value: [data.description] },
                    { type: 'Long*1', value: [data.quantityQNT] },
                    { type: 'Byte*1', value: [data.decimals] },
                    { type: 'Byte*1', value: [data.mintable ? 1 : 0] }
                ]
            }
        default:
            return {
                type: -1,
                subtype: -1
            }
        }
    }

    function getAttachmentSpec (rqType) {
        switch (rqType) {
        case 'sendMoney':
            return { type: 0, subtype: 0 }
        case 'sendMoneyMulti':
            return {
                type: 0,
                subtype: 1,
                attachmentInfo: [
                    { type: 'Byte*1', value: [data.recipients.split(';').length] },
                    { type: 'Long:Long*$0', value: data.recipients.split(';') }
                ],
                postCheck () {
                    let sum = 0n
                    for (const eachRecipient of data.recipients.split(';')) {
                        sum += BigInt(eachRecipient.split(':')[1])
                    }
                    if (transaction.amountNQT !== sum.toString(10)) return ERROR
                    return SUCCESS
                }
            }
        case 'sendMoneyMultiSame':
            return {
                type: 0,
                subtype: 2,
                attachmentInfo: [
                    { type: 'Byte*1', value: [data.recipients.split(';').length] },
                    { type: 'Long*$0', value: data.recipients.split(';') }
                ],
                postCheck () {
                    const totalAmount = BigInt(data.recipients.split(';').length) * BigInt(data.amountNQT)
                    if (transaction.amountNQT !== totalAmount.toString(10)) return ERROR
                    return SUCCESS
                }
            }
        case 'sendMessage':
            return { type: 1, subtype: 0 }
        case 'setAlias':
            return {
                type: 1,
                subtype: 1,
                attachmentInfo: [
                    { type: 'ByteString*1', value: [data.aliasName] },
                    { type: 'ShortString*1', value: [data.aliasURI] }
                ]
            }
        case 'setAccountInfo':
            return {
                type: 1,
                subtype: 5,
                attachmentInfo: [
                    { type: 'ByteString*1', value: [data.name] },
                    { type: 'ShortString*1', value: [data.description] }
                ]
            }
        case 'sellAlias':
            return {
                type: 1,
                subtype: 6,
                attachmentInfo: [
                    { type: 'ByteString*1', value: [data.aliasName] },
                    { type: 'Long*1', value: [data.priceNQT] }
                ]
            }
        case 'buyAlias':
            return {
                type: 1,
                subtype: 7,
                attachmentInfo: [
                    { type: 'ByteString*1', value: [data.aliasName] }
                ]
            }
        case 'issueAsset':
            return {
                type: 2,
                subtype: 0,
                attachmentInfo: [
                    { type: 'ByteString*1', value: [data.name] },
                    { type: 'ShortString*1', value: [data.description] },
                    { type: 'Long*1', value: [data.quantityQNT] },
                    { type: 'Byte*1', value: [data.decimals] }
                ]
            }
        case 'transferAsset':
            return {
                type: 2,
                subtype: 1,
                attachmentInfo: [
                    { type: 'Long*1', value: [data.asset] },
                    { type: 'Long*1', value: [data.quantityQNT] }
                ]
            }
        case 'placeAskOrder':
            return {
                type: 2,
                subtype: 2,
                attachmentInfo: [
                    { type: 'Long*1', value: [data.asset] },
                    { type: 'Long*1', value: [data.quantityQNT] },
                    { type: 'Long*1', value: [data.priceNQT] }
                ]
            }
        case 'placeBidOrder':
            return {
                type: 2,
                subtype: 3,
                attachmentInfo: [
                    { type: 'Long*1', value: [data.asset] },
                    { type: 'Long*1', value: [data.quantityQNT] },
                    { type: 'Long*1', value: [data.priceNQT] }
                ]
            }
        case 'cancelAskOrder':
            return {
                type: 2,
                subtype: 4,
                attachmentInfo: [
                    { type: 'Long*1', value: [data.order] }
                ]
            }
        case 'cancelBidOrder':
            return {
                type: 2,
                subtype: 5,
                attachmentInfo: [
                    { type: 'Long*1', value: [data.order] }
                ]
            }
        case 'transferAssetMulti':
            return {
                type: 2,
                subtype: 9,
                attachmentInfo: [
                    { type: 'Byte*1', value: [data.assetIdsAndQuantities.split(';').length] },
                    { type: 'Long:Long*$0', value: data.assetIdsAndQuantities.split(';') }
                ]
            }
        case 'setRewardRecipient':
            return { type: 20, subtype: 0 }
        case 'addCommitment':
            return {
                type: 20,
                subtype: 1,
                attachmentInfo: [
                    { type: 'Long*1', value: [data.amountNQT] }
                ]
            }
        case 'removeCommitment':
            return {
                type: 20,
                subtype: 2,
                attachmentInfo: [
                    { type: 'Long*1', value: [data.amountNQT] }
                ]
            }
        case 'sendMoneyEscrow':
            return {
                type: 21,
                subtype: 0,
                attachmentInfo: [
                    { type: 'Long*1', value: [data.amountNQT] },
                    { type: 'Int*1', value: [data.escrowDeadline] },
                    { type: 'Byte*1', value: [['undecided', 'release', 'refund', 'split'].indexOf(data.deadlineAction)] },
                    { type: 'Byte*1', value: [data.requiredSigners] },
                    { type: 'Byte*1', value: [data.signers.split(';').length] },
                    { type: 'Long*$4', value: data.signers.split(';') }
                ]
            }
        case 'escrowSign':
            return {
                type: 21,
                subtype: 1,
                attachmentInfo: [
                    { type: 'Long*1', value: [data.escrow] },
                    { type: 'Byte*1', value: [['undecided', 'release', 'refund', 'split'].indexOf(data.decision)] }
                ]
            }
        case 'sendMoneySubscription':
            return {
                type: 21,
                subtype: 3,
                attachmentInfo: [
                    { type: 'Int*1', value: [data.frequency] }
                ]
            }
        case 'subscriptionCancel':
            return {
                type: 21,
                subtype: 4,
                attachmentInfo: [
                    { type: 'Long*1', value: [data.subscription] }
                ]
            }
        default:
            return {
                type: -1,
                subtype: -1
            }
        }
    };

    function checkAttachment () {
        const pastValues = []
        if (attachmentSpec.attachmentInfo === undefined) {
            return SUCCESS
        }
        const attachmentVersion = byteArray[pos]
        pos++
        switch (attachmentVersion) {
        case 1:
            break
        case 2:
            attachmentSpec = getAttachmentSpecV2(requestType)
            if (transaction.type === attachmentSpec.type &&
                    transaction.subtype === attachmentSpec.subtype) {
                break
            }
            return ERROR
        default:
            return ERROR
        }
        for (const item of attachmentSpec.attachmentInfo) {
            const itemType = item.type.split('*')
            const typeSpec = itemType[0]
            const repetitionSpec = itemType[1]
            let repetition
            if (repetitionSpec.startsWith('$')) {
                // variable repetition, depending on previous element
                repetition = parseInt(pastValues[repetitionSpec.substring(1)][0])
            } else {
                // fixed repetition
                repetition = parseInt(repetitionSpec)
            }
            const currentValues = []
            let sizeOfString
            for (let amount = 0; amount < repetition; amount++) {
                switch (typeSpec) {
                case 'ByteString':
                    sizeOfString = parseInt(byteArray[pos++], 10)
                    currentValues.push(converters.byteArrayToString(byteArray, pos, sizeOfString))
                    pos += sizeOfString
                    break
                case 'ShortString':
                    sizeOfString = converters.byteArrayToSignedShort(byteArray, pos)
                    pos += 2
                    currentValues.push(converters.byteArrayToString(byteArray, pos, sizeOfString))
                    pos += sizeOfString
                    break
                case 'Long:Long':
                    currentValues.push(
                        converters.byteArrayToBigInteger(byteArray, pos).toString() +
                            ':' +
                            converters.byteArrayToBigInteger(byteArray, pos + 8).toString()
                    )
                    pos += 16
                    break
                case 'Long':
                    currentValues.push(converters.byteArrayToBigInteger(byteArray, pos).toString())
                    pos += 8
                    break
                case 'Int':
                    currentValues.push(converters.byteArrayToSignedInt32(byteArray, pos).toString())
                    pos += 4
                    break
                case 'Short':
                    currentValues.push(converters.byteArrayToSignedShort(byteArray, pos).toString())
                    pos += 2
                    break
                case 'Byte':
                    currentValues.push(byteArray[pos].toString())
                    pos++
                    break
                default:
                    return ERROR
                }
            }
            for (const eachVal of item.value) {
                // Maybe the order was changed. Search all items...
                if (currentValues.find(eachParsed => eachParsed === String(eachVal)) === undefined) {
                    return ERROR
                }
            }
            // ... and ensure no item was added
            if (item.value.length !== currentValues.length) {
                return ERROR
            }
            pastValues.push(currentValues)
        }
        if (attachmentSpec.postCheck) {
            return attachmentSpec.postCheck()
        }
        return SUCCESS
    }

    function checkMessage () {
        // flag for non-encrypted message
        const flagBit = 0b1
        if ((transaction.flags & flagBit) === 0) {
            if (data.message) return ERROR
            else return SUCCESS
        }
        const attachmentVersion = byteArray[pos]
        pos++
        if (attachmentVersion !== 1) {
            return ERROR
        }
        let messageLength = converters.byteArrayToSignedInt32(byteArray, pos)
        pos += 4
        transaction.messageIsText = messageLength < 0
        if (messageLength < 0) {
            messageLength &= 2147483647
        }
        if (transaction.messageIsText) {
            transaction.message = converters.byteArrayToString(byteArray, pos, messageLength)
        } else {
            const slice = byteArray.slice(pos, pos + messageLength)
            transaction.message = converters.byteArrayToHexString(slice)
        }
        pos += messageLength
        const messageIsText = (transaction.messageIsText ? 'true' : 'false')
        if (messageIsText !== data.messageIsText) {
            return ERROR
        }
        if (transaction.message !== data.message) {
            return ERROR
        }
        return SUCCESS
    }

    function checkEncryptedMessage () {
        // flag for encrypted note
        const flagBit = 0b10
        if ((transaction.flags & flagBit) === 0) {
            if (data.encryptedMessageData) return ERROR
            else return SUCCESS
        }
        const attachmentVersion = byteArray[pos]
        pos++
        if (attachmentVersion !== 1) {
            return ERROR
        }
        let encryptedMessageLength = converters.byteArrayToSignedInt32(byteArray, pos)
        pos += 4
        transaction.messageToEncryptIsText = encryptedMessageLength < 0
        if (encryptedMessageLength < 0) {
            encryptedMessageLength &= 2147483647
        }
        transaction.encryptedMessageData = converters.byteArrayToHexString(byteArray.slice(pos, pos + encryptedMessageLength))
        pos += encryptedMessageLength
        transaction.encryptedMessageNonce = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32))
        pos += 32
        const messageToEncryptIsText = (transaction.messageToEncryptIsText ? 'true' : 'false')
        if (messageToEncryptIsText !== data.messageToEncryptIsText) {
            return ERROR
        }
        if (transaction.encryptedMessageData !== data.encryptedMessageData ||
                transaction.encryptedMessageNonce !== data.encryptedMessageNonce) {
            return ERROR
        }
        return SUCCESS
    }

    function checkRecipientPublicKey () {
        const flagBit = 0b100
        if ((transaction.flags & flagBit) === 0) {
            if (data.recipientPublicKey) return ERROR
            else return SUCCESS
        }
        const attachmentVersion = byteArray[pos]
        pos++
        if (attachmentVersion !== 1) {
            return ERROR
        }
        const recipientPublicKey = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32))
        pos += 32
        if (recipientPublicKey !== data.recipientPublicKey) {
            return ERROR
        }
        return SUCCESS
    }

    function checkEncryptToSelfMessage () {
        const flagBit = 0b1000
        if ((transaction.flags & flagBit) === 0) {
            if (data.encryptToSelfMessageData) return ERROR
            else return false
        }
        const attachmentVersion = byteArray[pos]
        pos++
        if (attachmentVersion !== 1) {
            return ERROR
        }
        let encryptedToSelfMessageLength = converters.byteArrayToSignedInt32(byteArray, pos)
        transaction.messageToEncryptToSelfIsText = encryptedToSelfMessageLength < 0
        if (encryptedToSelfMessageLength < 0) {
            encryptedToSelfMessageLength &= 2147483647
        }
        pos += 4
        transaction.encryptToSelfMessageData = converters.byteArrayToHexString(byteArray.slice(pos, pos + encryptedToSelfMessageLength))
        pos += encryptedToSelfMessageLength
        transaction.encryptToSelfMessageNonce = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32))
        pos += 32
        const messageToEncryptToSelfIsText = (transaction.messageToEncryptToSelfIsText ? 'true' : 'false')
        if (messageToEncryptToSelfIsText !== data.messageToEncryptToSelfIsText) {
            return ERROR
        }
        if (transaction.encryptToSelfMessageData !== data.encryptToSelfMessageData ||
                transaction.encryptToSelfMessageNonce !== data.encryptToSelfMessageNonce) {
            return ERROR
        }
        return SUCCESS
    }

    return verifyAndSignTransactionBytesMain()
}

export function broadcastTransactionBytes (transactionData, callback, originalResponse, originalData) {
    $.ajax({
        url: BRS.server + '/burst?requestType=broadcastTransaction',
        crossDomain: true,
        dataType: 'json',
        type: 'POST',
        timeout: 30000,
        async: true,
        data: {
            transactionBytes: transactionData
        }
    }).done(function (response, status, xhr) {
        if (callback) {
            if (response.errorCode) {
                if (!response.errorDescription) {
                    response.errorDescription = (response.errorMessage ? response.errorMessage : 'Unknown error occured.')
                }
                callback(response, originalData)
            } else if (response.error) {
                response.errorCode = 1
                response.errorDescription = response.error
                callback(response, originalData)
            } else {
                if ('transactionBytes' in originalResponse) {
                    delete originalResponse.transactionBytes
                }
                originalResponse.broadcasted = true
                originalResponse.transaction = response.transaction
                originalResponse.fullHash = response.fullHash
                callback(originalResponse, originalData)
                if (originalData.referencedTransactionFullHash) {
                    $.notify($.t('info_referenced_transaction_hash'), { type: 'info' })
                }
            }
        }
    }).fail(function (xhr, textStatus, error) {
        if (callback) {
            if (error === 'timeout') {
                error = $.t('error_request_timeout')
            }
            callback({
                errorCode: -1,
                errorDescription: error
            }, {})
        }
    })
}
