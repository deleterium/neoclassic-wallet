/**
 * @depends {brs.js}
 */

import { BRS } from '.'

import {
    getAccountInfo,
    checkLocationHash,
    setHeaderClock,
} from './brs'

import {
    updateSettings
} from './brs.settings'

import {
    setSavedPassword,
    sendRequest
} from './brs.sendRequest'

import {
    getContactByName
} from './brs.contacts.tools'

import {
    getPublicKeyFromPassphrase,
    getAccountId,
    setEncryptionPassword,
    setDecryptionPassword
} from './brs.encryption'

import {
    convertNumericToRSAccountFormat,
    setupClipboardFunctionality
} from './brs.util'

import {
    cacheUserAssets
} from './brs.asset.tools'

import {
    getInitialTransactions,
    handleNewBlocks
} from './brs.checkincoming'

import PassPhraseGenerator from './brs.passphrase.generator'

import { GetAccountPublicKeyResponse, GetAccountResponse } from '../typings'

export function showLoginOrWelcomeScreen () {
    if (BRS.hasLocalStorage && localStorage.getItem('logged_in')) {
        showLoginScreen()
    } else {
        showWelcomeScreen()
    }
}

export function showLoginScreen () {
    $('#account_phrase_custom_panel, #account_phrase_generator_panel, #welcome_panel, #custom_passphrase_link').hide()
    $('#account_phrase_custom_panel :input:not(:button):not([type=submit])').val('')
    $('#account_phrase_generator_panel :input:not(:button):not([type=submit])').val('')
    $('#login_panel').show()

    setTimeout(function () {
        $('#login_password').focus()
    }, 10)
}

function showWelcomeScreen () {
    $('#login_panel, account_phrase_custom_panel, #account_phrase_generator_panel, #account_phrase_custom_panel, #welcome_panel, #custom_passphrase_link').hide()
    $('#welcome_panel').show()
}

export function registerUserDefinedAccount () {
    $('#account_phrase_generator_panel, #login_panel, #welcome_panel, #custom_passphrase_link').hide()
    $('#account_phrase_custom_panel :input:not(:button):not([type=submit])').val('')
    $('#account_phrase_generator_panel :input:not(:button):not([type=submit])').val('')
    $('#account_phrase_custom_panel').show()
    $('#registration_password').trigger('focus')
}

export function registerAccount () {
    $('#login_panel, #welcome_panel').hide()
    $('#account_phrase_generator_panel').show()
    $('#account_phrase_generator_panel .step_3 .callout').hide()

    $('#account_phrase_generator_loaded').show()
    PassPhraseGenerator.generatePassPhrase('#account_phrase_generator_panel')
}

export function verifyGeneratedPassphrase () {
    const password = String($('#account_phrase_generator_panel .step_3 textarea').val()).trim()

    if (password !== PassPhraseGenerator.passPhrase) {
        $('#account_phrase_generator_panel .step_3 .callout').show()
    } else {
        BRS.newlyCreatedAccount = true
        loginWithPassphrase(password)
        PassPhraseGenerator.reset()
        $('#account_phrase_generator_panel textarea').val('')
        $('#account_phrase_generator_panel .step_3 .callout').hide()
    }
}

export function evAccountPhraseCustomPanelSubmit (event) {
    event.preventDefault()

    const password = $('#registration_password').val() as string
    const repeat = $('#registration_password_repeat').val()

    let error = ''

    if (password.length < 35) {
        error = $.t('error_passphrase_length')
    } else if (password.length < 50 && (!password.match(/[A-Z]/) || !password.match(/[0-9]/))) {
        error = $.t('error_passphrase_strength')
    } else if (password !== repeat) {
        error = $.t('error_passphrase_match')
    }

    if (error) {
        $('#account_phrase_custom_panel .callout').first().removeClass('callout-info').addClass('callout-danger').html(error)
        return
    }
    $('#registration_password, #registration_password_repeat').val('')
    loginWithPassphrase(password)
}

export function loginCommon () {
    if (!BRS.settings.automatic_node_selection) {
        updateSettings('prefered_node', BRS.server)
    }
    $('[data-value-suffix]').text(BRS.valueSuffix)

    getAccountInfo(true, cacheUserAssets)

    unlock()

    setupClipboardFunctionality()

    checkLocationHash()

    $(window).on('hashchange', checkLocationHash)

    // Populate dashboard transactions
    getInitialTransactions()

    // Simulate new block
    handleNewBlocks()
}

