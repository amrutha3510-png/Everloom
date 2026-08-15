import * as shopService from '../../services/user/shop.service.js';
import Category from '../../models/categoryModel.js';
import Subcategory from '../../models/subcategoryModel.js';
import Product from '../../models/productModel.js';

export const getShopPage = async (req, res) => {
  try {
    const queryParams = req.query;
    const currentPage = parseInt(queryParams.page, 10) || 1;
    const limit = 12; // 3x4 or 4x3 grid
    const query = {
      search: queryParams.search || '',
      category: queryParams.category || 'All Categories',
      subcategory: queryParams.subcategory || '',
      minPrice: queryParams.minPrice || '',
      maxPrice: queryParams.maxPrice || '',
      size: queryParams.size || '',
      sort: queryParams.sort || 'newest'
    };

    const buildQueryString = (params) => {
      const q = new URLSearchParams();
      for (const key in params) {
        if (params[key] && params[key] !== 'All Categories') {
          if (Array.isArray(params[key])) {
            params[key].forEach(val => q.append(key, val));
          } else {
            q.append(key, params[key]);
          }
        }
      }
      return q.toString();
    };

    const paginationQueryString = buildQueryString({
      search: query.search,
      category: query.category,
      subcategory: query.subcategory,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      size: query.size,
      sort: query.sort
    });

    const categories = await Category.find({ isDeleted: false, status: 'Active' }).lean();
    const subcategories = await Subcategory.find({ isDeleted: false, status: 'Active' }).lean();
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const result = await shopService.getListedProducts(query, currentPage, limit);

    res.render('user/shop/index', {
      title: 'Shop',
      products: result.products,
      categories,
      subcategories,
      sizes,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      totalEntries: result.totalEntries,
      searchQuery: query.search,
      categoryFilter: query.category,
      subcategoryFilter: query.subcategory,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      sizeFilter: query.size,
      sortOption: result.sortOption,
      paginationQueryString,
      layout: 'layouts/user-layout',
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Error in getShopPage:', error);
    req.session.toast = { type: 'error', message: 'Failed to load shop page.' };
    res.redirect('/');
  }
};

export const getProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await shopService.getProductById(productId);

    if (!product) {
      req.session.toast = { type: 'error', message: 'Product is currently unavailable.' };
      return res.redirect('/shop');
    }

    const relatedProducts = await shopService.getRelatedProducts(product.category._id, product.subcategory._id, product._id);

    res.render('user/shop/product-details', {
      title: product.name,
      product,
      relatedProducts,
      layout: 'layouts/user-layout',
      user: req.session.user || null
    });

  } catch (error) {
    console.error('Error in getProductDetails:', error);
    req.session.toast = { type: 'error', message: 'Failed to load product details.' };
    res.redirect('/shop');
  }
};
