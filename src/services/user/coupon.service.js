export const COUPONS = [
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
  return COUPONS;
};

export const calculateCouponDiscount = (couponCode, subtotal) => {
  if (!couponCode || !couponCode.trim()) {
    return { discount: 0, coupon: null };
  }

  const code = couponCode.trim().toUpperCase();
  const coupon = COUPONS.find(c => c.code === code);

  if (!coupon) {
    throw new Error('Invalid promo code.');
  }

  if (subtotal < coupon.minPurchase) {
    throw new Error(`Minimum purchase of ₹${coupon.minPurchase} required for code ${coupon.code}.`);
  }

  let discount = 0;
  if (coupon.type === 'PERCENTAGE') {
    discount = Math.round(subtotal * (coupon.discountValue / 100));
  } else if (coupon.type === 'FIXED') {
    discount = Math.min(coupon.discountValue, subtotal);
  }

  return { discount, coupon };
};
