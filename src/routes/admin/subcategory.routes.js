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
import { handleSubcategoryImageUpload } from '../../middlewares/upload.middleware.js';

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
