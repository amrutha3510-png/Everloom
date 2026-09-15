import express from 'express';
import {
  getOrdersPage,
  getOrderDetailsPage,
  updateOrderStatusHandler,
  approveOrderCancellationHandler,
  approveOrderItemCancellationHandler
} from '../../controllers/admin/order.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(isAdmin);

router.get('/', getOrdersPage);
router.get('/:id', getOrderDetailsPage);
router.post('/:id/update-status', updateOrderStatusHandler);
router.post('/:id/approve-cancellation', approveOrderCancellationHandler);
router.post('/:id/items/:itemId/approve-cancellation', approveOrderItemCancellationHandler);

export default router;
