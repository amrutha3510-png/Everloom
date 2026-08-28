import express from 'express';
import {
  getReturnRequestsPage,
  declineReturnHandler
} from '../../controllers/admin/order.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(isAdmin);

router.get('/', getReturnRequestsPage);
router.post('/:id/decline', declineReturnHandler);

export default router;
