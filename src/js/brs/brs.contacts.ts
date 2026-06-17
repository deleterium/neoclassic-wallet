import { BRS } from '.'

import { NxtAddress } from '../util/nxtaddress'

import {
    reloadCurrentPage,
} from './brs'


import {
    dbGet,
    dbPut,
    deleteRecord
} from './brs.database'

import { DBContact, ShowBootstrapModalEvent } from '../typings'

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

/**
 * Test if the data is suitable to be added in contacts database.
 * @param data Object to be tested
 * @returns {string|undefined} String with the error, or undefined if no error.
 */
function checkContactDataError (data: any): string | undefined {
    if (!data.name) {
        return $.t('error_contact_name_required')
    }
    if (!data.account_id) {
        return $.t('error_account_id_required')
    }
    if (BRS.idRegEx.test(data.name) || BRS.rsRegEx.test(data.name)) {
        return $.t('error_contact_name_alpha')
    }
    if (data.email && !/@/.test(data.email)) {
        return $.t('error_email_address')
    }
}

export function notifyContactOperationSuccess (message) {
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

export function formsAddContact (data: any) {
    const error = checkContactDataError(data)
    if (error) {
        return { error }
    }
    if (data.account_id.charAt(0) === '@') {
        if (data.converted_account_id) {
            data.account_id = data.converted_account_id
        } else {
            return {
                error: $.t('error_account_id')
            }
        }
    }
    const address = new NxtAddress(data.account_id)
    if (address.isOk()) {
        data.account = address.getAccountId()
        data.accountRS = address.getAccountRS(BRS.prefix)
    } else {
        return {
            error: $.t('error_account_id')
        }
    }
    for (const Contact in BRS.contacts) {
        if (BRS.contacts[Contact].accountRS === data.accountRS) {
            return { error: $.t('error_contact_account_id_exists') }
        }
        if (BRS.contacts[Contact].name === data.name) {
            return { error: $.t('error_contact_name_exists') }
        }
    }

    addContactToDatabase(data)

    return { stop: true, hide: true }
}

function addContactToDatabase (data: DBContact) {
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
        $.notify($.t('success_contact_add') + ' ' + $.t('contacts_no_db_warning'), { type: 'warning' })
        return
    }
    dbPut('contacts', record, function (error) {
        if (error) {
            $.notify($.t('error_save_db'))
            return
        }
        setTimeout(notifyContactOperationSuccess, 50, $.t('success_contact_add'))
    })
}

export function evUpdateContactModalOnShowBsModal (e: JQuery.Event) {
    const $invoker = $((e as ShowBootstrapModalEvent).relatedTarget)

    const contactName = $invoker.data('contact')
    if (!contactName) {
        console.error("Wrong use")
        return
    }

    const contact = getContactByName(contactName)
    if (!contact) {
        console.error("Wrong use")
        return
    }
    $('#update_contact_name').val(contact.name)
    $('#update_contact_email').val(contact.email)
    $('#update_contact_account_id').val(contact.accountRS)
    $('#update_contact_description').val(contact.description)
}

export function formsUpdateContact (data: any) {
    const error = checkContactDataError(data)
    if (error) {
        return { error }
    }
    if (data.account_id.charAt(0) === '@') {
        if (data.converted_account_id) {
            data.account_id = data.converted_account_id
        } else {
            return {
                error: $.t('error_account_id')
            }
        }
    }
    if (!data.account_id) {
        return {
            error: $.t('error_contact')
        }
    }
    const address = new NxtAddress(data.account_id)
    if (address.isOk()) {
        data.account = address.getAccountId()
        data.accountRS = address.getAccountRS(BRS.prefix)
    } else {
        return {
            error: $.t('error_account_id')
        }
    }

    updateContactToDatabase(data)

    return { stop: true, hide: true }
}

function updateContactToDatabase (data: DBContact) {
    BRS.contacts[data.accountRS] = {
        name: data.name,
        email: data.email,
        account: data.account,
        accountRS: data.accountRS,
        description: data.description
    }
    if (!BRS.databaseSupport) {
        setTimeout(notifyContactOperationSuccess, 50, $.t('success_contact_update'))
        return
    }
    dbPut('contacts', {
        name: data.name,
        email: data.email,
        account: data.account,
        accountRS: data.accountRS,
        description: data.description
    }, function (error, item) {
        if (error || !item) {
            $.notify($.t('error_save_db'))
            return
        }
        setTimeout(notifyContactOperationSuccess, 50, $.t('success_contact_update'))
    })
}

export function evDeleteContactModalOnShowBsModal (e: JQuery.TriggeredEvent) {
    const $invoker = $((e as ShowBootstrapModalEvent).relatedTarget)

    const contactName = $invoker.data('contact')

    const contact = getContactByName(contactName)
    if (!contact) {
        return
    }

    $('#delete_contact_name').text(contact.name)
    $('#delete_contact_account_rs').text(contact.accountRS)
    $('#delete_contact_account_id').text(contact.account)
}

export function formsDeleteContact () {
    const accountRs = $('#delete_contact_account_rs').text()

    if (!accountRs || !BRS.contacts[String(accountRs)]) {
        return { error: $.t('error_save_db') }
    }
    delete BRS.contacts[String(accountRs)]

    if (!BRS.databaseSupport) {
        notifyContactOperationSuccess($.t('success_contact_delete'))
        return
    }

    deleteRecord('contacts', { accountRs }, function (error) {
        if (error) {
            setTimeout(notifyContactOperationSuccess, 50, $.t('error_save_db'))
            return
        }
        setTimeout(notifyContactOperationSuccess, 50, $.t('success_contact_delete'))
    })

    return { stop: true, hide: true }
}
