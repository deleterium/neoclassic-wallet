import { BRS } from '..'

import { sendRequestA } from '../core/send_request'

import { formatVolume, formatNQTAsAmount, formatTimestampAsDateTime } from '../core/numbers'

import { GetStateResponse } from '../typings'

export async function evBrsModalServerInfoOnShowBsModal() {
    if (BRS.fetchingModalData) {
        return
    }

    BRS.fetchingModalData = true

    const state: GetStateResponse = await sendRequestA('getState', {})
    BRS.fetchingModalData = false

    for (const key in state) {
        const el = $('#brs_node_state_' + key)
        if (el.length) {
            if (key.indexOf('number') !== -1) {
                el.html(formatNQTAsAmount(state[key]))
            } else if (key.indexOf('Memory') !== -1) {
                el.html(formatVolume(state[key]))
            } else if (key === 'time') {
                el.html(formatTimestampAsDateTime(state[key]))
            } else {
                el.html(String(state[key]).escapeHTML())
            }
        }
    }
}
