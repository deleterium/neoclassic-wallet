import { BRS } from '..'
import { GetBlochainStatusResponse } from '../typings'
import { loadClosedGroupsFromDB, loadAssetsFromDB } from '../tools/assets'
import { loadContactsFromDB } from '../tools/contacts'
import { loadSettingsFromDB } from '../pages/settings'
import { createDatabase } from './database'
import { showLockscreen } from './login'
import { automaticallyCheckRecipient } from './recipient'
import { sendRequestA } from './send_request'

/**
 * Checks prefered node string in login panel. If changed, update BRS with blockchain details.
 */
export function checkSelectedNode(): void {
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
        sendRequestA('getConstants+', {}).then((response) => {
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

export function autoSelectServer(): void {
    $('#node_alert').show()
    $('#node_alert').html($.t('trying_auto_connection'))
    $('#brs_version, #brs_version_dashboard').html(BRS.loadingDotsHTML).addClass('loading_dots')
    // shuffleArray but keep localhost as first one
    const mainnetServers = BRS.nodes.filter((obj) => obj.testnet === false).slice(1)
    for (let i = mainnetServers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[mainnetServers[i], mainnetServers[j]] = [mainnetServers[j], mainnetServers[i]]
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
            async: true,
        }).done(function (response, status) {
            if (status === 'success' && response.errorCode === undefined) {
                const fasterResponse = responses.find((row) => row[1] === response.block)
                if (fasterResponse) {
                    fasterResponse[2] = fasterResponse[2] + 1
                    return
                }
                responses.push([server.address, response.block, 1])
            }
        })
    }
}

/**
 * Runs in lockscreen, while not logged.
 * @param callback
 */
export async function getState() {
    checkSelectedNode()

    const response: GetBlochainStatusResponse = await sendRequestA('getBlockchainStatus+', {})

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
    $('#brs_version')
        .html(response.version + ' on ' + BRS.server)
        .removeClass('loading_dots')
    $('#brs_version_dashboard').html(response.version).removeClass('loading_dots')
    $('#header_current_block').html('#' + response.numberOfBlocks)
    $('#prefered_node').removeClass('is-invalid')
}

export function init(): void {
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
        offset: 10,
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

function loadAllDBValues() {
    loadContactsFromDB()
    loadClosedGroupsFromDB()
    loadAssetsFromDB()
    loadSettingsFromDB()
}
