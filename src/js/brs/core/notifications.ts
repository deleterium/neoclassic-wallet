import { BRS } from '..'
import { Note } from '../typings'
import { reloadCurrentPage } from './navigation'

/**
 * Create a notification for the user.
 * @param {string} message - To be displayed, can be HTML.
 * @param {Object} [options] - Notification options.
 * @param {('danger'|'warning'|'success'|'info')} [options.type] - Notification type: 'danger'|'warning'|'success'|'info'
 * @param {boolean} [options.keep] - Whether to keep the notification visible. Default (false) to auto hide.
 */
export function notify(message: string, options?: any) {
    const type = options?.type || 'info'
    const keep = options?.keep || false
    const note: Note = {
        timestamp: Date.now(),
        message,
        type,
    }
    BRS._notifications.push(note)
    /* @ts-expect-error Toasts are an AdminLTE plugin. */
    $(document).Toasts('create', {
        title: $.t(type),
        body: message,
        position: 'bottomRight',
        autohide: keep ? false : true,
        fade: true,
        delay: 5000,
        class: `custom-toast bg-${type}`,
        close: keep ? true : false,
    })

    if (BRS.currentPage === 'notifications') {
        reloadCurrentPage()
    }
}

export function getNotifications(firstItem: number, lastItem: number) {
    const first = -lastItem - 1
    let last: number | undefined
    if (firstItem !== 0) last = -firstItem
    const portion = BRS._notifications.slice(first, last)
    return portion.reverse()
}