function loginWithAccount (account: string) {
    account = account.trim()
    if (!account.length) {
        $.notify($.t('error_account_required_login'), { type: 'danger' })
        return
    }

    let login: string | undefined
    if (BRS.rsRegEx.test(account) || BRS.idRegEx.test(account)) {
        login = account
    } else {
        const foundContact = getContactByName(account)
        if (foundContact) login = foundContact.accountRS
    }
    if (!login) {
        $.notify(
            $.t('name_not_in_contacts', { name: account }),
            { type: 'danger' }
        )
        return
    }

    // Get the account information for the given address
    sendRequest('getAccount', {
        account: login
    }, function (response: GetAccountResponse) {
        if (response.errorCode) {
            if (BRS.rsRegEx.test(login) || BRS.idRegEx.test(login)) {
                $.notify($.t('error_account_unknow_watch_only'), { type: 'danger' })
                return
            }
            // Otherwise, show an error.  The address is in the right format perhaps, but
            // an address does not exist on the blockchain so there's nothing to see.
            $.notify('<strong>' + $.t('warning') + '</strong>: ' + response.errorDescription, {
                type: 'danger'
            })
            return
        }

        updateSettings('remember_account', $('#remember_account').is(':checked'))
        updateSettings('last_remembered_account', account)

        BRS.account = response.account
        BRS.accountRS = response.accountRS
        BRS.publicKey = response.publicKey
        BRS.accountRSExtended = response.accountRSExtended

        $('#login_password, #login_account, #registration_password, #registration_password_repeat').val('')
        $('#login_check_password_length').val(1)
        $.notify($.t('success_login_watch_only'), { type: 'success' })
        $('#account_id').html(String(BRS.accountRS).escapeHTML())

        loginCommon()
    })
}

function loginWithPassphrase (passphrase: string) {
    // Check passphrase
    if (!passphrase.length) {
        $.notify($.t('error_passphrase_required_login'), { type: 'danger' })
        return
    }
    if (!BRS.isTestNet && passphrase.length < 12 && $('#login_check_password_length').val() === '1') {
        $('#login_check_password_length').val(0)
        $('#login_error .callout').html($.t('error_passphrase_login_length'))
        $('#login_error').show()
        return
    }
    let passwordNotice = ''
    if (passphrase.length < 35) {
        passwordNotice = $.t('error_passphrase_length_secure')
    } else if (passphrase.length < 50 && (!passphrase.match(/[A-Z]/) || !passphrase.match(/[0-9]/))) {
        passwordNotice = $.t('error_passphrase_strength_secure')
    }
    if (passwordNotice) {
        $.notify('<strong>' + $.t('warning') + '</strong>: ' + passwordNotice, {
            type: 'danger'
        })
    }

    // Update settings
    updateSettings('remember_passphrase', $('#remember_password').is(':checked'))
    if (BRS.settings.remember_passphrase) {
        setSavedPassword(passphrase)
    }

    // Populate user details from passphrase
    BRS.account = getAccountId(passphrase)
    BRS.accountRS = convertNumericToRSAccountFormat(BRS.account)
    BRS.publicKey = getPublicKeyFromPassphrase(passphrase)
    BRS.accountRSExtended = BRS.accountRS + '-' + BigInt(`0x${BRS.publicKey}`).toString(36).toUpperCase()

    // Get account details from blockchain
    sendRequest('getAccountPublicKey', {
        account: BRS.account
    }, function (response: GetAccountPublicKeyResponse) {
        // Verify if public key from blochchain is same from the passphrase
        // Unlikey, only if there is a clash of IDs.
        if (response && response.publicKey && response.publicKey !== BRS.publicKey) {
            $.notify($.t('error_account_taken'), { type: 'danger' })
            return
        }

        if (BRS.settings.remember_passphrase) {
            $('#remember_password').prop('checked', false)
            $('.secret_phrase, .show_secret_phrase').hide()
            $('.hide_secret_phrase').show()
        }

        $('#login_password, #login_account, #registration_password, #registration_password_repeat').val('')
        $('#login_check_password_length').val(1)
        $('#account_id').html(String(BRS.accountRS).escapeHTML())

        loginCommon()
    })
}

export function evLoginButtonClick (e?: JQuery.ClickEvent) {
    if (e) {
        e.preventDefault()
    }

    if (!BRS.blockchainStatus) {
        $.notify($.t('could_not_connect_to', { server: BRS.server }))
        return
    }

    const passwd = $('#login_password').val() as string
    if (passwd !== '') {
        loginWithPassphrase(passwd)
        return
    }
    const account = $('#login_account').val() as string
    loginWithAccount(account)
}

export function showLockscreen () {
    if (BRS.hasLocalStorage && localStorage.getItem('logged_in')) {
        setTimeout(function () {
            $('#login_password').trigger('focus')
        }, 10)
    } else {
        showWelcomeScreen()
    }

    $('#lockscreen_loading').hide()
    $('#lockscreen_content').show()
}

function unlock () {
    if (BRS.hasLocalStorage && !localStorage.getItem('logged_in')) {
        localStorage.setItem('logged_in', 'true')
    }

    $('#lockscreen').hide()
    $('#main_wrapper').show()

    $('#login_error').html('').hide()

    setInterval(setHeaderClock, 1000)

    $(document.documentElement).scrollTop(0)
}

export function logout () {
    setDecryptionPassword('')
    setEncryptionPassword('')
    setSavedPassword('')
    window.location.reload()
}
