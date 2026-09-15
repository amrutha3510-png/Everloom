import Order from '../../models/orderModel.js';
import Product from '../../models/productModel.js';
import Cart from '../../models/cartModel.js';
import * as walletService from './wallet.service.js';
import mongoose from 'mongoose';

/**
 * Automatically check and expire stock reservation if 5 minutes have elapsed.
 * Atomically updates reservation state and restores variant stock to prevent duplicate restocking.
 */
export const processStockReservationExpiry = async (order) => {
  if (!order) return order;

  if (
    order.stockReservationStatus === 'ACTIVE' &&
    order.stockReservationExpiresAt &&
    new Date() >= new Date(order.stockReservationExpiresAt)
  ) {
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        stockReservationStatus: 'ACTIVE',
        stockReservationExpiresAt: { $lte: new Date() }
      },
      {
        $set: {
          stockReservationStatus: 'EXPIRED',
          isStockRestored: true
        }
      },
      { returnDocument: 'after' }
    ).populate('items.product').lean();

    if (updatedOrder) {
      for (const item of updatedOrder.items) {
        const productId = item.product ? (item.product._id || item.product) : null;
        if (productId && item.variant) {
          await Product.updateOne(
            {
              _id: productId,
              'variants.size': item.variant.size,
              'variants.color': item.variant.color
            },
            { $inc: { 'variants.$.stock': item.quantity } }
          );
        }
      }
      return updatedOrder;
    }
  }

  return order;
};

/**
 * Fetch orders for the logged-in user with search, filter, and pagination.
 */
export const getUserOrders = async (userId, queryParams, page = 1, limit = 10) => {
  const { search, status } = queryParams;
  const matchQuery = { user: userId };

  // Status Filter
  if (status && status !== 'All') {
    matchQuery.status = status;
  }

  // Search by Order ID (regex on readable orderId)
  if (search && search.trim() !== '') {
    matchQuery.orderId = { $regex: search.trim(), $options: 'i' };
  }

  const skip = (page - 1) * limit;

  const rawOrders = await Order.find(matchQuery)
    .populate('items.product')
    .sort({ createdAt: -1 }) // Newest first
    .skip(skip)
    .limit(limit)
    .lean();

  const orders = [];
  for (let ord of rawOrders) {
    const processed = await processStockReservationExpiry(ord);
    orders.push(processed);
  }

  const totalEntries = await Order.countDocuments(matchQuery);
  const totalPages = Math.ceil(totalEntries / limit) || 1;

  return {
    orders,
    totalPages,
    currentPage: page,
    totalEntries
  };
};

import { calculateOrderPricing } from '../general/orderPricing.service.js';

/**
 * Retrieve a specific order by readable orderId or database ObjectId.
 */
export const getUserOrderById = async (userId, orderIdOrDbId) => {
  const query = { user: userId };
  
  if (mongoose.Types.ObjectId.isValid(orderIdOrDbId)) {
    query.$or = [
      { _id: orderIdOrDbId },
      { orderId: orderIdOrDbId }
    ];
  } else {
    query.orderId = orderIdOrDbId;
  }

  let order = await Order.findOne(query)
    .populate('items.product')
    .populate('user', 'fullName email')
    .lean();

  if (order) {
    order = await processStockReservationExpiry(order);
  }

  if (order && order.items) {
    order.items.forEach(item => {
      if (item.status !== 'Cancelled') {
        if (['Delivered', 'Shipped', 'Out for Delivery', 'Returned', 'Return Requested'].includes(order.status)) {
          if (!item.status || item.status === 'Pending') {
            item.status = order.status;
          }
        }
      }
      if (item.product) {
        if (!item.product.images || item.product.images.length === 0) {
          if (item.product.colorOptions && item.product.colorOptions.length > 0) {
            const matchedCo = item.product.colorOptions.find(co => 
              co.name && item.variant && item.variant.color && 
              co.name.toLowerCase() === item.variant.color.toLowerCase()
            );
            item.product.images = matchedCo && matchedCo.images && matchedCo.images.length > 0 
              ? matchedCo.images 
              : (item.product.colorOptions[0].images || []);
          } else {
            item.product.images = [];
          }
        }
      }
    });
  }

  if (order) {
    order = calculateOrderPricing(order);
  }

  return order;
};

/**
 * Request full order cancellation by the user.
 */
