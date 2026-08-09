import express from 'express';
import multer from 'multer';
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
import { uploadProductImages } from '../../configs/productUpload.config.js';

const router = express.Router();

router.use(isAdmin);

const handleProductImagesUpload = (req, res, next) => {
  uploadProductImages.array('images', 10)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: 'Each image must be under 5 MB.',
        LIMIT_UNEXPECTED_FILE: err.field === 'images' ? 'Maximum 10 images allowed.' : 'Only JPG, JPEG, PNG, and WEBP images are allowed.'
      };
      req.session.formErrors = { images: messages[err.code] || err.message };
      req.session.oldData = req.body;
      return res.redirect(req.originalUrl);
    }
    if (err) {
      req.session.formErrors = { images: err.message || 'Image upload failed.' };
      req.session.oldData = req.body;
      return res.redirect(req.originalUrl);
    }
    next();
  });
};

router.get('/', getProductsPage);
router.get('/deleted', getDeletedProductsPage);
router.get('/add', getAddProductPage);
router.post('/add', handleProductImagesUpload, createProductHandler);
router.get('/edit/:id', getEditProductPage);
router.post('/edit/:id', handleProductImagesUpload, updateProductHandler);
router.post('/soft-delete/:id', softDeleteProductHandler);
router.post('/restore/:id', restoreProductHandler);

export default router;
