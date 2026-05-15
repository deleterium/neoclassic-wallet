/**
 * @depends {brs.js}
 */

import { BRS } from '.'

/**
 * This file provides a replacement for the deprecated WebDB implementation
 */

/**
 * Creates an IndexedDB database for storing user data such as contacts, assets, and settings.
 * Sets up database schema and loads existing data into memory.
 * @param {function} [callback] - Optional callback function to execute after database is created succesfully.
 */
export function createDatabase (callback: () => void): void {
    const dbName = 'BRS_USER_DB'
    const dbVersion = 2
    const request = indexedDB.open(dbName, dbVersion)
    request.onerror = function (error) {
        console.error('createDatabase() error: ', error)
        BRS.database = null
        BRS.databaseSupport = false
    }
    request.onsuccess = function (event) {
        BRS.database = (event.target as IDBRequest).result
        BRS.databaseSupport = true
        callback()
    }
    request.onupgradeneeded = function (event) {
        const db: IDBDatabase = (event.target as IDBRequest).result
        if (!db.objectStoreNames.contains('contacts')) {
            db.createObjectStore('contacts', { keyPath: 'id', autoIncrement: true })
        }
        if (!db.objectStoreNames.contains('assets')) {
            db.createObjectStore('assets', { keyPath: 'asset' })
        }
        if (!db.objectStoreNames.contains('data')) {
            db.createObjectStore('data', { keyPath: 'id' })
        }
    }
}

/**
 * GET operation - Retrieve data from a store
 * @param {string} storeName - Name of the object store (table)
 * @param {object|function} query - Either:
 *   - An object containing the primary key to search for, or
 *   - A function (callback) if no query is provided
 * @param {function} [callback] - Callback function(error, result)
 * @returns {void}
 *
 * @description
 * When a query is provided, the callback's `result` will be:
 * - A single object matching the primary key, or
 * - null if no match was found
 *
 * When no query is provided (callback as second parameter), the callback's `result` will be:
 * - An array of all objects in the store
 */
export function dbGet <T extends string | number> (
    storeName: string,
    query: Record<string, T> | ((error: Error | null, result) => void) | null,
    callback?: (error: Error | null, result) => void
): void {
    if (BRS.database === null) return
    if (typeof query === 'function') {
        callback = query as (error: Error | null, result) => void
        query = null
    }
    const transaction = BRS.database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    let request: IDBRequest
    if (!query) {
        request = store.getAll()
    } else {
        const indexName = Object.keys(query)[0]
        const indexValue = query[indexName]
        request = store.get(indexValue)
    }
    request.onsuccess = function () {
        if (callback) callback(null, request.result)
    }
    request.onerror = function (error: Event) {
        if (callback) {
            const errorMessage = (error.target as IDBRequest).error?.message || 'An unknown error occurred'
            callback(new Error(errorMessage), {})
        } else {
            console.error('select() error: ', error)
        }
    }
}

/**
 * PUT operation - Add data to a store
 * @param {string} storeName - Name of the object store (table)
 * @param {object|Array} data - Data to insert/update:
 *   - A single object, or
 *   - An array of objects
 * @param {function=} callback - Callback function(error, result)
 * @returns {void}
 *
 * @description
 * When a single object is provided as `data`, the callback's `result` will be:
 * - The inserted object with its generated key (if applicable)
 *
 * When an array of objects is provided as `data`, the callback's `result` will be:
 * - An array containing all inserted objects with their generated keys
 */
export function dbPut <T extends object | Array<object>> (
    storeName: string,
    data: T,
    callback?: (error: Error | null, result: T) => void
): void {
    if (BRS.database === null) return
    const transaction = BRS.database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const isArrayInput = Array.isArray(data)
    const itemsToInsert = isArrayInput ? data as Array<object> : [data]
    const requests: Promise<any>[] = (itemsToInsert as Array<object>).map(item => {
        return new Promise((resolve, reject) => {
            const request = store.put(item)
            request.onsuccess = () => {
                // Get the complete object from the store after insertion
                const getRequest = store.get(request.result)
                getRequest.onsuccess = () => resolve(getRequest.result)
                getRequest.onerror = (error) => reject(error)
            }
            request.onerror = (error) => reject(error)
        })
    })
    Promise.allSettled(requests)
        .then(results => {
            if (!callback) return
            const errors = results.filter((r) => r.status === 'rejected')
            const successfulResults = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
            if (errors.length > 0) {
                callback(new Error('Some inserts failed'), results as T)
            } else {
                const result = isArrayInput ? successfulResults : successfulResults[0]
                callback(null, result as T)
            }
        })
        .catch(error => {
            if (callback) {
                const errorMessage = (error.target as IDBRequest).error?.message || 'An unknown error occurred'
                callback(new Error(errorMessage), {} as T)
            } else {
                console.error('insert() error: ', error)
            }
        })
}

/**
 * DELETE operation - Remove data from a store
 * @param {string} storeName - Name of the object store (table)
 * @param {object} query - Query parameter to identify the record to delete (primary key)
 * @param {function} callback - Callback function(error)
 */
export function deleteRecord <T extends string | number> (
    storeName: string,
    query: Record<string, T>,
    callback?: (error: Error | null) => void
): void {
    if (BRS.database === null) return
    const transaction = BRS.database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const indexName = Object.keys(query)[0]
    const indexValue = query[indexName]
    const request = store.delete(indexValue)
    request.onsuccess = function () {
        if (callback) callback(null)
    }
    request.onerror = function (error) {
        if (callback) {
            const errorMessage = (error.target as IDBRequest).error?.message || 'An unknown error occurred'
            callback(new Error(errorMessage))
        } else {
            console.error('deleteRecord() error: ', error)
        }
    }
}

/**
 * DROP operation - Remove all data from a store
 * @param {string} storeName - Name of the object store (table)
 * @param {function} callback - Callback function(error)
 */
export function drop(storeName: string, callback?: (error: Error | null) => void): void {
    if (BRS.database === null) return
    const transaction = BRS.database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.clear()
    request.onsuccess = function () {
        if (callback) callback(null)
    }
    request.onerror = function (error) {
        if (callback) {
            const errorMessage = (error.target as IDBRequest).error?.message || 'An unknown error occurred'
            callback(new Error(errorMessage))
        } else {
            console.error('drop() error: ', error)
        }
    }
}
