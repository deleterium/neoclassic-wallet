import { BRS } from '..'
import { GetAccountBlocksResponse } from '../typings'
import { drawBlocksInCurrentPage } from '../tools/blockchain'
import { sendRequest } from '../core/send_request'

// Current page is 'forged_blocks'
// Do not handle incoming transactions/blocks

/**
 * Draws the page 'Mining' -> 'Forged block'.
 */
export async function pagesForgedBlocks() {
    const response: GetAccountBlocksResponse = await sendRequest('getAccountBlocks+', {
        account: BRS.account,
        firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
        lastIndex: BRS.pageSize * BRS.pageNumber,
        timestamp: 0,
    })

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
}
