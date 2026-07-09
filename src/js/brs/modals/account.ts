import { BRS } from '..'

import { sendRequestA } from '../core/send_request'

import { calculatePercentage, formatQNTAsQuantity, formatNQTAsAmount, formatTimestampAsDateTime } from '../core/numbers'

import { convertRSAccountToNumeric, getAccountTitle, dataLoadFinished } from '../core/util'

import { getTransactionDetails } from '../tools/transactions'

import { NxtAddress } from '../../util/nxtaddress'

import {
    GetAccountResponse,
    GetAccountTransactionsResponse,
    GetAliasesResponse,
    GetAssetResponse,
    GetAssetsByIssuerResponse,
} from '../typings'

import { cacheAsset, getAssetDetails } from '../tools/assets'
import { notify } from '../core/notifications'

/** Start the process of showing an "Account Modal".
 * @param {string|GetAccountResponse} account - Account to be shown.
 * @description Note that if account is a string, request 'getAccount' and draw.
 * If it is an object, it must be an 'getAccount' response with option 'getCommitment: true'.
 */
export async function showAccountModal(account: string | GetAccountResponse) {
    if (BRS.fetchingModalData) {
        return
    }

    let userAccount = ''
    if (typeof account === 'object') {
        BRS.userInfoModal = {
            modalAccount: account,
            assetsDetails: [],
            issuedAssets: [],
        }
        accountModalDataReady()
        userAccount = account.account
    } else {
        userAccount = account
        BRS.fetchingModalData = true
        const response: GetAccountResponse = await sendRequestA('getAccount', {
            account: userAccount,
            getCommittedAmount: 'true',
        })
        BRS.fetchingModalData = false
        if (response.errorCode) {
            notify($.t('error_account_id'))
            return
        }
        BRS.userInfoModal = {
            modalAccount: response,
            assetsDetails: [],
            issuedAssets: [],
        }
        accountModalDataReady()
    }

    let accountNameOrRs: string
    const accountRS = new NxtAddress(userAccount).getAccountRS(BRS.prefix)

    // Update "actions" tab
    if (accountRS in BRS.contacts) {
        accountNameOrRs = BRS.contacts[accountRS].name.escapeHTML()
        $('#user_info_modal_add_as_contact').hide()
    } else {
        accountNameOrRs = accountRS
        $('#user_info_modal_add_as_contact').show()
    }
    $('#user_info_modal_actions button').data('account', accountNameOrRs)

    // Update modal title
    $('#user_info_modal_account').html(accountNameOrRs)
}

/**
 * Second part starting to show the "Account Modal", when all info about the account is available at BRS.userInfoModal.account.
 * It draws the "Details" tab.
 */
function accountModalDataReady() {
    if (!BRS.userInfoModal) return
    const accountInfo = BRS.userInfoModal.modalAccount
    if (accountInfo.unconfirmedBalanceNQT === '0') {
        $('#user_info_modal_account_balance').html('0')
    } else {
        $('#user_info_modal_account_balance').html(formatNQTAsAmount(accountInfo.unconfirmedBalanceNQT) + ' ' + BRS.valueSuffix)
    }
    if (accountInfo.name) {
        $('#user_info_modal_account_name').text(accountInfo.name)
        $('#user_info_modal_account_name_container').show()
    } else {
        $('#user_info_modal_account_name_container').hide()
    }
    if (accountInfo.description) {
        $('#user_info_description').show()
        $('#user_info_modal_description').html(accountInfo.description.nl2br())
    } else {
        $('#user_info_description').hide()
    }
    $('#user_info_modal').modal('show')
    $('#user_info_modal_details_tab').tab('show')
    userInfoModalDetails()
}

/**
 * Handles the tab switching in "Account Modal"
 */
export function evShowBsTab(e) {
    switch ((e.target as HTMLElement).id) {
        case 'user_info_modal_transactions_tab':
            return userInfoModalTransactions()
        case 'user_info_modal_assets_tab':
            return userInfoModalAssets()
        case 'user_info_modal_details_tab':
            return
        case 'user_info_modal_smartcontract_tab':
            return userInfoModalSmartcontract()
        case 'user_info_modal_aliases_tab':
            return userInfoModalAliases()
        case 'user_info_modal_vcard_tab':
            // TODO
            return
        case 'user_info_modal_actions_tab':
            // Already done 'on show modal'
            return
    }
}

