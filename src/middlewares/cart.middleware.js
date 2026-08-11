import { getCartCount } from '../services/user/cart.service.js';

export const fetchCartCount = async (req, res, next) => {
  if (req.session && req.session.user && req.session.user.id) {
    try {
      res.locals.cartCount = await getCartCount(req.session.user.id);
    } catch (error) {
      console.error('Error fetching cart count:', error);
      res.locals.cartCount = 0;
    }
  } else {
    res.locals.cartCount = 0;
  }
  next();
};
