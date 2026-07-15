import { BRS } from '..'

import { sendRequest } from '../core/send_request'

import { formatNQTAsAmount, parseAmountToNumber } from '../core/numbers'

import { dataLoaded, getAccountTitleFromObject } from '../core/util'

import { GetAccountEscrowTransactionsResponse } from '../typings'

import { recipientToId } from '../modals/sendmoney'

// Current page is 'escrow'
// Do not handle unconfirmed neither new blocks nor transactions.

export async function pagesEscrow() {
    const response: GetAccountEscrowTransactionsResponse = await sendRequest('getAccountEscrowTransactions', {
        account: BRS.account,
    })

    if (!response.escrows || response.escrows.length === 0) {
        dataLoaded()
        return
    }
    let rows = ''
    for (const escrow of response.escrows) {
        rows += `
            <tr>
              <td><a href='#' data-escrow='${escrow.id}'>${escrow.id}</a></td>
              <td>${getAccountTitleFromObject(escrow, 'sender')}</td>
              <td>${getAccountTitleFromObject(escrow, 'recipient')}</td>
              <td>`
        for (let i = 0; i < escrow.signers.length; i++) {
            if (i !== 0) rows += '<br>'
            rows += getAccountTitleFromObject(escrow.signers[i], 'id')
        }
        rows += `
              </td>
              <td>${formatNQTAsAmount(escrow.amountNQT)}</td>
            </tr>`
    }
    dataLoaded(rows)
}

export function formsSendMoneyEscrow(data: any) {
    // Calculate deadline in seconds from the inputs
    let totalSeconds = 0
    try {
        totalSeconds += parseAmountToNumber(data.deadlineSeconds)
        totalSeconds += 60 * parseAmountToNumber(data.deadlineMinutes)
        totalSeconds += 60 * 60 * parseAmountToNumber(data.deadlineHours)
        totalSeconds += 24 * 60 * 60 * parseAmountToNumber(data.deadlineDays)
    } catch {
        return {
            error: $.t('invalid_deadline_number'),
        }
    }
    delete data.deadlineSeconds
    delete data.deadlineMinutes
    delete data.deadlineHours
    delete data.deadlineDays
    data.escrowDeadline = totalSeconds

    // Parse the signers, maybe RS or contact name. Must be ID only.
    const inputSigners = data.signers.split(';')
    const outputSigners: string[] = []
    for (const inSigner of inputSigners) {
        const accountId = recipientToId(inSigner.trim())
        if (accountId === '') {
            return {
                error: $.t('name_not_in_contacts', { name: inSigner }),
            }
        }
        outputSigners.push(accountId)
    }
    data.signers = outputSigners.join(';')

    return {
        data,
    }
}
