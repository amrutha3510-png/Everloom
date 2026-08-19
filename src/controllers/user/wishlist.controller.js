import * as wishlistService from '../../services/user/wishlist.service.js';
import * as cartService from '../../services/user/cart.service.js';

export const getWishlistPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      req.session.toast = { type: 'error', message: 'Please login to view your wishlist' };
      return res.redirect('/login');
    }

    const wishlist = await wishlistService.getWishlist(userId);

    res.render('user/wishlist/index', {
      title: 'My Wishlist',
      wishlist,
      layout: 'layouts/user-layout',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading wishlist page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load wishlist' };
    res.redirect('/');
  }
};

export const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to add items to wishlist' });
    }

    const { productId, size, color } = req.body;
    if (!productId || !size || !color) {
      return res.status(400).json({ success: false, message: 'Missing required options' });
    }

    await wishlistService.addToWishlist(userId, productId, size, color);
    res.status(200).json({ success: true, message: 'Item added to wishlist successfully' });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to add item to wishlist' });
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { productId, size, color } = req.body;
    if (!productId || !size || !color) {
      return res.status(400).json({ success: false, message: 'Missing required options' });
    }

    await wishlistService.removeFromWishlist(userId, productId, size, color);
    res.status(200).json({ success: true, message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(400).json({ success: false, message: 'Failed to remove item' });
  }
};

export const toggleWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to manage wishlist' });
    }

    const { productId, size, color } = req.body;
    if (!productId || !size || !color) {
      return res.status(400).json({ success: false, message: 'Missing required options' });
    }

    const wishlist = await wishlistService.getWishlist(userId);
    const exists = wishlist.items.some(item => 
      item.product._id.toString() === productId.toString() &&
      item.variant.size === size &&
      item.variant.color === color
    );

    if (exists) {
      await wishlistService.removeFromWishlist(userId, productId, size, color);
      res.status(200).json({ success: true, action: 'removed', message: 'Item removed from wishlist' });
    } else {
      await wishlistService.addToWishlist(userId, productId, size, color);
      res.status(200).json({ success: true, action: 'added', message: 'Item added to wishlist' });
    }
  } catch (error) {
    console.error('Toggle wishlist error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to toggle wishlist' });
  }
};

export const moveToCart = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { productId, size, color } = req.body;
    if (!productId || !size || !color) {
      return res.status(400).json({ success: false, message: 'Missing required options' });
    }

    // Call cart service to add to cart (which automatically pulls from wishlist)
    await cartService.addToCart(userId, productId, size, color, 1);
    const cartCount = await cartService.getCartCount(userId);

    res.status(200).json({ success: true, message: 'Item moved to cart successfully', cartCount });
  } catch (error) {
    console.error('Move to cart error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to move item to cart' });
  }
};
