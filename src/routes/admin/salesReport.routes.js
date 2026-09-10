import { Router } from 'express';
import { getSalesReportPage, exportPdfReport, exportExcelReport } from '../../controllers/admin/salesReport.controller.js';

const router = Router();

router.get('/', getSalesReportPage);
router.get('/pdf', exportPdfReport);
router.get('/excel', exportExcelReport);

export default router;
