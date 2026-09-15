import multer from 'multer';
import { uploadCategoryBanner } from '../configs/categoryUpload.config.js';
import { uploadSubcategoryImage } from '../configs/subcategoryUpload.config.js';
import { uploadProductImages } from '../configs/productUpload.config.js';

// Multer error handling wrapper for banner uploads
export const handleBannerUpload = (req, res, next) => {
  uploadCategoryBanner.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: 'Banner image size must be under 5 MB.',
        LIMIT_UNEXPECTED_FILE: err.field || 'Only JPG, JPEG, PNG, and WEBP images are allowed.'
      };
      req.session.formErrors = { image: messages[err.code] || err.message };
      req.session.oldData = req.body;
      return res.redirect(req.originalUrl);
    }
    if (err) {
      req.session.formErrors = { image: err.message || 'Image upload failed.' };
      req.session.oldData = req.body;
      return res.redirect(req.originalUrl);
    }
    next();
  });
};

// Multer error handling wrapper for subcategory uploads
export const handleSubcategoryImageUpload = (req, res, next) => {
  uploadSubcategoryImage.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: 'Image must be under 5 MB.',
        LIMIT_UNEXPECTED_FILE: 'Only JPG, JPEG, PNG, and WEBP images are allowed.'
      };
      req.session.formErrors = { image: messages[err.code] || err.message };
      req.session.oldData = req.body;
      return res.redirect(req.originalUrl);
    }
    if (err) {
      req.session.formErrors = { image: err.message || 'Image upload failed.' };
      req.session.oldData = req.body;
      return res.redirect(req.originalUrl);
    }
    next();
  });
};

// Multer error handling wrapper for product images uploads
export const handleProductImagesUpload = (req, res, next) => {
  uploadProductImages.array('images', 10)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: 'Each image must be under 5 MB.',
        LIMIT_UNEXPECTED_FILE: err.field === 'images' ? 'Maximum 10 images allowed.' : 'Only JPG, JPEG, PNG, and WEBP images are allowed.'
      };
      req.session.formErrors = { images: messages[err.code] || err.message };
      req.session.oldData = req.body;
      return res.redirect(req.originalUrl);
    }
    if (err) {
      req.session.formErrors = { images: err.message || 'Image upload failed.' };
      req.session.oldData = req.body;
      return res.redirect(req.originalUrl);
    }
    next();
  });
};

import { uploadHomeBanner } from '../configs/bannerUpload.config.js';

export const handleHomeBannerUpload = (req, res, next) => {
  uploadHomeBanner.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: 'Banner image size must be under 5 MB.',
        LIMIT_UNEXPECTED_FILE: 'Only JPG, JPEG, PNG, and WEBP images are allowed.'
      };
      return res.status(400).json({ success: false, message: messages[err.code] || err.message });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Image upload failed.' });
    }
    next();
  });
};
