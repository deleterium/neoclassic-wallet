import { BRS } from '..'
import { reloadCurrentPage } from '../core/navigation'
import { formatQNTAsQuantity } from '../core/numbers'
import { sendRequest } from '../core/send_request'
import { dataLoaded, getUnconfirmedTransactionsFromCache } from '../core/util'
import { GetAssetsByOwnerResponse, MyAssetDetails } from '../typings'

// Current page is 'asset_administration'
// Processing unconfirmed!

export async function pagesAssestAdministration() {
    const myIssuedAssets: MyAssetDetails[] = []

    const issuedAssets: GetAssetsByOwnerResponse = await sendRequest('getAssetsByOwner+', { account: BRS.account })
    if (issuedAssets.errorCode || issuedAssets.assets.length === 0) {
        dataLoaded()
    }

    for (const myAsset of issuedAssets.assets) {
        const foundAsset = BRS.accountInfo.assetBalances?.find((asset) => asset.asset === myAsset.asset)
        if (foundAsset) {
            myIssuedAssets.push({ balanceQNT: foundAsset.balanceQNT, ...myAsset })
        } else {
            myIssuedAssets.push({ balanceQNT: '0', ...myAsset })
        }
    }

    myIssuedAssets.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

    let rows = ''
    for (const asset of myIssuedAssets) {
        let mintHTML = `
            <a href='#'
                data-toggle='modal'
                data-target='#mint_asset_modal'
                data-asset='${asset.asset}'
                data-name='${asset.name}'
                data-decimals='${String(asset.decimals)}'>
                ${$.t('yes')}
            </a>`
        const unconfirmedMintTx = getUnconfirmedTransactionsFromCache(2, 6, {
            attachment: { asset: asset.asset },
        })
        if (unconfirmedMintTx) {
            mintHTML = BRS.pendingTransactionHTML
        }
        let distributionHTML = `
            <a href='#'
                data-toggle='modal'
                data-target='#distribute_to_asset_holders_asset_modal'
                data-asset='${asset.asset}'
                data-name='${asset.name}'
                data-decimals='${String(asset.decimals)}'>
                <i class="fa fa-magic" aria-hidden="true"></i>
            </a>`
        const unconfirmedDistributionTx = getUnconfirmedTransactionsFromCache(2, 8, {
            attachment: { asset: asset.asset },
        })
        if (unconfirmedDistributionTx) {
            distributionHTML = BRS.pendingTransactionHTML
        }
        let transferHTML = `
            <a href='#'
                data-toggle='modal'
                data-target='#transfer_asset_ownership_modal'
                data-asset='${asset.asset}'>
                <i class="fa fa-magic" aria-hidden="true"></i>
            </a>`
        const unconfirmedTransferTx = getUnconfirmedTransactionsFromCache(2, 10, {
            sender: BRS.account,
        })
        if (unconfirmedTransferTx) {
            transferHTML = BRS.pendingTransactionHTML
        }

        rows += `
            <tr data-asset="${asset.asset}">
              <td><a href='#' data-goto-asset='${asset.asset}'>
                ${asset.name}</a>
              </td>
              <td>${asset.asset}</td>
              <td class="quantity">${formatQNTAsQuantity(asset.balanceQNT, asset.decimals)}</td>
              <td>${formatQNTAsQuantity(asset.quantityCirculatingQNT, asset.decimals)}</td>
              <td>${asset.mintable ? mintHTML : $.t('no')}</i></td>
              <td>${distributionHTML}</td>
              <td>${transferHTML}</td>
            </tr>`
    }

    dataLoaded(rows)
}

export function incomingAssetAdministration() {
    if (BRS.checkIncoming.newBlock || BRS.checkIncoming.unconfirmedChanged) {
        reloadCurrentPage()
    }
}
