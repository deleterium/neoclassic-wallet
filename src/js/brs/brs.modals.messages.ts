import { BRS } from '.';
import { PostResponse, Transaction } from '../typings';
import { reloadCurrentPage } from './brs.navigation';
import { addDecryptedTransactionToCache, getAccountId, setDecryptionPassword, decryptAttachmentField } from './brs.encryption';
import { getAccountRSFromObject, getUnconfirmedTransactionsFromCache } from './brs.util';

export function formsSendMessageComplete(response: PostResponse, data: any) {
    data.message = data._extra.message;

    if (!(data._extra && data._extra.convertedAccount)) {
        $.notify($.t('success_message_sent') + " <a href='#' data-account='" + getAccountRSFromObject(data, 'recipient') + "' data-toggle='modal' data-target='#add_contact_modal' style='text-decoration:underline'>" + $.t('add_recipient_to_contacts_q') + '</a>', { type: 'success' });
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

export async function formsDecryptMessages(data: any) {
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
        const messagesToDecrypt: Transaction[] = [];
        for (const otherUser in BRS._messages) {
            for (const message of BRS._messages[otherUser]) {
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
        const errorMessage = (err as Error).message;
        return {
            error: errorMessage || $.t('error_messages_decrypt')
        };
    }

    $.notify($.t('success_messages_decrypt'), { type: 'success' });

    reloadCurrentPage();

    return {
        stop: true,
        hide: true
    };
}
