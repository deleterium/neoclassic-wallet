import { BRS } from '..';
import { GetAccountBlocksResponse } from '../typings';
import { drawBlocksInCurrentPage } from '../tools/blockchain';
import { sendRequest } from '../core/send_request';

/**
 * Draws the page 'Mining' -> 'Forged block'.
 */
export function pagesForgedBlocks() {
    sendRequest('getAccountBlocks+', {
        account: BRS.account,
        firstIndex: 0,
        lastIndex: BRS.pageSize,
        timestamp: 0
    }, function (response: GetAccountBlocksResponse) {
        if (!response.blocks || response.blocks.length === 0) {
            drawBlocksInCurrentPage([]);
            return;
        }
        // We have blocks!
        drawBlocksInCurrentPage(response.blocks);
    });
}
