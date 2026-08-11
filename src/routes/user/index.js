import express from "express";

import authRoutes from "./auth.routes.js";
import accountRoutes from "./account.routes.js";
import shopRoutes from "./shop.routes.js";
import cartRoutes from "./cart.routes.js";
import { checkBlocked } from "../../middlewares/auth.middleware.js";
import { fetchCartCount } from "../../middlewares/cart.middleware.js";

const router = express.Router();

// Intercept blocked users for all user routes
router.use(checkBlocked);
router.use(fetchCartCount);

router.use("/", authRoutes);
router.use("/account", accountRoutes);
router.use("/shop", shopRoutes);
router.use("/cart", cartRoutes);

export default router;