import Coupon from '../../models/couponModel.js';

/**
 * Get all coupons for Admin panel.
 */
export const getAllCoupons = async () => {
  return await Coupon.find().sort({ createdAt: -1 });
};

/**
 * Create a new coupon with strict backend validation.
 */
export const createCoupon = async (couponData) => {
  const { code, type, discountValue, minPurchase, maxDiscount, startDate, expiryDate, description, userUsageLimit } = couponData;

  if (!code || !code.trim()) {
    throw new Error('Coupon code is required.');
  }

  const cleanCode = code.trim().toUpperCase();

  // 1. Prevent duplicate coupon codes
  const existingCoupon = await Coupon.findOne({ code: cleanCode });
  if (existingCoupon) {
    throw new Error(`Coupon code "${cleanCode}" already exists.`);
  }

  if (!['PERCENTAGE', 'FIXED'].includes(type)) {
    throw new Error('Coupon type must be PERCENTAGE or FIXED.');
  }

  const discount = Number(discountValue);
  if (type === 'PERCENTAGE') {
    if (isNaN(discount) || !Number.isInteger(discount) || discount < 1 || discount > 75) {
      throw new Error('Percentage discount must be a whole number between 1% and 75%.');
    }
  } else if (type === 'FIXED') {
    if (isNaN(discount) || discount < 1) {
      throw new Error('Fixed price discount must be at least ₹1.');
    }
  }

  const minAmt = Number(minPurchase) || 0;
  if (minAmt < 0) {
    throw new Error('Minimum purchase amount cannot be negative.');
  }

  const maxCap = maxDiscount ? Number(maxDiscount) : null;
  if (maxCap !== null && maxCap < 0) {
    throw new Error('Maximum discount cap cannot be negative.');
  }

  const limitPerUser = userUsageLimit ? Number(userUsageLimit) : 1;
  if (isNaN(limitPerUser) || !Number.isInteger(limitPerUser) || limitPerUser < 1) {
    throw new Error('Per-user usage limit must be a positive whole number (at least 1).');
  }

  const start = startDate ? new Date(startDate) : new Date();
  const expiry = new Date(expiryDate);

  if (!expiryDate || isNaN(expiry.getTime())) {
    throw new Error('Expiry Date is required.');
  }

  // Prevent creating coupon that is not in the future
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (expiry <= todayEnd) {
    throw new Error('Expiry Date must be a future date.');
  }

  if (expiry <= start) {
    throw new Error('Expiry date must be after start date.');
  }

  const coupon = new Coupon({
    code: cleanCode,
    type,
    discountValue: discount,
    minPurchase: minAmt,
    maxDiscount: maxCap,
    startDate: start,
    expiryDate: expiry,
    description: description ? description.trim() : '',
    userUsageLimit: limitPerUser,
    status: 'Active'
  });

  await coupon.save();
  return coupon;
};

/**
 * Update an existing coupon with strict backend validation.
 */
export const updateCoupon = async (couponId, couponData) => {
  const { code, type, discountValue, minPurchase, maxDiscount, startDate, expiryDate, description, userUsageLimit } = couponData;

  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    throw new Error('Coupon not found.');
  }

  if (!code || !code.trim()) {
    throw new Error('Coupon code is required.');
  }

  const cleanCode = code.trim().toUpperCase();

  // Prevent duplicate coupon codes for OTHER coupons
  const existingCoupon = await Coupon.findOne({ code: cleanCode, _id: { $ne: couponId } });
  if (existingCoupon) {
    throw new Error(`Coupon code "${cleanCode}" already exists.`);
  }

  if (!['PERCENTAGE', 'FIXED'].includes(type)) {
    throw new Error('Coupon type must be PERCENTAGE or FIXED.');
  }

  const discount = Number(discountValue);
  if (type === 'PERCENTAGE') {
    if (isNaN(discount) || !Number.isInteger(discount) || discount < 1 || discount > 75) {
      throw new Error('Percentage discount must be a whole number between 1% and 75%.');
    }
  } else if (type === 'FIXED') {
    if (isNaN(discount) || discount < 1) {
      throw new Error('Fixed price discount must be at least ₹1.');
    }
  }

  const minAmt = Number(minPurchase) || 0;
  if (minAmt < 0) {
    throw new Error('Minimum purchase amount cannot be negative.');
  }

  const maxCap = maxDiscount ? Number(maxDiscount) : null;
  if (maxCap !== null && maxCap < 0) {
    throw new Error('Maximum discount cap cannot be negative.');
  }

  const limitPerUser = userUsageLimit ? Number(userUsageLimit) : 1;
  if (isNaN(limitPerUser) || !Number.isInteger(limitPerUser) || limitPerUser < 1) {
    throw new Error('Per-user usage limit must be a positive whole number (at least 1).');
  }

  const start = startDate ? new Date(startDate) : (coupon.startDate || new Date());
  const expiry = new Date(expiryDate);

  if (!expiryDate || isNaN(expiry.getTime())) {
    throw new Error('Expiry Date is required.');
  }

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (expiry <= todayEnd) {
    throw new Error('Expiry Date must be a future date.');
  }

  if (expiry <= start) {
    throw new Error('Expiry date must be after start date.');
  }

  coupon.code = cleanCode;
  coupon.type = type;
  coupon.discountValue = discount;
  coupon.minPurchase = minAmt;
  coupon.maxDiscount = maxCap;
  coupon.startDate = start;
  coupon.expiryDate = expiry;
  coupon.description = description ? description.trim() : '';
  coupon.userUsageLimit = limitPerUser;

  await coupon.save();
  return coupon;
};

/**
 * Toggle coupon active/inactive status.
 */
export const toggleCouponStatus = async (couponId) => {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    throw new Error('Coupon not found.');
  }

  coupon.status = coupon.status === 'Active' ? 'Inactive' : 'Active';
  await coupon.save();
  return coupon;
};

/**
 * Delete a coupon.
 */
export const deleteCoupon = async (couponId) => {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    throw new Error('Coupon not found.');
  }

  await Coupon.deleteOne({ _id: couponId });
  return { success: true };
};
