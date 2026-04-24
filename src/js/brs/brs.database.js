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
export function createDatabase (callback) {
    const dbName = 'BRS_USER_DB'
    const dbVersion = 2
    const request = indexedDB.open(dbName, dbVersion)
    request.onerror = function (error) {
        console.error('createDatabase() error: ', error)
        BRS.database = null
        BRS.databaseSupport = false
    }
    request.onsuccess = function (event) {
        BRS.database = event.target.result
        BRS.databaseSupport = true
        callback()
    }
    request.onupgradeneeded = function (event) {
        const db = event.target.result
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
 * SELECT operation - Retrieve data from a store
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
export function select (storeName, query, callback) {
    if (typeof query === 'function') {
        callback = query
        query = null
    }
    const transaction = BRS.database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    let request
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
    request.onerror = function (error) {
        if (callback) callback(error)
        else console.error('select() error: ', error)
    }
}

/**
 * INSERT operation - Add data to a store
 * @param {string} storeName - Name of the object store (table)
 * @param {object|Array} data - Data to insert:
 *   - A single object, or
 *   - An array of objects
 * @param {function} callback - Callback function(error, result)
 * @returns {void}
 *
 * @description
 * When a single object is provided as `data`, the callback's `result` will be:
 * - The inserted object with its generated key (if applicable)
 *
 * When an array of objects is provided as `data`, the callback's `result` will be:
 * - An array containing all inserted objects with their generated keys
 */
export function insert (storeName, data, callback) {
    const transaction = BRS.database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const isArrayInput = Array.isArray(data)
    const itemsToInsert = isArrayInput ? data : [data]
    const requests = itemsToInsert.map(item => {
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
            const errors = results.filter(r => r.status === 'rejected')
            if (errors.length > 0) {
                callback(new Error('Some inserts failed'), results)
            } else {
                const result = isArrayInput ? results.map(r => r.value) : results[0].value
                callback(null, result)
            }
        })
        .catch(error => {
            if (callback) callback(error)
            else console.error('insert() error: ', error)
        })
}

/**
 * UPDATE operation - Update existing data in a store
 * @param {string} storeName - Name of the object store (table)
 * @param {object} data - Data to update
 * @param {object} key - primary key to update
 * @param {function} callback - Callback function(error, result)
 */
export function update (storeName, data, key, callback) {
    // IndexedDB uses put for both insert and update
    return insert(storeName, [{ ...data, ...key }], callback)
}

/**
 * DELETE operation - Remove data from a store
 * @param {string} storeName - Name of the object store (table)
 * @param {object} query - Query parameter to identify the record to delete (primary key)
 * @param {function} callback - Callback function(error)
 */
export function deleteRecord (storeName, query, callback) {
    const transaction = BRS.database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const indexName = Object.keys(query)[0]
    const indexValue = query[indexName]
    const request = store.delete(indexValue)
    request.onsuccess = function () {
        if (callback) callback(null)
    }
    request.onerror = function (error) {
        if (callback) callback(error)
        else console.error('deleteRecord() error: ', error)
    }
}

/**
 * DROP operation - Remove all data from a store
 * @param {string} storeName - Name of the object store (table)
 * @param {function} callback - Callback function(error)
 */
export function drop (storeName, callback) {
    const transaction = BRS.database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.clear()
    request.onsuccess = function () {
        if (callback) callback(null)
    }
    request.onerror = function (error) {
        if (callback) callback(error)
        else console.error('drop() error: ', error)
    }
}
