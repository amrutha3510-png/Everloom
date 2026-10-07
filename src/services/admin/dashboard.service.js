import Order from '../../models/orderModel.js';

/**
 * Get Sales Chart dataset for specified filter (daily, weekly, monthly, yearly, custom).
 * STRICT BUSINESS RULE: Excludes Cancelled & Returned orders.
 */
export const getSalesChartData = async (filter = 'monthly', customStartDate = null, customEndDate = null) => {
  const matchQuery = { status: { $nin: ['Cancelled', 'Returned'] } };
  const now = new Date();

  let labels = [];
  let data = [];

  if (filter === 'daily') {
    // 24-hour slots of current day
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    matchQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };

    const hourlyData = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          totalSales: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const salesMap = {};
    hourlyData.forEach(item => {
      salesMap[item._id] = item.totalSales;
    });

    // 12 2-hour intervals or 24 1-hour slots (00:00 to 23:00)
    for (let hr = 0; hr < 24; hr += 2) {
      const label = `${hr.toString().padStart(2, '0')}:00`;
      labels.push(label);
      const slotSales = (salesMap[hr] || 0) + (salesMap[hr + 1] || 0);
      data.push(slotSales);
    }

  } else if (filter === 'weekly') {
    // Days of current week (Mon - Sun)
    const dayOfWeek = now.getDay();
    const diffToMon = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const mon = new Date(now);
    mon.setDate(diffToMon);
    mon.setHours(0, 0, 0, 0);

    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);

    matchQuery.createdAt = { $gte: mon, $lte: sun };

    const weeklyData = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          totalSales: { $sum: '$totalAmount' }
        }
      }
    ]);

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayMap = { 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 1: 6 };

    const salesArr = [0, 0, 0, 0, 0, 0, 0];
    weeklyData.forEach(item => {
      const idx = dayMap[item._id];
      if (idx !== undefined) salesArr[idx] = item.totalSales;
    });

    labels = dayNames;
    data = salesArr;

  } else if (filter === 'yearly') {
    // Past 5 years
    const currentYear = now.getFullYear();
    const startYear = currentYear - 4;
    matchQuery.createdAt = {
      $gte: new Date(startYear, 0, 1),
      $lte: new Date(currentYear, 11, 31, 23, 59, 59)
    };

    const yearlyData = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $year: '$createdAt' },
          totalSales: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const salesMap = {};
    yearlyData.forEach(item => {
      salesMap[item._id] = item.totalSales;
    });

    for (let yr = startYear; yr <= currentYear; yr++) {
      labels.push(yr.toString());
      data.push(salesMap[yr] || 0);
    }

  } else if (filter === 'custom' && customStartDate && customEndDate) {
    const start = new Date(customStartDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(customEndDate);
    end.setHours(23, 59, 59, 999);

    matchQuery.createdAt = { $gte: start, $lte: end };

    const customData = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalSales: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    customData.forEach(item => {
      labels.push(item._id);
      data.push(item.totalSales);
    });

    if (labels.length === 0) {
      labels = [customStartDate, customEndDate];
      data = [0, 0];
    }

  } else {
    // Default Monthly: 12 months of current year
    const currentYear = now.getFullYear();
    matchQuery.createdAt = {
      $gte: new Date(currentYear, 0, 1),
      $lte: new Date(currentYear, 11, 31, 23, 59, 59)
    };

    const monthlyData = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $month: '$createdAt' },
          totalSales: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const salesMap = {};
    monthlyData.forEach(item => {
      salesMap[item._id] = item.totalSales;
    });

    labels = months;
    data = months.map((m, idx) => salesMap[idx + 1] || 0);
  }

  return { labels, data, filter };
};

/**
 * Top 5 Best Selling Products Bar Chart dataset.
 * Returns product names and actual quantity sold.
 */
