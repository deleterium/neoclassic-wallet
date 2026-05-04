/**
 * @depends {3rdparty/bootstrap.min.js}
 * @depends {3rdparty/jsbn.js}
 * @depends {3rdparty/jsbn2.js}
 * @depends {3rdparty/notify.min.js}
 * @depends {crypto/passphrasegenerator.js}
 * @depends {crypto/3rdparty/aes.js}
 * @depends {crypto/3rdparty/seedrandom.js}
 * @depends {util/extensions.js}
 */

/* global BigInteger */

import hashicon from 'hashicon'

import {
    loadSettingsFromDB
} from './brs.settings'

import {
    sendRequest
} from './brs.server'

import {
    showLockscreen
} from './brs.login'

import {
    getBlock,
    handleInitialBlocks,
    handleNewBlocks
} from './brs.blocks'

import {
    evAliasShowSearchResult
} from './brs.aliases'

import {
    formatQuantity,
    convertNumericToRSAccountFormat,
    formatStyledAmount
} from './brs.util'

import {
    loadClosedGroupsFromDB,
    loadAssetsFromDB,
    saveCachedAssets,
    cacheUserAssets,
    goToAsset
} from './brs.assetexchange'

import {
    getInitialTransactions,
    getNewTransactions,
    getUnconfirmedTransactions,
    handleIncomingTransactions
} from './brs.transactions'

import {
    automaticallyCheckRecipient
} from './brs.recipient'

import {
    showAccountModal
} from './brs.modals.account'

import {
    showBlockModal
} from './brs.modals.block'

import {
    showTransactionModal
} from './brs.modals.transaction'

import {
    createDatabase,
    dbGet,
    dbPut
} from './brs.database'

import { loadContactsFromDB } from './brs.contacts'

import { BRS } from '.'

function loadAllDBValues () {
    loadContactsFromDB()
    loadClosedGroupsFromDB()
    loadAssetsFromDB()
    loadSettingsFromDB()
}

