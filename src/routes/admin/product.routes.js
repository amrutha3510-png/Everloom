import express from 'express';
import {
  getProductsPage,
  getAddProductPage,
  createProductHandler,
  getEditProductPage,
  updateProductHandler,
  getDeletedProductsPage,
  softDeleteProductHandler,
  restoreProductHandler
} from '../../controllers/admin/product.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';
import { handleProductImagesUpload } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.use(isAdmin);

router.get('/', getProductsPage);
router.get('/deleted', getDeletedProductsPage);
router.get('/add', getAddProductPage);
router.post('/add', handleProductImagesUpload, createProductHandler);
router.get('/edit/:id', getEditProductPage);
router.post('/edit/:id', handleProductImagesUpload, updateProductHandler);
router.post('/soft-delete/:id', softDeleteProductHandler);
router.post('/restore/:id', restoreProductHandler);

export default router;
