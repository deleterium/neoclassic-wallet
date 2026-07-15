import { BRS } from '..'
import { DBAsset, GetAssetResponse } from '../typings'
import { dbGet, dbPut } from '../core/database'
import { sendRequest } from '../core/send_request'
import { notify } from '../core/notifications'

export function loadClosedGroupsFromDB() {
    if (!BRS.databaseSupport) return

    dbGet('data', { id: 'closed_groups' }, function (error, result: { id: string; contents: string }) {
        if (error) {
            console.error('Error loading closed groups:', error)
            return
        }
        // If no data exists, insert a default record
        if (!result) {
            dbPut('data', { id: 'closed_groups', contents: '' }, function (error) {
                if (error) console.error('Error initializing closed groups:', error)
            })
            return
        }
        BRS.closedGroups = result.contents.split('#')
    })
}

export function loadAssetsFromDB() {
    if (!BRS.databaseSupport) return

    dbGet('assets', function (error: Error | null, assets: DBAsset[]) {
        if (!error) {
            BRS.assets = assets
        }
    })
}

export function saveCachedAssets() {
    if (!BRS.databaseSupport) return

    const assetsToUpdate: DBAsset[] = []
    dbGet('assets', function (error: Error | null, dbAssets: DBAsset[]) {
        if (error) {
            notify($.t('error_assets_save_db'), { type: 'danger' })
            return
        }
        for (const cachedAsset of BRS.assets) {
            const dbAsset = dbAssets.find((asset) => asset.asset === cachedAsset.asset)
            if (!dbAsset) {
                assetsToUpdate.push(cachedAsset)
                continue
            }
            if (
                dbAsset.quantityCirculatingQNT !== cachedAsset.quantityCirculatingQNT ||
                dbAsset.bookmarked !== cachedAsset.bookmarked ||
                dbAsset.groupName !== cachedAsset.groupName
            ) {
                assetsToUpdate.push(cachedAsset)
            }
        }

        if (assetsToUpdate.length === 0) return

        dbPut('assets', assetsToUpdate, function (error) {
            if (error) {
                notify($.t('error_assets_save_db'), { type: 'danger' })
            }
        })
    })
}

/** Try to fetch details from cache. If not found, send a sync request.
 * @param assetId {String}
 * @returns {AssetDetails}
 * @error returns undefined
 */
export async function getAssetDetails(assetId: string): Promise<DBAsset | undefined> {
    const asset = BRS.assets.find((tkn) => tkn.asset === assetId)
    if (asset) return asset

    const response: GetAssetResponse = await sendRequest('getAsset', {
        asset: assetId,
    })

    if (response.errorCode) {
        return
    }
    return cacheAsset(response)
}

export function getAssetFromCache(assetId: string): DBAsset | undefined {
    const asset = BRS.assets.find((tkn) => tkn.asset === assetId)
    if (asset) return asset
}

export function cacheUserAssets() {
    if (BRS.accountInfo.assetBalances === undefined) {
        return
    }
    BRS.accountInfo.assetBalances.forEach((userAssetTuple) => {
        getAssetDetails(userAssetTuple.asset)
    })
}

/**
 * Stores or updates an asset in memory based on server response.
 * If the asset already exists in the cache, it updates its quantity and circulating quantity.
 * Otherwise, it inserts a new asset into the cache with default options.
 *
 * @param {Object} asset - The asset object from the server response.
 */
export function cacheAsset(asset: GetAssetResponse): DBAsset {
    const foundAsset = BRS.assets.find((tkn) => tkn.asset === asset.asset)
    if (foundAsset) {
        // update info
        foundAsset.quantityQNT = String(asset.quantityQNT)
        foundAsset.quantityCirculatingQNT = String(asset.quantityCirculatingQNT)
        return foundAsset
    }

    // insert new asset
    const assetToCache: DBAsset = {
        ...asset,
        bookmarked: false,
        groupName: '',
    }

    const newItem = BRS.assets.push(assetToCache) - 1
    return BRS.assets[newItem]
}
