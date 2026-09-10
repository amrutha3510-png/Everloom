import Offer from '../../models/offerModel.js';

/**
 * Calculates effective price and active offer for a product variant.
 * 
 * BEST OFFER BUSINESS RULE:
 * When both a product-specific offer and a category-level offer exist for a product:
 * - Calculate discount amount for Product Offer.
 * - Calculate discount amount for Category Offer.
 * - Compare both discount amounts.
 * - Apply ONLY the larger/better discount to the customer.
 * - Do NOT stack both offers.
 */
export const calculateBestOffer = async (productId, categoryId, originalPrice) => {
  const price = Number(originalPrice) || 0;
  if (price <= 0) {
    return {
      finalPrice: 0,
      originalPrice: 0,
      discountAmount: 0,
      offerPercentage: 0,
      appliedOfferType: null,
      offerName: null
    };
  }

  const now = new Date();

  // 1. Fetch active Product Offer
  let productOffer = null;
  if (productId) {
    productOffer = await Offer.findOne({
      targetType: 'Product',
      product: productId,
      status: 'Active',
      isDeleted: false,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).lean();
  }

  // 2. Fetch active Category Offer
  let categoryOffer = null;
  if (categoryId) {
    categoryOffer = await Offer.findOne({
      targetType: 'Category',
      category: categoryId,
      status: 'Active',
      isDeleted: false,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).lean();
  }

  let productDiscount = 0;
  if (productOffer) {
    if (productOffer.discountType === 'PERCENTAGE') {
      productDiscount = Math.round(price * (productOffer.discountValue / 100));
    } else {
      productDiscount = Math.min(productOffer.discountValue, price);
    }
  }

  let categoryDiscount = 0;
  if (categoryOffer) {
    if (categoryOffer.discountType === 'PERCENTAGE') {
      categoryDiscount = Math.round(price * (categoryOffer.discountValue / 100));
    } else {
      categoryDiscount = Math.min(categoryOffer.discountValue, price);
    }
  }

  // 3. Compare and select larger discount (Best Offer Rule)
  let bestDiscount = 0;
  let appliedOffer = null;

  if (productDiscount > 0 || categoryDiscount > 0) {
    if (productDiscount >= categoryDiscount) {
      bestDiscount = productDiscount;
      appliedOffer = {
        type: 'Product',
        name: productOffer.name,
        discountValue: productOffer.discountValue,
        discountType: productOffer.discountType
      };
    } else {
      bestDiscount = categoryDiscount;
      appliedOffer = {
        type: 'Category',
        name: categoryOffer.name,
        discountValue: categoryOffer.discountValue,
        discountType: categoryOffer.discountType
      };
    }
  }

  const finalPrice = Math.max(0, price - bestDiscount);
  const offerPercentage = Math.round((bestDiscount / price) * 100);

  return {
    finalPrice,
    originalPrice: price,
    discountAmount: bestDiscount,
    offerPercentage,
    appliedOfferType: appliedOffer ? appliedOffer.type : null,
    offerName: appliedOffer ? appliedOffer.name : null
  };
};
