import User from '../../models/userModel.js';
import { sendOtp, verifyOtp } from '../general/otp.service.js';
import bcrypt from 'bcryptjs';

/**
 * Saves user to the User collection with isVerified: false,
 * then triggers sendOtp({ email, purpose: 'register' }).
 */
export const registerUser = async (userData) => {
  const { fullName, email, password, referralCode } = userData;
  
  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
      if (existingUser.isVerified) {
          throw new Error('User already exists and is verified');
      }
      // If user exists but not verified, update details and resend OTP
      const salt = await bcrypt.genSalt(10);
      existingUser.password = await bcrypt.hash(password, salt);
      existingUser.fullName = fullName;
      if (referralCode) existingUser.referralCode = referralCode;
      await existingUser.save();
  } else {
      // Create new unverified user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await User.create({ fullName, email, password: hashedPassword, referralCode, isVerified: false });
  }

  // Trigger OTP sending
  await sendOtp({ email, purpose: 'register' });

  return { success: true, message: 'User registered, please verify OTP' };
};

/**
 * Calls verifyOtp. If successful, updates isVerified to true.
 */
export const verifyRegistration = async (email, otp) => {
  const verificationResult = await verifyOtp({ email, otp, purpose: 'register' });

  if (!verificationResult.ok) {
    return { success: false, message: 'Invalid or expired OTP' };
  }

  // Update user's isVerified status to true
  const user = await User.findOneAndUpdate(
    { email },
    { isVerified: true },
    { returnDocument: 'after' }
  );

  if (!user) {
    return { success: false, message: 'User not found' };
  }

  return { success: true, message: 'Registration verified successfully', user };
};

/**
 * Validates user credentials and checks if verified.
 */
export const validateUserLogin = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) {
    return { success: false, message: 'Invalid credentials' };
  }

  // Prevent admins from logging in as regular users
  if (user.role === 'admin') {
    return { success: false, message: 'Admin accounts cannot login via this portal. Please use the admin login.' };
  }

  if (!user.isVerified) {
    return { success: false, message: 'User is not verified. Please complete registration.' };
  }

  if (user.status === 'blocked') {
    return { success: false, message: 'Your account has been blocked. Please contact support.' };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return { success: false, message: 'Invalid credentials' };
  }

  return { success: true, user };
};



/**
 * Checks if the email exists & is verified, then sends an OTP for password reset.
 */
export const requestPasswordReset = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    return { success: false, message: 'No account found with that email.' };
  }
  if (!user.isVerified) {
    return { success: false, message: 'Account is not verified. Please complete registration first.' };
  }

  await sendOtp({ email, purpose: 'reset-password' });
  return { success: true, message: 'OTP sent to your email.' };
};

/**
 * Hashes the new password and updates the User document.
 */
export const resetPassword = async (email, newPassword) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  const user = await User.findOneAndUpdate(
    { email },
    { password: hashedPassword },
    { returnDocument: 'after' }
  );

  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  return { success: true, message: 'Password has been reset successfully.' };
};
