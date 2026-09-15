# Neoclassic Wallet

Neoclassic is the next version of Signum Classic Wallet. It aims to be as complete as possible and easy to maintain.

## How to use

Try at vercel:

https://neoclassic-wallet-lake.vercel.app/

OR from latest release:

* If you run a Signum node, you can extract the files on the latest release to a new folder `signum-node/html/ui/neoclassic` and then point your browser to http://localhost:8125/neoclassic/

OR on your local node

* If you run a node, it is also possible to overwrite files from Classic Wallet at folder `signum-node/html/ui/classic` with the ones included in the latest release.

OR if you are a programmer - **recommended!**

1) Clone this repository to your machine
2) Install node dependencies: `npm install`
3) Build the project: `npm run release`
3) Start the server when you want to use: `npm start`. Server depends on python http.server package (probaly already installed).
4) Point your browser to `http://localhost:1221`

## Security advice
- Transactions are signed on browser, no passphrase transmitted to servers.
- Use a password manager integrated with your browser to speed up login. Neoclassic does not store the passphrase on disc, just in memory and if selected "Remember passphrase on this session".

## Release Notes

### **Version 1.0**
**Features & UI**
* Added Hashicons for account avatars.
* Added option to send raw bytes in messages.

**Developer & Build Improvements**
* **Massive internal refactoring:**
  * Moved code into new files for better organization.
  * Implemented `esbuild` to create a single minified JavaScript bundle, replacing the previous multiple file loading system for faster load times.
  * Removed inlined JavaScript from HTML files.
* **Dependency Management:**
  * Removed duplicated code (curve 25519 and SHA256).
  * Removed dependencies: `big.js`, `bignumber.js`, `qrcode.js`.
  * Moved dependencies to npm instead of copied code where possible: jQuery, pako, i18next, AdminLTE.
* Updated AdminLTE to version 3 and simplified associated code.

---

### **Version 1.1**
**New Features**
* Added option to limit requests per node.
* Improved search functionality with better support for aliases and blocks.
* Enhanced Escrow pages and modals (create and decide); now fully functional.
* Fixed Alias page and modals for regular aliases and TLDs; working perfectly.
* Added pagination to multiple pages (Aliases, Forged Blocks, Transfer History) and subpages (Asset Exchange 'Trades').
* **New Pages:**
  * **Notifications:** History of all notifications.
  * **Token Administration:** Options to Issue asset, Mint asset, Distribute to token holders, Transfer ownership, and Add treasury account.
* Added modal to view top token holders (available on Token Exchange page).
* Created a schema for plain text signing (easy to copy/paste).

**User Experience & Localization**
* **Localization:** Full translation support added for numbers, dates, time durations, and UI text in: Portuguese (Brazilian), Spanish, Polish, Chinese (Simplified/Traditional), Hindi, French, Russian, Japanese, Indonesian, German, Turkish.
* Added visual feedback when number inputs are invalid or messages exceed size limits.
* **Modal Stacking:** Users can now open multiple modals simultaneously (e.g., view account info → click transaction for details → close and return).
* Fixed compatibility issues to allow use of the NeoClassic wallet on mobile browsers.
* Added option to activate new accounts.

**Performance & Reliability**
* All pages now display pending messages where applicable and refresh content automatically upon receiving a new block.
* Implemented async code for page updates (My Tokens, Open Orders, Peers), reducing load times from seconds to milliseconds.
* Used asynchronous decryption for faster loading and no user input locking during message retrieval.

**Developer & Internal Improvements**
* **Migration to TypeScript:** All code converted to TypeScript; bugs found and fixed.
* **Code Structure Rearrangement:**
  * `core`: Engine-related logic.
  * `pages`: Page-specific logic.
  * `modals`: Modal logic and special form verification.
  * `tools`: Shared utilities used by pages and modals.
* **Dependency Updates & Removals:**
  * Moved to npm: `jssha256`, `fontawesome`.
  * Removed dependencies (implemented native alternatives):
    * `Clipboard.js` (using native JavaScript).
    * `WebDB.js` (replaced with simplified `database.ts`).
    * `CryptoJS.js` (replaced with Web Crypto API).
    * `BigInteger` (replaced with JavaScript native `BigInt`).
* **API & Network Optimization:**
  * Created new class `RequestController` to handle concurrency, retries, cancellation, and rate limiting (replacing `ajaxRetry`).
  * Replaced custom notifications with Bootstrap 'toasts'.
  * Used multi-query Node API endpoints in specific areas (e.g., `getBlocks`, `getCurrentOrders`), reducing request volume from dozens to one.
* **Build Process:** Building a single HTML file at compilation to avoid multiple network requests and ensure AdminLTE event handlers function correctly.
* **Error Handling:** Improved `verifyTransactionBytes` error messages to indicate exactly where verification failed.
* **Routing:** Pages and modals now load via URL hash (removed excessive event listeners).
* **Documentation:** Added `doc.md` with developer documentation on code navigation.
