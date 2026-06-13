import { BRS } from '.';
import { goToPage, pageLoaded, reloadCurrentPage } from './brs';
import { sendRequest } from './brs.server';
import { getUnconfirmedTransactionsFromCache, dataLoadFinished } from './brs.util';

// TODO change to pagination?
// $(window).scroll(function () {
//     if ($(window).scrollTop() + $(window).height() > $(document).height() - 100 && BRS.is_loading_aliases == false && $('#search_aliases').val().length == 0) {
//         const aliases = $('#aliases_table tbody')
//         if (aliases[0].childElementCount >= BRS.alias_page_elements) {
//             BRS.is_loading_aliases = true
//             $('#loading_aliases').html('<span data-i18n="loading_aliases">Loading aliases</span>... <i class="fa fa-spinner fa-pulse fa-fw" style="color:red;"></i>')
//             if ($('#search_aliases').val().length == 0) {
//                 sendRequest('getAliases+', {
//                     account: BRS.account,
//                     timestamp: 0,
//                     firstIndex: aliases[0].childElementCount,
//                     lastIndex: aliases[0].childElementCount + BRS.alias_page_elements - 1
//                 }, function (response) {
//                     BRS.is_loading_aliases = false
//                     $('#loading_aliases').empty()
//                     if (response.aliases && response.aliases.length) {
//                         const aliases = response.aliases
//                         if (BRS.unconfirmedTransactions.length) {
//                             for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
//                                 if (unconfirmedTransaction.type === 1 && (unconfirmedTransaction.subtype === 1 || unconfirmedTransaction.subtype === 7)) {
//                                     let found = false
//                                     for (let j = 0; j < aliases.length; j++) {
//                                         if (aliases[j].aliasName === unconfirmedTransaction.attachment.alias) {
//                                             aliases[j].aliasURI = unconfirmedTransaction.attachment.uri
//                                             aliases[j].tentative = true
//                                             found = true
//                                             break
//                                         }
//                                     }
//                                     if (!found) {
//                                         aliases.push({
//                                             aliasName: unconfirmedTransaction.attachment.alias,
//                                             aliasURI: (unconfirmedTransaction.attachment.uri ? unconfirmedTransaction.attachment.uri : ''),
//                                             tentative: true
//                                         })
//                                     }
//                                 }
//                             }
//                         }
//                         aliases.sort(function (a, b) {
//                             const a_low = a.aliasName.toLowerCase()
//                             const b_low = b.aliasName.toLowerCase()
//                             if (a_low > b_low) {
//                                 return 1
//                             }
//                             if (a_low < b_low) {
//                                 return -1
//                             }
//                             return 0
//                         })
//                         let rows = ''
//                         for (const alias of aliases) {
//                             alias.status = '/'
//                             const unconfirmedTransaction = getUnconfirmedTransactionsFromCache(1, 6, {
//                                 alias: alias.aliasName
//                             }, true)
//                             if (unconfirmedTransaction) {
//                                 alias.tentative = true
//                                 if (unconfirmedTransaction.recipient) {
//                                     alias.buyer = unconfirmedTransaction.recipient
//                                 }
//                                 alias.priceNQT = unconfirmedTransaction.priceNQT
//                             }
//                             if (!alias.aliasURI) {
//                                 alias.aliasURI = ''
//                             }
//                             if (alias.aliasURI.length > 100) {
//                                 alias.shortAliasURI = alias.aliasURI.substring(0, 100) + '...'
//                                 alias.shortAliasURI = alias.shortAliasURI.escapeHTML()
//                             } else {
//                                 alias.shortAliasURI = alias.aliasURI.escapeHTML()
//                             }
//                             alias.aliasURI = alias.aliasURI.escapeHTML()
//                             let allowCancel = false
//                             if ('priceNQT' in alias) {
//                                 if (alias.priceNQT === '0') {
//                                     if (alias.buyer === BRS.account) {
//                                         alias.status = $.t('cancelling_sale')
//                                     } else {
//                                         alias.status = $.t('transfer_in_progress')
//                                     }
//                                 } else {
//                                     if (!alias.tentative) {
//                                         allowCancel = true
//                                     }
//                                     if (typeof alias.buyer !== 'undefined') {
//                                         alias.status = $.t('for_sale_direct')
//                                     } else {
//                                         alias.status = $.t('for_sale_indirect')
//                                     }
//                                 }
//                             }
//                             if (alias.status !== '/') {
//                                 alias.status = "<span class='label label-small label-info'>" + alias.status + '</span>'
//                             }
//                             const aliasName = String(alias.aliasName).escapeHTML()
//                             rows += '<tr' + (alias.tentative ? " class='tentative'" : '') +
//                                               " data-alias='" + aliasName.toLowerCase() +
//                                               "'><td class='alias'>" + aliasName +
//                                               "</td><td class='uri'>" +
//                                               (alias.aliasURI.indexOf('http') === 0
//                                                   ? "<a href='" + alias.aliasURI + "' target='_blank'>" + alias.shortAliasURI + '</a>'
//                                                   : alias.shortAliasURI) +
//                                               "</td><td class='status'>" + alias.status +
//                                               "</td><td style='white-space:nowrap'><a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#register_alias_modal' data-alias='" +
//                                               aliasName + "'>" +
//                                               $.t('edit') +
//                                               "</a> <a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#transfer_alias_modal' data-alias='" +
//                                               aliasName + "'>" +
//                                               $.t('transfer') +
//                                               "</a> <a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#sell_alias_modal' data-alias='" +
//                                               aliasName + "'>" +
//                                               $.t('sell') +
//                                               '</a>' + (allowCancel ? " <a class='btn btn-xs btn-default cancel_alias_sale' href='#' data-toggle='modal' data-target='#cancel_alias_sale_modal' data-alias='" + aliasName + "'>" + $.t('cancel_sale') + '</a>' : '') +
//                                               '</td></tr>'
//                         }
//                         $('#aliases_table tbody').append(rows)
//                     }
//                 })
//             }
//         }
//     }
// })
// TODO there are duplicated code

