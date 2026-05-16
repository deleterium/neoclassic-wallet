/**
 * @depends {brs.js}
 */
import { BRS } from '.'

import {
    sendRequest
} from './brs.server'

import { formatAmount } from './brs.numbers'

import {
    dataLoaded
} from './brs.util'

export function pagesAt () {
    sendRequest('getAccountATs', {
        account: BRS.account
    }, function (response) {
        let rows = ''
        if (response.ats && response.ats.length) {
            for (const at of response.ats) {
                rows += '<tr><td>' + String(at.atRS).escapeHTML() + '</td><td>' + String(at.name).escapeHTML() + '</td><td>' + String(at.description).escapeHTML() + '</td><td>' + formatAmount(at.balanceNQT) + '</td></tr>'
            }
        }
        dataLoaded(rows)
    })
}