export const getTop5ProductsBarChart = async () => {
  const result = await Order.aggregate([
    { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalQuantitySold: { $sum: '$items.quantity' }
      }
    },
    { $sort: { totalQuantitySold: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'productDoc'
      }
    },
    { $unwind: '$productDoc' }
  ]);

  const labels = result.map(item => item.productDoc ? item.productDoc.name : 'Unknown Product');
  const data = result.map(item => item.totalQuantitySold);

  return { labels, data };
};
export const getTop10ProductsBarChart = getTop5ProductsBarChart;

/**
 * Distribution of valid orders by Payment Method (COD, Razorpay, WALLET) for Pie/Donut Chart.
 */
export const getPaymentMethodChartData = async () => {
  const result = await Order.aggregate([
    { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 }
      }
    }
  ]);

  const payMap = {
    'COD': 0,
    'Razorpay': 0,
    'WALLET': 0
  };

  result.forEach(item => {
    const methodKey = item._id ? item._id.toUpperCase() : 'COD';
    if (methodKey === 'COD') payMap['COD'] += item.count;
    else if (methodKey === 'RAZORPAY') payMap['Razorpay'] += item.count;
    else if (methodKey === 'WALLET') payMap['WALLET'] += item.count;
    else payMap['COD'] += item.count;
  });

  return {
    labels: ['Cash on Delivery', 'Razorpay Online', 'EverLoom Wallet'],
    data: [payMap['COD'], payMap['Razorpay'], payMap['WALLET']]
  };
};

/**
 * Top 5 Best Selling Products.
 */
export const getTop5Products = async () => {
  const result = await Order.aggregate([
    { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalQuantitySold: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $sort: { totalQuantitySold: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' }
  ]);

  return result.map(item => ({
    productId: item.product._id,
    name: item.product.name,
    image: item.product.images && item.product.images.length > 0 ? item.product.images[0] : '',
    totalQuantitySold: item.totalQuantitySold,
    totalRevenue: item.totalRevenue
  }));
};
export const getTop10Products = getTop5Products;

/**
 * Top 5 Best Selling Categories.
 */
export const getTop5Categories = async () => {
  const result = await Order.aggregate([
    { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'productDoc'
      }
    },
    { $unwind: '$productDoc' },
    {
      $group: {
        _id: '$productDoc.category',
        totalQuantitySold: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $sort: { totalQuantitySold: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: '$category' }
  ]);

  return result.map(item => ({
    categoryId: item.category._id,
    name: item.category.name,
    totalQuantitySold: item.totalQuantitySold,
    totalRevenue: item.totalRevenue
  }));
};
export const getTop10Categories = getTop5Categories;

/**
 * Generate Ledger Book entries from actual order data.
 */
export const getLedgerBookData = async (limit = 5) => {
  const orders = await Order.find()
    .populate('user', 'fullName email')
    .sort({ createdAt: -1 })
    .limit(limit);

  let runningBalance = 0;
  const ledgerEntries = [];

  const chronological = [...orders].reverse();

  chronological.forEach(order => {
    const orderIdStr = '#' + (order.orderId || order._id.toString().slice(-6));
    const customerStr = order.user ? order.user.fullName : (order.shippingAddress?.fullName || 'Guest');
    const dateStr = new Date(order.createdAt).toLocaleDateString('en-GB');

    if (order.status === 'Cancelled' || order.status === 'Returned') {
      const debitAmt = order.totalAmount || 0;
      runningBalance -= debitAmt;
      ledgerEntries.push({
        date: dateStr,
        ref: orderIdStr,
        description: `Order ${order.status} Refund - ${customerStr}`,
        type: 'Debit',
        amount: debitAmt,
        runningBalance
      });
    } else {
      const creditAmt = order.totalAmount || 0;
      runningBalance += creditAmt;
      ledgerEntries.push({
        date: dateStr,
        ref: orderIdStr,
        description: `Order Sales Payment (${order.paymentMethod || 'COD'}) - ${customerStr}`,
        type: 'Credit',
        amount: creditAmt,
        runningBalance
      });
    }
  });

  return ledgerEntries.reverse();
};
