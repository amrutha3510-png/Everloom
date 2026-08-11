import express from 'express';
import * as shopController from '../../controllers/user/shop.controller.js';

const router = express.Router();

router.get('/', shopController.getShopPage);
router.get('/product/:id', shopController.getProductDetails);

export default router;
