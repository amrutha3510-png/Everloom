import User from '../../models/userModel.js';
import Address from '../../models/addressModel.js';
import cloudinary from '../../configs/cloudinary.config.js';
import bcrypt from 'bcryptjs';
import { sendOtp, verifyOtp, resendOtp } from '../general/otp.service.js';
import fs from 'fs';
import path from 'path';

// ──────────────────────────────────────────────
// Profile
// ──────────────────────────────────────────────

export const getProfile = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found.');
  return user;
};

export const updateProfile = async (userId, { fullName, phone, dob }) => {
  const updates = {};
  if (fullName !== undefined) updates.fullName = fullName.trim();
  if (phone    !== undefined) updates.phone    = phone.trim();
  if (dob      !== undefined) updates.dob      = dob.trim();

  const user = await User.findByIdAndUpdate(userId, updates, { new: true }).lean();
  if (!user) throw new Error('User not found.');
  return user;
};

export const updateProfileImage = async (userId, imageUrl, imagePublicId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  // Clean up the old image
  if (user.profileImage) {
    if (user.profileImage.startsWith('/uploads/')) {
      const localPath = path.join(process.cwd(), 'public', user.profileImage);
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
        } catch (err) {
          console.error('Failed to delete old local profile image:', err);
        }
      }
    } else if (user.profileImageId) {
      try {
        await cloudinary.uploader.destroy(user.profileImageId);
      } catch (err) {
        console.error('Failed to delete old Cloudinary image:', err);
      }
    }
  }

  user.profileImage   = imageUrl;
  user.profileImageId = imagePublicId;
  await user.save();
  return user.toObject();
};

export const removeProfileImage = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  // Clean up the old image
  if (user.profileImage) {
    if (user.profileImage.startsWith('/uploads/')) {
      const localPath = path.join(process.cwd(), 'public', user.profileImage);
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
        } catch (err) {
          console.error('Failed to delete local profile image:', err);
        }
      }
    } else if (user.profileImageId) {
      try {
        await cloudinary.uploader.destroy(user.profileImageId);
      } catch (err) {
        console.error('Failed to delete Cloudinary profile image:', err);
      }
    }
  }

  user.profileImage   = undefined;
  user.profileImageId = undefined;
  await user.save();
  return user.toObject();
};

// ──────────────────────────────────────────────
// Email Change (OTP-based)
// ──────────────────────────────────────────────

/**
 * Validates new email availability, stores it as pendingEmail,
 * and dispatches an OTP to the NEW email address.
 */
export const requestEmailChange = async (userId, newEmail) => {
  const normalized = newEmail.trim().toLowerCase();

  // Ensure the new email is not already taken by another account
  const existing = await User.findOne({ email: normalized, _id: { $ne: userId } });
  if (existing) throw new Error('This email address is already associated with another account.');

  // Store pending email on the user document
  await User.findByIdAndUpdate(userId, { pendingEmail: normalized });

  // Send OTP to the NEW email address
  await sendOtp({ email: normalized, purpose: 'email-change' });

  return { success: true };
};

/**
 * Verifies the OTP sent to pendingEmail and, if correct,
 * promotes pendingEmail → email and clears the field.
 */
export const verifyEmailChange = async (userId, otp) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }
  if (!user.pendingEmail) {
    return { success: false, message: 'No email change request found. Please try again.' };
  }

  const result = await verifyOtp({ email: user.pendingEmail, otp, purpose: 'email-change' });
  if (!result.ok) {
    return { success: false, message: 'Invalid or expired OTP. Please request a new code.' };
  }

  const newEmail     = user.pendingEmail;
  user.email         = newEmail;
  user.pendingEmail  = undefined;
  await user.save();

  return { success: true, newEmail };
};

/**
 * Resends the OTP for a pending email change request.
 */
export const resendEmailChangeOtp = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.pendingEmail) {
    throw new Error('No pending email change request found.');
  }

  const seconds = await resendOtp(user.pendingEmail, 'email-change');
  return { success: true, remainingSeconds: seconds, email: user.pendingEmail };
};

// ──────────────────────────────────────────────
// Addresses
// ──────────────────────────────────────────────

export const getAddresses = async (userId) => {
  return Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 }).lean();
};

export const addAddress = async (userId, addressData) => {
  const count = await Address.countDocuments({ userId });
  if (count === 0) {
    addressData.isDefault = true;
  } else if (addressData.isDefault) {
    await Address.updateMany({ userId }, { isDefault: false });
  }
  const address = await Address.create({ ...addressData, userId });
  return address.toObject();
};

export const updateAddress = async (addressId, userId, addressData) => {
  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) throw new Error('Address not found.');

  if (addressData.isDefault) {
    await Address.updateMany({ userId, _id: { $ne: addressId } }, { isDefault: false });
  } else if (address.isDefault) {
    // If it was default and they tried to make it non-default, check if they have other addresses
    const count = await Address.countDocuments({ userId, _id: { $ne: addressId } });
    if (count === 0) {
      addressData.isDefault = true; // force keep default
    } else {
      // set another one as default
      const another = await Address.findOne({ userId, _id: { $ne: addressId } });
      if (another) {
        another.isDefault = true;
        await another.save();
      }
    }
  }

  Object.assign(address, addressData);
  await address.save();
  return address.toObject();
};

export const deleteAddress = async (addressId, userId) => {
  const address = await Address.findOneAndDelete({ _id: addressId, userId });
  if (!address) throw new Error('Address not found.');

  if (address.isDefault) {
    const another = await Address.findOne({ userId });
    if (another) {
      another.isDefault = true;
      await another.save();
    }
  }
  return { deleted: true };
};

/**
 * Sets one address as the default, clearing all others for that user.
 */
export const setDefaultAddress = async (addressId, userId) => {
  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) throw new Error('Address not found.');

  await Address.updateMany({ userId }, { isDefault: false });
  address.isDefault = true;
  await address.save();
  return address.toObject();
};

// ──────────────────────────────────────────────
// Password / Security
// ──────────────────────────────────────────────

export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  if (user.googleId) {
    throw new Error('Password management is disabled for Google accounts.');
  }

  if (!user.password) {
    throw new Error('No password is set on this account. Please set a password first.');
  }

  if (!currentPassword) throw new Error('Current password is required.');
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw new Error('Current password is incorrect.');

  if (newPassword === currentPassword) {
    throw new Error('New password cannot be the same as the current password.');
  }

  const salt     = await bcrypt.genSalt(10);
  user.password  = await bcrypt.hash(newPassword, salt);
  await user.save();

  return { success: true };
};
