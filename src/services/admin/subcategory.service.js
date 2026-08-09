import Subcategory from '../../models/subcategoryModel.js';
import Category from '../../models/categoryModel.js';

const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

export const getAllSubcategories = async (query = {}, page = 1, limit = 10) => {
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

  // Name / Category Search
  if (query.search && query.search.trim()) {
    // To search by Category name, we first need to find matching categories
    const matchingCategories = await Category.find({
      name: { $regex: query.search.trim(), $options: 'i' }
    }).select('_id');
    const categoryIds = matchingCategories.map(c => c._id);

    filter.$or = [
      { name: { $regex: query.search.trim(), $options: 'i' } },
      { category: { $in: categoryIds } }
    ];
  }

  let sortOption = { createdAt: -1 };
  const sortParam = query.sort || 'newest';

  if (sortParam === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sortParam === 'az') {
    sortOption = { name: 1 };
  } else if (sortParam === 'za') {
    sortOption = { name: -1 };
  }

  const subcategories = await Subcategory.find(filter)
    .populate('category', 'name')
    .collation({ locale: 'en', strength: 2 })
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .lean();

  const totalSubcategories = await Subcategory.countDocuments(filter);
  const totalCount = await Subcategory.countDocuments({ isDeleted: false });
  const activeCount = await Subcategory.countDocuments({ status: 'Active', isDeleted: false });
  const inactiveCount = await Subcategory.countDocuments({ status: 'Inactive', isDeleted: false });

  return {
    subcategories,
    totalPages: Math.ceil(totalSubcategories / limit) || 1,
    currentPage: page,
    totalEntries: totalSubcategories,
    sortOption: sortParam,
    stats: {
      total: totalCount,
      active: activeCount,
      inactive: inactiveCount
    }
  };
};

export const getDeletedSubcategories = async (query = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const filter = { isDeleted: true };

  if (query.search && query.search.trim()) {
    const matchingCategories = await Category.find({
      name: { $regex: query.search.trim(), $options: 'i' }
    }).select('_id');
    const categoryIds = matchingCategories.map(c => c._id);

    filter.$or = [
      { name: { $regex: query.search.trim(), $options: 'i' } },
      { category: { $in: categoryIds } }
    ];
  }

  let sortOption = { createdAt: -1 };
  const sortParam = query.sort || 'newest';
  if (sortParam === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sortParam === 'az') {
    sortOption = { name: 1 };
  } else if (sortParam === 'za') {
    sortOption = { name: -1 };
  }

  const subcategories = await Subcategory.find(filter)
    .populate('category', 'name')
    .collation({ locale: 'en', strength: 2 })
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .lean();

  const totalSubcategories = await Subcategory.countDocuments(filter);

  return {
    subcategories,
    totalPages: Math.ceil(totalSubcategories / limit) || 1,
    currentPage: page,
    totalEntries: totalSubcategories,
    sortOption: sortParam,
  };
};

export const getSubcategoryById = async (id) => {
  const subcategory = await Subcategory.findOne({ _id: id }).populate('category').lean();
  if (!subcategory) throw new Error('Subcategory not found.');
  return subcategory;
};

export const createSubcategory = async (data, file) => {
  const trimmedName = (data.name || '').trim();
  const trimmedDesc = (data.description || '').trim();

  if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 50) {
    throw new Error('Subcategory name must be between 2 and 50 characters.');
  }
  if (!/^[a-zA-Z0-9\s\-_&]+$/.test(trimmedName)) {
    throw new Error('Name contains invalid characters.');
  }
  if (!trimmedDesc || trimmedDesc.length < 10) {
    throw new Error('Description must be at least 10 characters long.');
  }

  const category = await Category.findOne({ _id: data.category, isDeleted: false });
  if (!category) {
    throw new Error('Invalid or deleted category selected.');
  }

  // Duplicate Check under the same Category
  const duplicate = await Subcategory.findOne({
    category: data.category,
    name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' },
    isDeleted: false
  });
  if (duplicate) {
    throw new Error('Subcategory already exists in this category.');
  }

  if (!file) {
    throw new Error('Subcategory image is required.');
  }

  const imagePath = file.path && file.path.startsWith('http') 
    ? file.path 
    : `/uploads/subcategory-images/${file.filename}`;

  const status = (data.status === 'Inactive' || data.status === 'off' || data.status === 'false') ? 'Inactive' : 'Active';

  const newSubcategory = new Subcategory({
    name: trimmedName,
    description: trimmedDesc,
    category: data.category,
    image: imagePath,
    imageId: file.filename || file.public_id || '',
    status
  });

  return await newSubcategory.save();
};

export const updateSubcategory = async (id, data, file) => {
  const subcategory = await Subcategory.findOne({ _id: id });
  if (!subcategory) throw new Error('Subcategory not found.');

  const trimmedName = (data.name || '').trim();
  const trimmedDesc = (data.description || '').trim();

  if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 50) {
    throw new Error('Subcategory name must be between 2 and 50 characters.');
  }
  if (!/^[a-zA-Z0-9\s\-_&]+$/.test(trimmedName)) {
    throw new Error('Name contains invalid characters.');
  }
  if (!trimmedDesc || trimmedDesc.length < 10) {
    throw new Error('Description must be at least 10 characters long.');
  }

  const category = await Category.findOne({ _id: data.category, isDeleted: false });
  if (!category && data.category !== subcategory.category.toString()) {
    throw new Error('Invalid or deleted category selected.');
  }

  const duplicate = await Subcategory.findOne({
    _id: { $ne: id },
    category: data.category,
    name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' },
    isDeleted: false
  });
  if (duplicate) {
    throw new Error('Subcategory already exists in this category.');
  }

  subcategory.name = trimmedName;
  subcategory.description = trimmedDesc;
  subcategory.category = data.category;
  subcategory.status = (data.status === 'Inactive' || data.status === 'off' || data.status === 'false') ? 'Inactive' : 'Active';

  if (file) {
    const imagePath = file.path && file.path.startsWith('http') 
      ? file.path 
      : `/uploads/subcategory-images/${file.filename}`;
    subcategory.image = imagePath;
    subcategory.imageId = file.filename || file.public_id || '';
  }

  return await subcategory.save();
};

export const softDeleteSubcategory = async (id) => {
  const subcategory = await Subcategory.findOne({ _id: id });
  if (!subcategory) throw new Error('Subcategory not found.');
  subcategory.isDeleted = true;
  await subcategory.save();
  return true;
};

export const restoreSubcategory = async (id) => {
  const subcategory = await Subcategory.findOne({ _id: id });
  if (!subcategory) throw new Error('Subcategory not found.');
  subcategory.isDeleted = false;
  await subcategory.save();
  return true;
};
