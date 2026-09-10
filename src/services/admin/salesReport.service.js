import Order from '../../models/orderModel.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

/**
 * Builds date range filter query based on report type.
 */
export const buildDateRangeFilter = (reportType, customStartDate, customEndDate) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (reportType === 'daily') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (reportType === 'weekly') {
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    start = new Date(now.setDate(diffToMonday));
    start.setHours(0, 0, 0, 0);
    end = new Date();
    end.setHours(23, 59, 59, 999);
  } else if (reportType === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else if (reportType === 'yearly') {
    start = new Date(now.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);
  } else if (reportType === 'custom') {
    if (customStartDate) {
      start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(0);
    }

    if (customEndDate) {
      end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
    } else {
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }
  } else {
    // Default to Monthly
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
};

/**
 * Fetch Sales Report metrics and order details based on date range.
 * STRICT BUSINESS RULE: Exclude Cancelled and Returned orders from sales totals.
 */
export const getSalesReportData = async (reportType = 'monthly', customStartDate = null, customEndDate = null) => {
  const { start, end } = buildDateRangeFilter(reportType, customStartDate, customEndDate);

  // Match orders created within range and excluding Cancelled & Returned
  const matchQuery = {
    createdAt: { $gte: start, $lte: end },
    status: { $nin: ['Cancelled', 'Returned'] }
  };

  const orders = await Order.find(matchQuery)
    .populate('user', 'fullName email')
    .sort({ createdAt: -1 });

  let totalSalesCount = orders.length;
  let totalOrderAmount = 0;
  let couponDeductions = 0;
  let totalDiscountAmount = 0;
  let finalSalesAmount = 0;

  orders.forEach(order => {
    const orderFinal = order.totalAmount || 0;
    const orderCoupon = order.discountAmount || 0;
    const shipping = order.shippingCharge || 0;

    // Item subtotal before coupon
    let itemSubtotal = 0;
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        itemSubtotal += (item.price || 0) * (item.quantity || 1);
      });
    }

    totalOrderAmount += itemSubtotal;
    couponDeductions += orderCoupon;
    finalSalesAmount += orderFinal;
  });

  return {
    reportType,
    dateRange: {
      start: start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      end: end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      rawStart: start.toISOString().split('T')[0],
      rawEnd: end.toISOString().split('T')[0]
    },
    summary: {
      totalSalesCount,
      totalOrderAmount,
      couponDeductions,
      totalDiscountAmount,
      finalSalesAmount
    },
    orders
  };
};

/**
 * Generate PDF Sales Report buffer.
 */
export const generateSalesReportPDF = async (reportData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    // Document Header
    doc.fillColor('#111111').fontSize(20).text('EVERLOOM SALES REPORT', { align: 'center' });
    doc.moveDown(0.5);

    doc.fillColor('#666666').fontSize(10).text(`Report Type: ${reportData.reportType.toUpperCase()}`, { align: 'center' });
    doc.text(`Date Range: ${reportData.dateRange.start} to ${reportData.dateRange.end}`, { align: 'center' });
    doc.moveDown(1);

    // Summary Box
    doc.fillColor('#111111').fontSize(12).text('Summary Statistics:', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333333');
    doc.text(`Total Sales Count: ${reportData.summary.totalSalesCount}`);
    doc.text(`Total Product Amount: ₹${reportData.summary.totalOrderAmount.toLocaleString('en-IN')}`);
    doc.text(`Total Coupon Deductions: ₹${reportData.summary.couponDeductions.toLocaleString('en-IN')}`);
    doc.text(`Final Net Sales Amount: ₹${reportData.summary.finalSalesAmount.toLocaleString('en-IN')}`);
    doc.moveDown(1.5);

    // Orders Table Header
    doc.fillColor('#111111').fontSize(11).text('Order Breakdown:', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    doc.fontSize(9).fillColor('#444444');
    doc.text('Order ID', 30, tableTop, { width: 100 });
    doc.text('Date', 130, tableTop, { width: 80 });
    doc.text('Customer', 210, tableTop, { width: 130 });
    doc.text('Payment', 340, tableTop, { width: 80 });
    doc.text('Status', 420, tableTop, { width: 70 });
    doc.text('Amount', 490, tableTop, { width: 70, align: 'right' });

    doc.moveTo(30, tableTop + 14).lineTo(560, tableTop + 14).stroke('#E5E7EB');

    let currentY = tableTop + 20;

    reportData.orders.forEach(order => {
      if (currentY > 750) {
        doc.addPage();
        currentY = 40;
      }

      const orderIdStr = '#' + (order.orderId || order._id.toString().slice(-6));
      const dateStr = new Date(order.createdAt).toLocaleDateString('en-GB');
      const customerStr = order.user ? order.user.fullName : (order.shippingAddress?.fullName || 'Guest');
      const payStr = order.paymentMethod || 'COD';
      const statusStr = order.status || 'Pending';
      const amountStr = `₹${order.totalAmount}`;

      doc.fontSize(8).fillColor('#333333');
      doc.text(orderIdStr, 30, currentY, { width: 100 });
      doc.text(dateStr, 130, currentY, { width: 80 });
      doc.text(customerStr, 210, currentY, { width: 130 });
      doc.text(payStr, 340, currentY, { width: 80 });
      doc.text(statusStr, 420, currentY, { width: 70 });
      doc.text(amountStr, 490, currentY, { width: 70, align: 'right' });

      currentY += 18;
    });

    doc.end();
  });
};

/**
 * Generate Excel Sales Report buffer.
 */
export const generateSalesReportExcel = async (reportData) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EverLoom';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Sales Report');

  // Title Row
  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'EVERLOOM SALES REPORT';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF111111' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Subtitle Row
  sheet.mergeCells('A2:G2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Report Type: ${reportData.reportType.toUpperCase()} (${reportData.dateRange.start} to ${reportData.dateRange.end})`;
  subCell.font = { name: 'Arial', size: 10, italic: true };
  subCell.alignment = { horizontal: 'center' };

  sheet.addRow([]);

  // Summary Table
  sheet.addRow(['Summary Metrics', 'Value']);
  sheet.addRow(['Total Sales Count', reportData.summary.totalSalesCount]);
  sheet.addRow(['Total Product Amount (₹)', reportData.summary.totalOrderAmount]);
  sheet.addRow(['Total Coupon Deductions (₹)', reportData.summary.couponDeductions]);
  sheet.addRow(['Final Net Sales Amount (₹)', reportData.summary.finalSalesAmount]);

  sheet.addRow([]);

  // Orders Table Header
  const headerRow = sheet.addRow(['Order ID', 'Date', 'Customer Name', 'Customer Email', 'Payment Method', 'Status', 'Net Amount (₹)']);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F3F4F6' }
    };
  });

  reportData.orders.forEach(order => {
    sheet.addRow([
      order.orderId || order._id.toString(),
      new Date(order.createdAt).toLocaleDateString('en-GB'),
      order.user ? order.user.fullName : (order.shippingAddress?.fullName || 'Guest'),
      order.user ? order.user.email : 'N/A',
      order.paymentMethod || 'COD',
      order.status || 'Pending',
      order.totalAmount
    ]);
  });

  // Set column widths
  sheet.columns = [
    { width: 25 },
    { width: 15 },
    { width: 25 },
    { width: 30 },
    { width: 18 },
    { width: 15 },
    { width: 18 }
  ];

  return await workbook.xlsx.writeBuffer();
};
