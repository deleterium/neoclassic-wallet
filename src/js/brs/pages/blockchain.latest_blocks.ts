import { BRS } from '..'

import { reloadCurrentPage } from '../core/navigation'

import { sendRequestA } from '../core/send_request'

import { GetBlocksResponse } from '../typings'

import { drawBlocksInCurrentPage } from '../tools/blockchain'

/**
 * Draws the page 'Blockchain' -> 'Latest blocks'
 * @param blockheight Block to show
 */
export async function pagesLatestBlocks() {
    const response: GetBlocksResponse = await sendRequestA('getBlocks', {
        firstIndex: 0,
        lastIndex: BRS.pageSize,
    })

    if (response.errorCode) {
        drawBlocksInCurrentPage([])
        return
    }
    drawBlocksInCurrentPage(response.blocks)
}

export function incomingLatestBlocks() {
    reloadCurrentPage()
}
