import * as productService from '../../services/admin/product.service.js';
import Category from '../../models/categoryModel.js';
import Subcategory from '../../models/subcategoryModel.js';

export const getProductsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 10;
    const query = {
      status: req.query.status || 'All Status',
      category: req.query.category || 'All Categories',
      subcategory: req.query.subcategory || 'All Subcategories',
      search: req.query.search || '',
      sort: req.query.sort || 'newest'
    };

    const result = await productService.getAllProducts(query, page, limit);
    const categories = await Category.find({ isDeleted: false }).lean();
    const subcategories = await Subcategory.find({ isDeleted: false }).lean();

    res.render('admin/products/index', {
      title: 'Product Management',
      products: result.products,
      categories,
      stats: result.stats,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      totalEntries: result.totalEntries,
      searchQuery: query.search,
      statusFilter: query.status,
      categoryFilter: query.category,
      subcategoryFilter: query.subcategory,
      categories,
      subcategories,
      sortOption: result.sortOption,
      layout: 'layouts/admin-layout',
      path: '/admin/products'
    });
  } catch (error) {
    console.error('Error rendering product listing:', error);
    req.session.toast = { type: 'error', message: 'Failed to load products.' };
    res.redirect('/admin/dashboard');
  }
};

export const getDeletedProductsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 10;
    const query = {
      search: req.query.search || '',
      sort: req.query.sort || 'newest'
    };

    const result = await productService.getDeletedProducts(query, page, limit);

    res.render('admin/products/deleted', {
      title: 'Deleted Products',
      products: result.products,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      totalEntries: result.totalEntries,
      searchQuery: query.search,
      sortOption: result.sortOption,
      layout: 'layouts/admin-layout',
      path: '/admin/products'
    });
  } catch (error) {
    console.error('Error rendering deleted product listing:', error);
    req.session.toast = { type: 'error', message: 'Failed to load deleted products.' };
    res.redirect('/admin/products');
  }
};

export const getAddProductPage = async (req, res) => {
  try {
    const categories = await Category.find({ status: 'Active', isDeleted: false }).lean();
    const subcategories = await Subcategory.find({ status: 'Active', isDeleted: false }).lean();
    res.render('admin/products/add', {
      title: 'Add Product',
      categories,
      subcategories,
      layout: 'layouts/admin-layout',
      path: '/admin/products'
    });
  } catch (error) {
    console.error('Error loading add product page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load page.' };
    res.redirect('/admin/products');
  }
};

export const createProductHandler = async (req, res) => {
  try {
    await productService.createProduct(req.body, req.files);
    req.session.toast = { type: 'success', message: 'Product created successfully.' };
    return res.redirect('/admin/products');
  } catch (error) {
    console.error('Error creating product:', error);
    const msg = (error.message || '').toLowerCase();
    
    let field = 'images';
    if (msg.includes('name')) field = 'name';
    else if (msg.includes('description')) field = 'description';
    else if (msg.includes('category')) field = 'category';
    else if (msg.includes('variant')) field = 'variants';

    req.session.formErrors = { [field]: error.message || 'Failed to create product.' };
    req.session.oldData = req.body;
    return res.redirect('/admin/products/add');
  }
};

export const getEditProductPage = async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    const categories = await Category.find({ status: 'Active', isDeleted: false }).lean();
    
    // Ensure current product's category is included even if inactive
    if (!categories.some(c => c._id.toString() === product.category._id.toString())) {
      const currentCat = await Category.findOne({ _id: product.category._id, isDeleted: false }).lean();
      if (currentCat) {
        categories.push(currentCat);
      }
    }

    const subcategories = await Subcategory.find({ status: 'Active', isDeleted: false }).lean();
    // Ensure current product's subcategory is included even if inactive
    if (product.subcategory) {
      const subcategoryId = product.subcategory._id ? product.subcategory._id.toString() : product.subcategory.toString();
      if (!subcategories.some(s => s._id.toString() === subcategoryId)) {
        const currentSub = await Subcategory.findOne({ _id: subcategoryId, isDeleted: false }).lean();
        if (currentSub) {
          subcategories.push(currentSub);
        }
      }
    }

    res.render('admin/products/edit', {
      title: 'Edit Product',
      product,
      categories,
      subcategories,
      layout: 'layouts/admin-layout',
      path: '/admin/products'
    });
  } catch (error) {
    console.error('Error loading edit product page:', error);
    req.session.toast = { type: 'error', message: error.message || 'Product not found.' };
    res.redirect('/admin/products');
  }
};

export const updateProductHandler = async (req, res) => {
  try {
    await productService.updateProduct(req.params.id, req.body, req.files);
    req.session.toast = { type: 'success', message: 'Product updated successfully.' };
    return res.redirect('/admin/products');
  } catch (error) {
    console.error('Error updating product:', error);
    const msg = (error.message || '').toLowerCase();
    
    let field = 'images';
    if (msg.includes('name')) field = 'name';
    else if (msg.includes('description')) field = 'description';
    else if (msg.includes('category')) field = 'category';
    else if (msg.includes('variant')) field = 'variants';

    req.session.formErrors = { [field]: error.message || 'Failed to update product.' };
    req.session.oldData = req.body;
    return res.redirect(`/admin/products/edit/${req.params.id}`);
  }
};

export const softDeleteProductHandler = async (req, res) => {
  try {
    await productService.softDeleteProduct(req.params.id);
    return res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Error soft deleting product:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to delete product.' });
  }
};

export const restoreProductHandler = async (req, res) => {
  try {
    await productService.restoreProduct(req.params.id);
    return res.json({ success: true, message: 'Product restored successfully.' });
  } catch (error) {
    console.error('Error restoring product:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to restore product.' });
  }
};
