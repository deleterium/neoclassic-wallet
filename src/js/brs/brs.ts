/**
 * @depends {3rdparty/bootstrap.min.js}
 * @depends {3rdparty/notify.min.js}
 */

import {
    AssetBalance,
    GetAccountResponse,
    GetBlochainStatusResponse,
    SuggestFee
} from '../typings'

import hashicon from 'hashicon'

import {
    loadSettingsFromDB
} from './brs.settings.page'

import {
    sendRequest
} from './brs.sendRequest'

import {
    showLockscreen
} from './brs.login'

import { formatNQTAsAmount, formatQNTAsQuantity } from './brs.numbers'

import {
    formatStyledAmount
} from './brs.util'

import {
    loadClosedGroupsFromDB,
    loadAssetsFromDB,
} from './brs.asset.tools'

import {
    goToAsset
} from './brs.asset.page.assetexchange'

import {
    automaticallyCheckRecipient
} from './brs.recipient'

import {
    createDatabase,
    dbGet,
    dbPut
} from './brs.database'

import { loadContactsFromDB } from './brs.contacts.tools'

import { BRS } from '.'

function loadAllDBValues () {
    loadContactsFromDB()
    loadClosedGroupsFromDB()
    loadAssetsFromDB()
    loadSettingsFromDB()
}

export function init () : void {
    try {
        window.localStorage.setItem('test', '1')
        window.localStorage.removeItem('test')
        BRS.hasLocalStorage = true
    } catch {
        BRS.hasLocalStorage = false
    }

    $('#neoclassic_version').html(BRS.version)

    // Default location for notify message (set once)
    $.notifyDefaults({
        placement: { from: 'bottom', align: 'right' },
        offset: 10
    })

    // Browser support required
    if (!window.crypto || !window.crypto.subtle) {
        $.notify($.t('error_encryption_browser_support'))
        return
    }

    createDatabase(loadAllDBValues)

    // Give some more time to loading settings
    setTimeout(function () {
        if (BRS.settings.automatic_node_selection) {
            autoSelectServer()
        } else {
            // use user saved choice
            getState()
        }
        showLockscreen()
    }, 250)

    automaticallyCheckRecipient()
}

/**
 * Checks prefered node string in login panel. If changed, update BRS with blockchain details.
 */
export function checkSelectedNode () : void {
    const preferedNode = $('#prefered_node').val() as string
    if (preferedNode !== BRS.server) {
        // Update Variables
        BRS.server = preferedNode
        BRS.currentPage = 'lockscreen'
        BRS.currentSubPage = preferedNode
        BRS.blocks = []
        BRS.blockchainStatus = undefined

        $('#node_alert').show()
        $('#node_alert').html(BRS.server)
        $('#brs_version, #brs_version_dashboard').html(BRS.loadingDotsHTML).addClass('loading_dots')
        $('#prefered_node').addClass('is-invalid')

        // Server changed, get new network details
        sendRequest('getConstants+', {}, function (response) {
            if (response.errorCode) {
                return
            }
            if (response.networkName.includes('TESTNET')) {
                BRS.isTestNet = true
                $('.testnet_only, #testnet_login, #testnet_warning').show()
                $('.testnet_only').show()
            } else {
                BRS.isTestNet = false
                $('.testnet_only, #testnet_login, #testnet_warning').hide()
                $('.testnet_only').hide()
            }
            BRS.prefix = response.addressPrefix + '-'
            BRS.valueSuffix = response.valueSuffix
        })
    }
}

export function autoSelectServer () : void {
    $('#node_alert').show()
    $('#node_alert').html($.t('trying_auto_connection'))
    $('#brs_version, #brs_version_dashboard').html(BRS.loadingDotsHTML).addClass('loading_dots')
    // shuffleArray but keep localhost as first one
    const mainnetServers = BRS.nodes.filter(obj => obj.testnet === false).slice(1)
    for (let i = mainnetServers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mainnetServers[i], mainnetServers[j]] = [mainnetServers[j], mainnetServers[i]]
    }
    mainnetServers.unshift(BRS.nodes[0])
    const responses: [string, string, number][] = []
    setTimeout(() => {
        // choose winner
        responses.sort((a, b) => b[2] - a[2])
        $('#prefered_node').val(responses[0][0])
        getState()
    }, 2100)
    for (const server of mainnetServers) {
        $.ajax({
            url: `${server.address}/burst?requestType=getBlock`,
            crossDomain: true,
            dataType: 'json',
            type: 'GET',
            timeout: 2000,
            async: true
        }).done(function (response, status) {
            if (status === 'success' && response.errorCode === undefined) {
                const fasterResponse = responses.find(row => row[1] === response.block)
                if (fasterResponse) {
                    fasterResponse[2] = fasterResponse[2] + 1
                    return
                }
                responses.push([server.address, response.block, 1])
            }
        })
    }
}

