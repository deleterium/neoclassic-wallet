
export type HexChar = 
    '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' |
    'a' | 'A' | 'b' | 'B' | 'c' | 'C' | 'd' | 'D' | 'e' | 'E' | 'f' | 'F';

export type ByteArray = number[] | Uint8Array

export type HexString = string

export type WordArray = {
    sigBytes: number,
    words: Uint32Array
}

export interface Transaction {
    amountNQT: string;
    attachment?: any;
    block: string;
    blockTimestamp: number;
    cashBackId: string;
    confirmations?: number;
    deadline: number;
    ecBlockHeight: number;
    ecBlockId: string;
    feeNQT: string;
    fullHash: string;
    height: number;
    recipient?: string;
    recipientRS?: string;
    referencedTransactionFullHash?: string;
    requestProcessingTime: number;
    sender: string;
    senderPublicKey: string;
    senderRS: string;
    signature: string;
    signatureHash: string;
    subtype: number;
    timestamp: number;
    transaction: string;
    type: number;
    version: number;
}
