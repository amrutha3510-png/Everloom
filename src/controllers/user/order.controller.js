import * as orderService from '../../services/user/order.service.js';
import Order from '../../models/orderModel.js';
import PDFDocument from 'pdfkit';
import Razorpay from 'razorpay';

const getRazorpayInstance = () => {
  const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials are missing.');
  }
  return new Razorpay({ key_id, key_secret });
};

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
    const userId = req.session?.user ? (req.session.user.id || req.session.user._id) : (req.user ? (req.user._id || req.user.id) : null);
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

    const itemReviews = {};
    if (order.items && order.items.length > 0) {
      const Review = (await import('../../models/reviewModel.js')).default;
      for (const item of order.items) {
        const prodId = item.product ? (item.product._id || item.product) : null;
        if (prodId) {
          const rev = await Review.findOne({ user: userId, product: prodId }).lean();
          if (rev) {
            itemReviews[prodId.toString()] = rev;
          }
        }
      }
    }

    res.render('user/account/order-details', {
      title: `Order Details - #${order.orderId}`,
      order,
      itemReviews,
      layout: 'layouts/user-layout',
      accountPage: 'orders',
      user: req.session.user || req.user
    });
  } catch (error) {
    console.error('Error loading order details page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load order details' };
    res.redirect('/account/orders');
  }
};


/**
 * Render Order Tracking page.
 */
export const trackOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      req.session.toast = { type: 'error', message: 'Please login to track your order' };
      return res.redirect('/login');
    }

    const { orderId } = req.params;
    const order = await orderService.getUserOrderById(userId, orderId);

    if (!order) {
      req.session.toast = { type: 'error', message: 'Order not found.' };
      return res.redirect('/account/orders');
    }

    res.render('user/account/track', {
      title: `Track Order - #${order.orderId}`,
      order,
      layout: 'layouts/user-layout',
      accountPage: 'orders',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading order tracking page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load tracking details' };
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

    if (!cancellationReason || cancellationReason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Cancellation reason is required.' });
    }

    await orderService.cancelUserOrder(userId, orderId, cancellationReason);
    res.status(200).json({ success: true, message: 'Order cancelled successfully.' });
  } catch (error) {
    console.error('Cancel order controller error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to cancel order.' });
  }
};

/**
 * Handle Single Product Item Cancellation.
 */
export const cancelOrderItem = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { orderId, itemId } = req.params;
    const { cancellationReason } = req.body;

    if (!cancellationReason || cancellationReason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Cancellation reason is required.' });
    }

    await orderService.cancelUserOrderItem(userId, orderId, itemId, cancellationReason);
    res.status(200).json({ success: true, message: 'Product item cancelled successfully.' });
  } catch (error) {
    console.error('Cancel order item controller error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to cancel product item.' });
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
    const { returnReason, customReason } = req.body;

    await orderService.returnUserOrder(userId, orderId, returnReason, customReason);
    res.status(200).json({ success: true, message: 'Return request submitted successfully.' });
  } catch (error) {
    console.error('Return order controller error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to submit return request.' });
  }
};

/**
 * Handle Single Product Item Return.
 */
export const returnOrderItem = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { orderId, itemId } = req.params;
    const { returnReason, customReason } = req.body;

    await orderService.returnUserOrderItem(userId, orderId, itemId, returnReason, customReason);
    res.status(200).json({ success: true, message: 'Item return request submitted successfully.' });
  } catch (error) {
    console.error('Return order item controller error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to submit item return request.' });
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

    const isInvoiceAllowed = ['Delivered', 'Return Requested', 'Returned'].includes(order.status) || 
      (order.items && order.items.some(i => ['Delivered', 'Return Requested', 'Returned'].includes(i.status)));

    if (!isInvoiceAllowed) {
      req.session.toast = { type: 'error', message: 'Invoice download is only available for delivered or returned orders.' };
      return res.redirect(`/account/orders/${order.orderId}`);
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

/**
 * Handle stock reservation expiry from frontend timer or explicit check.
 */
export const expireReservationHandler = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { orderId } = req.params;
    const updatedOrder = await orderService.expireOrderStockReservation(userId, orderId);

    return res.status(200).json({
      success: true,
      message: 'Stock reservation expired successfully.',
      stockReservationStatus: updatedOrder.stockReservationStatus
    });
  } catch (error) {
    console.error('Expire reservation controller error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to expire reservation.' });
  }
};

/**
 * Handle re-ordering items from a failed/expired order.
 */
export const reorderFailedOrderHandler = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      req.session.toast = { type: 'error', message: 'Please login to checkout' };
      return res.redirect('/login');
    }

    const { orderId } = req.params;
    await orderService.reorderFailedOrder(userId, orderId);

    req.session.toast = { type: 'success', message: 'Items re-added to cart. Please proceed with checkout.' };
    return res.redirect('/checkout');
  } catch (error) {
    console.error('Reorder failed order controller error:', error);
    req.session.toast = { type: 'error', message: error.message || 'Failed to re-order items.' };
    return res.redirect('/account/orders');
  }
};

/**
 * Handle retry payment for an order with an active stock reservation.
 * Uses the SAME original stockReservationExpiresAt deadline.
 */
export const retryPaymentHandler = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { orderId } = req.params;
    const order = await orderService.getUserOrderById(userId, orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Check if the 5-minute stock reservation is still ACTIVE and not expired
    if (
      order.stockReservationStatus !== 'ACTIVE' ||
      !order.stockReservationExpiresAt ||
      new Date() >= new Date(order.stockReservationExpiresAt)
    ) {
      return res.status(400).json({
        success: false,
        message: 'The 5-minute payment window has expired. Stock has been restored.',
        isExpired: true
      });
    }

    let razorpayOrderId = order.razorpayOrderId;
    const amountInPaise = Math.round(order.totalAmount * 100);

    if (!razorpayOrderId) {
      const razorpayInstance = getRazorpayInstance();
      const rzpOrder = await razorpayInstance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_retry_${Date.now()}_${userId.slice(-4)}`
      });
      razorpayOrderId = rzpOrder.id;

      // Update Order with new razorpayOrderId without modifying original stockReservationExpiresAt
      await Order.updateOne({ _id: order._id }, { $set: { razorpayOrderId: rzpOrder.id } });
    }

    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();

    return res.status(200).json({
      success: true,
      keyId,
      razorpayOrderId,
      amount: amountInPaise,
      currency: 'INR',
      orderId: order.orderId,
      stockReservationExpiresAt: order.stockReservationExpiresAt
    });
  } catch (error) {
    console.error('Retry payment controller error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to initialize payment retry.' });
  }
};

