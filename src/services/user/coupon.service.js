import Coupon from '../../models/couponModel.js';

export const DEFAULT_COUPONS = [
  {
    code: 'EXTRA10',
    type: 'PERCENTAGE',
    discountValue: 10,
    minPurchase: 500,
    description: '10% OFF on orders above ₹500'
  },
  {
    code: 'EVERLOOM200',
    type: 'FIXED',
    discountValue: 200,
    minPurchase: 1500,
    description: 'Flat ₹200 OFF on orders above ₹1,500'
  },
  {
    code: 'WELCOME15',
    type: 'PERCENTAGE',
    discountValue: 15,
    minPurchase: 2000,
    description: '15% OFF on orders above ₹2,000'
  },
  {
    code: 'SAVEMORE',
    type: 'FIXED',
    discountValue: 500,
    minPurchase: 3500,
    description: 'Flat ₹500 OFF on orders above ₹3,500'
  }
];

export const getAvailableCoupons = async () => {
  try {
    const now = new Date();
    const dbCoupons = await Coupon.find({
      status: 'Active',
      startDate: { $lte: now },
      expiryDate: { $gte: now }
    }).sort({ minPurchase: 1 });

    if (dbCoupons && dbCoupons.length > 0) {
      return dbCoupons.map(c => ({
        code: c.code,
        type: c.type,
        discountValue: c.discountValue,
        minPurchase: c.minPurchase,
        maxDiscount: c.maxDiscount,
        description: c.description || (c.type === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `Flat ₹${c.discountValue} OFF`)
      }));
    }
  } catch (err) {
    console.warn('Coupon database query error, using default coupons:', err.message);
  }

  return DEFAULT_COUPONS;
};

export const calculateCouponDiscount = async (couponCode, subtotal) => {
  if (!couponCode || !couponCode.trim()) {
    return { discount: 0, coupon: null };
  }

  const code = couponCode.trim().toUpperCase();
  const now = new Date();
  let coupon = null;

  try {
    const dbCoupon = await Coupon.findOne({ code });
    if (dbCoupon) {
      if (dbCoupon.status !== 'Active') {
        throw new Error(`Coupon code "${code}" is inactive.`);
      }
      if (dbCoupon.startDate && new Date(dbCoupon.startDate) > now) {
        throw new Error(`Coupon code "${code}" is not active yet.`);
      }
      if (dbCoupon.expiryDate && new Date(dbCoupon.expiryDate) < now) {
        throw new Error(`Coupon code "${code}" has expired.`);
      }
      coupon = {
        code: dbCoupon.code,
        type: dbCoupon.type,
        discountValue: dbCoupon.discountValue,
        minPurchase: dbCoupon.minPurchase || 0,
        maxDiscount: dbCoupon.maxDiscount
      };
    }
  } catch (err) {
    throw err;
  }

  if (!coupon) {
    const defaultMatch = DEFAULT_COUPONS.find(c => c.code === code);
    if (defaultMatch) {
      coupon = defaultMatch;
    }
  }

  if (!coupon) {
    throw new Error('Invalid promo code.');
  }

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
