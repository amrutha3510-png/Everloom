import Category from '../../models/categoryModel.js';

const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

export const getAllCategories = async (query = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const filter = {};

  // Status Filter
  if (query.status && query.status !== 'All Status') {
    filter.status = query.status;
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
  } else if (sortParam === 'az') {
    sortOption = { name: 1 };
  } else if (sortParam === 'za') {
    sortOption = { name: -1 };
  }

  const categories = await Category.find(filter)
    .collation({ locale: 'en', strength: 2 }) // For case-insensitive A-Z sorting
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .lean();

  const totalCategories = await Category.countDocuments(filter);

  // Statistics for summary cards
  const totalCount = await Category.countDocuments({});
  const activeCount = await Category.countDocuments({ status: 'Active' });
  const inactiveCount = await Category.countDocuments({ status: 'Inactive' });

  return {
    categories,
    totalPages: Math.ceil(totalCategories / limit) || 1,
    currentPage: page,
    totalEntries: totalCategories,
    sortOption: sortParam,
    stats: {
      total: totalCount,
      active: activeCount,
      inactive: inactiveCount
    }
  };
};

export const getCategoryById = async (id) => {
  const category = await Category.findOne({ _id: id }).lean();
  if (!category) {
    throw new Error('Category not found.');
  }
  return category;
};

export const createCategory = async (data, file) => {
  const trimmedName = (data.name || '').trim();
  const trimmedDesc = (data.description || '').trim();

  // Name Validation
  if (!trimmedName) {
    throw new Error('Category name is required.');
  }
  if (trimmedName.length < 2) {
    throw new Error('Category name must be at least 2 characters long.');
  }
  if (trimmedName.length > 50) {
    throw new Error('Category name cannot exceed 50 characters.');
  }

  // Description Validation
  if (!trimmedDesc) {
    throw new Error('Category description is required.');
  }
  if (trimmedDesc.length < 5) {
    throw new Error('Category description must be at least 5 characters long.');
  }
  if (trimmedDesc.length > 500) {
    throw new Error('Category description cannot exceed 500 characters.');
  }

  // Banner Image Validation
  if (!file) {
    throw new Error('Category banner image is required.');
  }

  const imagePath = file.path && file.path.startsWith('http') 
    ? file.path 
    : `/uploads/category-banners/${file.filename}`;

  // Duplicate Check (Case-Insensitive)
  const duplicate = await Category.findOne({
    name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' }
  });

  if (duplicate) {
    throw new Error('Category name already exists.');
  }

  // Active Visibility Status
  const status = (data.status === 'Inactive' || data.status === 'off' || data.status === 'false') 
    ? 'Inactive' 
    : 'Active';

  const newCategory = new Category({
    name: trimmedName,
    description: trimmedDesc,
    image: imagePath,
    imageId: file.filename || file.public_id || '',
    status
  });

  return await newCategory.save();
};

export const updateCategory = async (id, data, file) => {
  const category = await Category.findOne({ _id: id });
  if (!category) {
    throw new Error('Category not found.');
  }

  const trimmedName = (data.name || '').trim();
  const trimmedDesc = (data.description || '').trim();

  // Name Validation
  if (!trimmedName) {
    throw new Error('Category name is required.');
  }
  if (trimmedName.length < 2) {
    throw new Error('Category name must be at least 2 characters long.');
  }
  if (trimmedName.length > 50) {
    throw new Error('Category name cannot exceed 50 characters.');
  }

  // Description Validation
  if (!trimmedDesc) {
    throw new Error('Category description is required.');
  }
  if (trimmedDesc.length < 5) {
    throw new Error('Category description must be at least 5 characters long.');
  }
  if (trimmedDesc.length > 500) {
    throw new Error('Category description cannot exceed 500 characters.');
  }

  // Duplicate Check (Case-Insensitive excluding current ID)
  const duplicate = await Category.findOne({
    _id: { $ne: id },
    name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' }
  });

  if (duplicate) {
    throw new Error('Category name already exists.');
  }

  category.name = trimmedName;
  category.description = trimmedDesc;

  // Active Visibility Status
  category.status = (data.status === 'Inactive' || data.status === 'off' || data.status === 'false') 
    ? 'Inactive' 
    : 'Active';

  // Replace Banner Image if new file is uploaded
  if (file) {
    const imagePath = file.path && file.path.startsWith('http') 
      ? file.path 
      : `/uploads/category-banners/${file.filename}`;
    category.image = imagePath;
    category.imageId = file.filename || file.public_id || '';
  }

  return await category.save();
};

export const toggleCategoryStatus = async (id) => {
  const category = await Category.findOne({ _id: id });
  if (!category) {
    throw new Error('Category not found.');
  }

  category.status = category.status === 'Active' ? 'Inactive' : 'Active';
  await category.save();
  return category.status;
};

