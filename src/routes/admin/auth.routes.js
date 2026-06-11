import express from 'express';
import { getAdminLoginPage, loginAdmin, logoutAdmin } from '../../controllers/admin/auth.controller.js';
import { isAdminGuest, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/login', isAdminGuest, getAdminLoginPage);
router.post('/login', isAdminGuest, loginAdmin);
router.post('/logout', isAdmin, logoutAdmin);

export default router;