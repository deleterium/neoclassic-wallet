import { BRS } from '..'
import { Note } from '../typings'

export function notify(message: string, options?: any) {
    const note: Note = {
        timestamp: Date.now(),
        message,
        type: options?.type || 'warning',
    }
    BRS._notifications.push(note)
    $.notify(message, options)
}

export function getNotifications(firstItem: number, lastItem: number) {
    const first = -lastItem - 1
    let last: number | undefined
    if (firstItem !== 0) last = -firstItem
    const portion = BRS._notifications.slice(first, last)
    return portion.reverse()
}

export function setNotifications() {
    // Default location for notify message (set once)
    $.notifyDefaults({
        placement: { from: 'bottom', align: 'right' },
        offset: 10,
    })
}
