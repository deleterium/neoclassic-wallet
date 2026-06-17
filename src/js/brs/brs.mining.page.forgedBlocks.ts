import { BRS } from '.';
import { GetAccountBlocksResponse } from '../typings';
import { blocksPageLoaded } from './brs.blocks';
import { sendRequest } from './brs.server';

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
            blocksPageLoaded([]);
            return;
        }
        // We have blocks!
        blocksPageLoaded(response.blocks);
    });
}
