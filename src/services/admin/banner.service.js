import Banner from '../../models/bannerModel.js';

/**
 * Fetch all non-deleted banners for Admin panel.
 */
export const getAllBanners = async () => {
  return await Banner.find({ isDeleted: false }).sort({ createdAt: -1 });
};

/**
 * Create a new banner with image validation.
 * Ensures only ONE banner remains Active if new banner is created as Active.
 */
export const createBanner = async (bannerData) => {
  const { title, image, status } = bannerData;

  if (!title || !title.trim()) {
    throw new Error('Banner title is required.');
  }

  if (!image || !image.trim()) {
    throw new Error('Banner image is required.');
  }

  const isNewActive = status === 'Active';

  if (isNewActive) {
    await Banner.updateMany({ isDeleted: false }, { status: 'Inactive' });
  }

  const banner = new Banner({
    title: title.trim(),
    image: image.trim(),
    status: isNewActive ? 'Active' : 'Inactive'
  });

  await banner.save();
  return banner;
};

/**
 * Select a specific banner as the single active Home Banner.
 * Safely deactivates all other banners.
 */
export const selectHomeBanner = async (bannerId) => {
  const banner = await Banner.findById(bannerId);
  if (!banner || banner.isDeleted) {
    throw new Error('Banner not found.');
  }

  await Banner.updateMany({ isDeleted: false }, { status: 'Inactive' });

  banner.status = 'Active';
  await banner.save();
  return banner;
};

/**
 * Update an existing banner.
 * Contains strictly: title, status, and optional new image.
 * If status is updated to Active, deactivates all other banners.
 */
export const updateBanner = async (bannerId, bannerData) => {
  const { title, status, image } = bannerData;

  const banner = await Banner.findById(bannerId);
  if (!banner || banner.isDeleted) {
    throw new Error('Banner not found.');
  }

  if (!title || !title.trim()) {
    throw new Error('Banner title is required.');
  }

  const newStatus = status || banner.status;

  if (newStatus === 'Active') {
    await Banner.updateMany({ _id: { $ne: bannerId }, isDeleted: false }, { status: 'Inactive' });
  }

  banner.title = title.trim();
  banner.status = newStatus;
  if (image && image.trim()) {
    banner.image = image.trim();
  }

  await banner.save();
  return banner;
};

/**
 * Toggle banner Active / Inactive status.
 * If toggling to Active, deactivates all other banners.
 */
export const toggleBannerStatus = async (bannerId) => {
  const banner = await Banner.findById(bannerId);
  if (!banner || banner.isDeleted) {
    throw new Error('Banner not found.');
  }

  const nextStatus = banner.status === 'Active' ? 'Inactive' : 'Active';

  if (nextStatus === 'Active') {
    await Banner.updateMany({ _id: { $ne: bannerId }, isDeleted: false }, { status: 'Inactive' });
  }

  banner.status = nextStatus;
  await banner.save();
  return banner;
};

/**
 * Soft delete a banner.
 * If the deleted banner was Active, fallback to activating the latest remaining non-deleted banner.
 */
export const deleteBanner = async (bannerId) => {
  const banner = await Banner.findById(bannerId);
  if (!banner || banner.isDeleted) {
    throw new Error('Banner not found.');
  }

  const wasActive = banner.status === 'Active';
  banner.isDeleted = true;
  banner.status = 'Inactive';
  await banner.save();

  if (wasActive) {
    const fallbackBanner = await Banner.findOne({ isDeleted: false }).sort({ createdAt: -1 });
    if (fallbackBanner) {
      fallbackBanner.status = 'Active';
      await fallbackBanner.save();
    }
  }

  return banner;
};

/**
 * Fetch the single active home banner for User Home page.
 * Falls back to latest non-deleted banner if no banner is explicitly marked Active.
 */
export const getActiveHomeBanner = async () => {
  let activeBanner = await Banner.findOne({ status: 'Active', isDeleted: false }).sort({ updatedAt: -1 });
  if (!activeBanner) {
    activeBanner = await Banner.findOne({ isDeleted: false }).sort({ createdAt: -1 });
  }
  return activeBanner;
};

/**
 * Fetch active banners array for backwards compatibility.
 */
export const getActiveBanners = async () => {
  const active = await getActiveHomeBanner();
  return active ? [active] : [];
};
