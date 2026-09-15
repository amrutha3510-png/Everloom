import express from 'express';
import * as shopController from '../../controllers/user/shop.controller.js';
import { isUser } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', shopController.getShopPage);
router.get('/product/:id', shopController.getProductDetails);
router.post('/product/:id/review', isUser, shopController.submitReview);

export default router;

