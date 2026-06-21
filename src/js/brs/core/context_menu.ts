import { BRS } from '..'

export function evSidebarContextOnContextmenu (e: JQuery.ContextMenuEvent<HTMLElement>) {
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
            top: e.pageY
        })
    }
}

export function closeContextMenu () {
    $('.context_menu').hide()
    if (BRS.selectedContext) {
        BRS.selectedContext = null;
    }
    $(document).off('click.contextmenu')
}
