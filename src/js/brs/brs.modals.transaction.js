/**
 * @depends {brs.js}
 * @depends {brs.modals.js}
 */

/* global BigInteger */

import converters from '../util/converters'
import { BRS } from '.'

import { sendRequest } from './brs.server'

import {
    getDecryptedMessageFromCache,
    getDecryptionPassword
} from './brs.encryption'

import {
    formatOrderPricePerWholeQNT,
    calculateOrderTotalNQT,
    convertToQNTf,
    format,
    formatQuantity,
    formatAmount,
    formatTimestamp,
    convertNumericToRSAccountFormat,
    getAssetLink,
    fullHashToId,
    getAccountTitle,
    getAccountFormatted,
    createInfoTable
} from './brs.util'

import { removeDecryptionForm } from './brs.modals'

import { getAssetDetails } from './brs.assetexchange'

import { getTransactionDetails } from './brs.transactions'

import {
    decryptAttachmentFieldAndUpdateSelector,
    getMessageFromTX
} from './brs.messages'

export function showTransactionModal (transaction) {
    if (BRS.fetchingModalData) {
        return
    }

    BRS.fetchingModalData = true

    $('#transaction_info_output_bottom, #transaction_info_bottom').html('').hide()
    $('#transaction_info_table').hide()
    $('#transaction_info_table tbody').empty()

    if (typeof transaction !== 'object') {
        sendRequest('getTransaction', {
            transaction
        }, function (response, input) {
            response.transaction = input.transaction
            processTransactionModalData(response)
        })
    } else {
        processTransactionModalData(transaction)
    }
}

