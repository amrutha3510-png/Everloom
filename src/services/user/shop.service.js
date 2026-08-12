import Product from '../../models/productModel.js';
import Category from '../../models/categoryModel.js';
import Subcategory from '../../models/subcategoryModel.js';
import mongoose from 'mongoose';

export const getActiveCategories = async () => {
  return await Category.find({ isDeleted: false, status: 'Active' }).lean();
};

export const getListedProducts = async (query = {}, page = 1, limit = 12) => {
  const skip = (page - 1) * limit;

  const activeCategories = await Category.find({ isDeleted: false, status: 'Active' }).select('_id');
  const activeCategoryIds = activeCategories.map(c => c._id);
  
  const activeSubcategories = await Subcategory.find({ isDeleted: false, status: 'Active' }).select('_id');
  const activeSubcategoryIds = activeSubcategories.map(s => s._id);

  const filter = { 
    isDeleted: false, 
    status: 'Active',
    category: { $in: activeCategoryIds },
    subcategory: { $in: activeSubcategoryIds }
  };

  // Category Filter
  if (query.category && query.category !== 'All Categories') {
    if (mongoose.Types.ObjectId.isValid(query.category)) {
      if (activeCategoryIds.some(id => id.toString() === query.category.toString())) {
        filter.category = query.category;
      } else {
        filter.category = new mongoose.Types.ObjectId();
      }
    }
  }

  // Subcategory Filter (Multiple)
  if (query.subcategory) {
    const subcats = Array.isArray(query.subcategory) ? query.subcategory : [query.subcategory];
    const validSubcats = subcats.filter(id => 
      mongoose.Types.ObjectId.isValid(id) && 
      activeSubcategoryIds.some(activeId => activeId.toString() === id.toString())
    );
    if (validSubcats.length > 0) {
      filter.subcategory = { $in: validSubcats };
    } else {
      filter.subcategory = new mongoose.Types.ObjectId();
    }
  }

  // Size Filter (Multiple)
  if (query.size) {
    const sizes = Array.isArray(query.size) ? query.size : [query.size];
    const validSizes = sizes.filter(s => s && s.trim() !== '');
    if (validSizes.length > 0) {
      filter['variants.size'] = { $in: validSizes };
    }
  }

  // Name Search (partial, case-insensitive)
  if (query.search && query.search.trim()) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }

  // Price Filter (checks if ANY variant price is within range)
  if (query.minPrice || query.maxPrice) {
    const minPrice = query.minPrice ? parseFloat(query.minPrice) : 0;
    const maxPrice = query.maxPrice ? parseFloat(query.maxPrice) : Infinity;
    
    if (!isNaN(minPrice) && !isNaN(maxPrice) && minPrice >= 0 && maxPrice >= minPrice) {
      filter['variants.price'] = { $gte: minPrice, $lte: maxPrice };
    }
  }

  // Sorting
  let sortOption = { createdAt: -1 }; // newest by default
  const sortParam = query.sort || 'newest';

  if (sortParam === 'price-low') {
    sortOption = { 'variants.price': 1 };
  } else if (sortParam === 'price-high') {
    sortOption = { 'variants.price': -1 };
  } else if (sortParam === 'az') {
    sortOption = { name: 1 };
  } else if (sortParam === 'za') {
    sortOption = { name: -1 };
  }

  // Since Mongoose .sort({'variants.price': 1}) can be tricky with arrays, 
  // we will just use it. Mongoose usually picks the min for ascending and max for descending.
  
  const products = await Product.find(filter)
    .populate('category', 'name isDeleted')
    .collation({ locale: 'en', strength: 2 })
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .lean();

  products.forEach(p => {
    p.images = (p.colorOptions && p.colorOptions[0] && p.colorOptions[0].images) || [];
    p.imageIds = (p.colorOptions && p.colorOptions[0] && p.colorOptions[0].imageIds) || [];
  });

  const totalProducts = await Product.countDocuments(filter);

  const activeProducts = products;

  return {
    products: activeProducts,
    totalPages: Math.ceil(totalProducts / limit) || 1,
    currentPage: page,
    totalEntries: totalProducts,
    sortOption: sortParam
  };
};

export const getProductById = async (id) => {
  const product = await Product.findOne({ _id: id, isDeleted: false, status: 'Active' })
    .populate('category', 'name isDeleted status')
    .populate('subcategory', 'name isDeleted status')
    .lean();

  if (!product || 
      !product.category || product.category.isDeleted || product.category.status !== 'Active' ||
      !product.subcategory || product.subcategory.isDeleted || product.subcategory.status !== 'Active') {
    return null; // Unavailable
  }
  product.images = (product.colorOptions && product.colorOptions[0] && product.colorOptions[0].images) || [];
  product.imageIds = (product.colorOptions && product.colorOptions[0] && product.colorOptions[0].imageIds) || [];
  return product;
};

export const getRelatedProducts = async (categoryId, subcategoryId, excludeProductId, limit = 4) => {
  const activeCategories = await Category.find({ isDeleted: false, status: 'Active' }).select('_id');
  const activeCategoryIds = activeCategories.map(c => c._id.toString());
  
  const activeSubcategories = await Subcategory.find({ isDeleted: false, status: 'Active' }).select('_id');
  const activeSubcategoryIds = activeSubcategories.map(s => s._id.toString());

  if (!activeCategoryIds.includes(categoryId.toString()) || !activeSubcategoryIds.includes(subcategoryId.toString())) {
    return [];
  }

  const filter = {
    _id: { $ne: excludeProductId },
    isDeleted: false,
    status: 'Active',
    category: categoryId,
    subcategory: subcategoryId
  };

  let related = await Product.find(filter).populate('category', 'name isDeleted status').limit(limit).lean();
  
  related = related.filter(p => p.category && !p.category.isDeleted && p.category.status !== 'Inactive');

  if (related.length < limit) {
    const moreFilter = {
      _id: { $ne: excludeProductId, $nin: related.map(p => p._id) },
      isDeleted: false,
      status: 'Active',
      category: categoryId,
      subcategory: { $in: activeSubcategoryIds }
    };
    let more = await Product.find(moreFilter).populate('category', 'name isDeleted status').limit(limit - related.length).lean();
    more = more.filter(p => p.category && !p.category.isDeleted && p.category.status !== 'Inactive');
    related = [...related, ...more];
  }

  related.forEach(p => {
    p.images = (p.colorOptions && p.colorOptions[0] && p.colorOptions[0].images) || [];
    p.imageIds = (p.colorOptions && p.colorOptions[0] && p.colorOptions[0].imageIds) || [];
  });

  return related;
};
