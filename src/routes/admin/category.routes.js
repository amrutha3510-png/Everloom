import express from 'express';
import {
  getCategoriesPage,
  getAddCategoryPage,
  createCategoryHandler,
  getEditCategoryPage,
  updateCategoryHandler,
  toggleCategoryStatusHandler,
  getDeletedCategoriesPage,
  softDeleteCategoryHandler,
  restoreCategoryHandler
} from '../../controllers/admin/category.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';
import { handleBannerUpload } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.use(isAdmin);

router.get('/', getCategoriesPage);
router.get('/deleted', getDeletedCategoriesPage);
router.get('/add', getAddCategoryPage);
router.post('/add', handleBannerUpload, createCategoryHandler);
router.get('/edit/:id', getEditCategoryPage);
router.post('/edit/:id', handleBannerUpload, updateCategoryHandler);
router.post('/toggle-status/:id', toggleCategoryStatusHandler);
router.post('/soft-delete/:id', softDeleteCategoryHandler);
router.post('/restore/:id', restoreCategoryHandler);

export default router;