export function pagesAliases() {
    sendRequest('getAliases+', {
        account: BRS.account,
        timestamp: 0
    }, function (response) {
        if (response.aliases && response.aliases.length) {
            const aliases = response.aliases;
            if (BRS.unconfirmedTransactions.length) {
                for (const unconfirmedTransaction of BRS.unconfirmedTransactions) {
                    if (unconfirmedTransaction.type === 1 && (unconfirmedTransaction.subtype === 1 || unconfirmedTransaction.subtype === 7)) {
                        let found = false;

                        for (let j = 0; j < aliases.length; j++) {
                            if (aliases[j].aliasName === unconfirmedTransaction.attachment.alias) {
                                aliases[j].aliasURI = unconfirmedTransaction.attachment.uri;
                                aliases[j].tentative = true;
                                found = true;
                                break;
                            }
                        }

                        if (!found) {
                            aliases.push({
                                aliasName: unconfirmedTransaction.attachment.alias,
                                aliasURI: (unconfirmedTransaction.attachment.uri ? unconfirmedTransaction.attachment.uri : ''),
                                tentative: true
                            });
                        }
                    }
                }
            }
            let alias_account_count = 0;
            let alias_uri_count = 0;
            let empty_alias_count = 0;
            const alias_count = aliases.length;

            for (const alias of aliases) {
                if (!alias.aliasURI) {
                    alias.aliasURI = '';
                }
                alias.aliasURI = alias.aliasURI.escapeHTML();

                if (!alias.aliasURI) {
                    empty_alias_count++;
                } else if (alias.aliasURI.indexOf('http') === 0) {
                    alias_uri_count++;
                } else if (alias.aliasURI.indexOf('acct:') === 0 || alias.aliasURI.indexOf('nacc:') === 0) {
                    alias_account_count++;
                }
            }
            $('#alias_account_count').html(alias_account_count).removeClass('loading_dots');
            $('#alias_uri_count').html(alias_uri_count).removeClass('loading_dots');
            $('#empty_alias_count').html(empty_alias_count).removeClass('loading_dots');
            $('#alias_count').html(alias_count).removeClass('loading_dots');
        }
    });
    sendRequest('getAliases+', {
        account: BRS.account,
        timestamp: 0,
        firstIndex: 0,
        lastIndex: BRS.alias_page_elements - 1
    }, function (response) {
        if (response.aliases && response.aliases.length) {
            const aliases = response.aliases;

            if (BRS.unconfirmedTransactions.length) {
                for (let i = 0; i < BRS.unconfirmedTransactions.length; i++) {
                    const unconfirmedTransaction = BRS.unconfirmedTransactions[i];

                    if (unconfirmedTransaction.type === 1 && (unconfirmedTransaction.subtype === 1 || unconfirmedTransaction.subtype === 7)) {
                        let found = false;

                        for (let j = 0; j < aliases.length; j++) {
                            if (aliases[j].aliasName === unconfirmedTransaction.attachment.alias) {
                                aliases[j].aliasURI = unconfirmedTransaction.attachment.uri;
                                aliases[j].tentative = true;
                                found = true;
                                break;
                            }
                        }

                        if (!found) {
                            aliases.push({
                                aliasName: unconfirmedTransaction.attachment.alias,
                                aliasURI: (unconfirmedTransaction.attachment.uri ? unconfirmedTransaction.attachment.uri : ''),
                                tentative: true
                            });
                        }
                    }
                }
            }

            aliases.sort(function (a, b) {
                const a_low = a.aliasName.toLowerCase();
                const b_low = b.aliasName.toLowerCase();
                if (a_low > b_low) {
                    return 1;
                }
                if (a_low < b_low) {
                    return -1;
                }

                return 0;
            });

            let rows = '';

            // let alias_account_count = 0
            // let alias_uri_count = 0
            // let empty_alias_count = 0
            // const alias_count = aliases.length
            for (const alias of aliases) {
                alias.status = '/';

                const unconfirmedTransaction = getUnconfirmedTransactionsFromCache(1, 6, {
                    alias: alias.aliasName
                });

                if (unconfirmedTransaction) {
                    alias.tentative = true;
                    if (unconfirmedTransaction[0].recipient) {
                        alias.buyer = unconfirmedTransaction[0].recipient;
                    }
                    alias.priceNQT = unconfirmedTransaction[0].priceNQT;
                }

                if (!alias.aliasURI) {
                    alias.aliasURI = '';
                }

                if (alias.aliasURI.length > 100) {
                    alias.shortAliasURI = alias.aliasURI.substring(0, 100) + '...';
                    alias.shortAliasURI = alias.shortAliasURI.escapeHTML();
                } else {
                    alias.shortAliasURI = alias.aliasURI.escapeHTML();
                }

                alias.aliasURI = alias.aliasURI.escapeHTML();

                let allowCancel = false;

                if ('priceNQT' in alias) {
                    if (alias.priceNQT === '0') {
                        if (alias.buyer === BRS.account) {
                            alias.status = $.t('cancelling_sale');
                        } else {
                            alias.status = $.t('transfer_in_progress');
                        }
                    } else {
                        if (!alias.tentative) {
                            allowCancel = true;
                        }

                        if (typeof alias.buyer !== 'undefined') {
                            alias.status = $.t('for_sale_direct');
                        } else {
                            alias.status = $.t('for_sale_indirect');
                        }
                    }
                }

                if (alias.status !== '/') {
                    alias.status = "<span class='label label-small label-info'>" + alias.status + '</span>';
                }
                const aliasName = String(alias.aliasName).escapeHTML();
                rows += '<tr' + (alias.tentative ? " class='tentative'" : '') +
                    " data-alias='" + aliasName.toLowerCase() +
                    `'><td class='alias'><a href="#" data-alias="${alias.alias}">${aliasName}</a>` +
                    "</td><td class='uri'>" +
                    (alias.aliasURI.indexOf('http') === 0
                        ? "<a href='" + alias.aliasURI + "' target='_blank'>" + alias.shortAliasURI + '</a>'
                        : alias.shortAliasURI) +
                    "</td><td class='status'>" + alias.status +
                    "</td><td style='white-space:nowrap'><a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#register_alias_modal' data-alias='" +
                    aliasName + "'>" +
                    $.t('edit') +
                    "</a> <a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#transfer_alias_modal' data-alias='" +
                    aliasName + "'>" +
                    $.t('transfer') +
                    "</a> <a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#sell_alias_modal' data-alias='" +
                    aliasName + "'>" +
                    $.t('sell') +
                    '</a>' + (allowCancel ? " <a class='btn btn-xs btn-default cancel_alias_sale' href='#' data-toggle='modal' data-target='#cancel_alias_sale_modal' data-alias='" + aliasName + "'>" + $.t('cancel_sale') + '</a>' : '') +
                    '</td></tr>';

                // if (!alias.aliasURI) {
                //     empty_alias_count++
                // } else if (alias.aliasURI.indexOf('http') === 0) {
                //     alias_uri_count++
                // } else if (alias.aliasURI.indexOf('acct:') === 0 || alias.aliasURI.indexOf('nacc:') === 0) {
                //     alias_account_count++
                // }
            }

            $('#aliases_table tbody').empty().append(rows);
            dataLoadFinished($('#aliases_table'));
        } else {
            $('#aliases_table tbody').empty();
            dataLoadFinished($('#aliases_table'));

            $('#alias_account_count, #alias_uri_count, #empty_alias_count, #alias_count').html('0').removeClass('loading_dots');
        }

        pageLoaded();
    });
}

export function incomingAliases() {
    if (BRS.checkIncoming.newTransactions || BRS.checkIncoming.unconfirmedChanged) {
        reloadCurrentPage()
    }
}

export function evAliasSearchSubmit(e) {
    e.preventDefault()
    const alias = $('#alias_search input[name=q]').val()
    $('#search_box input').val('alias:' + alias)
    // Execute the search via "search pages"
    goToPage('search_results')
}
