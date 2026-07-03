const fs = require('fs');
const path = require('path');

// Define the paths
const skeletonPath = './src/index.html';
const outputPath = './dist/index.html';

// Mapping of placeholders to HTML files
const htmlFiles = [
    { location: 'SIDEBAR', path: 'html/sidebar.html' },
    { location: 'SIDEBAR_CONTEXT', path: 'html/sidebar_context.html' },
    { location: 'MODALS_ACCOUNT', path: 'html/modals/account.html' },
    { location: 'MODALS_ALIAS', path: 'html/modals/alias.html' },
    { location: 'MODALS_ASSET', path: 'html/modals/asset.html' },
    { location: 'MODALS_BLOCK_INFO', path: 'html/modals/block_info.html' },
    { location: 'MODALS_SERVER_INFO', path: 'html/modals/server_info.html' },
    { location: 'MODALS_CONTACT', path: 'html/modals/contact.html' },
    { location: 'MODALS_ESCROW', path: 'html/modals/escrow.html' },
    { location: 'MODALS_RAW_TRANSACTION', path: 'html/modals/raw_transaction.html' },
    { location: 'MODALS_REQUEST_BURST_QR', path: 'html/modals/request_burst_qr.html' },
    { location: 'MODALS_MINING', path: 'html/modals/mining.html' },
    { location: 'MODALS_SEND_MESSAGE', path: 'html/modals/send_message.html' },
    { location: 'MODALS_SEND_MONEY', path: 'html/modals/send_money.html' },
    { location: 'MODALS_SUBSCRIPTION', path: 'html/modals/subscription.html' },
    { location: 'MODALS_TRANSACTION_INFO', path: 'html/modals/transaction_info.html' },
    { location: 'MODALS_USER_INFO', path: 'html/modals/user_info.html' },
    { location: 'MODALS_SIGN_MESSAGE', path: 'html/modals/sign_message.html' },
    { location: 'HEADER', path: 'html/header.html' },
    { location: 'PAGES_DASHBOARD', path: 'html/pages/dashboard.html' },
    { location: 'PAGES_TRANSACTIONS', path: 'html/pages/transactions.html' },
    { location: 'PAGES_ALIASES', path: 'html/pages/aliases.html' },
    { location: 'PAGES_MESSAGES', path: 'html/pages/messages.html' },
    { location: 'PAGES_CONTACTS', path: 'html/pages/contacts.html' },
    { location: 'PAGES_ASSET_EXCHANGE', path: 'html/pages/asset_exchange.html' },
    { location: 'PAGES_SETTINGS', path: 'html/pages/settings.html' },
    { location: 'PAGES_PEERS', path: 'html/pages/peers.html' },
    { location: 'PAGES_BLOCKS', path: 'html/pages/blocks.html' },
    { location: 'PAGES_LOCKSCREEN', path: 'html/pages/lockscreen.html' },
    { location: 'PAGES_NOTIFICATIONS', path: 'html/pages/notifications.html' }
]

// Read the skeleton file
let skeletonContent = fs.readFileSync(skeletonPath, 'utf8');

// Replace each placeholder with the corresponding HTML content
for (const item of htmlFiles) {
    const filePath = path.join('./src', item.path);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    skeletonContent = skeletonContent.replace(`#${item.location}#`, fileContent);
}

// Write the combined content to the output file
fs.writeFileSync(outputPath, skeletonContent);

console.log('index.html build completed!');
