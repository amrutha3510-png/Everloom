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
router.route('/add')
  .get(getAddCategoryPage)
  .post(handleBannerUpload, createCategoryHandler);
router.route('/edit/:id')
  .get(getEditCategoryPage)
  .post(handleBannerUpload, updateCategoryHandler);
router.post('/toggle-status/:id', toggleCategoryStatusHandler);
router.post('/soft-delete/:id', softDeleteCategoryHandler);
router.post('/restore/:id', restoreCategoryHandler);

export default router;
