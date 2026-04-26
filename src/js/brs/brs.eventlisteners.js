/**
 * @depends {brs.js}
 */

import { BRS } from '.'

import { fnAjaxMultiQueue } from './brs.ajaxmultiqueue'

import {
    autoSelectServer,
    getState,
    evSidebarClick,
    reloadCurrentPage,
    goToPage,
    goToPageNumber,
    evIdSearchSubmit
} from './brs'

import {
    updateSettings
} from './brs.settings'

import {
    showLoginOrWelcomeScreen,
    showLoginScreen,
    registerUserDefinedAccount,
    registerAccount,
    verifyGeneratedPassphrase,
    evAccountPhraseCustomPanelSubmit,
    evLoginButtonClick,
    logout
} from './brs.login'

import {
    blocksInfoLoad
} from './brs.blocks'

import {
    evAliasModalOnShowBsModal,
    evBuyAliasModalOnShowBsModal,
    evRegisterAliasModalOnShowBsModal,
    setAliasType,
    evAliasSearchSubmit,
    evSellAliasSellToSpecificClick
} from './brs.aliases'

import {
    evDeleteContactModalOnShowBsModal,
    evUpdateContactModalOnShowBsModal,
    exportContacts,
    importContacts
} from './brs.contacts'

import {
    removeDecryptionForm,
    decryptNoteFormSubmit
} from './brs.encryption'

import {
    submitForm
} from './brs.forms'

import {
    convertNumericToRSAccountFormat,
    convertToNQT,
    formatAmount,
    treeViewHandler
} from './brs.util'

import {
    bookmarkAllUserAssets,
    saveAssetBookmarks,
    evAssetExchangeSidebarClick,
    updateMiniTradeHistory,
    evAssetExchangeSearchInput,
    evAssetExchangeOrdersTableClick,
    evSellBuyAutomaticPriceClick,
    evAssetExchangeQuantityPriceKeydown,
    evCalculatePricePreviewKeyup,
    evAssetOrderModalOnShowBsModal,
    evAssetExchangeSidebarContextClick,
    evTransferAssetModalOnShowBsModal,
    goToAsset,
    evAssetSelectorButtonClick
} from './brs.assetexchange'

import {
    evTransactionsPageTypeClick
} from './brs.transactions'

import {
    evSidebarContextOnContextmenu,
    closeContextMenu
} from './brs.sidebar'

import {
    evMessagesSidebarClick,
    evMessagesSidebarContextClick
} from './brs.messages'

import {
    sendMoneyCalculateTotal,
    evSpanRecipientSelectorClickButton,
    evSpanRecipientSelectorClickUlLiA
} from './brs.recipient'

import {
    setupLockableModal,
    evAddRecipientsClick,
    evMultiOutSameAmountChange,
    evSameOutCheckboxChange,
    evMultiOutFeeChange,
    evModalOnShowBsModal,
    resetModalMultiOut,
    evModalOnHiddenBsModal,
    evAdvancedInfoClick
} from './brs.modals'

import {
    showAccountModal,
    evShowBsTab
} from './brs.modals.account'

import {
    evBlocksTableClick
} from './brs.modals.block'

import {
    showEscrowDecisionModal
} from './brs.modals.escrow'

import {
    evBrsModalOnShowBsModal
} from './brs.modals.info'

import {
    evGenerateQrButtonClick
} from './brs.modals.request'

import {
    showSubscriptionCancelModal
} from './brs.modals.subscription'

import {
    showTransactionModal
} from './brs.modals.transaction'

