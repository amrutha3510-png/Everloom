import Offer from '../../models/offerModel.js';
import Product from '../../models/productModel.js';
import Category from '../../models/categoryModel.js';

/**
 * Fetch all active/non-deleted offers with target details populated.
 */
export const getAllOffers = async () => {
  const offers = await Offer.find({ isDeleted: false })
    .populate('product', 'name images')
    .populate('category', 'name')
    .sort({ createdAt: -1 });

  return offers;
};

/**
 * Create a new Product or Category offer with strict validation.
 */
export const createOffer = async (offerData) => {
  const { name, targetType, targetId, discountType, discountValue, startDate, endDate } = offerData;

  if (!name || !name.trim()) {
    throw new Error('Offer name is required.');
  }

  if (!['Product', 'Category'].includes(targetType)) {
    throw new Error('Target type must be Product or Category.');
  }

  if (!targetId) {
    throw new Error(`Please select a ${targetType.toLowerCase()}.`);
  }

  const numericValue = Number(discountValue);
  if (isNaN(numericValue) || numericValue <= 0) {
    throw new Error('Discount value must be greater than 0.');
  }

  if (discountType === 'PERCENTAGE' && numericValue > 90) {
    throw new Error('Percentage discount cannot exceed 90%.');
  }

  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date(endDate);

  if (isNaN(end.getTime())) {
    throw new Error('Valid end date is required.');
  }

  if (end <= start) {
    throw new Error('End date must be after start date.');
  }

  const offerObj = {
    name: name.trim(),
    targetType,
    discountType: discountType || 'PERCENTAGE',
    discountValue: numericValue,
    startDate: start,
    endDate: end,
    status: 'Active'
  };

  if (targetType === 'Product') {
    const product = await Product.findById(targetId);
    if (!product) throw new Error('Selected product does not exist.');
    offerObj.product = targetId;
  } else {
    const category = await Category.findById(targetId);
    if (!category) throw new Error('Selected category does not exist.');
    offerObj.category = targetId;
  }

  const newOffer = new Offer(offerObj);
  await newOffer.save();
  return newOffer;
};

/**
 * Toggle offer status (Active / Inactive).
 */
export const toggleOfferStatus = async (offerId) => {
  const offer = await Offer.findById(offerId);
  if (!offer || offer.isDeleted) {
    throw new Error('Offer not found.');
  }

  offer.status = offer.status === 'Active' ? 'Inactive' : 'Active';
  await offer.save();
  return offer;
};

/**
 * Soft delete offer.
 */
export const deleteOffer = async (offerId) => {
  const offer = await Offer.findById(offerId);
  if (!offer) {
    throw new Error('Offer not found.');
  }

  offer.isDeleted = true;
  offer.status = 'Inactive';
  await offer.save();
  return offer;
};
