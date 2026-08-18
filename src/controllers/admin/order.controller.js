import * as orderService from '../../services/admin/order.service.js';

export const getOrdersPage = async (req, res) => {
  try {
    const queryParams = req.query;
    const currentPage = parseInt(queryParams.page) || 1;
    const limit = 10;

    const query = {
      search: queryParams.search || '',
      status: queryParams.status || 'All',
      sort: queryParams.sort || 'Newest First'
    };

    const result = await orderService.getAllOrders(query, currentPage, limit);

    res.render('admin/orders/index', {
      title: 'Order Management',
      orders: result.orders,
      stats: result.stats,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      totalEntries: result.totalEntries,
      searchQuery: query.search,
      statusFilter: query.status,
      sortOption: query.sort,
      layout: 'layouts/admin-layout',
      path: '/admin/orders'
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    req.session.toast = { type: 'error', message: 'Failed to load orders.' };
    res.redirect('/admin/dashboard');
  }
};

export const getOrderDetailsPage = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await orderService.getOrderById(orderId);

    res.render('admin/orders/details', {
      title: `Order Details #${order._id}`,
      order,
      layout: 'layouts/admin-layout',
      path: '/admin/orders'
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    req.session.toast = { type: 'error', message: error.message || 'Failed to load order details.' };
    res.redirect('/admin/orders');
  }
};

export const updateOrderStatusHandler = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;
    
    await orderService.updateOrderStatus(orderId, status);
    
    req.session.toast = { type: 'success', message: 'Order status updated successfully.' };
    res.redirect(`/admin/orders/${orderId}`);
  } catch (error) {
    console.error('Error updating order status:', error);
    req.session.toast = { type: 'error', message: error.message || 'Failed to update order status.' };
    res.redirect(`/admin/orders/${req.params.id}`);
  }
};
