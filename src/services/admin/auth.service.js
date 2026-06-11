import bcrypt from 'bcryptjs';
import User from '../../models/userModel.js';

/**
 * Validates an admin login attempt.
 * @param {string} email
 * @param {string} password
 * @returns {Object} { success, admin, message }
 */
export const validateAdminLogin = async (email, password) => {
  const adminUser = await User.findOne({ email });

  if (!adminUser) {
    return { success: false, message: 'Invalid credentials or unauthorized access.' };
  }

  // Ensure the user has the 'admin' role
  if (adminUser.role !== 'admin') {
    return { success: false, message: 'Invalid credentials or unauthorized access.' };
  }

  // Compare passwords
  const isMatch = await bcrypt.compare(password, adminUser.password);
  if (!isMatch) {
    return { success: false, message: 'Invalid credentials or unauthorized access.' };
  }

  return { success: true, admin: adminUser };
};
