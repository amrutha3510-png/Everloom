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

router.use(isAdmin);

router.get('/', getBannerPage);
router.post('/create', handleHomeBannerUpload, createBanner);
router.patch('/:id/edit', handleHomeBannerUpload, updateBanner);
router.patch('/:id/select', selectBanner);
router.patch('/:id/toggle-status', toggleBannerStatus);
router.delete('/:id/delete', deleteBanner);

export default router;
