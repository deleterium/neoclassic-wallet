import { HexString, Transaction } from '../typings';
import converters from '../../util/converters';
import { getDecryptedMessageFromCache, decryptAttachmentField } from '../core/encryption';

/**
 * Get plain message in a given transaction.
 * @param transaction - A transaction object from the blockchain
 * @returns The message, if any, or undefined if not present
 */
export function getMessageTextFromTX(transaction: Transaction): string | undefined {
    if (!transaction.attachment) {
        return;
    }
    if (!transaction.attachment['version.Message'] && transaction.attachment.message) {
        // Message version zero. Text are hex encoded by default.
        return converters.hexStringToString(transaction.attachment.message);
    }
    if (transaction.attachment['version.Message'] === 1) {
        if (transaction.attachment.messageIsText) {
            return transaction.attachment.message;
        }
        // try to convert the data to string (Smart Contracts need this)
        return converters.hexStringToString(transaction.attachment.message);
    }
    return 'unsupported_message_version';
}

/**
 * Get bytes from a message in a given transaction.
 * @param transaction - A transaction object from the blockchain
 * @returns The message, if any, or undefined if not present
 */
export function getMessageBytesFromTX(transaction: Transaction): HexString | undefined {
    if (!transaction.attachment) {
        return;
    }
    if (!transaction.attachment['version.Message'] && transaction.attachment.message) {
        // Message version zero. Text are hex encoded by default.
        return transaction.attachment.message;
    }
    if (transaction.attachment['version.Message'] === 1) {
        if (transaction.attachment.messageIsText) {
            return converters.stringToHexString(transaction.attachment.message);
        }
        // Already hex string
        return transaction.attachment.message;
    }
    return 'unsupported_message_version';
}

interface GetEncryptedMessage {
    message: string;
    isDecrypted: boolean
}

/**
 * Get information about encryptedMessage in a given Transaction. Do not decrypt.
 * Meant to be fast.
 * @param transaction - A transaction object from the blockchain
 * @returns Object {
 *     message: {string} Empty if no message. Empty if it is not decrypted.
 *     isDecrypted: {boolean}
 * } OR {undefined} if no EncryptedMessage in that TX
 */
export function getEncryptedMessageFromTX(transaction): GetEncryptedMessage | undefined {
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
 * @param transaction - A transaction object from the blockchain
 * @returns Object {
 *     message: {string} Empty if no message. Empty if it is not decrypted.
 *     isDecrypted: {boolean}
 * } OR {undefined} if no EncryptedMessage in that TX
 */
export function getEncryptToSelfMessageFromTX(transaction: Transaction): GetEncryptedMessage | undefined {
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

export async function decryptAttachmentFieldAndUpdateSelector(
    transaction: Transaction,
    field: "encryptedMessage" | "encryptToSelfMessage",
    passphrase: string,
    querySelector: string
) {
    const itemID = '#' + querySelector;
    const decoded = await decryptAttachmentField(transaction, field, false, passphrase);
    $(itemID).html(decoded.escapeHTML().nl2br());
}
