import express from 'express';
import * as checkoutController from '../../controllers/user/checkout.controller.js';
import { isUser, isUserPage } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', isUserPage, checkoutController.getCheckoutPage);
router.post('/apply-coupon', isUser, checkoutController.applyCoupon);
router.post('/remove-coupon', isUser, checkoutController.removeCoupon);
router.post('/place-order', isUser, checkoutController.placeOrder);
router.post('/create-razorpay-order', isUser, checkoutController.createRazorpayOrder);
router.post('/verify-razorpay-payment', isUser, checkoutController.verifyRazorpayPayment);
router.get('/success', isUserPage, checkoutController.getSuccessPage);
router.get('/failure', isUserPage, checkoutController.getFailurePage);

export default router;
