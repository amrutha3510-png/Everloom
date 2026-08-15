import { getCartCount } from '../services/user/cart.service.js';

export const fetchCartCount = async (req, res, next) => {
  if (req.session && req.session.user && req.session.user.id) {
    try {
      const userId = req.session.user.id;
      res.locals.cartCount = await getCartCount(userId);
    } catch (error) {
      console.error('Error fetching cart count:', error);
      res.locals.cartCount = 0;
    }
  } else {
    res.locals.cartCount = 0;
  }
  next();
};
