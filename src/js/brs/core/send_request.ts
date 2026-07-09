import { BRS } from '..'

import { getPublicKeyFromPassphrase, getAccountId, signBytes, verifyBytes } from './encryption'

import { parseAmountToNQT } from './numbers'

import { translateServerError } from './util'

import { showRawTransactionModal } from '../modals/advanced'
import { verifyTransactionBytes } from './verify_transaction'
import { AjaxResponse, PostResponse } from '../typings'
import { notify } from './notifications'

export function setSavedPassword(password: string) {
    BRS._password = password
}

export function getSavedPassword() {
    return BRS._password
}

function convertNxtToNqt(data: any) {
    // convert NXT to NQT...
    let field: string
    const nxtFields = ['feeNXT', 'amountNXT', 'priceNXT', 'refundNXT', 'discountNXT', 'minActivationAmountNXT']
    for (const nxtField of nxtFields) {
        field = nxtField.replace('NXT', '')
        if (nxtField in data) {
            try {
                data[field + 'NQT'] = parseAmountToNQT(data[nxtField])
                delete data[nxtField]
            } catch (err) {
                return (err as Error).message + ' (Field: ' + field + ')'
            }
        }
    }
}

export function sendRequest(requestType: string, data: any, callback: (response: any) => void) {
    for (const key in data) {
        if (key !== 'secretPhrase' && typeof data[key] === 'string') {
            data[key] = data[key].trim()
        }
    }

    const errorMessage = convertNxtToNqt(data)
    if (errorMessage) {
        callback({
            errorCode: 1,
            errorDescription: errorMessage,
        })
        return
    }

    if (!data.recipientPublicKey) {
        delete data.recipientPublicKey
    }
    if (!data.referencedTransactionFullHash) {
        delete data.referencedTransactionFullHash
    }

    // check to see if secretPhrase supplied matches logged in account, if not - show error.
    if ('secretPhrase' in data) {
        const accountId = getAccountId(getSavedPassword() || data.secretPhrase)
        if (accountId !== BRS.account) {
            callback({
                errorCode: 1,
                errorDescription: $.t('error_passphrase_incorrect'),
            })
            return
        }
    }

    processAjaxRequest(requestType, data, callback)
}

export function processAjaxRequest(requestType: string, data: any, callback: (response: any) => void) {
    let currentPageAndSubPage: string | undefined

    // means it is a page request, not a global request.. Page requests can be aborted if user changes the page.
    if (requestType.slice(-1) === '+') {
        requestType = requestType.slice(0, -1)
        currentPageAndSubPage = BRS.currentPage + BRS.currentSubPage
    }

    let type = 'secretPhrase' in data || data.broadcast === 'false' ? 'POST' : 'GET'
    const url = BRS.server + '/burst?requestType=' + requestType

    if (type === 'GET') {
        // It’s challenging to manage caching in XMLHttpRequest.
        // Appending a random query string value to bypass the browser cache.
        data._ = Date.now()
    }

    let secretPhrase = ''

    // unknown account..
    if (type === 'POST' && BRS.accountInfo.errorCode && BRS.accountInfo.errorCode === 5) {
        callback({
            errorCode: 2,
            errorDescription: $.t('error_new_account'),
        })
        return
    }

    if (data.referencedTransactionFullHash) {
        if (!/^[a-z0-9]{64}$/.test(data.referencedTransactionFullHash)) {
            const errorMessage = $.t('error_invalid_referenced_transaction_hash')
            callback({
                errorCode: -1,
                errorDescription: errorMessage,
            })
            return
        }
    }

    if (type === 'POST') {
        secretPhrase = getSavedPassword() || data.secretPhrase
        delete data.secretPhrase

        if (BRS.accountInfo && BRS.accountInfo.publicKey) {
            data.publicKey = BRS.accountInfo.publicKey
        } else {
            data.publicKey = getPublicKeyFromPassphrase(secretPhrase)
            BRS.accountInfo.publicKey = data.publicKey
        }
    }
    if (data.secretPhrase) {
        // Last fence to avoid sending plain text passphrases!!!
        if (!confirm($.t('confirm_send_passphrase'))) {
            return
        }
    }

    let ajaxCall
    if (type === 'GET' && BRS.requestController) {
        ajaxCall = BRS.requestController.queue
    } else {
        ajaxCall = $.ajax
    }

    if (requestType === 'broadcastTransaction') {
        type = 'POST'
    }

    ajaxCall({
        url,
        crossDomain: true,
        dataType: 'json',
        type,
        timeout: 30000,
        async: true,
        currentPageAndSubPage,
        maxRetries: type === 'GET' ? 2 : 0,
        data,
    })
        .done(function (responseUnsafe: AjaxResponse) {
            const response = escapeHTMLInAllProperties(responseUnsafe)
            // There was an error in response. It can be in POST or GET
            if (response.errorCode || response.errorDescription || response.errorMessage || response.error) {
                response.errorDescription = translateServerError(responseUnsafe)
                delete response.fullHash
                if (!response.errorCode) {
                    response.errorCode = -1
                }
                callback(response)
                return
            }
            // This is executed on POST response, but not on POST 'broadcastTransaction'
            if (secretPhrase && response.unsignedTransactionBytes) {
                verifySignAndBroadcastTransaction(requestType, data, response, secretPhrase, callback)
                return
            }
            if (response.broadcasted === false) {
                // Only in POST and if "broadcast: false"
                showRawTransactionModal(response, '')
                return
            }
            // Regular GET response, or POST 'broadcastTransaction'
            callback(response)
            if (data.referencedTransactionFullHash) {
                notify($.t('info_referenced_transaction_hash'), { type: 'info' })
            }
        })
        .fail(function (xhr: JQueryXHR, textStatus: string, error: string) {
            if (error === 'abort') {
                return
            }
            if ((error === 'error' || textStatus === 'error') && (xhr.status === 404 || xhr.status === 0) && type === 'POST') {
                notify($.t('error_server_connect'), { type: 'danger' })
            }
            if (error === 'timeout') {
                error = $.t('error_request_timeout')
            }
            callback({
                errorCode: -1,
                errorDescription: error,
            })
        })
}

