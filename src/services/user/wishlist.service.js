import Wishlist from '../../models/wishlistModel.js';
import Product from '../../models/productModel.js';

/**
 * Get populated wishlist for a user.
 */
export const getWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ user: userId })
    .populate({
      path: 'items.product',
      populate: [
        { path: 'category', select: 'name isDeleted status' },
        { path: 'subcategory', select: 'name isDeleted status' }
      ]
    })
    .lean();

  if (!wishlist) {
    wishlist = { items: [] };
  } else {
    // Filter out unlisted, unavailable, deleted, or inactive products/categories
    wishlist.items = wishlist.items.filter(item => {
      const p = item.product;
      if (!p || p.isDeleted || p.status !== 'Active') return false;
      if (p.category && (p.category.isDeleted || p.category.status !== 'Active')) return false;
      if (p.subcategory && (p.subcategory.isDeleted || p.subcategory.status !== 'Active')) return false;
      
      // Ensure the images arrays are prepared
      p.images = (p.colorOptions && p.colorOptions[0] && p.colorOptions[0].images) || [];
      p.imageIds = (p.colorOptions && p.colorOptions[0] && p.colorOptions[0].imageIds) || [];
      
      // Check if the selected variant still exists
      const variant = p.variants.find(v => v.size === item.variant.size && v.color === item.variant.color);
      if (!variant) return false;

      // Attach price and stock details for frontend display
      item.price = variant.price;
      item.stock = variant.stock;
      return true;
    });
  }

  return wishlist;
};

/**
 * Add product variant to wishlist.
 */
export const addToWishlist = async (userId, productId, size, color) => {
  // Validate product availability
  const product = await Product.findById(productId)
    .populate('category')
    .populate('subcategory');

  if (!product || product.isDeleted || product.status !== 'Active') {
    throw new Error('Product is currently unavailable.');
  }

  if (product.category && (product.category.isDeleted || product.category.status !== 'Active')) {
    throw new Error('Product category is currently unavailable.');
  }

  if (product.subcategory && (product.subcategory.isDeleted || product.subcategory.status !== 'Active')) {
    throw new Error('Product subcategory is currently unavailable.');
  }

  // Validate variant exists
  const variant = product.variants.find(v => v.size === size && v.color === color);
  if (!variant) {
    throw new Error('Selected size or color is unavailable.');
  }

  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    wishlist = new Wishlist({ user: userId, items: [] });
  }

  // Check if already in wishlist
  const exists = wishlist.items.some(item => 
    item.product.toString() === productId.toString() &&
    item.variant.size === size &&
    item.variant.color === color
  );

  if (exists) {
    throw new Error('Product variant is already in your wishlist.');
  }

  wishlist.items.push({
    product: productId,
    variant: { size, color }
  });

  await wishlist.save();
  return wishlist;
};

/**
 * Remove product variant from wishlist.
 */
export const removeFromWishlist = async (userId, productId, size, color) => {
  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) return;

  wishlist.items = wishlist.items.filter(item => 
    !(item.product.toString() === productId.toString() &&
      item.variant.size === size &&
      item.variant.color === color)
  );

  await wishlist.save();
  return wishlist;
};
