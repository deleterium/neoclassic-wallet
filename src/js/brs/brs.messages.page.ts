import hashicon from 'hashicon'

import { BRS } from '.'

import {
    reloadCurrentPage,
    pageLoaded
} from './brs'

import {
    sendRequest
} from './brs.sendRequest'

import {
    getDecryptionPassword
} from './brs.encryption'

import { formatTimestampAsDateTime } from './brs.numbers'

import {
    getAccountTitleFromObject,
    getAccountRSFromObject,
    getUnconfirmedTransactionsFromCache,
} from './brs.util'

import {
    closeContextMenu
} from './brs.contextmenu'

import {
    showAccountModal
} from './brs.modals.account'

import {
    getMessageTextFromTX,
    getEncryptedMessageFromTX,
    decryptAttachmentFieldAndUpdateSelector
} from './brs.messages.tools'

import { GetAccountTransactionsResponse, Transaction, UNCONFIRMED_HEIGHT } from '../typings'

export function pagesMessages () {
    if (BRS.currentPage === 'messages' && BRS.currentSubPage) {
        // we will refresh current chat box
        const chatMessages = buildChatMessages(BRS.currentSubPage)

        $('#message_details').html(chatMessages)
        $('#message_details').scrollTop($('#message_details')[0].scrollHeight)
        $('#message_details .unlock-messages').on('click', function () {
            $('#messages_decrypt_modal').modal('show')
        })
        pageLoaded()
        return
    }
    $('#messages_vtab').empty()
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
    }, function (response: GetAccountTransactionsResponse) {
        if (response.transactions && response.transactions.length) {
            for (const tx of response.transactions) {
                const otherUser = (tx.recipient === BRS.account ? tx.sender : tx.recipient) as string
                if (!(otherUser in BRS._messages)) {
                    BRS._messages[otherUser] = []
                }
                BRS._messages[otherUser].push(tx)
            }
            displayMessageSidebar()
        } else {
            $('#no_message_selected').hide()
            $('#no_messages_available').show()
        }
        pageLoaded()
    })
}

function displayMessageSidebar () {
    let rows = ''

    const sidebarUserList: {
        timestamp: number;
        user: string;
        userRS: string;
    }[] = []

    for (const otherUser in BRS._messages) {
        BRS._messages[otherUser].sort((a, b) => a.timestamp - b.timestamp)

        // The otherUserRS variable is set to either the senderRS or recipientRS of the first message in the sorted list,
        // depending on whether otherUser matches the sender.
        const otherUserRS = (otherUser === BRS._messages[otherUser][0].sender ? BRS._messages[otherUser][0].senderRS : BRS._messages[otherUser][0].recipientRS) as string

        sidebarUserList.push({
            timestamp: BRS._messages[otherUser][BRS._messages[otherUser].length - 1].timestamp,
            user: otherUser,
            userRS: otherUserRS
        })
    }

    sidebarUserList.sort((a, b)  => a.timestamp - b.timestamp)

    for (const sidebarUser of sidebarUserList) {
        let dataContact = ''
        if (sidebarUser.userRS in BRS.contacts) {
            dataContact = ` data-contact="${getAccountTitleFromObject(sidebarUser, 'user')}"`;
        }

        rows += `
            <a href='#'
              class='nav-link' 
              data-account="${sidebarUser.userRS}"
              data-account-id="${sidebarUser.user}"
              ${dataContact}
              data-context="messages_vtab_context"
              >
              ${getAccountTitleFromObject(sidebarUser, 'user')}
              <br>
              <small>${formatTimestampAsDateTime(sidebarUser.timestamp)}</small>
            </a>`;
    }

    $('#messages_vtab').empty().append(rows)

    if (BRS.currentSubPage) {
        $('#messages_vtab a[data-account-id=' + BRS.currentSubPage + ']').addClass('active')
    }
}

export function incomingMessages (transactions: Transaction[]) {
    if (!BRS.checkIncoming.newTransactions && !BRS.checkIncoming.unconfirmedChanged) {
        return
    }
    let reloadContent = false
    let reloadSidebar = false
    const newUnconfMessages = transactions.filter(tx => tx.type === 1 && tx.subtype === 0 && tx.height === UNCONFIRMED_HEIGHT)
    if (newUnconfMessages.length > 0) {
        reloadContent = true
    }
    const newMessagesTransactions = transactions.filter(tx => tx.type === 1 && tx.subtype === 0 && tx.height !== UNCONFIRMED_HEIGHT && (tx.sender === BRS.account || tx.recipient === BRS.account))
    for (const trans of newMessagesTransactions) {
        const chatTo = (trans.sender === BRS.account ? trans.recipient : trans.sender) as string
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
                account: getAccountRSFromObject(trans, 'sender'),
                name: getAccountTitleFromObject(trans, 'sender')
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

function buildChatMessages (account_id: string) {
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

    for (const message of messages) {

        const containerID = 'message' + message.transaction
        const plainMessage: string | undefined = getMessageTextFromTX(message)
        let messageField = $.t('message_empty')
        if (plainMessage) {
            messageField = plainMessage.escapeHTML().nl2br()
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

        const day = formatTimestampAsDateTime(message.timestamp)

        let pendingClass = ''
        if (message.height === UNCONFIRMED_HEIGHT) {
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

export function evMessagesSidebarClick (e: JQuery.ClickEvent) {
    e.preventDefault()
    const clickedElement = $(e.currentTarget)

    $('#messages_vtab a.active').removeClass('active')
    clickedElement.addClass('active')

    const otherUser = clickedElement.data('account-id')
    BRS.currentSubPage = otherUser

    const contactName = clickedElement.data('contact')
    const rsAddress = clickedElement.data('account')
    const friendlyName = contactName ?? rsAddress
    $('#chatbox_title').text(friendlyName)

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

export function evMessagesSidebarContextClick (e: JQuery.ClickEvent) {
    e.preventDefault()
    if (!BRS.selectedContext) return

    const element = e.currentTarget
    const account = BRS.selectedContext.data('account')
    const option = $(element).data('option')

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
