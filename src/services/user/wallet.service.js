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
export const addCredit = async (userId, amount, description) => {
  if (!amount || amount <= 0) {
    throw new Error('Invalid credit amount.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  const currentBalance = user.walletBalance || 0;
  const newBalance = currentBalance + amount;

  user.walletBalance = newBalance;
  await user.save();

  const transaction = new WalletTransaction({
    user: userId,
    amount,
    type: 'Credit',
    description: description || 'Wallet Credit',
    runningBalance: newBalance,
  });
  await transaction.save();

  return { walletBalance: newBalance, transaction };
};

/**
 * Debit money from user's wallet.
 */
export const deductDebit = async (userId, amount, description) => {
  if (!amount || amount <= 0) {
    throw new Error('Invalid debit amount.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  const currentBalance = user.walletBalance || 0;
  if (currentBalance < amount) {
    throw new Error('Insufficient wallet balance.');
  }

  const newBalance = currentBalance - amount;
  user.walletBalance = newBalance;
  await user.save();

  const transaction = new WalletTransaction({
    user: userId,
    amount,
    type: 'Debit',
    description: description || 'Wallet Debit',
    runningBalance: newBalance,
  });
  await transaction.save();

  return { walletBalance: newBalance, transaction };
};
