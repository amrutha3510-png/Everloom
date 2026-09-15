import * as offerService from '../../services/admin/offer.service.js';
import Product from '../../models/productModel.js';
import Category from '../../models/categoryModel.js';

/**
 * Render Offer Management Page.
 */
export const getOfferPage = async (req, res) => {
  try {
    const offers = await offerService.getAllOffers();
    const products = await Product.find({ isDeleted: false, status: 'Active' }).select('_id name');
    const categories = await Category.find({ isDeleted: false, status: 'Active' }).select('_id name');

    res.render('admin/offers/index', {
      title: 'Offer Management',
      layout: 'layouts/admin-layout',
      path: '/admin/offers',
      offers,
      products,
      categories
    });
  } catch (error) {
    console.error('Error loading offer page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load offers page' };
    res.redirect('/admin/dashboard');
  }
};

/**
 * Create a new Product or Category offer.
 */
export const createOffer = async (req, res) => {
  try {
    const { name, targetType, targetId, discountType, discountValue, startDate, endDate } = req.body;

    await offerService.createOffer({
      name,
      targetType,
      targetId,
      discountType,
      discountValue,
      startDate,
      endDate
    });

    req.session.toast = { type: 'success', message: `${targetType} offer created successfully!` };
    return res.status(200).json({ success: true, message: `${targetType} offer created successfully!` });
  } catch (error) {
    console.error('Create offer error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to create offer' });
  }
};

/**
 * Update an existing Offer.
 */
export const updateOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const { name, targetType, targetId, discountType, discountValue, startDate, endDate } = req.body;

    await offerService.updateOffer(offerId, {
      name,
      targetType,
      targetId,
      discountType,
      discountValue,
      startDate,
      endDate
    });

    return res.status(200).json({ success: true, message: 'Offer updated successfully!' });
  } catch (error) {
    console.error('Update offer error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update offer' });
  }
};

/**
 * Toggle Offer Active/Inactive Status.
 */
export const toggleOfferStatus = async (req, res) => {
  try {
    const offerId = req.params.id;
    const updatedOffer = await offerService.toggleOfferStatus(offerId);

    return res.status(200).json({
      success: true,
      message: `Offer "${updatedOffer.name}" is now ${updatedOffer.status}.`
    });
  } catch (error) {
    console.error('Toggle offer status error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update offer status' });
  }
};

/**
 * Soft Delete Offer.
 */
export const deleteOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    await offerService.deleteOffer(offerId);

    return res.status(200).json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Delete offer error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to delete offer' });
  }
};