function processTransactionModalData (transaction) {
    let data
    let async = false
    let assetDetails, helperStr
    let details

    function processTransactionModalDataMain () {
        processInfoDetails()
        processButtons()
        processDefaultProperties()
        processExceptionProperties()
        processMessage()
        if (async === false) {
            transactionEndLoad()
        }
    }

    function processInfoDetails () {
        const transactionDetails = $.extend({}, transaction)
        delete transactionDetails.attachment
        if (/^0+$/.test(transactionDetails.referencedTransaction)) {
            delete transactionDetails.referencedTransaction
        }
        delete transactionDetails.transaction

        $('#transaction_info_modal_transaction').html(String(transaction.transaction).escapeHTML())
        $('#transaction_info_tab_link').tab('show')
        $('#transaction_info_details_table tbody').empty().append(createInfoTable(transactionDetails, true))
        $('#transaction_info_table tbody').empty()
    }

    function processButtons () {
        let accountButton
        if (transaction.senderRS === BRS.accountRS) {
            $('#transaction_info_actions').hide()
        } else {
            if (transaction.senderRS in BRS.contacts) {
                accountButton = BRS.contacts[transaction.senderRS].name.escapeHTML()
                $('#transaction_info_modal_add_as_contact').hide()
            } else {
                accountButton = transaction.senderRS
                $('#transaction_info_modal_add_as_contact').show()
            }
            $('#transaction_info_actions').show()
            $('#transaction_info_actions_tab button').data('account', accountButton)
        }
    }

    function processDefaultProperties () {
        details = getTransactionDetails(transaction)
        const amount_formatted = formatAmount(new BigInteger(String(transaction.amountNQT))) + ' ' + BRS.valueSuffix
        data = {
            type: details.nameOfTransaction,
            timestamp: formatTimestamp(transaction.timestamp),
            amount_formatted,
            fee: transaction.feeNQT,
            sender_formatted_html: details.senderHTML,
            recipient_formatted_html: details.recipientHTML
        }
        if (transaction.amountNQT === '0') {
            delete data.amount_formatted
        }
        if (details.recipientHTML === '/') {
            delete data.recipient_formatted_html
        }
    }

    function transactionEndLoad () {
        $('#transaction_info_table tbody').append(createInfoTable(data))
        $('#transaction_info_modal').modal('show')
        $('#transaction_info_table').show()
        BRS.fetchingModalData = false
    }

    function processExceptionProperties () {
        switch (transaction.type) {
        case 0:
            pePayment()
            return
        case 1:
            peMessaging()
            return
        case 2:
            peColoredCoins()
            return
        case 3:
            peDigitalGoods()
            return
        case 4:
            if (transaction.subtype === 0) {
                // balance leasing
                data.period = transaction.attachment.period
            }
            return
        case 20:
            peMining()
            return
        case 21:
            peAdvancedPayment()
            break
        case 22:
            peAutomatedTransactions()
        }
    }

    function pePayment () {
        let recipientHTML
        let youReceived = false
        let amountToYou
        let amountEach
        switch (transaction.subtype) {
        case 1:
            // Multi-out Payment
            recipientHTML = ''
            for (let i = 0; i < transaction.attachment.recipients.length; i++) {
                const rsAddress = convertNumericToRSAccountFormat(transaction.attachment.recipients[i][0])
                const amount = formatAmount(transaction.attachment.recipients[i][1]) + ' ' + BRS.valueSuffix
                if (i !== 0) {
                    recipientHTML += '<br />'
                }
                if (rsAddress === BRS.accountRS) {
                    recipientHTML += `<strong class="mono-font">${rsAddress}</strong>: ${amount}`
                    youReceived = true
                    amountToYou = amount
                } else {
                    recipientHTML += `<span class="mono-font">${rsAddress}</span>: ${amount}`
                }
            }
            delete data.recipient_formatted_html
            data.you_received = youReceived ? $.t('yes') : $.t('no')
            if (youReceived) data.amount_to_you = amountToYou
            data.recipient_formatted_html = recipientHTML
            return
        case 2:
            // Multi-out same
            amountEach = parseInt(transaction.amountNQT) / transaction.attachment.recipients.length
            recipientHTML = ''
            for (let i = 0; i < transaction.attachment.recipients.length; i++) {
                const rsAddress = convertNumericToRSAccountFormat(transaction.attachment.recipients[i])
                if (i !== 0) {
                    recipientHTML += '<br />'
                }
                if (rsAddress === BRS.accountRS) {
                    recipientHTML += `<strong class="mono-font">${rsAddress}</strong>`
                    youReceived = true
                } else {
                    recipientHTML += `<span class="mono-font">${rsAddress}</span>`
                }
            }
            delete data.recipient_formatted_html
            data.you_received = youReceived ? $.t('yes') : $.t('no')
            data.amount_each_formatted_html = formatAmount(amountEach.toString()) + ' ' + BRS.valueSuffix
            data.recipient_formatted_html = recipientHTML
        }
    }

    function peMessaging () {
        switch (transaction.subtype) {
        case 1:
            // alias assignment
            data.alias = transaction.attachment.alias
            data.data_formatted_html = transaction.attachment.uri
            return
        case 6:
            // alias sale/transfer/sale cancelation
            data.alias_name = transaction.attachment.alias
            if (details.nameOfTransaction === $.t('alias_sale')) {
                peMessagingAliasSale()
            }
            return
        case 7:
            // alias buy
            data.alias_name = transaction.attachment.alias
            data.price = transaction.amountNQT
            break
        }
    }

    function peMessagingAliasSale () {
        let message = ''
        let messageStyle = 'info'
        data.price = transaction.attachment.priceNQT
        async = true
        sendRequest('getAlias', {
            aliasName: transaction.attachment.alias
        }, function (response) {
            BRS.fetchingModalData = false
            if (!response.errorCode) {
                if (transaction.recipient !== response.buyer || transaction.attachment.priceNQT !== response.priceNQT) {
                    message = $.t('alias_sale_info_outdated')
                    messageStyle = 'danger'
                } else if (transaction.recipient === BRS.account) {
                    message = $.t('alias_sale_direct_offer', {
                        burst: formatAmount(transaction.attachment.priceNQT)
                    }) + " <a href='#' data-alias='" + String(transaction.attachment.alias).escapeHTML() + "' data-toggle='modal' data-target='#buy_alias_modal'>" + $.t('buy_it_q') + '</a>'
                } else if (typeof transaction.recipient === 'undefined') {
                    message = $.t('alias_sale_indirect_offer', {
                        burst: formatAmount(transaction.attachment.priceNQT)
                    }) + " <a href='#' data-alias='" + String(transaction.attachment.alias).escapeHTML() + "' data-toggle='modal' data-target='#buy_alias_modal'>" + $.t('buy_it_q') + '</a>'
                } else if (transaction.senderRS === BRS.accountRS) {
                    if (transaction.attachment.priceNQT !== '0') {
                        message = $.t('your_alias_sale_offer') + " <a href='#' data-alias='" + String(transaction.attachment.alias).escapeHTML() + "' data-toggle='modal' data-target='#cancel_alias_sale_modal'>" + $.t('cancel_sale_q') + '</a>'
                    }
                } else {
                    message = $.t('error_alias_sale_different_account')
                }
            }
            transactionEndLoad()
        })

        if (message.length) {
            $('#transaction_info_bottom').html("<div class='callout callout-bottom callout-" + messageStyle + "'>" + message + '</div>').show()
        }
    }

    function peColoredCoins () {
        switch (transaction.subtype) {
        case 0:
            // asset issuance
            assetDetails = getAssetDetails(fullHashToId(transaction.fullHash))
            data.name_formatted_html = getAssetLink(assetDetails)
            data.description = transaction.attachment.description.escapeHTML()
            data.quantity = [transaction.attachment.quantityQNT, transaction.attachment.decimals]
            data.decimals = transaction.attachment.decimals
            if (transaction.attachment.mintable === true) {
                data.mintable = $.t('yes')
            } else {
                data.mintable = $.t('no')
            }
            break
        case 1:
            // asset transfer
            assetDetails = getAssetDetails(transaction.attachment.asset)
            if (!assetDetails) {
                break
            }
            data.asset_name_formatted_html = getAssetLink(assetDetails)
            data.quantity = [transaction.attachment.quantityQNT, assetDetails.decimals]
            break
        case 2:
            // ask order placement
            assetDetails = getAssetDetails(transaction.attachment.asset)
            if (!assetDetails) {
                break
            }
            data.asset_name_formatted_html = getAssetLink(assetDetails)
            data.quantity = [transaction.attachment.quantityQNT, assetDetails.decimals]
            data.price_formatted_html = formatOrderPricePerWholeQNT(transaction.attachment.priceNQT, assetDetails.decimals) + ' ' + BRS.valueSuffix
            data.total_formatted_html = formatAmount(calculateOrderTotalNQT(transaction.attachment.quantityQNT, transaction.attachment.priceNQT)) + ' ' + BRS.valueSuffix
            break
        case 3:
            // bid order placement
            assetDetails = getAssetDetails(transaction.attachment.asset)
            if (!assetDetails) {
                break
            }
            data.asset_name_formatted_html = getAssetLink(assetDetails)
            data.quantity = [transaction.attachment.quantityQNT, assetDetails.decimals]
            data.price_formatted_html = formatOrderPricePerWholeQNT(transaction.attachment.priceNQT, assetDetails.decimals) + ' ' + BRS.valueSuffix
            data.total_formatted_html = formatAmount(calculateOrderTotalNQT(transaction.attachment.quantityQNT, transaction.attachment.priceNQT)) + ' ' + BRS.valueSuffix
            break
        case 4:
        case 5:
            // ask order cancellation
            // bid order cancellation
            async = true
            sendRequest('getTransaction', {
                transaction: transaction.attachment.order
            }, function (transactionII) {
                if (transactionII.errorCode) {
                    return
                }
                const asset = getAssetDetails(transactionII.attachment.asset)
                if (!asset) {
                    return
                }
                data.asset_name_formatted_html = getAssetLink(assetDetails)
                data.quantity = [transactionII.attachment.quantityQNT, asset.decimals]
                data.price_formatted_html = formatOrderPricePerWholeQNT(transactionII.attachment.priceNQT, asset.decimals) + ' ' + BRS.valueSuffix
                data.total_formatted_html = formatAmount(calculateOrderTotalNQT(transactionII.attachment.quantityQNT, transactionII.attachment.priceNQT)) + ' ' + BRS.valueSuffix
                transactionEndLoad()
            })
            break
        case 6:
            assetDetails = getAssetDetails(transaction.attachment.asset)
            if (!assetDetails) {
                break
            }
            data.asset_name_formatted_html = getAssetLink(assetDetails)
            data.quantity = [transaction.attachment.quantityQNT, assetDetails.decimals]
            break
        case 7:
            assetDetails = getAssetDetails(fullHashToId(transaction.referencedTransactionFullHash))
            if (!assetDetails) {
                break
            }
            data.asset_name_formatted_html = getAssetLink(assetDetails)
            break
        case 8:
            peColoredCoinsDistributeToHolders()
            break
        case 9:
            helperStr = ''
            for (let i = 0; i < transaction.attachment.assetIds.length; i++) {
                if (i !== 0) {
                    helperStr += '<br>'
                }
                const foundAsset = getAssetDetails(transaction.attachment.assetIds[i])
                if (foundAsset) {
                    helperStr += `${formatQuantity(transaction.attachment.quantitiesQNT[i], foundAsset.decimals)} ${getAssetLink(foundAsset)}`
                } else {
                    helperStr += `${transaction.attachment.quantityQNT} [QNT]`
                }
            }
            data.assets_transferred_formatted_html = helperStr
            break
        }
    }

    function peColoredCoinsDistributeToHolders () {
        async = true
        data.toHoldersOf_formatted_html = transaction.attachment.asset
        data.distributingAsset_formatted_html = transaction.attachment.assetToDistribute
        data.distributingQuantity = transaction.attachment.quantityQNT
        data.youReceived = $.t('no')
        sendRequest('getIndirectIncoming', {
            transaction: transaction.transaction,
            account: BRS.account
        }, function (transactionII) {
            let userQuantity = '0'
            let userAmount = '0'
            if (transactionII.errorCode === undefined) {
                userQuantity = transactionII.quantityQNT
                userAmount = transactionII.amountNQT
                data.youReceived = $.t('yes')
            }
            const foundAsset = getAssetDetails(transaction.attachment.asset)
            if (foundAsset) {
                data.toHoldersOf_formatted_html = getAssetLink(foundAsset)
            }
            if (userAmount !== '0') {
                data.amountToYou = formatAmount(userAmount) + ' ' + BRS.valueSuffix
            }
            if (transaction.attachment.assetToDistribute === '0') {
                data.distributingAsset_formatted_html = $.t('no')
                delete data.distributingQuantity
            } else {
                const foundAsset2 = getAssetDetails(transaction.attachment.assetToDistribute)
                if (foundAsset2) {
                    data.distributingAsset_formatted_html = getAssetLink(foundAsset2)
                    data.distributingQuantity = convertToQNTf(data.distributingQuantity, foundAsset2.decimals) + ' ' + foundAsset2.name
                    if (userQuantity !== '0') {
                        data.quantityToYou = convertToQNTf(userQuantity, foundAsset2.decimals) + ' ' + foundAsset2.name
                    }
                } else {
                    if (userQuantity !== '0') {
                        data.quantityToYou = convertToQNTf(userQuantity, '0') + ' [QNT]'
                    }
                }
            }
            transactionEndLoad()
        })
    }

    function peDigitalGoods () {
        switch (transaction.subtype) {
        case 0:
            // marketplace listing
            delete data.sender_formatted_html
            data.seller = getAccountFormatted(transaction, 'sender')
            data.name = transaction.attachment.name
            data.description = transaction.attachment.description
            data.price = transaction.attachment.priceNQT
            data.quantity_formatted_html = format(transaction.attachment.quantity)
            break
        case 1:
            // marketplace removal
            delete data.sender_formatted_html
            async = true
            sendRequest('getDGSGood', {
                goods: transaction.attachment.goods
            }, function (goods) {
                data.seller = getAccountFormatted(goods, 'seller')
                data.item_name = goods.name
                transactionEndLoad()
            })
            break
        case 2:
            // marketplace item price change
            delete data.sender_formatted_html
            async = true
            sendRequest('getDGSGood', {
                goods: transaction.attachment.goods
            }, function (goods) {
                data.seller = getAccountFormatted(goods, 'seller')
                data.item_name = goods.name
                data.new_price_formatted_html = formatAmount(transaction.attachment.priceNQT) + ' ' + BRS.valueSuffix
                transactionEndLoad()
            })
            break
        case 3:
            // marketplace item quantity change
            delete data.sender_formatted_html
            async = true
            sendRequest('getDGSGood', {
                goods: transaction.attachment.goods
            }, function (goods) {
                data.seller = getAccountFormatted(goods, 'seller')
                data.item_name = goods.name
                data.delta_quantity = transaction.attachment.deltaQuantity
                transactionEndLoad()
            })
            break
        case 4:
            peDigitalGoodsPurchase()
            break
        case 5:
            peDigitalGoodsDelivery()
            break
        case 6:
            peDigitalGoodsFeedback()
            break
        case 7:
            delete data.sender_formatted_html
            delete data.recipient_formatted_html
            async = true
            sendRequest('getDGSPurchase', {
                purchase: transaction.attachment.purchase
            }, function (purchase) {
                data.seller = getAccountFormatted(purchase, 'seller')
                data.buyer = getAccountFormatted(purchase, 'buyer')
                sendRequest('getDGSGood', {
                    goods: purchase.goods
                }, function (goods) {
                    data.item_name = goods.name
                    const orderTotal = new BigInteger(String(purchase.quantity)).multiply(new BigInteger(String(purchase.priceNQT)))
                    data.order_total_formatted_html = formatAmount(orderTotal) + ' ' + BRS.valueSuffix
                    data.refund = transaction.attachment.refundNQT
                    transactionEndLoad()
                })
            })
            break
        }
    }

    function peDigitalGoodsPurchase () {
        // marketplace purchase
        delete data.sender_formatted_html
        delete data.recipient_formatted_html
        async = true
        sendRequest('getDGSGood', {
            goods: transaction.attachment.goods
        }, function (goods) {
            data.buyer = getAccountFormatted(transaction, 'sender')
            data.seller = getAccountFormatted(goods, 'seller')
            data.item_name = goods.name
            data.price = transaction.attachment.priceNQT
            data.quantity_formatted_html = format(transaction.attachment.quantity)
            sendRequest('getDGSPurchase', {
                purchase: transaction.transaction
            }, function (purchase) {
                let callout = ''
                if (purchase.errorCode) {
                    if (purchase.errorCode === 4) {
                        callout = $.t('incorrect_purchase')
                    } else {
                        callout = String(purchase.errorDescription).escapeHTML()
                    }
                } else {
                    if (BRS.account === transaction.recipient || BRS.account === transaction.sender) {
                        if (purchase.pending) {
                            if (BRS.account === transaction.recipient) {
                                callout = "<a href='#' data-toggle='modal' data-target='#dgs_delivery_modal' data-purchase='" + String(transaction.transaction).escapeHTML() + "'>" + $.t('deliver_goods_q') + '</a>'
                            } else {
                                callout = $.t('waiting_on_seller')
                            }
                        } else {
                            if (purchase.refundNQT) {
                                callout = $.t('purchase_refunded')
                            } else {
                                callout = $.t('purchase_delivered')
                            }
                        }
                    }
                }
                if (callout) {
                    $('#transaction_info_bottom').html("<div class='callout " + (purchase.errorCode ? 'callout-danger' : 'callout-info') + " callout-bottom'>" + callout + '</div>').show()
                }
                transactionEndLoad()
            })
        })
    }

    function peDigitalGoodsFeedback () {
        // marketplace feedback
        delete data.sender_formatted_html
        delete data.recipient_formatted_html
        async = true
        sendRequest('getDGSPurchase', {
            purchase: transaction.attachment.purchase
        }, function (purchase) {
            data.seller = getAccountFormatted(purchase, 'seller')
            data.buyer = getAccountFormatted(purchase, 'buyer')
            sendRequest('getDGSGood', {
                goods: purchase.goods
            }, function (goods) {
                data.item_name = goods.name
                if (purchase.seller !== BRS.account && purchase.buyer !== BRS.account) {
                    transactionEndLoad()
                    return
                }
                sendRequest('getDGSPurchase', {
                    purchase: transaction.attachment.purchase
                }, function (purchase) {
                    let callout
                    if (purchase.buyer === BRS.account) {
                        if (purchase.refundNQT) {
                            callout = $.t('purchase_refunded')
                        }
                    } else {
                        if (!purchase.refundNQT) {
                            callout = "<a href='#' data-toggle='modal' data-target='#dgs_refund_modal' data-purchase='" + String(transaction.attachment.purchase).escapeHTML() + "'>" + $.t('refund_this_purchase_q') + '</a>'
                        } else {
                            callout = $.t('purchase_refunded')
                        }
                    }
                    if (callout) {
                        $('#transaction_info_bottom').append("<div class='callout callout-info callout-bottom'>" + callout + '</div>').show()
                    }
                    transactionEndLoad()
                })
            })
        })
    }

    function peDigitalGoodsDelivery () {
        // marketplace delivery
        delete data.sender_formatted_html
        delete data.recipient_formatted_html
        async = true
        sendRequest('getDGSPurchase', {
            purchase: transaction.attachment.purchase
        }, function (purchase) {
            data.seller = getAccountFormatted(purchase, 'seller')
            data.buyer = getAccountFormatted(purchase, 'buyer')
            sendRequest('getDGSGood', {
                goods: purchase.goods
            }, function (goods) {
                data.item_name = goods.name
                data.price = purchase.priceNQT
                data.quantity_formatted_html = format(purchase.quantity)
                if (purchase.quantity !== 1) {
                    const orderTotal = formatAmount(new BigInteger(String(purchase.quantity)).multiply(new BigInteger(String(purchase.priceNQT))))
                    data.total_formatted_html = orderTotal + ' ' + BRS.valueSuffix
                }
                if (transaction.attachment.discountNQT) {
                    data.discount = transaction.attachment.discountNQT
                }
                if (transaction.attachment.goodsData) {
                    // Removed legacy decryption operation
                    data.data = 'encrypted_goods_data_is_unsupported_in_neoclassic'
                }
                let callout
                if (BRS.account === purchase.buyer) {
                    if (purchase.refundNQT) {
                        callout = $.t('purchase_refunded')
                    } else if (!purchase.feedbackNote) {
                        callout = $.t('goods_received') + " <a href='#' data-toggle='modal' data-target='#dgs_feedback_modal' data-purchase='" + String(transaction.attachment.purchase).escapeHTML() + "'>" + $.t('give_feedback_q') + '</a>'
                    }
                } else if (BRS.account === purchase.seller && purchase.refundNQT) {
                    callout = $.t('purchase_refunded')
                }
                if (callout) {
                    $('#transaction_info_bottom').append("<div class='callout callout-info callout-bottom'>" + callout + '</div>').show()
                }
                transactionEndLoad()
            })
        })
    }

    function peMining () {
        switch (transaction.subtype) {
        case 1:
        case 2:
            // add / remove commitment
            data.amount_formatted = formatAmount(new BigInteger(String(transaction.attachment.amountNQT))) + ' ' + BRS.valueSuffix
        }
    }

    function peAdvancedPayment () {
        let signers = ''
        switch (transaction.subtype) {
        case 0:
            // TODO add languages / human readable format
            data.amount_formatted = formatAmount(new BigInteger(String(transaction.attachment.amountNQT))) + ' ' + BRS.valueSuffix
            data.deadline = transaction.attachment.deadline + ' seconds'
            data.deadlineAction = $.t(transaction.attachment.deadlineAction)
            data.requiredSigners = transaction.attachment.requiredSigners
            for (let i = 0; i < transaction.attachment.signers.length; i++) {
                if (i !== 0) {
                    signers += '<br />'
                }
                signers += convertNumericToRSAccountFormat(transaction.attachment.signers[i])
            }
            data.signers_formatted_html = signers
            return
        case 1:
        case 2:
            // TODO get details from escrow creation
            data.decision = $.t(transaction.attachment.decision)
            data.escrowId = transaction.attachment.escrowId
            return
        case 3:
            // TODO add languages / human readable format
            data.frequency = transaction.attachment.frequency + ' seconds'
            return
        case 4:
        case 5:
            // TODO get details from subscription
            data.subscriptionId = transaction.attachment.subscriptionId
        }
    }

    function peAutomatedTransactions () {
        let contractAddress
        switch (transaction.subtype) {
        case 0:
            contractAddress = convertNumericToRSAccountFormat(transaction.transaction)
            data.at_created_formatted_html = `<a href='#' data-user='${contractAddress}"' class='user-info'>${getAccountTitle(contractAddress)}</a>`
            data.name = transaction.attachment.name
            data.description_formatted_html = transaction.attachment.description.escapeHTML()
        }
    }

    function processMessage () {
        // Decode message
        if (transaction.attachment === undefined) {
            return
        }
        const $output = $('#transaction_info_output_bottom')
        const showDecryptionForm = drawAttachmentMessages(transaction, $output)
        if (showDecryptionForm) {
            BRS._encryptedNote = transaction
            $('#decrypt_note_form_container').detach().appendTo($output)
            $('#decrypt_note_form_container').show()
        } else {
            BRS._encryptedNote = null
        }
    }

    processTransactionModalDataMain()
}

