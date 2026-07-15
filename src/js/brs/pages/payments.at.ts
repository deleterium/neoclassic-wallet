import { BRS } from '..'

import { sendRequest } from '../core/send_request'

import { formatNQTAsAmount } from '../core/numbers'

import { dataLoaded } from '../core/util'

import { GetAccountATsResponse } from '../typings'

// Current page is 'at'
// Do not handle unconfirmed neither new blocks nor transactions.

export async function pagesAt() {
    const response: GetAccountATsResponse = await sendRequest('getAccountATs', {
        account: BRS.account,
    })

    if (!response.ats) {
        dataLoaded('')
    }
    let rows = ''
    for (const at of response.ats) {
        rows += `
            <tr>
                <td>${at.atRS}</td>
                <td>${at.name}</td>
                <td>${at.description}</td>
                <td>${formatNQTAsAmount(at.balanceNQT)}</td>
            </tr>`
    }
    dataLoaded(rows)
}
