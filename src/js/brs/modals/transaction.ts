import { BRS } from '..'

import { sendRequestA } from '../core/send_request'

import { fullHashToId, getDecryptedMessageFromCache, getDecryptionPassword } from '../core/encryption'

import {
    formatPriceNQTAsPriceQuantity,
    calculateOrderTotalNQT,
    formatQNTAsQuantity,
    formatNQTAsAmount,
    formatTimestampAsDateTime,
    formatOrderTotal,
    formatNumber,
    convertSecondsToDuration,
} from '../core/numbers'

import { convertNumericToRSAccountFormat, getAssetLink, getAccountTitle, getAccountRSFromObject, createInfoTable } from '../core/util'

import { removeDecryptionForm } from '../core/modals'

import { getAssetDetails } from '../tools/assets'

import { getTransactionDetails } from '../tools/transactions'

import { decryptAttachmentFieldAndUpdateSelector, getMessageBytesFromTX, getMessageTextFromTX } from '../tools/messages'

import { DBAsset, GetAliasResponse, GetIndirectIncomingResponse, GetTransactionResponse, Transaction } from '../typings'

export async function showTransactionModal(transaction: Transaction | string) {
    if (BRS.fetchingModalData) {
        return
    }

    BRS.fetchingModalData = true

    $('#transaction_info_output_bottom, #transaction_info_bottom').html('').hide()
    $('#transaction_info_table').hide()
    $('#transaction_info_table tbody').empty()

    if (typeof transaction !== 'object') {
        const response: Transaction = await sendRequestA('getTransaction', {
            transaction,
        })
        processTransactionModalData(response)
    } else {
        processTransactionModalData(transaction)
    }
}

interface DataTable {
    type: string
    timestamp: string
    fee: string
    amount_formatted?: string
    sender_formatted_html?: string
    recipient_formatted_html?: string
    // balance leasing
    period?: number
    // Multi out payment
    amount_to_you?: string
    you_received?: string
    amount_each_formatted_html?: string
    // Aliases
    alias?: string
    alias_name?: string
    data_formatted_html?: string
    price?: string
    // assets
    asset_name_formatted_html?: string
    description?: string
    quantity?: [string, number][]
    decimals?: number
    mintable?: string
    total_formatted_html?: string
    price_formatted_html?: string
    assets_transferred_formatted_html?: string
    // assets -> distribution to holders
    quantity_to_you?: string
    distributing_quantity?: string
    distributing_asset_formatted_html?: string
    to_holders_of_formatted_html?: string
    // Digital goods
    quantity_formatted_html?: string
    name?: string
    item_name?: string
    seller?: string
    buyer?: string
    delta_quantity?: string
    new_price_formatted_html?: string
    discount?: string
    refund?: string
    order_total_formatted_html?: string
    data?: string
    // Subscription/Escrow payment
    subscription_id?: string
    deadline_action?: string
    deadline?: string
    escrow_id?: string
    frequency?: string
    decision?: string
    signers_formatted_html?: string
    required_signers?: string
    // AT
    at_created_formatted_html?: string
}

interface fnGetTransactionDetails {
    nameOfTransaction: string
    accountLink: string
    accountTitle: string
    recipientHTML: string
    senderHTML: string
    toFromViewer: boolean
    amountToFromViewerHTML: string
    foundAsset: DBAsset | undefined
    hasMessage: boolean
    circleText: string
    colorClass: string
}

