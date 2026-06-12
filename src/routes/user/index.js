import express from "express";

import authRoutes from "./auth.routes.js";
import accountRoutes from "./account.routes.js";
import { checkBlocked } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Intercept blocked users for all user routes
router.use(checkBlocked);

router.use("/", authRoutes);
router.use("/account", accountRoutes);

export default router;