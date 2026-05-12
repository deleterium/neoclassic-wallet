/**
 * @depends {brs.js}
 * @depends {brs.modals.js}
 */

import { BRS } from '.'

import {
    sendRequest
} from './brs.server'

import {
    calculatePercentage,
    formatQuantity,
    formatAmount,
    formatTimestamp,
    convertRSAccountToNumeric,
    getAccountTitle,
    getAccountFormatted,
    dataLoadFinished
} from './brs.util'

import {
    getTransactionDetails
} from './brs.transactions'
import { checkRecipient } from './brs.recipient'

export function showAccountModal (account) {
    if (BRS.fetchingModalData) {
        return
    }

    checkRecipient(account, $('#user_info_modal'))

    if (typeof account === 'object') {
        BRS.userInfoModal.user = account.account
        accountModalDataReady(account)
    } else {
        BRS.userInfoModal.user = account
        BRS.fetchingModalData = true
        sendRequest('getAccount', {
            account: BRS.userInfoModal.user
        }, function (response) {
            accountModalDataReady(response)
            BRS.fetchingModalData = false
        })
    }

    $('#user_info_modal_account').html(getAccountFormatted(BRS.userInfoModal.user))

    let accountButton
    if (BRS.userInfoModal.user in BRS.contacts) {
        accountButton = BRS.contacts[BRS.userInfoModal.user].name.escapeHTML()
        $('#user_info_modal_add_as_contact').hide()
    } else {
        accountButton = BRS.userInfoModal.user
        $('#user_info_modal_add_as_contact').show()
    }

    $('#user_info_modal_actions button').data('account', accountButton)
}

function accountModalDataReady (account) {
    if (account.unconfirmedBalanceNQT === '0') {
        $('#user_info_modal_account_balance').html('0')
    } else {
        $('#user_info_modal_account_balance').html(formatAmount(account.unconfirmedBalanceNQT) + ' ' + BRS.valueSuffix)
    }

    if (account.name) {
        $('#user_info_modal_account_name').html(String(account.name).escapeHTML())
        $('#user_info_modal_account_name_container').show()
    } else {
        $('#user_info_modal_account_name_container').hide()
    }

    if (account.description) {
        $('#user_info_description').show()
        $('#user_info_modal_description').html(String(account.description).escapeHTML().nl2br())
    } else {
        $('#user_info_description').hide()
    }

    $('#user_info_modal').modal('show')

    $('#user_info_modal_details_tab').tab('show')
    userInfoModalDetails()
}

export function evShowBsTab (e) {
    switch (e.target.id) {
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
        return userInfoModalDetails()
    }
}

function userInfoModalTransactions () {
    sendRequest('getAccountTransactions', {
        account: BRS.userInfoModal.user,
        firstIndex: 0,
        lastIndex: BRS.pageSize,
        includeIndirect: true
    }, function (response) {
        let rows = ''
        if (response.transactions && response.transactions.length) {
            for (const transaction of response.transactions) {
                const details = getTransactionDetails(transaction, BRS.userInfoModal.user)

                rows += '<tr>'
                rows += "<td><a href='#' data-transaction='" + String(transaction.transaction).escapeHTML() + "' data-timestamp='" + String(transaction.timestamp).escapeHTML() + "'>" + formatTimestamp(transaction.timestamp) + '</a></td>'
                rows += '<td>' + details.nameOfTransaction + '</td>'
                rows += '<td>' + details.circleText + '</td>'
                rows += `<td ${details.colorClass}>${details.amountToFromViewerHTML}</td>`
                rows += '<td>' + formatAmount(transaction.feeNQT) + '</td>'
                rows += `<td>${details.accountTitle}</td>`
                rows += '</tr>'
            }
        }
        $('#user_info_modal_transactions_table tbody').empty().append(rows)
        dataLoadFinished($('#user_info_modal_transactions_table'))
    })
}

