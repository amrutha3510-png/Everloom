import * as cartService from '../../services/user/cart.service.js';
import { getAddresses } from '../../services/user/account.service.js';
import { getAvailableCoupons, calculateCouponDiscount } from '../../services/user/coupon.service.js';
import { calculateBestOffer } from '../../services/user/offer.service.js';
import * as walletService from '../../services/user/wallet.service.js';
import Address from '../../models/addressModel.js';
import Order from '../../models/orderModel.js';
import Cart from '../../models/cartModel.js';
import Product from '../../models/productModel.js';
import Wishlist from '../../models/wishlistModel.js';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const getRazorpayInstance = () => {
  const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing in environment configuration.');
  }

  return new Razorpay({ key_id, key_secret });
};

/**
 * Render checkout page.
 */
export const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      req.session.toast = { type: 'error', message: 'Please login to checkout' };
      return res.redirect('/login');
    }

    const cart = await cartService.getCart(userId);
    if (!cart || !cart.items || cart.items.length === 0) {
      req.session.toast = { type: 'error', message: 'Your cart is empty' };
      return res.redirect('/cart');
    }

    // Check if there are any unavailable products or stock mismatches
    const hasUnavailableItems = cart.items.some(item => item.isUnavailable || item.isOutOfStock || item.stockMismatch);
    if (hasUnavailableItems) {
      req.session.toast = { type: 'error', message: 'Please update your cart. Some items are unavailable or out of stock.' };
      return res.redirect('/cart');
    }

    const addresses = await getAddresses(userId);
    const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0] || null;
    const availableCoupons = await getAvailableCoupons();
    const walletData = await walletService.getWalletData(userId);
    const userWalletBalance = walletData ? walletData.walletBalance : 0;

    // Re-verify applied coupon if present in session
    let appliedCoupon = null;
    let appliedDiscount = 0;
    if (req.session.appliedCoupon) {
      try {
        const couponResult = await calculateCouponDiscount(req.session.appliedCoupon.code, cart.cartTotal);
        appliedDiscount = couponResult.discount;
        appliedCoupon = {
          code: couponResult.coupon.code,
          discount: appliedDiscount,
          type: couponResult.coupon.type,
          discountValue: couponResult.coupon.discountValue
        };
        req.session.appliedCoupon = appliedCoupon;
      } catch (err) {
        delete req.session.appliedCoupon;
      }
    }

    res.render('user/checkout/index', {
      title: 'Checkout',
      cart,
      addresses,
      defaultAddress,
      availableCoupons,
      appliedCoupon,
      userWalletBalance,
      layout: 'layouts/user-layout',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading checkout page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load checkout page' };
    res.redirect('/cart');
  }
};

/**
 * Apply Coupon Code at Checkout.
 */
export const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to checkout' });
    }

    // Prevent multiple coupon application rule
    if (req.session.appliedCoupon) {
      return res.status(400).json({
        success: false,
        message: 'A coupon is already applied. Please remove the existing coupon first.'
      });
    }

    const { couponCode } = req.body;
    if (!couponCode || !couponCode.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter a coupon code.' });
    }

    const cart = await cartService.getCart(userId);
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty' });
    }

    const subtotal = cart.cartTotal;
    const { discount, coupon } = await calculateCouponDiscount(couponCode, subtotal);

    req.session.appliedCoupon = {
      code: coupon.code,
      discount,
      type: coupon.type,
      discountValue: coupon.discountValue
    };

    const shippingCharge = 49;
    const finalTotal = Math.max(0, subtotal - discount) + shippingCharge;

    return res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" applied successfully!`,
      couponCode: coupon.code,
      discount,
      subtotal,
      shippingCharge,
      finalTotal
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to apply coupon.' });
  }
};

/**
 * Remove Applied Coupon from Checkout.
 */
