import * as customerService from '../../services/admin/customer.service.js';

export const getCustomersPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const query = {
      status: req.query.status || 'All Status',
      search: req.query.search || ''
    };

    const result = await customerService.getAllCustomers(query, page, limit);

    res.render('admin/customers/customers', {
      title: 'Customer Management',
      customers: result.customers,
      stats: result.stats,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      totalEntries: result.totalEntries,
      searchQuery: query.search,
      statusFilter: query.status,
      layout: 'layouts/admin-layout',
      path: '/admin/customers'
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    req.session.toast = { type: 'error', message: 'Failed to load customers.' };
    res.redirect('/admin/dashboard');
  }
};

export const toggleCustomerStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const newStatus = await customerService.toggleCustomerStatus(userId);
    
    return res.json({ success: true, newStatus });
  } catch (error) {
    console.error('Error toggling customer status:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

