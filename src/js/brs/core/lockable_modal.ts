/**
 * Locks a form modal and disables all buttons within it.
 *
 * @param {JQuery<HTMLElement>} $modal - The jQuery object representing the modal dialog
 * @param {JQuery<HTMLButtonElement>} $btn - The jQuery object representing the button that triggered the action (optional)
 */
export function lockModal ($modal: JQuery<HTMLElement>, $btn: JQuery<HTMLButtonElement>) {
    $modal.addClass('locked')
    $modal.find('button').prop('disabled', true)
    const loadingText = $btn.data('loading-text')
    if (loadingText) {
        $btn.html(loadingText);
    }
}

/**
 * Unlocks a form modal and re-enables all buttons within it.
 *
 * @param {JQuery<HTMLElement>} $modal - The jQuery object representing the modal dialog
 * @param {JQuery<HTMLButtonElement>} $btn - The jQuery object representing the button that triggered the action (optional)
 * @param {boolean} hide - Whether to hide the modal after unlocking (default false)
 */
export function unlockModal ($modal: JQuery<HTMLElement>, $btn: JQuery<HTMLButtonElement>, hide: boolean) {
    $modal.find('button').prop('disabled', false)
    if ($btn) {
        $btn.localize()
    }
    $modal.removeClass('locked');
    if (hide) {
        $modal.modal('hide')
    }
}
