import { BRS } from '.';
import { formatTimestampAsDateTime, formatQNTAsQuantity } from './brs.numbers';
import { sendRequest } from './brs.server';
import { getAccountFormatted, getAccountTitle, dataLoaded } from './brs.util';

export function pagesTransferHistory() {
    sendRequest('getAssetTransfers+', {
        account: BRS.accountRS,
        firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
        lastIndex: BRS.pageSize * BRS.pageNumber
    }, function (response) {
        if (response.transfers && response.transfers.length) {
            if (response.transfers.length > BRS.pageSize) {
                BRS.hasMorePages = true;
                response.transfers.pop();
            }
            const transfers = response.transfers;
            let rows = '';
            for (let i = 0; i < transfers.length; i++) {
                transfers[i].quantityQNT = new BigInteger(transfers[i].quantityQNT);
                const type = transfers[i].recipientRS === BRS.accountRS ? 'receive' : 'send';
                rows += `
                    <tr>
                        <td><a href='#' data-transaction='${String(transfers[i].assetTransfer).escapeHTML()}'>${String(transfers[i].assetTransfer).escapeHTML()}</a></td>
                        <td><a href='#' data-goto-asset='${String(transfers[i].asset).escapeHTML()}'>${String(transfers[i].name).escapeHTML()}</a></td>
                        <td>${formatTimestampAsDateTime(transfers[i].timestamp)}</td>
                        <td style='color:${type === 'receive' ? 'green' : 'red'}'>${formatQNTAsQuantity(transfers[i].quantityQNT, transfers[i].decimals)}</td>
                        <td><a href='#' data-user='${getAccountFormatted(transfers[i], 'recipient')}' class='user_info'>${getAccountTitle(transfers[i], 'recipient')}</a></td>
                        <td><a href='#' data-user='${getAccountFormatted(transfers[i], 'sender')}' class='user_info'>${getAccountTitle(transfers[i], 'sender')}</a></td>
                    </tr>`;
            }
            dataLoaded(rows);
        } else {
            dataLoaded();
        }
    });
}
