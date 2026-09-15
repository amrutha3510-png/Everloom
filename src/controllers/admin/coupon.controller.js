import * as couponService from '../../services/admin/coupon.service.js';

/**
 * Render Coupon Management Page.
 */
export const getCouponPage = async (req, res) => {
  try {
    const coupons = await couponService.getAllCoupons();

    res.render('admin/coupons/index', {
      title: 'Coupon Management',
      layout: 'layouts/admin-layout',
      path: '/admin/coupons',
      coupons
    });
  } catch (error) {
    console.error('Error loading coupon page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load coupons page' };
    res.redirect('/admin/dashboard');
  }
};

/**
 * Create a new Coupon.
 */
export const createCoupon = async (req, res) => {
  try {
    const { code, type, discountValue, minPurchase, maxDiscount, startDate, expiryDate, description } = req.body;

    const coupon = await couponService.createCoupon({
      code,
      type,
      discountValue,
      minPurchase,
      maxDiscount,
      startDate,
      expiryDate,
      description
    });

    req.session.toast = { type: 'success', message: `Coupon "${coupon.code}" created successfully!` };
    return res.status(200).json({ success: true, message: `Coupon "${coupon.code}" created successfully!` });
  } catch (error) {
    console.error('Create coupon error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to create coupon' });
  }
};

/**
 * Update an existing Coupon.
 */
export const updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const { code, type, discountValue, minPurchase, maxDiscount, startDate, expiryDate, description } = req.body;

    await couponService.updateCoupon(couponId, {
      code,
      type,
      discountValue,
      minPurchase,
      maxDiscount,
      startDate,
      expiryDate,
      description
    });

    return res.status(200).json({ success: true, message: 'Coupon updated successfully!' });
  } catch (error) {
    console.error('Update coupon error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update coupon' });
  }
};

/**
 * Toggle Coupon Active/Inactive Status.
 */
export const toggleCouponStatus = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await couponService.toggleCouponStatus(couponId);

    return res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" is now ${coupon.status}.`
    });
  } catch (error) {
    console.error('Toggle coupon status error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update coupon status' });
  }
};

/**
 * Delete a Coupon.
 */
export const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await couponService.deleteCoupon(couponId);

    return res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to delete coupon' });
  }
};
