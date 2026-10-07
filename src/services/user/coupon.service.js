import Coupon from '../../models/couponModel.js';
import Order from '../../models/orderModel.js';

export const getAvailableCoupons = async (userId = null, cartSubtotal = null) => {
  try {
    const now = new Date();
    const dbCoupons = await Coupon.find({
      status: 'Active',
      isDeleted: { $ne: true },
      expiryDate: { $gt: now },
      $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }]
    }).sort({ minPurchase: 1 }).lean();

    if (!dbCoupons || dbCoupons.length === 0) {
      return [];
    }

    const availableCoupons = [];
    for (const c of dbCoupons) {
      const userLimit = c.userUsageLimit || 1;
      let isEligible = true;
      let ineligibilityReason = '';

      if (userId) {
        const usedCount = await Order.countDocuments({
          user: userId,
          couponCode: c.code,
          paymentStatus: { $ne: 'Failed' },
          status: { $nin: ['Payment Failed'] }
        });
        if (usedCount >= userLimit) {
          isEligible = false;
          ineligibilityReason = 'Usage limit reached';
        }
      }

      if (cartSubtotal !== null && cartSubtotal !== undefined) {
        if (c.minPurchase && cartSubtotal < c.minPurchase) {
          isEligible = false;
          ineligibilityReason = `Min purchase ₹${c.minPurchase} required`;
        }
      }

      availableCoupons.push({
        code: c.code,
        type: c.type,
        discountValue: c.discountValue,
        minPurchase: c.minPurchase || 0,
        maxDiscount: c.maxDiscount,
        userUsageLimit: userLimit,
        isEligible,
        ineligibilityReason,
        description: c.description || (c.type === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `Flat ₹${c.discountValue} OFF`)
      });
    }

    return availableCoupons;
  } catch (err) {
    console.warn('Coupon database query error:', err.message);
  }

  return [];
};

export const calculateCouponDiscount = async (couponCode, subtotal, userId = null) => {
  if (!couponCode || !couponCode.trim()) {
    return { discount: 0, coupon: null };
  }

  const code = couponCode.trim().toUpperCase();
  const now = new Date();

  const dbCoupon = await Coupon.findOne({ code });
  if (!dbCoupon) {
    throw new Error(`Coupon code "${code}" is invalid or does not exist.`);
  }

  if (dbCoupon.status !== 'Active') {
    throw new Error(`Coupon code "${code}" is inactive.`);
  }
  if (dbCoupon.startDate && new Date(dbCoupon.startDate) > now) {
    throw new Error(`Coupon code "${code}" is not active yet.`);
  }
  if (dbCoupon.expiryDate && new Date(dbCoupon.expiryDate) <= now) {
    throw new Error(`Coupon code "${code}" has expired.`);
  }

  if (userId) {
    const userLimit = dbCoupon.userUsageLimit || 1;
    const usedCount = await Order.countDocuments({
      user: userId,
      couponCode: dbCoupon.code,
      paymentStatus: { $ne: 'Failed' },
      status: { $nin: ['Payment Failed'] }
    });
    if (usedCount >= userLimit) {
      throw new Error(`You have reached the maximum allowed usage limit for coupon "${dbCoupon.code}".`);
    }
  }

  const coupon = {
    code: dbCoupon.code,
    type: dbCoupon.type,
    discountValue: dbCoupon.discountValue,
    minPurchase: dbCoupon.minPurchase || 0,
    maxDiscount: dbCoupon.maxDiscount,
    userUsageLimit: dbCoupon.userUsageLimit || 1
  };

  if (coupon.minPurchase && subtotal < coupon.minPurchase) {
    throw new Error(`Minimum purchase of ₹${coupon.minPurchase} required for code ${coupon.code}.`);
  }

  let discount = 0;
  if (coupon.type === 'PERCENTAGE') {
    discount = Math.round(subtotal * (coupon.discountValue / 100));
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else if (coupon.type === 'FIXED') {
    discount = Math.min(coupon.discountValue, subtotal);
  }

  discount = Math.max(0, Math.min(discount, subtotal));

  return { discount, coupon };
};