/**
 * Processes the attachment messages for a given transaction and updates the
 * provided output element.
 * @param {Transaction} transaction - The transaction object containing attachment details.
 * @param {*} $output - The jQuery object representing the DOM element to update with attachment message content.
 * @param {String} providedPassphrase - Optional passphrase provided by the user for decryption purposes.
 * @returns {boolean} - Returns true if a decryption form needs to be shown, false otherwise.
 */
export function drawAttachmentMessages(transaction, $output, providedPassphrase) {
    removeDecryptionForm()
    $output.html('')
    let showMessage = false, messageHTML = ''
    let showEncrypted = false, encryptedHTML = ''
    let showEncryptedToSelf = false, EncryptedToSelfHTML = ''
    let showDecryptionForm = false

    if (transaction.attachment.message) {
        const messageText = getMessageFromTX(transaction)
        if (transaction.attachment.messageIsText === true) {
            messageHTML += `<div class='modal-text-box'>${messageText.escapeHTML().nl2br()}</div>`
        } else {
            // Show both bytes and try to decode string
            messageHTML += `<br><label>${$.t('bytes')}:</label>`
            messageHTML += `<div class='modal-text-box'>${messageText.escapeHTML().nl2br()}</div>`
            messageHTML += `<label>${$.t('text')}:</label>`
            messageHTML += `<div class='modal-text-box'>${converters.hexStringToString(messageText).escapeHTML().nl2br()}</div>`
        }
        showMessage = true
    }
    if (transaction.attachment.encryptedMessage) {
        showEncrypted = true
        let containerID = 'encryptedMessage' + transaction.transaction
        if (transaction.recipient !== BRS.account && transaction.sender !== BRS.account) {
            encryptedHTML = $t('data_is_encrypted')
        } else {
            const secretMessage = getDecryptedMessageFromCache(transaction.transaction, 'encryptedMessage')
            if (secretMessage !== undefined) {
                // encrypted message but already decoded in cache
                encryptedHTML = secretMessage.escapeHTML().nl2br()
            } else {
                const passphrase = providedPassphrase === undefined ? getDecryptionPassword() : providedPassphrase;
                if (passphrase) {
                    // decode async
                    encryptedHTML = `<span id="${containerID}">${BRS.pendingTransactionHTML}</span>`
                    setTimeout(decryptAttachmentFieldAndUpdateSelector, 10, transaction, 'encryptedMessage', passphrase, containerID)
                } else {
                    // Show panel for decryption
                    showEncrypted = false
                    showDecryptionForm = true
                }
            }
        }
    }
    if (transaction.attachment.encryptToSelfMessage) {
        showEncryptedToSelf = true
        let containerID = 'msgToSelf' + transaction.transaction
        if (transaction.sender !== BRS.account) {
            EncryptedToSelfHTML = $t('data_is_encrypted')
        } else {
            const secretMessage = getDecryptedMessageFromCache(transaction.transaction, 'encryptToSelfMessage')
            if (secretMessage !== undefined) {
                // encrypted message but already decoded in cache
                EncryptedToSelfHTML = secretMessage.escapeHTML().nl2br()
            } else {
                const passphrase = providedPassphrase === undefined ? getDecryptionPassword() : providedPassphrase;
                if (passphrase) {
                    // decode async
                    EncryptedToSelfHTML = `<span id="${containerID}">${BRS.pendingTransactionHTML}</span>`
                    setTimeout(decryptAttachmentFieldAndUpdateSelector, 10, transaction, 'encryptToSelfMessage', passphrase, containerID)
                } else {
                    // Show panel for decryption
                    showEncryptedToSelf = false
                    showDecryptionForm = true
                }
            }
        }
    }
    let finalHTML = ''
    if (showMessage) {
        finalHTML += `<label><i class='fas fa-unlock'></i> ${$.t('public_message')}</label>`
        finalHTML += messageHTML
    }
    if (showEncrypted) {
        finalHTML += `<label><i class='fas fa-lock'></i> ${$.t('encrypted_message')}</label>`
        finalHTML += `<div class="modal-text-box">${encryptedHTML}</div>`
    }
    if (showEncryptedToSelf) {
        finalHTML += `<label><i class='fas fa-lock'></i> ${$.t('note_to_self')}</label>`
        finalHTML += `<div class="modal-text-box">${EncryptedToSelfHTML}</div>`
    }
    $output.html(finalHTML)
    $output.show()

    return showDecryptionForm
}