export function addEventListeners () {
    // fix adminlte (for some reason no event listener was attached on sidebar-overlay)
    $('#sidebar-overlay').on('click', function () {
        $('body').removeClass('sidebar-open')
        $('body').addClass('sidebar-closed sidebar-collapse')
    })
    // fix adminlte (for some reason there is bug hiding sidebar on start)
    if (document.body.clientWidth > 991.98) {
        $('[data-widget="pushmenu"]').PushMenu('expand')
    } else {
        $('[data-widget="pushmenu"]').PushMenu('collapse')
    }

    // from brs.js
    $('#prefered_node').on('blur', function () {
        getState(null)
    })
    $('#automatic_node_selection').change(function () {
        if (this.checked) {
            autoSelectServer()
            updateSettings('automatic_node_selection', 1)
        } else {
            updateSettings('automatic_node_selection', 0)
            getState(null)
        }
    })
    $('span.node_selector button').on('click', function (e) {
        const $list = $(this).parent().find('ul')
        $list.empty()
        if (BRS.settings.automatic_node_selection) {
            $list.append("<li class='divider'></li>")
            return
        }
        for (const server of BRS.nodes.filter(obj => obj.testnet === false)) {
            $list.append("<li><a class='dropdown-item' href='#' data-server='" + server.address + "'>" + server.address + '</a></li>')
        }
        $list.append("<li><hr class='dropdown-divider'></li>")
        for (const server of BRS.nodes.filter(obj => obj.testnet === true)) {
            $list.append("<li><a class='dropdown-item' href='#' data-server='" + server.address + "'>" + server.address + '</a></li>')
        }
    })
    $('span.node_selector').on('click', 'ul li a', function (e) {
        e.preventDefault()
        $(this).closest('div').find('input[name=prefered_node]').val('')
        $(this).closest('div').find('input[name=prefered_node]').val($(this).data('server')).trigger('blur')
    })
    $('#start_settings_language').on('change', function (e) {
        e.preventDefault()
        const value = $(this).val()
        updateSettings('language', value)
    })

    // allowLoginViaEnter
    $('#login_password, #login_account').on('keypress', function (e) {
        if (e.key === 'Enter') {
            evLoginButtonClick(e)
        }
    })
    $('input[name=q]').on('keypress', function (e) {
        if (e.key === 'Enter') {
            $(this).trigger('submit')
        }
    })

    $('.sidebar-menu a').on('click', evSidebarClick)
    $('button.goto-page, a.goto-page').on('click', function (event) {
        event.preventDefault()

        goToPage($(this).data('page'))
    })
    $('.data-pagination').on('click', 'a', function (e) {
        e.preventDefault()

        goToPageNumber($(this).data('page'))
    })
    $('#search_btn').on('click', evIdSearchSubmit)
    $('#login_button').on('click', evLoginButtonClick)

    // from brs.forms.js
    $('.modal form input').on('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault()
            if (BRS.settings.submit_on_enter && e.target.type !== 'textarea') {
                $(this).trigger('submit')
            } else {
                return false
            }
        }
    })
    $('.modal button.btn-primary:not([data-dismiss=modal]):not([data-ignore=true])').click(function () {
        submitForm($(this))
    })

    // from brs.login.js
    $('#account_phrase_custom_panel form').on('submit', evAccountPhraseCustomPanelSubmit)
    $('#menu_logout').on('click', function (event) {
        event.preventDefault()
        logout()
    })

    // found on lockscreen.html
    $('#lockscreen_register1, #lockscreen_register2').on('click', registerAccount)
    $('#lockscreen_registration_cancel').on('click', showLoginScreen)
    $('#lockscreen_registration_cancel2, #lockscreen_registration_cancel3, #lockscreen_registration_cancel4, #lockscreen_registration_cancel5').on('click', showLoginOrWelcomeScreen)
    $('#lockscreen_next').on('click', function (event) {
        $('.step_2').hide()
        $('.step_3').show()
    })
    $('#lockscreen_verify_passphrase').on('click', function (event) {
        event.preventDefault()
        verifyGeneratedPassphrase()
    })
    $('#lockscreen_user_defined_passphrase').on('click', function (event) {
        event.preventDefault()
        registerUserDefinedAccount()
    })

    // from brs.recipient.js
    $('#send_message_modal, #send_money_modal, #add_contact_modal').on('show.bs.modal', function (e) {
        const $invoker = $(e.relatedTarget)
        let account = $invoker.data('account')
        if (!account) {
            account = $invoker.data('contact')
        }
        if (account) {
            const $inputField = $(this).find('input[name=recipient], input[name=account_id]').not('[type=hidden]')
            $inputField.val(account).trigger('checkRecipient')
        }
        sendMoneyCalculateTotal($(this))
    })
    $('#send_money_amount, #send_money_fee').on('change', function (e) {
        sendMoneyCalculateTotal($(this))
    })
    $('span.asset_selector button').on('click', evAssetSelectorButtonClick)
    $('span.asset_selector').on('click', 'ul li a', evTransferAssetModalOnShowBsModal)
    $('.recipient_selector button').on('click', evSpanRecipientSelectorClickButton)
    $('.recipient_selector').on('click', 'ul li a', evSpanRecipientSelectorClickUlLiA)

    // from brs.transactions.js
    $('input[type=radio][name=transactions_from_account]').on('click', function () {
        BRS.pageNumber = 1
        BRS.hasMorePages = false
        reloadCurrentPage()
    })
    $('#transactions_page_type li a').on('click', evTransactionsPageTypeClick)

    // from brs.assetexchange.js
    $('#asset_exchange_bookmark_this_asset').on('click', function () {
        saveAssetBookmarks([BRS.currentAsset], function () {
            goToAsset(BRS.currentAsset.asset)
        })
    })
    $('#asset_exchange_add_all_assets_bookmark').on('click', function () {
        bookmarkAllUserAssets()
    })

    $('#asset_exchange_sidebar').on('click', 'a', evAssetExchangeSidebarClick)
    $('#ae_show_my_trades_only').on('change', updateMiniTradeHistory)
    $('#asset_exchange_search').on('submit', function (e) {
        e.preventDefault()
        $('#asset_exchange_search input[name=q]').trigger('input')
    })
    $('#asset_exchange_search input[name=q]').on('input', evAssetExchangeSearchInput)
    $('#asset_exchange_clear_search').on('click', function () {
        $('#asset_exchange_search input[name=q]').val('')
        $('#asset_exchange_search').trigger('submit')
    })
    $('#buy_asset_box .card-header, #sell_asset_box .card-header').on('click', function (e) {
        e.preventDefault()
        // Find the box parent
        const box = $(this).parents('.card').first()
        // Find the body and the footer
        const bf = box.find('.card-body, .card-footer')
        if (!box.hasClass('collapsed-card')) {
            box.addClass('collapsed-card')
            bf.slideUp()
        } else {
            box.removeClass('collapsed-card')
            bf.slideDown()
        }
    })
    $('#asset_exchange_bid_orders_table tbody, #asset_exchange_ask_orders_table tbody').on('click', 'td', evAssetExchangeOrdersTableClick)
    $('#sell_automatic_price, #buy_automatic_price').on('click', evSellBuyAutomaticPriceClick)
    $('#buy_asset_quantity, #buy_asset_price, #sell_asset_quantity, #sell_asset_price').keydown(evAssetExchangeQuantityPriceKeydown)
    $('#sell_asset_quantity, #sell_asset_price, #buy_asset_quantity, #buy_asset_price').keyup(evCalculatePricePreviewKeyup)
    $('#asset_order_modal').on('show.bs.modal', evAssetOrderModalOnShowBsModal)
    $('#asset_exchange_sidebar_group_context').on('click', 'a', function (e) {
        e.preventDefault()
        const groupName = BRS.selectedContext.data('groupname')
        const option = $(this).data('option')
        if (option === 'change_group_name') {
            $('#asset_exchange_change_group_name_old_display').html(groupName.escapeHTML())
            $('#asset_exchange_change_group_name_old').val(groupName)
            $('#asset_exchange_change_group_name_new').val('')
            $('#asset_exchange_change_group_name_modal').modal('show')
        }
    })
    $('#asset_exchange_sidebar_context').on('click', 'a', evAssetExchangeSidebarContextClick)
    $('#asset_exchange_group_group').on('change', function () {
        const value = $(this).val()
        if (value === '-1') {
            $('#asset_exchange_group_new_group_div').show()
        } else {
            $('#asset_exchange_group_new_group_div').hide()
        }
    })
    $('#asset_exchange_group_modal').on('hidden.bs.modal', function (e) {
        $('#asset_exchange_group_new_group_div').val('').hide()
    })
    $('#transfer_asset_modal').on('show.bs.modal', evTransferAssetModalOnShowBsModal)
    $('body').on('click', 'a[data-goto-asset]', function (e) {
        e.preventDefault()
        const $visible_modal = $('.modal.in')
        if ($visible_modal.length) {
            $visible_modal.modal('hide')
        }
        goToAsset($(this).data('goto-asset'))
    })
    $('#cancel_order_modal').on('show.bs.modal', function (e) {
        const $invoker = $(e.relatedTarget)
        const orderType = $invoker.data('type')
        const orderId = $invoker.data('order')
        if (orderType === 'bid') {
            $('#cancel_order_type').val('cancelBidOrder')
        } else {
            $('#cancel_order_type').val('cancelAskOrder')
        }
        $('#cancel_order_order').val(orderId)
    })

    // from brs.messages.js
    $('#send_message_modal').on('show.bs.modal', function (e) {
        if (BRS.currentPage === 'messages' && BRS.currentSubPage) {
            const recipientAddress = convertNumericToRSAccountFormat(BRS.currentSubPage)
            $('#send_message_message').val($('#message_in_chatbox').val())
            $('#message_in_chatbox').val('')
            if (BRS.contacts[recipientAddress]) {
                $('#send_message_recipient').val(BRS.contacts[recipientAddress].name).trigger('checkRecipient')
            } else {
                $('#send_message_recipient').val(recipientAddress).trigger('checkRecipient')
            }
        }
    })
    $('#messages_sidebar').on('click', 'a', evMessagesSidebarClick)
    $('#messages_sidebar_context').on('click', 'a', evMessagesSidebarContextClick)
    $('#messages_sidebar_update_context').on('click', 'a', function (e) {
        e.preventDefault()
        const option = $(this).data('option')
        closeContextMenu()
        if (option === 'update_contact') {
            $('#update_contact_modal').modal('show')
        } else if (option === 'send_burst') {
            $('#send_money_recipient').val(BRS.selectedContext.data('contact')).trigger('blur')
            $('#send_money_modal').modal('show')
        }
    })
    // $('body').on('click', 'a[data-goto-messages-account]', function (e) {
    //     e.preventDefault()
    //     const account = $(this).data('goto-messages-account')
    //     goToPage('messages', function () {
    //         $('#message_sidebar a[data-account=' + account + ']').trigger('click')
    //     })
    // })

    // from brs.aliases.js
    $('#transfer_alias_modal, #sell_alias_modal, #cancel_alias_sale_modal').on('show.bs.modal', evAliasModalOnShowBsModal)
    $('#sell_alias_sell_to_specific').on('click', evSellAliasSellToSpecificClick)
    $('#buy_alias_modal').on('show.bs.modal', evBuyAliasModalOnShowBsModal)
    $('#register_alias_modal').on('show.bs.modal', evRegisterAliasModalOnShowBsModal)
    $('#register_alias_type').on('change', function () {
        const type = $(this).val()
        setAliasType(type, $('#register_alias_uri').val())
    })
    $('#alias_search').on('submit', evAliasSearchSubmit)

    // from brs.contacts.js
    $('#update_contact_modal').on('show.bs.modal', evUpdateContactModalOnShowBsModal)
    $('#delete_contact_modal').on('show.bs.modal', evDeleteContactModalOnShowBsModal)
    $('#export_contacts_button').on('click', function () {
        exportContacts()
    })
    $('#import_contacts_button_field').css({ display: 'none' })
    $('#import_contacts_button_field').on('change', function (button_event) {
        button_event.preventDefault()
        const file = $('#import_contacts_button_field')[0].files[0]
        const reader = new FileReader()
        reader.onload = function (read_event) {
            const imported_contacts = JSON.parse(read_event.target.result)
            importContacts(imported_contacts)
        }
        reader.readAsText(file)
        return false
    })
    $('#import_contacts_button').on('click', function () {
        $('#import_contacts_button_field').click()
    })

    // from brs.settings.js
    $('#settings_box select').on('change', function (e) {
        e.preventDefault()
        const key = $(this).attr('name')
        const value = $(this).val()
        updateSettings(key, value)
    })
    $('#settings_box input[type=text]').on('input', function (e) {
        const key = $(this).attr('name')
        let value = $(this).val()
        if (/_warning/i.test(key) && key !== 'asset_transfer_warning') {
            value = convertToNQT(value)
        }
        updateSettings(key, value)
    })
    $('#settings_box input[type=checkbox]').on('change', function (e) {
        const key = $(this).attr('name')
        const value = this.checked
        updateSettings(key, value)
    })

    // from brs.sidebar.js
    $('.secondary-sidebar-context').on('contextmenu', 'a', evSidebarContextOnContextmenu)
    $('.open_my_account_modal').on('click', function () {
        showAccountModal(BRS.accountInfo.accountRS)
    })

    // from brs.encryption.js
    $('#decrypt_note_form_container button.btn-primary').click(function () {
        decryptNoteFormSubmit()
    })
    $('#decrypt_note_form_container').on('submit', function (e) {
        e.preventDefault()
        decryptNoteFormSubmit()
    })

    // from brs.modals.js
    setupLockableModal()
    // Reset scroll position of tab when shown.
    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        const target = $(e.target).attr('href')
        $(target).scrollTop(0)
    })
    resetModalMultiOut()
    $('#multi_out_same_amount').on('change', evMultiOutSameAmountChange)
    $('#send_money_same_out_checkbox').on('change', evSameOutCheckboxChange)
    $('#multi_out_fee').on('change', evMultiOutFeeChange)
    $('.add_recipients').on('click', evAddRecipientsClick)
    $('.add_message').on('change', function (e) {
        if ($(this).is(':checked')) {
            $(this).closest('form').find('.optional_message').fadeIn()
        } else {
            $(this).closest('form').find('.optional_message').hide()
        }
    })
    $('.add_note_to_self').on('change', function (e) {
        if ($(this).is(':checked')) {
            $(this).closest('form').find('.optional_note').fadeIn()
        } else {
            $(this).closest('form').find('.optional_note').hide()
        }
    })
    $('.sell_to_specific').on('change', function (e) {
        if ($(this).is(':checked')) {
            $(this).closest('form').find('.optional_sell_to_specific').fadeIn()
        } else {
            $(this).closest('form').find('.optional_sell_to_specific').hide()
        }
    })
    $('.modal').on('show.bs.modal', evModalOnShowBsModal)
    $('.modal').on('shown.bs.modal', function () {
        $(this).find('input[autofocus]').trigger('focus')
        $(this).find('input[name=converted_account_id]').val('')
        BRS.showedFormWarning = false // maybe not the best place... we assume forms are only in modals?
    })
    $('.modal').on('hidden.bs.modal', evModalOnHiddenBsModal)
    $('input[name=feeNXT]').on('change', function () {
        const $modal = $(this).closest('.modal')
        const $feeInfo = $modal.find('.advanced_fee')
        if ($feeInfo.length) {
            $feeInfo.html(formatAmount(convertToNQT($(this).val())) + ' ' + BRS.valueSuffix)
        }
    })
    $('.advanced_info a').on('click', evAdvancedInfoClick)

    // from brs.modals.account.js
    $('#blocks_table, #blocks_forged_table, #contacts_table, #transactions_table, #dashboard_transactions_table, #asset_account, #asset_exchange_ask_orders_table, #transfer_history_table, #asset_exchange_bid_orders_table, #alias_info_table, .dgs_page_contents, .modal-content, #block_info_table, #search_results_ul_container').on('click', 'a[data-user]', function (e) {
        e.preventDefault()
        const account = $(this).data('user')
        showAccountModal(account)
    })
    $('#user_info_modal').on('hidden.bs.modal', function (e) {
        $(this).find('table tbody').empty()
        $(this).find('.data-container:not(.data-loading,.data-never-loading)').addClass('data-loading')
        BRS.userInfoModal.user = 0
    })
    $('#user_info_modal a[data-toggle="pill"]').on('shown.bs.tab', evShowBsTab)

    // from brs.modals.accountinfo.js
    $('#account_info_modal').on('show.bs.modal', function (e) {
        $('#account_info_name').val(BRS.accountInfo.name)
        $('#account_info_description').val(BRS.accountInfo.description)
    })

    // from brs.modals.block.js
    $('#blocks_table, #blocks_forged_table, #dashboard_blocks_table').on('click', 'a[data-block]', evBlocksTableClick)
    $('#block_info_modal_info_tab').tab('show')
    $('#block_info_modal').on('hide.bs.modal', function (e) {
        $('#block_info_modal_info_tab').tab('show')
    })

    // from brs.modals.escrow.js
    $('#escrow_table').on('click', 'a[data-escrow]', function (e) {
        e.preventDefault()
        const escrowId = $(this).data('escrow')
        showEscrowDecisionModal(escrowId)
    })

    // from brs.modals.info.js
    $('#brs_modal').on('show.bs.modal', evBrsModalOnShowBsModal)

    // from brs.modals.request.js
    $('#request_burst_qr_modal').on('show.bs.modal', function (e) {
        $('#new_qr_button').hide()
        $('#request_burst_immutable').prop('checked', true)
        $('#request_burst_account_id').val(String(BRS.accountRS).escapeHTML())
        $('#request_burst_response_div').hide()
    })
    $('#generate_qr_button').on('click', evGenerateQrButtonClick)
    $('#request_burst_qr_modal').on('hide.bs.modal', function (e) {
        $('#request_burst_div').show()
        $('#request_burst_response_div').hide()
        $('#generate_qr_button').show()
        $('#request_burst_div').show()
        $('#request_burst_response_div').hide()
        $('#request_burst_qr_modal').find('.error_message').html('').hide()
    })
    $('#new_qr_button').on('click', function (e) {
        $('#request_burst_div').show()
        $('#request_burst_response_div').hide()
        $('#request_burst_amount').val('')
        $('#request_burst_immutable').prop('checked', true)
        $('#generate_qr_button').show()
        $('#new_qr_button').hide()
        $('#request_burst_qr_modal').find('.error_message').html('').hide()
    })

    // from brs.modals.signmessage.js
    $('#sign_message_tab').tab('show')
    $('#sign_message_modal').on('hidden.bs.modal', function (e) {
        $('#sign_message_tab').tab('show')
        $('#sign_message_output_signature').text('')
        $('#sign_message_output_public_key').text('')
        $('#sign_message_output_signed_transaction').text('')
        $('#sign_message_output').hide()
        $('#verify_message_output').text('')
        $('#verify_message_output').hide()
    })

    // from brs.modals.subscription.js
    $('#subscription_table').on('click', 'a[data-subscription]', function (e) {
        e.preventDefault()
        const subscriptionId = $(this).data('subscription')
        showSubscriptionCancelModal(subscriptionId)
    })

    // from brs.modals.transaction.js
    $('#transactions_table, #dashboard_transactions_table, #transfer_history_table, #asset_exchange_trade_history_table, #block_info_table, #block_info_transactions_table, #user_info_modal_transactions_table').on('click', 'a[data-transaction]', function (e) {
        e.preventDefault()
        const transactionId = $(this).data('transaction')
        showTransactionModal(transactionId)
    })
    $('#send_money_modal').on('hide.bs.modal', function (e) {
        $('#total_amount_multi_out').html('?')
    })
    $('#transaction_info_modal_info_tab').tab('show')
    $('#transaction_info_modal').on('hide.bs.modal', function (e) {
        $('#transaction_info_modal_info_tab').tab('show')
        removeDecryptionForm($(this))
        $('#transaction_info_output_bottom, #transaction_info_bottom').html('').hide()
    })

    // from brs.utils.js
    $.fn.tree = treeViewHandler
    $('.sidebar-menu .treeview').tree()

    // from brs.ajaxmultiqueue
    $.ajaxMultiQueue = fnAjaxMultiQueue

    // from brs.blocks.js
    $('#block_info_latest_block').on('click', function (e) {
        e.preventDefault()
        blocksInfoLoad(BRS.blocks[0].height.toString())
    })
    $('#block_info_search').on('click', function (e) {
        const userInput = $('#block_info_input_block').val()
        const currentBlock = Number(userInput)
        if (isNaN(currentBlock) || currentBlock < 0) {
            $.notify($.t('invalid_blockheight'), { type: 'danger' })
        }
        blocksInfoLoad($('#block_info_input_block').val())
    })
    $('#block_info_previous_block').on('click', function (e) {
        const userInput = $('#block_info_input_block').val()
        const currentBlock = Number(userInput)
        if (isNaN(currentBlock) || currentBlock <= 0) {
            $.notify($.t('invalid_blockheight'), { type: 'danger' })
        }
        blocksInfoLoad(currentBlock - 1)
    })
    $('#block_info_next_block').on('click', function (e) {
        const userInput = $('#block_info_input_block').val()
        const currentBlock = Number(userInput)
        if (isNaN(currentBlock) || currentBlock < 0) {
            $.notify($.t('invalid_blockheight'), { type: 'danger' })
        }
        blocksInfoLoad(currentBlock + 1)
    })
}