export function secondsToDuration(durationInSeconds: number) {
    const days = Math.floor(durationInSeconds / (24 * 60 * 60))
    const remainingSecondsAfterDays = durationInSeconds % (24 * 60 * 60)

    // Calculate hours
    const hours = Math.floor(remainingSecondsAfterDays / (60 * 60))
    const remainingSecondsAfterHours = remainingSecondsAfterDays % (60 * 60)

    // Calculate minutes and seconds
    const minutes = Math.floor(remainingSecondsAfterHours / 60)
    const seconds = remainingSecondsAfterHours % 60

    return  {
        days: days,
        hours: hours,
        minutes: minutes,
        seconds: seconds,
    }
}

export function setHeaderClock () : void {
    if (!BRS.durationFormatter || !BRS.blockchainStatus?.lastBlockTimestamp) {
        return
    }
    const lastBlockDate = new Date((BRS.genesisSeconds + BRS.blockchainStatus.lastBlockTimestamp) * 1000)
    const diffSeconds = Math.floor((Date.now() - lastBlockDate.getTime()) / 1000)

    const duration = secondsToDuration(diffSeconds)

    // Simplify display.
    if (duration.days > 7) {
        duration.hours = duration.minutes = duration.seconds = 0
    } else if (duration.days > 0) {
        duration.minutes = duration.seconds = 0
    } else if (duration.hours > 0) {
        duration.seconds = 0
    }
    $('#header_block_time').text(BRS.durationFormatter.format(duration))
}

/**
 * Runs in lockscreen, while not logged. 
 * @param callback 
 */
export function getState () : void {
    checkSelectedNode()
    sendRequest('getBlockchainStatus+', {}, function (response: GetBlochainStatusResponse) {
        if (response.errorCode) {
            if (BRS.settings.automatic_node_selection) {
                autoSelectServer()
                return
            }
            $('#node_alert').show()
            $('#node_alert').html($.t('could_not_connect_to', { server: BRS.server }))
            $('#brs_version, #brs_version_dashboard').html(BRS.loadingDotsHTML).removeClass('loading_dots')
            $('#prefered_node').addClass('is-invalid')
            return
        }
        $('#node_alert').hide()
        BRS.blockchainStatus = response
        $('#brs_version').html(response.version + ' on ' + BRS.server).removeClass('loading_dots')
        $('#brs_version_dashboard').html(response.version).removeClass('loading_dots')
        $('#header_current_block').html('#' + response.numberOfBlocks)
        $('#prefered_node').removeClass('is-invalid')
    })
}

/**
 * Handles clicks in sidebar, changing current page if needed
 */
export function evSidebarClick (e: JQuery.ClickEvent) : void {
    e.preventDefault()
    if ($(e.currentTarget).data('toggle') === 'modal') {
        return
    }
    const page = $(e.currentTarget).data('page')
    if (page === 'keep' || page === BRS.currentPage) {
        return
    }
    $('.page').hide()
    $('#' + page + '_page').show()
    $('#sidebar .active').removeClass('active')
    $(e.currentTarget).addClass('active')
    loadPage(page)
}

/** Load a page for first time (setting up global variables) */
function loadPage (page: string) : void {
    BRS.currentPage = page
    BRS.currentSubPage = ''
    BRS.pageNumber = 1
    BRS.showPageNumbers = false
    if (BRS.pages[page]) {
        pageLoading()
        BRS.pages[page]()
    }
}

/** Reload current page, keeping variables like pagination */
export function reloadCurrentPage () : void {
    if (!BRS.pages[BRS.currentPage]) {
        console.log('Possible bug on reloadCurrentPage.')
        return
    }
    pageLoading()
    BRS.pages[BRS.currentPage]()
}