async function processTransactionModalData(transaction: Transaction) {
    let data: DataTable
    let assetDetails: DBAsset | undefined
    let helperStr: string
    let details: fnGetTransactionDetails

    async function processTransactionModalDataMain() {
        processInfoDetails()
        processButtons()
        processDefaultProperties()
        await processExceptionProperties()
        processMessage()
        transactionEndLoad()
    }

    function processInfoDetails() {
        const transactionDetails = $.extend({}, transaction)
        delete transactionDetails.attachment

        $('#transaction_info_modal_transaction').html(transaction.transaction)
        $('#transaction_info_tab_link').tab('show')
        $('#transaction_info_details_table tbody').empty().append(createInfoTable(transactionDetails))
        $('#transaction_info_table tbody').empty()
    }

    function processButtons() {
        let accountButton: string
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

    function processDefaultProperties() {
        details = getTransactionDetails(transaction)
        const amount_formatted = formatNQTAsAmount(transaction.amountNQT) + ' ' + BRS.valueSuffix
        data = {
            type: details.nameOfTransaction,
            timestamp: formatTimestampAsDateTime(transaction.timestamp),
            amount_formatted,
            fee: transaction.feeNQT,
            sender_formatted_html: details.senderHTML,
            recipient_formatted_html: details.recipientHTML,
        }
        if (transaction.amountNQT === '0') {
            delete data.amount_formatted
        }
        if (details.recipientHTML === '/') {
            delete data.recipient_formatted_html
        }
    }

    function transactionEndLoad() {
        $('#transaction_info_table tbody').append(createInfoTable(data))
        $('#transaction_info_modal').modal('show')
        $('#transaction_info_table').show()
        BRS.fetchingModalData = false
    }

    async function processExceptionProperties() {
        switch (transaction.type) {
            case 0:
                pePayment()
                return
            case 1:
                await peMessaging()
                return
            case 2:
                await peColoredCoins()
                return
            case 3:
                await peDigitalGoods()
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

    function pePayment() {
        let recipientHTML: string
        let youReceived = false
        let amountToYou = ''
        let amountEach: bigint
        switch (transaction.subtype) {
            case 1:
                // Multi-out Payment
                recipientHTML = ''
                for (let i = 0; i < transaction.attachment.recipients.length; i++) {
                    const rsAddress = convertNumericToRSAccountFormat(transaction.attachment.recipients[i][0])
                    const amount = formatNQTAsAmount(transaction.attachment.recipients[i][1]) + ' ' + BRS.valueSuffix
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
                amountEach = BigInt(transaction.amountNQT) / BigInt(transaction.attachment.recipients.length)
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
                data.amount_each_formatted_html = formatNQTAsAmount(amountEach.toString()) + ' ' + BRS.valueSuffix
                data.recipient_formatted_html = recipientHTML
        }
    }

    async function peMessaging() {
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
                    await peMessagingAliasSale()
                }
                return
            case 7:
                // alias buy
                data.alias_name = transaction.attachment.alias
                data.price = transaction.amountNQT
                break
        }
    }

    async function peMessagingAliasSale() {
        let message = ''
        let messageStyle = 'info'
        data.price = transaction.attachment.priceNQT
        const response: GetAliasResponse = await sendRequestA('getAlias', {
            aliasName: transaction.attachment.alias,
        })

        if (!response.errorCode) {
            if (transaction.recipient !== response.buyer || transaction.attachment.priceNQT !== response.priceNQT) {
                message = $.t('alias_sale_info_outdated')
                messageStyle = 'danger'
            } else if (transaction.recipient === BRS.account) {
                message =
                    $.t('alias_sale_direct_offer', {
                        burst: formatNQTAsAmount(transaction.attachment.priceNQT),
                    }) +
                    " <a href='#' data-alias='" +
                    String(transaction.attachment.alias) +
                    "' data-toggle='modal' data-target='#buy_alias_modal'>" +
                    $.t('buy_it_q') +
                    '</a>'
            } else if (typeof transaction.recipient === 'undefined') {
                message =
                    $.t('alias_sale_indirect_offer', {
                        burst: formatNQTAsAmount(transaction.attachment.priceNQT),
                    }) +
                    " <a href='#' data-alias='" +
                    String(transaction.attachment.alias) +
                    "' data-toggle='modal' data-target='#buy_alias_modal'>" +
                    $.t('buy_it_q') +
                    '</a>'
            } else if (transaction.senderRS === BRS.accountRS) {
                if (transaction.attachment.priceNQT !== '0') {
                    message =
                        $.t('your_alias_sale_offer') +
                        " <a href='#' data-alias='" +
                        String(transaction.attachment.alias) +
                        "' data-toggle='modal' data-target='#cancel_alias_sale_modal'>" +
                        $.t('cancel_sale_q') +
                        '</a>'
                }
            } else {
                message = $.t('error_alias_sale_different_account')
            }
        }

        if (message.length) {
            $('#transaction_info_bottom')
                .html("<div class='callout callout-bottom callout-" + messageStyle + "'>" + message + '</div>')
                .show()
        }
    }

    async function peColoredCoins() {
        switch (transaction.subtype) {
            case 0:
                // asset issuance
                assetDetails = await getAssetDetails(fullHashToId(transaction.fullHash))
                if (!assetDetails) return
                data.asset_name_formatted_html = getAssetLink(assetDetails)
                data.description = transaction.attachment.description
                data.quantity = transaction.attachment.quantityQNT
                data.decimals = transaction.attachment.decimals
                if (transaction.attachment.mintable === true) {
                    data.mintable = $.t('yes')
                } else {
                    data.mintable = $.t('no')
                }
                break
            case 1:
                // asset transfer
                assetDetails = await getAssetDetails(transaction.attachment.asset)
                if (!assetDetails) {
                    break
                }
                data.asset_name_formatted_html = getAssetLink(assetDetails)
                data.quantity = transaction.attachment.quantityQNT
                data.decimals = assetDetails.decimals
                break
            case 2:
                // ask order placement
                assetDetails = await getAssetDetails(transaction.attachment.asset)
                if (!assetDetails) {
                    break
                }
                data.asset_name_formatted_html = getAssetLink(assetDetails)
                data.quantity_formatted_html =
                    formatQNTAsQuantity(transaction.attachment.quantityQNT, assetDetails.decimals) + ' ' + assetDetails.name
                data.price_formatted_html =
                    formatPriceNQTAsPriceQuantity(transaction.attachment.priceNQT, assetDetails.decimals) + ' ' + BRS.valueSuffix
                data.total_formatted_html =
                    formatOrderTotal(transaction.attachment.quantityQNT, transaction.attachment.priceNQT) + ' ' + BRS.valueSuffix
                break
            case 3:
                // bid order placement
                assetDetails = await getAssetDetails(transaction.attachment.asset)
                if (!assetDetails) {
                    break
                }
                data.asset_name_formatted_html = getAssetLink(assetDetails)
                data.quantity_formatted_html =
                    formatQNTAsQuantity(transaction.attachment.quantityQNT, assetDetails.decimals) + ' ' + assetDetails.name
                data.price_formatted_html =
                    formatPriceNQTAsPriceQuantity(transaction.attachment.priceNQT, assetDetails.decimals) + ' ' + BRS.valueSuffix
                data.total_formatted_html =
                    formatOrderTotal(transaction.attachment.quantityQNT, transaction.attachment.priceNQT) + ' ' + BRS.valueSuffix
                break
            case 4:
            case 5: {
                // ask order cancellation
                // bid order cancellation
                const transactionII: GetTransactionResponse = await sendRequestA('getTransaction', {
                    transaction: transaction.attachment.order,
                })
                if (transactionII.errorCode) {
                    return
                }
                const asset = await getAssetDetails(transactionII.attachment.asset)
                if (!asset) {
                    return
                }
                data.asset_name_formatted_html = getAssetLink(asset)
                data.quantity_formatted_html = formatQNTAsQuantity(transactionII.attachment.quantityQNT, asset.decimals) + ' ' + asset.name
                data.price_formatted_html =
                    formatPriceNQTAsPriceQuantity(transactionII.attachment.priceNQT, asset.decimals) + ' ' + BRS.valueSuffix
                data.total_formatted_html =
                    formatNQTAsAmount(calculateOrderTotalNQT(transactionII.attachment.quantityQNT, transactionII.attachment.priceNQT)) +
                    ' ' +
                    BRS.valueSuffix
                break
            }
            case 6:
                assetDetails = await getAssetDetails(transaction.attachment.asset)
                if (!assetDetails) {
                    break
                }
                data.asset_name_formatted_html = getAssetLink(assetDetails)
                data.quantity_formatted_html =
                    formatQNTAsQuantity(transaction.attachment.quantityQNT, assetDetails.decimals) + ' ' + assetDetails.name
                break
            case 7:
                assetDetails = await getAssetDetails(fullHashToId(transaction.referencedTransactionFullHash || ''))
                if (!assetDetails) {
                    break
                }
                data.asset_name_formatted_html = getAssetLink(assetDetails)
                break
            case 8:
                await peColoredCoinsDistributeToHolders()
                break
            case 9:
                helperStr = ''
                for (let i = 0; i < transaction.attachment.assetIds.length; i++) {
                    if (i !== 0) {
                        helperStr += '<br>'
                    }
                    const foundAsset = await getAssetDetails(transaction.attachment.assetIds[i])
                    if (foundAsset) {
                        helperStr += `${formatQNTAsQuantity(transaction.attachment.quantitiesQNT[i], foundAsset.decimals)} ${getAssetLink(foundAsset)}`
                    } else {
                        helperStr += `${transaction.attachment.quantityQNT} [QNT]`
                    }
                }
                data.assets_transferred_formatted_html = helperStr
                break
        }
    }

    async function peColoredCoinsDistributeToHolders() {
        data.to_holders_of_formatted_html = transaction.attachment.asset
        data.distributing_asset_formatted_html = transaction.attachment.assetToDistribute
        data.distributing_quantity = transaction.attachment.quantityQNT
        data.you_received = $.t('no')
        const transactionII: GetIndirectIncomingResponse = await sendRequestA('getIndirectIncoming', {
            transaction: transaction.transaction,
            account: BRS.account,
        })
        let userQuantity = '0'
        let userAmount = '0'
        if (transactionII.errorCode === undefined) {
            userQuantity = transactionII.quantityQNT
            userAmount = transactionII.amountNQT
            data.you_received = $.t('yes')
        }
        const foundAsset = await getAssetDetails(transaction.attachment.asset)
        if (foundAsset) {
            data.to_holders_of_formatted_html = getAssetLink(foundAsset)
        }
        if (userAmount !== '0') {
            data.amount_to_you = formatNQTAsAmount(userAmount) + ' ' + BRS.valueSuffix
        }
        if (transaction.attachment.assetToDistribute === '0') {
            data.distributing_asset_formatted_html = $.t('no')
            delete data.distributing_quantity
        } else {
            const foundAsset2 = await getAssetDetails(transaction.attachment.assetToDistribute)
            if (foundAsset2) {
                data.distributing_asset_formatted_html = getAssetLink(foundAsset2)
                data.distributing_quantity =
                    formatQNTAsQuantity(String(data.distributing_quantity), foundAsset2.decimals) + ' ' + foundAsset2.name
                if (userQuantity !== '0') {
                    data.quantity_to_you = formatQNTAsQuantity(userQuantity, foundAsset2.decimals) + ' ' + foundAsset2.name
                }
            } else {
                if (userQuantity !== '0') {
                    data.quantity_to_you = formatQNTAsQuantity(userQuantity, 0) + ' [QNT]'
                }
            }
        }
    }

    async function peDigitalGoods() {
        let goods: any
        switch (transaction.subtype) {
            case 0:
                // marketplace listing
                delete data.sender_formatted_html
                data.seller = getAccountRSFromObject(transaction, 'sender')
                data.name = transaction.attachment.name
                data.description = transaction.attachment.description
                data.price = transaction.attachment.priceNQT
                data.quantity_formatted_html = formatNumber(transaction.attachment.quantity)
                break
            case 1:
                // marketplace removal
                delete data.sender_formatted_html
                goods = await sendRequestA('getDGSGood', {
                    goods: transaction.attachment.goods,
                })
                data.seller = getAccountRSFromObject(goods, 'seller')
                data.item_name = goods.name
                break
            case 2:
                // marketplace item price change
                delete data.sender_formatted_html
                goods = await sendRequestA('getDGSGood', {
                    goods: transaction.attachment.goods,
                })
                data.seller = getAccountRSFromObject(goods, 'seller')
                data.item_name = goods.name
                data.new_price_formatted_html = formatNQTAsAmount(transaction.attachment.priceNQT) + ' ' + BRS.valueSuffix
                break
            case 3:
                // marketplace item quantity change
                delete data.sender_formatted_html
                goods = await sendRequestA('getDGSGood', {
                    goods: transaction.attachment.goods,
                })
                data.seller = getAccountRSFromObject(goods, 'seller')
                data.item_name = goods.name
                data.delta_quantity = transaction.attachment.deltaQuantity
                break
            case 4:
                await peDigitalGoodsPurchase()
                break
            case 5:
                await peDigitalGoodsDelivery()
                break
            case 6:
                await peDigitalGoodsFeedback()
                break
            case 7: {
                delete data.sender_formatted_html
                delete data.recipient_formatted_html
                const purchase = await sendRequestA('getDGSPurchase', {
                    purchase: transaction.attachment.purchase,
                })
                data.seller = getAccountRSFromObject(purchase, 'seller')
                data.buyer = getAccountRSFromObject(purchase, 'buyer')
                goods = await sendRequestA('getDGSGood', {
                    goods: purchase.goods,
                })
                data.item_name = goods.name
                data.order_total_formatted_html = formatOrderTotal(purchase.quantity, purchase.priceNQT) + ' ' + BRS.valueSuffix
                data.refund = transaction.attachment.refundNQT
                break
            }
        }
    }

    async function peDigitalGoodsPurchase() {
        // marketplace purchase
        delete data.sender_formatted_html
        delete data.recipient_formatted_html
        const goods = await sendRequestA('getDGSGood', {
            goods: transaction.attachment.goods,
        })
        data.buyer = getAccountRSFromObject(transaction, 'sender')
        data.seller = getAccountRSFromObject(goods, 'seller')
        data.item_name = goods.name
        data.price = transaction.attachment.priceNQT
        data.quantity_formatted_html = formatNumber(transaction.attachment.quantity)
        const purchase = await sendRequestA('getDGSPurchase', {
            purchase: transaction.transaction,
        })
        let callout = ''
        if (purchase.errorCode) {
            if (purchase.errorCode === 4) {
                callout = $.t('incorrect_purchase')
            } else {
                callout = String(purchase.errorDescription)
            }
        } else {
            if (BRS.account === transaction.recipient || BRS.account === transaction.sender) {
                if (purchase.pending) {
                    if (BRS.account === transaction.recipient) {
                        callout =
                            "<a href='#' data-toggle='modal' data-target='#dgs_delivery_modal' data-purchase='" +
                            transaction.transaction +
                            "'>" +
                            $.t('deliver_goods_q') +
                            '</a>'
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
            $('#transaction_info_bottom')
                .html(
                    "<div class='callout " +
                        (purchase.errorCode ? 'callout-danger' : 'callout-info') +
                        " callout-bottom'>" +
                        callout +
                        '</div>',
                )
                .show()
        }
    }

    async function peDigitalGoodsFeedback() {
        // marketplace feedback
        delete data.sender_formatted_html
        delete data.recipient_formatted_html
        const purchase = await sendRequestA('getDGSPurchase', {
            purchase: transaction.attachment.purchase,
        })
        data.seller = getAccountRSFromObject(purchase, 'seller')
        data.buyer = getAccountRSFromObject(purchase, 'buyer')
        const goods = await sendRequestA('getDGSGood', {
            goods: purchase.goods,
        })
        data.item_name = goods.name
        if (purchase.seller !== BRS.account && purchase.buyer !== BRS.account) {
            return
        }
        const purchase2 = await sendRequestA('getDGSPurchase', {
            purchase: transaction.attachment.purchase,
        })
        let callout = ''
        if (purchase2.buyer === BRS.account) {
            if (purchase2.refundNQT) {
                callout = $.t('purchase_refunded')
            }
        } else {
            if (!purchase2.refundNQT) {
                callout =
                    "<a href='#' data-toggle='modal' data-target='#dgs_refund_modal' data-purchase='" +
                    String(transaction.attachment.purchase) +
                    "'>" +
                    $.t('refund_this_purchase_q') +
                    '</a>'
            } else {
                callout = $.t('purchase_refunded')
            }
        }
        if (callout) {
            $('#transaction_info_bottom')
                .append("<div class='callout callout-info callout-bottom'>" + callout + '</div>')
                .show()
        }
    }

    async function peDigitalGoodsDelivery() {
        // marketplace delivery
        delete data.sender_formatted_html
        delete data.recipient_formatted_html
        const purchase = await sendRequestA('getDGSPurchase', {
            purchase: transaction.attachment.purchase,
        })
        data.seller = getAccountRSFromObject(purchase, 'seller')
        data.buyer = getAccountRSFromObject(purchase, 'buyer')
        const goods = await sendRequestA('getDGSGood', {
            goods: purchase.goods,
        })
        data.item_name = goods.name
        data.price = purchase.priceNQT
        data.quantity_formatted_html = formatNumber(purchase.quantity)
        if (purchase.quantity !== 1) {
            data.total_formatted_html = formatOrderTotal(purchase.quantity, purchase.priceNQT) + ' ' + BRS.valueSuffix
        }
        if (transaction.attachment.discountNQT) {
            data.discount = transaction.attachment.discountNQT
        }
        if (transaction.attachment.goodsData) {
            // Removed legacy decryption operation
            data.data = 'encrypted_goods_data_is_unsupported_in_neoclassic'
        }
        let callout = ''
        if (BRS.account === purchase.buyer) {
            if (purchase.refundNQT) {
                callout = $.t('purchase_refunded')
            } else if (!purchase.feedbackNote) {
                callout =
                    $.t('goods_received') +
                    " <a href='#' data-toggle='modal' data-target='#dgs_feedback_modal' data-purchase='" +
                    String(transaction.attachment.purchase) +
                    "'>" +
                    $.t('give_feedback_q') +
                    '</a>'
            }
        } else if (BRS.account === purchase.seller && purchase.refundNQT) {
            callout = $.t('purchase_refunded')
        }
        if (callout) {
            $('#transaction_info_bottom')
                .append("<div class='callout callout-info callout-bottom'>" + callout + '</div>')
                .show()
        }
    }

    function peMining() {
        switch (transaction.subtype) {
            case 1:
            case 2:
                // add / remove commitment
                data.amount_formatted = formatNQTAsAmount(transaction.attachment.amountNQT) + ' ' + BRS.valueSuffix
        }
    }

    function peAdvancedPayment() {
        let signers = ''
        switch (transaction.subtype) {
            case 0:
                // TODO add languages / human readable format
                data.amount_formatted = formatNQTAsAmount(transaction.attachment.amountNQT) + ' ' + BRS.valueSuffix
                data.deadline = transaction.attachment.deadline + ' seconds'
                data.deadline_action = $.t(transaction.attachment.deadlineAction)
                data.required_signers = transaction.attachment.requiredSigners
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
                data.escrow_id = transaction.attachment.escrowId
                return
            case 3:
                data.frequency =
                    BRS.durationFormatter.format({ seconds: transaction.attachment.frequency }) +
                    ' - ' +
                    BRS.durationFormatter.format(convertSecondsToDuration(transaction.attachment.frequency))
                return
            case 4:
            case 5:
                // TODO get details from subscription
                data.subscription_id = transaction.attachment.subscriptionId
        }
    }

    function peAutomatedTransactions() {
        let contractAddress: string
        switch (transaction.subtype) {
            case 0:
                contractAddress = convertNumericToRSAccountFormat(transaction.transaction)
                data.at_created_formatted_html = `<a href='#' data-user='${contractAddress}"' class='user-info'>${getAccountTitle(contractAddress)}</a>`
                data.name = transaction.attachment.name
                data.description = transaction.attachment.description
        }
    }

    function processMessage() {
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
export function drawAttachmentMessages(transaction: Transaction, $output: JQuery<HTMLElement>, providedPassphrase?: string): boolean {
    removeDecryptionForm()
    $output.html('')
    let showMessage = false
    let messageHTML = ''
    let showEncrypted = false
    let encryptedHTML = ''
    let showEncryptedToSelf = false
    let EncryptedToSelfHTML = ''
    let showDecryptionForm = false

    if (transaction.attachment.message) {
        // Works both messages v0 or v1.
        const messageText = getMessageTextFromTX(transaction)
        const messageBytes = getMessageBytesFromTX(transaction)
        if (transaction.attachment.messageIsText === true) {
            messageHTML += `<div class='modal-text-box'>${(messageText ?? '').escapeHTML().nl2br()}</div>`
        } else {
            // Show both bytes and text
            messageHTML += `<br><label>${$.t('text')}:</label>`
            messageHTML += `<div class='modal-text-box'>${(messageText ?? '').escapeHTML().nl2br()}</div>`
            messageHTML += `<label>${$.t('bytes')}:</label>`
            messageHTML += `<div class='modal-text-box'>${(messageBytes ?? '').nl2br()}</div>`
        }
        showMessage = true
    }
    if (transaction.attachment.encryptedMessage) {
        showEncrypted = true
        const containerID = 'encryptedMessage' + transaction.transaction
        if (transaction.recipient !== BRS.account && transaction.sender !== BRS.account) {
            encryptedHTML = $.t('data_is_encrypted')
        } else {
            const secretMessage = getDecryptedMessageFromCache(transaction.transaction, 'encryptedMessage')
            if (secretMessage !== undefined) {
                // encrypted message but already decoded in cache
                encryptedHTML = secretMessage.escapeHTML().nl2br()
            } else {
                const passphrase = providedPassphrase === undefined ? getDecryptionPassword() : providedPassphrase
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
        const containerID = 'msgToSelf' + transaction.transaction
        if (transaction.sender !== BRS.account) {
            EncryptedToSelfHTML = $.t('data_is_encrypted')
        } else {
            const secretMessage = getDecryptedMessageFromCache(transaction.transaction, 'encryptToSelfMessage')
            if (secretMessage !== undefined) {
                // encrypted message but already decoded in cache
                EncryptedToSelfHTML = secretMessage.escapeHTML().nl2br()
            } else {
                const passphrase = providedPassphrase === undefined ? getDecryptionPassword() : providedPassphrase
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
