/*
 * jQuery.ajaxMultiQueue - A queue for multiple concurrent ajax requests
 * (c) 2013 Amir Grozki
 * Dual licensed under the MIT and GPL licenses.
 *
 * Based on jQuery.ajaxQueue
 * (c) 2011 Corey Frang
 *
 * 2026 - by Deepseek
 * - Updated to TS
 * - Added AbortController
 * - Added retries
 * - Added rate limiter
 *
 * Requires jQuery 3.5+
 */

import { BRS } from '..'

interface RequestControllerOptions extends JQueryAjaxSettings {
    currentPageAndSubPage?: string
    maxRetries: number
    // RequestController internal use only
    signal?: AbortSignal
}

/**
 * Class for managing an AJAX request queue with features:
 *  - Concurrency
 *  - Repetition
 *  - Cancellation
 *  - Rate limiting
 */
export class RequestController {
    private concurrency: number
    private rateLimit: number // max starts per second (0 = disabled)
    private waiting: Array<() => void> = []
    private running = 0
    private startTimes: number[] = [] // timestamps of recent starts

    /**
     * Constructor for the MultiQueue class.
     * @param concurrency - Maximum number of concurrent requests.
     * @param rateLimit - Maximum number of requests per second (0 = disabled).
     */
    constructor(concurrency: number, rateLimit: number = 0) {
        this.concurrency = concurrency
        this.rateLimit = rateLimit
    }

    /**
     * Adds an AJAX request to the queue.
     * @param ajaxOpts - Options for the AJAX request.
     * @returns A promise that resolves or rejects based on the AJAX request's outcome.
     */
    queue = (ajaxOpts: RequestControllerOptions) => {
        const dfd = $.Deferred()
        const promise = dfd.promise()
        let controller: AbortController | null = null
        if (ajaxOpts.currentPageAndSubPage) {
            controller = new AbortController()
            ajaxOpts.signal = controller.signal
        }

        let retriesLeft = ajaxOpts.maxRetries ?? 0

        /**
         * Attempts to execute the AJAX request.
         */
        const attempt = () => {
            // Check conditions for abortion
            if (controller && ajaxOpts.currentPageAndSubPage !== BRS.currentPage + BRS.currentSubPage) {
                controller.abort()
                this.running--
                this.processNext()
                return
            }

            if (this.rateLimit > 0) {
                this.startTimes.push(Date.now())
            }

            const jqXHR = $.ajax(ajaxOpts)
            jqXHR
                .done((data, textStatus, jqXHR) => {
                    dfd.resolve(data, textStatus, jqXHR)
                })
                .fail((jqXHR, textStatus, errorThrown) => {
                    if (retriesLeft > 0 && textStatus !== 'abort') {
                        retriesLeft--
                        this.waiting.push(attempt) // retry at the end of the queue
                    } else {
                        dfd.reject(jqXHR, textStatus, errorThrown)
                    }
                })
                .always(() => {
                    this.running--
                    this.processNext()
                })
        }

        // Always push to waiting and let processNext handle rate & concurrency
        this.waiting.push(attempt)
        this.processNext()
        return promise
    }

    /**
     * Processes the next request in the queue if possible.
     */
    processNext = () => {
        if (this.waiting.length === 0) return
        if (this.running >= this.concurrency) return // still at max

        // Rate limit check
        if (this.rateLimit > 0) {
            const now = Date.now()
            this.startTimes = this.startTimes.filter((t) => now - t < 1000)
            if (this.startTimes.length >= this.rateLimit) {
                const oldest = this.startTimes[0]
                const delay = oldest - now + 1000
                setTimeout(this.processNext, delay)
                return
            }
        }

        // All clear – start the next request
        const next = this.waiting.shift()!
        this.running++
        next()
    }

    /**
     * Gets the current number of pending requests.
     * @returns The number of pending requests.
     */
    getPendingRequestsCount = () => {
        return this.running
    }
}
