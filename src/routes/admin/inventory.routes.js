import express from 'express';
import { getInventoryPage, updateStock } from '../../controllers/admin/inventory.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Protect all routes by isAdmin middleware
router.use(isAdmin);

router.get('/', getInventoryPage);
router.patch('/update', updateStock);

export default router;
