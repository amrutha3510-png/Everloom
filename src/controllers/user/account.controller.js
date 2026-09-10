import {
  getProfile,
  updateProfile,
  updateProfileImage,
  removeProfileImage,
  requestEmailChange,
  verifyEmailChange,
  resendEmailChangeOtp,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  changePassword,
} from '../../services/user/account.service.js';
import { getRemainingSeconds } from '../../services/general/otp.service.js';
import { getWalletData, addCredit, addFailedCredit } from '../../services/user/wallet.service.js';
import { getReferralData } from '../../services/user/referral.service.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const getRazorpayInstance = () => {
  const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing in environment configuration.');
  }

  return new Razorpay({ key_id, key_secret });
};

const PHONE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const PINCODE_REGEX = /^\d{6}$/;
const NAME_REGEX = /^[a-zA-Z\s]+$/;

// ── Render ────────────────────────────────────

export const getProfilePage = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await getProfile(userId);
    let remainingSeconds = 0;
    if (user.pendingEmail) {
      remainingSeconds = await getRemainingSeconds(user.pendingEmail, 'email-change');
    }
    res.render('user/account/profile', {
      title: 'My Profile',
      layout: 'layouts/user-layout',
      user,
      accountPage: 'profile',
      remainingSeconds,
    });
  } catch (err) {
    console.error('getProfilePage:', err);
    res.status(500).send('Internal Server Error');
  }
};

export const getAddressesPage = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const addresses = await getAddresses(userId);
    res.render('user/account/addresses', {
      title: 'Saved Addresses',
      layout: 'layouts/user-layout',
      addresses,
      accountPage: 'addresses',
    });
  } catch (err) {
    console.error('getAddressesPage:', err);
    res.status(500).send('Internal Server Error');
  }
};

export const getSecurityPage = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await getProfile(userId);
    const isGoogleOnly = !!user.googleId && !user.password;
    res.render('user/account/security', {
      title: 'Security Settings',
      layout: 'layouts/user-layout',
      user,
      isGoogleOnly,
      accountPage: 'security',
    });
  } catch (err) {
    console.error('getSecurityPage:', err);
    res.status(500).send('Internal Server Error');
  }
};

export const getWalletPage = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const walletData = await getWalletData(userId);
    res.render('user/account/wallet', {
      title: 'EverLoom Wallet',
      layout: 'layouts/user-layout',
      walletBalance: walletData.walletBalance,
      transactions: walletData.transactions,
      accountPage: 'wallet',
      user: req.session.user
    });
  } catch (err) {
    console.error('getWalletPage:', err);
    res.status(500).send('Internal Server Error');
  }
};

export const getReferralsPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      req.session.toast = { type: 'error', message: 'Please login to view referrals' };
      return res.redirect('/login');
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    const referralData = await getReferralData(userId, baseUrl);

    res.render('user/account/referrals', {
      title: 'Refer & Earn',
      layout: 'layouts/user-layout',
      accountPage: 'referrals',
      referralCode: referralData.referralCode,
      referralLink: referralData.referralLink,
      totalReferrals: referralData.totalReferrals,
      totalEarned: referralData.totalEarned,
      history: referralData.history,
      user: req.session.user
    });
  } catch (error) {
    console.error('getReferralsPage error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ── Profile API ───────────────────────────────

export const updateProfileHandler = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { fullName, phone, dob } = req.body;

    if (!fullName || !fullName.trim())
      return res.status(400).json({ success: false, field: 'fullName', message: 'Full name is required.' });
    if (fullName.trim().length < 3)
      return res.status(400).json({ success: false, field: 'fullName', message: 'Full name must be at least 3 characters.' });
    if (phone && phone.trim() && !PHONE_REGEX.test(phone.trim()))
      return res.status(400).json({ success: false, field: 'phone', message: 'Enter a valid 10-digit mobile number.' });
    if (dob) {
      const dobDate = new Date(`${dob}T00:00:00Z`);
      const limitDate = new Date();
      limitDate.setUTCDate(limitDate.getUTCDate() + 1);
      limitDate.setUTCHours(23, 59, 59, 999);
      if (dobDate > limitDate) {
        return res.status(400).json({ success: false, field: 'dob', message: 'Date of birth cannot be in the future.' });
      }
    }

    const updatedUser = await updateProfile(userId, { fullName, phone, dob });

    return res.json({ success: true, message: 'Profile updated successfully.', user: updatedUser });
  } catch (err) {
    console.error('updateProfileHandler:', err);
    return res.status(500).json({ success: false, message: err.message || 'An error occurred.' });
  }
};

export const updateProfileImageHandler = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    // Determine the image path to save in the database
    let imageUrl = req.file.path;
    let imagePublicId = req.file.filename;

    // If it's a local disk upload, store the public URL path
    if (req.file.destination) {
      imageUrl = `/uploads/profile-images/${req.file.filename}`;
    }

    const updatedUser = await updateProfileImage(userId, imageUrl, imagePublicId);

    return res.json({ success: true, message: 'Profile image updated.', imageUrl: updatedUser.profileImage });
  } catch (err) {
    console.error('updateProfileImageHandler:', err);
    return res.status(500).json({ success: false, message: err.message || 'Upload failed.' });
  }
};

