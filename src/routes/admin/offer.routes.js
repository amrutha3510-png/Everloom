import { Router } from 'express';
import { getOfferPage, createOffer, toggleOfferStatus, deleteOffer } from '../../controllers/admin/offer.controller.js';

const router = Router();

router.get('/', getOfferPage);
router.post('/create', createOffer);
router.post('/:id/toggle-status', toggleOfferStatus);
router.post('/:id/delete', deleteOffer);

export default router;
