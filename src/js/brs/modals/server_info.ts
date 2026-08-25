import { BRS } from '..'

import { sendRequest } from '../core/send_request'

import { GetStateResponse } from '../typings'
import { showModal } from '../core/modals'
import { createInfoTable } from '../core/util'

export async function showServerInfoModal() {
    if (BRS.fetchingModalData) {
        return
    }

    BRS.fetchingModalData = true

    const state: GetStateResponse = await sendRequest('getState', {})
    BRS.fetchingModalData = false

    $('#server_info_server').text(BRS.server)
    $('#brs_node_state_table tbody').html(createInfoTable(state))

    showModal('server_info')
}
