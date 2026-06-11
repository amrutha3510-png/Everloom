export const isUser = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized. User session required.' });
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
