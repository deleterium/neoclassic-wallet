/**
 * @depends {brs.js}
 */

/* global PassPhraseGenerator */

import { BRS } from '.'
import converters from '../util/converters'

import {
    checkSelectedNode,
    getAccountInfo,
    checkLocationHash,
    checkIfOnAFork
} from './brs'

import {
    updateSettings
} from './brs.settings'

import {
    setSavedPassword,
    sendRequest
} from './brs.server'

import {
    checkBlockHeight
} from './brs.blocks'

import {
    getContactByName
} from './brs.contacts'

import {
    getPublicKeyFromPassphrase,
    getAccountId,
    setEncryptionPassword,
    getEncryptionPassword,
    setDecryptionPassword
} from './brs.encryption'

import {
    convertNumericToRSAccountFormat,
    setupClipboardFunctionality
} from './brs.util'

import {
    cacheUserAssets
} from './brs.assetexchange'

import {
    getInitialTransactions
} from './brs.transactions'

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
    $('#registration_password').focus()
}

export function registerAccount () {
    $('#login_panel, #welcome_panel').hide()
    $('#account_phrase_generator_panel').show()
    $('#account_phrase_generator_panel .step_3 .callout').hide()

    const $loading = $('#account_phrase_generator_loading')
    const $loaded = $('#account_phrase_generator_loaded')

    $loading.find('span.loading_text').html($.t('generating_passphrase_wait'))

    $loading.show()
    $loaded.hide()

    if (typeof PassPhraseGenerator === 'undefined') {
        $.when(
            $.getScript('js/3rdparty/seedrandom.min.js'),
            $.getScript('js/3rdparty/passphrasegenerator.js')
        ).done(function () {
            $loading.hide()
            $loaded.show()

            PassPhraseGenerator.generatePassPhrase('#account_phrase_generator_panel')
        }).fail(function (jqxhr, settings, exception) {
            alert($.t('error_word_list'))
        })
    } else {
        $loading.hide()
        $loaded.show()

        PassPhraseGenerator.generatePassPhrase('#account_phrase_generator_panel')
    }
}

export function verifyGeneratedPassphrase () {
    const password = $.trim($('#account_phrase_generator_panel .step_3 textarea').val())

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

    const password = $('#registration_password').val()
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
    } else {
        $('#registration_password, #registration_password_repeat').val('')
        loginWithPassphrase(password)
    }
}

export function loginCommon () {
    if (!BRS.settings.automatic_node_selection) {
        updateSettings('prefered_node', BRS.server)
    }

    const $valueSufix = document.querySelectorAll('[data-value-suffix]')
    for (const $each of $valueSufix) {
        $each.innerText = BRS.valueSuffix
    }

    if (BRS.state) {
        checkBlockHeight()
    }

    getAccountInfo(true, cacheUserAssets)

    unlock()

    if (!BRS.downloadingBlockchain) {
        checkIfOnAFork()
    }

    setupClipboardFunctionality()

    checkLocationHash(getEncryptionPassword())

    $(window).on('hashchange', checkLocationHash)

    getInitialTransactions()
}

function loginWithAccount (account) {
    account = account.trim()
    if (!account.length) {
        $.notify($.t('error_account_required_login'), { type: 'danger' })
        return
    }

    checkSelectedNode()

    sendRequest('getBlockchainStatus', function (response) {
        if (response.errorCode) {
            $.notify($.t('error_server_connect'), { type: 'danger' })
            return
        }

        BRS.state = response

        let login
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
        }, function (response) {
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
            updateSettings('remember_account_account', account)

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
    })
}

function loginWithPassphrase (passphrase) {
    if (!passphrase.length) {
        $.notify($.t('error_passphrase_required_login'), { type: 'danger' })
        return
    }

    checkSelectedNode()

    if (!BRS.isTestNet && passphrase.length < 12 && $('#login_check_password_length').val() === '1') {
        $('#login_check_password_length').val(0)
        $('#login_error .callout').html($.t('error_passphrase_login_length'))
        $('#login_error').show()
        return
    }

    updateSettings('remember_passphrase', $('#remember_password').is(':checked'))

    sendRequest('getBlockchainStatus', function (response) {
        if (response.errorCode) {
            $.notify($.t('error_server_connect'), { type: 'danger' })
            return
        }

        BRS.state = response

        BRS.account = getAccountId(passphrase)
        BRS.accountRS = convertNumericToRSAccountFormat(BRS.account)
        BRS.publicKey = getPublicKeyFromPassphrase(passphrase)
        BRS.accountRSExtended = BRS.accountRS + '-' + BigInt(`0x${BRS.publicKey}`).toString(36).toUpperCase()

        sendRequest('getAccountPublicKey', {
            account: BRS.account
        }, function (response) {
            if (response && response.publicKey && response.publicKey !== BRS.publicKey) {
                $.notify($.t('error_account_taken'), { type: 'danger' })
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

            if ($('#remember_password').is(':checked')) {
                BRS.rememberPassword = true
                $('#remember_password').prop('checked', false)
                setSavedPassword(passphrase)
                $('.secret_phrase, .show_secret_phrase').hide()
                $('.hide_secret_phrase').show()
            }

            $('#login_password, #login_account, #registration_password, #registration_password_repeat').val('')
            $('#login_check_password_length').val(1)
            $('#account_id').html(String(BRS.accountRS).escapeHTML())

            loginCommon()
        })
    })
}

export function evLoginButtonClick (e) {
    e.preventDefault()

    const passwd = $('#login_password').val()
    if (passwd !== '') {
        loginWithPassphrase(passwd)
        return
    }
    const account = $('#login_account').val()
    loginWithAccount(account)
}

export function showLockscreen () {
    if (BRS.hasLocalStorage && localStorage.getItem('logged_in')) {
        setTimeout(function () {
            $('#login_password').focus()
        }, 10)
    } else {
        showWelcomeScreen()
    }

    $('#lockscreen_loading').hide()
    $('#lockscreen_content').show()
}

function unlock () {
    if (BRS.hasLocalStorage && !localStorage.getItem('logged_in')) {
        localStorage.setItem('logged_in', true)
    }

    $('#lockscreen').hide()
    $('#main_wrapper').show()

    $('#login_error').html('').hide()

    $(document.documentElement).scrollTop(0)
}

export function logout () {
    setDecryptionPassword('')
    setEncryptionPassword('')
    setSavedPassword('')
    window.location.reload()
}
