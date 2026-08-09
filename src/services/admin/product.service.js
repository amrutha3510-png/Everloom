import Product from '../../models/productModel.js';
import Category from '../../models/categoryModel.js';
import Subcategory from '../../models/subcategoryModel.js';

const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

export const getAllProducts = async (query = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const filter = { isDeleted: false };

  // Status Filter
  if (query.status && query.status !== 'All Status') {
    filter.status = query.status;
  }

  // Category Filter
  if (query.category && query.category !== 'All Categories') {
    filter.category = query.category;
  }

  // Subcategory Filter
  if (query.subcategory && query.subcategory !== 'All Subcategories') {
    filter.subcategory = query.subcategory;
  }

  // Name Search
  if (query.search && query.search.trim()) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }

  // Sorting Options
  let sortOption = { createdAt: -1 };
  const sortParam = query.sort || 'newest';

  if (sortParam === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sortParam === 'price-low') {
    sortOption = { price: 1 };
  } else if (sortParam === 'price-high') {
    sortOption = { price: -1 };
  } else if (sortParam === 'az') {
    sortOption = { name: 1 };
  } else if (sortParam === 'za') {
    sortOption = { name: -1 };
  }

  const products = await Product.find(filter)
    .populate('category', 'name isDeleted')
    .populate('subcategory', 'name isDeleted')
    .collation({ locale: 'en', strength: 2 })
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .lean();

  const totalProducts = await Product.countDocuments(filter);

  // Stats
  const totalCount = await Product.countDocuments({ isDeleted: false });
  const activeCount = await Product.countDocuments({ status: 'Active', isDeleted: false });
  const inactiveCount = await Product.countDocuments({ status: 'Inactive', isDeleted: false });

  return {
    products,
    totalPages: Math.ceil(totalProducts / limit) || 1,
    currentPage: page,
    totalEntries: totalProducts,
    sortOption: sortParam,
    stats: {
      total: totalCount,
      active: activeCount,
      inactive: inactiveCount
    }
  };
};

export const getDeletedProducts = async (query = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const filter = { isDeleted: true };

  // Name Search
  if (query.search && query.search.trim()) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }

  let sortOption = { createdAt: -1 };
  const sortParam = query.sort || 'newest';
  if (sortParam === 'oldest') sortOption = { createdAt: 1 };

  const products = await Product.find(filter)
    .populate('category', 'name isDeleted')
    .populate('subcategory', 'name isDeleted')
    .collation({ locale: 'en', strength: 2 })
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .lean();

  const totalProducts = await Product.countDocuments(filter);

  return {
    products,
    totalPages: Math.ceil(totalProducts / limit) || 1,
    currentPage: page,
    totalEntries: totalProducts,
    sortOption: sortParam,
  };
};

export const getProductById = async (id) => {
  const product = await Product.findOne({ _id: id }).populate('category').populate('subcategory').lean();
  if (!product) throw new Error('Product not found.');
  return product;
};

export const createProduct = async (data, files) => {
  const trimmedName = (data.name || '').trim();
  const trimmedDesc = (data.description || '').trim();
  if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
    throw new Error('Product name must be between 2 and 100 characters.');
  }
  if (!trimmedDesc || trimmedDesc.length < 10) {
    throw new Error('Description must be at least 10 characters long.');
  }

  // Category validation
  const category = await Category.findOne({ _id: data.category, isDeleted: false });
  if (!category) {
    throw new Error('Invalid or deleted category selected.');
  }

  // Subcategory validation
  const subcategory = await Subcategory.findOne({ _id: data.subcategory, isDeleted: false });
  if (!subcategory) {
    throw new Error('Invalid or deleted subcategory selected.');
  }
  if (subcategory.category.toString() !== data.category.toString()) {
    throw new Error('Subcategory does not belong to the selected category.');
  }

  // Variants validation
  let variants = [];
  try {
    if (data.variants) {
      variants = typeof data.variants === 'string' ? JSON.parse(data.variants) : data.variants;
    }
  } catch (err) {
    throw new Error('Invalid variants data format.');
  }

  const comboSet = new Set();
  for (const v of variants) {
    if (!v.size || !v.color || v.price === undefined || v.price === '' || v.stock === undefined || v.stock === '') {
      throw new Error('All variant fields (size, color, price, stock) are required.');
    }
    const p = parseFloat(v.price);
    const s = parseFloat(v.stock);
    if (isNaN(p) || p < 0) throw new Error('Variant price must be a valid non-negative number.');
    if (isNaN(s) || s < 0 || !Number.isInteger(s)) throw new Error('Variant stock must be a valid non-negative integer.');
    
    const combo = `${v.size.trim().toLowerCase()}-${v.color.trim().toLowerCase()}`;
    if (comboSet.has(combo)) {
      throw new Error(`Duplicate variant combination: ${v.size} + ${v.color}`);
    }
    comboSet.add(combo);
    v.price = p;
    v.stock = s;
  }

  // Image validation
  if (!files || files.length < 3) {
    throw new Error('At least 3 product images are required.');
  }

  const images = [];
  const imageIds = [];
  
  for (const file of files) {
    const imagePath = file.path && file.path.startsWith('http') 
      ? file.path 
      : `/uploads/product-images/${file.filename}`;
    images.push(imagePath);
    imageIds.push(file.filename || file.public_id || '');
  }

  // Duplicate Check (Case-Insensitive)
  const duplicate = await Product.findOne({
    name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' },
    isDeleted: false
  });
  if (duplicate) {
    throw new Error('Product name already exists.');
  }

  const status = (data.status === 'Inactive' || data.status === 'off' || data.status === 'false') 
    ? 'Inactive' 
    : 'Active';

  const newProduct = new Product({
    name: trimmedName,
    description: trimmedDesc,
    category: data.category,
    subcategory: data.subcategory,
    images,
    imageIds,
    variants,
    status
  });

  return await newProduct.save();
};

