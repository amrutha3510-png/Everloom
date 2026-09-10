import Category from '../models/categoryModel.js';

export const fetchCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isDeleted: false, status: 'Active' }).sort({ name: 1 }).lean();
    res.locals.categories = categories || [];
  } catch (error) {
    console.error('Error fetching navbar categories:', error);
    res.locals.categories = [];
  }
  next();
};
