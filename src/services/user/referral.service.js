import User from '../../models/userModel.js';
import Referral from '../../models/referralModel.js';
import * as walletService from './wallet.service.js';

/**
 * Generate a unique referral code (e.g., EVLA8B9C2).
 */
export const generateUniqueReferralCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let exists = true;
  
  while (exists) {
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `EVL${randomPart}`;
    const userDoc = await User.exists({ referralCode: code });
    if (!userDoc) {
      exists = false;
    }
  }
  return code;
};

/**
 * Ensure user has a unique referral code generated.
 */
export const ensureUserReferralCode = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  if (!user.referralCode) {
    user.referralCode = await generateUniqueReferralCode();
    await user.save();
  }
  return user.referralCode;
};

/**
 * Validate a referral code.
 */
export const validateReferralCode = async (code, currentUserId = null) => {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return { isValid: false, message: 'Please enter a valid referral code.' };
  }

  const cleanCode = code.trim();
  const referrer = await User.findOne({ referralCode: cleanCode });

  if (!referrer) {
    return { isValid: false, message: 'Invalid referral code.' };
  }

  if (currentUserId && referrer._id.toString() === currentUserId.toString()) {
    return { isValid: false, message: 'You cannot use your own referral code.' };
  }

  return { isValid: true, referrer };
};

/**
 * Process referral reward when a referred user successfully verifies registration.
 * Referrer receives ₹200 (Description: 'Referral Reward')
 * Referred User receives ₹100 (Description: 'Referral Bonus')
 */
export const processReferralOnRegistration = async (newUserDoc, referralCodeInput) => {
  if (!referralCodeInput || typeof referralCodeInput !== 'string' || !referralCodeInput.trim()) {
    return null;
  }

  const cleanCode = referralCodeInput.trim();
  const referrer = await User.findOne({ referralCode: cleanCode });

  if (!referrer) {
    return null;
  }

  // Prevent self-referral
  if (referrer._id.toString() === newUserDoc._id.toString()) {
    return null;
  }

  // Prevent duplicate referral relationship for the same referred user
  const existingReferral = await Referral.findOne({ referredUser: newUserDoc._id });
  if (existingReferral) {
    return existingReferral;
  }

  // Link referredBy on the new user doc
  newUserDoc.referredBy = referrer._id;
  await newUserDoc.save();

  const referrerRewardAmount = 200; // Referrer receives ₹200
  const refereeBonusAmount = 100;   // Referred User receives ₹100

  // Create referral record for referrer
  const referral = new Referral({
    referrer: referrer._id,
    referredUser: newUserDoc._id,
    referralCode: cleanCode,
    status: 'Completed',
    rewardAmount: referrerRewardAmount,
    isRewarded: true,
  });
  await referral.save();

  // 1. Credit ₹200 reward to Referrer's wallet
  await walletService.addCredit(
    referrer._id,
    referrerRewardAmount,
    'Referral Reward'
  );

  // 2. Credit ₹100 bonus to New User's wallet
  await walletService.addCredit(
    newUserDoc._id,
    refereeBonusAmount,
    'Referral Bonus'
  );

  return referral;
};

/**
 * Fetch referral dashboard statistics and history for a user.
 */
export const getReferralData = async (userId, baseUrl = 'http://localhost:3000') => {
  const referralCode = await ensureUserReferralCode(userId);
  const referralLink = `${baseUrl}/signup?ref=${referralCode}`;

  const history = await Referral.find({ referrer: userId })
    .populate('referredUser', 'fullName email createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const totalReferrals = history.filter(r => r.status === 'Completed').length;
  const totalEarned = history.filter(r => r.isRewarded).reduce((sum, r) => sum + r.rewardAmount, 0);

  return {
    referralCode,
    referralLink,
    totalReferrals,
    totalEarned,
    history
  };
};
