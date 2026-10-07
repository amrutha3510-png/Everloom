import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import '../src/models/userModel.js';
import '../src/models/productModel.js';
import '../src/models/orderModel.js';

import { getSalesReportData, generateSalesReportPDF } from '../src/services/admin/salesReport.service.js';

async function testPdf() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/everloom';
    await mongoose.connect(mongoUri);

    console.log('Fetching sales report data...');
    const data = await getSalesReportData('monthly');
    console.log(`Generating PDF for ${data.orders.length} orders...`);
    
    const buffer = await generateSalesReportPDF(data);
    console.log(`PDF generated successfully! Buffer length: ${buffer.length} bytes`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error generating PDF:', err);
  }
}

testPdf();
