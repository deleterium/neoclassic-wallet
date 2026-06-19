import { BRS } from '.';
import { GetAssetTransfersResponse } from '../typings';
import { formatTimestampAsDateTime, formatQNTAsQuantity } from './brs.numbers';
import { sendRequest } from './brs.sendRequest';
import { getAccountRSFromObject, getAccountTitleFromObject, dataLoaded } from './brs.util';

export function pagesTransferHistory() {
    sendRequest('getAssetTransfers+', {
        account: BRS.accountRS,
        firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
        lastIndex: BRS.pageSize * BRS.pageNumber
    }, function (response: GetAssetTransfersResponse) {
        if (response.transfers && response.transfers.length) {
            if (response.transfers.length > BRS.pageSize) {
                BRS.hasMorePages = true;
                response.transfers.pop();
            }
            if (response.errorCode) {
                $.notify(response.errorDescription || "API getAssetTransfers error.")
                dataLoaded();
                return
            }
            const transfers = response.transfers;
            let rows = '';
            for (const transfer of transfers) {
                const type = transfer.recipientRS === BRS.accountRS ? 'receive' : 'send';
                rows += `
                    <tr>
                      <td>
                        <a href='#' data-transaction='${String(transfer.assetTransfer).escapeHTML()}'>
                          ${String(transfer.assetTransfer).escapeHTML()}
                        </a>
                      </td>
                      <td>
                        <a href='#' data-goto-asset='${String(transfer.asset).escapeHTML()}'>
                          ${String(transfer.name).escapeHTML()}
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
                    </tr>`;
            }
            dataLoaded(rows);
        } else {
            dataLoaded();
        }
    });
}
