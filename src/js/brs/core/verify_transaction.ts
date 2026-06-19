import { BRS } from '.';
import { Transaction } from '../typings';
import converters from '../util/converters';
import { NxtAddress } from '../util/nxtaddress';
import { convertPublicKeyFromBase36ToBase16 } from './brs.util';

interface AttachmentSpec {
    type: number;
    subtype: number;
    attachmentInfo?: {
        type: string;
        value: any[];
    }[];
    postCheck?: () => boolean;
}

export function verifyTransactionBytes(transactionBytes: string, signature: string, requestType: string, data: any) {
    /* @ts-expect-error Empty object to be populated with the Transaction properties. */
    const transaction: Transaction = {};
    let txFlags = 0
    // position to start attachment (if any)
    let pos = 184;
    const byteArray = converters.hexStringToByteArray(transactionBytes);
    // This will bring the info to check type, subtype and attachment for a given requestType
    let attachmentSpec: AttachmentSpec;
    const ERROR = true;
    const SUCCESS = false;

    function verifyAndSignTransactionBytesMain() {
        createBaseTransaction();
        prepareData();
        attachmentSpec = getAttachmentSpec(requestType);
        if (checkBaseTransaction()) return '';
        if (checkAttachment()) return '';
        if (checkMessage()) return '';
        if (checkEncryptedMessage()) return '';
        if (checkRecipientPublicKey()) return '';
        if (checkEncryptToSelfMessage()) return '';
        return transactionBytes.substr(0, 192) + signature + transactionBytes.substr(320);
    }

    function createBaseTransaction() {
        transaction.type = byteArray[0];
        transaction.version = (byteArray[1] & 0xF0) >> 4;
        transaction.subtype = byteArray[1] & 0x0F;
        transaction.timestamp = converters.byteArrayToSignedInt32(byteArray, 2);
        transaction.deadline = converters.byteArrayToSignedShort(byteArray, 6);
        transaction.senderPublicKey = converters.byteArrayToHexString(byteArray.slice(8, 40));
        transaction.recipient = String(converters.byteArrayToBigInt64(byteArray, 40));
        transaction.amountNQT = String(converters.byteArrayToBigInt64(byteArray, 48));
        transaction.feeNQT = String(converters.byteArrayToBigInt64(byteArray, 56));
        transaction.referencedTransactionFullHash = converters.byteArrayToHexString(byteArray.slice(64, 96));
        if (/^0+$/.test(transaction.referencedTransactionFullHash)) {
            transaction.referencedTransactionFullHash = '';
        }
        if (transaction.version > 0) {
            txFlags = converters.byteArrayToSignedInt32(byteArray, 160);
            transaction.ecBlockHeight = converters.byteArrayToSignedInt32(byteArray, 164);
            transaction.ecBlockId = String(converters.byteArrayToBigInt64(byteArray, 168));
        }
    }

    function prepareData() {
        if (!('amountNQT' in data)) {
            data.amountNQT = '0';
        }
        if (!('recipient' in data)) {
            data.recipient = '0';
            data.recipientRS = BRS.prefix + '2222-2222-2222-22222';
        }
        const parts = BRS.rsRegEx.exec(data.recipient)
        if (parts) {
            // wrong data type... Fix
            const address = new NxtAddress(parts[1] + parts[2]);
            data.recipient = address.getAccountId();
            data.recipientRS = address.getAccountRS(BRS.prefix);
            if (parts[3]) {
                data.recipientPublicKey = convertPublicKeyFromBase36ToBase16(parts[3]);
            }
        }
    }

    function checkBaseTransaction() {
        if (transaction.senderPublicKey !== BRS.accountInfo.publicKey ||
            transaction.deadline !== Number(data.deadline) ||
            transaction.feeNQT !== data.feeNQT ||
            transaction.version === 0 ||
            transaction.type !== attachmentSpec.type ||
            transaction.subtype !== attachmentSpec.subtype) {
            return ERROR;
        }
        if (transaction.recipient !== data.recipient) {
            const requestTypeWithoutRecipientInData = ['buyAlias'];
            if (requestTypeWithoutRecipientInData.indexOf(requestType) === -1) {
                return ERROR;
            }
        }
        if (transaction.amountNQT !== data.amountNQT) {
            // These transactions check data.amountNQT in attachment or thru postCheck()
            const requestTypeWithSeperatedAmountNQTCalculation = ['sendMoneyMulti', 'sendMoneyMultiSame', 'sendMoneyEscrow', 'addCommitment', 'removeCommitment'];
            if (requestTypeWithSeperatedAmountNQTCalculation.indexOf(requestType) === -1) {
                return ERROR;
            }
        }
        if ('referencedTransactionFullHash' in data) {
            if (transaction.referencedTransactionFullHash !== data.referencedTransactionFullHash) {
                return ERROR;
            }
        } else if (transaction.referencedTransactionFullHash !== '') {
            return ERROR;
        }
        return SUCCESS;
    }

    function getAttachmentSpecV2(rqType) {
        switch (rqType) {
            case 'issueAsset':
                return {
                    type: 2,
                    subtype: 0,
                    attachmentInfo: [
                        { type: 'ByteString*1', value: [data.name] },
                        { type: 'ShortString*1', value: [data.description] },
                        { type: 'Long*1', value: [data.quantityQNT] },
                        { type: 'Byte*1', value: [data.decimals] },
                        { type: 'Byte*1', value: [data.mintable ? 1 : 0] }
                    ]
                };
            default:
                return {
                    type: -1,
                    subtype: -1
                };
        }
    }

    function getAttachmentSpec(rqType: string) : AttachmentSpec {
        switch (rqType) {
            case 'sendMoney':
                return { type: 0, subtype: 0 };
            case 'sendMoneyMulti':
                return {
                    type: 0,
                    subtype: 1,
                    attachmentInfo: [
                        { type: 'Byte*1', value: [data.recipients.split(';').length] },
                        { type: 'Long:Long*$0', value: data.recipients.split(';') }
                    ],
                    postCheck() {
                        let sum = 0n;
                        for (const eachRecipient of data.recipients.split(';')) {
                            sum += BigInt(eachRecipient.split(':')[1]);
                        }
                        if (transaction.amountNQT !== sum.toString(10)) return ERROR;
                        return SUCCESS;
                    }
                };
            case 'sendMoneyMultiSame':
                return {
                    type: 0,
                    subtype: 2,
                    attachmentInfo: [
                        { type: 'Byte*1', value: [data.recipients.split(';').length] },
                        { type: 'Long*$0', value: data.recipients.split(';') }
                    ],
                    postCheck() {
                        const totalAmount = BigInt(data.recipients.split(';').length) * BigInt(data.amountNQT);
                        if (transaction.amountNQT !== totalAmount.toString(10)) return ERROR;
                        return SUCCESS;
                    }
                };
            case 'sendMessage':
                return { type: 1, subtype: 0 };
            case 'setAlias':
                return {
                    type: 1,
                    subtype: 1,
                    attachmentInfo: [
                        { type: 'ByteString*1', value: [data.aliasName] },
                        { type: 'ShortString*1', value: [data.aliasURI] }
                    ]
                };
            case 'setAccountInfo':
                return {
                    type: 1,
                    subtype: 5,
                    attachmentInfo: [
                        { type: 'ByteString*1', value: [data.name] },
                        { type: 'ShortString*1', value: [data.description] }
                    ]
                };
            case 'sellAlias':
                return {
                    type: 1,
                    subtype: 6,
                    attachmentInfo: [
                        { type: 'ByteString*1', value: [data.aliasName] },
                        { type: 'Long*1', value: [data.priceNQT] }
                    ]
                };
            case 'buyAlias':
                return {
                    type: 1,
                    subtype: 7,
                    attachmentInfo: [
                        { type: 'ByteString*1', value: [data.aliasName] }
                    ]
                };
            case 'issueAsset':
                return {
                    type: 2,
                    subtype: 0,
                    attachmentInfo: [
                        { type: 'ByteString*1', value: [data.name] },
                        { type: 'ShortString*1', value: [data.description] },
                        { type: 'Long*1', value: [data.quantityQNT] },
                        { type: 'Byte*1', value: [data.decimals] }
                    ]
                };
            case 'transferAsset':
                return {
                    type: 2,
                    subtype: 1,
                    attachmentInfo: [
                        { type: 'Long*1', value: [data.asset] },
                        { type: 'Long*1', value: [data.quantityQNT] }
                    ]
                };
            case 'placeAskOrder':
                return {
                    type: 2,
                    subtype: 2,
                    attachmentInfo: [
                        { type: 'Long*1', value: [data.asset] },
                        { type: 'Long*1', value: [data.quantityQNT] },
                        { type: 'Long*1', value: [data.priceNQT] }
                    ]
                };
            case 'placeBidOrder':
                return {
                    type: 2,
                    subtype: 3,
                    attachmentInfo: [
                        { type: 'Long*1', value: [data.asset] },
                        { type: 'Long*1', value: [data.quantityQNT] },
                        { type: 'Long*1', value: [data.priceNQT] }
                    ]
                };
            case 'cancelAskOrder':
                return {
                    type: 2,
                    subtype: 4,
                    attachmentInfo: [
                        { type: 'Long*1', value: [data.order] }
                    ]
                };
            case 'cancelBidOrder':
                return {
                    type: 2,
                    subtype: 5,
                    attachmentInfo: [
                        { type: 'Long*1', value: [data.order] }
                    ]
                };
            case 'transferAssetMulti':
                return {
                    type: 2,
                    subtype: 9,
                    attachmentInfo: [
                        { type: 'Byte*1', value: [data.assetIdsAndQuantities.split(';').length] },
                        { type: 'Long:Long*$0', value: data.assetIdsAndQuantities.split(';') }
                    ]
                };
            case 'setRewardRecipient':
                return { type: 20, subtype: 0 };
            case 'addCommitment':
                return {
                    type: 20,
                    subtype: 1,
                    attachmentInfo: [
                        { type: 'Long*1', value: [data.amountNQT] }
                    ]
                };
            case 'removeCommitment':
                return {
                    type: 20,
                    subtype: 2,
                    attachmentInfo: [
                        { type: 'Long*1', value: [data.amountNQT] }
                    ]
                };
            case 'sendMoneyEscrow':
                return {
                    type: 21,
                    subtype: 0,
                    attachmentInfo: [
                        { type: 'Long*1', value: [data.amountNQT] },
                        { type: 'Int*1', value: [data.escrowDeadline] },
                        { type: 'Byte*1', value: [['undecided', 'release', 'refund', 'split'].indexOf(data.deadlineAction)] },
                        { type: 'Byte*1', value: [data.requiredSigners] },
                        { type: 'Byte*1', value: [data.signers.split(';').length] },
                        { type: 'Long*$4', value: data.signers.split(';') }
                    ]
                };
            case 'escrowSign':
                return {
                    type: 21,
                    subtype: 1,
                    attachmentInfo: [
                        { type: 'Long*1', value: [data.escrow] },
                        { type: 'Byte*1', value: [['undecided', 'release', 'refund', 'split'].indexOf(data.decision)] }
                    ]
                };
            case 'sendMoneySubscription':
                return {
                    type: 21,
                    subtype: 3,
                    attachmentInfo: [
                        { type: 'Int*1', value: [data.frequency] }
                    ]
                };
            case 'subscriptionCancel':
                return {
                    type: 21,
                    subtype: 4,
                    attachmentInfo: [
                        { type: 'Long*1', value: [data.subscription] }
                    ]
                };
            default:
                return {
                    type: -1,
                    subtype: -1
                };
        }
    };

    function checkAttachment() {
        const pastValues: string[][] = [];
        if (attachmentSpec.attachmentInfo === undefined) {
            return SUCCESS;
        }
        const attachmentVersion = byteArray[pos];
        pos++;
        switch (attachmentVersion) {
            case 1:
                break;
            case 2:
                attachmentSpec = getAttachmentSpecV2(requestType);
                if (transaction.type === attachmentSpec.type &&
                    transaction.subtype === attachmentSpec.subtype) {
                    break;
                }
                return ERROR;
            default:
                return ERROR;
        }
        if (attachmentSpec.attachmentInfo === undefined) {
            return SUCCESS;
        }
        for (const item of attachmentSpec.attachmentInfo) {
            const itemType = item.type.split('*');
            const typeSpec = itemType[0];
            const repetitionSpec = itemType[1];
            let repetition;
            if (repetitionSpec.startsWith('$')) {
                // variable repetition, depending on previous element
                repetition = parseInt(pastValues[repetitionSpec.substring(1)][0]);
            } else {
                // fixed repetition
                repetition = parseInt(repetitionSpec);
            }
            const currentValues: string[] = [];
            let sizeOfString: number;
            for (let amount = 0; amount < repetition; amount++) {
                switch (typeSpec) {
                    case 'ByteString':
                        sizeOfString = byteArray[pos++];
                        currentValues.push(converters.byteArrayToString(byteArray, pos, sizeOfString));
                        pos += sizeOfString;
                        break;
                    case 'ShortString':
                        sizeOfString = converters.byteArrayToSignedShort(byteArray, pos);
                        pos += 2;
                        currentValues.push(converters.byteArrayToString(byteArray, pos, sizeOfString));
                        pos += sizeOfString;
                        break;
                    case 'Long:Long':
                        currentValues.push(
                            converters.byteArrayToBigInt64(byteArray, pos).toString() +
                            ':' +
                            converters.byteArrayToBigInt64(byteArray, pos + 8).toString()
                        );
                        pos += 16;
                        break;
                    case 'Long':
                        currentValues.push(converters.byteArrayToBigInt64(byteArray, pos).toString());
                        pos += 8;
                        break;
                    case 'Int':
                        currentValues.push(converters.byteArrayToSignedInt32(byteArray, pos).toString());
                        pos += 4;
                        break;
                    case 'Short':
                        currentValues.push(converters.byteArrayToSignedShort(byteArray, pos).toString());
                        pos += 2;
                        break;
                    case 'Byte':
                        currentValues.push(byteArray[pos].toString());
                        pos++;
                        break;
                    default:
                        return ERROR;
                }
            }
            for (const eachVal of item.value) {
                // Maybe the order was changed. Search all items...
                if (currentValues.find(eachParsed => eachParsed === String(eachVal)) === undefined) {
                    return ERROR;
                }
            }
            // ... and ensure no item was added
            if (item.value.length !== currentValues.length) {
                return ERROR;
            }
            pastValues.push(currentValues);
        }
        if (attachmentSpec.postCheck) {
            return attachmentSpec.postCheck();
        }
        return SUCCESS;
    }

    function checkMessage() {
        // flag for non-encrypted message
        const flagBit = 0b1;
        if ((txFlags & flagBit) === 0) {
            if (data.message) return ERROR;
            else return SUCCESS;
        }
        const attachmentVersion = byteArray[pos];
        pos++;
        if (attachmentVersion !== 1) {
            return ERROR;
        }
        const attachment: any = {}
        let messageLength = converters.byteArrayToSignedInt32(byteArray, pos);
        pos += 4;
        attachment.messageIsText = messageLength < 0;
        if (messageLength < 0) {
            messageLength &= 2147483647;
        }
        if (attachment.messageIsText) {
            attachment.message = converters.byteArrayToString(byteArray, pos, messageLength);
        } else {
            const slice = byteArray.slice(pos, pos + messageLength);
            attachment.message = converters.byteArrayToHexString(slice);
        }
        pos += messageLength;
        const messageIsText = (attachment.messageIsText ? 'true' : 'false');
        if (messageIsText !== data.messageIsText) {
            return ERROR;
        }
        if (attachment.message !== data.message) {
            return ERROR;
        }
        return SUCCESS;
    }

    function checkEncryptedMessage() {
        // flag for encrypted note
        const flagBit = 0b10;
        if ((txFlags & flagBit) === 0) {
            if (data.encryptedMessageData) return ERROR;
            else return SUCCESS;
        }
        const attachmentVersion = byteArray[pos];
        pos++;
        if (attachmentVersion !== 1) {
            return ERROR;
        }
        const attachment: any = {}
        let encryptedMessageLength = converters.byteArrayToSignedInt32(byteArray, pos);
        pos += 4;
        attachment.messageToEncryptIsText = encryptedMessageLength < 0;
        if (encryptedMessageLength < 0) {
            encryptedMessageLength &= 2147483647;
        }
        attachment.encryptedMessageData = converters.byteArrayToHexString(byteArray.slice(pos, pos + encryptedMessageLength));
        pos += encryptedMessageLength;
        attachment.encryptedMessageNonce = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
        pos += 32;
        const messageToEncryptIsText = (attachment.messageToEncryptIsText ? 'true' : 'false');
        if (messageToEncryptIsText !== data.messageToEncryptIsText) {
            return ERROR;
        }
        if (attachment.encryptedMessageData !== data.encryptedMessageData ||
            attachment.encryptedMessageNonce !== data.encryptedMessageNonce) {
            return ERROR;
        }
        return SUCCESS;
    }

    function checkRecipientPublicKey() {
        const flagBit = 0b100;
        if ((txFlags & flagBit) === 0) {
            if (data.recipientPublicKey) return ERROR;
            else return SUCCESS;
        }
        const attachmentVersion = byteArray[pos];
        pos++;
        if (attachmentVersion !== 1) {
            return ERROR;
        }
        const recipientPublicKey = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
        pos += 32;
        if (recipientPublicKey !== data.recipientPublicKey) {
            return ERROR;
        }
        return SUCCESS;
    }

    function checkEncryptToSelfMessage() {
        const flagBit = 0b1000;
        if ((txFlags & flagBit) === 0) {
            if (data.encryptToSelfMessageData) return ERROR;
            else return false;
        }
        const attachmentVersion = byteArray[pos];
        pos++;
        if (attachmentVersion !== 1) {
            return ERROR;
        }
        const attachment: any = {}
        let encryptedToSelfMessageLength = converters.byteArrayToSignedInt32(byteArray, pos);
        attachment.messageToEncryptToSelfIsText = encryptedToSelfMessageLength < 0;
        if (encryptedToSelfMessageLength < 0) {
            encryptedToSelfMessageLength &= 2147483647;
        }
        pos += 4;
        attachment.encryptToSelfMessageData = converters.byteArrayToHexString(byteArray.slice(pos, pos + encryptedToSelfMessageLength));
        pos += encryptedToSelfMessageLength;
        attachment.encryptToSelfMessageNonce = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
        pos += 32;
        const messageToEncryptToSelfIsText = (attachment.messageToEncryptToSelfIsText ? 'true' : 'false');
        if (messageToEncryptToSelfIsText !== data.messageToEncryptToSelfIsText) {
            return ERROR;
        }
        if (attachment.encryptToSelfMessageData !== data.encryptToSelfMessageData ||
            attachment.encryptToSelfMessageNonce !== data.encryptToSelfMessageNonce) {
            return ERROR;
        }
        return SUCCESS;
    }

    return verifyAndSignTransactionBytesMain();
}
