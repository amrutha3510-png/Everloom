import * as bannerService from '../../services/admin/banner.service.js';

/**
 * Render Banner Management Page.
 */
export const getBannerPage = async (req, res) => {
  try {
    const banners = await bannerService.getAllBanners();

    res.render('admin/banners/index', {
      title: 'Banner Management',
      layout: 'layouts/admin-layout',
      path: '/admin/banners',
      banners
    });
  } catch (error) {
    console.error('Error loading banner page:', error);
    req.session.toast = { type: 'error', message: 'Failed to load banners page' };
    res.redirect('/admin/dashboard');
  }
};

/**
 * Create a new Banner.
 */
export const createBanner = async (req, res) => {
  try {
    const { title, status } = req.body;
    let imageUrl = '';

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Banner title is required.' });
    }

    if (req.file) {
      imageUrl = req.file.path || (req.file.filename ? `/uploads/home-banners/${req.file.filename}` : '');
    } else if (req.body.image) {
      imageUrl = req.body.image;
    }

    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Banner image is required.' });
    }

    const banner = await bannerService.createBanner({
      title,
      image: imageUrl,
      status
    });

    return res.status(200).json({ success: true, message: `Banner "${banner.title}" created successfully!`, banner });
  } catch (error) {
    console.error('Create banner error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to create banner' });
  }
};

/**
 * Update an existing Banner.
 */
export const updateBanner = async (req, res) => {
  try {
    const bannerId = req.params.id;
    const { title, status } = req.body;
    let imageUrl = '';

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Banner title is required.' });
    }

    if (req.file) {
      imageUrl = req.file.path || (req.file.filename ? `/uploads/home-banners/${req.file.filename}` : '');
    } else if (req.body.image) {
      imageUrl = req.body.image;
    }

    const updatedBanner = await bannerService.updateBanner(bannerId, {
      title,
      status,
      image: imageUrl
    });

    return res.status(200).json({ success: true, message: `Banner "${updatedBanner.title}" updated successfully!`, banner: updatedBanner });
  } catch (error) {
    console.error('Update banner error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update banner' });
  }
};

/**
 * Select a specific banner as the current Home banner.
 */
export const selectBanner = async (req, res) => {
  try {
    const bannerId = req.params.id;
    const banner = await bannerService.selectHomeBanner(bannerId);

    return res.status(200).json({
      success: true,
      message: `Banner "${banner.title}" is now set as the active Home Banner!`,
      banner
    });
  } catch (error) {
    console.error('Select banner error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to select Home banner' });
  }
};

/**
 * Toggle Banner Active/Inactive Status.
 */
export const toggleBannerStatus = async (req, res) => {
  try {
    const bannerId = req.params.id;
    const updatedBanner = await bannerService.toggleBannerStatus(bannerId);

    return res.status(200).json({
      success: true,
      message: `Banner "${updatedBanner.title}" is now ${updatedBanner.status}.`
    });
  } catch (error) {
    console.error('Toggle banner status error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update banner status' });
  }
};

/**
 * Soft Delete Banner.
 */
export const deleteBanner = async (req, res) => {
  try {
    const bannerId = req.params.id;
    await bannerService.deleteBanner(bannerId);

    return res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Delete banner error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to delete banner' });
  }
};
