import { HexString, ParseTransactionResponse } from '../typings'

import { createInfoTable } from '../core/util'
import { showModal } from '../core/modals'

export function showRawTransactionModal(unsignedTransactionBytes: HexString, signedTransactionBytes: HexString) {
    $('#raw_transaction_modal_unsigned_transaction_bytes').val(unsignedTransactionBytes)
    $('#raw_transaction_modal_transaction_bytes').val(signedTransactionBytes)
    showModal('raw_transaction')
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
