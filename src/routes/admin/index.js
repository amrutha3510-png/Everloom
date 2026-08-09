import express from 'express';
import authRoutes from './auth.routes.js';
import customerRoutes from './customer.routes.js';
import categoryRoutes from './category.routes.js';
import subcategoryRoutes from './subcategory.routes.js';
import productRoutes from './product.routes.js';
import { getAdminDashboard } from '../../controllers/admin/dashboard.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Mount auth routes (which are mostly unauthenticated except logout)
router.use('/', authRoutes);

// Mount dashboard route, protected by isAdmin
router.get('/dashboard', isAdmin, getAdminDashboard);

// Mount customer routes
router.use('/customers', customerRoutes);

// Mount category routes
router.use('/categories', categoryRoutes);

// Mount subcategory routes
router.use('/subcategories', subcategoryRoutes);

// Mount product routes
router.use('/products', productRoutes);

export default router;