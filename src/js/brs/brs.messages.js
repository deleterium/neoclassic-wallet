/**
 * @depends {brs.js}
 */

import converters from '../util/converters'
import hashicon from 'hashicon'

import { BRS } from '.'

import {
    reloadCurrentPage,
    pageLoaded
} from './brs'

import {
    sendRequest
} from './brs.server'

import {
    getAccountId,
    setDecryptionPassword,
    addDecryptedTransactionToCache,
    getDecryptedMessageFromCache,
    getDecryptionPassword,
    decryptAttachmentField
} from './brs.encryption'

import {
    formatAmount,
    formatTimestamp,
    convertFromHex16,
    convertFromHex8,
    getAccountTitle,
    getAccountFormatted,
    getUnconfirmedTransactionsFromCache,
    hasTransactionUpdates
} from './brs.util'

import {
    closeContextMenu
} from './brs.sidebar'

import {
    showAccountModal
} from './brs.modals.account'

export function pagesMessages (callback) {
    if (BRS.currentPage === 'messages' && BRS.currentSubPage) {
        // we will refresh current chat box
        const chatMessages = buildChatMessages(BRS.currentSubPage)

        $('#message_details').html(chatMessages)
        $('#message_details').scrollTop($('#message_details')[0].scrollHeight)
        $('#message_details .unlock-messages').on('click', function () {
            $('#messages_decrypt_modal').modal('show')
        })
        pageLoaded(callback)
        return
    }
    $('#messages_sidebar').empty()
    $('#no_message_selected').show()
    $('#no_messages_available').hide()
    $('#messages_card').hide()

    BRS._messages = {}

    sendRequest('getAccountTransactions+', {
        account: BRS.account,
        firstIndex: 0,
        lastIndex: 74,
        type: 1,
        subtype: 0,
        includeIndirect: false
    }, function (response) {
        if (response.transactions && response.transactions.length) {
            for (let i = 0; i < response.transactions.length; i++) {
                const otherUser = (response.transactions[i].recipient === BRS.account ? response.transactions[i].sender : response.transactions[i].recipient)
                if (!(otherUser in BRS._messages)) {
                    BRS._messages[otherUser] = []
                }
                BRS._messages[otherUser].push(response.transactions[i])
            }
            displayMessageSidebar()
        } else {
            $('#no_message_selected').hide()
            $('#no_messages_available').show()
        }
        pageLoaded(callback)
    })
}

function displayMessageSidebar () {
    let rows = ''

    const sortedMessages = []

    for (const otherUser in BRS._messages) {
        BRS._messages[otherUser].sort(function (a, b) {
            if (a.timestamp > b.timestamp) {
                return 1
            } else if (a.timestamp < b.timestamp) {
                return -1
            } else {
                return 0
            }
        })

        const otherUserRS = (otherUser === BRS._messages[otherUser][0].sender ? BRS._messages[otherUser][0].senderRS : BRS._messages[otherUser][0].recipientRS)

        sortedMessages.push({
            timestamp: BRS._messages[otherUser][BRS._messages[otherUser].length - 1].timestamp,
            user: otherUser,
            userRS: otherUserRS
        })
    }

    sortedMessages.sort(function (a, b) {
        if (a.timestamp < b.timestamp) {
            return 1
        } else if (a.timestamp > b.timestamp) {
            return -1
        } else {
            return 0
        }
    })

    for (let i = 0; i < sortedMessages.length; i++) {
        const sortedMessage = sortedMessages[i]

        let extra = ''

        if (sortedMessage.userRS in BRS.contacts) {
            extra = " data-contact='" + getAccountTitle(sortedMessage, 'user') + "'"
        }

        rows += "<a href='#' class='list-group-item no-wrap' data-account='" + getAccountFormatted(sortedMessage, 'user') + "' data-account-id='" + getAccountFormatted(sortedMessage.user) + "'" + extra + '>' + getAccountTitle(sortedMessage, 'user') + '<br><small>' + formatTimestamp(sortedMessage.timestamp) + '</small></a>'
    }

    $('#messages_sidebar').empty().append(rows)

    if (BRS.currentSubPage) {
        $('#messages_sidebar a[data-account-id=' + BRS.currentSubPage + ']').addClass('active')
    }
}

