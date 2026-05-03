/**
 * @depends {brs.js}
 */

import { BRS } from '.'

import { checkMinimumFee, showFeeSuggestionsNG } from './brs'

import {
    unlockForm
} from './brs.forms'

import {
    convertToNQT,
    formatAmount
} from './brs.util'

import {
    evSpanRecipientSelectorClickButton,
    evSpanRecipientSelectorClickUlLiA
} from './brs.recipient'

import { drawAttachmentMessages } from './brs.modals.transaction'

import {
    getAccountId,
    setDecryptionPassword
} from './brs.encryption'

export function setupLockableModal () {
    // save the original function object
    const _superModal = $.fn.modal

    // add locked as a new option
    $.extend(_superModal.Constructor.DEFAULTS, {
        locked: false
    })

    // capture the original hide
    const _hide = _superModal.Constructor.prototype.hide

    // add the lock, unlock and override the hide of modal
    $.extend(_superModal.Constructor.prototype, {
        // locks the dialog so that it cannot be hidden
        lock: function () {
            this.locked = true
            $(this._element).addClass('locked')
        }, // unlocks the dialog so that it can be hidden by 'esc' or clicking on the backdrop (if not static)

        unlock: function () {
            this.locked = false
            $(this._element).removeClass('locked')
        },
        // override the original hide so that the original is only called if the modal is unlocked
        hide: function () {
            if (this.locked) return
            _hide.apply(this, arguments)
        }
    })
}

export function evAddRecipientsClick (e) {
    e.preventDefault()
    if ($('#send_money_same_out_checkbox').is(':checked')) {
        $('#multi_out_same_recipients').append($('#additional_multi_out_same_recipient').html()) // add input box
    } else {
        $('#multi_out_recipients').append($('#additional_multi_out_recipient').html()) // add input box
    }
    $('input[name=recipient_multi_out_same]').off('blur').on('blur', evMultiOutSameAmountChange)
    $('input[name=recipient_multi_out]').off('blur').on('blur', evMultiOutAmountChange)
    $('input[name=amount_multi_out]').off('blur').on('blur', evMultiOutAmountChange)
    $('.remove_recipient .remove_recipient_button').off('click').on('click', evDocumentOnClickRemoveRecipient)

    $('span.recipient_selector').on('click', 'button', evSpanRecipientSelectorClickButton)
    $('span.recipient_selector').on('click', 'ul li a', evSpanRecipientSelectorClickUlLiA)
}

export function evDocumentOnClickRemoveRecipient (e) {
    e.preventDefault()
    $(this).parent().parent('div').remove()

    if ($('#send_money_same_out_checkbox').is(':checked')) {
        evMultiOutSameAmountChange()
    } else {
        evMultiOutAmountChange()
    }
}

export function evMultiOutAmountChange (e) {
    // get amount for each recipient
    let amount_total = 0
    $('#multi_out_recipients .row').each(function (index, row) {
        const recipient = $(row).find('input[name=recipient_multi_out]').val()
        const value = $(row).find('input[name=amount_multi_out]').val()
        const current_amount = parseFloat(value, 10)
        const amount = isNaN(current_amount) ? 0 : (current_amount < 0.00000001 ? 0 : current_amount)
        if (recipient !== '') {
            amount_total += amount
        }
    })
    const current_fee = parseFloat($('#multi_out_fee').val(), 10)
    const fee = checkMinimumFee(current_fee)
    // $("#multi_out_fee").val(fee.toFixed(8));
    amount_total += fee

    $('#total_amount_multi_out').html(formatAmount(convertToNQT(amount_total)) + ' ' + BRS.valueSuffix)
}

export function evMultiOutSameAmountChange () {
    let amount_total = 0
    const current_amount = parseFloat($('#multi_out_same_amount').val(), 10)
    const current_fee = parseFloat($('#multi_out_fee').val(), 10)
    const amount = isNaN(current_amount) ? 0 : (current_amount < 0.00000001 ? 0 : current_amount)
    const fee = checkMinimumFee(current_fee)

    $('#multi_out_same_recipients input[name=recipient_multi_out_same]').each(function () {
        if ($(this).val() !== '') {
            amount_total += amount
        }
    })
    amount_total += fee

    $('#total_amount_multi_out').html(formatAmount(convertToNQT(amount_total)) + ' ' + BRS.valueSuffix)
}

export function evSameOutCheckboxChange (e) {
    $('#total_amount_multi_out').html('?')
    if ($(this).is(':checked')) {
        $('#multi_out_same_recipients').fadeIn()
        $('#row_multi_out_same_amount').fadeIn()
        $('#multi_out_recipients').hide()
        evMultiOutSameAmountChange()
    } else {
        $('#multi_out_same_recipients').hide()
        $('#row_multi_out_same_amount').hide()
        $('#multi_out_recipients').fadeIn()
        evMultiOutAmountChange()
    }
}

export function evMultiOutFeeChange (e) {
    if ($('#send_money_same_out_checkbox').is(':checked')) {
        evMultiOutSameAmountChange()
    } else {
        evMultiOutAmountChange()
    }
}