function userInfoModalAliases () {
    sendRequest('getAliases', {
        account: BRS.userInfoModal.user,
        timestamp: 0
    }, function (response) {
        let rows = ''

        if (response.aliases && response.aliases.length) {
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

            // let alias_account_count = 0
            // let alias_uri_count = 0
            // let empty_alias_count = 0
            const alias_count = aliases.length

            for (let i = 0; i < alias_count; i++) {
                const alias = aliases[i]

                rows += "<tr data-alias='" + String(alias.aliasName).toLowerCase().escapeHTML() + "'><td class='alias'>" + String(alias.aliasName).escapeHTML() + "</td><td class='uri'>" + (alias.aliasURI.indexOf('http') === 0 ? "<a href='" + String(alias.aliasURI).escapeHTML() + "' target='_blank'>" + String(alias.aliasURI).escapeHTML() + '</a>' : String(alias.aliasURI).escapeHTML()) + '</td></tr>'
                // if (!alias.uri) {
                //     empty_alias_count++
                // } else if (alias.aliasURI.indexOf('http') === 0) {
                //     alias_uri_count++
                // } else if (alias.aliasURI.indexOf('acct:') === 0 || alias.aliasURI.indexOf('nacc:') === 0) {
                //     alias_account_count++
                // }
            }
        }

        $('#user_info_modal_aliases_table tbody').empty().append(rows)
        dataLoadFinished($('#user_info_modal_aliases_table'))
    })
}

function userInfoModalDetails () {
    sendRequest('getAccount', {
        account: BRS.userInfoModal.user,
        getCommittedAmount: 'true'
    }, function (response) {
        if (response.errorCode) {
            $('#user_info_modal_details_table tbody').empty()
            dataLoadFinished($('#user_info_modal_details_table'))
            return
        }
        if (!response.publicKey || /^0+$/.test(response.publicKey)) {
            response.publicKey = ''
        }
        let rows = ''
        rows += '<tr>'
        rows += `<td>${$.t('account_id')}</td><td>${response.account}</td>`
        rows += '</tr><tr>'
        if (response.name) {
            rows += `<td>${$.t('name')}</td><td>${response.name}</td>`
            rows += '</tr><tr>'
        }
        if (response.description) {
            rows += `<td>${$.t('description')}</td><td style="word-break:break-all;word-wrap: break-word;">${response.description.escapeHTML()}</td>`
            rows += '</tr><tr>'
        }
        rows += `<td>${$.t('total_balance')}</td><td>${formatAmount(response.balanceNQT)} ${BRS.valueSuffix}</td>`
        rows += '</tr><tr>'
        rows += `<td>${$.t('available_balance')}</td><td>${formatAmount(response.unconfirmedBalanceNQT)} ${BRS.valueSuffix}</td>`
        rows += '</tr><tr>'
        rows += `<td>${$.t('committed_balance')}</td><td>${formatAmount(response.committedBalanceNQT)} ${BRS.valueSuffix}</td>`
        rows += '</tr><tr>'
        if (response.accountRSExtended) {
            rows += `<td>${$.t('account_extended')}</td><td style="word-break:break-all;word-wrap: break-word;">${response.accountRSExtended}</td>`
            rows += '</tr><tr>'
        }
        rows += `<td>${$.t('public_key')}</td><td style="word-break:break-all;word-wrap: break-word;">${response.publicKey}</td>`
        rows += '</tr><tr>'

        rows += '</tr>'
        $('#user_info_modal_details_table tbody').html(rows)
        dataLoadFinished($('#user_info_modal_details_table'))
    })
}

function userInfoModalSmartcontract () {
    sendRequest('getAT', {
        at: convertRSAccountToNumeric(BRS.userInfoModal.user)
    }, function (response) {
        let rows = ''
        if (response.errorCode) {
            $('#user_info_modal_smartcontract_table tbody').empty()
            dataLoadFinished($('#user_info_modal_smartcontract_table'))
            return
        }
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
            'machineCode'
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
                codeHTML = formatAmount(response[row]) + ' ' + BRS.valueSuffix
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
                codeHTML = String(response[row]).escapeHTML()
            }
            rows += `<td style='word-break: break-word;'>${codeHTML}</td>`
            rows += '</tr>'
        }
        $('#user_info_modal_smartcontract_table tbody').html(rows)
        dataLoadFinished($('#user_info_modal_smartcontract_table'))
    })
}

