import { BRS } from '.';
import { GetAssetResponse, Alias, GetAccountResponse, GetAliasesResponse, GetAssetsByNameResponse } from '../typings';
import { showAliasModal } from './brs.aliases';
import { showAccountModal } from './brs.modals.account';
import { showBlockModal } from './brs.modals.block';
import { showTransactionModal } from './brs.modals.transaction';
import { sendRequest } from './brs.server';
import { convertNumericToRSAccountFormat, dataLoaded, getAccountTitle } from './brs.util';
import { formatNQTAsAmount } from './brs.numbers';

/**
 * Draws the search results if found many accounts.
 * @param accountsList 
 */
function showAccountSearchResults(accountsList: string[]): void {
    // TODO: feat: Add a late update, drawing a table and updating details async?
    let resultHTML = `<strong>${$.t('account')}:</strong><ul>`;
    for (const account of accountsList) {
        const accountRS = convertNumericToRSAccountFormat(account);
        resultHTML += `<li><a href="#" data-user="${accountRS}" class="user-info">${accountRS}</a></li>`;
    }
    resultHTML += '</ul>';
    dataLoaded(resultHTML);
}

/**
 * Draws the search results if found many assets.
 * @param assets 
 */
function showAssetSearchResults(assets: GetAssetResponse[]) {
    let resultHTML = `
        <table class="table table-striped">
          <thead>
            <tr>
              <th>${$.t('name')}</th>
              <th>${$.t('asset_id')}</th>
              <th>${$.t('issuer')}</th>
              <th>${$.t('description')}</th>
            </tr>
          </thead>
          <tbody>`;
    for (const asset of assets) {
        resultHTML += `
            <tr>
              <td>${asset.name}</td>
              <td><a href="#" data-goto-asset="${asset.asset}">${asset.asset}</a></td>
              <td><a href="#" data-user="${asset.accountRS}" class="user-info">${asset.accountRS}</a></td>
              <td>${String(asset.description).escapeHTML()}</td>
            </tr>`;
    }
    resultHTML += `
          </tbody>
        </table>`;
    dataLoaded(resultHTML);
}

/**
 * Draws the search results if found many aliases.
 * @param aliases 
 */
function showAliasesSearchResults(aliases: Alias[]) {
    let resultHTML = `
        <table class="table table-striped">
          <thead>
            <tr>
              <th>${$.t('alias_name')}</th>
              <th>${$.t('account')}</th>
              <th>${$.t('tld')}</th>
              <th>${$.t('alias_uri')}</th>
              <th>${$.t('status')}</th>
              <th>${$.t('price')}</th>
            </tr>
          </thead>
          <tbody>`;
    for (const alias of aliases) {
        // TODO add transalation and show here and in alias page
        let statusHTML = '/';
        if (alias.priceNQT && !alias.buyer) {
            statusHTML = $.t('for_sale_indirect');
        } else if (alias.priceNQT) {
            statusHTML = $.t('for_sale_direct') + `<br />${getAccountTitle(alias.buyer)}`;
        }
        let priceHTML = '';
        if (alias.priceNQT) {
            priceHTML += formatNQTAsAmount(alias.priceNQT);
            if (alias.buyer === BRS.account || !alias.buyer) {
                priceHTML += `<br /><a href="#" data-buy-alias="${alias.alias}" data-toggle="modal" data-target="#buy_alias_modal">${$.t('buy_it_q')}</a>`;
            }
        }
        resultHTML += `
            <tr>
              <td><a href="#" data-alias="${alias.alias}">${alias.aliasName}</a></td>
              <td><a href="#" data-user="${alias.accountRS}" class="user-info">${alias.accountRS}</a></td>
              <td>${alias.tldName}</td>
              <td>${alias.aliasURI.escapeHTML()}</td>
              <td>${statusHTML}</td>
              <th>${priceHTML}</th>
            </tr>`;
    }
    resultHTML += `
          </tbody>
        </table>`;
    dataLoaded(resultHTML);
}

/**
 * Page shown when a search is started.
 * @returns 
 */
export function pagesSearchResults() {
    function requestAccountAndShow(accountValue: string) {
        sendRequest('getAccount', {
            account: accountValue,
            getCommittedAmount: 'true'
        }, function (response: GetAccountResponse) {
            if (response.errorCode) {
                dataLoaded($.t('error_search_no_results'));
                return;
            }
            showAccountModal(response);
            showAccountSearchResults([response.account]);
        });
    }

    const userInput = ($('#search_box input').val() as string).trim();
    let searchText = userInput;
    if (searchText.startsWith('-')) {
        try {
            // signed to unsigned conversion
            searchText = (BigInt(userInput) + (1n << 64n)).toString(10);
        } catch {
            searchText = userInput;
        }
    }
    if (BRS.rsRegEx.test(searchText)) {
        requestAccountAndShow(searchText);
        return;
    }
    if (BRS.idRegEx.test(searchText)) {
        sendRequest('getTransaction', {
            transaction: searchText
        }, function (response) {
            if (response.errorCode) {
                dataLoaded($.t('no_transactions_found'));
                return;
            }
            showTransactionModal(response);
            const htmlResult = `
                <strong>${$.t('transaction')}:</strong>
                <ul>
                  <li><a href="#" data-transaction="${response.transaction}">${response.transaction}</a></li>
                </ul>`;
            dataLoaded(htmlResult);
        });
        return;
    }
    const splitted = searchText.split(':');
    if (splitted.length !== 2) {
        dataLoaded('');
        return;
    }
    switch (splitted[0].trim()) {
        case 'a':
        case 'address':
            requestAccountAndShow(splitted[1].trim());
            return;
        case 'b':
        case 'block':
            sendRequest('getBlock', {
                height: splitted[1].trim(),
                includeTransactions: 'true'
            }, function (response) {
                if (response.errorCode) {
                    dataLoaded($.t('error_search_no_results'));
                    return;
                }
                showBlockModal(response);
                const htmlResult = `
                <strong>${$.t('block')}:</strong>
                <ul>
                  <li><a href="#" data-block="${response.height}">${response.height}</a></li>
                </ul>`;
                dataLoaded(htmlResult);
            });
            return;
        case 'alias':
            sendRequest('getAliasesByName', {
                aliasName: splitted[1].trim()
            }, function (response: GetAliasesResponse) {
                if (response.errorCode || !response.aliases || response.aliases.length === 0) {
                    dataLoaded($.t('error_search_no_results'));
                    return;
                }
                if (response.aliases.length === 1) {
                    showAliasModal(response.aliases[0]);
                }
                showAliasesSearchResults(response.aliases);
            });
            return;
        case 'name':
            sendRequest('getAccountsWithName', {
                name: splitted[1].trim()
            }, function (response) {
                if (response.errorCode || !response.accounts || response.accounts.length === 0) {
                    dataLoaded($.t('error_search_no_results'));
                    return;
                }
                if (response.accounts.length === 1) {
                    requestAccountAndShow(response.accounts[0]);
                    return;
                }
                showAccountSearchResults(response.accounts);
            });
            return;
        case 'token':
            sendRequest('getAssetsByName', {
                name: splitted[1].trim()
            }, function (response: GetAssetsByNameResponse) {
                if (response.errorCode || !response.assets || response.assets.length === 0) {
                    dataLoaded($.t('error_search_no_results'));
                    return;
                }
                showAssetSearchResults(response.assets);
            });
            return;
        default:
            dataLoaded('');
    }
}
