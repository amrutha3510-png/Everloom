import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import Product from '../src/models/productModel.js';

function fetchPage(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${urlPath}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function testAllProducts() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/everloom';
    await mongoose.connect(mongoUri);

    const products = await Product.find({ isDeleted: false, status: 'Active' }).lean();

    for (const p of products) {
      const url = `/shop/product/${p._id}`;
      const res = await fetchPage(url);
      if (res.statusCode === 200) {
        const html = res.data;
        const match = html.match(/<div[^>]*id="price-display"[^>]*>([\s\S]*?)<\/div>/i);
        if (match) {
          console.log(`\n=== Product: "${p.name}" (${p._id}) ===`);
          console.log(match[0].replace(/\s+/g, ' '));
        }
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

testAllProducts();
