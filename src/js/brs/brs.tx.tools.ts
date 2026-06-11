import { BRS } from '.'

import { NxtAddress } from '../util/nxtaddress'

import {
    formatQNTAsQuantity,
    formatNQTAsAmount,
} from './brs.numbers'

import {
    convertRSAccountToNumeric,
    getAccountLink,
    getAccountTitleFromObject
} from './brs.util'

import { getAssetDetails } from './brs.asset.tools'

import { DBAsset, Transaction, UnconfirmedTransaction } from '../typings'

/**
 * Get transaction details.
 * @param transaction to get the name
 * @param viewingAccount Use this account as point of view. Default to current user
 * @returns Object with many transaction details to be shown.
*/
export function getTransactionDetails (transaction: Transaction | UnconfirmedTransaction, viewingAccount: string = BRS.account) {
    if (BRS.rsRegEx.test(viewingAccount)) {
        viewingAccount = convertRSAccountToNumeric(viewingAccount)
    }

    let nameOfTransaction = $.t('unknown')
    let toFromViewer = (transaction.sender === viewingAccount || transaction.recipient === viewingAccount)
    let senderOrRecipientOrMultiple = 'sender'
    if (toFromViewer && transaction.sender === viewingAccount) {
        senderOrRecipientOrMultiple = 'recipient'
    }
    let amountToFromViewer = transaction.amountNQT
    let amountToFromViewerHTML = formatNQTAsAmount(amountToFromViewer) + ' ' + BRS.valueSuffix
    let foundAsset: DBAsset | undefined
    let newAmountText = ''
    let hasAssets = false

    let recipientHTML = getAccountLink(transaction, 'recipient')
    const senderHTML = getAccountLink(transaction, 'sender')

    let amountEach = ''
    // process transactions exceptions and names
    switch (transaction.type) {
    case 0: // "Payment"
        switch (transaction.subtype) {
        case 0:
            nameOfTransaction = $.t('ordinary_payment')
            break
        case 1:
            nameOfTransaction = $.t('multi_out_payment')
            if (transaction.sender === viewingAccount) {
                senderOrRecipientOrMultiple = 'multiple'
                break
            }
            recipientHTML = ''
            for (const recipient of transaction.attachment.recipients) {
                const nxtAddress = new NxtAddress(recipient[0])
                const RSAddress = nxtAddress.getAccountRS(BRS.prefix)
                const amountEach = formatNQTAsAmount(recipient[1]) + ' ' + BRS.valueSuffix
                if (recipient[0] === viewingAccount) {
                    recipientHTML += `<strong class="mono-font">${RSAddress}: ${amountEach}</strong>`
                    toFromViewer = true
                    senderOrRecipientOrMultiple = 'sender'
                    amountToFromViewer = recipient[1]
                    amountToFromViewerHTML = formatNQTAsAmount(amountToFromViewer) + ' ' + BRS.valueSuffix
                } else {
                    recipientHTML += `<span class="mono-font">${RSAddress}</span>: ${amountEach}`
                }
                recipientHTML += '<br />'
            }
            break
        case 2:
            nameOfTransaction = $.t('multi_out_same_payment')
            if (transaction.sender === viewingAccount) {
                senderOrRecipientOrMultiple = 'multiple'
            }

            amountEach = (BigInt(transaction.amountNQT) / BigInt(transaction.attachment.recipients.length)).toString()
            recipientHTML = ''

            for (const recipient of transaction.attachment.recipients) {
                const nxtAddress = new NxtAddress(recipient)
                const address = nxtAddress.getAccountRS(BRS.prefix)
                if (recipient === viewingAccount) {
                    recipientHTML += '<strong class="mono-font">' + address + '</strong>'
                    toFromViewer = true
                    senderOrRecipientOrMultiple = 'sender'
                    amountToFromViewer = amountEach
                    amountToFromViewerHTML = formatNQTAsAmount(amountToFromViewer) + ' ' + BRS.valueSuffix
                } else {
                    recipientHTML += `<span class="mono-font">${address}</span>`
                }
                recipientHTML += '<br />'
            }
        }
        break
    case 1:
        switch (transaction.subtype) {
        case 0:
            nameOfTransaction = $.t('arbitrary_message')
            break
        case 1:
            nameOfTransaction = $.t('alias_assignment')
            senderOrRecipientOrMultiple = 'sender'
            break
        case 5:
            nameOfTransaction = $.t('account_info')
            senderOrRecipientOrMultiple = 'sender'
            break
        case 6:
            if (transaction.attachment.priceNQT === '0') {
                if (transaction.sender === transaction.recipient) {
                    nameOfTransaction = $.t('alias_sale_cancellation')
                } else {
                    nameOfTransaction = $.t('alias_transfer')
                }
            } else {
                nameOfTransaction = $.t('alias_sale')
                senderOrRecipientOrMultiple = 'sender'
            }
            break
        case 7:
            nameOfTransaction = $.t('alias_buy')
            break
        }
        break
    case 2: // "Colored coins"
        switch (transaction.subtype) {
        case 0:
            nameOfTransaction = $.t('asset_issuance')
            senderOrRecipientOrMultiple = 'sender'
            amountToFromViewerHTML = `${formatQNTAsQuantity(transaction.attachment.quantityQNT, transaction.attachment.decimals)} ${transaction.attachment.name}`
            if (transaction.attachment.quantityQNT !== '0') {
                hasAssets = true
            }
            break
        case 1:
        case 6:
            if (transaction.subtype === 1) {
                nameOfTransaction = $.t('asset_transfer')
            } else {
                nameOfTransaction = $.t('asset_mint')
                senderOrRecipientOrMultiple = 'sender'
            }
            foundAsset = getAssetDetails(transaction.attachment.asset)
            newAmountText = ''
            if (foundAsset) {
                newAmountText = `${formatQNTAsQuantity(transaction.attachment.quantityQNT, foundAsset.decimals)} ${foundAsset.name}`
            } else {
                newAmountText = `${transaction.attachment.quantityQNT} [QNT]`
            }
            if (amountToFromViewer !== '0') {
                newAmountText += `<br>${amountToFromViewerHTML}`
            }
            amountToFromViewerHTML = newAmountText
            hasAssets = true
            break
        case 2:
            nameOfTransaction = $.t('ask_order_placement')
            senderOrRecipientOrMultiple = 'sender'
            break
        case 3:
            nameOfTransaction = $.t('bid_order_placement')
            senderOrRecipientOrMultiple = 'sender'
            break
        case 4:
            nameOfTransaction = $.t('ask_order_cancellation')
            break
        case 5:
            nameOfTransaction = $.t('bid_order_cancellation')
            break
        case 7:
            nameOfTransaction = $.t('asset_add_treasury_account')
            break
        case 8:
            nameOfTransaction = $.t('asset_distribute_to_holders')
            // Actually there is no way to know if viewingAccount is in recipients without another query.
            // Assuming yes, because it will be wrong only in unconfirmed transaction.
            toFromViewer = true
            senderOrRecipientOrMultiple = 'sender'
            if (transaction.sender !== viewingAccount) {
                // amount is unknow only if current user is in recipient list
                amountToFromViewerHTML = '(' + amountToFromViewerHTML + ')'
            } else {
                senderOrRecipientOrMultiple = 'multiple'
            }
            break
        case 9:
            nameOfTransaction = $.t('asset_multi_transfer')
            if (amountToFromViewer === '0') {
                amountToFromViewerHTML = ''
            } else {
                amountToFromViewerHTML += '<br>'
            }
            for (let i = 0; i < transaction.attachment.assetIds.length; i++) {
                if (i !== 0) {
                    amountToFromViewerHTML += '<br>'
                }
                foundAsset = getAssetDetails(transaction.attachment.assetIds[i])
                if (foundAsset) {
                    amountToFromViewerHTML += `${formatQNTAsQuantity(transaction.attachment.quantitiesQNT[i], foundAsset.decimals)} ${foundAsset.name}`
                } else {
                    amountToFromViewerHTML += `${transaction.attachment.quantityQNT} [QNT]`
                }
            }
            hasAssets = true
            break
        }
        break
    case 3:
        switch (transaction.subtype) {
        case 0:
            nameOfTransaction = $.t('marketplace_listing')
            break
        case 1:
            nameOfTransaction = $.t('marketplace_removal')
            break
        case 2:
            nameOfTransaction = $.t('marketplace_price_change')
            break
        case 3:
            nameOfTransaction = $.t('marketplace_quantity_change')
            break
        case 4:
            nameOfTransaction = $.t('marketplace_purchase')
            break
        case 5:
            nameOfTransaction = $.t('marketplace_delivery')
            break
        case 6:
            nameOfTransaction = $.t('marketplace_feedback')
            break
        case 7:
            nameOfTransaction = $.t('marketplace_refund')
            break
        }
        break
    case 4:
        switch (transaction.subtype) {
        case 0:
            nameOfTransaction = $.t('balance_leasing')
            break
        }
        break
    case 20: // "Mining",
        switch (transaction.subtype) {
        case 0:
            nameOfTransaction = $.t('reward_assignment')
            break
        case 1: // "Add Commitment"
            nameOfTransaction = $.t('add_commitment')
            senderOrRecipientOrMultiple = 'recipient'
            amountToFromViewer = transaction.attachment.amountNQT.toString()
            amountToFromViewerHTML = formatNQTAsAmount(amountToFromViewer) + ' ' + BRS.valueSuffix
            break
        case 2: // "Remove Commitment"
            nameOfTransaction = $.t('remove_commitment')
            senderOrRecipientOrMultiple = 'sender'
            amountToFromViewer = transaction.attachment.amountNQT.toString()
            amountToFromViewerHTML = formatNQTAsAmount(amountToFromViewer) + ' ' + BRS.valueSuffix
            break
        }
        break
    case 21:
        switch (transaction.subtype) {
        case 0:
            nameOfTransaction = 'Escrow Creation'
            amountToFromViewer = transaction.attachment.amountNQT.toString()
            amountToFromViewerHTML = formatNQTAsAmount(amountToFromViewer) + ' ' + BRS.valueSuffix
            break
        case 1:
            nameOfTransaction = 'Escrow Signing'
            break
        case 2:
            nameOfTransaction = 'Escrow Result'
            break
        case 3:
            nameOfTransaction = $.t('subscription_subscribe')
            break
        case 4:
            nameOfTransaction = $.t('subscription_cancel')
            break
        case 5:
            nameOfTransaction = $.t('subscription_payment')
            break
        }
        break
    case 22:
        switch (transaction.subtype) {
        case 0:
            nameOfTransaction = $.t('at_creation')
            break
        case 1:
            nameOfTransaction = $.t('at_payment')
            break
        }
        break
    }

    let hasMessage = false
    if (transaction.attachment) {
        if (transaction.attachment.encryptedMessage || transaction.attachment.message) {
            hasMessage = true
        } else if (transaction.sender === viewingAccount && transaction.attachment.encryptToSelfMessage) {
            hasMessage = true
        }
    }

    let circleText = ''
    let colorClass = ''
    if (toFromViewer && (amountToFromViewer !== '0' || hasAssets)) {
        if (senderOrRecipientOrMultiple === 'sender') {
            circleText = "<i class='fas fa-plus-circle' style='color:#65C62E'></i>"
        } else {
            circleText = "<i class='fas fa-minus-circle' style='color:#E04434'></i>"
            colorClass = "class='transaction-value-negative'"
        }
    }

    const accountLink = getAccountLink(transaction, senderOrRecipientOrMultiple)
    const accountTitle = getAccountTitleFromObject(transaction, senderOrRecipientOrMultiple)
    return {
        nameOfTransaction,
        accountLink,
        accountTitle,
        recipientHTML,
        senderHTML,
        toFromViewer,
        // amount: amountToFromViewer,
        amountToFromViewerHTML,
        foundAsset,
        hasMessage,
        circleText,
        colorClass
    }
}