export const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to checkout' });
    }

    delete req.session.appliedCoupon;

    const cart = await cartService.getCart(userId);
    const subtotal = cart ? cart.cartTotal : 0;
    const shippingCharge = 49;
    const finalTotal = subtotal + shippingCharge;

    return res.status(200).json({
      success: true,
      message: 'Coupon removed successfully.',
      subtotal,
      shippingCharge,
      finalTotal
    });
  } catch (error) {
    console.error('Remove coupon error:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove coupon.' });
  }
};

/**
 * Place Order (COD or WALLET).
 */
export const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to place an order' });
    }

    const { addressId, paymentMethod } = req.body;
    const chosenPaymentMethod = (paymentMethod || 'COD').toUpperCase();

    if (!addressId) {
      return res.status(400).json({ success: false, message: 'Please select a delivery address' });
    }

    // 1. Verify address
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(400).json({ success: false, message: 'Selected address is invalid' });
    }

    // 2. Retrieve and validate cart
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty' });
    }

    const orderItems = [];
    let subtotal = 0;

    // Validate each product/variant and stock
    for (const item of cart.items) {
      const product = item.product;
      if (!product || product.isDeleted || product.status !== 'Active') {
        return res.status(400).json({ success: false, message: `Product "${product ? product.name : 'Unknown'}" is unavailable` });
      }

      // Validate categories
      const populatedProduct = await Product.findById(product._id).populate('category subcategory');
      if (populatedProduct.category && (populatedProduct.category.isDeleted || populatedProduct.category.status !== 'Active')) {
        return res.status(400).json({ success: false, message: `Product "${product.name}" category is unavailable` });
      }
      if (populatedProduct.subcategory && (populatedProduct.subcategory.isDeleted || populatedProduct.subcategory.status !== 'Active')) {
        return res.status(400).json({ success: false, message: `Product "${product.name}" subcategory is unavailable` });
      }

      const variant = product.variants.find(v => v.size === item.variant.size && v.color === item.variant.color);
      if (!variant) {
        return res.status(400).json({ success: false, message: `Variant for product "${product.name}" is unavailable` });
      }

      if (variant.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Not enough stock for product "${product.name}"` });
      }

      const categoryId = populatedProduct.category ? (populatedProduct.category._id || populatedProduct.category) : null;
      const offerData = await calculateBestOffer(product._id, categoryId, variant.price);
      const effectivePrice = offerData.finalPrice;
      const itemTotal = effectivePrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        variant: {
          size: item.variant.size,
          color: item.variant.color
        },
        quantity: item.quantity,
        price: effectivePrice
      });
    }

    // 3. Pricing calculations with active coupon
    let discount = 0;
    let appliedCouponCode = '';
    const activeCouponCode = req.session.appliedCoupon ? req.session.appliedCoupon.code : (req.body.couponCode || '');
    if (activeCouponCode && activeCouponCode.trim()) {
      try {
        const couponResult = await calculateCouponDiscount(activeCouponCode, subtotal);
        discount = couponResult.discount;
        appliedCouponCode = couponResult.coupon.code;
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const shippingCharge = 49;
    const finalTotal = Math.max(0, subtotal - discount) + shippingCharge;

    // 4. Wallet balance verification and debit if paymentMethod === 'WALLET'
    if (chosenPaymentMethod === 'WALLET') {
      const walletData = await walletService.getWalletData(userId);
      if (walletData.walletBalance < finalTotal) {
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance (Available: ₹${walletData.walletBalance}, Required: ₹${finalTotal}). Please choose another payment method.`
        });
      }
    }

    // 5. Create the Order
    const order = new Order({
      user: userId,
      items: orderItems,
      totalAmount: finalTotal,
      discountAmount: discount,
      couponCode: appliedCouponCode,
      shippingCharge,
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || '',
        city: address.city,
        locality: address.locality,
        state: address.state,
        pincode: address.pincode,
        country: address.country || 'India'
      },
      status: 'Pending',
      paymentMethod: chosenPaymentMethod === 'WALLET' ? 'WALLET' : 'COD'
    });

    await order.save();

    // 6. If WALLET payment, deduct from user's wallet now
    if (chosenPaymentMethod === 'WALLET') {
      await walletService.deductDebit(
        userId,
        finalTotal,
        `Order payment`,
        order.orderId
      );
    }

    // 7. Update stock level decrementally
    for (const item of orderItems) {
      await Product.updateOne(
        { _id: item.product, 'variants.size': item.variant.size, 'variants.color': item.variant.color },
        { $inc: { 'variants.$.stock': -item.quantity } }
      );
    }

    // 8. Clear cart items
    cart.items = [];
    await cart.save();

    // 9. Remove ordered variants from Wishlist if applicable
    for (const item of orderItems) {
      await Wishlist.updateOne(
        { user: userId },
        { $pull: { items: { product: item.product, 'variant.size': item.variant.size, 'variant.color': item.variant.color } } }
      );
    }

    // 10. Clear applied coupon from session
    delete req.session.appliedCoupon;

    return res.status(200).json({
      success: true,
      message: chosenPaymentMethod === 'WALLET' ? 'Order placed using EverLoom Wallet successfully' : 'Order placed successfully',
      orderId: order.orderId
    });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ success: false, message: 'Failed to place order. Please try again.' });
  }
};