export function incomingMessages (transactions) {
    if (!hasTransactionUpdates(transactions)) {
        return
    }
    let reloadContent = false
    let reloadSidebar = false
    const newUnconfMessages = transactions.filter(tx => tx.type === 1 && tx.subtype === 0 && tx.unconfirmed === true)
    if (newUnconfMessages.length > 0) {
        reloadContent = true
    }
    const newMessagesTransactions = transactions.filter(tx => tx.type === 1 && tx.subtype === 0 && tx.unconfirmed !== true && (tx.sender === BRS.account || tx.recipient === BRS.account))
    for (const trans of newMessagesTransactions) {
        const chatTo = trans.sender === BRS.account ? trans.recipient : trans.sender
        if (BRS._messages[chatTo] === undefined) {
            reloadSidebar = true
            BRS._messages[chatTo] = [trans]
        } else {
            if (BRS._messages[chatTo].find(tx => tx.transaction === trans.transaction)) {
                continue
            }
            BRS._messages[chatTo].push(trans)
            BRS._messages[chatTo].sort(function (a, b) {
                return a.timestamp - b.timestamp
            })
            reloadContent = true
        }
        if (trans.sender !== BRS.account) {
            $.notify($.t('you_received_message', {
                account: getAccountFormatted(trans, 'sender'),
                name: getAccountTitle(trans, 'sender')
            }), { type: 'success' })
        }
    }

    if (BRS.currentPage === 'messages') {
        if (reloadSidebar) {
            displayMessageSidebar()
        }
        if (reloadContent) {
            reloadCurrentPage()
        }
    }
}

/**
 * Get plain message in a given transaction.
 * @param {Transaction} A transaction object from the blockchain
 * @returns {string} The message, inf any, or undefine if not present
 */
export function getMessageFromTX (transaction) {
    if (!transaction.attachment) {
        return
    }
    if (!transaction.attachment['version.Message'] && transaction.attachment.message) {
        // Message version zero
        try {
            return converters.hexStringToString(transaction.attachment.message)
        } catch (err) {
            // legacy
            if (transaction.attachment.message.indexOf('feff') === 0) {
                return convertFromHex16(transaction.attachment.message)
            }
            return convertFromHex8(transaction.attachment.message)
        }
    }
    if (transaction.attachment['version.Message'] === 1) {
        return transaction.attachment.message
    }
    if (transaction.attachment['version.Message'] > 1) {
        return 'unsupported_message_version'
    }
}

/**
 * Get information about encryptedMessage in a given Transaction. Do not decrypt.
 * Meant to be fast.
 * @param {Transaction} A transaction object from the blockchain
 * @returns {response} Object {
 *     message: {string} Empty if no message. Empty if it is not decrypted.
 *     isDecrypted: {boolean}
 * } OR {undefined} if no EncryptedMessage in that TX
 */
export function getEncryptedMessageFromTX (transaction) {
    if (!transaction.attachment || !transaction.attachment.encryptedMessage) {
        return
    }
    const cachedMessage = getDecryptedMessageFromCache(transaction.transaction, 'encryptedMessage')
    if (cachedMessage) {
        return {
            message: cachedMessage,
            isDecrypted: true
        }
    }
    return {
        message: '',
        isDecrypted: false
    }
}

/**
 * Get information about EncryptToSelfMessage in a given Transaction. Do not decrypt.
 * Meant to be fast.
 * @param {Transaction} A transaction object from the blockchain
 * @returns {response} Object {
 *     message: {string} Empty if no message. Empty if it is not decrypted.
 *     isDecrypted: {boolean}
 * } OR {undefined} if no EncryptedMessage in that TX
 */
