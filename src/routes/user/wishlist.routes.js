import express from 'express';
import * as wishlistController from '../../controllers/user/wishlist.controller.js';
import { isUser, isUserPage } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', isUserPage, wishlistController.getWishlistPage);
router.post('/add', isUser, wishlistController.addToWishlist);
router.post('/remove', isUser, wishlistController.removeFromWishlist);
router.post('/toggle', isUser, wishlistController.toggleWishlist);
router.post('/move-to-cart', isUser, wishlistController.moveToCart);

export default router;
