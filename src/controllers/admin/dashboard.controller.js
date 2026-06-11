export const getAdminDashboard = (req, res) => {
    res.render('admin/dashboard/index', {
        title: 'Admin Dashboard',
        layout: 'layouts/admin-layout'
    });
};
