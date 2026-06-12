import User from '../../models/userModel.js';

export const getAllCustomers = async (query = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  
  const filter = { role: 'user' };
  
  if (query.status && query.status !== 'All Status') {
    filter.status = query.status.toLowerCase();
  }
  
  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } }
    ];
  }

  const customers = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const totalCustomers = await User.countDocuments(filter);
  
  // Stats for cards
  const totalUsers = await User.countDocuments({ role: 'user' });
  const activeUsers = await User.countDocuments({ role: 'user', status: 'active' });
  const blockedUsers = await User.countDocuments({ role: 'user', status: 'blocked' });
  const inactiveUsers = await User.countDocuments({ role: 'user', isVerified: false });

  return {
    customers,
    totalPages: Math.ceil(totalCustomers / limit),
    currentPage: page,
    totalEntries: totalCustomers,
    stats: {
      total: totalUsers,
      active: activeUsers,
      blocked: blockedUsers,
      inactive: inactiveUsers
    }
  };
};

export const toggleCustomerStatus = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.role === 'admin') throw new Error('Cannot toggle status of an admin');
  
  user.status = user.status === 'active' ? 'blocked' : 'active';
  await user.save();
  
  return user.status;
};