export function getEncryptToSelfMessageFromTX (transaction) {
    if (!transaction.attachment || !transaction.attachment.encryptToSelfMessage) {
        return
    }
    const cachedMessage = getDecryptedMessageFromCache(transaction.transaction, 'encryptToSelfMessage')
    if (cachedMessage) {
        return {
            message: cachedMessage,
            isDecrypted: true
        }
    }
    return {
        message: '',
        isDecrypted: false
    }
}

export async function decryptAttachmentFieldAndUpdateSelector (transaction, field, passphrase, querySelector) {
    const itemID = '#' + querySelector
    const decoded = await decryptAttachmentField(transaction, field, false, passphrase)
    $(itemID).html(decoded.escapeHTML().nl2br())
}

function buildChatMessages (account_id) {
    const msgFromTemplate = `
        <div class="direct-chat-msg %pendingClass%">
            <div class="direct-chat-infos clearfix">
                <span class="direct-chat-name float-left">%from%</span>
                <span class="direct-chat-timestamp float-right">%timestamp%</span>
            </div>
            <img class="direct-chat-img" src="%imgsrc%">
            <div class="direct-chat-text">%message%</div>
        </div>`
    const msgToTemplate = `
        <div class="direct-chat-msg right %pendingClass%">
            <div class="direct-chat-infos clearfix">
                <span class="direct-chat-name float-right">%from%</span>
                <span class="direct-chat-timestamp float-left">%timestamp%</span>
            </div>
            <img class="direct-chat-img" src="%imgsrc%">
            <div class="direct-chat-text">%message%</div>
        </div>`
    let output = ''

    const messages = BRS._messages[account_id].slice(0)

    const unconfirmedTransactions = getUnconfirmedTransactionsFromCache(1, 0, {
        recipient: account_id,
        sender: account_id
    })

    if (unconfirmedTransactions) {
        messages.push(...unconfirmedTransactions.reverse())
    }

    for (let i = 0; i < messages.length; i++) {
        const message = messages[i]

        const containerID = 'message' + message.transaction
        const plainMessage = getMessageFromTX(message)
        let messageField = 'no_data'
        if (plainMessage !== undefined) {
            // public message
            if (plainMessage === '') {
                messageField = $.t('message_empty')
            } else {
                messageField = plainMessage.escapeHTML().nl2br()
            }
        }
        const secretMessage = getEncryptedMessageFromTX(message)
        if (!plainMessage && secretMessage) {
            if (secretMessage.isDecrypted) {
                // encrypted message but already decoded in cache
                messageField = '<i class="fas fa-lock"></i> ' + secretMessage.message.escapeHTML().nl2br()
            } else {
                // encrypted message, will be decoded async if there is passphrase available, or button to show modal for decryption
                const passphrase = getDecryptionPassword()
                if (passphrase) {
                    messageField = `<i class="fas fa-lock"></i> <span id="${containerID}">${BRS.pendingTransactionHTML}</span>`
                    setTimeout(decryptAttachmentFieldAndUpdateSelector, 10, message, 'encryptedMessage', passphrase, containerID)
                } else {
                    // Show button for decryption
                    messageField = "<i class='fas fa-exclamation-triangle'></i> " + '<button class="btn btn-warning unlock-messages"><i class="fas fa-key"></i></button>'
                }
            }
        }

        const day = formatTimestamp(message.timestamp)

        let pendingClass = ''
        if (message.unconfirmed === true) {
            pendingClass = 'messagePending'
        }

        if (message.sender === BRS.account) {
            output += msgToTemplate
                .replace('%pendingClass%', pendingClass)
                .replace('%from%', $.t('you'))
                .replace('%timestamp%', day)
                .replace('%imgsrc%', hashicon(message.sender, { size: 40 }).toDataURL())
                .replace('%message%', messageField)
        } else {
            output += msgFromTemplate
                .replace('%pendingClass%', pendingClass)
                .replace('%from%', message.senderRS)
                .replace('%timestamp%', day)
                .replace('%imgsrc%', hashicon(message.sender, { size: 40 }).toDataURL())
                .replace('%message%', messageField)
        }
    }
    return output
}

