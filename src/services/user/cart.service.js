import Cart from '../../models/cartModel.js';
import Product from '../../models/productModel.js';
import Wishlist from '../../models/wishlistModel.js';
import { calculateBestOffer } from './offer.service.js';

const MAX_QTY = 5;

export const getCartCount = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).lean();
  if (!cart || !cart.items) return 0;
  return cart.items.reduce((total, item) => total + item.quantity, 0);
};

export const getCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate({
    path: 'items.product',
    populate: [
      { path: 'category', select: 'name isDeleted status' },
      { path: 'subcategory', select: 'name isDeleted status' }
    ]
  }).lean();

  if (!cart) {
    return { items: [], cartTotal: 0, originalTotal: 0, totalOfferDiscount: 0 };
  }

  // Validate items and calculate total with active product/category offers
  let cartTotal = 0;
  let originalTotal = 0;
  let totalOfferDiscount = 0;
  const processedItems = [];

  for (const item of cart.items) {
    const product = item.product;
    if (product) {
      product.images = (product.colorOptions && product.colorOptions[0] && product.colorOptions[0].images) || [];
      product.imageIds = (product.colorOptions && product.colorOptions[0] && product.colorOptions[0].imageIds) || [];
    }
    
    // Check if product exists and is available
    if (!product || product.isDeleted || product.status !== 'Active' || product.category?.isDeleted || product.category?.status === 'Inactive' || product.subcategory?.isDeleted || product.subcategory?.status === 'Inactive') {
      item.isUnavailable = true;
      item.message = "Product is currently unavailable";
      processedItems.push(item);
      continue;
    }

    // Find the variant
    const variant = product.variants.find(v => v.size === item.variant.size && v.color === item.variant.color);
    if (!variant) {
      item.isUnavailable = true;
      item.message = "Selected variant is no longer available";
      processedItems.push(item);
      continue;
    }

    // Calculate best active offer for this item
    const categoryId = product.category ? (product.category._id || product.category) : null;
    const offerData = await calculateBestOffer(product._id, categoryId, variant.price);

    item.originalPrice = variant.price;
    item.price = offerData.finalPrice;
    item.offerDiscount = offerData.discountAmount;
    item.offerPercentage = offerData.offerPercentage;
    item.offerName = offerData.offerName;
    item.stock = variant.stock;

    if (variant.stock <= 0) {
      item.isOutOfStock = true;
      item.message = "Out of Stock";
    } else if (item.quantity > variant.stock) {
      item.stockMismatch = true;
      item.message = `Only ${variant.stock} available in stock`;
    } else {
      item.itemTotal = item.price * item.quantity;
      cartTotal += item.itemTotal;
      originalTotal += item.originalPrice * item.quantity;
      totalOfferDiscount += item.offerDiscount * item.quantity;
    }

    processedItems.push(item);
  }

  cart.items = processedItems;
  cart.cartTotal = cartTotal;
  cart.originalTotal = originalTotal;
  cart.totalOfferDiscount = totalOfferDiscount;
  return cart;
};

export const addToCart = async (userId, productId, variantSize, variantColor, quantity) => {
  if (quantity < 1 || quantity > MAX_QTY) {
    throw new Error(`Quantity must be between 1 and ${MAX_QTY}`);
  }

  const product = await Product.findById(productId);
  if (!product || product.isDeleted || product.status !== 'Active') {
    throw new Error('Product is unavailable');
  }

  const variant = product.variants.find(v => v.size === variantSize && v.color === variantColor);
  if (!variant) {
    throw new Error('Variant not found');
  }

  if (variant.stock < quantity) {
    throw new Error('Not enough stock available');
  }

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  const existingItemIndex = cart.items.findIndex(item => {
    const itemProdId = item.product._id ? item.product._id.toString() : item.product.toString();
    const targetProdId = productId._id ? productId._id.toString() : productId.toString();
    return itemProdId === targetProdId && 
           item.variant.size === variantSize && 
           item.variant.color === variantColor;
  });

  const existingQuantity = existingItemIndex > -1 ? cart.items[existingItemIndex].quantity : 0;
  
  let newQuantity;
  if (quantity === 1) {
    newQuantity = existingQuantity + 1;
  } else {
    newQuantity = quantity;
  }

  if (newQuantity > MAX_QTY) {
    throw new Error(`Maximum ${MAX_QTY} quantity allowed per item`);
  }

  if (newQuantity > variant.stock) {
    throw new Error('Not enough stock available');
  }

  if (existingItemIndex > -1) {
    cart.items[existingItemIndex].quantity = newQuantity;
  } else {
    cart.items.push({
      product: productId,
      variant: { size: variantSize, color: variantColor },
      quantity: newQuantity
    });
  }

  await cart.save();

  // Remove from Wishlist if exists
  await Wishlist.updateOne(
    { user: userId },
    { $pull: { items: { product: productId, 'variant.size': variantSize, 'variant.color': variantColor } } }
  );

  return cart;
};

export const updateQuantity = async (userId, itemId, action) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new Error('Cart not found');

  const item = cart.items.id(itemId);
  if (!item) throw new Error('Item not found in cart');

  const product = await Product.findById(item.product);
  if (!product || product.isDeleted || product.status !== 'Active') {
    throw new Error('Product is unavailable');
  }

  const variant = product.variants.find(v => v.size === item.variant.size && v.color === item.variant.color);
  if (!variant) throw new Error('Variant not found');

  if (action === 'increment') {
    const newQty = item.quantity + 1;
    if (newQty > MAX_QTY) throw new Error(`Maximum ${MAX_QTY} allowed`);
    if (newQty > variant.stock) throw new Error('Not enough stock available');
    item.quantity = newQty;
  } else if (action === 'decrement') {
    if (item.quantity > 1) {
      item.quantity -= 1;
    } else {
      throw new Error('Minimum quantity is 1');
    }
  } else {
    throw new Error('Invalid action');
  }

  await cart.save();
  return cart;
};

export const removeFromCart = async (userId, itemId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) return;

  cart.items = cart.items.filter(item => item._id.toString() !== itemId.toString());
  await cart.save();
  return cart;
};
