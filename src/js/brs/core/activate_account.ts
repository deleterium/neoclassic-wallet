import { BRS } from '..'
import { checkIncomingNow } from './check_incoming'
import { notify } from './notifications'

export function activateAccount() {
    if (!BRS.accountInfo.errorCode) {
        notify($.t('recipient_public_key_already_announced'), { type: 'success' })
        return
    }
    let url = 'https://activator.signum.network/api/activate'
    if (BRS.isTestNet) {
        url = 'https://activator.testnet.signum.network/api/activate'
    }
    const data = {
        account: BRS.accountRS,
        publickey: BRS.publicKey,
        ref: 'neoclassic-wallet',
    }
    $.ajax({
        url,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function (response, status, xhr) {
            if (xhr.status === 204) {
                notify($.t('success_activation'), { type: 'success' })
                checkIncomingNow()
                return
            }
            notify($.t('success') + ': ' + response, { type: 'success' })
        },
        error: function (xhr, status, error) {
            if (xhr.status === 400) {
                notify($.t('activation_already_done'), { type: 'warning' })
            } else if (xhr.status === 429) {
                notify($.t('error_activation_rate_limit'), { type: 'danger' })
            } else {
                notify($.t('error_activation_unknown'))
                console.error('Signum activation service returned status: ' + xhr.status + ' error: ' + error)
            }
        },
    })
}
