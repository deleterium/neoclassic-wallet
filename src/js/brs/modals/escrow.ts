import { BRS } from '..'

import { sendRequest } from '../core/send_request'

import { formatTimestampAsDateTime } from '../core/numbers'

import { Escrow, GetEscrowTransactionResponse } from '../typings'
import { getAccountTitleFromObject } from '../core/util'

export function showEscrowDecisionModal (escrow: Escrow | string) {
    if (BRS.fetchingModalData) {
        return
    }
    if (typeof escrow === 'object') {
        processEscrowDecisionModalData(escrow)
        return
    }
    // Fetch escrow details
    BRS.fetchingModalData = true
    sendRequest('getEscrowTransaction', {
        escrow
    }, function (response: GetEscrowTransactionResponse) {
        BRS.fetchingModalData = false
        processEscrowDecisionModalData(response)
    })
}

export function processEscrowDecisionModalData (escrow: Escrow) {
    $('#escrow_decision_escrow').val(escrow.id)
    $('#escrow_decision_escrow_info').val(escrow.id)
    let decisions = ''
    for (let i = 0; i < escrow.signers.length; i++) {
        decisions += getAccountTitleFromObject(escrow.signers[i], 'id') + ': ' + $.t(escrow.signers[i].decision) + '<br />'
    }
    $('#escrow_decision_decisions').html(decisions)
    $('#escrow_decision_required').text($.t('number_of_required_signers') + ': ' + escrow.requiredSigners)
    $('#escrow_decision_deadline').text($.t('escrow_deadline_action') + ': ' + $.t(escrow.deadlineAction) + ' -- ' + formatTimestampAsDateTime(escrow.deadline))

    $('#escrow_decision_modal').modal('show')
}
