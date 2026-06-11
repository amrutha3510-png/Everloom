import { validateAdminLogin } from '../../services/admin/auth.service.js';

export const getAdminLoginPage = (req, res) => {
    res.render('admin/auth/login', {
        title: 'Admin Login',
        layout: 'layouts/admin-layout',
        hideNavigation: true
    });
};

export const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            req.session.toast = { type: 'error', message: 'All fields are required.' };
            req.session.oldData = { email };
            return res.redirect('/admin/login');
        }

        const result = await validateAdminLogin(email, password);

        if (result.success) {
            req.session.admin = { id: result.admin._id, email: result.admin.email };
            req.session.toast = { type: 'success', message: 'Welcome back, Admin.' };
            return req.session.save((err) => {
                if (err) console.error('Session save error:', err);
                return res.redirect('/admin/dashboard');
            });
        } else {
            req.session.toast = { type: 'error', message: result.message };
            req.session.oldData = { email };
            return res.redirect('/admin/login');
        }
    } catch (error) {
        console.error('Admin Login Error:', error);
        req.session.toast = { type: 'error', message: 'An error occurred during login. Please try again.' };
        return res.redirect('/admin/login');
    }
};

export const logoutAdmin = (req, res) => {
    if (req.session) {
        delete req.session.admin;
    }
    req.session.toast = { type: 'success', message: 'Admin logged out successfully.' };
    return req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        return res.redirect('/admin/login');
    });
};
