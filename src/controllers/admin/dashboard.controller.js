import * as dashboardService from '../../services/admin/dashboard.service.js';
import * as salesReportService from '../../services/admin/salesReport.service.js';

/**
 * Validate Custom Date Range inputs.
 */
const validateDateInputs = (startDate, endDate) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  if (!startDate || !endDate) {
    throw new Error('Please select both start and end dates.');
  }
  if (startDate > todayStr || endDate > todayStr) {
    throw new Error('Future dates are not allowed.');
  }
  if (startDate > endDate) {
    throw new Error('Start Date must be before or equal to End Date.');
  }
};

/**
 * Render Admin Dashboard Page with real visual chart datasets and matching summary cards.
 */
export const getAdminDashboard = async (req, res) => {
  try {
    const chartFilter = req.query.chartFilter || req.query.filter || 'monthly';
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    if (chartFilter === 'custom') {
      validateDateInputs(startDate, endDate);
    }

    // 1. Sales Line Chart Dataset (Daily/Weekly/Monthly/Yearly/Custom)
    const salesChart = await dashboardService.getSalesChartData(chartFilter, startDate, endDate);

    // 2. Filtered Summary Metrics for the exact same dataset
    const summary = await dashboardService.getSalesSummaryData(chartFilter, startDate, endDate);

    // 3. Best Selling Products Bar Chart Dataset (Top 5)
    const topProductsBar = await dashboardService.getTop5ProductsBarChart();

    // 4. Payment Method Donut/Pie Chart Dataset (COD, Razorpay, Wallet)
    const paymentChart = await dashboardService.getPaymentMethodChartData();

    // 5. Top Rankings (Top 5 Leaderboards) & Ledger Book
    const topProducts = await dashboardService.getTop5Products();
    const topCategories = await dashboardService.getTop5Categories();
    const ledgerEntries = await dashboardService.getLedgerBookData(5);

    res.render('admin/dashboard/index', {
      title: 'Admin Dashboard',
      layout: 'layouts/admin-layout',
      path: '/admin/dashboard',
      summary,
      salesChart,
      topProductsBar,
      paymentChart,
      topProducts,
      topCategories,
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
      ledgerEntries: []
    });
  }
};

/**
 * REST API for Live Sales Chart & Summary Card Filter AJAX Updates.
 */
export const getDashboardChartApi = async (req, res) => {
  try {
    const filter = req.query.filter || 'monthly';
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    if (filter === 'custom') {
      validateDateInputs(startDate, endDate);
    }

    const salesChart = await dashboardService.getSalesChartData(filter, startDate, endDate);
    const summary = await dashboardService.getSalesSummaryData(filter, startDate, endDate);

    return res.status(200).json({ success: true, salesChart, summary });
  } catch (error) {
    console.error('Error fetching sales chart API:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to fetch sales chart data' });
  }
};

