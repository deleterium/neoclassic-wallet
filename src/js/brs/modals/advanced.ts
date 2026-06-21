import { HexString, ParseTransactionResponse, PostResponse } from '../typings'

import { createInfoTable } from '../core/util'

export function showRawTransactionModal(transaction: PostResponse, signedTransactionBytes: HexString) {
    $('#raw_transaction_modal_unsigned_transaction_bytes').val(transaction.unsignedTransactionBytes)
    $('#raw_transaction_modal_transaction_bytes').val(signedTransactionBytes)
    $('#raw_transaction_modal').modal('show')
}

export function formsBroadcastTransactionComplete() {
    $('#parse_transaction_form').find('.error_message').hide()
}

export function formsParseTransactionComplete(response: ParseTransactionResponse) {
    $('#parse_transaction_form').find('.error_message').hide()
    $('#parse_transaction_output_table tbody').html(createInfoTable(response))
    $('#parse_transaction_output').show()
}

export function formsParseTransactionError() {
    $('#parse_transaction_output_table tbody').empty()
    $('#parse_transaction_output').hide()
}
