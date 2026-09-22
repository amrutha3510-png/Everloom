import * as cartService from '../../services/user/cart.service.js';

export const getCartPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      req.session.toast = { type: 'error', message: 'Please login to view your cart' };
      return res.redirect('/login');
    }

    const cart = await cartService.getCart(userId);

    res.render('user/cart/index', {
      title: 'Shopping Cart',
      cart,
      layout: 'layouts/user-layout',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading cart page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load cart' };
    res.redirect('/');
  }
};

export const addToCart = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to add items to cart' });
    }

    const { productId, size, color, quantity } = req.body;
    
    if (!productId || !size || !color || !quantity) {
      return res.status(400).json({ success: false, message: 'Missing required product options' });
    }

    const parsedQty = parseInt(quantity, 10);
    await cartService.addToCart(userId, productId, size, color, parsedQty);

    const cartCount = await cartService.getCartCount(userId);
    res.status(200).json({ success: true, message: 'Item added to cart successfully', cartCount });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to add item to cart' });
  }
};

export const updateQuantity = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { itemId } = req.params;
    const { action } = req.body;

    await cartService.updateQuantity(userId, itemId, action);
    const cart = await cartService.getCart(userId);
    const cartCount = await cartService.getCartCount(userId);
    const updatedItem = cart.items.find(i => i._id.toString() === itemId.toString());

    res.status(200).json({
      success: true,
      message: 'Quantity updated',
      cartCount,
      cartTotal: cart.cartTotal,
      originalTotal: cart.originalTotal,
      totalOfferDiscount: cart.totalOfferDiscount,
      item: updatedItem
    });
  } catch (error) {
    console.error('Update quantity error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update quantity' });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { itemId } = req.params;
    await cartService.removeFromCart(userId, itemId);
    const cartCount = await cartService.getCartCount(userId);
    res.status(200).json({ success: true, message: 'Item removed from cart', cartCount });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(400).json({ success: false, message: 'Failed to remove item' });
  }
};
