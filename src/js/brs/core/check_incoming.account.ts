import hashicon from 'hashicon'
import { BRS } from '..'
import { GetAccountResponse, AssetBalance, GetAssetResponse } from '../typings'
import { dbGet, dbPut } from './database'
import { formatQNTAsQuantity } from './numbers'
import { isErrorResponse, sendRequestA } from './send_request'
import { formatStyledAmount } from './util'
import { notify } from './notifications'

/**
 * Not only getAccountInfo, but checks and update coins and assets values. Called every new block was detected.
 * @param firstRun
 * @param callback
 */
export async function getAndUpdateAccountDetails(firstRun: boolean, callback?: () => void) {
    const response: GetAccountResponse = await sendRequestA('getAccount', {
        account: BRS.account,
        getCommittedAmount: 'true',
    })

    const previousAccountInfo = BRS.accountInfo
    BRS.accountInfo = response

    if (isErrorResponse(response)) {
        $('#account_balance, #account_committed_balance, #account_balance_sendmoney').html('0')
        $('#account_nr_assets').html('0')

        if (response.errorCode === 5) {
            if (BRS.downloadingBlockchain) {
                if (BRS.newlyCreatedAccount) {
                    $('#dashboard_message')
                        .addClass('alert-success')
                        .removeClass('alert-danger')
                        .html(
                            $.t('status_new_account', {
                                account_id: BRS.accountRS,
                                public_key: BRS.publicKey,
                            }) +
                                '<br /><br />' +
                                $.t('status_blockchain_downloading'),
                        )
                        .show()
                } else {
                    $('#dashboard_message')
                        .addClass('alert-success')
                        .removeClass('alert-danger')
                        .html($.t('status_blockchain_downloading'))
                        .show()
                }
            } else if (BRS.rescaningBlockchain) {
                $('#dashboard_message')
                    .addClass('alert-danger')
                    .removeClass('alert-success')
                    .html($.t('status_blockchain_rescanning'))
                    .show()
            } else {
                $('#dashboard_message')
                    .addClass('alert-success')
                    .removeClass('alert-danger')
                    .html(
                        $.t('status_new_account', {
                            account_id: BRS.accountRS,
                            public_key: BRS.publicKey,
                        }),
                    )
                    .show()
            }
        } else {
            $('#dashboard_message').addClass('alert-danger').removeClass('alert-success').text(response.errorDescription).show()
        }
    } else {
        if (BRS.accountRS && BRS.accountInfo.accountRS !== BRS.accountRS) {
            notify('Generated Reed Solomon address different from the one in the blockchain!', { type: 'danger' })
            BRS.accountRS = BRS.accountInfo.accountRS
        }

        if (BRS.downloadingBlockchain) {
            $('#dashboard_message').addClass('alert-success').removeClass('alert-danger').html($.t('status_blockchain_downloading')).show()
        } else if (BRS.rescaningBlockchain) {
            $('#dashboard_message').addClass('alert-danger').removeClass('alert-success').html($.t('status_blockchain_rescanning')).show()
        } else if (!BRS.accountInfo.publicKey) {
            $('#dashboard_message')
                .addClass('alert-danger')
                .removeClass('alert-success')
                .html($.t('no_public_key_warning') + ' ' + $.t('public_key_actions'))
                .show()
        } else {
            $('#dashboard_message').hide()
        }

        // only show if happened within last week
        const showAssetDifference =
            !BRS.downloadingBlockchain ||
            (BRS.blocks.length > 0 && BRS.blockchainStatus && BRS.blockchainStatus.time - BRS.blocks[0].timestamp < 60 * 60 * 24 * 7)

        if (BRS.databaseSupport) {
            dbGet(
                'data',
                {
                    id: 'asset_balances_' + BRS.account,
                },
                function (_error, asset_balance) {
                    if (asset_balance) {
                        let previous_balances = asset_balance.contents

                        if (!BRS.accountInfo.assetBalances) {
                            BRS.accountInfo.assetBalances = []
                        }

                        const current_balances = JSON.stringify(BRS.accountInfo.assetBalances)

                        if (previous_balances !== current_balances) {
                            if (previous_balances !== 'undefined' && typeof previous_balances !== 'undefined') {
                                previous_balances = JSON.parse(previous_balances)
                            } else {
                                previous_balances = []
                            }
                            dbPut('data', {
                                id: 'asset_balances_' + BRS.account,
                                contents: current_balances,
                            })
                            if (showAssetDifference) {
                                checkAssetDifferences(BRS.accountInfo.assetBalances, previous_balances)
                            }
                        }
                    } else {
                        dbPut('data', {
                            id: 'asset_balances_' + BRS.account,
                            contents: JSON.stringify(BRS.accountInfo.assetBalances),
                        })
                    }
                },
            )
        } else if (showAssetDifference && previousAccountInfo && previousAccountInfo.assetBalances) {
            const previousBalances = JSON.stringify(previousAccountInfo.assetBalances)
            const currentBalances = JSON.stringify(BRS.accountInfo.assetBalances)

            if (previousBalances !== currentBalances) {
                checkAssetDifferences(BRS.accountInfo.assetBalances || [], previousAccountInfo.assetBalances)
            }
        }

        $('#account_balance, #account_balance_sendmoney').html(formatStyledAmount(response.unconfirmedBalanceNQT))
        $('#account_balance_locked, #account_balance_sendmoney').html(
            formatStyledAmount((BigInt(response.balanceNQT) - BigInt(response.unconfirmedBalanceNQT)).toString(10)),
        )
        $('#account_committed_balance, #account_balance_sendmoney').html(formatStyledAmount(response.committedBalanceNQT || ''))

        let nr_assets = 0

        if (response.assetBalances) {
            for (let i = 0; i < response.assetBalances.length; i++) {
                if (response.assetBalances[i].balanceQNT !== '0') {
                    nr_assets++
                }
            }
        }

        $('#account_nr_assets').html(nr_assets.toString())

        if (response.name) {
            $('#account_name').text(response.name).removeAttr('data-i18n')
        }
    }

    if (firstRun) {
        $('#account_avatar').attr('src', hashicon(BRS.account, { size: 40 }).toDataURL())
        $('#account_balance, #account_committed_balance, #account_nr_assets, #account_balance_sendmoney').removeClass('loading_dots')
    }

    if (callback) {
        callback()
    }
}

