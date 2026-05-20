// Extend jQuery to include methods from jquery-i18next and i18next

declare module 'jquery-i18next'

interface JQueryStatic {
    /**
     * Translates a key using i18next.
     * @param key - The translation key.
     * @param options - Optional configuration for the translation.
     * @returns The translated string.
     */
    t(key: string, options?: any): string;

    /**
     * Displays a notification message.
     * @param message - The message to display in the notification.
     * @param options - Optional configuration for the notification.
     */
    notify(message: string, options?: any): void;

    /**
     * Sets default options for notifications.
     * @param options - Default options for notifications.
     */
    notifyDefaults(options?: any): void;
}

interface JQuery {
    /**
     * Translates elements with data-i18n attributes using i18next.
     * @param opts - Optional configuration for localization.
     * @returns The jQuery object for chaining.
     */
    localize(opts?: unknown): JQuery;
}