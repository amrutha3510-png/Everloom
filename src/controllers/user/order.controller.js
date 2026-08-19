import * as orderService from '../../services/user/order.service.js';
import PDFDocument from 'pdfkit';

/**
 * Render My Orders listing page.
 */
export const getOrdersPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      req.session.toast = { type: 'error', message: 'Please login to view your orders' };
      return res.redirect('/login');
    }

    const queryParams = req.query;
    const currentPage = parseInt(queryParams.page, 10) || 1;
    const limit = 5; // 5 orders per page

    const query = {
      search: queryParams.search || '',
      status: queryParams.status || 'All'
    };

    const result = await orderService.getUserOrders(userId, query, currentPage, limit);

    res.render('user/account/orders', {
      title: 'My Orders',
      orders: result.orders,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      totalEntries: result.totalEntries,
      searchQuery: query.search,
      statusFilter: query.status,
      layout: 'layouts/user-layout',
      accountPage: 'orders',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading orders page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load orders' };
    res.redirect('/account/profile');
  }
};

/**
 * Render Order Details page.
 */
export const getOrderDetailPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      req.session.toast = { type: 'error', message: 'Please login to view order details' };
      return res.redirect('/login');
    }

    const { orderId } = req.params;
    const order = await orderService.getUserOrderById(userId, orderId);

    if (!order) {
      req.session.toast = { type: 'error', message: 'Order not found.' };
      return res.redirect('/account/orders');
    }

    res.render('user/account/order-details', {
      title: `Order Details - #${order.orderId}`,
      order,
      layout: 'layouts/user-layout',
      accountPage: 'orders',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading order details page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load order details' };
    res.redirect('/account/orders');
  }
};

/**
 * Handle Order Cancellation.
 */
export const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { orderId } = req.params;
    const { cancellationReason } = req.body;

    await orderService.cancelUserOrder(userId, orderId, cancellationReason);
    res.status(200).json({ success: true, message: 'Order cancelled successfully.' });
  } catch (error) {
    console.error('Cancel order controller error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to cancel order.' });
  }
};

/**
 * Handle Order Return.
 */
export const returnOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { orderId } = req.params;
    const { returnReason } = req.body;

    await orderService.returnUserOrder(userId, orderId, returnReason);
    res.status(200).json({ success: true, message: 'Return request submitted successfully.' });
  } catch (error) {
    console.error('Return order controller error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to submit return request.' });
  }
};

/**
 * Download Invoice PDF.
 */
export const downloadInvoice = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      req.session.toast = { type: 'error', message: 'Unauthorized' };
      return res.redirect('/login');
    }

    const { orderId } = req.params;
    const order = await orderService.getUserOrderById(userId, orderId);

    if (!order) {
      req.session.toast = { type: 'error', message: 'Order not found.' };
      return res.redirect('/account/orders');
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderId}.pdf`);

    doc.pipe(res);

    // Title / Header
    doc.font('Helvetica-Bold').fontSize(24).text('EVERLOOM', { align: 'left' });
    doc.font('Helvetica').fontSize(10).text('Timeless styles curated for modern women.', { align: 'left' });
    doc.moveDown();

    // Invoice Info Box
    doc.font('Helvetica-Bold').fontSize(14).text('INVOICE', { align: 'right' });
    doc.font('Helvetica').fontSize(10);
    doc.text(`Invoice No: INV-${order.orderId}`, { align: 'right' });
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, { align: 'right' });
    doc.text(`Payment Method: ${order.paymentMethod}`, { align: 'right' });
    doc.text(`Status: ${order.status}`, { align: 'right' });
    doc.moveDown(2);

    // Shipping Address
    doc.font('Helvetica-Bold').fontSize(12).text('DELIVER TO:', 50, 150);
    doc.font('Helvetica').fontSize(10);
    doc.text(order.shippingAddress.fullName);
    doc.text(order.shippingAddress.phone);
    doc.text(order.shippingAddress.addressLine1);
    if (order.shippingAddress.addressLine2) {
      doc.text(order.shippingAddress.addressLine2);
    }
    doc.text(`${order.shippingAddress.locality}, ${order.shippingAddress.city}`);
    doc.text(`${order.shippingAddress.state} - ${order.shippingAddress.pincode}`);
    doc.text(order.shippingAddress.country || 'India');
    doc.moveDown(2);

    // Draw Table Header
    const tableTop = 270;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Item Description', 50, tableTop);
    doc.text('Size/Color', 250, tableTop);
    doc.text('Qty', 350, tableTop, { width: 30, align: 'center' });
    doc.text('Price', 400, tableTop, { width: 60, align: 'right' });
    doc.text('Total', 480, tableTop, { width: 60, align: 'right' });

    doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).stroke();
    
    // Draw Table Items
    let currentY = tableTop + 25;
    order.items.forEach(item => {
      doc.font('Helvetica').fontSize(9);
      doc.text(item.product ? item.product.name : 'Unknown Product', 50, currentY, { width: 190 });
      doc.text(`${item.variant.size} / ${item.variant.color}`, 250, currentY);
      doc.text(item.quantity.toString(), 350, currentY, { width: 30, align: 'center' });
      doc.text(`INR ${item.price}`, 400, currentY, { width: 60, align: 'right' });
      doc.text(`INR ${item.price * item.quantity}`, 480, currentY, { width: 60, align: 'right' });

      currentY += 25;
    });

    doc.moveTo(50, currentY).lineTo(540, currentY).stroke();
    currentY += 15;

    // Calculation Totals
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    doc.font('Helvetica').fontSize(10);
    doc.text('Subtotal:', 380, currentY, { width: 80, align: 'right' });
    doc.font('Helvetica-Bold').text(`INR ${subtotal}`, 480, currentY, { width: 60, align: 'right' });
    
    if (order.discountAmount > 0) {
      currentY += 15;
      doc.font('Helvetica').text(`Discount (${order.couponCode || 'Promo'}):`, 300, currentY, { width: 160, align: 'right' });
      doc.font('Helvetica-Bold').text(`-INR ${order.discountAmount}`, 480, currentY, { width: 60, align: 'right' });
    }

    currentY += 15;
    doc.font('Helvetica').text('Shipping:', 380, currentY, { width: 80, align: 'right' });
    doc.font('Helvetica-Bold').text(`INR ${order.shippingCharge}`, 480, currentY, { width: 60, align: 'right' });

    currentY += 20;
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total Amount:', 350, currentY, { width: 110, align: 'right' });
    doc.text(`INR ${order.totalAmount}`, 480, currentY, { width: 60, align: 'right' });

    doc.moveDown(4);
    doc.font('Helvetica-Oblique').fontSize(10).text('Thank you for shopping with Everloom!', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Invoice download error:', error);
    req.session.toast = { type: 'error', message: 'Failed to download invoice' };
    res.redirect('/account/orders');
  }
};
