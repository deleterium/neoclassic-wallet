import { BRS } from '..'

import { sendRequestA } from '../core/send_request'

import { formatNQTAsAmount } from '../core/numbers'

import { dataLoaded } from '../core/util'

import { GetAccountATsResponse } from '../typings'

export async function pagesAt() {
    const response: GetAccountATsResponse = await sendRequestA('getAccountATs', {
        account: BRS.account,
    })

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
}
