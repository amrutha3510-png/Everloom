import mongoose from 'mongoose';
import User from '../../models/userModel.js';
import WalletTransaction from '../../models/walletTransactionModel.js';

/**
 * Single source of truth helper to calculate exact user wallet balance
 * from successful WalletTransactions (sum of credits minus sum of debits).
 */
export const calculateUserWalletBalance = async (userId) => {
  if (!userId) return 0;
  const userObjId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

  const result = await WalletTransaction.aggregate([
    { $match: { user: userObjId, status: 'Success' } },
    {
      $group: {
        _id: null,
        totalCredits: {
          $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$amount', 0] }
        },
        totalDebits: {
          $sum: { $cond: [{ $eq: ['$type', 'Debit'] }, '$amount', 0] }
        }
      }
    }
  ]);

  const totalCredits = result[0] ? result[0].totalCredits : 0;
  const totalDebits = result[0] ? result[0].totalDebits : 0;
  const calculatedBalance = Math.max(0, Math.round((totalCredits - totalDebits) * 100) / 100);

  return calculatedBalance;
};

/**
 * Get wallet balance and transaction history for a user.
 * Auto-reconciles User.walletBalance to match transaction history.
 */
export const getWalletData = async (userId) => {
  const calculatedBalance = await calculateUserWalletBalance(userId);

  // Sync stored walletBalance field on User model if out of sync
  await User.updateOne(
    { _id: userId },
    { $set: { walletBalance: calculatedBalance } }
  );

  const transactions = await WalletTransaction.find({ user: userId })
    .sort({ createdAt: -1 })
    .lean();

  return {
    walletBalance: calculatedBalance,
    transactions,
  };
};

/**
 * Credit money to user's wallet.
 */
export const addCredit = async (userId, amount, description, orderId = null, razorpayOrderId = null, razorpayPaymentId = null, referenceId = null) => {
  const numAmount = parseFloat(amount);
  if (!amount || isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Invalid credit amount.');
  }

  // Prevent duplicate successful credits for the same payment, order or refund description
  const query = { user: userId, status: 'Success' };
  let checkDuplicate = false;

  if (referenceId) {
    query.referenceId = referenceId;
    checkDuplicate = true;
  } else if (razorpayPaymentId) {
    query.razorpayPaymentId = razorpayPaymentId;
    checkDuplicate = true;
  } else if (razorpayOrderId) {
    query.razorpayOrderId = razorpayOrderId;
    checkDuplicate = true;
  } else if (orderId) {
    query.orderId = orderId;
    query.description = description;
    checkDuplicate = true;
  }

  if (checkDuplicate) {
    const existingTx = await WalletTransaction.findOne(query);
    if (existingTx) {
      const walletData = await getWalletData(userId);
      return { walletBalance: walletData.walletBalance, transaction: existingTx };
    }
  }

  const currentBalance = await calculateUserWalletBalance(userId);
  const newBalance = Math.round((currentBalance + numAmount) * 100) / 100;

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: { walletBalance: newBalance } },
    { returnDocument: 'after', runValidators: false }
  );

  if (!updatedUser) {
    throw new Error('User not found.');
  }

  const transaction = new WalletTransaction({
    user: userId,
    amount: numAmount,
    type: 'Credit',
    description: description || 'Wallet Credit',
    status: 'Success',
    runningBalance: newBalance,
    orderId: orderId || null,
    razorpayOrderId: razorpayOrderId || null,
    razorpayPaymentId: razorpayPaymentId || null,
    referenceId: referenceId || null,
  });
  await transaction.save();

  return { walletBalance: newBalance, transaction };
};

/**
 * Record a failed credit transaction (e.g. failed wallet top-up).
 * IMPORTANT: Does NOT mutate user's wallet balance.
 */
export const addFailedCredit = async (userId, amount, description, razorpayOrderId = null, razorpayPaymentId = null) => {
  const numAmount = parseFloat(amount);
  if (!amount || isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Invalid credit amount.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  if (razorpayPaymentId || razorpayOrderId) {
    const query = { user: userId };
    if (razorpayPaymentId) query.razorpayPaymentId = razorpayPaymentId;
    else if (razorpayOrderId) query.razorpayOrderId = razorpayOrderId;

    const existingTx = await WalletTransaction.findOne(query);
    if (existingTx) {
      const walletData = await getWalletData(userId);
      return { walletBalance: walletData.walletBalance, transaction: existingTx };
    }
  }

  const currentBalance = await calculateUserWalletBalance(userId);

  const transaction = new WalletTransaction({
    user: userId,
    amount: numAmount,
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
  const numAmount = parseFloat(amount);
  if (!amount || isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Invalid debit amount.');
  }

  const currentBalance = await calculateUserWalletBalance(userId);
  if (currentBalance < numAmount) {
    throw new Error(`Insufficient wallet balance (Available: ₹${currentBalance}, Required: ₹${numAmount}).`);
  }

  const newBalance = Math.round((currentBalance - numAmount) * 100) / 100;

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: { walletBalance: newBalance } },
    { returnDocument: 'after', runValidators: false }
  );

  if (!updatedUser) {
    throw new Error('User not found.');
  }

  const transaction = new WalletTransaction({
    user: userId,
    amount: numAmount,
    type: 'Debit',
    description: description || 'Wallet Debit',
    status: 'Success',
    runningBalance: newBalance,
    orderId: orderId || null
  });
  await transaction.save();

  return { walletBalance: newBalance, transaction };
};