/**
 * Recursively escapes HTML in all string values of a JSON object
 * @param obj The input object (can be any JSON-compatible type)
 * @returns A new object with all string values escaped
 */
function escapeHTMLInAllProperties<T>(obj: T): T {
    if (typeof obj === 'string') {
        return obj.escapeHTML() as T
    } else if (Array.isArray(obj)) {
        return obj.map((item) => escapeHTMLInAllProperties(item)) as T
    } else if (obj !== null && typeof obj === 'object') {
        const result: Record<string, any> = {}
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = escapeHTMLInAllProperties(obj[key])
            }
        }
        return result as T
    }
    return obj
}

function verifySignAndBroadcastTransaction(
    requestType: string,
    data: any,
    response: PostResponse,
    secretPhrase: string,
    callback: (response: any) => void,
) {
    const publicKey = getPublicKeyFromPassphrase(secretPhrase)
    const signature = signBytes(response.unsignedTransactionBytes, secretPhrase)
    if (!verifyBytes(signature, response.unsignedTransactionBytes, publicKey)) {
        const errorMessage = $.t('error_signature_verification_client')
        callback({
            errorCode: 1,
            errorDescription: errorMessage,
        })
        return
    }
    const payload = verifyTransactionBytes(response.unsignedTransactionBytes, signature, requestType, data)
    if (payload.length === 0) {
        const errorMessage = $.t('error_signature_verification_server')
        callback({
            errorCode: 1,
            errorDescription: errorMessage,
        })
        return
    }
    if (data.broadcast === 'false') {
        showRawTransactionModal(response, payload)
        return
    }
    broadcastTransactionBytes(payload, callback, response, data)
    return
}

export function broadcastTransactionBytes(
    transactionData: string,
    callback: (response: any) => void,
    originalResponse: PostResponse,
    originalData: any,
) {
    $.ajax({
        url: BRS.server + '/burst?requestType=broadcastTransaction',
        crossDomain: true,
        dataType: 'json',
        type: 'POST',
        timeout: 30000,
        async: true,
        data: {
            transactionBytes: transactionData,
        },
    })
        .done(function (response) {
            if (response.errorCode) {
                if (!response.errorDescription) {
                    response.errorDescription = response.errorMessage ? response.errorMessage : 'Unknown error occured.'
                }
                callback(response)
                return
            }
            if (response.error) {
                response.errorCode = 1
                response.errorDescription = response.error
                callback(response)
                return
            }
            if ('transactionBytes' in originalResponse) {
                delete originalResponse.transactionBytes
            }
            originalResponse.broadcasted = true
            originalResponse.transaction = response.transaction
            originalResponse.fullHash = response.fullHash
            callback(originalResponse)
            if (originalData.referencedTransactionFullHash) {
                notify($.t('info_referenced_transaction_hash'), { type: 'info' })
            }
        })
        .fail(function (xhr, textStatus, error) {
            if (error === 'timeout') {
                error = $.t('error_request_timeout')
            }
            callback({
                errorCode: -1,
                errorDescription: error,
            })
        })
}

/**
 * Sends an asynchronous request to the server and returns a Promise with the response.
 *
 * This function simplifies the process of making async requests by allowing the use of 'await'
 * to retrieve the response. It internally calls `sendRequest` with the appropriate parameters
 * and resolves the Promise with the response data.
 *
 * @param {string} requestType - The type of request to be sent (e.g., 'getBlockchainStatus', 'sendMoney').
 * @param {any} data - The data payload to be sent with the request.
 * @returns {Promise<any>} A Promise that resolves with the response from the server.
 */
export async function sendRequestA(requestType: string, data: any): Promise<any> {
    return new Promise((resolve) => {
        sendRequest(requestType, data, (response: any) => {
            resolve(response)
        })
    })
}
