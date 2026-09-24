import { Router } from 'express';
import { getCouponPage, createCoupon, updateCoupon, toggleCouponStatus, deleteCoupon } from '../../controllers/admin/coupon.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(isAdmin);

router.get('/', getCouponPage);
router.post('/create', createCoupon);
router.patch('/:id/edit', updateCoupon);
router.patch('/:id/toggle-status', toggleCouponStatus);
router.delete('/:id/delete', deleteCoupon);

export default router;
