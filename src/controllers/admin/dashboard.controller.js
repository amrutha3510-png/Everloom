import * as dashboardService from '../../services/admin/dashboard.service.js';
import * as salesReportService from '../../services/admin/salesReport.service.js';

/**
 * Render Admin Dashboard Page with real visual chart datasets.
 */
export const getAdminDashboard = async (req, res) => {
  try {
    const chartFilter = req.query.chartFilter || 'monthly';
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    // 1. Overall Monthly Summary Metrics
    const monthlyReport = await salesReportService.getSalesReportData('monthly');

    // 2. Sales Line Chart Dataset (Daily/Weekly/Monthly/Yearly/Custom)
    const salesChart = await dashboardService.getSalesChartData(chartFilter, startDate, endDate);

    // 3. Best Selling Products Bar Chart Dataset
    const topProductsBar = await dashboardService.getTop10ProductsBarChart();

    // 4. Payment Method Donut/Pie Chart Dataset (COD, Razorpay, Wallet)
    const paymentChart = await dashboardService.getPaymentMethodChartData();

    // 5. Top Rankings & Ledger Book
    const topProducts = await dashboardService.getTop10Products();
    const topCategories = await dashboardService.getTop10Categories();
    const topBrands = await dashboardService.getTop10Brands();
    const ledgerEntries = await dashboardService.getLedgerBookData(20);

    res.render('admin/dashboard/index', {
      title: 'Admin Dashboard',
      layout: 'layouts/admin-layout',
      path: '/admin/dashboard',
      summary: monthlyReport.summary,
      salesChart,
      topProductsBar,
      paymentChart,
      topProducts,
      topCategories,
      topBrands,
      ledgerEntries
    });
  } catch (error) {
    console.error('Error loading Admin Dashboard:', error);
    res.render('admin/dashboard/index', {
      title: 'Admin Dashboard',
      layout: 'layouts/admin-layout',
      path: '/admin/dashboard',
      summary: { totalSalesCount: 0, totalOrderAmount: 0, couponDeductions: 0, finalSalesAmount: 0 },
      salesChart: { labels: [], data: [], filter: 'monthly' },
      topProductsBar: { labels: [], data: [] },
      paymentChart: { labels: ['Cash on Delivery', 'Razorpay Online', 'EverLoom Wallet'], data: [0, 0, 0] },
      topProducts: [],
      topCategories: [],
      topBrands: [],
      ledgerEntries: []
    });
  }
};

/**
 * REST API for Live Sales Chart Filter AJAX Updates.
 */
export const getDashboardChartApi = async (req, res) => {
  try {
    const filter = req.query.filter || 'monthly';
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    const salesChart = await dashboardService.getSalesChartData(filter, startDate, endDate);
    return res.status(200).json({ success: true, salesChart });
  } catch (error) {
    console.error('Error fetching sales chart API:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sales chart data' });
  }
};
