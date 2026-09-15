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
  if (isNaN(numericValue) || !Number.isInteger(numericValue) || numericValue < 1 || numericValue > 75) {
    throw new Error('Discount must be between 1% and 75%.');
  }

  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date(endDate);

  if (!endDate || isNaN(end.getTime())) {
    throw new Error('Expiry Date is required.');
  }

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (end <= todayEnd) {
    throw new Error('Expiry Date must be a future date.');
  }

  if (end <= start) {
    throw new Error('Expiry date must be after start date.');
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
 * Update an existing Product or Category offer with strict validation.
 */
export const updateOffer = async (offerId, offerData) => {
  const { name, targetType, targetId, discountType, discountValue, startDate, endDate } = offerData;

  const offer = await Offer.findById(offerId);
  if (!offer || offer.isDeleted) {
    throw new Error('Offer not found.');
  }

  if (!name || !name.trim()) {
    throw new Error('Offer title is required.');
  }

  if (!['Product', 'Category'].includes(targetType)) {
    throw new Error('Target type must be Product or Category.');
  }

  if (!targetId) {
    throw new Error(`Please select a ${targetType.toLowerCase()}.`);
  }

  const numericValue = Number(discountValue);
  if (isNaN(numericValue) || !Number.isInteger(numericValue) || numericValue < 1 || numericValue > 75) {
    throw new Error('Discount must be between 1% and 75%.');
  }

  const start = startDate ? new Date(startDate) : (offer.startDate || new Date());
  const end = new Date(endDate);

  if (!endDate || isNaN(end.getTime())) {
    throw new Error('Expiry Date is required.');
  }

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (end <= todayEnd) {
    throw new Error('Expiry Date must be a future date.');
  }

  if (end <= start) {
    throw new Error('Expiry date must be after start date.');
  }

  offer.name = name.trim();
  offer.targetType = targetType;
  offer.discountType = discountType || 'PERCENTAGE';
  offer.discountValue = numericValue;
  offer.startDate = start;
  offer.endDate = end;

  if (targetType === 'Product') {
    const product = await Product.findById(targetId);
    if (!product) throw new Error('Selected product does not exist.');
    offer.product = targetId;
    offer.category = undefined;
  } else {
    const category = await Category.findById(targetId);
    if (!category) throw new Error('Selected category does not exist.');
    offer.category = targetId;
    offer.product = undefined;
  }

  await offer.save();
  return offer;
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
