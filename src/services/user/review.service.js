import Review from '../../models/reviewModel.js';
import Order from '../../models/orderModel.js';
import Product from '../../models/productModel.js';
import mongoose from 'mongoose';

/**
 * Helper to get a valid ObjectId or return null if invalid
 */
const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return null;
};

/**
 * Check if a user is eligible to review a product
 * Must have an order containing the specific product with status 'Delivered'
 */
export const canUserReviewProduct = async (userId, productId) => {
  if (!userId || !productId) return false;
  if (!mongoose.Types.ObjectId.isValid(productId)) return false;

  const userObjId = toObjectId(userId);
  const prodObjId = toObjectId(productId);

  const userQueries = [{ user: userId.toString() }];
  if (userObjId) userQueries.push({ user: userObjId });

  const productQueries = [productId.toString()];
  if (prodObjId) productQueries.push(prodObjId);

  // Search orders for user matching userId (as ObjectId or String) and product (as ObjectId or String) with Delivered status
  const order = await Order.findOne({
    $and: [
      { $or: userQueries },
      {
        $or: [
          { status: 'Delivered' },
          { status: 'delivered' },
          { 'items.status': 'Delivered' },
          { 'items.status': 'delivered' }
        ]
      },
      {
        'items.product': { $in: productQueries }
      }
    ]
  });

  return !!order;
};

/**
 * Get all reviews for a product
 */
export const getProductReviews = async (productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) return [];

  const prodObjId = toObjectId(productId);
  return await Review.find({ product: prodObjId })
    .populate('user', 'fullName firstName lastName')
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * Get product rating summary (average rating, count)
 */
export const getProductRatingSummary = async (productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return { averageRating: 0, totalReviews: 0 };
  }

  const prodObjId = toObjectId(productId);
  const result = await Review.aggregate([
    { $match: { product: prodObjId } },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (result.length > 0) {
    return {
      averageRating: Math.round(result[0].averageRating * 10) / 10,
      totalReviews: result[0].totalReviews
    };
  }

  return { averageRating: 0, totalReviews: 0 };
};

/**
 * Get user's existing review for a product if it exists
 */
export const getUserReviewForProduct = async (userId, productId) => {
  if (!userId || !productId) return null;
  if (!mongoose.Types.ObjectId.isValid(productId)) return null;

  const userObjId = toObjectId(userId);
  const prodObjId = toObjectId(productId);

  const userQueries = [{ user: userId.toString() }];
  if (userObjId) userQueries.push({ user: userObjId });

  return await Review.findOne({
    $or: userQueries,
    product: prodObjId
  }).lean();
};

/**
 * Create or update a review with strict backend validations
 */
export const saveProductReview = async ({ userId, productId, rating, title, comment }) => {
  if (!userId || !productId) {
    throw { status: 401, message: 'Please log in to submit a review.' };
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw { status: 404, message: 'Product not found.' };
  }

  const prodObjId = toObjectId(productId);
  const userObjId = toObjectId(userId) || userId;

  const product = await Product.findOne({ _id: prodObjId, isDeleted: false });
  if (!product) {
    throw { status: 404, message: 'Product not found.' };
  }

  // 1. Rating presence validation
  if (rating === undefined || rating === null || rating === '') {
    throw { status: 400, message: 'Rating is required. Please select 1 to 5 stars.' };
  }

  // 2. Rating numeric & integer validation
  const numRating = Number(rating);
  if (typeof rating === 'boolean' || isNaN(numRating) || !Number.isInteger(numRating)) {
    throw { status: 400, message: 'Rating must be an integer.' };
  }

  // 3. Rating range validation (1 to 5)
  if (numRating < 1 || numRating > 5) {
    throw { status: 400, message: 'Rating must be an integer between 1 and 5.' };
  }

  // 4. Comment validation
  if (!comment || typeof comment !== 'string' || !comment.trim()) {
    throw { status: 400, message: 'Review text cannot be empty.' };
  }

  // 5. Order status Delivered validation
  const eligible = await canUserReviewProduct(userId, productId);
  if (!eligible) {
    throw { status: 403, message: 'You can only review products that have been delivered to you.' };
  }

  // Upsert review (prevent duplicate reviews)
  const review = await Review.findOneAndUpdate(
    { user: userObjId, product: prodObjId },
    {
      user: userObjId,
      product: prodObjId,
      rating: numRating,
      title: title && typeof title === 'string' ? title.trim() : '',
      comment: comment.trim()
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  return review;
};
