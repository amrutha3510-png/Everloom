import * as inventoryService from '../../services/admin/inventory.service.js';
import Category from '../../models/categoryModel.js';

export const getInventoryPage = async (req, res) => {
  try {
    const queryParams = req.query;
    const currentPage = parseInt(queryParams.page, 10) || 1;
    const limit = 10;

    const query = {
      search: queryParams.search || '',
      stockStatus: queryParams.stockStatus || 'All',
      category: queryParams.category || 'All Categories',
      sort: queryParams.sort || 'newest'
    };

    const result = await inventoryService.getInventory(query, currentPage, limit);
    const categories = await Category.find({ isDeleted: false }).lean();

    res.render('admin/inventory/index', {
      title: 'Inventory & Stock Management',
      variants: result.variants,
      categories,
      stats: result.stats,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      totalEntries: result.totalEntries,
      searchQuery: query.search,
      stockStatusFilter: query.stockStatus,
      categoryFilter: query.category,
      sortOption: result.sortOption,
      layout: 'layouts/admin-layout',
      path: '/admin/inventory'
    });
  } catch (error) {
    console.error('Error rendering inventory listing:', error);
    req.session.toast = { type: 'error', message: 'Failed to load inventory.' };
    res.redirect('/admin/dashboard');
  }
};

export const updateStock = async (req, res) => {
  try {
    const { productId, variantId, newStock } = req.body;

    if (!productId || !variantId || newStock === undefined || newStock === '') {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const stockVal = parseFloat(newStock);
    if (isNaN(stockVal) || stockVal < 0 || !Number.isInteger(stockVal)) {
      return res.status(400).json({ success: false, message: 'Stock must be a valid non-negative integer.' });
    }

    await inventoryService.updateVariantStock(productId, variantId, stockVal);

    return res.status(200).json({
      success: true,
      message: 'Stock updated successfully.'
    });
  } catch (error) {
    console.error('Error updating variant stock:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update stock.'
    });
  }
};
