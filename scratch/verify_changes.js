import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Check EJS compilation of product-details.ejs
const pdPath = path.join(__dirname, '../src/views/user/shop/product-details.ejs');
const pdContent = fs.readFileSync(pdPath, 'utf8');
ejs.compile(pdContent, { filename: pdPath });
console.log('product-details.ejs compiled successfully!');

// 2. Import dashboard controller & service to verify syntax
await import('../src/controllers/admin/dashboard.controller.js');
await import('../src/services/admin/dashboard.service.js');
console.log('Dashboard controller & service imported successfully!');
