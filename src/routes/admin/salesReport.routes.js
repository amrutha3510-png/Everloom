import { Router } from 'express';
import { getSalesReportPage, exportPdfReport, exportExcelReport } from '../../controllers/admin/salesReport.controller.js';
import { isAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(isAdmin);

router.get('/', getSalesReportPage);
router.get('/pdf', exportPdfReport);
router.get('/excel', exportExcelReport);

export default router;
