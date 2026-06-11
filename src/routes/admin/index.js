import express from 'express';
import authRoutes from './auth.routes.js';
import { getAdminDashboard } from '../../controllers/admin/dashboard.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Mount auth routes (which are mostly unauthenticated except logout)
router.use('/', authRoutes);

// Mount dashboard route, protected by isAdmin
router.get('/dashboard', isAdmin, getAdminDashboard);

export default router;