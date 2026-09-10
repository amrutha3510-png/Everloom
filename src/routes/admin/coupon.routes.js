import { Router } from 'express';
import { getCouponPage, createCoupon, toggleCouponStatus, deleteCoupon } from '../../controllers/admin/coupon.controller.js';

const router = Router();

router.get('/', getCouponPage);
router.post('/create', createCoupon);
router.post('/:id/toggle-status', toggleCouponStatus);
router.post('/:id/delete', deleteCoupon);

export default router;