async function userInfoModalTransactions() {
    if (!BRS.userInfoModal) return
    const response: GetAccountTransactionsResponse = await sendRequestA('getAccountTransactions', {
        account: BRS.userInfoModal.modalAccount.account,
        firstIndex: 0,
        lastIndex: BRS.pageSize,
        includeIndirect: true,
    })
    if (!BRS.userInfoModal) return
    let rows = ''
    if (!response.transactions || response.transactions.length === 0) {
        $('#user_info_modal_transactions_table tbody').empty().append(rows)
        dataLoadFinished($('#user_info_modal_transactions_table'))
        return
    }
    for (const transaction of response.transactions) {
        const details = getTransactionDetails(transaction, BRS.userInfoModal.modalAccount.account)
        rows += `
                <tr>
                  <td>
                    <a href='#'
                        data-transaction='${transaction.transaction}'
                        data-timestamp='${transaction.timestamp}'
                    >
                    ${formatTimestampAsDateTime(transaction.timestamp)}
                    </a>
                  </td>
                  <td>${details.nameOfTransaction}</td>
                  <td>${details.circleText}</td>
                  <td ${details.colorClass}>${details.amountToFromViewerHTML}</td>
                  <td>${formatNQTAsAmount(transaction.feeNQT)}</td>
                  <td>${details.accountTitle}</td>
                </tr>`
    }
    $('#user_info_modal_transactions_table tbody').empty().append(rows)
    dataLoadFinished($('#user_info_modal_transactions_table'))
}

async function userInfoModalAliases() {
    if (!BRS.userInfoModal) return
    const response: GetAliasesResponse = await sendRequestA('getAliases', {
        account: BRS.userInfoModal.modalAccount.account,
        timestamp: 0,
    })
    if (!response.aliases || response.aliases.length === 0) {
        $('#user_info_modal_aliases_table tbody').empty()
        dataLoadFinished($('#user_info_modal_aliases_table'))
        return
    }
    let rows = ''
    const aliases = response.aliases
    aliases.sort(function (a, b) {
        if (a.aliasName.toLowerCase() > b.aliasName.toLowerCase()) {
            return 1
        } else if (a.aliasName.toLowerCase() < b.aliasName.toLowerCase()) {
            return -1
        } else {
            return 0
        }
    })
    for (let i = 0; i < aliases.length; i++) {
        const alias = aliases[i]
        const aliasName = alias.aliasName
        const tldName = alias.aliasName
        const aliasURI = alias.aliasURI
        rows += `
            <tr>
              <td><a href="#" data-alias="${alias.alias}">${aliasName}</a></td>
              <td>${tldName}</td>
              <td>${aliasURI}</td>
            </tr>`
    }
    $('#user_info_modal_aliases_table tbody').empty().append(rows)
    dataLoadFinished($('#user_info_modal_aliases_table'))
}

/**
 * Third part of "Account Modal" when all info about is available.
 */
function userInfoModalDetails() {
    if (!BRS.userInfoModal) return
    const accountInfo = BRS.userInfoModal.modalAccount
    const publicKey = accountInfo.publicKey || ''
    let tbodyHTML = ''
    tbodyHTML += `
            <tr>
              <td>${$.t('account_id')}</td>
              <td>${accountInfo.account}</td>
            </tr>`
    if (accountInfo.name) {
        tbodyHTML += `
            <tr>
              <td>${$.t('name')}</td>
              <td>${accountInfo.name}</td>
            </tr>`
    }
    if (accountInfo.description) {
        tbodyHTML += `
            <tr>
              <td>${$.t('description')}</td>
              <td style="word-break:break-all;word-wrap: break-word;">${accountInfo.description}</td>
            </tr>`
    }
    tbodyHTML += `
            <tr>
              <td>${$.t('total_balance')}</td>
              <td>${formatNQTAsAmount(accountInfo.balanceNQT)} ${BRS.valueSuffix}</td>
            </tr>
            <tr>
              <td>${$.t('available_balance')}</td>
              <td>${formatNQTAsAmount(accountInfo.unconfirmedBalanceNQT)} ${BRS.valueSuffix}</td>
            </tr>`
    if (accountInfo.committedBalanceNQT) {
        tbodyHTML += `
            <tr>
              <td>${$.t('committed_balance')}</td>
              <td>${formatNQTAsAmount(accountInfo.committedBalanceNQT)} ${BRS.valueSuffix}</td>
            </tr>`
    }
    tbodyHTML += `
            <tr>
              <td>${$.t('forged_balance')}</td>
              <td>${formatNQTAsAmount(accountInfo.forgedBalanceNQT)} ${BRS.valueSuffix}</td>
            </tr>`
    if (accountInfo.accountRSExtended) {
        tbodyHTML += `
            <tr>
              <td>${$.t('account_extended')}</td>
              <td style="word-break:break-all;word-wrap: break-word;">${accountInfo.accountRSExtended}</td>
            </tr>`
    }
    tbodyHTML += `
            <tr>
                <td>${$.t('public_key')}</td>
                <td style="word-break:break-all;word-wrap: break-word;">${publicKey}</td>
            </tr>`
    $('#user_info_modal_details_table tbody').html(tbodyHTML)
    dataLoadFinished($('#user_info_modal_details_table'))
}

