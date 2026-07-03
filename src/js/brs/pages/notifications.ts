// import { BRS } from '..'

import { dataLoaded } from '../core/util'

export async function pagesNotifications() {
    // getNotifications
    const notifications = ['a']

    if (!notifications.length) {
        dataLoaded('')
    }
    let rows = ''
    //for (const notification of notifications) {
    rows += `
        <tr>
            <td>${'Data'}</td>
            <td>${'Type'}</td>
            <td>${'Notification text'}</td>
        </tr>`
    // }
    dataLoaded(rows)
}
