import { BRS } from '.';
import { reloadCurrentPage } from './brs';
import { addDecryptedTransactionToCache, getAccountId, setDecryptionPassword, decryptAttachmentField } from './brs.encryption';
import { getAccountFormatted, getUnconfirmedTransactionsFromCache } from './brs.util';

export function formsSendMessageComplete(response, data) {
    data.message = data._extra.message;

    if (!(data._extra && data._extra.convertedAccount)) {
        $.notify($.t('success_message_sent') + " <a href='#' data-account='" + getAccountFormatted(data, 'recipient') + "' data-toggle='modal' data-target='#add_contact_modal' style='text-decoration:underline'>" + $.t('add_recipient_to_contacts_q') + '</a>', { type: 'success' });
    } else {
        $.notify($.t('success_message_sent'), { type: 'success' });
    }

    if (data.message && data.encryptedMessageData) {
        addDecryptedTransactionToCache(response.transaction, {
            encryptedMessage: String(data._extra.message)
        });
    }

    if (BRS.currentPage === 'messages') {
        reloadCurrentPage();
    }
}

export async function formsDecryptMessages(data) {
    const accountId = getAccountId(data.secretPhrase);
    if (accountId !== BRS.account) {
        return {
            error: $.t('error_passphrase_incorrect')
        };
    }
    if (data.rememberPassword) {
        setDecryptionPassword(data.secretPhrase);
        reloadCurrentPage();
        return {
            stop: true,
            hide: true
        };
    }
    try {
        const messagesToDecrypt = [];
        for (const otherUser in BRS._messages) {
            for (const key in BRS._messages[otherUser]) {
                const message = BRS._messages[otherUser][key];
                if (message.attachment && message.attachment.encryptedMessage) {
                    messagesToDecrypt.push(message);
                }
            }
        }

        const unconfirmedMessages = getUnconfirmedTransactionsFromCache(1, 0);
        if (unconfirmedMessages) {
            for (const unconfirmedMessage of unconfirmedMessages) {
                if (unconfirmedMessage.attachment && unconfirmedMessage.attachment.encryptedMessage) {
                    messagesToDecrypt.push(unconfirmedMessage);
                }
            }
        }

        for (const message of messagesToDecrypt) {
            if (message.attachment.encryptedMessage) {
                await decryptAttachmentField(message, 'encryptedMessage', true, data.secretPhrase);
            }
        }
    } catch (err) {
        const errorMessage = err.message;
        if (errorMessage) {
            return {
                error: errorMessage
            };
        }
        return {
            error: $.t('error_messages_decrypt')
        };
    }

    $.notify($.t('success_messages_decrypt'), { type: 'success' });

    reloadCurrentPage();

    return {
        stop: true,
        hide: true
    };
}
