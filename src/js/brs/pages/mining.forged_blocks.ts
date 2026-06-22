import { BRS } from '..'
import { GetAccountBlocksResponse } from '../typings'
import { drawBlocksInCurrentPage } from '../tools/blockchain'
import { sendRequest } from '../core/send_request'

/**
 * Draws the page 'Mining' -> 'Forged block'.
 */
export function pagesForgedBlocks() {
    sendRequest(
        'getAccountBlocks+',
        {
            account: BRS.account,
            firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
            lastIndex: BRS.pageSize * BRS.pageNumber,
            timestamp: 0,
        },
        function (response: GetAccountBlocksResponse) {
            if (!response.blocks || response.blocks.length === 0) {
                drawBlocksInCurrentPage([])
                return
            }
            if (response.blocks.length > BRS.pageSize) {
                BRS.hasMorePages = true
                response.blocks.pop()
            }
            // We have blocks!
            drawBlocksInCurrentPage(response.blocks)
        },
    )
}