export const cancelUserOrder = async (userId, orderId, cancellationReason) => {
  if (!cancellationReason || cancellationReason.trim() === '') {
    throw new Error('Cancellation reason is required.');
  }

  const query = { user: userId };
  if (mongoose.Types.ObjectId.isValid(orderId)) {
    query.$or = [{ _id: orderId }, { orderId: orderId }];
  } else {
    query.orderId = orderId;
  }

  const order = await Order.findOne(query);
  if (!order) {
    throw new Error('Order not found or access denied.');
  }

  // Check if current status allows cancellation (ONLY Pending allowed)
  if (order.status !== 'Pending') {
    throw new Error(`Cancellation is not allowed for orders with status "${order.status}".`);
  }

  // Set order status and all eligible non-shipped item statuses to "Cancellation Requested"
  order.status = 'Cancellation Requested';
  order.cancellationReason = cancellationReason.trim();

  for (const item of order.items) {
    if (item.status === 'Pending') {
      item.status = 'Cancellation Requested';
      item.cancellationReason = cancellationReason.trim();
    }
  }

  await order.save();
  return order;
};

/**
 * Request single product item cancellation by the user.
 */
export const cancelUserOrderItem = async (userId, orderId, itemId, cancellationReason) => {
  if (!cancellationReason || cancellationReason.trim() === '') {
    throw new Error('Cancellation reason is required.');
  }

  const query = { user: userId };
  if (mongoose.Types.ObjectId.isValid(orderId)) {
    query.$or = [{ _id: orderId }, { orderId: orderId }];
  } else {
    query.orderId = orderId;
  }

  const order = await Order.findOne(query);
  if (!order) {
    throw new Error('Order not found or access denied.');
  }

  const item = order.items.id(itemId) || order.items.find(i => i._id && i._id.toString() === itemId);
  if (!item) {
    throw new Error('Product item not found in this order.');
  }

  // Check item status eligibility (ONLY Pending allowed)
  if (item.status !== 'Pending') {
    throw new Error(`Cancellation is not allowed for product items with status "${item.status}".`);
  }

  item.status = 'Cancellation Requested';
  item.cancellationReason = cancellationReason.trim();

  // Check if ALL active non-cancelled items in order are now Cancellation Requested
  const activeItems = order.items.filter(i => i.status !== 'Cancelled');
  const allRequested = activeItems.length > 0 && activeItems.every(i => i.status === 'Cancellation Requested');
  if (allRequested) {
    order.status = 'Cancellation Requested';
    if (!order.cancellationReason) {
      order.cancellationReason = cancellationReason.trim();
    }
  }

  await order.save();
  return order;
};

/**
 * Return request by the user.
 */
export const returnUserOrder = async (userId, orderId, returnReason, customReason) => {
  const ALLOWED_PREDEFINED = [
    'Product is damaged',
    'Product is defective',
    'Wrong product received',
    'Wrong size received',
    'Product does not match the description',
    'Quality issue'
  ];

  let finalReason = '';

  if (!returnReason || typeof returnReason !== 'string' || returnReason.trim() === '' || returnReason.trim() === 'Select Return Reason') {
    throw new Error('Please select a valid return reason.');
  }

  const selectedReason = returnReason.trim();

  if (ALLOWED_PREDEFINED.includes(selectedReason)) {
    finalReason = selectedReason;
  } else if (selectedReason === 'Other') {
    if (!customReason || typeof customReason !== 'string' || customReason.trim() === '') {
      throw new Error('Custom return reason is required when "Other" is selected.');
    }
    finalReason = customReason.trim();
  } else {
    throw new Error('Invalid return reason value.');
  }

  const query = { user: userId };
  if (mongoose.Types.ObjectId.isValid(orderId)) {
    query.$or = [{ _id: orderId }, { orderId: orderId }];
  } else {
    query.orderId = orderId;
  }

  const order = await Order.findOne(query);
  if (!order) {
    throw new Error('Order not found or access denied.');
  }

  if (order.status !== 'Delivered') {
    throw new Error('Return requests are only allowed for delivered orders.');
  }

  order.status = 'Return Requested';
  order.returnReason = finalReason;
  order.returnStatus = 'Pending';

  await order.save();
  return order;
};

/**
 * Return request for a single product item in an order by the user.
 */
