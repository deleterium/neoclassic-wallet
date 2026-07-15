import { BRS } from '..'
import { GetAssetTransfersResponse } from '../typings'
import { formatTimestampAsDateTime, formatQNTAsQuantity } from '../core/numbers'
import { isErrorResponse, sendRequest } from '../core/send_request'
import { getAccountRSFromObject, getAccountTitleFromObject, dataLoaded } from '../core/util'
import { notify } from '../core/notifications'
import { reloadCurrentPage } from '../core/navigation'

// Current page is 'transfer_history'
// Do not process unconfirmed.

export async function pagesTransferHistory() {
    const response: GetAssetTransfersResponse = await sendRequest('getAssetTransfers+', {
        account: BRS.accountRS,
        firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
        lastIndex: BRS.pageSize * BRS.pageNumber,
    })

    if (response.transfers && response.transfers.length) {
        if (response.transfers.length > BRS.pageSize) {
            BRS.hasMorePages = true
            response.transfers.pop()
        }
        if (isErrorResponse(response)) {
            notify(response.errorDescription)
            dataLoaded()
            return
        }
        const transfers = response.transfers
        let rows = ''
        for (const transfer of transfers) {
            const type = transfer.recipientRS === BRS.accountRS ? 'receive' : 'send'
            rows += `
                <tr>
                  <td>
                    <a href='#' data-transaction='${transfer.assetTransfer}'>
                      ${transfer.assetTransfer}
                    </a>
                  </td>
                  <td>
                    <a href='#' data-goto-asset='${transfer.asset}'>
                      ${transfer.name}
                    </a>
                  </td>
                  <td>${formatTimestampAsDateTime(transfer.timestamp)}</td>
                  <td style='color:${type === 'receive' ? 'green' : 'red'}'>
                    ${formatQNTAsQuantity(transfer.quantityQNT, transfer.decimals)}
                  </td>
                  <td>
                    <a href='#' data-user='${getAccountRSFromObject(transfer, 'recipient')}' class='user_info'>
                      ${getAccountTitleFromObject(transfer, 'recipient')}
                    </a>
                  </td>
                  <td>
                    <a href='#' data-user='${getAccountRSFromObject(transfer, 'sender')}' class='user_info'>
                      ${getAccountTitleFromObject(transfer, 'sender')}
                    </a>
                  </td>
                </tr>`
        }
        dataLoaded(rows)
    } else {
        dataLoaded()
    }
}

export function incomingTransferHistory() {
    if (BRS.checkIncoming.newTransactions) {
        reloadCurrentPage()
    }
}
