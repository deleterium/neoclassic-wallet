/**
 * @depends {brs.js}
 */

import { BRS } from '.'

import { pageLoaded } from './brs'

import { submitForm } from './brs.forms'

import { dbGet, dbPut, update } from './brs.database'

import {
    convertToNXT
} from './brs.util'

export function pagesSettings () {
    $('#settings_language').val(BRS.settings.language)
    $('#settings_page_size').val(String(BRS.settings.page_size))
    $('#settings_submit_on_enter').prop('checked', BRS.settings.submit_on_enter)
    $('#settings_theme_dark').prop('checked', BRS.settings.theme_dark)
    $('#settings_small_text').prop('checked', BRS.settings.small_text)

    $('#settings_amount_warning').val(convertToNXT(BRS.settings.amount_warning))
    $('#settings_fee_warning').val(convertToNXT(BRS.settings.fee_warning))
    $('#settings_asset_transfer_warning').val(BRS.settings.asset_transfer_warning)

    pageLoaded()
}

export function getSettings () {
    if (BRS.databaseSupport) {
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
            applySettings()
        })
    } else {
        BRS.settings = BRS.defaultSettings
        applySettings()
    }
}

function applySettings (key) {
    if (!key || key === 'language') {
        $.i18n.changeLanguage(BRS.settings.language, function (err, _t) {
            if (err) return console.log('i18next changeLanguage error loading ', err)
            $('[data-i18n]').localize()
        })
        if (BRS.inApp) {
            parent.postMessage({
                type: 'language',
                version: BRS.settings.language
            }, '*')
        }
    }

    if (!key || key === 'submit_on_enter') {
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

    if (!key || key === 'automatic_node_selection') {
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

    if (!key || key === 'page_size') {
        BRS.pageSize = Number(BRS.settings.page_size)
    }

    if (!key || key === 'theme_dark') {
        if (BRS.settings.theme_dark ^ $('body').hasClass('dark-mode')) {
            $('body').toggleClass('dark-mode')
        }
    }

    if (!key || key === 'small_text') {
        if (BRS.settings.small_text ^ $('body').hasClass('text-sm')) {
            $('body').toggleClass('text-sm')
        }
    }

    if (!key || key === 'remember_passphrase') {
        if (BRS.settings.remember_passphrase) {
            $('#remember_password').prop('checked', true)
        } else {
            $('#remember_password').prop('checked', false)
        }
    }

    if (!key || key === 'remember_account') {
        if (BRS.settings.remember_account) {
            $('#remember_account').prop('checked', true)
            $('#login_account').val(BRS.settings.remember_account_account)
        } else {
            $('#remember_account').prop('checked', false)
            $('#login_account').val('')
        }
    }
}

export function updateSettings (key, value) {
    if (key) {
        BRS.settings[key] = value
    }

    if (BRS.databaseSupport) {
        update('data', {
            contents: JSON.stringify(BRS.settings)
        }, {
            id: 'settings'
        })
    }

    applySettings(key)
}
