import User from '../models/userModel.js';

export const isUser = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized. User session required.' });
};

// For page-render routes: redirects to login instead of returning JSON
export const isUserPage = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.toast = { type: 'error', message: 'Please log in to access your account.' };
  return res.redirect('/login');
};

export const isAdmin = (req, res, next) => {
  if (req.session && req.session.admin) {
    return next();
  }
  req.session.toast = { type: 'error', message: 'Unauthorized. Admin session required.' };
  return res.redirect('/admin/login');
};

export const isAdminGuest = (req, res, next) => {
  if (req.session && req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  next();
};

export const isGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/');
  }
  next();
};

export const checkBlocked = async (req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith('/admin')) {
    return next();
  }

  if (!req.session || !req.session.user) {
    return next();
  }

  try {
    const user = await User.findById(req.session.user.id).select('status');
    if (!user || user.status === 'blocked') {
      // RULE 3: Clear ONLY user session data to prevent clearing admin sessions
      req.session.user = null;
      if (req.session.passport) {
        req.session.passport = null; // Clear passport session for Google users safely
      }
      
      req.session.toast = { type: 'error', message: 'Your account has been blocked.' };
      return req.session.save((err) => {
        if (err) console.error("Session save error during block intercept:", err);
        return res.redirect('/login');
      });
    }
    next();
  } catch (error) {
    console.error("checkBlocked middleware error:", error);
    next(error);
  }
};
