import express from 'express';
import * as checkoutController from '../../controllers/user/checkout.controller.js';
import { isUser, isUserPage } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', isUserPage, checkoutController.getCheckoutPage);
router.post('/place-order', isUser, checkoutController.placeOrder);
router.get('/success', isUserPage, checkoutController.getSuccessPage);

export default router;
