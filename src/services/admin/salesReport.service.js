import Order from '../../models/orderModel.js';
import User from '../../models/userModel.js';
import Product from '../../models/productModel.js';
import { calculateOrderPricing } from '../general/orderPricing.service.js';
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
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (reportType === 'weekly') {
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    start = new Date(now.getFullYear(), now.getMonth(), diffToMonday, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), diffToMonday + 6, 23, 59, 59, 999);
  } else if (reportType === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (reportType === 'yearly') {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (reportType === 'custom') {
    if (customStartDate) {
      const [sY, sM, sD] = customStartDate.split('-').map(Number);
      start = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
    } else {
      start = new Date(0);
    }

    if (customEndDate) {
      const [eY, eM, eD] = customEndDate.split('-').map(Number);
      end = new Date(eY, eM - 1, eD, 23, 59, 59, 999);
    } else {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { start, end };
};

/**
 * Fetch Sales Report metrics and order details based on date range.
 * Uses calculateOrderPricing (Single Source of Truth) to compute gross sales, coupon discounts,
 * offer discounts, return deductions, cancellation deductions, and net sales totals.
 */
export const getSalesReportData = async (reportType = 'monthly', customStartDate = null, customEndDate = null) => {
  const { start, end } = buildDateRangeFilter(reportType, customStartDate, customEndDate);

  const matchQuery = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: 'Payment Failed' },
    paymentStatus: { $ne: 'Failed' }
  };

  const rawOrders = await Order.find(matchQuery)
    .populate('user', 'fullName email')
    .populate({
      path: 'items.product',
      select: 'name variants'
    })
    .sort({ createdAt: -1 });

  let totalSalesCount = 0;
  let totalProductsSold = 0;
  let totalGrossAmount = 0;
  let totalCouponDiscount = 0;
  let totalOfferDiscount = 0;
  let totalReturnDeduction = 0;
  let totalCancellationDeduction = 0;
  let totalShippingCharge = 0;
  let finalSalesAmount = 0;

  const validOrders = [];

  for (const rawOrder of rawOrders) {
    const pricedOrder = calculateOrderPricing(rawOrder);
    const p = pricedOrder.pricing;

    if (!p) {
      continue;
    }

    // Exclude fully cancelled or fully returned orders from sales totals if currentTotal is 0
    if (p.isFullyCancelled && p.currentTotal === 0 && (!pricedOrder.items || pricedOrder.items.every(i => i.status === 'Cancelled' || i.status === 'Returned'))) {
      continue;
    }

    totalSalesCount += 1;

    let orderActiveQty = 0;
    (pricedOrder.items || []).forEach(item => {
      if (item.status !== 'Cancelled' && item.status !== 'Returned') {
        orderActiveQty += Number(item.quantity) || 1;
      }
    });

    // Compute item-level original price & offer discount
    let orderGrossAmount = 0;
    let orderOfferDiscount = 0;
    let orderReturnDeduction = 0;
    let orderCancellationDeduction = 0;

    const itemMap = p.itemDetailsMap || {};

    (pricedOrder.items || []).forEach(item => {
      let origPrice = item.price;
      if (item.product && Array.isArray(item.product.variants)) {
        const matchedVar = item.product.variants.find(v => v.size === item.variant?.size && v.color === item.variant?.color);
        if (matchedVar && matchedVar.price && matchedVar.price > item.price) {
          origPrice = matchedVar.price;
        }
      }

      const itemQty = Number(item.quantity) || 1;
      const itemGrossTotal = origPrice * itemQty;
      const unitOfferDiscount = Math.max(0, origPrice - item.price);
      const itemOfferDisc = unitOfferDiscount * itemQty;

      item.originalPrice = origPrice;
      item.itemGrossTotal = itemGrossTotal;
      item.offerDiscount = itemOfferDisc;

      orderGrossAmount += itemGrossTotal;
      orderOfferDiscount += itemOfferDisc;

      const itemIdStr = item._id ? item._id.toString() : '';
      const itemInfo = itemMap[itemIdStr];

      if (item.status === 'Returned') {
        const retAmt = item.refundAmount || (itemInfo ? itemInfo.effectiveAmount : Math.max(0, (item.price * itemQty) - (item.allocatedCouponDiscount || 0)));
        orderReturnDeduction += retAmt;
        item.deductionAmount = retAmt;
      } else if (item.status === 'Cancelled') {
        const cancAmt = item.refundAmount || (itemInfo ? itemInfo.effectiveAmount : Math.max(0, (item.price * itemQty) - (item.allocatedCouponDiscount || 0)));
        orderCancellationDeduction += cancAmt;
        item.deductionAmount = cancAmt;
      }
    });

    const orderCouponDiscount = p.activeCouponDiscount || 0;
    const orderShippingCharge = p.isFullyCancelled ? 0 : (p.shippingCharge || 49);
    const orderNetAmount = p.currentTotal || 0;

    totalProductsSold += orderActiveQty;
    totalGrossAmount += orderGrossAmount;
    totalCouponDiscount += orderCouponDiscount;
    totalOfferDiscount += orderOfferDiscount;
    totalReturnDeduction += orderReturnDeduction;
    totalCancellationDeduction += orderCancellationDeduction;
    totalShippingCharge += orderShippingCharge;
    finalSalesAmount += orderNetAmount;

    pricedOrder.grossAmount = orderGrossAmount;
    pricedOrder.couponDiscount = orderCouponDiscount;
    pricedOrder.offerDiscount = orderOfferDiscount;
    pricedOrder.returnDeduction = orderReturnDeduction;
    pricedOrder.cancellationDeduction = orderCancellationDeduction;
    pricedOrder.shippingCharge = orderShippingCharge;
    pricedOrder.netAmount = orderNetAmount;
    pricedOrder.netDisplayAmount = orderNetAmount;
    pricedOrder.activeItemsQuantity = orderActiveQty;

    validOrders.push(pricedOrder);
  }

  const formatDateStr = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    reportType,
    dateRange: {
      start: start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      end: end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      rawStart: reportType === 'custom' ? (customStartDate || formatDateStr(start)) : formatDateStr(start),
      rawEnd: reportType === 'custom' ? (customEndDate || formatDateStr(end)) : formatDateStr(end)
    },
    summary: {
      totalSalesCount,
      totalProductsSold,
      totalGrossAmount: Math.round(totalGrossAmount * 100) / 100,
      totalOrderAmount: Math.round(totalGrossAmount * 100) / 100,
      totalCouponDiscount: Math.round(totalCouponDiscount * 100) / 100,
      couponDeductions: Math.round(totalCouponDiscount * 100) / 100,
      totalDiscountAmount: Math.round((totalCouponDiscount + totalOfferDiscount) * 100) / 100,
      totalOfferDiscount: Math.round(totalOfferDiscount * 100) / 100,
      totalReturnDeduction: Math.round(totalReturnDeduction * 100) / 100,
      totalCancellationDeduction: Math.round(totalCancellationDeduction * 100) / 100,
      totalShippingCharge: Math.round(totalShippingCharge * 100) / 100,
      finalSalesAmount: Math.round(finalSalesAmount * 100) / 100
    },
    orders: validOrders
  };
};