export function evMessagesSidebarClick (e) {
    e.preventDefault()

    $('#messages_sidebar a.active').removeClass('active')
    $(this).addClass('active')

    const otherUser = $(this).data('account-id')
    BRS.currentSubPage = otherUser

    const contactName = $(this).data('contact')
    const rsAddress = $(this).data('account')
    const friendlyName = contactName ?? rsAddress
    $('#chatbox_title').html(friendlyName.escapeHTML())

    $('#no_message_selected, #no_messages_available').hide()
    $('#messages_card').hide()

    const chatMessages = buildChatMessages(otherUser)

    $('#message_details').html(chatMessages)
    $('#messages_card').show()
    $('#message_details').scrollTop($('#message_details')[0].scrollHeight)
    $('#message_details .unlock-messages').on('click', function () {
        $('#messages_decrypt_modal').modal('show')
    })
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    })
}

export function evMessagesSidebarContextClick (e) {
    e.preventDefault()

    const account = getAccountFormatted(BRS.selectedContext.data('account'))
    const option = $(this).data('option')

    closeContextMenu()

    if (option === 'add_contact') {
        $('#add_contact_account_id').val(account).trigger('blur')
        $('#add_contact_modal').modal('show')
    } else if (option === 'send_burst') {
        $('#send_money_recipient').val(account).trigger('blur')
        $('#send_money_modal').modal('show')
    } else if (option === 'account_info') {
        showAccountModal(account)
    }
}

export function formsSendMessageComplete (response, data) {
    data.message = data._extra.message

    if (!(data._extra && data._extra.convertedAccount)) {
        $.notify($.t('success_message_sent') + " <a href='#' data-account='" + getAccountFormatted(data, 'recipient') + "' data-toggle='modal' data-target='#add_contact_modal' style='text-decoration:underline'>" + $.t('add_recipient_to_contacts_q') + '</a>', { type: 'success' })
    } else {
        $.notify($.t('success_message_sent'), { type: 'success' })
    }

    if (data.message && data.encryptedMessageData) {
        addDecryptedTransactionToCache(response.transaction, {
            encryptedMessage: String(data._extra.message)
        })
    }

    if (BRS.currentPage === 'messages') {
        reloadCurrentPage()
    }
}

export async function formsDecryptMessages (data) {
    const accountId = getAccountId(data.secretPhrase)
    if (accountId !== BRS.account) {
        return {
            error: $.t('error_passphrase_incorrect')
        }
    }
    if (data.rememberPassword) {
        setDecryptionPassword(data.secretPhrase)
        reloadCurrentPage()
        return {
            stop: true,
            hide: true
        }
    }
    try {
        const messagesToDecrypt = []
        for (const otherUser in BRS._messages) {
            for (const key in BRS._messages[otherUser]) {
                const message = BRS._messages[otherUser][key]
                if (message.attachment && message.attachment.encryptedMessage) {
                    messagesToDecrypt.push(message)
                }
            }
        }

        const unconfirmedMessages = getUnconfirmedTransactionsFromCache(1, 0)
        if (unconfirmedMessages) {
            for (const unconfirmedMessage of unconfirmedMessages) {
                if (unconfirmedMessage.attachment && unconfirmedMessage.attachment.encryptedMessage) {
                    messagesToDecrypt.push(unconfirmedMessage)
                }
            }
        }

        for (const message of messagesToDecrypt) {
            if (message.attachment.encryptedMessage) {
                await decryptAttachmentField(message, 'encryptedMessage', true, data.secretPhrase)
            }
        }
    } catch (err) {
        if (err.brsError) {
            return {
                error: err.brsError
            }
        }
        return {
            error: $.t('error_messages_decrypt')
        }
    }

    $.notify($.t('success_messages_decrypt'), { type: 'success' })

    reloadCurrentPage()

    return {
        stop: true,
        hide: true
    }
}