/**
 * Create Razorpay Order (Server-side initialization before payment popup with 5-min stock reservation).
 */
export const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to checkout' });
    }

    const { addressId } = req.body;
    if (!addressId) {
      return res.status(400).json({ success: false, message: 'Please select a delivery address' });
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(400).json({ success: false, message: 'Selected address is invalid' });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty' });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of cart.items) {
      const product = item.product;
      if (!product || product.isDeleted || product.status !== 'Active') {
        return res.status(400).json({ success: false, message: `Product "${product ? product.name : 'Unknown'}" is unavailable` });
      }

      // Validate categories
      const populatedProduct = await Product.findById(product._id).populate('category subcategory');
      if (populatedProduct.category && (populatedProduct.category.isDeleted || populatedProduct.category.status !== 'Active')) {
        return res.status(400).json({ success: false, message: `Product "${product.name}" category is unavailable` });
      }
      if (populatedProduct.subcategory && (populatedProduct.subcategory.isDeleted || populatedProduct.subcategory.status !== 'Active')) {
        return res.status(400).json({ success: false, message: `Product "${product.name}" subcategory is unavailable` });
      }

      const variant = product.variants.find(v => v.size === item.variant.size && v.color === item.variant.color);
      if (!variant) {
        return res.status(400).json({ success: false, message: `Variant for product "${product.name}" is unavailable` });
      }

      if (variant.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Not enough stock for product "${product.name}"` });
      }

      const categoryId = populatedProduct.category ? (populatedProduct.category._id || populatedProduct.category) : null;
      const offerData = await calculateBestOffer(product._id, categoryId, variant.price);
      const effectivePrice = offerData.finalPrice;
      const itemTotal = effectivePrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        variant: {
          size: item.variant.size,
          color: item.variant.color
        },
        quantity: item.quantity,
        price: effectivePrice
      });
    }

    let discount = 0;
    let appliedCouponCode = '';
    if (req.session.appliedCoupon) {
      try {
        const couponResult = await calculateCouponDiscount(req.session.appliedCoupon.code, subtotal);
        discount = couponResult.discount;
        appliedCouponCode = couponResult.coupon.code;
      } catch (err) {
        delete req.session.appliedCoupon;
      }
    }

    const shippingCharge = 49;
    const finalTotal = Math.max(0, subtotal - discount) + shippingCharge;
    const amountInPaise = Math.round(finalTotal * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}_${userId.slice(-4)}`
    };

    const razorpayInstance = getRazorpayInstance();
    const razorpayOrder = await razorpayInstance.orders.create(options);

    // Calculate backend stock reservation expiry timestamp (5 minutes from now)
    const stockReservationExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const order = new Order({
      user: userId,
      items: orderItems,
      totalAmount: finalTotal,
      discountAmount: discount,
      couponCode: appliedCouponCode,
      shippingCharge,
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || '',
        city: address.city,
        locality: address.locality,
        state: address.state,
        pincode: address.pincode,
        country: address.country || 'India'
      },
      status: 'Payment Failed',
      paymentStatus: 'Failed',
      paymentMethod: 'Razorpay',
      razorpayOrderId: razorpayOrder.id,
      stockReservationStatus: 'ACTIVE',
      stockReservationExpiresAt
    });

    await order.save();

    // Deduct stock immediately for active reservation
    for (const item of orderItems) {
      await Product.updateOne(
        { _id: item.product, 'variants.size': item.variant.size, 'variants.color': item.variant.color },
        { $inc: { 'variants.$.stock': -item.quantity } }
      );
    }

    // Clear cart items
    cart.items = [];
    await cart.save();

    // Remove ordered variants from Wishlist if applicable
    for (const item of orderItems) {
      await Wishlist.updateOne(
        { user: userId },
        { $pull: { items: { product: item.product, 'variant.size': item.variant.size, 'variant.color': item.variant.color } } }
      );
    }

    // Clear applied coupon from session
    delete req.session.appliedCoupon;

    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();

    return res.status(200).json({
      success: true,
      keyId,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      addressId,
      orderId: order.orderId,
      stockReservationExpiresAt: order.stockReservationExpiresAt
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to initiate Razorpay payment.' });
  }
};

