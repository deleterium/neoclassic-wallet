// region BRS types

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
    automatic_node_selection: boolean,
    page_size: string,
    prefered_node: string,
    language: string,
    last_remembered_account: string
    rate_limiter: string
}

export type DecryptedTransactionFields = "encryptedMessage" | "encryptToSelfMessage"
export type DecryptedTransactionItem = {
    [key in DecryptedTransactionFields]?: string
}
export type DecryptedTransactionsCache = {
    [key: string]: DecryptedTransactionItem
}

export interface ShowBootstrapModalEvent extends JQuery.TriggeredEvent {
    relatedTarget: HTMLElement;
}

export type RequestType =
    "addAssetBookmark" |
    "addCommitment" |
    "addContact" |
    "assetExchangeChangeGroupName" |
    "assetExchangeGroup" |
    "broadcastTransaction" |
    "buyAlias" |
    "buyOrderAsset" |
    "cancelBuyOrder" |
    "cancelOrder" |
    "cancelSellOrder" |
    "clearData" |
    "decryptMessages" |
    "deleteContact" |
    "escrowSign" |
    "issueAsset" |
    "orderAsset" |
    "requestBurst" |
    "sellAlias" |
    "sellOrderAsset" |
    "sendMessage" |
    "sendMoney" |
    "sendMoneyEscrow" |
    "sendMoneyMulti" |
    "sendMoneySubscription" |
    "setAccountInfo" |
    "setAlias" |
    "setRewardRecipient" |
    "signMessage" |
    "subscriptionCancel" |
    "transferAsset" |
    "transferAssetMulti" |
    "updateContact" |
    "verifyMessage"

// region Database

export interface DBContact {
    name: string;
    email: string;
    account: string;
    accountRS: string;
    description: string;
}

export interface DBAsset extends AssetDetails {
    groupName: string;
    bookmarked: boolean;
}

// region Transaction

