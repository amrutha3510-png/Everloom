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
  const { code, type, discountValue, minPurchase, maxDiscount, startDate, expiryDate, description } = couponData;

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
  if (isNaN(discount) || discount <= 0) {
    throw new Error('Discount value must be greater than 0.');
  }

  if (type === 'PERCENTAGE' && discount > 90) {
    throw new Error('Percentage discount cannot exceed 90%.');
  }

  const minAmt = Number(minPurchase) || 0;
  if (minAmt < 0) {
    throw new Error('Minimum purchase amount cannot be negative.');
  }

  const maxCap = maxDiscount ? Number(maxDiscount) : null;
  if (maxCap !== null && maxCap < 0) {
    throw new Error('Maximum discount cap cannot be negative.');
  }

  const start = startDate ? new Date(startDate) : new Date();
  const expiry = new Date(expiryDate);

  if (isNaN(expiry.getTime())) {
    throw new Error('Valid expiry date is required.');
  }

  // Prevent creating coupon that is already expired
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (expiry < now) {
    throw new Error('Expiry date cannot be in the past.');
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
    status: 'Active'
  });

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
