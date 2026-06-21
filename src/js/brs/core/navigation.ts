import { goToAsset } from '../pages/assets.asset_exchange'

import { BRS } from '..'

/**
 * Handles clicks in sidebar, changing current page if needed
 */
export function evSidebarClick(e: JQuery.ClickEvent): void {
    e.preventDefault()
    if ($(e.currentTarget).data('toggle') === 'modal') {
        return
    }
    const page = $(e.currentTarget).data('page')
    if (page === 'keep' || page === BRS.currentPage) {
        return
    }
    $('.page').hide()
    $('#' + page + '_page').show()
    $('#sidebar .active').removeClass('active')
    $(e.currentTarget).addClass('active')
    loadPage(page)
}

/** Load a page for first time (setting up global variables) */
function loadPage(page: string): void {
    BRS.currentPage = page
    BRS.currentSubPage = ''
    BRS.pageNumber = 1
    BRS.showPageNumbers = false
    if (BRS.pages[page]) {
        pageLoading()
        BRS.pages[page]()
    }
}

/** Reload current page, keeping variables like pagination */
export function reloadCurrentPage(): void {
    if (!BRS.pages[BRS.currentPage]) {
        console.log('Possible bug on reloadCurrentPage.')
        return
    }
    pageLoading()
    BRS.pages[BRS.currentPage]()
}

/** Go to a page, updating sidebar menu */
export function goToPage(page: string): void {
    let $link = $('[data-widget="treeview"] a[data-page=' + page + ']')

    if ($link.length > 1) {
        // if there are many pages in menubar
        if ($link.last().is(':visible')) {
            // Select last one if it is visible
            $link = $link.last()
        } else {
            $link = $link.first()
        }
    }
    if ($link.length === 1) {
        // handle pages that are in sidebar simulating a click
        $link.trigger('click')
        return
    }
    // Handle hidden pages like "search_results"
    $('[data-widget="treeview"] a.active').removeClass('active')
    $('.page').hide()
    $('#' + page + '_page').show()
    loadPage(page)
}

export function pageLoading(): void {
    BRS.hasMorePages = false
    const $pageHeader = $('#' + BRS.currentPage + '_page .content-header h1')
    $pageHeader.find('.loading_dots').remove()
    $pageHeader.append("<span class='loading_dots'>" + BRS.loadingDotsHTML + '</span>')
    const $pageContainer = $('#' + BRS.currentPage + '_page .data-container')
    if (BRS.currentSubPage === '') {
        // Only redraw entire page if there is no subpage.
        $pageContainer.addClass('data-loading')
    }
}

export function pageLoaded(callback?: () => void) {
    const $currentPage = $('#' + BRS.currentPage + '_page')
    $currentPage.find('.content-header h1 .loading_dots').remove()
    if ($currentPage.hasClass('paginated')) {
        addPagination()
    }
    window.scrollTo({
        top: 0,
        behavior: 'smooth',
    })
    if (callback) {
        callback()
    }
}

export function addPagination(): void {
    let output = ''

    if (BRS.pageNumber === 2) {
        output += "<a href='#' data-page='1'>&laquo; " + $.t('previous_page') + '</a>'
    } else if (BRS.pageNumber > 2) {
        // output += "<a href='#' data-page='1'>&laquo; First Page</a>";
        output += " <a href='#' data-page='" + (BRS.pageNumber - 1) + "'>&laquo; " + $.t('previous_page') + '</a>'
    }
    if (BRS.hasMorePages) {
        if (BRS.pageNumber > 1) {
            output += '&nbsp;&nbsp;&nbsp;'
        }
        output += " <a href='#' data-page='" + (BRS.pageNumber + 1) + "'>" + $.t('next_page') + ' &raquo;</a>'
    }

    const $paginationContainer = $('#' + BRS.currentPage + '_page .data-pagination')

    if ($paginationContainer.length) {
        $paginationContainer.html(output)
    }
}

export function goToPageNumber(pageNumber: number) {
    BRS.pageNumber = pageNumber
    pageLoading()
    BRS.pages[BRS.currentPage]()
}

export function checkLocationHash(): void {
    if (!window.location.hash) {
        return
    }
    const hash = window.location.hash.replace('#', '').split(':')
    let $modal: JQuery<HTMLElement> | undefined
    if (hash.length !== 2) {
        return
    }
    if (hash[0] === 'message') {
        $modal = $('#send_message_modal')
    } else if (hash[0] === 'send') {
        $modal = $('#send_money_modal')
    } else if (hash[0] === 'asset') {
        goToAsset(hash[1])
        return
    }

    if ($modal) {
        let account_id = hash[1].trim()
        if (!/^\d+$/.test(account_id) && account_id.indexOf('@') !== 0) {
            account_id = '@' + account_id
        }
        $modal.find('input[name=recipient]').val(account_id.unescapeHTML()).trigger('blur')
        $modal.modal('show')
    }
    window.location.hash = '#'
}

/** Checks if a Number is valid and greater than minimum fee. If not, return minimum fee */
export function checkMinimumFee(value: number): number {
    return isNaN(value) ? BRS.minimumFeeNumber : value < BRS.minimumFeeNumber ? BRS.minimumFeeNumber : value
}
