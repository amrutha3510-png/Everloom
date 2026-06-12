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

const PHONE_REGEX   = /^[6-9]\d{9}$/;
const EMAIL_REGEX   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const PINCODE_REGEX  = /^\d{6}$/;
const NAME_REGEX     = /^[a-zA-Z\s]+$/;

// ── Render ────────────────────────────────────

export const getProfilePage = async (req, res) => {
  try {
    const user = await getProfile(req.session.user.id);
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
    const addresses = await getAddresses(req.session.user.id);
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
    const user       = await getProfile(req.session.user.id);
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

// ── Profile API ───────────────────────────────

export const updateProfileHandler = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { fullName, phone, dob } = req.body;

    if (!fullName || !fullName.trim())
      return res.status(400).json({ success: false, field: 'fullName', message: 'Full name is required.' });
    if (fullName.trim().length < 2)
      return res.status(400).json({ success: false, field: 'fullName', message: 'Full name must be at least 2 characters.' });
    if (phone && phone.trim() && !PHONE_REGEX.test(phone.trim()))
      return res.status(400).json({ success: false, field: 'phone', message: 'Enter a valid 10-digit mobile number.' });

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
    await removeProfileImage(req.session.user.id);
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

    if (!fullName?.trim())                         return res.status(400).json({ success: false, field: 'fullName',     message: 'Full name is required.' });
    if (!NAME_REGEX.test(fullName.trim()))         return res.status(400).json({ success: false, field: 'fullName',     message: 'Full name can only contain alphabets and spaces.' });
    if (!phone || !PHONE_REGEX.test(phone.trim())) return res.status(400).json({ success: false, field: 'phone',        message: 'Valid 10-digit phone is required.' });
    if (!addressLine1?.trim())                     return res.status(400).json({ success: false, field: 'addressLine1', message: 'Address line 1 is required.' });
    if (!pincode || !PINCODE_REGEX.test(pincode))  return res.status(400).json({ success: false, field: 'pincode',      message: 'Valid 6-digit pincode is required.' });
    if (!city?.trim())                             return res.status(400).json({ success: false, field: 'city',         message: 'City is required.' });
    if (!locality?.trim())                         return res.status(400).json({ success: false, field: 'locality',     message: 'Locality is required.' });
    if (!state?.trim())                            return res.status(400).json({ success: false, field: 'state',        message: 'State is required.' });

    const address = await addAddress(userId, {
      fullName:     fullName.trim(),
      phone:        phone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2 ? addressLine2.trim() : '',
      city:         city.trim(),
      locality:     locality.trim(),
      state:        state.trim(),
      pincode:      pincode.trim(),
      country:      country ? country.trim() : 'India',
      isDefault:    isDefault === 'true' || isDefault === true,
    });
    return res.json({ success: true, message: 'Address added.', address });
  } catch (err) {
    console.error('createAddressHandler:', err);
    return res.status(500).json({ success: false, message: err.message || 'An error occurred.' });
  }
};

export const updateAddressHandler = async (req, res) => {
  try {
    const userId    = req.session.user.id;
    const addressId = req.params.id;
    const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country, isDefault, locality } = req.body;

    if (!fullName?.trim())                         return res.status(400).json({ success: false, field: 'fullName',     message: 'Full name is required.' });
    if (!NAME_REGEX.test(fullName.trim()))         return res.status(400).json({ success: false, field: 'fullName',     message: 'Full name can only contain alphabets and spaces.' });
    if (!phone || !PHONE_REGEX.test(phone.trim())) return res.status(400).json({ success: false, field: 'phone',        message: 'Valid 10-digit phone is required.' });
    if (!addressLine1?.trim())                     return res.status(400).json({ success: false, field: 'addressLine1', message: 'Address line 1 is required.' });
    if (!pincode || !PINCODE_REGEX.test(pincode))  return res.status(400).json({ success: false, field: 'pincode',      message: 'Valid 6-digit pincode is required.' });
    if (!city?.trim())                             return res.status(400).json({ success: false, field: 'city',         message: 'City is required.' });
    if (!locality?.trim())                         return res.status(400).json({ success: false, field: 'locality',     message: 'Locality is required.' });
    if (!state?.trim())                            return res.status(400).json({ success: false, field: 'state',        message: 'State is required.' });

    const address = await updateAddress(addressId, userId, {
      fullName:     fullName.trim(),
      phone:        phone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2 ? addressLine2.trim() : '',
      city:         city.trim(),
      locality:     locality.trim(),
      state:        state.trim(),
      pincode:      pincode.trim(),
      country:      country ? country.trim() : 'India',
      isDefault:    isDefault === 'true' || isDefault === true,
    });
    return res.json({ success: true, message: 'Address updated.', address });
  } catch (err) {
    console.error('updateAddressHandler:', err);
    return res.status(500).json({ success: false, message: err.message || 'An error occurred.' });
  }
};

export const deleteAddressHandler = async (req, res) => {
  try {
    await deleteAddress(req.params.id, req.session.user.id);
    return res.json({ success: true, message: 'Address deleted.' });
  } catch (err) {
    console.error('deleteAddressHandler:', err);
    return res.status(500).json({ success: false, message: err.message || 'An error occurred.' });
  }
};

export const setDefaultAddressHandler = async (req, res) => {
  try {
    await setDefaultAddress(req.params.id, req.session.user.id);
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

    await changePassword(req.session.user.id, currentPassword, newPassword);
    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('updatePasswordHandler:', err);
    return res.status(400).json({ success: false, message: err.message || 'An error occurred.' });
  }
};


