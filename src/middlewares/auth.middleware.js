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
  return res.status(403).json({ success: false, message: 'Forbidden. Admin session required.' });
};
