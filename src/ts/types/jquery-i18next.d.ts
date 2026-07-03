// Extend jQuery to include methods from jquery-i18next and i18next

declare module 'jquery-i18next'

interface JQueryStatic {
    /**
     * Translates a key using i18next.
     * @param key - The translation key.
     * @param options - Optional configuration for the translation.
     * @returns The translated string.
     */
    t(key: string, options?: any): string

    /**
     * Checks if a translation key exists in the i18next store.
     * @param key - The translation key to check.
     * @returns A boolean indicating if the key exists.
     */
    i18n: {
        exists(key: string): boolean
    }
}

interface JQuery {
    /**
     * Translates elements with data-i18n attributes using i18next.
     * @param opts - Optional configuration for localization.
     * @returns The jQuery object for chaining.
     */
    localize(opts?: unknown): JQuery

    // Note: Bootstrap types were not beeing added to JQuery.
    // Here is not the best place, but...
    modal(action: 'show' | 'hide'): void
    tab(action: 'show')
    popover(
        action:
            | 'hide'
            | {
                  content: string
                  trigger: 'hover'
              },
    )
}
