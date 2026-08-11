import express from 'express';
import * as cartController from '../../controllers/user/cart.controller.js';
import { isUser, isUserPage } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', isUserPage, cartController.getCartPage);
router.post('/add', isUser, cartController.addToCart);
router.patch('/update/:itemId', isUser, cartController.updateQuantity);
router.delete('/remove/:itemId', isUser, cartController.removeFromCart);

export default router;
