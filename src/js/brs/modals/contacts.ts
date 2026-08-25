import { BRS } from '..'
import { NxtAddress } from '../../util/nxtaddress'
import { notifyContactOperationSuccess, getContactByName, saveContactToDatabase, removeContactFromDB } from '../tools/contacts'
import { showModal } from '../core/modals'
import { notify } from '../core/notifications'
import { convertNumericToRSAccountFormat } from '../core/util'

export function formsAddContact(data: any) {
    const error = checkContactDataError(data)
    if (error) {
        return { error }
    }
    if (data.account_id.charAt(0) === '@') {
        if (data.converted_account_id) {
            data.account_id = data.converted_account_id
        } else {
            return {
                error: $.t('error_account_id'),
            }
        }
    }
    const address = new NxtAddress(data.account_id)
    if (address.isOk()) {
        data.account = address.getAccountId()
        data.accountRS = address.getAccountRS(BRS.prefix)
    } else {
        return {
            error: $.t('error_account_id'),
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

    saveContactToDatabase(data, $.t('success_contact_add'))

    return { stop: true, hide: true }
}

export function formsUpdateContact(data: any) {
    const error = checkContactDataError(data)
    if (error) {
        return { error }
    }
    if (data.account_id.charAt(0) === '@') {
        if (data.converted_account_id) {
            data.account_id = data.converted_account_id
        } else {
            return {
                error: $.t('error_account_id'),
            }
        }
    }
    if (!data.account_id) {
        return {
            error: $.t('error_contact'),
        }
    }
    const address = new NxtAddress(data.account_id)
    if (address.isOk()) {
        data.account = address.getAccountId()
        data.accountRS = address.getAccountRS(BRS.prefix)
    } else {
        return {
            error: $.t('error_account_id'),
        }
    }

    saveContactToDatabase(data, $.t('success_contact_update'))

    return { stop: true, hide: true }
}

export function formsDeleteContact() {
    const accountRs = $('#delete_contact_account_rs').text()

    if (!accountRs || !BRS.contacts[String(accountRs)]) {
        return { error: $.t('error_save_db') }
    }
    delete BRS.contacts[String(accountRs)]

    if (!BRS.databaseSupport) {
        notifyContactOperationSuccess($.t('success_contact_delete'))
        return
    }

    removeContactFromDB(accountRs)

    return { stop: true, hide: true }
}

export function showUpdateContactModal(account: string) {
    let contact = getContactByName(account)
    if (!contact) {
        contact = BRS.contacts[account]
    }
    if (!contact) {
        contact = BRS.contacts[convertNumericToRSAccountFormat(account)]
    }
    if (!contact) {
        notify($.t('error_contact'), { type: 'danger' })
        return
    }
    $('#update_contact_name').val(contact.name)
    $('#update_contact_email').val(contact.email)
    $('#update_contact_account_id').val(contact.accountRS).trigger('blur')
    $('#update_contact_description').val(contact.description)

    showModal('update_contact')
}

export function showDeleteContactModal(account: string) {
    let contact = getContactByName(account)
    if (!contact) {
        contact = BRS.contacts[account]
    }
    if (!contact) {
        contact = BRS.contacts[convertNumericToRSAccountFormat(account)]
    }
    if (!contact) {
        notify($.t('error_contact'), { type: 'danger' })
        return
    }

    $('#delete_contact_name').text(contact.name)
    $('#delete_contact_account_rs').text(contact.accountRS)
    $('#delete_contact_account_id').text(contact.account)

    showModal('delete_contact')
}

/**
 * Test if the data is suitable to be added in contacts database.
 * @param data Object to be tested
 * @returns {string|undefined} String with the error, or undefined if no error.
 */
export function checkContactDataError(data: any): string | undefined {
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

export function showAddContactModal(account: string) {
    $('#add_contact_account_id').val(account).trigger('blur')
    showModal('add_contact')
}
