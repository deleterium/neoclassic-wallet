/**
 * @depends {brs.js}
 * @depends {brs.modals.js}
 */

import { BRS } from '.'

import { sendRequest } from './brs.server'

import {
    formatVolume,
    formatNQTAsAmount,
    formatTimestampAsDateTime
} from './brs.numbers'

import { GetStateResponse } from '../typings'

export function evBrsModalServerInfoOnShowBsModal () {
    if (BRS.fetchingModalData) {
        return
    }

    BRS.fetchingModalData = true

    sendRequest('getState', {}, function (state: GetStateResponse) {
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

    })
}
