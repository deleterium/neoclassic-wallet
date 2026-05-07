/**
 * @depends {brs.js}
 * @depends {brs.modals.js}
 */

import { createInfoTable } from './brs.util'

export function showRawTransactionModal (transaction) {
    $('#raw_transaction_modal_unsigned_transaction_bytes').val(transaction.unsignedTransactionBytes)
    $('#raw_transaction_modal_transaction_bytes').val(transaction.transactionBytes)

    $('#raw_transaction_modal').modal('show')
}

export function formsBroadcastTransactionComplete () {
    $('#parse_transaction_form').find('.error_message').hide()
}

export function formsParseTransactionComplete (response) {
    $('#parse_transaction_form').find('.error_message').hide()
    $('#parse_transaction_output_table tbody').empty().append(createInfoTable(response))
    $('#parse_transaction_output').show()
}

export function formsParseTransactionError () {
    $('#parse_transaction_output_table tbody').empty()
    $('#parse_transaction_output').hide()
}

export function formsCalculateFullHashComplete (response) {
    $('#calculate_full_hash_form').find('.error_message').hide()
    $('#calculate_full_hash_output_table tbody').empty().append(createInfoTable(response))
    $('#calculate_full_hash_output').show()
}

export function formsCalculateFullHashError () {
    $('#calculate_full_hash_output_table tbody').empty()
    $('#calculate_full_hash_output').hide()
}
