import express from 'express';
import { isUser, isUserPage } from '../../middlewares/auth.middleware.js';
import { upload } from '../../configs/cloudinary.config.js';
import {
  getProfilePage,
  getAddressesPage,
  getSecurityPage,
  updateProfileHandler,
  updateProfileImageHandler,
  deleteProfileImageHandler,
  requestEmailChangeHandler,
  verifyEmailChangeHandler,
  resendEmailChangeOtpHandler,
  createAddressHandler,
  updateAddressHandler,
  deleteAddressHandler,
  setDefaultAddressHandler,
  updatePasswordHandler
} from '../../controllers/user/account.controller.js';

import multer from 'multer';

const router = express.Router();

// Multer error-handling wrapper for file uploads
const handleUpload = (req, res, next) => {
  upload.single('profileImage')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: 'File size must be under 5 MB.',
        LIMIT_UNEXPECTED_FILE: err.field || 'Only JPG, PNG and WEBP images are allowed.',
      };
      return res.status(400).json({ success: false, message: messages[err.code] || err.message });
    }
    if (err) {
      // Catches "Request aborted" and other generic errors
      if (err.message === 'Request aborted') {
        return res.status(400).json({ success: false, message: 'Upload was cancelled. Please try again.' });
      }
      return res.status(500).json({ success: false, message: err.message || 'Upload failed.' });
    }
    next();
  });
};

// ── Page renders (redirect to login if not authenticated) ──
router.get('/profile',   isUserPage, getProfilePage);
router.get('/addresses', isUserPage, getAddressesPage);
router.get('/security',  isUserPage, getSecurityPage);

// ── Profile API (JSON responses) ──
router.post('/profile/update',               isUser, updateProfileHandler);
router.post('/profile/update-image',         isUser, handleUpload, updateProfileImageHandler);
router.post('/profile/remove-image',         isUser, deleteProfileImageHandler);
router.post('/profile/request-email-change', isUser, requestEmailChangeHandler);
router.post('/profile/verify-email-change',  isUser, verifyEmailChangeHandler);
router.post('/profile/resend-email-change-otp', isUser, resendEmailChangeOtpHandler);

// ── Address API ──
router.post('/addresses/add',            isUser, createAddressHandler);
router.post('/addresses/edit/:id',       isUser, updateAddressHandler);
router.post('/addresses/set-default/:id',isUser, setDefaultAddressHandler);
router.delete('/addresses/delete/:id',   isUser, deleteAddressHandler);

// ── Security API ──
router.post('/security/change-password', isUser, updatePasswordHandler);



export default router;
