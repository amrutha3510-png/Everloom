import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
let content = fs.readFileSync(envPath, 'utf8');

const lines = content.split(/\r?\n/);
const updatedLines = lines.map(line => {
    if (line.trim().startsWith('MONGO_URI=')) {
        let val = line.substring(line.indexOf('=') + 1).trim();
        let quote = '';
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            quote = val[0];
            val = val.slice(1, -1);
        }

        const atIdx = val.indexOf('@');
        if (atIdx !== -1) {
            const userPassPrefix = val.substring(0, atIdx + 1);
            let rest = val.substring(atIdx + 1);
            
            const qIdx = rest.indexOf('?');
            let queryParams = '';
            if (qIdx !== -1) {
                queryParams = rest.substring(qIdx);
            }
            
            const newHostAndDb = 'cluster0.pqmnypo.mongodb.net/everloom';
            const newUri = userPassPrefix + newHostAndDb + queryParams;
            return `MONGO_URI=${quote}${newUri}${quote}`;
        }
    }
    return line;
});

fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf8');
console.log('.env MONGO_URI rebuilt successfully.');