async function checkAssetDifferences(current_balances: AssetBalance[], previous_balances: AssetBalance[]) {
    const current_balances_ = {}
    const previous_balances_ = {}

    if (previous_balances.length) {
        for (const k in previous_balances) {
            previous_balances_[previous_balances[k].asset] = previous_balances[k].balanceQNT
        }
    }

    if (current_balances.length) {
        for (const k in current_balances) {
            current_balances_[current_balances[k].asset] = current_balances[k].balanceQNT
        }
    }

    const diff = {}

    for (const k in previous_balances_) {
        if (!(k in current_balances_)) {
            diff[k] = '-' + previous_balances_[k]
        } else if (previous_balances_[k] !== current_balances_[k]) {
            const change = (BigInt(current_balances_[k]) - BigInt(previous_balances_[k])).toString(10)
            diff[k] = change
        }
    }

    for (const k in current_balances_) {
        if (!(k in previous_balances_)) {
            diff[k] = current_balances_[k] // property is new
        }
    }

    const nr = Object.keys(diff).length

    if (nr === 0) {
        return
    }
    if (nr <= 3) {
        for (const k in diff) {
            const asset: GetAssetResponse = await sendRequestA('getAsset', { asset: k })

            if (asset.errorCode) {
                return
            }
            let difference = diff[k]
            let quantity: string
            if (difference.charAt(0) !== '-') {
                quantity = formatQNTAsQuantity(difference, asset.decimals)

                if (quantity !== '0') {
                    notify(
                        $.t('you_received_assets', {
                            asset: asset.asset,
                            name: asset.name,
                            count: quantity,
                        }),
                        { type: 'success' },
                    )
                }
            } else {
                difference = difference.substring(1)

                quantity = formatQNTAsQuantity(difference, asset.decimals)

                if (quantity !== '0') {
                    notify(
                        $.t('you_sold_assets', {
                            asset: asset.asset,
                            name: asset.name,
                            count: quantity,
                        }),
                        { type: 'success' },
                    )
                }
            }
        }
        return
    }
    notify($.t('multiple_assets_differences'), { type: 'success' })
}
