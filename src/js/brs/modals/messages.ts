import { BRS } from '..'
import { Transaction } from '../typings'
import { reloadCurrentPage } from '../core/navigation'
import { getAccountId, setDecryptionPassword, decryptAttachmentField } from '../core/encryption'
import { convertNumericToRSAccountFormat, getUnconfirmedTransactionsFromCache } from '../core/util'
import { notify } from '../core/notifications'
import { showModal } from '../core/modals'

export async function formsDecryptMessages(data: any) {
    const accountId = getAccountId(data.secretPhrase)
    if (accountId !== BRS.account) {
        return {
            error: $.t('error_passphrase_incorrect'),
        }
    }
    if (data.rememberPassword) {
        setDecryptionPassword(data.secretPhrase)
        reloadCurrentPage()
        return {
            stop: true,
            hide: true,
        }
    }
    // Assuming the current page is `messages` because the link to the modal `decrypt_messages` is only there.
    try {
        const messagesToDecrypt: Transaction[] = []
        for (const otherUser in BRS._messages) {
            for (const message of BRS._messages[otherUser]) {
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
        const errorMessage = (err as Error).message
        return {
            error: errorMessage || $.t('error_messages_decrypt'),
        }
    }

    notify($.t('success_messages_decrypt'), { type: 'success' })

    reloadCurrentPage()

    return {
        stop: true,
        hide: true,
    }
}

export function showSendMessageModal(recipient: string, content: string) {
    if (recipient) {
        $('#send_message_recipient').val(recipient).trigger('checkRecipientEvent')
    }
    if (content === 'message_in_chatbox') {
        const recipientAddress = convertNumericToRSAccountFormat(BRS.currentSubPage)
        $('#send_message_message').val($('#message_in_chatbox').val() as string)
        $('#message_in_chatbox').val('')
        if (BRS.contacts[recipientAddress]) {
            $('#send_message_recipient').val(BRS.contacts[recipientAddress].name).trigger('checkRecipientEvent')
        } else {
            $('#send_message_recipient').val(recipientAddress).trigger('checkRecipientEvent')
        }
    } else {
        $('#send_message_message').val(content)
    }

    showModal('send_message')
}