/**
 * Generate Order-Wise Detailed PDF Sales Report buffer.
 */
export const generateSalesReportPDF = async (reportData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    const { summary, dateRange, reportType, orders } = reportData;

    // Document Header
    doc.fillColor('#111111').fontSize(16).font('Helvetica-Bold').text('EVERLOOM SALES REPORT', { align: 'center' });
    doc.moveDown(0.2);

    doc.fillColor('#666666').fontSize(8.5).font('Helvetica')
      .text(`Report Period: ${reportType.toUpperCase()} | Date Range: ${dateRange.start} to ${dateRange.end}`, { align: 'center' });
    doc.text(`Generated On: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, { align: 'center' });
    doc.moveDown(0.6);

    // Sales Calculation & Deduction Summary Card Box
    const boxTop = doc.y;
    doc.rect(30, boxTop, 535, 95).fillAndStroke('#F9FAFB', '#E5E7EB');

    doc.fillColor('#111111').fontSize(10).font('Helvetica-Bold').text('EXECUTIVE SALES SUMMARY', 45, boxTop + 8);
    doc.fontSize(8.5).font('Helvetica').fillColor('#333333');

    // Row 1
    doc.text('Gross Amount:', 45, boxTop + 24);
    doc.font('Helvetica-Bold').text(`₹${summary.totalGrossAmount.toLocaleString('en-IN')}`, 130, boxTop + 24, { align: 'right', width: 70 });

    doc.font('Helvetica').text('- Coupon Discount:', 220, boxTop + 24);
    doc.font('Helvetica-Bold').fillColor('#DC2626').text(`-₹${summary.totalCouponDiscount.toLocaleString('en-IN')}`, 320, boxTop + 24, { align: 'right', width: 70 });

    doc.font('Helvetica').fillColor('#333333').text('- Return Deduction:', 410, boxTop + 24);
    doc.font('Helvetica-Bold').fillColor('#DC2626').text(`-₹${summary.totalReturnDeduction.toLocaleString('en-IN')}`, 490, boxTop + 24, { align: 'right', width: 65 });

    // Row 2
    doc.font('Helvetica').fillColor('#333333').text('+ Shipping Charge:', 45, boxTop + 40);
    doc.font('Helvetica-Bold').fillColor('#16A34A').text(`+₹${summary.totalShippingCharge.toLocaleString('en-IN')}`, 130, boxTop + 40, { align: 'right', width: 70 });

    doc.font('Helvetica').fillColor('#333333').text('- Offer Discount:', 220, boxTop + 40);
    doc.font('Helvetica-Bold').fillColor('#DC2626').text(`-₹${summary.totalOfferDiscount.toLocaleString('en-IN')}`, 320, boxTop + 40, { align: 'right', width: 70 });

    doc.font('Helvetica').fillColor('#333333').text('- Cancel Deduction:', 410, boxTop + 40);
    doc.font('Helvetica-Bold').fillColor('#DC2626').text(`-₹${summary.totalCancellationDeduction.toLocaleString('en-IN')}`, 490, boxTop + 40, { align: 'right', width: 65 });

    // Summary Box Footer Line
    doc.moveTo(45, boxTop + 58).lineTo(555, boxTop + 58).stroke('#D1D5DB');

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('NET SALES TOTAL:', 45, boxTop + 66);
    doc.fontSize(11).fillColor('#111111').text(`₹${summary.finalSalesAmount.toLocaleString('en-IN')}`, 200, boxTop + 65);

    doc.fontSize(8).font('Helvetica').fillColor('#666666')
      .text(`Total Orders: ${summary.totalSalesCount}  |  Products Sold: ${summary.totalProductsSold || 0}`, 350, boxTop + 68, { align: 'right', width: 205 });

    doc.y = boxTop + 110;

    // Order-Wise Section Header
    doc.fillColor('#111111').fontSize(11).font('Helvetica-Bold').text('ORDER-WISE DETAILED BREAKDOWN', { underline: true });
    doc.moveDown(0.5);

    let currentY = doc.y;

    orders.forEach((order) => {
      const items = order.items || [];
      const itemRowsCount = items.length;
      const estimatedHeight = 55 + (itemRowsCount * 18) + 60;

      if (currentY + estimatedHeight > 770) {
        doc.addPage();
        currentY = 40;
      }

      const orderIdStr = '#' + (order.orderId || (order._id ? order._id.toString().slice(-6) : ''));
      const dateStr = new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const customerStr = order.user ? order.user.fullName : (order.shippingAddress?.fullName || 'Guest');
      const paymentStatus = order.paymentStatus || 'Paid';
      const orderStatus = order.status || 'Pending';

      // 1. Order Header Card Background
      doc.rect(30, currentY, 535, 22).fillAndStroke('#E5E7EB', '#D1D5DB');

      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111111');
      doc.text(`ORDER ID: ${orderIdStr}`, 35, currentY + 6);
      doc.font('Helvetica').text(`Customer: ${customerStr}`, 155, currentY + 6, { width: 130, ellipsis: true });
      doc.text(`Date: ${dateStr}`, 290, currentY + 6);
      doc.text(`Payment: ${paymentStatus}`, 380, currentY + 6);
      doc.font('Helvetica-Bold').text(`Status: ${orderStatus}`, 470, currentY + 6);

      currentY += 26;

      // 2. Product Table Header
      doc.rect(30, currentY, 535, 16).fill('#F3F4F6');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151');
      doc.text('Product Name', 35, currentY + 4, { width: 175 });
      doc.text('Size', 215, currentY + 4, { width: 40 });
      doc.text('Color', 260, currentY + 4, { width: 50 });
      doc.text('Qty', 315, currentY + 4, { width: 30, align: 'center' });
      doc.text('Price (₹)', 350, currentY + 4, { width: 60, align: 'right' });
      doc.text('Item Total (₹)', 415, currentY + 4, { width: 70, align: 'right' });
      doc.text('Status', 495, currentY + 4, { width: 65, align: 'center' });

      currentY += 16;

      // 3. Product Rows
      items.forEach((item, pIndex) => {
        const prodName = item.product?.name || item.name || 'Product';
        const sizeStr = item.variant?.size || 'N/A';
        const colorStr = item.variant?.color || 'N/A';
        const qty = item.quantity || 1;
        const price = item.originalPrice || item.price || 0;
        const itemTotal = item.itemGrossTotal || (price * qty);
        const itemStatus = item.status || orderStatus;

        if (pIndex % 2 === 1) {
          doc.rect(30, currentY, 535, 16).fill('#FAFAFA');
        }

        doc.fontSize(7.5).font('Helvetica').fillColor('#1F2937');
        doc.text(prodName, 35, currentY + 3, { width: 175, ellipsis: true });
        doc.text(sizeStr, 215, currentY + 3, { width: 40 });
        doc.text(colorStr, 260, currentY + 3, { width: 50 });
        doc.text(String(qty), 315, currentY + 3, { width: 30, align: 'center' });
        doc.text(`₹${price.toLocaleString('en-IN')}`, 350, currentY + 3, { width: 60, align: 'right' });
        doc.font('Helvetica-Bold').text(`₹${itemTotal.toLocaleString('en-IN')}`, 415, currentY + 3, { width: 70, align: 'right' });

        doc.font('Helvetica');
        if (itemStatus === 'Returned') {
          doc.fillColor('#DC2626').text(itemStatus, 495, currentY + 3, { width: 65, align: 'center' });
        } else if (itemStatus === 'Cancelled') {
          doc.fillColor('#6B7280').text(itemStatus, 495, currentY + 3, { width: 65, align: 'center' });
        } else {
          doc.fillColor('#16A34A').text(itemStatus, 495, currentY + 3, { width: 65, align: 'center' });
        }

        currentY += 16;
      });

      doc.moveTo(30, currentY).lineTo(565, currentY).stroke('#E5E7EB');
      currentY += 4;

      // 4. Order-Level Deductions & Summary
      const couponVal = order.couponDiscount || 0;
      const offerVal = order.offerDiscount || 0;
      const returnVal = order.returnDeduction || 0;
      const cancelVal = order.cancellationDeduction || 0;
      const shippingVal = order.shippingCharge || 0;
      const netVal = typeof order.netAmount !== 'undefined' ? order.netAmount : (order.pricing ? order.pricing.currentTotal : order.totalAmount);

      doc.fontSize(7.5).font('Helvetica').fillColor('#4B5563');

      if (offerVal > 0) {
        doc.text('Offer Discount:', 330, currentY, { width: 110, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#DC2626').text(`-₹${offerVal.toLocaleString('en-IN')}`, 445, currentY, { width: 115, align: 'right' });
        currentY += 12;
      }

      if (couponVal > 0) {
        doc.font('Helvetica').fillColor('#4B5563').text('Coupon Discount:', 330, currentY, { width: 110, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#DC2626').text(`-₹${couponVal.toLocaleString('en-IN')}`, 445, currentY, { width: 115, align: 'right' });
        currentY += 12;
      }

      if (returnVal > 0) {
        doc.font('Helvetica').fillColor('#4B5563').text('Refund (Returned Items):', 300, currentY, { width: 140, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#DC2626').text(`-₹${returnVal.toLocaleString('en-IN')}`, 445, currentY, { width: 115, align: 'right' });
        currentY += 12;
      }

      if (cancelVal > 0) {
        doc.font('Helvetica').fillColor('#4B5563').text('Cancelled Amount:', 330, currentY, { width: 110, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#DC2626').text(`-₹${cancelVal.toLocaleString('en-IN')}`, 445, currentY, { width: 115, align: 'right' });
        currentY += 12;
      }

      if (shippingVal > 0) {
        doc.font('Helvetica').fillColor('#4B5563').text('Shipping Charge:', 330, currentY, { width: 110, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#16A34A').text(`+₹${shippingVal.toLocaleString('en-IN')}`, 445, currentY, { width: 115, align: 'right' });
        currentY += 12;
      }

      // 5. Final Order Total Box
      doc.rect(300, currentY, 265, 18).fill('#111111');
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('Order Total / Net Total:', 310, currentY + 4);
      doc.text(`₹${netVal.toLocaleString('en-IN')}`, 445, currentY + 4, { width: 115, align: 'right' });

      currentY += 26;

      // 6. Visual Order Separator
      doc.moveTo(30, currentY).lineTo(565, currentY).dash(4, { space: 3 }).stroke('#9CA3AF');
      doc.undash();
      currentY += 14;
    });

    doc.end();
  });
};

/**
 * Generate Order-Wise Detailed Excel Sales Report buffer.
 */
export const generateSalesReportExcel = async (reportData) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EverLoom';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Sales Report');
  const { summary, dateRange, reportType, orders } = reportData;

  // Title Row
  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'EVERLOOM SALES REPORT (ORDER-WISE DETAILED)';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF111111' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Subtitle Row
  sheet.mergeCells('A2:G2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Report Period: ${reportType.toUpperCase()} (${dateRange.start} to ${dateRange.end})`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF4B5563' } };
  subCell.alignment = { horizontal: 'center' };

  sheet.addRow([]);

  // Executive Summary Section
  const sumHeader = sheet.addRow(['EXECUTIVE SALES SUMMARY', '']);
  sumHeader.font = { bold: true, size: 11 };

  const s1 = sheet.addRow(['Gross Product Amount', summary.totalGrossAmount]);
  s1.getCell(2).numFmt = '#,##0.00';

  const s2 = sheet.addRow(['Coupon Discount (-)', -Math.abs(summary.totalCouponDiscount)]);
  s2.getCell(2).numFmt = '[Red]-#,##0.00;[Red]-#,##0.00;0.00';

  const s3 = sheet.addRow(['Offer Discount (-)', -Math.abs(summary.totalOfferDiscount)]);
  s3.getCell(2).numFmt = '[Red]-#,##0.00;[Red]-#,##0.00;0.00';

  const s4 = sheet.addRow(['Return Deduction (-)', -Math.abs(summary.totalReturnDeduction)]);
  s4.getCell(2).numFmt = '[Red]-#,##0.00;[Red]-#,##0.00;0.00';

  const s5 = sheet.addRow(['Cancellation Deduction (-)', -Math.abs(summary.totalCancellationDeduction)]);
  s5.getCell(2).numFmt = '[Red]-#,##0.00;[Red]-#,##0.00;0.00';

  const s6 = sheet.addRow(['Shipping Charge (+)', summary.totalShippingCharge]);
  s6.getCell(2).numFmt = '#,##0.00';

  const sNet = sheet.addRow(['Final Net Sales Total', summary.finalSalesAmount]);
  sNet.font = { bold: true };
  sNet.getCell(2).numFmt = '#,##0.00';

  sheet.addRow([]);
  sheet.addRow(['ORDER-WISE SALES BREAKDOWN']).font = { bold: true, size: 11 };
  sheet.addRow([]);

  orders.forEach((order) => {
    const orderIdStr = '#' + (order.orderId || (order._id ? order._id.toString() : ''));
    const dateStr = new Date(order.createdAt).toLocaleDateString('en-GB');
    const customerStr = order.user ? order.user.fullName : (order.shippingAddress?.fullName || 'Guest');
    const paymentStatus = order.paymentStatus || 'Paid';
    const orderStatus = order.status || 'Pending';

    // 1. Order Header Row
    const orderHeaderRow = sheet.addRow([
      `ORDER ID: ${orderIdStr}`,
      `Customer: ${customerStr}`,
      `Date: ${dateStr}`,
      `Payment Status: ${paymentStatus}`,
      `Order Status: ${orderStatus}`,
      '',
      ''
    ]);

    orderHeaderRow.font = { bold: true, color: { argb: 'FF111111' }, name: 'Arial', size: 10 };
    orderHeaderRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    });

    // 2. Product Table Header
    const prodHeaderRow = sheet.addRow([
      'Product Name',
      'Size',
      'Color',
      'Quantity',
      'Unit Price (₹)',
      'Item Total (₹)',
      'Item Status'
    ]);

    prodHeaderRow.font = { bold: true, color: { argb: 'FF374151' }, size: 9 };
    prodHeaderRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    });

    // 3. Product Detail Rows
    const items = order.items || [];
    items.forEach(item => {
      const prodName = item.product?.name || item.name || 'Product';
      const sizeStr = item.variant?.size || 'N/A';
      const colorStr = item.variant?.color || 'N/A';
      const qty = item.quantity || 1;
      const price = item.originalPrice || item.price || 0;
      const itemTotal = item.itemGrossTotal || (price * qty);
      const itemStatus = item.status || orderStatus;

      const pRow = sheet.addRow([
        prodName,
        sizeStr,
        colorStr,
        qty,
        price,
        itemTotal,
        itemStatus
      ]);

      pRow.getCell(5).numFmt = '#,##0.00';
      pRow.getCell(6).numFmt = '#,##0.00';
    });

    // 4. Deduction Rows (Conditional)
    const couponVal = order.couponDiscount || 0;
    const offerVal = order.offerDiscount || 0;
    const returnVal = order.returnDeduction || 0;
    const cancelVal = order.cancellationDeduction || 0;
    const shippingVal = order.shippingCharge || 0;
    const netVal = typeof order.netAmount !== 'undefined' ? order.netAmount : (order.pricing ? order.pricing.currentTotal : order.totalAmount);

    if (offerVal > 0) {
      const r = sheet.addRow(['', '', '', '', 'Offer Discount (-)', -offerVal, '']);
      r.getCell(5).font = { italic: true, color: { argb: 'FFDC2626' } };
      r.getCell(6).numFmt = '[Red]-#,##0.00;[Red]-#,##0.00;0.00';
      r.getCell(6).font = { bold: true, color: { argb: 'FFDC2626' } };
    }

    if (couponVal > 0) {
      const r = sheet.addRow(['', '', '', '', 'Coupon Discount (-)', -couponVal, '']);
      r.getCell(5).font = { italic: true, color: { argb: 'FFDC2626' } };
      r.getCell(6).numFmt = '[Red]-#,##0.00;[Red]-#,##0.00;0.00';
      r.getCell(6).font = { bold: true, color: { argb: 'FFDC2626' } };
    }

    if (returnVal > 0) {
      const r = sheet.addRow(['', '', '', '', 'Refund / Return Deduction (-)', -returnVal, '']);
      r.getCell(5).font = { italic: true, color: { argb: 'FFDC2626' } };
      r.getCell(6).numFmt = '[Red]-#,##0.00;[Red]-#,##0.00;0.00';
      r.getCell(6).font = { bold: true, color: { argb: 'FFDC2626' } };
    }

    if (cancelVal > 0) {
      const r = sheet.addRow(['', '', '', '', 'Cancellation Deduction (-)', -cancelVal, '']);
      r.getCell(5).font = { italic: true, color: { argb: 'FFDC2626' } };
      r.getCell(6).numFmt = '[Red]-#,##0.00;[Red]-#,##0.00;0.00';
      r.getCell(6).font = { bold: true, color: { argb: 'FFDC2626' } };
    }

    if (shippingVal > 0) {
      const r = sheet.addRow(['', '', '', '', 'Shipping Charge (+)', shippingVal, '']);
      r.getCell(5).font = { italic: true, color: { argb: 'FF16A34A' } };
      r.getCell(6).numFmt = '#,##0.00';
      r.getCell(6).font = { bold: true, color: { argb: 'FF16A34A' } };
    }

    // 5. Order Net Total Row
    const netRow = sheet.addRow(['', '', '', '', 'Order Total / Net Total', netVal, '']);
    netRow.font = { bold: true, size: 10 };
    netRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
    netRow.getCell(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    netRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
    netRow.getCell(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    netRow.getCell(6).numFmt = '#,##0.00';

    // 6. Separator Row
    sheet.addRow([]);
  });

  // Set column widths
  sheet.columns = [
    { width: 32 },
    { width: 14 },
    { width: 16 },
    { width: 12 },
    { width: 28 },
    { width: 20 },
    { width: 18 }
  ];

  return await workbook.xlsx.writeBuffer();
};