export interface Transaction {
    amountNQT: string;
    attachment?: any;
    attachmentBytes?: string;
    block: string;
    blockTimestamp: number;
    cashBackId: string;
    confirmations: number;
    deadline: number;
    ecBlockHeight: number;
    ecBlockId: string;
    feeNQT: string;
    fullHash: string;
    height: number;
    recipient?: string;
    recipientRS?: string;
    referencedTransactionFullHash?: string;
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

export const UNCONFIRMED_HEIGHT = 2147483647; // Java Integer.MAX_VALUE

export interface UnconfirmedTransaction {
    // No block, blockTimestamp nor confirmations
    amountNQT: string;
    attachment?: any;
    attachmentBytes?: string;
    cashBackId: string;
    deadline: number;
    ecBlockHeight: number;
    ecBlockId: string;
    feeNQT: string;
    fullHash: string;
    height: 2147483647; // Java Integer.MAX_VALUE
    recipient?: string;
    recipientRS?: string;
    referencedTransactionFullHash?: string;
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

export interface GetUnconfirmedTransactionsResponse {
    unconfirmedTransactions: UnconfirmedTransaction[];
    requestProcessingTime: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface GetTransactionResponse extends Transaction {
    requestProcessingTime: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface ParseTransactionResponse extends Transaction {
    verify: boolean;
    requestProcessingTime: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface GetIndirectIncomingResponse {
    amountNQT: string,
    quantityQNT: string,
    height: number,
    confirmations: number,
    requestProcessingTime: number
    errorCode?: number;
    errorDescription?: string;
}

export interface Subscription {
  id: string;
  sender: string;
  senderRS: string;
  recipient: string;
  recipientRS: string;
  amountNQT: string;
  frequency: number;
  timeNext: number;
  timestamp: number;
}

export interface GetSubscriptionResponse extends Subscription {
    requestProcessingTime: number
    errorCode?: number;
    errorDescription?: string;
}

// region Account

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

export interface GetAccountTransactionsResponse {
    transactions: Transaction[];
    nextIndex?: number;
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface GetAccountTransactionIdsResponse {
    transactionIds: string[];
    nextIndex?: number;
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface GetAccountPublicKeyResponse {
    publicKey?: string;
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
};

export interface GetAccountSubscriptionsResponse {
    subscriptions: Subscription[];
    requestProcessingTime: number;
    errorCode?: number;
    errorDescription?: string;

}

// region Blockchain

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

export interface GetBlochainStatusResponse extends BlockchainStatus {
    errorCode?: number;
    errorDescription?: string;
}

export interface SuggestFee {
    cheap: number;
    standard: number;
    priority: number;
    requestProcessingTime: number;
    errorCode?: number;
    errorDescription?: string;
}

// region Block

export interface BlockDetails {
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
    // if request had 'includeTransactions = true', type is Transaction[]
    // if 'includeTransactions = false' or not given, type is string[] with only the transactions IDs.
    transactions: string[] | Transaction[];
}

export interface GetBlockResponse extends BlockDetails {
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface GetBlocksResponse {
    blocks: BlockDetails[];
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
}
export type GetAccountBlocksResponse = GetBlocksResponse

// region Asset

export interface AssetDetails {
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
}

export interface MyAssetDetails extends AssetDetails {
    balanceQNT: string;
}

export interface GetAssetResponse extends AssetDetails {
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

export interface AssetTransfer {
    assetTransfer: string;
    asset: string;
    sender: string;
    senderRS: string;
    recipient: string;
    recipientRS: string;
    quantityQNT: string;
    height: number;
    timestamp: number;
    name: string;
    decimals: number;
}

export interface GetAssetTransfersResponse {
    transfers: AssetTransfer[];
    requestProcessingTime?: number;
    nextIndex?: number;
    errorCode?: number;
    errorDescription?: string;
}

interface AssetOrder {
    order: string;
    asset: string;
    account: string;
    accountRS: string;
    quantityQNT: string;
    priceNQT: string;
    height: number;
    name: string;
    decimals: number;
    price: string;
}

export interface AskAssetOrder extends AssetOrder {
    type: 'ask'
}

export interface BidAssetOrder extends AssetOrder {
    type: 'bid'
}

export interface AnyAssetOrder extends AssetOrder {
    type: 'ask' | 'bid'
}

export interface GetAskOrdersResponse {
    askOrders: AskAssetOrder[];
    nextIndex: number,
    errorCode?: number;
    errorDescription?: string;
}

export interface GetBidOrdersResponse {
    bidOrders: BidAssetOrder[];
    nextIndex: number,
    errorCode?: number;
    errorDescription?: string;
}

export interface Trade {
    timestamp: number;
    quantityQNT: string;
    priceNQT: string;
    asset: string;
    askOrder: string;
    bidOrder: string;
    askOrderHeight: number;
    seller: string;
    sellerRS: string;
    buyer: string;
    buyerRS: string;
    block: string;
    height: number;
    tradeType: "buy" | "sell";
    name: string;
    decimals: number;
    price: string;
}

export interface GetTradesResponse {
    trades: Trade[];
    nextIndex?: number,
    errorCode?: number;
    errorDescription?: string;
}

// region Alias

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

export interface GetAliasResponse extends Alias {
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
};

export interface GetAliasesResponse {
    aliases: Alias[];
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
};

// region AT

export interface AT {
  at: string;
  machineData: string;
  balanceNQT: string;
  prevBalanceNQT: string;
  nextBlock: number;
  frozen: boolean;
  running: boolean;
  stopped: boolean;
  finished: boolean;
  dead: boolean;
  machineCodeHashId: string;
  atVersion: number;
  atRS: string;
  name: string;
  description: string;
  creator: string;
  creatorRS: string;
  minActivation: string;
  creationBlock: number;
  machineCode?: string;
  creationMachineData?: string;
};

export interface GetAccountATsResponse {
    ats: AT[];
    requestProcessingTime?: number;
    errorCode?: number;
    errorDescription?: string;
};

// region Escrow

export interface Escrow {
    id: string;
    sender: string;
    senderRS: string;
    recipient: string;
    recipientRS: string;
    amountNQT: string;
    requiredSigners: number;
    deadline: number;
    deadlineAction: "release" | "refund" | "split";
    signers: Signer[];
}

interface Signer {
    id: string;
    idRS: string;
    decision: "undecided" | "release" | "refund" | "split";
}

export interface GetAccountEscrowTransactionsResponse {
    escrows: Escrow[];
    requestProcessingTime: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface GetEscrowTransactionResponse extends Escrow {
    requestProcessingTime: number;
    errorCode?: number;
    errorDescription?: string;
}

// region Server info

export interface GetStateResponse {
    application: string;
    version: string;
    time: number;
    lastBlock: string;
    cumulativeDifficulty: string;
    totalMinedNQT: number;
    totalBurntNQT: number;
    circulatingSupplyNQT: number;
    numberOfBlocks: number;
    numberOfTransactions: number;
    numberOfATs: number;
    numberOfAssets: number;
    numberOfOrders: number;
    numberOfAskOrders: number;
    numberOfBidOrders: number;
    numberOfTrades: number;
    numberOfTransfers: number;
    numberOfAliases: number;
    numberOfSubscriptions: number;
    numberOfSubscriptionPayments: number;
    numberOfPeers: number;
    numberOfUnlockedAccounts: number;
    lastBlockchainFeeder: string;
    lastBlockchainFeederHeight: number;
    isScanning: boolean;
    availableProcessors: number;
    maxMemory: number;
    totalMemory: number;
    freeMemory: number;
    indirectIncomingServiceEnabled: boolean;
    databaseTrimmingEnabled: boolean;
    requestProcessingTime: number;
}

export interface GetPeersResponse {
    peers: string[];
    requestProcessingTime: number;
}

export interface GetPeerResponse {
    state: number;
    announcedAddress: string;
    shareAddress: boolean;
    downloadedVolume: number;
    uploadedVolume: number;
    application: string;
    version: string;
    platform: string;
    networkName: string;
    blacklisted: boolean;
    lastUpdated: number;
    requestProcessingTime: number;
    errorCode?: number;
    errorDescription?: string;
}

// region POST Response

export interface PostResponse {
    broadcasted: boolean;
    unsignedTransactionBytes: string;
    transactionJSON: Transaction;
    transaction: string;
    fullHash?: string; // 
    requestProcessingTime: number;
    errorCode?: number;
    errorDescription?: string;
}

export interface AjaxResponse extends PostResponse {
    error: string
    errorMessage: string
}