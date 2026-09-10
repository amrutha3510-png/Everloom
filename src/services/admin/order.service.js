import mongoose from 'mongoose';
import Order from '../../models/orderModel.js';
import User from '../../models/userModel.js';
import * as walletService from '../user/wallet.service.js';

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
 * Update order status with strict forward-only flow and return restock option.
 */
export const updateOrderStatus = async (orderId, newStatus, restockOption = null) => {
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

  // 1. Prevent updating already terminal statuses
  if (order.status === 'Cancelled') {
    throw new Error('Cannot update status of a cancelled order.');
  }
  if (order.status === 'Returned') {
    throw new Error('Cannot update status of an already returned order.');
  }

  // 2. Strict Forward-Only Status Hierarchy
  const STATUS_RANK = {
    'Pending': 1,
    'Shipped': 2,
    'Out for Delivery': 3,
    'Delivered': 4,
    'Return Requested': 5,
    'Returned': 6,
    'Cancelled': 99
  };

  // Prevent backward transition (e.g., Delivered -> Pending/Shipped/Out for Delivery)
  if (STATUS_RANK[newStatus] && STATUS_RANK[order.status]) {
    if (STATUS_RANK[newStatus] < STATUS_RANK[order.status]) {
      throw new Error(`Invalid status transition: Order status cannot move backwards from "${order.status}" to "${newStatus}".`);
    }
  }

  // 3. Cancellation rules
  if (newStatus === 'Cancelled') {
    const cancellableStatuses = ['Pending', 'Shipped'];
    if (!cancellableStatuses.includes(order.status)) {
      throw new Error(`Cancellation is not allowed for orders with status "${order.status}".`);
    }

    // Restore stock if not already restored
    if (!order.isStockRestored) {
      const Product = mongoose.model('Product');
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product, 'variants.size': item.variant.size, 'variants.color': item.variant.color },
          { $inc: { 'variants.$.stock': item.quantity } }
        );
      }
      order.isStockRestored = true;
    }
  }

  // 4. Return processing (Restock vs Do Not Restock option)
  if (newStatus === 'Returned') {
    if (order.status !== 'Return Requested' && order.status !== 'Delivered') {
      throw new Error(`Return processing is only allowed for delivered or return-requested orders.`);
    }

    // If Admin selects Restock and stock has not been restored yet
    if (restockOption === 'restock' && !order.isStockRestored) {
      const Product = mongoose.model('Product');
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product, 'variants.size': item.variant.size, 'variants.color': item.variant.color },
          { $inc: { 'variants.$.stock': item.quantity } }
        );
      }
      order.isStockRestored = true;
    }

    // Credit refund to User Wallet ONLY ONCE on Admin approval
    if (!order.isRefunded && (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'WALLET')) {
      if (order.totalAmount && order.totalAmount > 0) {
        const recipientUserId = order.user._id ? order.user._id.toString() : order.user.toString();
        await walletService.addCredit(
          recipientUserId,
          order.totalAmount,
          `Return refund`,
          order.orderId
        );
        order.isRefunded = true;
      }
    }

    order.returnStatus = 'Approved';
  }

  order.status = newStatus;
  await order.save();
  return order;
};

/**
 * Fetch all return requests for Admin.
 */
export const getReturnRequests = async (queryParams, page = 1, limit = 10) => {
  const { search, status } = queryParams;

  const matchQuery = {
    $or: [
      { status: 'Return Requested' },
      { status: 'Returned' },
      { returnReason: { $exists: true, $ne: '' } },
      { returnStatus: { $in: ['Pending', 'Approved', 'Declined'] } }
    ]
  };

  if (status && status !== 'All') {
    if (status === 'Pending') {
      matchQuery.$and = [
        { $or: [{ returnStatus: 'Pending' }, { status: 'Return Requested' }] }
      ];
    } else if (status === 'Approved') {
      matchQuery.$and = [
        { $or: [{ returnStatus: 'Approved' }, { status: 'Returned' }] }
      ];
    } else if (status === 'Declined') {
      matchQuery.returnStatus = 'Declined';
    }
  }

  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    const users = await User.find({
      $or: [
        { fullName: { $regex: searchRegex } },
        { email: { $regex: searchRegex } }
      ]
    }).select('_id');
    const userIds = users.map(u => u._id);

    const searchClauses = [
      { user: { $in: userIds } },
      { orderId: { $regex: searchRegex } }
    ];
    if (mongoose.Types.ObjectId.isValid(search.trim())) {
      searchClauses.push({ _id: search.trim() });
    }

    if (matchQuery.$and) {
      matchQuery.$and.push({ $or: searchClauses });
    } else {
      matchQuery.$and = [{ $or: searchClauses }];
    }
  }

  const skip = (page - 1) * limit;

  const orders = await Order.find(matchQuery)
    .populate('user')
    .populate('items.product')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  orders.forEach(order => {
    if (order && order.items) {
      order.items.forEach(item => {
        if (item.product && (!item.product.images || item.product.images.length === 0)) {
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
      });
    }
  });

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
 * Decline return request by Admin.
 */
export const declineReturnRequest = async (orderId, declineReason) => {
  if (!declineReason || declineReason.trim() === '') {
    throw new Error('Decline reason is mandatory.');
  }

  let order;
  if (mongoose.Types.ObjectId.isValid(orderId)) {
    order = await Order.findById(orderId);
  }
  if (!order) {
    order = await Order.findOne({ orderId: orderId });
  }

  if (!order) {
    throw new Error('Order not found.');
  }

  order.returnStatus = 'Declined';
  order.declineReason = declineReason.trim();
  if (order.status === 'Return Requested') {
    order.status = 'Delivered';
  }
  // Stock must NOT be increased or modified!
  await order.save();
  return order;
};
