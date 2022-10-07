/**
 * @depends {brs.js}
 */
var BRS = (function(BRS, $, undefined) {
    BRS.automaticallyCheckRecipient = function() {
        var $recipientFields = $("#add_contact_account_id, #update_contact_account_id, #buy_alias_recipient, #escrow_create_recipient, #inline_message_recipient, #lease_balance_recipient, #reward_recipient, #sell_alias_recipient, #send_message_recipient, #send_money_recipient, #subscription_cancel_recipient, #subscription_create_recipient, #transfer_alias_recipient, #transfer_asset_recipient");

        $recipientFields.on("blur", function() {
            $(this).trigger("checkRecipient");
        });

        $recipientFields.on("checkRecipient", function() {
            var value = $(this).val();
            var modal = $(this).closest(".modal");

            if (value && value != "BURST-____-____-____-_____" && value != "S-____-____-____-_____") {
                BRS.checkRecipient(value, modal);
            } else {
                modal.find(".account_info").hide();
            }
        });

        $recipientFields.on("oldRecipientPaste", function() {});
    };

    BRS.sendMoneyCalculateTotal = function(element) {
        const current_amount = parseFloat($("#send_money_amount").val(), 10);
        const current_fee = parseFloat($("#send_money_fee").val(), 10);
        const fee = isNaN(current_fee) ? BRS.minimumFee : (current_fee < BRS.minimumFee ? BRS.minimumFee : current_fee);
        const amount = isNaN(current_amount) ? 0 : (current_amount < 0.00000001 ? 0 : current_amount);

        $("#send_money_fee").val(fee.toFixed(8));

        $(element).closest(".modal").find(".total_amount_ordinary").html(BRS.formatAmount(BRS.convertToNQT(amount + fee)) + " " + BRS.valueSuffix);
    };
    
    BRS.commitmentCalculateTotal = function(element) {
        const current_amount = parseFloat($("#commitment_amount").val(), 10);
        const current_fee = parseFloat($("#commitment_fee").val(), 10);
        const fee = isNaN(current_fee) ? BRS.minimumFee : (current_fee < BRS.minimumFee ? BRS.minimumFee : current_fee);
        const amount = isNaN(current_amount) ? 0 : (current_amount < 0.00000001 ? 0 : current_amount);

        $("#commitment_fee").val(fee.toFixed(8));

        $(element).closest(".modal").find(".total_amount_commitment").html(BRS.formatAmount(BRS.convertToNQT(amount + fee)) + " " + BRS.valueSuffix);
    };


    BRS.forms.sendMoneyComplete = function(response, data) {
        if (!(data._extra && data._extra.convertedAccount) && !(data.recipient in BRS.contacts)) {
            $.notify($.t("success_send_money", {"valueSuffix": BRS.valueSuffix}) + " <a href='#' data-account='" + BRS.getAccountFormatted(data, "recipient") + "' data-toggle='modal' data-target='#add_contact_modal' style='text-decoration:underline'>" + $.t("add_recipient_to_contacts_q") + "</a>", {
                type: 'success',
                offset: {
                    x: 5,
                    y: 60
                }
            });
        } else {
            $.notify($.t("success_send_money", {"valueSuffix": BRS.valueSuffix}), {
                type: 'success',
                offset: {
                    x: 5,
                    y: 60
                }
            });
        }
    };

    BRS.sendMoneyShowAccountInformation = function(accountId) {
        BRS.getAccountTypeAndMessage(accountId, function(response) {
            if (response.type === "success") {
                $("#send_money_account_info").hide();
            } else {
                $("#send_money_account_info").html(response.message).show();

            }
        });
    };

    BRS.getAccountTypeAndMessage = function(accountId, callback) {
        // accountId sometimes comes with an RS-Address
        let sureItIsId = accountId
        if (BRS.rsRegEx.test(accountId)) {
            sureItIsId = BRS.convertRSAccountToNumeric(accountId)
            if (sureItIsId === "") {
                callback({
                    "type": "danger",
                    "message": $.t("recipient_malformed"),
                    "account": null
                });
                return;
            }
        }
        if (sureItIsId === "0") {
            callback({
                "type": "warning",
                "message": $.t("recipient_burning_address"),
                "account": null,
                "noPublicKey": true
            });
            return;
        }
        // first guess it is an AT
        BRS.sendRequest("getAT", {
            "at": sureItIsId
        }, function (newResponse) {
            if (newResponse.errorCode === undefined) {
                callback({
                    "type": "info",
                    "message": $.t("recipient_smart_contract", {
                        "burst": BRS.formatAmount(newResponse.balanceNQT, false, true),
                        "valueSuffix": BRS.valueSuffix
                    }),
                    "account": newResponse,
                    "noPublicKey": true
                });
                return;
            }

            // It is not an AT, get account
            BRS.sendRequest("getAccount", {
                "account": sureItIsId
            }, function(response) {
                switch (response.errorCode) {
                case undefined:
                    // expected right 
                    break;
                case 4:
                    callback({
                        "type": "danger",
                        "message": $.t("recipient_malformed"),
                        "account": null
                    });
                    return;
                case 5:
                    callback({
                        "type": "warning",
                        "message": $.t("recipient_unknown_pka"),
                        "account": null,
                        "noPublicKey": true
                    });
                    return;
                default:
                    callback({
                        "type": "danger",
                        "message": $.t("recipient_problem") + " " + String(response.errorDescription).escapeHTML(),
                        "account": null
                    });
                    return;
                }
                if (response.publicKey === undefined || response.publicKey === "0000000000000000000000000000000000000000000000000000000000000000") {
                    callback({
                        "type": "warning",
                        "message": $.t("recipient_no_public_key", {
                            "burst": BRS.formatAmount(response.unconfirmedBalanceNQT, false, true),
                            "valueSuffix": BRS.valueSuffix
                        }),
                        "account": response,
                        "noPublicKey": true
                    });
                    return;
                }
                callback({
                    "type": "info",
                    "message": $.t("recipient_info", {
                        "burst": BRS.formatAmount(response.unconfirmedBalanceNQT, false, true),
                        "valueSuffix": BRS.valueSuffix
                    }),
                    "account": response
                });
            });
        });
    }


    BRS.correctAddressMistake = function(el) {
        $(el).closest(".modal-body").find("input[name=recipient],input[name=account_id]").val($(el).data("address")).trigger("blur");
    };

    BRS.checkRecipient = function(account, modal) {
        let classes = "callout-info callout-danger callout-warning";

        let callout = modal.find(".account_info").first();
        let accountInputField = modal.find("input[name=converted_account_id]");
        let merchantInfoField = modal.find("input[name=merchant_info]");
        let recipientPublicKeyField = modal.find("input[name=recipientPublicKey]");

        accountInputField.val("");
        merchantInfoField.val("");

        account = $.trim(account);

        const accountParts = BRS.rsRegEx.exec(account)
        if (accountParts !== null) {
            // Account seems to be RS Address
            let address = new NxtAddress(BRS.prefix);
            if (address.set(accountParts[2])) {
                // Account is RS Address
                if(accountParts[3] !== undefined) {
                    // Account is extended RS Address. Verify the public key
                    let publicKey = new BigNumber(accountParts[3], 36).toString(16);
                    let checkRS = BRS.getAccountIdFromPublicKey(publicKey, true);
                    
                    if(!checkRS.includes(accountParts[2])){
                        // Public key does not match RS Address
                        callout.removeClass(classes).addClass("callout-danger").html($.t("recipient_malformed")).show();
                    }
                    else {
                        // Address verified
                        callout.removeClass(classes).addClass("callout-info").html($.t("recipient_info_extended")).show();
                    }
                } else {
                    // Account is RS Address and it isn't extended
                    BRS.getAccountTypeAndMessage(address.account_id(), function(response) {
                        modal.find("input[name=recipientPublicKey]").val("");
                        modal.find(".recipient_public_key").hide();
                        if (response.account && response.account.description) {
                            checkForMerchant(response.account.description, modal);
                        }
                        // let message = response.message.escapeHTML();
                        callout.removeClass(classes).addClass("callout-" + response.type).html(response.message).show();
                  });
                }
            } else {
                // Account seems to be RS Address but there is an error
                if (address.guess.length === 1) {
                    // There is only one option of error correction suggestion.
                    callout.removeClass(classes).addClass("callout-danger").html($.t("recipient_malformed_suggestion", {
                        "recipient": "<span class='malformed_address' data-address='" + String(address.guess[0]).escapeHTML() + "' onclick='BRS.correctAddressMistake(this);'>" + address.format_guess(address.guess[0], account) + "</span>"
                    })).show();
                } else if (address.guess.length > 1) {
                    // There are many options of error correction suggestion.
                    let html = $.t("recipient_malformed_suggestion", {
                        "count": address.guess.length
                    }) + "<ul>";
                    for (let i = 0; i < address.guess.length; i++) {
                        html += "<li><span clas='malformed_address' data-address='" + String(address.guess[i]).escapeHTML() + "' onclick='BRS.correctAddressMistake(this);'>" + address.format_guess(address.guess[i], account) + "</span></li>";
                    }
                    callout.removeClass(classes).addClass("callout-danger").html(html).show();
                } else {
                    // There is no error correction suggestion
                    callout.removeClass(classes).addClass("callout-danger").html($.t("recipient_malformed")).show();
                }
            }
            return;
        }
        if (BRS.idRegEx.test(account)) {
            // Account matches numeric ID
            BRS.getAccountTypeAndMessage(account, function(response) {
                callout.removeClass(classes).addClass("callout-" + response.type).html(response.message.escapeHTML()).show();
            });
            return;
        }
        if (account.charAt(0) === '@') {
            // Suposed to be an alias
            BRS.checkRecipientAlias(account.substring(1), modal);
            return;
        }
        let contact = undefined
        for (const rsAddress in BRS.contacts) {
            if (BRS.contacts[rsAddress].name === account) {
                contact = BRS.contacts[rsAddress]
                break
            }
        }
        if (contact) {
            BRS.getAccountTypeAndMessage(contact.account, function(response) {
                modal.find("input[name=recipientPublicKey]").val("");
                modal.find(".recipient_public_key").hide();
                if (response.account && response.account.description) {
                    checkForMerchant(response.account.description, modal);
                }
                callout.removeClass(classes).addClass("callout-" + response.type).html($.t("contact_account_link", {
                    "account_id": BRS.getAccountFormatted(contact, "account")
                }) + " " + response.message.escapeHTML()).show();
                if (response.type === "info" || response.type === "warning") {
                    accountInputField.val(contact.accountRS);
                }
            });
            return;
        }
        callout.removeClass(classes).addClass("callout-danger").html($.t("name_not_in_contacts", { name: account }) + " " + $.t("recipient_alias_suggestion")).show();
    };

    BRS.checkRecipientAlias = function(account, modal) {
        var classes = "callout-info callout-danger callout-warning";
        var callout = modal.find(".account_info").first();
        var accountInputField = modal.find("input[name=converted_account_id]");

        accountInputField.val("");

        BRS.sendRequest("getAlias", {
            "aliasName": account
        }, function(response) {
            if (response.errorCode) {
                callout.removeClass(classes).addClass("callout-danger").html($.t("error_invalid_alias_name")).show();
            } else {
                if (response.aliasURI) {
                    var alias = String(response.aliasURI);
                    var timestamp = response.timestamp;

                    var regex_1 = /acct:(.*)@burst/;
                    var regex_2 = /nacc:(.*)/;

                    var match = alias.match(regex_1);

                    if (!match) {
                        match = alias.match(regex_2);
                    }

                    if (match && match[1]) {
                        var address = new NxtAddress();
                        if (!address.set(String(match[1]).toUpperCase())) {
                            accountInputField.val("");
                            callout.html("Invalid account alias.");
                        }

                        BRS.getAccountTypeAndMessage(address.account_id(), function(response) {
                            modal.find("input[name=recipientPublicKey]").val("");
                            modal.find(".recipient_public_key").hide();
                            if (response.account && response.account.description) {
                                checkForMerchant(response.account.description, modal);
                            }

                            accountInputField.val(address.toString());
                            callout.html($.t("alias_account_link", {
                                "account_id": address.toString()
                            }) + ".<br>" + $.t("alias_last_adjusted", {
                                "timestamp": BRS.formatTimestamp(timestamp)
                            }) +  "<br>" + response.message).removeClass(classes).addClass("callout-" + response.type).show();
                        });
                    } else {
                        callout.removeClass(classes).addClass("callout-danger").html($.t("alias_account_no_link") + (!alias ? $.t("error_uri_empty") : $.t("uri_is", {
                            "uri": String(alias).escapeHTML()
                        }))).show();
                    }
                } else if (response.aliasName) {
                    callout.removeClass(classes).addClass("callout-danger").html($.t("error_alias_empty_uri")).show();
                } else {
                    callout.removeClass(classes).addClass("callout-danger").html(response.errorDescription ? $.t("error") + ": " + String(response.errorDescription).escapeHTML() : $.t("error_alias")).show();
                }
            }
        });
    };

    function checkForMerchant(accountInfo, modal) {
        var requestType = modal.find("input[name=request_type]").val();

        if (requestType === "sendMoney" || requestType === "transferAsset") {
            if (accountInfo.match(/merchant/i)) {
                modal.find("input[name=merchant_info]").val(accountInfo);
                var checkbox = modal.find("input[name=add_message]");
                if (!checkbox.is(":checked")) {
                    checkbox.prop("checked", true).trigger("change");
                }
            }
        }
    }

    return BRS;
}(BRS || {}, jQuery));
