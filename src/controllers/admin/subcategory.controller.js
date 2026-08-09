import * as subcategoryService from '../../services/admin/subcategory.service.js';
import Category from '../../models/categoryModel.js';

export const getSubcategoriesPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 10;
    const query = {
      status: req.query.status || 'All Status',
      category: req.query.category || 'All Categories',
      search: req.query.search || '',
      sort: req.query.sort || 'newest'
    };

    const categories = await Category.find({ isDeleted: false }).lean();

    const result = await subcategoryService.getAllSubcategories(query, page, limit);

    res.render('admin/subcategories/index', {
      title: 'Subcategory Management',
      subcategories: result.subcategories,
      stats: result.stats,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      totalEntries: result.totalEntries,
      searchQuery: query.search,
      statusFilter: query.status,
      categoryFilter: query.category,
      categories,
      sortOption: result.sortOption,
      layout: 'layouts/admin-layout',
      path: '/admin/subcategories'
    });
  } catch (error) {
    console.error('Error rendering subcategory listing:', error);
    req.session.toast = { type: 'error', message: 'Failed to load subcategories.' };
    res.redirect('/admin/dashboard');
  }
};

export const getDeletedSubcategoriesPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 10;
    const query = {
      search: req.query.search || '',
      sort: req.query.sort || 'newest'
    };

    const result = await subcategoryService.getDeletedSubcategories(query, page, limit);

    res.render('admin/subcategories/deleted', {
      title: 'Deleted Subcategories',
      subcategories: result.subcategories,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      totalEntries: result.totalEntries,
      searchQuery: query.search,
      sortOption: result.sortOption,
      layout: 'layouts/admin-layout',
      path: '/admin/subcategories'
    });
  } catch (error) {
    console.error('Error rendering deleted subcategory listing:', error);
    req.session.toast = { type: 'error', message: 'Failed to load deleted subcategories.' };
    res.redirect('/admin/subcategories');
  }
};

export const getAddSubcategoryPage = async (req, res) => {
  try {
    const categories = await Category.find({ status: 'Active', isDeleted: false }).lean();
    res.render('admin/subcategories/add', {
      title: 'Add Subcategory',
      categories,
      layout: 'layouts/admin-layout',
      path: '/admin/subcategories'
    });
  } catch (error) {
    console.error('Error loading add subcategory page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load page.' };
    res.redirect('/admin/subcategories');
  }
};

export const createSubcategoryHandler = async (req, res) => {
  try {
    await subcategoryService.createSubcategory(req.body, req.file);
    req.session.toast = { type: 'success', message: 'Subcategory created successfully.' };
    return res.redirect('/admin/subcategories');
  } catch (error) {
    console.error('Error creating subcategory:', error);
    const msg = (error.message || '').toLowerCase();
    
    let field = 'name';
    if (msg.includes('category')) field = 'category';
    else if (msg.includes('description')) field = 'description';
    else if (msg.includes('image')) field = 'image';

    req.session.formErrors = { [field]: error.message || 'Failed to create subcategory.' };
    req.session.oldData = req.body;
    return res.redirect('/admin/subcategories/add');
  }
};

export const getEditSubcategoryPage = async (req, res) => {
  try {
    const subcategory = await subcategoryService.getSubcategoryById(req.params.id);
    const categories = await Category.find({ status: 'Active', isDeleted: false }).lean();
    
    // Ensure current subcategory's category is included even if inactive
    if (!categories.some(c => c._id.toString() === subcategory.category._id.toString())) {
      const currentCat = await Category.findOne({ _id: subcategory.category._id, isDeleted: false }).lean();
      if (currentCat) {
        categories.push(currentCat);
      }
    }

    res.render('admin/subcategories/edit', {
      title: 'Edit Subcategory',
      subcategory,
      categories,
      layout: 'layouts/admin-layout',
      path: '/admin/subcategories'
    });
  } catch (error) {
    console.error('Error loading edit subcategory page:', error);
    req.session.toast = { type: 'error', message: error.message || 'Subcategory not found.' };
    res.redirect('/admin/subcategories');
  }
};

export const updateSubcategoryHandler = async (req, res) => {
  try {
    await subcategoryService.updateSubcategory(req.params.id, req.body, req.file);
    req.session.toast = { type: 'success', message: 'Subcategory updated successfully.' };
    return res.redirect('/admin/subcategories');
  } catch (error) {
    console.error('Error updating subcategory:', error);
    const msg = (error.message || '').toLowerCase();
    
    let field = 'name';
    if (msg.includes('category')) field = 'category';
    else if (msg.includes('description')) field = 'description';
    else if (msg.includes('image')) field = 'image';

    req.session.formErrors = { [field]: error.message || 'Failed to update subcategory.' };
    req.session.oldData = req.body;
    return res.redirect(`/admin/subcategories/edit/${req.params.id}`);
  }
};

export const softDeleteSubcategoryHandler = async (req, res) => {
  try {
    await subcategoryService.softDeleteSubcategory(req.params.id);
    return res.json({ success: true, message: 'Subcategory deleted successfully.' });
  } catch (error) {
    console.error('Error soft deleting subcategory:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to delete subcategory.' });
  }
};

export const restoreSubcategoryHandler = async (req, res) => {
  try {
    await subcategoryService.restoreSubcategory(req.params.id);
    return res.json({ success: true, message: 'Subcategory restored successfully.' });
  } catch (error) {
    console.error('Error restoring subcategory:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to restore subcategory.' });
  }
};