/** Go to a page, updating sidebar menu */
export function goToPage (page: string) : void {
    let $link = $('[data-widget="treeview"] a[data-page=' + page + ']')

    if ($link.length > 1) {
        // if there are many pages in menubar
        if ($link.last().is(':visible')) {
            // Select last one if it is visible
            $link = $link.last()
        } else {
            $link = $link.first()
        }
    }
    if ($link.length === 1) {
        // handle pages that are in sidebar simulating a click
        $link.trigger('click')
        return
    }
    // Handle hidden pages like "search_results"
    $('[data-widget="treeview"] a.active').removeClass('active')
    $('.page').hide()
    $('#' + page + '_page').show()
    loadPage(page)
}

export function pageLoading () : void {
    BRS.hasMorePages = false
    const $pageHeader = $('#' + BRS.currentPage + '_page .content-header h1')
    $pageHeader.find('.loading_dots').remove()
    $pageHeader.append("<span class='loading_dots'>" + BRS.loadingDotsHTML + '</span>')
    const $pageContainer = $('#' + BRS.currentPage + '_page .data-container')
    if (BRS.currentSubPage === '') {
        // Only redraw entire page if there is no subpage.
        $pageContainer.addClass('data-loading')
    }
}

export function pageLoaded (callback?: () => void) {
    const $currentPage = $('#' + BRS.currentPage + '_page')
    $currentPage.find('.content-header h1 .loading_dots').remove()
    if ($currentPage.hasClass('paginated')) {
        addPagination()
    }
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    })
    if (callback) {
        callback()
    }
}

export function addPagination () : void {
    let output = ''

    if (BRS.pageNumber === 2) {
        output += "<a href='#' data-page='1'>&laquo; " + $.t('previous_page') + '</a>'
    } else if (BRS.pageNumber > 2) {
        // output += "<a href='#' data-page='1'>&laquo; First Page</a>";
        output += " <a href='#' data-page='" + (BRS.pageNumber - 1) + "'>&laquo; " + $.t('previous_page') + '</a>'
    }
    if (BRS.hasMorePages) {
        if (BRS.pageNumber > 1) {
            output += '&nbsp;&nbsp;&nbsp;'
        }
        output += " <a href='#' data-page='" + (BRS.pageNumber + 1) + "'>" + $.t('next_page') + ' &raquo;</a>'
    }

    const $paginationContainer = $('#' + BRS.currentPage + '_page .data-pagination')

    if ($paginationContainer.length) {
        $paginationContainer.html(output)
    }
}

export function goToPageNumber (pageNumber: number) {
    BRS.pageNumber = pageNumber
    pageLoading()
    BRS.pages[BRS.currentPage]()
}

/**
 * Not only getAccountInfo, but checks and update coins and assets values. Called every new block was detected.
 * @param firstRun 
 * @param callback 
 */
