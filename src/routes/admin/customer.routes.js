import express from 'express';
import { getCustomersPage, toggleCustomerStatus } from '../../controllers/admin/customer.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(isAdmin);

router.get('/', getCustomersPage);
router.post('/toggle-status/:id', toggleCustomerStatus);

export default router;

