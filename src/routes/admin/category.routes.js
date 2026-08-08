import express from 'express';
import multer from 'multer';
import {
  getCategoriesPage,
  getAddCategoryPage,
  createCategoryHandler,
  getEditCategoryPage,
  updateCategoryHandler,
  toggleCategoryStatusHandler
} from '../../controllers/admin/category.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';
import { uploadCategoryBanner } from '../../configs/categoryUpload.config.js';

const router = express.Router();

router.use(isAdmin);

// Multer error handling wrapper for banner uploads
const handleBannerUpload = (req, res, next) => {
  uploadCategoryBanner.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: 'Banner image size must be under 5 MB.',
        LIMIT_UNEXPECTED_FILE: err.field || 'Only JPG, JPEG, PNG, and WEBP images are allowed.'
      };
      req.session.formErrors = { image: messages[err.code] || err.message };
      req.session.oldData = req.body;
      return res.redirect(req.originalUrl);
    }
    if (err) {
      req.session.formErrors = { image: err.message || 'Image upload failed.' };
      req.session.oldData = req.body;
      return res.redirect(req.originalUrl);
    }
    next();
  });
};

router.get('/', getCategoriesPage);
router.get('/add', getAddCategoryPage);
router.post('/add', handleBannerUpload, createCategoryHandler);
router.get('/edit/:id', getEditCategoryPage);
router.post('/edit/:id', handleBannerUpload, updateCategoryHandler);
router.post('/toggle-status/:id', toggleCategoryStatusHandler);

export default router;