export const returnUserOrderItem = async (userId, orderId, itemId, returnReason, customReason) => {
  const ALLOWED_PREDEFINED = [
    'Product is damaged',
    'Product is defective',
    'Wrong product received',
    'Wrong size received',
    'Product does not match the description',
    'Quality issue'
  ];

  let finalReason = '';

  if (!returnReason || typeof returnReason !== 'string' || returnReason.trim() === '' || returnReason.trim() === 'Select Return Reason') {
    throw new Error('Please select a valid return reason.');
  }

  const selectedReason = returnReason.trim();

  if (ALLOWED_PREDEFINED.includes(selectedReason)) {
    finalReason = selectedReason;
  } else if (selectedReason === 'Other') {
    if (!customReason || typeof customReason !== 'string' || customReason.trim() === '') {
      throw new Error('Custom return reason is required when "Other" is selected.');
    }
    finalReason = customReason.trim();
  } else {
    throw new Error('Invalid return reason value.');
  }

  const query = { user: userId };
  if (mongoose.Types.ObjectId.isValid(orderId)) {
    query.$or = [{ _id: orderId }, { orderId: orderId }];
  } else {
    query.orderId = orderId;
  }

  const order = await Order.findOne(query);
  if (!order) {
    throw new Error('Order not found or access denied.');
  }

  const item = order.items.id(itemId) || order.items.find(i => i._id && i._id.toString() === itemId);
  if (!item) {
    throw new Error('Product item not found in this order.');
  }

  const isItemEligible = (order.status === 'Delivered' || item.status === 'Delivered') &&
                         !['Cancelled', 'Return Requested', 'Returned'].includes(item.status);

  if (!isItemEligible) {
    throw new Error('Return is only allowed for delivered items that are not already cancelled or returned.');
  }

  item.status = 'Return Requested';

  const validItems = order.items.filter(i => i.status !== 'Cancelled');
  const allReturnRequested = validItems.length > 0 && validItems.every(i => i.status === 'Return Requested' || i.status === 'Returned');
  if (allReturnRequested) {
    order.status = 'Return Requested';
    order.returnReason = finalReason;
    order.returnStatus = 'Pending';
  }

  await order.save();
  return order;
};

/**
 * Explicitly trigger stock reservation expiry for an order (e.g. from frontend timer).
 */
export const expireOrderStockReservation = async (userId, orderId) => {
  const query = { user: userId };
  if (mongoose.Types.ObjectId.isValid(orderId)) {
    query.$or = [{ _id: orderId }, { orderId: orderId }];
  } else {
    query.orderId = orderId;
  }

  let order = await Order.findOne(query).populate('items.product');
  if (!order) {
    throw new Error('Order not found or access denied.');
  }

  // Strictly enforce backend deadline: MUST be ACTIVE, MUST have stockReservationExpiresAt, and MUST be <= current time
  if (
    order.stockReservationStatus === 'ACTIVE' &&
    order.stockReservationExpiresAt &&
    new Date() >= new Date(order.stockReservationExpiresAt)
  ) {
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        stockReservationStatus: 'ACTIVE',
        stockReservationExpiresAt: { $lte: new Date() }
      },
      {
        $set: {
          stockReservationStatus: 'EXPIRED',
          isStockRestored: true
        }
      },
      { returnDocument: 'after' }
    ).populate('items.product').lean();

    if (updatedOrder) {
      for (const item of updatedOrder.items) {
        const productId = item.product ? (item.product._id || item.product) : null;
        if (productId && item.variant) {
          await Product.updateOne(
            {
              _id: productId,
              'variants.size': item.variant.size,
              'variants.color': item.variant.color
            },
            { $inc: { 'variants.$.stock': item.quantity } }
          );
        }
      }
      return updatedOrder;
    }
  }

  return order;
};

/**
 * Re-add items from a failed order back to the user's cart for a new checkout attempt.
 */
export const reorderFailedOrder = async (userId, orderId) => {
  const query = { user: userId };
  if (mongoose.Types.ObjectId.isValid(orderId)) {
    query.$or = [{ _id: orderId }, { orderId: orderId }];
  } else {
    query.orderId = orderId;
  }

  const order = await Order.findOne(query);
  if (!order) {
    throw new Error('Order not found or access denied.');
  }

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  for (const item of order.items) {
    const existingIndex = cart.items.findIndex(ci => 
      ci.product.toString() === item.product.toString() &&
      ci.variant.size === item.variant.size &&
      ci.variant.color === item.variant.color
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += item.quantity;
    } else {
      cart.items.push({
        product: item.product,
        variant: {
          size: item.variant.size,
          color: item.variant.color
        },
        quantity: item.quantity
      });
    }
  }

  await cart.save();
  return cart;
};
