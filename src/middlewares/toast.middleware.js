export const toastFlash = (req, res, next) => {
  if (req.session) {
    // Expose toast details to views
    if (req.session.toast) {
      res.locals.toastMessage = req.session.toast.message;
      res.locals.toastType = req.session.toast.type;
      delete req.session.toast;
    } else {
      res.locals.toastMessage = null;
      res.locals.toastType = null;
    }
    
    // Expose old data for forms
    if (req.session.oldData) {
      res.locals.oldData = req.session.oldData;
      delete req.session.oldData;
    } else {
      res.locals.oldData = {};
    }

    // Expose user session to all views (used by navbar and other partials)
    res.locals.currentUser = req.session.user || null;
  } else {
    res.locals.toastMessage = null;
    res.locals.toastType = null;
    res.locals.oldData = {};
    res.locals.currentUser = null;
  }
  next();
};
