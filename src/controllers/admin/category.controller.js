import * as categoryService from '../../services/admin/category.service.js';

export const getCategoriesPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 10;
    const query = {
      status: req.query.status || 'All Status',
      search: req.query.search || '',
      sort: req.query.sort || 'newest'
    };

    const result = await categoryService.getAllCategories(query, page, limit);

    res.render('admin/categories/index', {
      title: 'Category Management',
      categories: result.categories,
      stats: result.stats,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      totalEntries: result.totalEntries,
      searchQuery: query.search,
      statusFilter: query.status,
      sortOption: result.sortOption,
      layout: 'layouts/admin-layout',
      path: '/admin/categories'
    });
  } catch (error) {
    console.error('Error rendering category listing:', error);
    req.session.toast = { type: 'error', message: 'Failed to load categories.' };
    res.redirect('/admin/dashboard');
  }
};

export const getAddCategoryPage = (req, res) => {
  res.render('admin/categories/add', {
    title: 'Add Category',
    layout: 'layouts/admin-layout',
    path: '/admin/categories'
  });
};

export const createCategoryHandler = async (req, res) => {
  try {
    await categoryService.createCategory(req.body, req.file);
    req.session.toast = { type: 'success', message: 'Category created successfully.' };
    return res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error creating category:', error);
    const msg = (error.message || '').toLowerCase();
    const field = (msg.includes('name')) ? 'name' : (msg.includes('description') ? 'description' : 'image');
    

    
    req.session.formErrors = { [field]: error.message || 'Failed to create category.' };
    req.session.oldData = req.body;
    return res.redirect('/admin/categories/add');
  }
};

export const getEditCategoryPage = async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    res.render('admin/categories/edit', {
      title: 'Edit Category',
      category,
      layout: 'layouts/admin-layout',
      path: '/admin/categories'
    });
  } catch (error) {
    console.error('Error loading edit category page:', error);
    req.session.toast = { type: 'error', message: error.message || 'Category not found.' };
    res.redirect('/admin/categories');
  }
};

export const updateCategoryHandler = async (req, res) => {
  try {
    await categoryService.updateCategory(req.params.id, req.body, req.file);
    req.session.toast = { type: 'success', message: 'Category updated successfully.' };
    return res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error updating category:', error);
    const msg = (error.message || '').toLowerCase();
    const field = (msg.includes('name')) ? 'name' : (msg.includes('description') ? 'description' : 'image');



    req.session.formErrors = { [field]: error.message || 'Failed to update category.' };
    req.session.oldData = req.body;
    return res.redirect(`/admin/categories/edit/${req.params.id}`);
  }
};

export const toggleCategoryStatusHandler = async (req, res) => {
  try {
    const newStatus = await categoryService.toggleCategoryStatus(req.params.id);
    return res.json({ success: true, newStatus, message: `Category status updated to ${newStatus}.` });
  } catch (error) {
    console.error('Error toggling category status:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update category status.' });
  }
};

export const getDeletedCategoriesPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 10;
    const query = {
      search: req.query.search || '',
      sort: req.query.sort || 'newest'
    };

    const result = await categoryService.getDeletedCategories(query, page, limit);

    res.render('admin/categories/deleted', {
      title: 'Deleted Categories',
      categories: result.categories,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      totalEntries: result.totalEntries,
      searchQuery: query.search,
      sortOption: result.sortOption,
      layout: 'layouts/admin-layout',
      path: '/admin/categories'
    });
  } catch (error) {
    console.error('Error rendering deleted category listing:', error);
    req.session.toast = { type: 'error', message: 'Failed to load deleted categories.' };
    res.redirect('/admin/categories');
  }
};

export const softDeleteCategoryHandler = async (req, res) => {
  try {
    await categoryService.softDeleteCategory(req.params.id);
    return res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    console.error('Error soft deleting category:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to delete category.' });
  }
};

export const restoreCategoryHandler = async (req, res) => {
  try {
    await categoryService.restoreCategory(req.params.id);
    return res.json({ success: true, message: 'Category restored successfully.' });
  } catch (error) {
    console.error('Error restoring category:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to restore category.' });
  }
};

