import { BRS } from '..'
import { Transaction } from '../typings'
import { reloadCurrentPage } from '../core/navigation'
import { getAccountId, setDecryptionPassword, decryptAttachmentField } from '../core/encryption'
import { getUnconfirmedTransactionsFromCache } from '../core/util'

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

    $.notify($.t('success_messages_decrypt'), { type: 'success' })

    reloadCurrentPage()

    return {
        stop: true,
        hide: true,
    }
}