export function init () {
    try {
        if (window.localStorage) {
            BRS.hasLocalStorage = true
        }
    } catch (err) {
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

    BRS.multiQueue = $.ajaxMultiQueue(4)

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

    setStateInterval(30)

    automaticallyCheckRecipient()

    $('.show_popover').popover({
        trigger: 'hover'
    })

    $("[data-toggle='tooltip']").tooltip()

    setInterval(setHeaderClock, 1000)

    /*
          $("#asset_exchange_search input[name=q]").addClear({
          right: 0,
          top: 4,
          onClear: function(input) {
          $("#asset_exchange_search").trigger("submit");
          }
          });

          $("#id_search input[name=q], #alias_search input[name=q]").addClear({
          right: 0,
          top: 4
          }); */
}

export function setStateInterval (seconds) {
    if (seconds === BRS.stateIntervalSeconds && BRS.stateInterval) {
        return
    }

    if (BRS.stateInterval) {
        clearInterval(BRS.stateInterval)
    }

    BRS.stateIntervalSeconds = seconds

    BRS.stateInterval = setInterval(function () {
        getState()
    }, 1000 * seconds)
}

export function checkSelectedNode () {
    const preferedNode = $('#prefered_node').val()
    if (preferedNode !== BRS.server) {
        // Server changed, get new network details
        BRS.server = preferedNode
        sendRequest('getConstants', function (response) {
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

export function autoSelectServer () {
    const ajaxCall = $.ajaxMultiQueue(8).queue
    // shuffleArray but keep localhost as first one
    const mainnetServers = BRS.nodes.filter(obj => obj.testnet === false).slice(1)
    for (let i = mainnetServers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mainnetServers[i], mainnetServers[j]] = [mainnetServers[j], mainnetServers[i]]
    }
    mainnetServers.unshift(BRS.nodes[0])
    const responses = []
    setTimeout(() => {
        // choose winner
        responses.sort((a, b) => b[2] - a[2])
        $('#prefered_node').val(responses[0][0])
        getState()
    }, 2100)
    for (const server of mainnetServers) {
        ajaxCall({
            url: `${server.address}/burst?requestType=getBlock`,
            crossDomain: true,
            dataType: 'json',
            type: 'GET',
            timeout: 2000,
            async: true
        }).done(function (response, status, xhr) {
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

function setHeaderClock () {
    const lastBlockDate = new Date(Date.UTC(2014, 7, 11, 2, 0, 0, 0) + BRS.state.lastBlockTimestamp * 1000)
    const diffSeconds = Math.floor((Date.now() - lastBlockDate.getTime()) / 1000)
    const minutes = (diffSeconds / 60) < 10 ? '0' + Math.floor(diffSeconds / 60).toString() : Math.floor(diffSeconds / 60).toString()
    const seconds = (diffSeconds % 60) < 10 ? '0' + (diffSeconds % 60).toString() : (diffSeconds % 60).toString()
    $('#header_block_time').html(minutes + ':' + seconds)
}

export function getState (callback) {
    checkSelectedNode()

    sendRequest('getBlockchainStatus', function (response) {
        if (response.errorCode) {
            if (response.errorCode === -1) {
                if (BRS.settings.automatic_node_selection) {
                    autoSelectServer()
                    return
                }
                $('#node_alert').show()
                $('#brs_version, #brs_version_dashboard').html(BRS.loadingDotsHTML).addClass('loading_dots')
            }
            return
        }
        $('#node_alert').hide()
        const firstTime = !('lastBlock' in BRS.state)
        const previousLastBlock = (firstTime ? '0' : BRS.state.lastBlock)

        BRS.state = response

        $('#brs_version').html(BRS.state.version + ' on ' + BRS.server).removeClass('loading_dots')
        $('#brs_version_dashboard').html(BRS.state.version).removeClass('loading_dots')
        $('#header_current_block').html('#' + BRS.state.numberOfBlocks)
        setHeaderClock()
        switch (true) {
        case firstTime:
            getBlock(BRS.state.lastBlock, handleInitialBlocks)
            break
        case BRS.state.isScanning:
            // do nothing but reset BRS.state so that when isScanning is done, everything is reset.
            BRS.isScanning = true
            break
        case BRS.isScanning:
            // rescan is done, now we must reset everything...
            BRS.isScanning = false
            BRS.blocks = []
            BRS.tempBlocks = []
            getBlock(BRS.state.lastBlock, handleInitialBlocks)
            if (BRS.account) {
                getInitialTransactions()
                getAccountInfo()
            }
            break
        case (previousLastBlock !== BRS.state.lastBlock):
            BRS.tempBlocks = []
            if (BRS.account) {
                getAccountInfo(false, cacheUserAssets)
            }
            getBlock(BRS.state.lastBlock, handleNewBlocks)
            if (BRS.account) {
                getNewTransactions()
            }
            break
        default:
            if (BRS.account) {
                getUnconfirmedTransactions(function (unconfirmedTransactions) {
                    handleIncomingTransactions(unconfirmedTransactions, false)
                })
            }
            // only done so that download progress meter updates correctly based on lastFeederHeight
            if (BRS.downloadingBlockchain) {
                updateBlockchainDownloadProgress()
            }
        }

        if (callback) {
            callback()
        }
    })

    saveCachedAssets()
}

/**
 * Handles clicks in sidebar, changing current page if needed
 */
export function evSidebarClick (e) {
    e.preventDefault()
    if ($(this).data('toggle') === 'modal') {
        return
    }
    const page = $(this).data('page')
    if (page === 'keep' || page === BRS.currentPage) {
        return
    }
    $('.page').hide()
    $('#' + page + '_page').show()
    // $('.content-header h1').find('.loading_dots').remove()
    $('#sidebar .active').removeClass('active')
    $(e.currentTarget).addClass('active')

    // if (BRS.currentPage !== 'messages') {
    //     $('#inline_message_password').val('')
    // }

    loadPage(page)
}

/** Load a page for first time (setting up global variables) */
function loadPage (page) {
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
export function reloadCurrentPage () {
    if (!BRS.pages[BRS.currentPage]) {
        console.log('Possible bug on reloadCurrentPage.')
        return
    }
    pageLoading()
    BRS.pages[BRS.currentPage]()
}

/** Go to a page, updating sidebar menu */
export function goToPage (page) {
    let $link = $('ul.sidebar-menu a[data-page=' + page + ']')

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
    $('ul.sidebar-menu a.active').removeClass('active')
    $('.page').hide()
    $('#' + page + '_page').show()
    loadPage(page)
}

export function pageLoading () {
    BRS.hasMorePages = false

    const $pageHeader = $('#' + BRS.currentPage + '_page .content-header h1')
    $pageHeader.find('.loading_dots').remove()
    $pageHeader.append("<span class='loading_dots'>" + BRS.loadingDotsHTML + '</span>')
    const $pageContainer = $('#' + BRS.currentPage + '_page .data-container')
    $pageContainer.addClass('data-loading')
}

export function pageLoaded (callback) {
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

export function addPagination (section) {
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

export function goToPageNumber (pageNumber) {
    /* if (!pageLoaded) {
          return;
          } */
    BRS.pageNumber = pageNumber

    pageLoading()

    BRS.pages[BRS.currentPage]()
}

export function getAccountInfo (firstRun, callback) {
    sendRequest('getAccount', {
        account: BRS.account,
        getCommittedAmount: 'true'
    }, function (response) {
        const previousAccountInfo = BRS.accountInfo

        BRS.accountInfo = response

        if (response.errorCode) {
            $('#account_balance, #account_committed_balance, #account_balance_sendmoney').html('0')
            $('#account_nr_assets').html('0')

            if (BRS.accountInfo.errorCode === 5) {
                if (BRS.downloadingBlockchain) {
                    if (BRS.newlyCreatedAccount) {
                        $('#dashboard_message').addClass('alert-success').removeClass('alert-danger').html($.t('status_new_account', {
                            account_id: String(BRS.accountRS).escapeHTML(),
                            public_key: String(BRS.publicKey).escapeHTML()
                        }) + '<br /><br />' + $.t('status_blockchain_downloading')).show()
                    } else {
                        $('#dashboard_message').addClass('alert-success').removeClass('alert-danger').html($.t('status_blockchain_downloading')).show()
                    }
                } else if (BRS.state && BRS.state.isScanning) {
                    $('#dashboard_message').addClass('alert-danger').removeClass('alert-success').html($.t('status_blockchain_rescanning')).show()
                } else {
                    $('#dashboard_message').addClass('alert-success').removeClass('alert-danger').html($.t('status_new_account', {
                        account_id: String(BRS.accountRS).escapeHTML(),
                        public_key: String(BRS.publicKey).escapeHTML()
                    })).show()
                }
            } else {
                $('#dashboard_message').addClass('alert-danger').removeClass('alert-success').html(BRS.accountInfo.errorDescription ? BRS.accountInfo.errorDescription.escapeHTML() : $.t('error_unknown')).show()
            }
        } else {
            if (BRS.accountRS && BRS.accountInfo.accountRS !== BRS.accountRS) {
                $.notify('Generated Reed Solomon address different from the one in the blockchain!', { type: 'danger' })
                BRS.accountRS = BRS.accountInfo.accountRS
            }

            if (BRS.downloadingBlockchain) {
                $('#dashboard_message').addClass('alert-success').removeClass('alert-danger').html($.t('status_blockchain_downloading')).show()
            } else if (BRS.state && BRS.state.isScanning) {
                $('#dashboard_message').addClass('alert-danger').removeClass('alert-success').html($.t('status_blockchain_rescanning')).show()
            } else if (!BRS.accountInfo.publicKey) {
                $('#dashboard_message').addClass('alert-danger').removeClass('alert-success').html($.t('no_public_key_warning') + ' ' + $.t('public_key_actions')).show()
            } else {
                $('#dashboard_message').hide()
            }

            // only show if happened within last week
            const showAssetDifference = (!BRS.downloadingBlockchain || (BRS.blocks.length > 0 && BRS.state && BRS.state.time - BRS.blocks[0].timestamp < 60 * 60 * 24 * 7))

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
                    checkAssetDifferences(BRS.accountInfo.assetBalances, previousAccountInfo.assetBalances)
                }
            }

            $('#account_balance, #account_balance_sendmoney').html(formatStyledAmount(response.unconfirmedBalanceNQT))
            $('#account_balance_locked, #account_balance_sendmoney').html(formatStyledAmount((new BigInteger(response.balanceNQT) - new BigInteger(response.unconfirmedBalanceNQT)).toString()))
            $('#account_committed_balance, #account_balance_sendmoney').html(formatStyledAmount(response.committedBalanceNQT))
            $('#account_forged_balance').html(formatStyledAmount(response.committedBalanceNQT))

            let nr_assets = 0

            if (response.assetBalances) {
                for (let i = 0; i < response.assetBalances.length; i++) {
                    if (response.assetBalances[i].balanceQNT !== '0') {
                        nr_assets++
                    }
                }
            }

            $('#account_nr_assets').html(nr_assets)

            if (response.name) {
                $('#account_name').html(response.name.escapeHTML()).removeAttr('data-i18n')
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

function checkAssetDifferences (current_balances, previous_balances) {
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
            const change = (new BigInteger(current_balances_[k]).subtract(new BigInteger(previous_balances_[k]))).toString()
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
                    quantity = formatQuantity(asset.difference, asset.decimals)

                    if (quantity !== '0') {
                        $.notify($.t('you_received_assets', {
                            asset: String(asset.asset).escapeHTML(),
                            name: String(asset.name).escapeHTML(),
                            count: quantity
                        }), { type: 'success' })
                    }
                } else {
                    asset.difference = asset.difference.substring(1)

                    quantity = formatQuantity(asset.difference, asset.decimals)

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

export function checkLocationHash (password) {
    if (window.location.hash) {
        const hash = window.location.hash.replace('#', '').split(':')
        let $modal
        if (hash.length === 2) {
            if (hash[0] === 'message') {
                $modal = $('#send_message_modal')
            } else if (hash[0] === 'send') {
                $modal = $('#send_money_modal')
            } else if (hash[0] === 'asset') {
                goToAsset(hash[1])
                return
            } else {
                $modal = ''
            }

            if ($modal) {
                let account_id = String($.trim(hash[1]))
                if (!/^\d+$/.test(account_id) && account_id.indexOf('@') !== 0) {
                    account_id = '@' + account_id
                }

                $modal.find('input[name=recipient]').val(account_id.unescapeHTML()).trigger('blur')
                if (password && typeof password === 'string') {
                    $modal.find('input[name=secretPhrase]').val(password)
                }
                $modal.modal('show')
            }
        }

        window.location.hash = '#'
    }
}

export function updateBlockchainDownloadProgress () {
    let percentage
    if (BRS.state.lastBlockchainFeederHeight && BRS.state.numberOfBlocks < BRS.state.lastBlockchainFeederHeight) {
        percentage = parseInt(Math.round((BRS.state.numberOfBlocks / BRS.state.lastBlockchainFeederHeight) * 100), 10)
    } else {
        percentage = 100
    }

    if (percentage === 100) {
        $('#downloading_blockchain .progress').hide()
    } else {
        $('#downloading_blockchain .progress').show()
        $('#downloading_blockchain .progress-bar').css('width', percentage + '%')
        $('#downloading_blockchain .sr-only').html($.t('percent_complete', {
            percent: percentage
        }))
    }
}

export function checkIfOnAFork () {
    if (!BRS.downloadingBlockchain) {
        let onAFork = true

        if (BRS.blocks.length >= 10) {
            for (let i = 0; i < 10; i++) {
                if (BRS.blocks[i].generator !== BRS.account) {
                    onAFork = false
                    break
                }
            }
        } else {
            onAFork = false
        }

        if (onAFork) {
            $.notify($.t('fork_warning'), { type: 'danger' })
        }
    }
}

/** Checks if a Number is valid and greater than minimum fee. If not, return minimum fee */
export function checkMinimumFee (value) {
    return (isNaN(value) ? BRS.minimumFeeNumber : (value < BRS.minimumFeeNumber ? BRS.minimumFeeNumber : value))
}

export function showFeeSuggestionsNG (input_form) {
    const $groups = $(input_form).find('.has-suggested-fee-group')
    if ($groups.length === 0) {
        $(input_form).find('[name=feeNXT]').trigger('change')
        return
    }
    $groups.find('.suggested_fee_spinner').show()
    $groups.find('.suggested_fee_response').empty()

    sendRequest('suggestFee', {
    }, function (response) {
        $groups.find('.suggested_fee_spinner').hide()
        if (response.errorCode) {
            $groups.find('.suggested_fee_response').html(response.errorDescription.escapeHTML())
            return
        }
        $groups.find('[name=feeNXT]').val((response.standard / 100000000))
        $groups.find('[name=feeNXT]').trigger('change')
        const cheapMessage = `<span title='${$.t('cheap_fee')}'><i class='fas fa-leaf'></i> <a href='#' name='suggested_fee_value'>${(response.cheap / 100000000)}</a></span>`
        const standardMessage = `<span title='${$.t('standard_fee')}'><i class='fas fa-balance-scale'></i> <a href='#' name='suggested_fee_value'>${(response.standard / 100000000)}</a></span>`
        const priorityMessage = `<span title='${$.t('priority_fee')}'><i class='fas  fa-exclamation-triangle'></i> <a href='#' name='suggested_fee_value'>${(response.priority / 100000000)}</a></span>`
        $groups.find('.suggested_fee_response').html(`${cheapMessage}&nbsp;&nbsp; ${standardMessage}&nbsp;&nbsp; ${priorityMessage}`)
        $groups.find("[name='suggested_fee_value']").on('click', function (e) {
            e.preventDefault()
            $groups.find('[name=feeNXT]').val($(this).text())
            $groups.find('[name=feeNXT]').trigger('change')
        })
    })
}

function showAccountSearchResults (accountsList) {
    if (BRS.currentPage !== 'search_results') {
        goToPage('search_results')
    }
    let items = '<ul>'
    for (const account of accountsList) {
        const accountRS = convertNumericToRSAccountFormat(account)
        items += `<li><a href="#" data-user="${accountRS}" class="user-info">${accountRS}</a></li>`
    }
    items += '</ul>'
    $('#search_results_ul_container').html(items)
}

function showAssetSearchResults (assets) {
    if (BRS.currentPage !== 'search_results') {
        goToPage('search_results')
    }
    let items = '<table class="table table-striped">' +
            '<thead><tr>' +
            `<th>${$.t('name')}</th>` +
            `<th>${$.t('asset_id')}</th>` +
            `<th>${$.t('issuer')}</th>` +
            `<th>${$.t('description')}</th>` +
            '</tr></thead><tbody>'
    for (const asset of assets) {
        items += `<tr><td>${asset.name}</td>`
        items += `<td><a href="#" data-goto-asset="${asset.asset}">${asset.asset}</a></td>`
        items += `<td><a href="#" data-user="${asset.accountRS}" class="user-info">${asset.accountRS}</a></td>`
        items += `<td>${String(asset.description).escapeHTML()}</td></tr>`
    }
    items += '</tbody></table>'
    $('#search_results_ul_container').html(items)
}

export function evIdSearchSubmit (e) {
    e.preventDefault()
    const userInput = $('#search_box input').val().trim()
    let searchText = userInput
    if (searchText.startsWith('-')) {
        try {
            // signed to unsigned conversion
            searchText = (BigInt(userInput) + (1n << 64n)).toString(10)
        } catch (_e) {
            searchText = userInput
        }
    }
    if (BRS.rsRegEx.test(searchText)) {
        sendRequest('getAccount', {
            account: searchText
        }, function (response, input) {
            if (response.errorCode) {
                $.notify($.t('error_search_no_results'), { type: 'danger' })
                return
            }
            response.account = input.account
            showAccountModal(response)
        })
        return
    }
    if (BRS.idRegEx.test(searchText)) {
        sendRequest('getTransaction', {
            transaction: searchText
        }, function (response, input) {
            if (response.errorCode) {
                $.notify($.t('error_search_no_results'), { type: 'danger' })
                return
            }
            response.transaction = input.transaction
            showTransactionModal(response)
        })
        return
    }
    const splitted = searchText.split(':')
    if (splitted.length !== 2) {
        $.notify($.t('error_search_invalid'), { type: 'danger' })
        return
    }
    switch (splitted[0].trim()) {
    case 'a':
    case 'address':
        sendRequest('getAccount', {
            account: splitted[1].trim()
        }, function (response, input) {
            if (response.errorCode) {
                $.notify($.t('error_search_no_results'), { type: 'danger' })
                return
            }
            response.account = input.account
            showAccountModal(response)
        })
        return
    case 'b':
    case 'block':
        sendRequest('getBlock', {
            block: splitted[1].trim(),
            includeTransactions: 'true'
        }, function (response, input) {
            if (!response.errorCode) {
                // response.block = input.block;
                showBlockModal(response)
            } else {
                sendRequest('getBlock', {
                    height: splitted[1].trim(),
                    includeTransactions: 'true'
                }, function (response, input) {
                    if (!response.errorCode) {
                        // response.block = input.block;
                        showBlockModal(response)
                    } else {
                        $.notify($.t('error_search_no_results'), { type: 'danger' })
                    }
                })
            }
        })
        return
    case 'alias':
        sendRequest('getAlias', {
            aliasName: splitted[1].trim()
        }, function (response) {
            if (response.errorCode) {
                $.notify($.t('error_search_no_results'), { type: 'danger' })
                return
            }
            evAliasShowSearchResult(response)
        })
        return
    case 'name':
        sendRequest('getAccountsWithName', {
            name: splitted[1].trim()
        }, function (response) {
            if (response.errorCode || !response.accounts || response.accounts.length === 0) {
                $.notify($.t('error_search_no_results'), { type: 'danger' })
                return
            }
            if (response.accounts.length === 1) {
                sendRequest('getAccount', {
                    account: response.accounts[0]
                }, function (response2, input) {
                    if (response2.errorCode) {
                        $.notify($.t('error_search_no_results'), { type: 'danger' })
                        return
                    }
                    showAccountModal(response2)
                })
                return
            }
            // show multi result page
            showAccountSearchResults(response.accounts)
        })
        return
    case 'token':
        sendRequest('getAssetsByName', {
            name: splitted[1].trim()
        }, function (response) {
            if (response.errorCode || !response.assets || response.assets.length === 0) {
                $.notify($.t('error_search_no_results'), { type: 'danger' })
                return
            }
            showAssetSearchResults(response.assets)
        })
        return
    default:
        $.notify($.t('error_search_invalid'), { type: 'danger' })
    }
}
