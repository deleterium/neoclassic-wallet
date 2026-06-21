import { BRS } from '..'

import { PostResponse } from '../typings'

export function formsSetAccountInfoComplete (response: PostResponse, inputFormData: any) {
    const name = inputFormData.name
    if (name) {
        $('#account_name').text(name).removeAttr('data-i18n')
    } else {
        $('#account_name').text($.t('no_name_set')).attr('data-i18n', 'no_name_set')
    }
    const description = String(inputFormData.description).trim()
    setTimeout(function () {
        BRS.accountInfo.description = description
        BRS.accountInfo.name = name
    }, 1000)
}