export const deleteProfileImageHandler = async (req, res) => {
  try {
    const userId = req.session.user.id;
    await removeProfileImage(userId);
    return res.json({ success: true, message: 'Profile image removed.' });
  } catch (err) {
    console.error('deleteProfileImageHandler:', err);
    return res.status(500).json({ success: false, message: err.message || 'An error occurred.' });
  }
};

// ── Email change ──────────────────────────────

export const requestEmailChangeHandler = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { newEmail } = req.body;

    if (!newEmail || !EMAIL_REGEX.test(newEmail.trim()))
      return res.status(400).json({ success: false, field: 'email', message: 'Please enter a valid email address.' });

    await requestEmailChange(userId, newEmail);
    return res.json({ success: true, message: `Verification code sent to ${newEmail.trim()}.` });
  } catch (err) {
    console.error('requestEmailChangeHandler:', err);
    return res.status(400).json({ success: false, field: 'email', message: err.message || 'Failed to send OTP.' });
  }
};

export const verifyEmailChangeHandler = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { otp } = req.body;

    if (!otp || otp.trim().length !== 6)
      return res.status(400).json({ success: false, message: 'Please enter the 6-digit code.' });

    const result = await verifyEmailChange(userId, otp.trim());
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    // Update the session with the new email
    req.session.user.email = result.newEmail;
    return req.session.save(() =>
      res.json({ success: true, message: 'Email updated successfully.', newEmail: result.newEmail })
    );
  } catch (err) {
    console.error('verifyEmailChangeHandler system error:', err);
    return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
};

export const resendEmailChangeOtpHandler = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const result = await resendEmailChangeOtp(userId);
    return res.json({
      success: true,
      message: 'Verification code resent successfully.',
      remainingSeconds: result.remainingSeconds,
      email: result.email
    });
  } catch (err) {
    console.error('resendEmailChangeOtpHandler:', err);
    return res.status(400).json({ success: false, message: err.message || 'Failed to resend OTP.' });
  }
};


// ── Addresses API ─────────────────────────────

export const createAddressHandler = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country, isDefault, locality } = req.body;

    if (!fullName?.trim()) return res.status(400).json({ success: false, field: 'fullName', message: 'Full name is required.' });
    if (fullName.trim().length < 3) return res.status(400).json({ success: false, field: 'fullName', message: 'Full name must be at least 3 characters.' });
    if (!NAME_REGEX.test(fullName.trim())) return res.status(400).json({ success: false, field: 'fullName', message: 'Full name can only contain alphabets and spaces.' });
    if (!phone || !PHONE_REGEX.test(phone.trim())) return res.status(400).json({ success: false, field: 'phone', message: 'Valid 10-digit phone is required.' });
    if (!addressLine1?.trim()) return res.status(400).json({ success: false, field: 'addressLine1', message: 'Address line 1 is required.' });
    if (!pincode || !PINCODE_REGEX.test(pincode.trim())) return res.status(400).json({ success: false, field: 'pincode', message: 'Valid 6-digit pincode is required.' });
    if (!city?.trim()) return res.status(400).json({ success: false, field: 'city', message: 'City is required.' });
    if (!locality?.trim()) return res.status(400).json({ success: false, field: 'locality', message: 'Locality is required.' });
    if (!state?.trim()) return res.status(400).json({ success: false, field: 'state', message: 'State is required.' });

    const address = await addAddress(userId, {
      fullName: fullName.trim(),
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2 ? addressLine2.trim() : '',
      city: city.trim(),
      locality: locality.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country: country ? country.trim() : 'India',
      isDefault: isDefault === 'true' || isDefault === true,
    });
    return res.json({ success: true, message: 'Address added.', address });
  } catch (err) {
    console.error('createAddressHandler:', err);
    return res.status(400).json({ success: false, message: err.message || 'An error occurred.' });
  }
};

