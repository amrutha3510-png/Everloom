import { getWishlistCount } from '../services/user/wishlist.service.js';

export const fetchWishlistCount = async (req, res, next) => {
  if (req.session && req.session.user && req.session.user.id) {
    try {
      const userId = req.session.user.id;
      res.locals.wishlistCount = await getWishlistCount(userId);
    } catch (error) {
      console.error('Error fetching wishlist count:', error);
      res.locals.wishlistCount = 0;
    }
  } else {
    res.locals.wishlistCount = 0;
  }
  next();
};
