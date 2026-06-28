# Documentation for developers

- [Numbers](#numbers)
- [Function `sendRequest`](#function-sendrequest)
- [Forms](#forms)
- [Pages](#pages)
- [Pagination](#pagination)

## Numbers

### Coins and Tokens formats
Values of blockchain coin's (Signa) are called in 'amount', while values of colored coins (or assets or tokens) are called in 'quantity'.
* **Amount**: Signa amount is a human friendly format.
It is localized, so in english can be '1,234.56789012' or on portuguese '1.234,56789012'.
Signa values can have up to 8 decimals.
* **Quantity**: Asset quantity is a human friendly format.
Quantities can have can have from zero up to 8 decimals, depending on asset properties.
Quantity is a value localized.
If an asset has 2 decimals, valid values in english are '1234' or '12,345.01' or in portuguese '1234' or '12.345,01'
* **NQT**: Amounts in NQT are the blockchain format.
No decimals neither group separators allowed.
One Signa is '100000000'.
Used in the API as `balanceNQT`, `commitmentNQT` and others.
* **QNT**: Quantities in QNT are the blockchain format.
No decimals neither group separators allowed.
One asset unit depends on its decimals. If an asset has 2 decimals, asset quantity of '1.23' (en) is '123' in QNT.
Used in the API as `quantityQNT`, `balanceQNT` and others
* NumberObject: used internally to make easier to apply the format.

### Tokens price formats
* **PriceQuantity**: An asset price in human friendly format.
Represents the price in Amount per Quantity.
Used to interact with humans in forms.
* **PriceNQT**: An asset price in blockchain format.
Represents the price in NQT per QNT.
Commonly used in the API as `priceNQT`.

### Numbers in forms: input fields in HTML code
Due to localization, all forms that will handle numbers must be `type="text"` and the property `min="0"` to be checked before submission.
The 'min' property need to set in english, and it will be handled correctly internally.
So, if minimum fee is 0.01, the field will be at least `<input type="text" min="0.01" />`.
The user in Germany can enter "0,005" and the form submit will fail with the message that value is below minimum.
To have the input checked and decorated during user input, use class `ev-check-number-input`.


## Function `sendRequest`
One of the most important functions, it is used to send a request to the node that was selected at the login screen.
There is a lot of logics inside it, because it adjusts both the request and the response to simplofy the usage.
Check the features:
* Auto adjust POST or GET methods
* Handle queue for many requests
* Check saved password
* Sign and broadcast transactions, if needed.
* Check internally if the response was not tampered
### Argument options
#### `requestType: string`
A string with the API request to be done.
* Option `+`:
If a request has a plus at the end, indicate that the request can be aborted if the user change the page he was requesting.
This is done in `ajaxmultiqueue` file, checking current page. If the page has changed, the queued request is not done and any ongoing is aborted.
#### `data: Object`
The object containing the fields and values to be sent.
### Return object
`sendRequest` returns a promise with the response.
The promise never fails, instead the response will have the properties `errorCode` and `errorDescription`.
Error code '-1' is used if there was an error in the ajax request, like the server is down or request timed out.
Positive error codes are the the ones that the signum node respond.

## Modals

Creating a new modal
* create html code for the modal (use the template file)
* create the 'formFunction' if data in modal need some formatting
* Define custom messsages for sucess or error, if needed.
They can be created by the formFunction, or by adding the property 'error_request_type' and/or 'success_request_type' in translation.csv.
* Define custom form 'formFunctionComplete', if needed, for success after posting the request
* Define custom form 'formFunctionError', if needed, to handle reponse error of request

Notes:
* Remember to check and add new modal to `automaticallyCheckRecipient` at file `recipients` if needed.

## Forms

### formFunction
Form functions can handle the html form data and process it.
Some simple cases doesn't need the form, when the fields can be passed directly to the API.
Function names are created by 'form' + 'requestType' and shall be added to `BRS.forms`.
The formFunction optionally can return a Promise.
#### Argument `data`
The `data` object will have all the fields from the form.
You can add or delete fields, but remember to delete the ones that cannot be submitted to the API.
#### Return object
It is expected that the return object has the fields, or a Promise with these fields:
* `error?: string`
Adds the error message to the modal callout and do not submit.
The modal will be kept open.
* `requestType?: string`
If present, the form can change or add the correct request type.
It is used because some modals can have many requests depending on options.
* `data?: any`
If present, override the data created with the form fields.
Must be used if you need to add or delete properties to the data to be submitted.
* `successMessage?: string`
Custom message to be presented after data submitted successfull
* `errorMessage?: string`
Custom message to be presented if data submitted had an error
* `stop?: boolean`
Set to `true` to stop propagation.
* `hide?: boolan`
Only used if `stop = true`.
Set hide to `true` to close the modal.
Otherwise the modal will stay open.
No message will be added to the callout.

### formFunctionComplete
Function names are created by 'form' + 'requestType' + 'Complete' and shall be added to `BRS.forms`.
If the request is successfull and the 'formFunctionComplete' is defined, it is called with two arguments:
* `response: PostResponse`
The server response, including transaction generated.
Note this is an unconfirmed transaction, it may not be confirmed in some cases.
* `data`
It is the form data used to generate the request.

### formFunctionError
Function names are created by 'form' + 'requestType' + 'Error' and shall be added to `BRS.forms`.
If there is a problem in the response, it is passed as argument to the function:
* `response`
Object with the 'errorCode' and maybe 'errorDescription'.
* `data`
The form data used to generate the request.

## Pages
TODO

### pageFunction
TODO

### incomingFunction
This function, if defined in `BRS.incoming`, is called when a new block is forged or when there is a new pending message to the user account.
Note that `BRS.checkIncoming` will have more details about the call.
The incomingFunction will the called with the argument:
* `transactions: Transaction[]`
If there are new transactions, the last 10 confirmed transactions will be included.
If there are a new pending transaction, all pending transactions will be passed. Unconfirmed transactions will include properties `height: 2147483647`, `confirmations: -1`, `block: ''` and `blockTimestamp: -1`, so they can have 'Transaction' type.
On top, all pending transactions have the property `unconfirmed: true` added by the `sendRequest` function.

## Pagination
Pagination can be easily added in pages:
* Add class `paginated` in the page element.
* Add an item `<div class="data-pagination"></div>` in the page.
I will receive the text for pagination.
* Send the request using pagination in API.
`BRS.pageNumber` is set to 1 when a page is first loaded, and updated when user clicks in the links.
```js
{
    ...
    firstIndex: BRS.pageSize * (BRS.pageNumber - 1),
    lastIndex: BRS.pageSize * BRS.pageNumber,
}
```
* It is needed to set `BRS.hasMorePages = true` to indicate to pagination process, to show an item to the next page.
```js
if (response.trades.length > BRS.pageSize) {
    BRS.hasMorePages = true
    response.trades.pop()
}
```
* The pagination process will set `BRS.pageNumber`, set page to display the loading animation, and the pageFunction will be called again.
* It is possible to add pagination if the page has subpage.
* The pagination is added by the `dataLoaded()`, or `pageLoaded()`, or if in a subpage, add by `addPagination()`
