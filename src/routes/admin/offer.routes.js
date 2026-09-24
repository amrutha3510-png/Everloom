import { Router } from 'express';
import { getOfferPage, createOffer, updateOffer, toggleOfferStatus, deleteOffer } from '../../controllers/admin/offer.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(isAdmin);

router.get('/', getOfferPage);
router.post('/create', createOffer);
router.patch('/:id/edit', updateOffer);
router.patch('/:id/toggle-status', toggleOfferStatus);
router.delete('/:id/delete', deleteOffer);

export default router;
