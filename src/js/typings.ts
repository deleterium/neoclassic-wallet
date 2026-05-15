
export type HexChar = 
    '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' |
    'a' | 'A' | 'b' | 'B' | 'c' | 'C' | 'd' | 'D' | 'e' | 'E' | 'f' | 'F';

export type ByteArray = number[] | Uint8Array

export type HexString = string

export type BrsSettings = {
    submit_on_enter: boolean,
    fee_warning: string,
    amount_warning: string,
    asset_transfer_warning: string,
    theme_dark: boolean,
    small_text: boolean,
    remember_passphrase: boolean,
    remember_account: boolean,
    automatic_node_selection: number,
    page_size: number,
    prefered_node: string,
    language: string,
    news: number,
    console_log: number,
    '24_hour_format': number,
    remember_account_account: string
}

export type DecryptedTransactionFields = "encryptedMessage" | "encryptToSelfMessage"
export type DecryptedTransactionItem = {
    [key in DecryptedTransactionFields]?: string
}
export type DecryptedTransactionsCache = {
    [key: string]: DecryptedTransactionItem
}

// region signum types

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

export interface GetAccountTransactionsResponse {
    transactions: Transaction[];
    nextIndex?: number;
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface BlockchainStatus {
    application: string;
    cumulativeDifficulty: string;
    isScanning: boolean;
    lastBlock: string;
    lastBlockchainFeeder: string;
    lastBlockchainFeederHeight: number;
    numberOfBlocks: number;
    time: number;
    lastBlockTimestamp: number;
    version: string;
}

export interface AssetBalance {
    asset: string;
    balanceQNT: string;
}

interface UnconfirmedAssetBalance {
    asset: string;
    unconfirmedBalanceQNT: string;
}

export interface GetAccountResponse {
    balanceNQT: string;
    unconfirmedBalanceNQT: string;
    forgedBalanceNQT: string;
    guaranteedBalanceNQT: string;
    committedBalanceNQT?: string; // only when called with "getCommittedAmount: 'true'"
    account: string;
    accountRS: string;
    accountRSExtended: string;
    publicKey: string;
    name: string;
    description: string;
    isAT: boolean;
    isSecured: boolean;
    assetBalances?: AssetBalance[];
    unconfirmedAssetBalances?: UnconfirmedAssetBalance[];
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface GetBlockResponse {
    block: string;
    height: number;
    generator: string;
    generatorRS: string;
    generatorPublicKey: string;
    nonce: string;
    scoopNum: number;
    timestamp: number;
    numberOfTransactions: number;
    totalAmountNQT: string;
    totalFeeNQT: string;
    totalFeeCashBackNQT: string;
    totalFeeBurntNQT: string;
    blockRewardNQT: string;
    blockReward: number;
    payloadLength: number;
    version: number;
    baseTarget: string;
    averageCommitmentNQT: string;
    cumulativeDifficulty: string;
    previousBlock: string;
    nextBlock: string;
    payloadHash: string;
    generationSignature: string;
    previousBlockHash: string;
    blockSignature: string;
    transactions: string[];
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface GetAssetResponse {
    account: string;
    accountRS: string;
    issuer: string;
    issuerRS: string;
    publicKey: string;
    name: string;
    description: string;
    decimals: number;
    mintable: boolean;
    quantityQNT: string;
    quantityBurntQNT: string;
    asset: string;
    quantityCirculatingQNT: string;
    numberOfTrades: number;
    numberOfTransfers: number;
    numberOfAccounts: number;
    volumeQNT?: string;
    priceHigh?: string;
    priceLow?: string;
    priceOpen?: string;
    priceClose?: string;
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface GetAssetsByResponse {
    assets: GetAssetResponse[];
    requestProcessingTime?: number;
    nextIndex?: number;
    errorCode?: number;
    errorDescription?: string;
}
export type GetAssetsByNameResponse = GetAssetsByResponse
export type GetAssetsByIssuerResponse = GetAssetsByResponse

export interface Alias {
    account: string;
    accountRS: string;
    aliasName: string;
    timestamp: number;
    alias: string;
    aliasURI: string;
    tld: string;
    tldName: string;
    priceNQT?: string; // Optional, only if on sale.
    buyer?: string;    // Optional, only if direct sale to other account.
};

export interface GetAliasesResponse {
    aliases: Alias[];
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
};

export interface GetAccountPublicKey {
    publicKey?: string;
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
};
