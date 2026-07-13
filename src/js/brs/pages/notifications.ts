import { BRS } from '..'

import { getNotifications } from '../core/notifications'
import { dataLoaded } from '../core/util'

// Current page is 'notifications'
// Do not handle incoming transactions/blocks. Update the page thru 'notify' function.

export function pagesNotifications() {
    const notes = getNotifications(BRS.pageSize * (BRS.pageNumber - 1), BRS.pageSize * BRS.pageNumber)
    if (!notes.length) {
        dataLoaded('')
    }
    if (notes.length > BRS.pageSize) {
        BRS.hasMorePages = true
        notes.pop()
    }
    let rows = ''
    for (const note of notes) {
        const date = new Date(note.timestamp)
        rows += `
            <tr>
              <td>${date.toLocaleString(BRS.settings.language)}</td>
              <td>${$.t(note.type)}</td>
              <td>${note.message}</td>
            </tr>`
    }
    dataLoaded(rows)
}
