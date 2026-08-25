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

  return order;
};

/**
 * Cancel order by the user.
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

  // Increment stock level for each item's variant
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product, 'variants.size': item.variant.size, 'variants.color': item.variant.color },
      { $inc: { 'variants.$.stock': item.quantity } }
    );
  }

  order.status = 'Cancelled';
  order.cancellationReason = cancellationReason.trim();

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

  await order.save();
  return order;
};
