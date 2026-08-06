// lang/updateFiles.js
const fs = require('fs');
const path = require('path');

const INPUT = 'translations.csv';
if (!fs.existsSync(INPUT)) {
    console.error(`${INPUT} file not found`);
    process.exit(99);
}

const content = fs.readFileSync(INPUT, 'utf-8');

function parseCSV(csvString) {
    const lines = csvString.split('\n');
    const result = [];

    for (const line of lines) {
        if (!line.trim()) continue; // Skip empty lines

        const row = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                // Toggle quote state
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                // Field separator outside quotes
                row.push(currentField ? currentField : null);
                currentField = '';
            } else if (char === '\\' && inQuotes) {
                switch (line[i+1]) {
                    case 'n':
                        currentField += '\n';
                        break;
                    case '"':
                        currentField += '"';
                        break;
                    case "'":
                        currentField += "'";
                        break;
                    case '\\':
                        currentField += '\\';
                        break;
                    default:
                        currentField += char + line[i+1];
                }
                i++;
            } else if (inQuotes) {
                // Add character to current field
                currentField += char;
            } else {
                console.log('Malformed csv file. Stray char at item: ' + row[0])
            }
        }

        // Add the last field
        row.push(currentField ? currentField : null);

        result.push(row);
    }

    return result;
}

const table = parseCSV(content)

const translations = {};
for (let j =1; j < table[0].length; j++) {
    translations[table[0][j]]={}
}

// Process each line
let expressionCount = 0;
for (let i = 1; i < table.length; i++) {
    const line = table[i];
    for (let j =1; j < table[0].length; j++) {
        if (line[j]===undefined) {
            console.log('Malformed csv file. Missing collumns at item: ' + line[0])
        }
        if (line[j]!==null) {
            translations[table[0][j]][line[0]]=line[j]
        }
    }
}

// Export each language as JSON file
const distLocalesPath = path.join(__dirname, '../dist/locales');
if (fs.existsSync(distLocalesPath)) {
    fs.rmSync(distLocalesPath, { recursive: true });
}
fs.mkdirSync(distLocalesPath, { recursive: true });

for (const [lang, data] of Object.entries(translations)) {
    const jsonContent = JSON.stringify(data, null, 4) + '\n';
    fs.writeFileSync(path.join(distLocalesPath, `${lang}.json`), jsonContent);
}

console.log(`${Object.keys(translations).length} translation files generated. ${table.length - 1} expressions processed`);
