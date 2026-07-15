import { BRS } from '..'

import { sendRequest } from '../core/send_request'

import { formatVolume, formatNQTAsAmount, formatTimestampAsDateTime } from '../core/numbers'

import { GetStateResponse } from '../typings'

export async function evBrsModalServerInfoOnShowBsModal() {
    if (BRS.fetchingModalData) {
        return
    }

    BRS.fetchingModalData = true

    const state: GetStateResponse = await sendRequest('getState', {})
    BRS.fetchingModalData = false

    for (const key in state) {
        const el = $('#brs_node_state_' + key)
        if (el.length) {
            if (key.indexOf('number') !== -1) {
                el.text(formatNQTAsAmount(state[key]))
            } else if (key.indexOf('Memory') !== -1) {
                el.text(formatVolume(state[key]))
            } else if (key === 'time') {
                el.text(formatTimestampAsDateTime(state[key]))
            } else {
                el.text(state[key])
            }
        }
    }
}
