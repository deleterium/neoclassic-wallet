import { BRS } from '..'
import { Note } from '../typings'

export function notify(message: string, options?: any) {
    const type = options?.type || 'info'
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
        autohide: true,
        fade: true,
        delay: 5000,
        class: `custom-toast bg-${type}`,
        close: false,
    })
}

export function getNotifications(firstItem: number, lastItem: number) {
    const first = -lastItem - 1
    let last: number | undefined
    if (firstItem !== 0) last = -firstItem
    const portion = BRS._notifications.slice(first, last)
    return portion.reverse()
}
