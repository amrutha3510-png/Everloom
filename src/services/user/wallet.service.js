import User from '../../models/userModel.js';
import WalletTransaction from '../../models/walletTransactionModel.js';

/**
 * Get wallet balance and transaction history for a user.
 */
export const getWalletData = async (userId) => {
  const user = await User.findById(userId).select('walletBalance').lean();
  const walletBalance = user ? (user.walletBalance || 0) : 0;

  const transactions = await WalletTransaction.find({ user: userId })
    .sort({ createdAt: -1 })
    .lean();

  return {
    walletBalance,
    transactions,
  };
};

/**
 * Credit money to user's wallet.
 */
export const addCredit = async (userId, amount, description, orderId = null, razorpayOrderId = null, razorpayPaymentId = null) => {
  if (!amount || amount <= 0) {
    throw new Error('Invalid credit amount.');
  }

  // Prevent duplicate successful credits for the same Razorpay payment or order
  if (razorpayPaymentId || razorpayOrderId) {
    const query = { user: userId, status: 'Success' };
    if (razorpayPaymentId) query.razorpayPaymentId = razorpayPaymentId;
    else if (razorpayOrderId) query.razorpayOrderId = razorpayOrderId;

    const existingTx = await WalletTransaction.findOne(query);
    if (existingTx) {
      const u = await User.findById(userId).select('walletBalance').lean();
      return { walletBalance: u ? (u.walletBalance || 0) : 0, transaction: existingTx };
    }
  }

  // Atomic update in MongoDB to ensure walletBalance field is always updated directly
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: amount } },
    { returnDocument: 'after', runValidators: false }
  );

  if (!updatedUser) {
    throw new Error('User not found.');
  }

  const newBalance = updatedUser.walletBalance || 0;

  const transaction = new WalletTransaction({
    user: userId,
    amount,
    type: 'Credit',
    description: description || 'Wallet Credit',
    status: 'Success',
    runningBalance: newBalance,
    orderId: orderId || null,
    razorpayOrderId: razorpayOrderId || null,
    razorpayPaymentId: razorpayPaymentId || null,
  });
  await transaction.save();

  return { walletBalance: newBalance, transaction };
};

/**
 * Record a failed credit transaction (e.g. failed wallet top-up).
 * IMPORTANT: Does NOT mutate user's wallet balance.
 */
export const addFailedCredit = async (userId, amount, description, razorpayOrderId = null, razorpayPaymentId = null) => {
  if (!amount || amount <= 0) {
    throw new Error('Invalid credit amount.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  // Prevent duplicate transaction records for the same Razorpay payment/order
  if (razorpayPaymentId || razorpayOrderId) {
    const query = { user: userId };
    if (razorpayPaymentId) query.razorpayPaymentId = razorpayPaymentId;
    else if (razorpayOrderId) query.razorpayOrderId = razorpayOrderId;

    const existingTx = await WalletTransaction.findOne(query);
    if (existingTx) {
      return { walletBalance: user.walletBalance || 0, transaction: existingTx };
    }
  }

  const currentBalance = user.walletBalance || 0;

  const transaction = new WalletTransaction({
    user: userId,
    amount,
    type: 'Credit',
    description: description || 'Wallet Top-up',
    status: 'Failed',
    runningBalance: currentBalance,
    orderId: null,
    razorpayOrderId: razorpayOrderId || null,
    razorpayPaymentId: razorpayPaymentId || null,
  });
  await transaction.save();

  return { walletBalance: currentBalance, transaction };
};

/**
 * Debit money from user's wallet.
 */
export const deductDebit = async (userId, amount, description, orderId = null) => {
  if (!amount || amount <= 0) {
    throw new Error('Invalid debit amount.');
  }

  const user = await User.findById(userId).select('walletBalance');
  if (!user) {
    throw new Error('User not found.');
  }

  const currentBalance = user.walletBalance || 0;
  if (currentBalance < amount) {
    throw new Error('Insufficient wallet balance.');
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: -amount } },
    { returnDocument: 'after', runValidators: false }
  );

  const newBalance = updatedUser ? (updatedUser.walletBalance || 0) : 0;

  const transaction = new WalletTransaction({
    user: userId,
    amount,
    type: 'Debit',
    description: description || 'Wallet Debit',
    status: 'Success',
    runningBalance: newBalance,
    orderId: orderId || null
  });
  await transaction.save();

  return { walletBalance: newBalance, transaction };
};