export const updateProduct = async (id, data, files) => {
  const product = await Product.findOne({ _id: id });
  if (!product) throw new Error('Product not found.');

  const trimmedName = (data.name || '').trim();
  const trimmedDesc = (data.description || '').trim();
  if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
    throw new Error('Product name must be between 2 and 100 characters.');
  }
  if (!trimmedDesc || trimmedDesc.length < 10) {
    throw new Error('Description must be at least 10 characters long.');
  }

  const category = await Category.findOne({ _id: data.category, isDeleted: false });
  if (!category && data.category !== product.category.toString()) {
    throw new Error('Invalid or deleted category selected.');
  }

  const subcategory = await Subcategory.findOne({ _id: data.subcategory, isDeleted: false });
  if (!subcategory && data.subcategory !== product.subcategory?.toString()) {
    throw new Error('Invalid or deleted subcategory selected.');
  }
  if (subcategory && subcategory.category.toString() !== data.category.toString()) {
    throw new Error('Subcategory does not belong to the selected category.');
  }

  // Variants validation
  let variants = [];
  try {
    if (data.variants) {
      variants = typeof data.variants === 'string' ? JSON.parse(data.variants) : data.variants;
    }
  } catch (err) {
    throw new Error('Invalid variants data format.');
  }

  const comboSet = new Set();
  for (const v of variants) {
    if (!v.size || !v.color || v.price === undefined || v.price === '' || v.stock === undefined || v.stock === '') {
      throw new Error('All variant fields (size, color, price, stock) are required.');
    }
    const p = parseFloat(v.price);
    const s = parseFloat(v.stock);
    if (isNaN(p) || p < 0) throw new Error('Variant price must be a valid non-negative number.');
    if (isNaN(s) || s < 0 || !Number.isInteger(s)) throw new Error('Variant stock must be a valid non-negative integer.');
    
    const combo = `${v.size.trim().toLowerCase()}-${v.color.trim().toLowerCase()}`;
    if (comboSet.has(combo)) {
      throw new Error(`Duplicate variant combination: ${v.size} + ${v.color}`);
    }
    comboSet.add(combo);
    v.price = p;
    v.stock = s;
  }

  // Existing images handling
  let existingImages = data.existingImages || [];
  let existingImageIds = data.existingImageIds || [];
  
  if (!Array.isArray(existingImages)) existingImages = [existingImages];
  if (!Array.isArray(existingImageIds)) existingImageIds = [existingImageIds];
  
  // Filter out any empty strings
  existingImages = existingImages.filter(img => img.trim() !== '');
  existingImageIds = existingImageIds.filter(id => id.trim() !== '');

  // New images handling
  const newImages = [];
  const newImageIds = [];
  if (files && files.length > 0) {
    for (const file of files) {
      const imagePath = file.path && file.path.startsWith('http') 
        ? file.path 
        : `/uploads/product-images/${file.filename}`;
      newImages.push(imagePath);
      newImageIds.push(file.filename || file.public_id || '');
    }
  }

  const totalImages = [...existingImages, ...newImages];
  const totalImageIds = [...existingImageIds, ...newImageIds];

  if (totalImages.length < 3) {
    throw new Error('At least 3 product images are required.');
  }

  const duplicate = await Product.findOne({
    _id: { $ne: id },
    name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' },
    isDeleted: false
  });
  if (duplicate) {
    throw new Error('Product name already exists.');
  }

  product.name = trimmedName;
  product.description = trimmedDesc;
  product.category = data.category;
  product.subcategory = data.subcategory;
  product.images = totalImages;
  product.imageIds = totalImageIds;
  product.variants = variants;
  product.status = (data.status === 'Inactive' || data.status === 'off' || data.status === 'false') ? 'Inactive' : 'Active';

  return await product.save();
};

export const softDeleteProduct = async (id) => {
  const product = await Product.findOne({ _id: id });
  if (!product) throw new Error('Product not found.');
  product.isDeleted = true;
  await product.save();
  return true;
};

export const restoreProduct = async (id) => {
  const product = await Product.findOne({ _id: id });
  if (!product) throw new Error('Product not found.');
  product.isDeleted = false;
  await product.save();
  return true;
};
