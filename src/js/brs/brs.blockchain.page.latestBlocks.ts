import { BRS } from '.'

import {
    reloadCurrentPage,
} from './brs.navigation'

import {
    sendRequest
} from './brs.sendRequest'

import { GetBlocksResponse } from '../typings'

import { drawBlocksInCurrentPage } from './brs.blockchain.tools'

/**
 * Draws the page 'Blockchain' -> 'Latest blocks'
 * @param blockheight Block to show
 */
export function pagesLatestBlocks () {
    sendRequest('getBlocks', {
        firstIndex: 0,
        lastIndex: BRS.pageSize
    }, function (response: GetBlocksResponse) {
        if (response.errorCode) {
            drawBlocksInCurrentPage([])
            return
        }
        drawBlocksInCurrentPage(response.blocks)
    })
}

export function incomingLatestBlocks () {
    reloadCurrentPage()
}
