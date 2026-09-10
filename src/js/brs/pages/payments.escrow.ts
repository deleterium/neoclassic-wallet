import { BRS } from '..'

import { sendRequest } from '../core/send_request'

import { formatNQTAsAmount, parseAmountToNumber } from '../core/numbers'

import { convertNumericToRSAccountFormat, dataLoaded, getAccountTitleFromObject, getUnconfirmedTransactionsFromCache } from '../core/util'

import { Escrow, GetAccountEscrowTransactionsResponse } from '../typings'

import { recipientToId } from '../modals/sendmoney'
import { reloadCurrentPage } from '../core/navigation'

// Current page is 'escrow'
// Processing unconfirmed!

export async function pagesEscrow() {
    const response: GetAccountEscrowTransactionsResponse = await sendRequest('getAccountEscrowTransactions', {
        account: BRS.account,
    })

    const unconfirmedTX = getUnconfirmedTransactionsFromCache(21, 0) ?? []
    const unconfEscrows: Escrow[] = unconfirmedTX.map((tx) => {
        return {
            id: '0',
            sender: tx.sender,
            senderRS: tx.senderRS,
            recipient: tx.recipient as string,
            recipientRS: tx.recipientRS as string,
            amountNQT: tx.attachment.amountNQT,
            requiredSigners: tx.attachment.requiredSigners,
            deadline: tx.attachment.deadline,
            deadlineAction: tx.attachment.deadlineAction,
            signers: tx.attachment.signers.map((id: string) => {
                return {
                    decision: 'undecided',
                    id,
                    idRS: convertNumericToRSAccountFormat(id),
                }
            }),
        }
    })

    const escrows = unconfEscrows.concat(response.escrows)

    if (escrows.length === 0) {
        dataLoaded()
        return
    }
    let rows = ''
    for (const escrow of escrows) {
        let idHTML = `<a href='#modal=escrow_decision&escrow=${escrow.id}'>${escrow.id}</a>`
        if (escrow.id === '0') idHTML = BRS.pendingTransactionHTML
        rows += `
            <tr>
              <td>${idHTML}</td>
              <td>${getAccountTitleFromObject(escrow, 'sender')}</td>
              <td>${getAccountTitleFromObject(escrow, 'recipient')}</td>
              <td>`
        for (let i = 0; i < escrow.signers.length; i++) {
            if (i !== 0) rows += '<br>'
            rows += getAccountTitleFromObject(escrow.signers[i], 'id')
            rows += ' - '

            const unconfirmedSignature = getUnconfirmedTransactionsFromCache(21, 1, {
                sender: escrow.signers[i].id,
                attachment: { escrowId: escrow.id },
            })
            if (unconfirmedSignature) {
                rows += $.t(unconfirmedSignature[0].attachment.decision) + ' ' + BRS.pendingTransactionHTML
            } else {
                rows += $.t(escrow.signers[i].decision)
            }
        }
        rows += `
              </td>
              <td>${formatNQTAsAmount(escrow.amountNQT)}</td>
            </tr>`
    }
    dataLoaded(rows)
}

export function incomingEscrow() {
    if (BRS.checkIncoming.newBlock || BRS.checkIncoming.unconfirmedChanged) {
        reloadCurrentPage()
    }
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
            error: $.t('error_invalid_field', { field: $.t('deadline') }),
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
