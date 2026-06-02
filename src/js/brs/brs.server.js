/**
 * @depends {brs.js}
 */

import { BRS } from '.'

import {
    getPublicKeyFromPassphrase,
    getAccountId,
    signBytes,
    verifyBytes
} from './brs.encryption'

import { parseAmountToNQT } from './brs.numbers'

import {
    translateServerError
} from './brs.util'

import { showRawTransactionModal } from './brs.modals.advanced'
import { verifyTransactionBytes } from './brs.verifytransaction'

export function setSavedPassword (password) {
    BRS._password = password
}

export function getSavedPassword () {
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
                data[field + 'NQT'] = parseAmountToNQT(data[nxtField])
                delete data[nxtField]
            }
        }
        return { data }
    } catch (err) {
        return {
            errorDescription: err.message + ' (Field: ' + field + ')'
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

    let currentPageAndSubPage

    // means it is a page request, not a global request.. Page requests can be aborted if user changes the page.
    if (requestType.slice(-1) === '+') {
        requestType = requestType.slice(0, -1)
        currentPageAndSubPage = BRS.currentPage + BRS.currentSubPage
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

    async = (async === undefined ? true : async)
    if (async === false && type === 'GET') {
        const client = new XMLHttpRequest()
        client.open('GET', url + '&' + $.param(data), false)
        client.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8')
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
        currentPageAndSubPage,
        maxRetries: (type === 'GET' ? 2 : 0),
        data
    }).done(function (response) {
        response = addUnconfirmedProperty(response, requestType)

        if (secretPhrase && response.unsignedTransactionBytes && !response.errorCode && !response.error) {
            const publicKey = getPublicKeyFromPassphrase(secretPhrase)
            const signature = signBytes(response.unsignedTransactionBytes, secretPhrase)
            if (!verifyBytes(signature, response.unsignedTransactionBytes, publicKey)) {
                const errorMessage = $.t('error_signature_verification_client')
                if (callback) {
                    if (extra) {
                        data._extra = extra
                    }
                    callback({
                        errorCode: 1,
                        errorDescription: errorMessage
                    }, data)
                } else {
                    $.notify(errorMessage, { type: 'danger' })
                }
                return
            }
            const payload = verifyTransactionBytes(response.unsignedTransactionBytes, signature, requestType, data)
            if (payload.length === 0) {
                const errorMessage = $.t('error_signature_verification_server')
                if (callback) {
                    if (extra) {
                        data._extra = extra
                    }
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
                showRawTransactionModal(response, payload)
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
            showRawTransactionModal(response, '')
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
            if (extra) {
                data._extra = extra
            }
            callback({
                errorCode: -1,
                errorDescription: error
            }, data)
        }
    })
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
    }).done(function (response) {
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