export const updateAddressHandler = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const addressId = req.params.id;
    const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country, isDefault, locality } = req.body;

    if (!fullName?.trim()) return res.status(400).json({ success: false, field: 'fullName', message: 'Full name is required.' });
    if (fullName.trim().length < 3) return res.status(400).json({ success: false, field: 'fullName', message: 'Full name must be at least 3 characters.' });
    if (!NAME_REGEX.test(fullName.trim())) return res.status(400).json({ success: false, field: 'fullName', message: 'Full name can only contain alphabets and spaces.' });
    if (!phone || !PHONE_REGEX.test(phone.trim())) return res.status(400).json({ success: false, field: 'phone', message: 'Valid 10-digit phone is required.' });
    if (!addressLine1?.trim()) return res.status(400).json({ success: false, field: 'addressLine1', message: 'Address line 1 is required.' });
    if (!pincode || !PINCODE_REGEX.test(pincode.trim())) return res.status(400).json({ success: false, field: 'pincode', message: 'Valid 6-digit pincode is required.' });
    if (!city?.trim()) return res.status(400).json({ success: false, field: 'city', message: 'City is required.' });
    if (!locality?.trim()) return res.status(400).json({ success: false, field: 'locality', message: 'Locality is required.' });
    if (!state?.trim()) return res.status(400).json({ success: false, field: 'state', message: 'State is required.' });

    const address = await updateAddress(addressId, userId, {
      fullName: fullName.trim(),
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2 ? addressLine2.trim() : '',
      city: city.trim(),
      locality: locality.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country: country ? country.trim() : 'India',
      isDefault: isDefault === 'true' || isDefault === true,
    });
    return res.json({ success: true, message: 'Address updated.', address });
  } catch (err) {
    console.error('updateAddressHandler:', err);
    return res.status(400).json({ success: false, message: err.message || 'An error occurred.' });
  }
};

export const deleteAddressHandler = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user.id;
    await deleteAddress(addressId, userId);
    return res.json({ success: true, message: 'Address deleted.' });
  } catch (err) {
    console.error('deleteAddressHandler:', err);
    return res.status(500).json({ success: false, message: err.message || 'An error occurred.' });
  }
};

export const setDefaultAddressHandler = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user.id;
    await setDefaultAddress(addressId, userId);
    return res.json({ success: true, message: 'Default address updated.' });
  } catch (err) {
    console.error('setDefaultAddressHandler:', err);
    return res.status(500).json({ success: false, message: err.message || 'An error occurred.' });
  }
};

// ── Security API ──────────────────────────────

export const updatePasswordHandler = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!newPassword)
      return res.status(400).json({ success: false, field: 'newPassword', message: 'New password is required.' });
    if (!PASSWORD_REGEX.test(newPassword))
      return res.status(400).json({ success: false, field: 'newPassword', message: 'Min 8 chars with uppercase, number and symbol.' });
    if (currentPassword && newPassword === currentPassword)
      return res.status(400).json({ success: false, field: 'newPassword', message: 'New password cannot be the same as the current password.' });
    if (newPassword !== confirmNewPassword)
      return res.status(400).json({ success: false, field: 'confirmNewPassword', message: 'Passwords do not match.' });

    const userId = req.session.user.id;
    await changePassword(userId, currentPassword, newPassword);
    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('updatePasswordHandler:', err);
    return res.status(400).json({ success: false, message: err.message || 'An error occurred.' });
  }
};

// ── Wallet Top-Up API ──────────────────────────

/**
 * Create Razorpay Order for Wallet Top-up.
 */
export const createWalletTopupOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to add money to wallet.' });
    }

    const { amount } = req.body;
    const numAmount = parseFloat(amount);

    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, field: 'amount', message: 'Please enter a valid amount greater than 0.' });
    }

    const amountInPaise = Math.round(numAmount * 100);
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `topup_${Date.now()}_${userId.slice(-4)}`
    };

    const razorpayInstance = getRazorpayInstance();
    const razorpayOrder = await razorpayInstance.orders.create(options);
    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();

    return res.status(200).json({
      success: true,
      keyId,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency
    });
  } catch (error) {
    console.error('createWalletTopupOrder error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to initiate Razorpay top-up.' });
  }
};

/**
 * Verify Razorpay Payment and Credit Money to Wallet.
 */
export const verifyWalletTopupPayment = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to add money to wallet.' });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment response payload.' });
    }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid top-up amount.' });
    }

    // HMAC signature verification
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      // Log failed credit transaction without increasing balance
      await addFailedCredit(userId, numAmount, 'Wallet Top-up', razorpay_order_id, razorpay_payment_id);
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    // Credit money ONLY after successful payment confirmation
    const result = await addCredit(
      userId,
      numAmount,
      'Wallet Top-up',
      null,
      razorpay_order_id,
      razorpay_payment_id
    );

    return res.status(200).json({
      success: true,
      message: `₹${numAmount.toLocaleString('en-IN')} added to your wallet successfully!`,
      walletBalance: result.walletBalance
    });
  } catch (error) {
    console.error('verifyWalletTopupPayment error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to verify wallet top-up payment.' });
  }
};

/**
 * Log Failed Wallet Top-up Transaction.
 */
export const logFailedWalletTopup = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to add money to wallet.' });
    }

    const { razorpay_payment_id, razorpay_order_id, amount } = req.body;
    const numAmount = parseFloat(amount);

    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid top-up amount.' });
    }

    await addFailedCredit(
      userId,
      numAmount,
      'Wallet Top-up',
      razorpay_order_id || null,
      razorpay_payment_id || null
    );

    return res.status(200).json({
      success: true,
      message: 'Failed payment logged to transaction history.'
    });
  } catch (error) {
    console.error('logFailedWalletTopup error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to log transaction.' });
  }
};