export function getAccountInfo (firstRun: boolean, callback?: () => void) {
    sendRequest('getAccount', {
        account: BRS.account,
        getCommittedAmount: 'true'
    }, function (response: GetAccountResponse) {
        const previousAccountInfo = BRS.accountInfo

        BRS.accountInfo = response

        if (response.errorCode) {
            $('#account_balance, #account_committed_balance, #account_balance_sendmoney').html('0')
            $('#account_nr_assets').html('0')

            if (response.errorCode === 5) {
                if (BRS.downloadingBlockchain) {
                    if (BRS.newlyCreatedAccount) {
                        $('#dashboard_message').addClass('alert-success').removeClass('alert-danger').html($.t('status_new_account', {
                            account_id: String(BRS.accountRS).escapeHTML(),
                            public_key: String(BRS.publicKey).escapeHTML()
                        }) + '<br /><br />' + $.t('status_blockchain_downloading')).show()
                    } else {
                        $('#dashboard_message').addClass('alert-success').removeClass('alert-danger').html($.t('status_blockchain_downloading')).show()
                    }
                } else if (BRS.rescaningBlockchain) {
                    $('#dashboard_message').addClass('alert-danger').removeClass('alert-success').html($.t('status_blockchain_rescanning')).show()
                } else {
                    $('#dashboard_message').addClass('alert-success').removeClass('alert-danger').html($.t('status_new_account', {
                        account_id: String(BRS.accountRS).escapeHTML(),
                        public_key: String(BRS.publicKey).escapeHTML()
                    })).show()
                }
            } else {
                $('#dashboard_message').addClass('alert-danger').removeClass('alert-success').html(response.errorDescription ? response.errorDescription.escapeHTML() : $.t('error_unknown')).show()
            }
        } else {
            if (BRS.accountRS && BRS.accountInfo.accountRS !== BRS.accountRS) {
                $.notify('Generated Reed Solomon address different from the one in the blockchain!', { type: 'danger' })
                BRS.accountRS = BRS.accountInfo.accountRS
            }

            if (BRS.downloadingBlockchain) {
                $('#dashboard_message').addClass('alert-success').removeClass('alert-danger').html($.t('status_blockchain_downloading')).show()
            } else if (BRS.rescaningBlockchain) {
                $('#dashboard_message').addClass('alert-danger').removeClass('alert-success').html($.t('status_blockchain_rescanning')).show()
            } else if (!BRS.accountInfo.publicKey) {
                $('#dashboard_message').addClass('alert-danger').removeClass('alert-success').html($.t('no_public_key_warning') + ' ' + $.t('public_key_actions')).show()
            } else {
                $('#dashboard_message').hide()
            }

            // only show if happened within last week
            const showAssetDifference = (!BRS.downloadingBlockchain || (BRS.blocks.length > 0 && BRS.blockchainStatus && BRS.blockchainStatus.time - BRS.blocks[0].timestamp < 60 * 60 * 24 * 7))

            if (BRS.databaseSupport) {
                dbGet('data', {
                    id: 'asset_balances_' + BRS.account
                }, function (_error, asset_balance) {
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
                                contents: current_balances
                            })
                            if (showAssetDifference) {
                                checkAssetDifferences(BRS.accountInfo.assetBalances, previous_balances)
                            }
                        }
                    } else {
                        dbPut('data', {
                            id: 'asset_balances_' + BRS.account,
                            contents: JSON.stringify(BRS.accountInfo.assetBalances)
                        })
                    }
                })
            } else if (showAssetDifference && previousAccountInfo && previousAccountInfo.assetBalances) {
                const previousBalances = JSON.stringify(previousAccountInfo.assetBalances)
                const currentBalances = JSON.stringify(BRS.accountInfo.assetBalances)

                if (previousBalances !== currentBalances) {
                    checkAssetDifferences(BRS.accountInfo.assetBalances || [], previousAccountInfo.assetBalances)
                }
            }

            $('#account_balance, #account_balance_sendmoney').html(formatStyledAmount(response.unconfirmedBalanceNQT))
            $('#account_balance_locked, #account_balance_sendmoney').html(formatStyledAmount((BigInt(response.balanceNQT) - BigInt(response.unconfirmedBalanceNQT)).toString(10)))
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
    })
}

function checkAssetDifferences (current_balances: AssetBalance[], previous_balances: AssetBalance[]) : void {
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
            sendRequest('getAsset', {
                asset: k,
                _extra: {
                    asset: k,
                    difference: diff[k]
                }
            }, function (asset, input) {
                if (asset.errorCode) {
                    return
                }
                asset.difference = input._extra.difference
                asset.asset = input._extra.asset
                let quantity
                if (asset.difference.charAt(0) !== '-') {
                    quantity = formatQNTAsQuantity(asset.difference, asset.decimals)

                    if (quantity !== '0') {
                        $.notify($.t('you_received_assets', {
                            asset: String(asset.asset).escapeHTML(),
                            name: String(asset.name).escapeHTML(),
                            count: quantity
                        }), { type: 'success' })
                    }
                } else {
                    asset.difference = asset.difference.substring(1)

                    quantity = formatQNTAsQuantity(asset.difference, asset.decimals)

                    if (quantity !== '0') {
                        $.notify($.t('you_sold_assets', {
                            asset: String(asset.asset).escapeHTML(),
                            name: String(asset.name).escapeHTML(),
                            count: quantity
                        }), { type: 'success' })
                    }
                }
            })
        }
    } else {
        $.notify($.t('multiple_assets_differences'), { type: 'success' })
    }
}

