import * as cartService from '../../services/user/cart.service.js';
import { getAddresses } from '../../services/user/account.service.js';
import Address from '../../models/addressModel.js';
import Order from '../../models/orderModel.js';
import Cart from '../../models/cartModel.js';
import Product from '../../models/productModel.js';
import Wishlist from '../../models/wishlistModel.js';
import mongoose from 'mongoose';

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

    res.render('user/checkout/index', {
      title: 'Checkout',
      cart,
      addresses,
      defaultAddress,
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
 * Place COD Order.
 */
export const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to place an order' });
    }

    const { addressId, couponCode } = req.body;
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

      const itemTotal = variant.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        variant: {
          size: item.variant.size,
          color: item.variant.color
        },
        quantity: item.quantity,
        price: variant.price
      });
    }

    // 3. Pricing calculations
    let discount = 0;
    if (couponCode === 'EXTRA10') {
      discount = Math.round(subtotal * 0.1);
    }

    const shippingCharge = subtotal > 1999 ? 0 : 100;
    const finalTotal = subtotal + shippingCharge - discount;

    // 4. Create the Order
    const order = new Order({
      user: userId,
      items: orderItems,
      totalAmount: finalTotal,
      discountAmount: discount,
      couponCode: couponCode || '',
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
      paymentMethod: 'COD'
    });

    await order.save();

    // 5. Update stock level decrementally
    for (const item of orderItems) {
      await Product.updateOne(
        { _id: item.product, 'variants.size': item.variant.size, 'variants.color': item.variant.color },
        { $inc: { 'variants.$.stock': -item.quantity } }
      );
    }

    // 6. Clear cart items
    cart.items = [];
    await cart.save();

    // 7. Remove ordered variants from Wishlist if applicable
    for (const item of orderItems) {
      await Wishlist.updateOne(
        { user: userId },
        { $pull: { items: { product: item.product, 'variant.size': item.variant.size, 'variant.color': item.variant.color } } }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Order placed successfully',
      orderId: order.orderId
    });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ success: false, message: 'Failed to place order. Please try again.' });
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
      title: 'Order Placed Successfully',
      orderId,
      layout: 'layouts/user-layout',
      user: req.session.user
    });
  } catch (error) {
    console.error('Success page error:', error);
    res.redirect('/');
  }
};
