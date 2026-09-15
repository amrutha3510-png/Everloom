import express from 'express';
import {
  getBannerPage,
  createBanner,
  updateBanner,
  selectBanner,
  toggleBannerStatus,
  deleteBanner
} from '../../controllers/admin/banner.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';
import { handleHomeBannerUpload } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.get('/', isAdmin, getBannerPage);
router.post('/create', isAdmin, handleHomeBannerUpload, createBanner);
router.post('/:id/edit', isAdmin, handleHomeBannerUpload, updateBanner);
router.post('/:id/select', isAdmin, selectBanner);
router.post('/:id/toggle-status', isAdmin, toggleBannerStatus);
router.post('/:id/delete', isAdmin, deleteBanner);

export default router;