function userInfoModalAssets () {
    sendRequest('getAccount', {
        account: BRS.userInfoModal.user
    }, function (response) {
        if (response.assetBalances && response.assetBalances.length) {
            const assets = {}
            let nrAssets = 0
            let ignoredAssets = 0

            for (let i = 0; i < response.assetBalances.length; i++) {
                if (response.assetBalances[i].balanceQNT === '0') {
                    ignoredAssets++

                    if (nrAssets + ignoredAssets === response.assetBalances.length) {
                        userInfoModalAddIssuedAssets(assets)
                    }
                    continue
                }

                sendRequest('getAsset', {
                    asset: response.assetBalances[i].asset,
                    _extra: {
                        balanceQNT: response.assetBalances[i].balanceQNT
                    }
                }, function (asset, input) {
                    asset.asset = input.asset
                    asset.balanceQNT = input._extra.balanceQNT

                    assets[asset.asset] = asset
                    nrAssets++

                    if (nrAssets + ignoredAssets === response.assetBalances.length) {
                        userInfoModalAddIssuedAssets(assets)
                    }
                })
            }
        } else {
            userInfoModalAddIssuedAssets({})
        }
    })
}

function userInfoModalAddIssuedAssets (assets) {
    sendRequest('getAssetsByIssuer', {
        account: BRS.userInfoModal.user
    }, function (response) {
        if (response.assets && response.assets.length) {
            $.each(response.assets, function (key, issuedAsset) {
                if (assets[issuedAsset.asset]) {
                    assets[issuedAsset.asset].issued = true
                } else {
                    issuedAsset.balanceQNT = '0'
                    issuedAsset.issued = true
                    assets[issuedAsset.asset] = issuedAsset
                }
            })

            userInfoModalAssetsLoaded(assets)
        } else if (!$.isEmptyObject(assets)) {
            userInfoModalAssetsLoaded(assets)
        } else {
            $('#user_info_modal_assets_table tbody').empty()
            dataLoadFinished($('#user_info_modal_assets_table'))
        }
    })
}

function userInfoModalAssetsLoaded (assets) {
    const assetArray = []
    let rows = ''

    $.each(assets, function (key, asset) {
        assetArray.push(asset)
    })

    assetArray.sort(function (a, b) {
        if (a.issued && b.issued) {
            if (a.name.toLowerCase() > b.name.toLowerCase()) {
                return 1
            } else if (a.name.toLowerCase() < b.name.toLowerCase()) {
                return -1
            } else {
                return 0
            }
        } else if (a.issued) {
            return -1
        } else if (b.issued) {
            return 1
        } else {
            if (a.name.toLowerCase() > b.name.toLowerCase()) {
                return 1
            } else if (a.name.toLowerCase() < b.name.toLowerCase()) {
                return -1
            } else {
                return 0
            }
        }
    })

    for (let i = 0; i < assetArray.length; i++) {
        const asset = assetArray[i]

        const percentageAsset = calculatePercentage(asset.balanceQNT, asset.quantityCirculatingQNT)

        rows += '<tr' + (asset.issued ? " class='asset_owner'" : '') + "><td><a href='#' data-goto-asset='" + String(asset.asset).escapeHTML() + "'" + (asset.issued ? " style='font-weight:bold'" : '') + '>' + String(asset.name).escapeHTML() + "</a></td><td class='quantity'>" + formatQuantity(asset.balanceQNT, asset.decimals) + '</td><td>' + formatQuantity(asset.quantityCirculatingQNT, asset.decimals) + '</td><td>' + percentageAsset + '%</td></tr>'
    }

    $('#user_info_modal_assets_table tbody').empty().append(rows)

    dataLoadFinished($('#user_info_modal_assets_table'))
}