/**
 * Verify Razorpay Payment and Confirm Order on Server-Side.
 */
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to complete payment' });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment response payload' });
    }

    // Server-side HMAC SHA256 signature verification
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    // Find existing order created during payment initiation
    let orderQuery = { user: userId, razorpayOrderId: razorpay_order_id };
    if (orderId) {
      orderQuery = {
        user: userId,
        $or: [
          { razorpayOrderId: razorpay_order_id },
          { orderId: orderId },
          ...(mongoose.Types.ObjectId.isValid(orderId) ? [{ _id: orderId }] : [])
        ]
      };
    }

    const order = await Order.findOne(orderQuery);
    if (!order) {
      return res.status(400).json({ success: false, message: 'Order record not found for this payment' });
    }

    // Verify payment was completed before the 5-minute reservation deadline
    if (order.stockReservationStatus === 'EXPIRED' || (order.stockReservationExpiresAt && new Date() > new Date(order.stockReservationExpiresAt))) {
      return res.status(400).json({
        success: false,
        message: 'The 5-minute payment reservation window has expired. Please try placing your order again.',
        orderId: order.orderId,
        isExpired: true
      });
    }

    if (order.stockReservationStatus !== 'ACTIVE' && order.stockReservationStatus !== 'NONE' && order.paymentStatus !== 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment cannot be completed for this order.',
        orderId: order.orderId
      });
    }

    // Confirm order & complete stock reservation
    order.paymentStatus = 'Paid';
    order.status = 'Pending';
    order.stockReservationStatus = 'COMPLETED';
    order.stockReservationExpiresAt = null;

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Payment verified and order placed successfully.',
      orderId: order.orderId
    });
  } catch (error) {
    console.error('Verify Razorpay payment error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to verify payment.' });
  }
};

/**
 * Render success page.
 */
export const getSuccessPage = async (req, res) => {
  try {
    const { orderId } = req.query;
    if (!orderId) {
      return res.redirect('/');
    }

    res.render('user/checkout/success', {
      title: 'Payment Successful',
      orderId,
      layout: 'layouts/user-layout',
      user: req.session.user
    });
  } catch (error) {
    console.error('Success page error:', error);
    res.redirect('/');
  }
};

/**
 * Render failure page.
 */
export const getFailurePage = async (req, res) => {
  try {
    res.render('user/checkout/failure', {
      title: 'Payment Failed',
      layout: 'layouts/user-layout',
      user: req.session.user
    });
  } catch (error) {
    console.error('Failure page error:', error);
    res.redirect('/checkout');
  }
};
