import * as salesReportService from '../../services/admin/salesReport.service.js';

/**
 * Render Sales Report Page.
 */
export const getSalesReportPage = async (req, res) => {
  try {
    const reportType = req.query.reportType || 'monthly';
    const customStartDate = req.query.startDate || null;
    const customEndDate = req.query.endDate || null;

    const reportData = await salesReportService.getSalesReportData(reportType, customStartDate, customEndDate);

    res.render('admin/salesReport/index', {
      title: 'Sales Report',
      layout: 'layouts/admin-layout',
      path: '/admin/sales-report',
      reportData
    });
  } catch (error) {
    console.error('Error loading sales report page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load sales report' };
    res.redirect('/admin/dashboard');
  }
};

/**
 * Download Sales Report as PDF.
 */
export const exportPdfReport = async (req, res) => {
  try {
    const reportType = req.query.reportType || 'monthly';
    const customStartDate = req.query.startDate || null;
    const customEndDate = req.query.endDate || null;

    const reportData = await salesReportService.getSalesReportData(reportType, customStartDate, customEndDate);
    const pdfBuffer = await salesReportService.generateSalesReportPDF(reportData);

    const filename = `EverLoom_Sales_Report_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Export PDF report error:', error);
    req.session.toast = { type: 'error', message: 'Failed to generate PDF report' };
    return res.redirect('/admin/sales-report');
  }
};

/**
 * Download Sales Report as Excel.
 */
export const exportExcelReport = async (req, res) => {
  try {
    const reportType = req.query.reportType || 'monthly';
    const customStartDate = req.query.startDate || null;
    const customEndDate = req.query.endDate || null;

    const reportData = await salesReportService.getSalesReportData(reportType, customStartDate, customEndDate);
    const excelBuffer = await salesReportService.generateSalesReportExcel(reportData);

    const filename = `EverLoom_Sales_Report_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(excelBuffer);
  } catch (error) {
    console.error('Export Excel report error:', error);
    req.session.toast = { type: 'error', message: 'Failed to generate Excel report' };
    return res.redirect('/admin/sales-report');
  }
};