export function checkLocationHash () : void {
    if (!window.location.hash) {
        return
    }
    const hash = window.location.hash.replace('#', '').split(':')
    let $modal: JQuery<HTMLElement> | undefined
    if (hash.length !== 2) {
        return
    }
    if (hash[0] === 'message') {
        $modal = $('#send_message_modal')
    } else if (hash[0] === 'send') {
        $modal = $('#send_money_modal')
    } else if (hash[0] === 'asset') {
        goToAsset(hash[1])
        return
    }

    if ($modal) {
        let account_id = hash[1].trim()
        if (!/^\d+$/.test(account_id) && account_id.indexOf('@') !== 0) {
            account_id = '@' + account_id
        }
        $modal.find('input[name=recipient]').val(account_id.unescapeHTML()).trigger('blur')
        $modal.modal('show')
    }
    window.location.hash = '#'
}

/** Checks if a Number is valid and greater than minimum fee. If not, return minimum fee */
export function checkMinimumFee (value: number) : number {
    return (isNaN(value) ? BRS.minimumFeeNumber : (value < BRS.minimumFeeNumber ? BRS.minimumFeeNumber : value))
}

/**
 * Requests current fee values from node.
 * @param input_form The form of current modal that is going to be shown
 */
export function showFeeSuggestionsNG (input_form: HTMLElement) : void {
    const $groups = $(input_form).find('.has-suggested-fee-group')
    if ($groups.length === 0) {
        $(input_form).find('[name=feeNXT]').trigger('change')
        return
    }
    $groups.find('.suggested_fee_spinner').show()
    $groups.find('.suggested_fee_response').empty()

    sendRequest('suggestFee', {
    }, function (response: SuggestFee) {
        $groups.find('.suggested_fee_spinner').hide()
        const minFeeNQT = Number($groups.find('[name=feeNXT]').prop('min')) * 1E8
        if (response.errorCode) {
            const errorMessage = response.errorDescription || `Error code: ${String(response.errorCode)}`
            $groups.find('.suggested_fee_response').text(errorMessage)
            $groups.find('[name=feeNXT]').val(minFeeNQT.toString())
            return
        }
        if (minFeeNQT >= response.standard) {
            // Special cases like 'issue asset', 'create alias'
            $groups.find('[name=feeNXT]').val(formatNQTAsAmount(minFeeNQT.toString()))
            $groups.find('[name=feeNXT]').trigger('change')
            $groups.find('.suggested_fee_response').html(`
                <span title='${$.t('special_mininum_fee')}'>
                  <i class='fas fa-lock'></i>
                  <a href='#' name='suggested_fee_value'>${formatNQTAsAmount(minFeeNQT.toString())}</a>
                </span>`)
            return
        }
        // Regular transactions
        $groups.find('[name=feeNXT]').val(formatNQTAsAmount(response.standard.toString()))
        $groups.find('[name=feeNXT]').trigger('change')
        
        const cheapMessage = `
            <span title='${$.t('cheap_fee')}'>
              <i class='fas fa-leaf'></i>
              <a href='#' name='suggested_fee_value'>${formatNQTAsAmount(response.cheap.toString())}</a>
            </span>`
        const standardMessage = `
            <span title='${$.t('standard_fee')}'>
              <i class='fas fa-balance-scale'></i>
              <a href='#' name='suggested_fee_value'>${formatNQTAsAmount(response.standard.toString())}</a>
            </span>`
        const priorityMessage = `
            <span title='${$.t('priority_fee')}'>
              <i class='fas fa-exclamation-triangle'></i>
              <a href='#' name='suggested_fee_value'>${formatNQTAsAmount(response.priority.toString())}</a>
            </span>`
        $groups.find('.suggested_fee_response').html(`${cheapMessage}&nbsp;&nbsp; ${standardMessage}&nbsp;&nbsp; ${priorityMessage}`)
        $groups.find("[name='suggested_fee_value']").on('click', function (e) {
            e.preventDefault()
            $groups.find('[name=feeNXT]').val($(this).text())
            $groups.find('[name=feeNXT]').trigger('change')
        })
    })
}
