import i18next from 'i18next'

import { BRS } from '.'

import { pageLoaded } from './brs'

import { submitForm } from './brs.forms'

import { dbGet, dbPut } from './brs.database'

import { formatNQTAsAmount } from './brs.numbers'

export function pagesSettings () {
    $('#settings_language').val(BRS.settings.language)
    $('#settings_page_size').val(String(BRS.settings.page_size))
    $('#settings_submit_on_enter').prop('checked', BRS.settings.submit_on_enter)
    $('#settings_theme_dark').prop('checked', BRS.settings.theme_dark)
    $('#settings_small_text').prop('checked', BRS.settings.small_text)

    $('#settings_amount_warning').val(formatNQTAsAmount(BRS.settings.amount_warning))
    $('#settings_fee_warning').val(formatNQTAsAmount(BRS.settings.fee_warning))
    $('#settings_asset_transfer_warning').val(BRS.settings.asset_transfer_warning)

    pageLoaded()
}

export function loadSettingsFromDB () {
    if (!BRS.databaseSupport) {
        BRS.settings = BRS.defaultSettings
        applySettings('all')
        return
    }
    dbGet('data', {
        id: 'settings'
    }, function (_error, result) {
        if (result) {
            BRS.settings = $.extend({}, BRS.defaultSettings, JSON.parse(result.contents))
        } else {
            dbPut('data', {
                id: 'settings',
                contents: JSON.stringify(BRS.defaultSettings)
            })
            BRS.settings = BRS.defaultSettings
        }
        applySettings('all')
    })
}

function applySettings (key: string) {
    let applyAll = false
    if (key === 'all') applyAll = true

    if (applyAll || key === 'language') {
        i18next.changeLanguage(BRS.settings.language, function (err) {
            if (err) return console.log('i18next changeLanguage error loading ', err)
            $('[data-i18n]').localize()
        })
        if (BRS.inApp) {
            parent.postMessage({
                type: 'language',
                version: BRS.settings.language
            }, '*')
        }
        const parts = new Intl.NumberFormat(BRS.settings.language).formatToParts(1111.1)
        BRS.decimalSign = parts.find(item => item.type === 'decimal')?.value || '.';
        BRS.groupSeparator = parts.find(item => item.type === 'group')?.value || ','
        BRS.durationFormatter = new Intl.DurationFormat(BRS.settings.language, { style: "short" });
    }

    if (applyAll || key === 'submit_on_enter') {
        if (BRS.settings.submit_on_enter) {
            $(".modal form:not('#decrypt_note_form_container')").on('submit.onEnter', function (e) {
                e.preventDefault()
                const $modal = $(this).closest('.modal')
                const $btn = $modal.find('button.btn-primary:not([data-dismiss=modal])')
                submitForm($btn)
            })
        } else {
            $('.modal form').off('submit.onEnter')
        }
    }

    if (applyAll || key === 'automatic_node_selection') {
        if (BRS.settings.automatic_node_selection) {
            $('#automatic_node_selection').prop('checked', true)
            $('#prefered_node').val(BRS.server)
            $('#prefered_node').prop('readonly', true)
        } else {
            $('#automatic_node_selection').prop('checked', false)
            $('#prefered_node').prop('readonly', false)
            $('#prefered_node').val(BRS.settings.prefered_node)
        }
    }

    if (applyAll || key === 'page_size') {
        BRS.pageSize = Number(BRS.settings.page_size)
    }

    if (applyAll || key === 'theme_dark') {
        if (BRS.settings.theme_dark !== $('body').hasClass('dark-mode')) {
            $('body').toggleClass('dark-mode')
        }
    }

    if (applyAll || key === 'small_text') {
        if (BRS.settings.small_text !== $('body').hasClass('text-sm')) {
            $('body').toggleClass('text-sm')
        }
    }

    if (applyAll || key === 'remember_passphrase') {
        if (BRS.settings.remember_passphrase) {
            $('#remember_password').prop('checked', true)
        } else {
            $('#remember_password').prop('checked', false)
        }
    }

    if (applyAll || key === 'remember_account') {
        if (BRS.settings.remember_account) {
            $('#remember_account').prop('checked', true)
            $('#login_account').val(BRS.settings.last_remembered_account)
        } else {
            $('#remember_account').prop('checked', false)
            $('#login_account').val('')
        }
    }
}

/**
 * Updates a specific setting in the BRS settings object and persists it to the database if supported.
 *
 * @param {string} key - The key of the setting to update. This should correspond to a property in BRS.settings.
 * @param {string | number | boolean} value - The new value for the specified setting.
 *
 * @example
 * updateSettings('language', 'en');
 */
export function updateSettings (key: string, value: string| number | boolean) {
    BRS.settings[key] = value
    if (BRS.databaseSupport) {
        dbPut('data', {
            id: 'settings',
            contents: JSON.stringify(BRS.settings)
        })
    }
    applySettings(key)
}
