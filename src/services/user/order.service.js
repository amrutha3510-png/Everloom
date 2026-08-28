import Order from '../../models/orderModel.js';
import Product from '../../models/productModel.js';
import mongoose from 'mongoose';

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

  const orders = await Order.find(matchQuery)
    .populate('items.product')
    .sort({ createdAt: -1 }) // Newest first
    .skip(skip)
    .limit(limit)
    .lean();

  const totalEntries = await Order.countDocuments(matchQuery);
  const totalPages = Math.ceil(totalEntries / limit) || 1;

  return {
    orders,
    totalPages,
    currentPage: page,
    totalEntries
  };
};

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

  const order = await Order.findOne(query)
    .populate('items.product')
    .populate('user', 'fullName email')
    .lean();

  if (order && order.items) {
    order.items.forEach(item => {
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

  return order;
};

/**
 * Cancel full order by the user.
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

  // Check if current status allows cancellation
  const cancellableStatuses = ['Pending', 'Shipped'];
  if (!cancellableStatuses.includes(order.status)) {
    throw new Error(`Cancellation is not allowed for orders with status "${order.status}".`);
  }

  // Increment stock level for each item's variant if not already restored
  for (const item of order.items) {
    if (item.status !== 'Cancelled' && !item.isStockRestored) {
      await Product.updateOne(
        { _id: item.product, 'variants.size': item.variant.size, 'variants.color': item.variant.color },
        { $inc: { 'variants.$.stock': item.quantity } }
      );
      item.isStockRestored = true;
    }
    item.status = 'Cancelled';
    if (!item.cancellationReason) {
      item.cancellationReason = cancellationReason.trim();
    }
  }

  order.status = 'Cancelled';
  order.cancellationReason = cancellationReason.trim();
  order.isStockRestored = true;

  await order.save();
  return order;
};

/**
 * Cancel an individual product item from an order.
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

  // Check order status eligibility
  const cancellableStatuses = ['Pending', 'Shipped'];
  if (!cancellableStatuses.includes(order.status)) {
    throw new Error(`Cancellation is not allowed for orders with status "${order.status}".`);
  }

  const item = order.items.id(itemId) || order.items.find(i => i._id && i._id.toString() === itemId);
  if (!item) {
    throw new Error('Product item not found in this order.');
  }

  if (item.status === 'Cancelled') {
    throw new Error('This product item has already been cancelled.');
  }

  // Restore variant stock ONLY ONCE
  if (!item.isStockRestored) {
    await Product.updateOne(
      { _id: item.product, 'variants.size': item.variant.size, 'variants.color': item.variant.color },
      { $inc: { 'variants.$.stock': item.quantity } }
    );
    item.isStockRestored = true;
  }

  item.status = 'Cancelled';
  item.cancellationReason = cancellationReason.trim();

  // Check if ALL items in order are now cancelled
  const allItemsCancelled = order.items.every(i => i.status === 'Cancelled');
  if (allItemsCancelled) {
    order.status = 'Cancelled';
    order.cancellationReason = cancellationReason.trim();
    order.isStockRestored = true;
  }

  await order.save();
  return order;
};

/**
 * Return request by the user.
 */
export const returnUserOrder = async (userId, orderId, returnReason) => {
  if (!returnReason || returnReason.trim() === '') {
    throw new Error('Return reason is mandatory.');
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
  order.returnReason = returnReason.trim();
  order.returnStatus = 'Pending';

  await order.save();
  return order;
};