async function userInfoModalSmartcontract() {
    if (!BRS.userInfoModal) return
    const response = await sendRequestA('getAT', {
        at: convertRSAccountToNumeric(BRS.userInfoModal.modalAccount.account),
    })
    if (response.errorCode) {
        $('#user_info_modal_smartcontract_table tbody').empty()
        dataLoadFinished($('#user_info_modal_smartcontract_table'))
        return
    }
    let rows = ''
    const props = [
        'name',
        'description',
        'creatorRS',
        'minActivation',
        'machineCodeHashId',
        'status',
        'atVersion',
        'creationBlock',
        'machineData',
        'machineCode',
    ]
    for (const row of props) {
        const key = row.replace(/\s+/g, '').replace(/([A-Z])/g, function ($1) {
            return '_' + $1.toLowerCase()
        })
        rows += '<tr>'
        rows += `<td>${$.t(key)}</td>`
        let codeHTML = ''
        switch (row) {
            case 'minActivation':
                codeHTML = formatNQTAsAmount(response[row]) + ' ' + BRS.valueSuffix
                break
            case 'creatorRS':
                codeHTML = getAccountTitle(response[row])
                break
            case 'machineCode':
                codeHTML = response[row].replace(/0+$/, '')
                break
            case 'status':
                for (const val of ['running', 'stopped', 'finished', 'frozen', 'dead']) {
                    if (response[val] === true) {
                        codeHTML += (codeHTML === '' ? '' : ' + ') + $.t(val)
                    }
                }
                break
            default:
                codeHTML = response[row]
        }
        rows += `<td style='word-break: break-word;'>${codeHTML}</td>`
        rows += '</tr>'
    }
    $('#user_info_modal_smartcontract_table tbody').html(rows)
    dataLoadFinished($('#user_info_modal_smartcontract_table'))
}

async function userInfoModalAssets() {
    if (!BRS.userInfoModal) return
    const accountInfo = BRS.userInfoModal.modalAccount

    // Ensures all assets issued by the account are cached.
    const response: GetAssetsByIssuerResponse = await sendRequestA('getAssetsByIssuer', {
        account: accountInfo.account,
    })
    if (response.assets && response.assets.length) {
        for (const issuedAsset of response.assets) {
            cacheAsset(issuedAsset)
        }
    }

    if (!accountInfo.assetBalances) {
        userInfoModalAssetsLoaded()
        return
    }
    const assetDetailsPromises = accountInfo.assetBalances
        .filter((currAssetBalance) => currAssetBalance.balanceQNT !== '0')
        .map((currAssetBalance) => getAssetDetails(currAssetBalance.asset))

    await Promise.all(assetDetailsPromises)
    userInfoModalAssetsLoaded()
}

interface CombinedAsset extends GetAssetResponse {
    balanceQNT: string
}

// All assets are cached and ready to be displayed in 'assets' tab.
function userInfoModalAssetsLoaded() {
    if (!BRS.userInfoModal) {
        return
    }

    const accountInfo = BRS.userInfoModal.modalAccount
    const assetBalances = accountInfo.assetBalances || []
    const currentAccount = accountInfo.account

    // Combine asset balances and issued assets, avoiding duplicates
    const combinedAssets: CombinedAsset[] = []

    // Add assets with balance (non-zero)
    for (const balance of assetBalances) {
        if (balance.balanceQNT === '0') {
            continue
        }
        const cachedAsset = BRS.assets.find((asset) => asset.asset === balance.asset)
        if (cachedAsset) {
            combinedAssets.push({
                ...cachedAsset,
                balanceQNT: balance.balanceQNT,
            })
        }
    }

    // Add issued assets (only those not already included due to balance)
    for (const cachedAsset of BRS.assets) {
        if (cachedAsset.account !== currentAccount) {
            continue
        }
        const isAlreadyIncluded = combinedAssets.some((asset) => asset.asset === cachedAsset.asset)
        if (!isAlreadyIncluded) {
            combinedAssets.push({
                ...cachedAsset,
                balanceQNT: '0',
            })
        }
    }

    // Sort the assets (issued first, then alphabetically)
    combinedAssets.sort((a, b) => {
        const aIsIssued = a.account === currentAccount
        const bIsIssued = b.account === currentAccount

        if (aIsIssued && !bIsIssued) return -1
        if (!aIsIssued && bIsIssued) return 1

        return a.name.localeCompare(b.name)
    })

    // Generate HTML rows
    let rows = ''
    for (const asset of combinedAssets) {
        const percentageAsset = calculatePercentage(asset.balanceQNT, asset.quantityCirculatingQNT)
        const isIssued = asset.account === currentAccount
        const assetName = asset.name
        const assetId = asset.asset

        rows += `
            <tr>
              <td>
                <a href='#'
                   data-goto-asset='${assetId}'
                   ${isIssued ? " style='font-weight:bold'" : ''}>
                   ${assetName}
                </a>
              </td>
              <td class='quantity'>${formatQNTAsQuantity(asset.balanceQNT, asset.decimals)}</td>
              <td>${formatQNTAsQuantity(asset.quantityCirculatingQNT, asset.decimals)}</td>
              <td>${percentageAsset}%</td>
            </tr>`
    }

    $('#user_info_modal_assets_table tbody').empty().append(rows)
    dataLoadFinished($('#user_info_modal_assets_table'))
}
