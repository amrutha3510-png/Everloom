import express from 'express';
import {
  getSubcategoriesPage,
  getAddSubcategoryPage,
  createSubcategoryHandler,
  getEditSubcategoryPage,
  updateSubcategoryHandler,
  getDeletedSubcategoriesPage,
  softDeleteSubcategoryHandler,
  restoreSubcategoryHandler
} from '../../controllers/admin/subcategory.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';
import { uploadSubcategoryImage } from '../../configs/subcategoryUpload.config.js';
import multer from 'multer';

const handleSubcategoryImageUpload = (req, res, next) => {
  uploadSubcategoryImage.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: 'Image must be under 5 MB.',
        LIMIT_UNEXPECTED_FILE: 'Only JPG, JPEG, PNG, and WEBP images are allowed.'
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

const router = express.Router();

router.use(isAdmin);

router.get('/', getSubcategoriesPage);
router.get('/deleted', getDeletedSubcategoriesPage);
router.get('/add', getAddSubcategoryPage);
router.post('/add', handleSubcategoryImageUpload, createSubcategoryHandler);
router.get('/edit/:id', getEditSubcategoryPage);
router.post('/edit/:id', handleSubcategoryImageUpload, updateSubcategoryHandler);
router.post('/soft-delete/:id', softDeleteSubcategoryHandler);
router.post('/restore/:id', restoreSubcategoryHandler);

export default router;