// hide modal when another one is activated.
export function evModalOnShowBsModal (e) {
    const $visible_modal = $('.modal.show')
    if ($visible_modal.length) {
        if ($visible_modal.hasClass('locked')) {
            const $btn = $visible_modal.find('button.btn-primary:not([data-dismiss=modal])')
            unlockForm($visible_modal, $btn, true)
        } else {
            $visible_modal.modal('hide')
        }
    }

    showFeeSuggestionsNG(e.target)
}

export function resetModalMultiOut () {
    $('#multi_out_recipients').empty()
    $('#multi_out_same_recipients').empty()
    $('#multi_out_same_recipients').hide()
    $('#row_multi_out_same_amount').hide()
    $('#multi_out_recipients').fadeIn()
    $('#multi_out_recipients').append($('#additional_multi_out_recipient').html())
    $('#multi_out_recipients').append($('#additional_multi_out_recipient').html())
    $('#multi_out_same_recipients').append($('#additional_multi_out_same_recipient').html())
    $('#multi_out_same_recipients').append($('#additional_multi_out_same_recipient').html())
    $('#multi_out_same_recipients input[name=recipient_multi_out_same]').off('blur').on('blur', evMultiOutSameAmountChange)
    $('#multi_out_recipients input[name=recipient_multi_out]').off('blur').on('blur', evMultiOutAmountChange)
    $('#multi_out_recipients input[name=amount_multi_out]').off('blur').on('blur', evMultiOutAmountChange)
    $('span.recipient_selector').on('click', 'button', evSpanRecipientSelectorClickButton)
    $('span.recipient_selector').on('click', 'ul li a', evSpanRecipientSelectorClickUlLiA)
    $('#send_multi_out .remove_recipient').each(function () {
        $(this).remove()
    })
    $('#send_money_same_out_checkbox').prop('checked', false)
    $('#multi_out_fee').val(0.02)
    $('#multi_out_same_amount').val('')
    $('#send_ordinary_tab').tab('show')
}

// Reset form to initial state when modal is closed
export function evModalOnHiddenBsModal (e) {
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
    $(this).find('span[name=transfer_asset_available]').each(function () {
        $(this).html('')
    })
    $(this).find('span[name=asset-name]').each(function () {
        $(this).html('?')
    })
    // End multi-transfers

    $(this).find(':input:not(button)').each(function (index) {
        const defaultValue = $(this).data('default')
        const type = $(this).attr('type')
        const tag = $(this).prop('tagName').toLowerCase()

        if (type === 'checkbox') {
            if (defaultValue === 'checked') {
                $(this).prop('checked', true)
            } else {
                $(this).prop('checked', false)
            }
        } else if (type === 'hidden') {
            if (defaultValue !== undefined) {
                $(this).val(defaultValue)
            }
        } else if (tag === 'select') {
            if (defaultValue !== undefined) {
                $(this).val(defaultValue)
            } else {
                $(this).find('option:selected').prop('selected', false)
                $(this).find('option:first').prop('selected', 'selected')
            }
        } else {
            if (defaultValue !== undefined) {
                $(this).val(defaultValue)
            } else {
                $(this).val('')
            }
        }
    })

    // Hidden form field
    $(this).find('input[name=converted_account_id]').val('')

    // Hide/Reset any possible error messages
    $(this).find('.callout-danger:not(.never_hide), .error_message, .account_info').html('').hide()

    $(this).find('.advanced').hide()

    $(this).find('.recipient_public_key').hide()

    $(this).find('.optional_message, .optional_note, .optional_sell_to_specific').hide()

    $(this).find('.advanced_info a').text($.t('advanced'))

    $(this).find('.advanced_extend').each(function (index, obj) {
        const normalSize = $(obj).data('normal')
        const advancedSize = $(obj).data('advanced')
        $(obj).removeClass('col-xs-' + advancedSize + ' col-sm-' + advancedSize + ' col-md-' + advancedSize).addClass('col-xs-' + normalSize + ' col-sm-' + normalSize + ' col-md-' + normalSize)
    })

    const $feeInput = $(this).find('input[name=feeNXT]')

    if ($feeInput.length) {
        let defaultFee = $feeInput.data('default')
        if (!defaultFee) {
            defaultFee = 1
        }

        $(this).find('.advanced_fee').html(formatAmount(convertToNQT(defaultFee)) + ' ' + BRS.valueSuffix)
    }

    BRS.showedFormWarning = false
}

export function showModalError (errorMessage, $modal) {
    const $btn = $modal.find('button.btn-primary:not([data-dismiss=modal], .ignore)')

    $modal.find('button').prop('disabled', false)

    $modal.find('.error_message').html(String(errorMessage).escapeHTML()).show()
    $btn.button('reset')
    $modal.modal('unlock')
}

// export function closeModal($modal) {
//     if (!$modal) {
//         $modal = $('div.modal.in:first')
//     }

//     $modal.find('button').prop('disabled', false)

//     const $btn = $modal.find('button.btn-primary:not([data-dismiss=modal], .ignore)')

//     $btn.button('reset')
//     $modal.modal('unlock')
//     $modal.modal('hide')
// }

export function evAdvancedInfoClick (e) {
    e.preventDefault()

    const $modal = $(this).closest('.modal')

    const text = $(this).text()

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
        $(this).text($.t('basic'))
    } else {
        $(this).text($.t('advanced'))
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

    const password = $form.find('input[name=secretPhrase]').val()

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
