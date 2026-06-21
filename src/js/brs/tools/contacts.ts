import { BRS } from '..'

import {
    reloadCurrentPage,
} from '../core/navigation'

import {
    dbGet,
    dbPut,
    deleteRecord
} from '../core/database'

import { DBContact } from '../typings'

export function loadContactsFromDB () {
    if (!BRS.databaseSupport) return

    dbGet('contacts', function (error, items: DBContact[]) {
        if (error) return
        items.forEach(contact => {
            BRS.contacts[contact.accountRS] = contact
        })
    })
}

export function getContactByName (nameToFind: string) : DBContact | undefined {
    for (const key in BRS.contacts) {
        if (BRS.contacts[key].name === nameToFind) {
            return BRS.contacts[key]
        }
    }
}

export function notifyContactOperationSuccess (message: string) {
    $.notify(message, { type: 'success' })
    if (BRS.currentPage === 'contacts') {
        reloadCurrentPage()
        return
    }
    if (BRS.currentPage === 'messages' && BRS.selectedContext) {
        const heading = BRS.selectedContext.find('h4.list-group-item-heading')
        if (heading.length) {
            // TODO solve next line
            heading.html('data.name.escapeHTML()')
        }
    }
}

export function saveContactToDatabase(data: DBContact, message: string) {
    // Just insertion, no validation
    const record = {
        name: data.name,
        email: data.email,
        account: data.account,
        accountRS: data.accountRS,
        description: data.description
    }
    BRS.contacts[data.accountRS] = record
    if (!BRS.databaseSupport) {
        $.notify(message + ' ' + $.t('contacts_no_db_warning'), { type: 'warning' })
        return
    }
    dbPut('contacts', record, function (error) {
        if (error) {
            $.notify($.t('error_save_db'))
            return
        }
        setTimeout(notifyContactOperationSuccess, 50, message)
    });
}

export function removeContactFromDB(accountRs: string) {
    deleteRecord('contacts', { accountRs }, function (error) {
        if (error) {
            setTimeout(notifyContactOperationSuccess, 50, $.t('error_save_db'))
            return
        }
        setTimeout(notifyContactOperationSuccess, 50, $.t('success_contact_delete'))
    })
}
