import express from "express";

import authRoutes from "./auth.routes.js";
import accountRoutes from "./account.routes.js";
import shopRoutes from "./shop.routes.js";
import cartRoutes from "./cart.routes.js";
import wishlistRoutes from "./wishlist.routes.js";
import checkoutRoutes from "./checkout.routes.js";
import { checkBlocked } from "../../middlewares/auth.middleware.js";
import { fetchCartCount } from "../../middlewares/cart.middleware.js";
import { fetchWishlistCount } from "../../middlewares/wishlist.middleware.js";
import { fetchCategories } from "../../middlewares/category.middleware.js";

const router = express.Router();

// Intercept blocked users for all user routes
router.use(checkBlocked);
router.use(fetchCartCount);
router.use(fetchWishlistCount);
router.use(fetchCategories);

router.use("/", authRoutes);
router.use("/account", accountRoutes);
router.use("/shop", shopRoutes);
router.use("/cart", cartRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/checkout", checkoutRoutes);

export default router;