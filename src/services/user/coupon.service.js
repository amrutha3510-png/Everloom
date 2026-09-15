import Coupon from '../../models/couponModel.js';

export const getAvailableCoupons = async () => {
  try {
    const now = new Date();
    const dbCoupons = await Coupon.find({
      status: 'Active',
      expiryDate: { $gt: now }
    }).sort({ minPurchase: 1 });

    if (dbCoupons && dbCoupons.length > 0) {
      return dbCoupons.map(c => ({
        code: c.code,
        type: c.type,
        discountValue: c.discountValue,
        minPurchase: c.minPurchase || 0,
        maxDiscount: c.maxDiscount,
        description: c.description || (c.type === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `Flat ₹${c.discountValue} OFF`)
      }));
    }
  } catch (err) {
    console.warn('Coupon database query error:', err.message);
  }

  return [];
};

export const calculateCouponDiscount = async (couponCode, subtotal) => {
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

  const coupon = {
    code: dbCoupon.code,
    type: dbCoupon.type,
    discountValue: dbCoupon.discountValue,
    minPurchase: dbCoupon.minPurchase || 0,
    maxDiscount: dbCoupon.maxDiscount
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
