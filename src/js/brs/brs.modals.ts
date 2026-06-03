import { BRS } from '.'

import { showFeeSuggestionsNG } from './brs'

import {
    parseAmountToNQT,
    formatNQTAsAmount
} from './brs.numbers'

import { drawAttachmentMessages } from './brs.modals.transaction'

import {
    getAccountId,
    setDecryptionPassword
} from './brs.encryption'

import { resetModalMultiOut } from './brs.modal.sendmoney'

import { unlockModal } from './brs.modal.lockablemodal'

/**
 * @param {JQuery.TriggeredEvent} e
 */
export function evCheckNumberInput(e: JQuery.TriggeredEvent) {
    const inputElement = e.target
    try {
        parseAmountToNQT(String($(inputElement).val()))
        $(inputElement).removeClass('is-invalid')
    } catch {
        $(inputElement).addClass('is-invalid')
    }
}

// hide modal when another one is activated.
export function evModalOnShowBsModal (e: JQuery.TriggeredEvent) {
    const $visible_modal = $('.modal.show')
    if ($visible_modal.length) {
        if ($visible_modal.hasClass('locked')) {
            const $btn = $visible_modal.find('button.btn-primary:not([data-dismiss=modal])') as JQuery<HTMLButtonElement>
            unlockModal($visible_modal, $btn, true)
        } else {
            $visible_modal.modal('hide')
        }
    }

    showFeeSuggestionsNG(e.target)
}

// Reset form to initial state when modal is closed
export function evModalOnHiddenBsModal (event: JQuery.TriggeredEvent) {
    const $modal = $(event.target)
    resetModalMultiOut()

    // Multi-transfers
    $('.multi-transfer').hide()
    $('.transfer-asset').fadeIn()
    if (!$('.transfer-asset-nav').hasClass('active')) {
        $('.transfer-asset-nav').addClass('active')
    }
    if ($('.multi-transfer-nav').toggleClass('active')) {
        $('.multi-transfer-nav').removeClass('active')
    }
    $modal.find('span[name=transfer_asset_available]').each(function () {
        $(this).html('')
    })
    $modal.find('span[name=asset-name]').each(function () {
        $(this).html('?')
    })
    // End multi-transfers

    $modal.find(':input:not(button)').each(function () {
        const $input = $(this)
        const defaultValue = $input.data('default')
        const type = $input.attr('type')
        const tag = $input.prop('tagName').toLowerCase()

        if (type === 'checkbox') {
            if (defaultValue === 'checked') {
                $input.prop('checked', true)
            } else {
                $input.prop('checked', false)
            }
        } else if (type === 'hidden') {
            if (defaultValue !== undefined) {
                $input.val(defaultValue)
            }
        } else if (tag === 'select') {
            if (defaultValue !== undefined) {
                $input.val(defaultValue)
            } else {
                $input.find('option:selected').prop('selected', false)
                $input.find('option:first').prop('selected', 'selected')
            }
        } else {
            if (defaultValue !== undefined) {
                $input.val(defaultValue)
            } else {
                $input.val('')
            }
        }
    })

    // Hidden form field
    $modal.find('input[name=converted_account_id]').val('')

    // Hide/Reset any possible error messages
    $modal.find('.callout-danger:not(.never_hide), .error_message, .account_info').html('').hide()

    $modal.find('.ev-check-number-input').removeClass('is-invalid')

    $modal.find('.advanced').hide()

    $modal.find('.recipient_public_key').hide()

    $modal.find('.optional_message, .optional_note, .optional_sell_to_specific').hide()

    $modal.find('.advanced_info a').text($.t('advanced'))

    $modal.find('.advanced_extend').each(function (index, obj) {
        const normalSize = $(obj).data('normal')
        const advancedSize = $(obj).data('advanced')
        $(obj).removeClass('col-xs-' + advancedSize + ' col-sm-' + advancedSize + ' col-md-' + advancedSize).addClass('col-xs-' + normalSize + ' col-sm-' + normalSize + ' col-md-' + normalSize)
    })

    const $feeInput = $modal.find('input[name=feeNXT]')

    if ($feeInput.length) {
        let defaultFee = $feeInput.data('default')
        if (!defaultFee) {
            defaultFee = 1
        }

        $modal.find('.advanced_fee').html(formatNQTAsAmount(parseAmountToNQT(defaultFee)) + ' ' + BRS.valueSuffix)
    }

    BRS.showedFormWarning = false
}

export function showModalError (errorMessage: string, $modal: JQuery<HTMLElement>) {
    const $btn = $modal.find('button.btn-primary:not([data-dismiss=modal], .ignore)') as JQuery<HTMLButtonElement>

    $modal.find('button').prop('disabled', false)

    $modal.find('.error_message').html(String(errorMessage).escapeHTML()).show()
    unlockModal($modal, $btn, false)
}

export function evAdvancedInfoClick (e: JQuery.ClickEvent) {
    e.preventDefault()

    const $modal = $(e.target).closest('.modal')

    const text = $(e.target).text()

    if (text === $.t('advanced')) {
        $modal.find('.advanced').not('.optional_note').fadeIn()
    } else {
        $modal.find('.advanced').hide()
    }

    $modal.find('.advanced_extend').each(function (index, obj) {
        const normalSize = $(obj).data('normal')
        const advancedSize = $(obj).data('advanced')

        if (text === 'advanced') {
            $(obj).addClass('col-xs-' + advancedSize + ' col-sm-' + advancedSize + ' col-md-' + advancedSize).removeClass('col-xs-' + normalSize + ' col-sm-' + normalSize + ' col-md-' + normalSize)
        } else {
            $(obj).removeClass('col-xs-' + advancedSize + ' col-sm-' + advancedSize + ' col-md-' + advancedSize).addClass('col-xs-' + normalSize + ' col-sm-' + normalSize + ' col-md-' + normalSize)
        }
    })

    if (text === $.t('advanced')) {
        $(e.target).text($.t('basic'))
    } else {
        $(e.target).text($.t('advanced'))
    }
}

export function removeDecryptionForm () {
    $('#decrypt_note_form_container input').val('')
    $('#decrypt_note_form_container').find('.callout').html($.t('passphrase_required_to_decrypt_data'))
    $('#decrypt_note_form_container').hide().detach().appendTo('body')
}

export function decryptNoteFormSubmit () {
    const $form = $('#decrypt_note_form_container')

    if (!BRS._encryptedNote) {
        $form.find('.callout').html($.t('error_encrypted_note_not_found')).show()
        return
    }

    const password = $form.find('input[name=secretPhrase]').val() as string

    if (!password) {
        $form.find('.callout').html($.t('error_passphrase_required')).show()
        return
    }

    const accountId = getAccountId(password)
    if (accountId !== BRS.account) {
        $form.find('.callout').html($.t('error_incorrect_passphrase')).show()
        return
    }

    const rememberPassword = $form.find('input[name=rememberPassword]').is(':checked')
    if (rememberPassword) {
        setDecryptionPassword(password)
    }

    const $output = $('#transaction_info_output_bottom')
    drawAttachmentMessages(BRS._encryptedNote, $output, password)

    BRS._encryptedNote = null
}
