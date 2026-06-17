/**
 * @depends {brs.js}
 */
import { BRS } from '.'

import {
    sendRequest
} from './brs.sendRequest'

import { formatNQTAsAmount } from './brs.numbers'

import {
    dataLoaded
} from './brs.util'

import { GetAccountATsResponse } from '../typings'

export function pagesAt () {
    sendRequest('getAccountATs', {
        account: BRS.account
    }, function (response: GetAccountATsResponse) {
        if (!response.ats) {
            dataLoaded('')
        }
        let rows = ''
        for (const at of response.ats) {
            rows += `
                <tr>
                    <td>${String(at.atRS).escapeHTML()}</td>
                    <td>${String(at.name).escapeHTML()}</td>
                    <td>${String(at.description).escapeHTML()}</td>
                    <td>${formatNQTAsAmount(at.balanceNQT)}</td>
                </tr>`
        }
        dataLoaded(rows)
    })
}
