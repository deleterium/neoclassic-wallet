import { BRS } from '..'
import { DBContact } from '../typings'
import { notifyContactOperationSuccess } from '../tools/contacts'
import { dbGet, dbPut } from '../core/database'
import { dataLoaded, getAccountRSFromObject } from '../core/util'
import { notify } from '../core/notifications'

// Current page is 'contacts'
// It's not need to process incoming blocks.

export function pagesContacts() {
    if (!BRS.databaseSupport) {
        let rows = ''
        for (const key in BRS.contacts) {
            rows += contactToHTMLRow(BRS.contacts[key])
            dataLoaded(rows)
        }
        return
    }

    $('#contacts_table_container').show()
    $('#contact_page_database_error').hide()

    dbGet('contacts', function (error, contacts: DBContact[]) {
        let rows = ''
        if (error || !contacts) {
            dataLoaded(rows)
            return
        }
        contacts.sort(function (a, b) {
            if (a.name.toLowerCase() > b.name.toLowerCase()) {
                return 1
            } else if (a.name.toLowerCase() < b.name.toLowerCase()) {
                return -1
            } else {
                return 0
            }
        })

        for (const contact of contacts) {
            rows += contactToHTMLRow(contact)
        }

        dataLoaded(rows)
    })

    function contactToHTMLRow(contact: DBContact) {
        let contactDescription = contact.description.escapeHTML()
        if (contactDescription.length > 100) {
            contactDescription = contactDescription.substring(0, 97) + '...'
        }

        const cName = contact.name.escapeHTML()
        return `
            <tr>
                <td>
                <a href='#'
                    data-toggle='modal'
                    data-target='#update_contact_modal'
                    data-contact='${cName}'>
                    ${cName}
                </a>
                </td>
                <td>
                <a href='#'
                    data-user='${getAccountRSFromObject(contact, 'account')}'
                    class='user_info'>
                    ${getAccountRSFromObject(contact, 'account')}
                </a>
                </td>
                <td>${contact.email ? contact.email.escapeHTML() : '-'}</td>
                <td>${contactDescription ? contactDescription : '-'}</td>
                <td>
                <div class="btn-group">
                    <a class='btn btn-default'
                    href='#'
                    data-toggle='modal'
                    data-target='#send_money_modal'
                    data-contact='${cName}'>
                    <i class="fas fa-paper-plane"></i>
                    </a>
                    <a class='btn btn-default'
                    href='#'
                    data-toggle='modal'
                    data-target='#send_message_modal'
                    data-contact='${cName}'>
                    <i class="fas fa-envelope"></i>
                    </a>
                    <a class='btn btn-default'
                    href='#'
                    data-toggle='modal'
                    data-target='#delete_contact_modal'
                    data-contact='${cName}'>
                    <i class="fas fa-trash"></i>
                    </a>
                </div>
                </td>
            </tr>`
    }
}

export function exportContacts() {
    if (Object.keys(BRS.contacts).length === 0) {
        console.log('No contacts found in database to backup')
        return
    }
    const contacts_download = document.createElement('a')
    contacts_download.href = 'data:attachment/json,' + encodeURIComponent(JSON.stringify(BRS.contacts))
    contacts_download.target = '_blank'
    contacts_download.download = 'contacts.json'
    document.body.appendChild(contacts_download)
    contacts_download.click()
    document.body.removeChild(contacts_download)
}

/**
 * Validates an incoming JSON object to ensure it has the required structure.
 * @param {Object} jsonObj - The JSON object to validate.
 * @returns {boolean} Returns `true` if the object is valid, otherwise `false`.
 */
function isValidImport(jsonObj: any): boolean {
    if (typeof jsonObj !== 'object' || jsonObj === null) {
        return false
    }
    for (const key in jsonObj) {
        if (!BRS.rsRegEx.test(key)) {
            return false
        }
        const item = jsonObj[key]
        if (typeof item !== 'object' || item === null) {
            return false
        }
        // Check that all fields are present (even if empty)
        const requiredFields = ['name', 'email', 'account', 'accountRS', 'description']
        for (const field of requiredFields) {
            if (!(field in item)) {
                return false
            }
        }
        if (!item.name || !item.account || !item.accountRS) {
            return false
        }
        if (key !== item.accountRS) {
            return false
        }
    }
    return true
}

export function importContacts(imported_contacts: any) {
    if (!isValidImport(imported_contacts)) {
        // TODO TRANSLATION
        notify("File does not match 'contacts' requirements.", { type: 'danger' })
        return
    }

    Object.assign(BRS.contacts, imported_contacts)
    if (!BRS.databaseSupport) {
        notifyContactOperationSuccess($.t('success_contact_add'))
        return
    }

    dbPut('contacts', Object.values(imported_contacts), function (error) {
        if (error) {
            notify($.t('error_save_db'), { type: 'danger' })
            return
        }
        notifyContactOperationSuccess($.t('success_contact_add'))
    })
}
