import express from 'express';
import authRoutes from './auth.routes.js';
import customerRoutes from './customer.routes.js';
import categoryRoutes from './category.routes.js';
import subcategoryRoutes from './subcategory.routes.js';
import productRoutes from './product.routes.js';
import orderRoutes from './order.routes.js';
import returnRoutes from './return.routes.js';
import inventoryRoutes from './inventory.routes.js';
import offerRoutes from './offer.routes.js';
import couponRoutes from './coupon.routes.js';
import salesReportRoutes from './salesReport.routes.js';
import { getAdminDashboard, getDashboardChartApi } from '../../controllers/admin/dashboard.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Mount auth routes
router.use('/', authRoutes);

// Mount dashboard routes
router.get('/dashboard', isAdmin, getAdminDashboard);
router.get('/dashboard/api/chart-data', isAdmin, getDashboardChartApi);

// Mount management routes
router.use('/customers', customerRoutes);
router.use('/categories', categoryRoutes);
router.use('/subcategories', subcategoryRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/returns', returnRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/offers', offerRoutes);
router.use('/coupons', couponRoutes);
router.use('/sales-report', salesReportRoutes);

export default router;