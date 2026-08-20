import { BRS } from '..'
import { assetExchangeVtabGroupContextHandler, assetExchangeVtabContextHandler } from '../pages/assets.asset_exchange'
import { messagesVtabContextHandler } from '../pages/messages'

export function evWidgetContextMenuOnContextmenuA(e: JQuery.ContextMenuEvent<HTMLElement>) {
    e.preventDefault()
    closeContextMenu()
    const clickedElement = $(e.currentTarget as HTMLElement)
    if (clickedElement.hasClass('no-context')) {
        return
    }
    BRS.selectedContext = clickedElement
    $(document).on('click.contextmenu', closeContextMenu)
    const contextMenu = clickedElement.data('context')
    const $contextMenu = $('#' + contextMenu)
    if ($contextMenu.length) {
        const $options = $contextMenu.find('ul.dropdown-menu a')
        $.each($options, function () {
            const requiredClass = $(this).data('class')
            if (!requiredClass) {
                $(this).show()
            } else if (clickedElement.hasClass(requiredClass)) {
                $(this).show()
            } else {
                $(this).hide()
            }
        })
        $contextMenu.css({
            display: 'block',
            left: e.pageX,
            top: e.pageY,
        })
    }
}

function closeContextMenu() {
    $('.context_menu').hide()
    if (BRS.selectedContext) {
        BRS.selectedContext = null
    }
    $(document).off('click.contextmenu')
}

export function evWidgetContextMenuOnContextClickA(e: JQuery.ClickEvent) {
    e.preventDefault()
    if (!BRS.selectedContext) return

    const currentContext = BRS.selectedContext.data('context')
    const option = $(e.currentTarget).data('option')
    const item = BRS.selectedContext.data('item')

    closeContextMenu()

    switch (currentContext) {
        case 'messages_vtab_context':
            messagesVtabContextHandler(option, item)
            break
        case 'asset_exchange_vtab_context':
            assetExchangeVtabContextHandler(option, item)
            break
        case 'asset_exchange_vtab_group_context':
            assetExchangeVtabGroupContextHandler(option, item)
            break
        default:
            console.error('Unknown context: ' + currentContext)
    }
}
