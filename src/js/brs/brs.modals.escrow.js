/**
 * @depends {brs.js}
 * @depends {brs.modals.js}
 */

import { BRS } from '.'

import { sendRequest } from './brs.server'

import { formatTimestamp } from './brs.util'

export function showEscrowDecisionModal (escrow) {
    if (BRS.fetchingModalData) {
        return
    }

    BRS.fetchingModalData = true

    if (typeof escrow !== 'object') {
        sendRequest('getEscrowTransaction', {
            escrow
        }, function (response) {
            processEscrowDecisionModalData(response)
        })
    } else {
        processEscrowDecisionModalData(escrow)
    }
}

export function processEscrowDecisionModalData (escrow) {
    $('#escrow_decision_escrow').val(escrow.id)
    $('#escrow_decision_escrow_info').val(escrow.id)
    let decisions = ''
    for (let i = 0; i < escrow.signers.length; i++) {
        decisions += escrow.signers[i].idRS + ' ' + escrow.signers[i].decision + '<br />'
    }
    $('#escrow_decision_decisions').html(decisions)
    $('#escrow_decision_required').html(escrow.requiredSigners + ' signers required')
    $('#escrow_decision_deadline').html('Defaults to ' + escrow.deadlineAction + ' at ' + formatTimestamp(escrow.deadline))

    $('#escrow_decision_modal').modal('show')
    BRS.fetchingModalData = false
}
