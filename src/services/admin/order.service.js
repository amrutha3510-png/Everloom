import mongoose from 'mongoose';
import Order from '../../models/orderModel.js';
import User from '../../models/userModel.js';

/**
 * Get all orders with search, filter, sort and pagination.
 */
export const getAllOrders = async (queryParams, page = 1, limit = 10) => {
  const { search, status, sort } = queryParams;
  const matchQuery = {};

  // Handle status filter
  if (status && status !== 'All') {
    matchQuery.status = status;
  }

  // Handle search by Order ID or populated user name/email
  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    
    // Find users matching search name or email
    const users = await User.find({
      $or: [
        { fullName: { $regex: searchRegex } },
        { email: { $regex: searchRegex } }
      ]
    }).select('_id');
    const userIds = users.map(u => u._id);

    const orClauses = [
      { user: { $in: userIds } },
      { orderId: { $regex: searchRegex } }
    ];

    // If search is a valid ObjectId, search by Order ID
    if (mongoose.Types.ObjectId.isValid(search.trim())) {
      orClauses.push({ _id: search.trim() });
    }

    matchQuery.$or = orClauses;
  }

  // Handle sorting
  let sortOption = { createdAt: -1 }; // Default: Newest First
  if (sort === 'Oldest First') {
    sortOption = { createdAt: 1 };
  }

  const skip = (page - 1) * limit;

  // Execute query
  const orders = await Order.find(matchQuery)
    .populate('user')
    .populate('items.product')
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  const totalEntries = await Order.countDocuments(matchQuery);
  const totalPages = Math.ceil(totalEntries / limit);

  // Compute status stats for order summary
  const allStats = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const stats = {
    total: await Order.countDocuments(),
    pending: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  };

  allStats.forEach(stat => {
    if (stat._id === 'Pending') stats.pending = stat.count;
    if (stat._id === 'Shipped') stats.shipped = stat.count;
    if (stat._id === 'Delivered') stats.delivered = stat.count;
    if (stat._id === 'Cancelled') stats.cancelled = stat.count;
  });

  return {
    orders,
    totalPages,
    currentPage: page,
    totalEntries,
    stats
  };
};

/**
 * Get detailed order by ID.
 */
export const getOrderById = async (orderId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error('Invalid Order ID format.');
  }

  const order = await Order.findById(orderId)
    .populate('user')
    .populate('items.product');

  if (!order) {
    throw new Error('Order not found.');
  }

  return order;
};

/**
 * Update order status.
 */
export const updateOrderStatus = async (orderId, newStatus) => {
  const allowedStatuses = ['Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'];
  if (!allowedStatuses.includes(newStatus)) {
    throw new Error('Invalid status value.');
  }

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error('Invalid Order ID format.');
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error('Order not found.');
  }

  // Restore inventory if order is being cancelled, and it wasn't cancelled before
  if (newStatus === 'Cancelled' && order.status !== 'Cancelled') {
    for (const item of order.items) {
      const Product = mongoose.model('Product');
      const product = await Product.findById(item.product);
      if (product) {
        // Find matching variant by size and color
        const variantIndex = product.variants.findIndex(
          v => v.size === item.variant.size && v.color === item.variant.color
        );
        if (variantIndex !== -1) {
          product.variants[variantIndex].stock += item.quantity;
          await product.save();
        }
      }
    }
  }

  order.status = newStatus;
  await order.save();
  return order;
};
