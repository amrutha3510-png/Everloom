import * as salesReportService from '../../services/admin/salesReport.service.js';

const getLocalTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const validateSalesReportDates = (reportType, customStartDate, customEndDate) => {
  if (reportType === 'custom') {
    if (!customStartDate || !customEndDate) {
      throw new Error('Please select both From Date and To Date.');
    }
    const todayStr = getLocalTodayStr();
    if (customStartDate > todayStr || customEndDate > todayStr) {
      throw new Error('Future dates are not allowed.');
    }
    if (customStartDate > customEndDate) {
      throw new Error('From Date must be before or equal to To Date.');
    }
  }
};

/**
 * Render Sales Report Page.
 */
export const getSalesReportPage = async (req, res) => {
  try {
    const reportType = req.query.reportType || 'monthly';
    const customStartDate = reportType === 'custom' ? (req.query.startDate || null) : null;
    const customEndDate = reportType === 'custom' ? (req.query.endDate || null) : null;

    validateSalesReportDates(reportType, customStartDate, customEndDate);

    const reportData = await salesReportService.getSalesReportData(reportType, customStartDate, customEndDate);

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.query.ajax === 'true') {
      return res.json({
        success: true,
        reportData
      });
    }

    res.render('admin/salesReport/index', {
      title: 'Sales Report',
      layout: 'layouts/admin-layout',
      path: '/admin/sales-report',
      reportData
    });
  } catch (error) {
    console.error('Error loading sales report page:', error.message);
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.query.ajax === 'true') {
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to load sales report'
      });
    }

    const reportType = req.query.reportType || 'monthly';
    const customStartDate = req.query.startDate || null;
    const customEndDate = req.query.endDate || null;

    let reportData;
    try {
      reportData = await salesReportService.getSalesReportData('monthly');
    } catch (err) {
      reportData = {
        reportType: 'monthly',
        dateRange: { start: '', end: '', rawStart: '', rawEnd: '' },
        summary: { totalSalesCount: 0, totalOrderAmount: 0, couponDeductions: 0, totalDiscountAmount: 0, finalSalesAmount: 0 },
        orders: []
      };
    }
    reportData.reportType = reportType;
    if (reportType === 'custom') {
      reportData.dateRange.rawStart = customStartDate || '';
      reportData.dateRange.rawEnd = customEndDate || '';
    }

    res.render('admin/salesReport/index', {
      title: 'Sales Report',
      layout: 'layouts/admin-layout',
      path: '/admin/sales-report',
      reportData,
      toastMessage: error.message || 'Failed to load sales report',
      toastType: 'error'
    });
  }
};

/**
 * Download Sales Report as PDF.
 */
export const exportPdfReport = async (req, res) => {
  try {
    const reportType = req.query.reportType || 'monthly';
    const customStartDate = reportType === 'custom' ? (req.query.startDate || null) : null;
    const customEndDate = reportType === 'custom' ? (req.query.endDate || null) : null;

    validateSalesReportDates(reportType, customStartDate, customEndDate);

    const reportData = await salesReportService.getSalesReportData(reportType, customStartDate, customEndDate);
    const pdfBuffer = await salesReportService.generateSalesReportPDF(reportData);

    const filename = `EverLoom_Sales_Report_${reportType}_${getLocalTodayStr()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Export PDF report error:', error);
    req.session.toast = { type: 'error', message: error.message || 'Failed to generate PDF report' };
    return res.redirect('/admin/sales-report');
  }
};

/**
 * Download Sales Report as Excel.
 */
export const exportExcelReport = async (req, res) => {
  try {
    const reportType = req.query.reportType || 'monthly';
    const customStartDate = reportType === 'custom' ? (req.query.startDate || null) : null;
    const customEndDate = reportType === 'custom' ? (req.query.endDate || null) : null;

    validateSalesReportDates(reportType, customStartDate, customEndDate);

    const reportData = await salesReportService.getSalesReportData(reportType, customStartDate, customEndDate);
    const excelBuffer = await salesReportService.generateSalesReportExcel(reportData);

    const filename = `EverLoom_Sales_Report_${reportType}_${getLocalTodayStr()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(excelBuffer);
  } catch (error) {
    console.error('Export Excel report error:', error);
    req.session.toast = { type: 'error', message: error.message || 'Failed to generate Excel report' };
    return res.redirect('/admin/sales-report');
  }
};
