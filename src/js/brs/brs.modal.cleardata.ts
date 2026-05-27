import { BRS } from '.'

import { logout } from './brs.login'

import { drop } from './brs.database'

export function formsClearData (data: any) {
    const onDropped = function (error: Error | null) {
        if (error !== null) {
            alert('Something wrong happened')
        } else {
            console.log('Table deleted')
        }
    }

    if (!BRS.databaseSupport) {
        return { error: $.t('error_no_db_support') }
    }

    if (!data.contacts && !data.assets && !data.settings) {
        return { error: $.t('error_nothing_select') }
    }

    if (data.contacts) {
        drop('contacts', onDropped)
    }
    if (data.assets) {
        drop('assets', onDropped)
    }
    if (data.settings) {
        drop('data', onDropped)
        localStorage.removeItem('i18next_lng')
        localStorage.removeItem('logged_in')
        localStorage.removeItem('burst.node')
        localStorage.removeItem('burst.passphrase')
        localStorage.removeItem('theme')
    }

    setTimeout(logout, 250)
    return { stop: true, hide: true }
}
