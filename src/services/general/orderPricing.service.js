/**
 * Single source of truth for Order Pricing calculation in EVERLOOM.
 * Computes original totals, cancelled deductions, current active subtotal, shipping, and current total.
 * Ensures User Order Details and Admin Order Details display 100% identical numbers.
 */
export const calculateOrderPricing = (order) => {
  if (!order) return order;

  // Convert to plain JS object if Mongoose Document
  const rawOrder = (typeof order.toObject === 'function') ? order.toObject({ virtuals: true }) : { ...order };

  const items = rawOrder.items || [];

  // Synchronize item status with overall order status if individual item status is unset or Pending
  items.forEach(item => {
    if (item.status !== 'Cancelled' && item.status !== 'Returned') {
      if (['Delivered', 'Shipped', 'Out for Delivery', 'Returned', 'Return Requested', 'Cancelled'].includes(rawOrder.status)) {
        if (!item.status || item.status === 'Pending') {
          item.status = rawOrder.status;
        }
      }
    }
  });

  const initialSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalCouponDiscount = rawOrder.discountAmount || 0;
  const shippingCharge = (typeof rawOrder.shippingCharge !== 'undefined' && rawOrder.shippingCharge !== null) ? rawOrder.shippingCharge : 49;
  const originalTotal = rawOrder.totalAmount || Math.max(0, initialSubtotal - totalCouponDiscount + shippingCharge);

  // Fallback proportional allocation for legacy items without stored allocatedCouponDiscount
  let allocatedSum = 0;
  items.forEach((item, index) => {
    if (typeof item.allocatedCouponDiscount === 'undefined' || item.allocatedCouponDiscount === null) {
      const itemTotal = item.price * item.quantity;
      if (index === items.length - 1) {
        item.allocatedCouponDiscount = Math.max(0, totalCouponDiscount - allocatedSum);
      } else {
        const share = initialSubtotal > 0 ? Math.round((totalCouponDiscount * itemTotal) / initialSubtotal) : 0;
        item.allocatedCouponDiscount = share;
        allocatedSum += share;
      }
    }
  });

  const activeItems = items.filter(item => item.status !== 'Cancelled' && item.status !== 'Returned');
  const cancelledItems = items.filter(item => item.status === 'Cancelled' || item.status === 'Returned');

  const currentSubtotal = activeItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const activeCouponDiscount = activeItems.reduce((sum, item) => {
    return sum + (item.allocatedCouponDiscount || 0);
  }, 0);

  const activeItemsNetSubtotal = Math.max(0, currentSubtotal - activeCouponDiscount);

  const cancelledItemsDeduction = cancelledItems.reduce((sum, item) => {
    if (item.refundAmount && item.refundAmount > 0) {
      return sum + item.refundAmount;
    }
    const itemTotal = item.price * item.quantity;
    const itemAllocatedDisc = item.allocatedCouponDiscount || 0;
    return sum + Math.max(0, itemTotal - itemAllocatedDisc);
  }, 0);

  const isFullyCancelled = (activeItems.length === 0 || rawOrder.status === 'Cancelled' || rawOrder.status === 'Returned');
  const currentTotal = isFullyCancelled ? 0 : Math.max(0, activeItemsNetSubtotal + shippingCharge);

  const itemDetailsMap = {};
  items.forEach(item => {
    const itemTotal = item.price * item.quantity;
    const allocatedCouponDiscount = item.allocatedCouponDiscount || 0;
    const effectiveAmount = Math.max(0, itemTotal - allocatedCouponDiscount);
    const isEligibleForRefund = (rawOrder.paymentMethod === 'Razorpay' || rawOrder.paymentMethod === 'WALLET' || rawOrder.paymentStatus === 'Paid');
    itemDetailsMap[item._id ? item._id.toString() : ''] = {
      itemTotal,
      allocatedCouponDiscount,
      effectiveAmount,
      refundAmount: item.refundAmount || (isEligibleForRefund ? effectiveAmount : 0)
    };
  });



  rawOrder.pricing = {
    initialSubtotal,
    totalCouponDiscount,
    shippingCharge,
    originalTotal,
    currentSubtotal,
    activeCouponDiscount,
    activeItemsNetSubtotal,
    cancelledItemsDeduction,
    isFullyCancelled,
    currentTotal,
    itemDetailsMap
  };

  return rawOrder;
};
