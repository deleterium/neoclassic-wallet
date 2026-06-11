import converters from '../util/converters';
import { getDecryptedMessageFromCache, decryptAttachmentField } from './brs.encryption';
import { convertFromHex16, convertFromHex8 } from './brs.util';

/**
 * Get plain message in a given transaction.
 * @param {Transaction} A transaction object from the blockchain
 * @returns {string} The message, inf any, or undefine if not present
 */
export function getMessageFromTX(transaction) {
    if (!transaction.attachment) {
        return;
    }
    if (!transaction.attachment['version.Message'] && transaction.attachment.message) {
        // Message version zero
        try {
            return converters.hexStringToString(transaction.attachment.message);
        } catch {
            // legacy
            if (transaction.attachment.message.indexOf('feff') === 0) {
                return convertFromHex16(transaction.attachment.message);
            }
            return convertFromHex8(transaction.attachment.message);
        }
    }
    if (transaction.attachment['version.Message'] === 1) {
        return transaction.attachment.message;
    }
    if (transaction.attachment['version.Message'] > 1) {
        return 'unsupported_message_version';
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
export function getEncryptedMessageFromTX(transaction) {
    if (!transaction.attachment || !transaction.attachment.encryptedMessage) {
        return;
    }
    const cachedMessage = getDecryptedMessageFromCache(transaction.transaction, 'encryptedMessage');
    if (cachedMessage) {
        return {
            message: cachedMessage,
            isDecrypted: true
        };
    }
    return {
        message: '',
        isDecrypted: false
    };
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
export function getEncryptToSelfMessageFromTX(transaction) {
    if (!transaction.attachment || !transaction.attachment.encryptToSelfMessage) {
        return;
    }
    const cachedMessage = getDecryptedMessageFromCache(transaction.transaction, 'encryptToSelfMessage');
    if (cachedMessage) {
        return {
            message: cachedMessage,
            isDecrypted: true
        };
    }
    return {
        message: '',
        isDecrypted: false
    };
}

export async function decryptAttachmentFieldAndUpdateSelector(transaction, field, passphrase, querySelector) {
    const itemID = '#' + querySelector;
    const decoded = await decryptAttachmentField(transaction, field, false, passphrase);
    $(itemID).html(decoded.escapeHTML().nl2br());
}
