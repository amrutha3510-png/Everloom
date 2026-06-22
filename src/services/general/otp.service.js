import crypto from 'crypto';
import Otp from '../../models/otpModel.js';
import nodemailer from 'nodemailer';

// Helper function to create email transporter
const getTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // App Password
    },
  });
};

/**
 * Helper function to generate a 6-digit random code
 * @returns {string} 6-digit OTP
 */
export const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Deletes existing OTP for email/purpose, generates new OTP, saves it, and sends email.
 * @param {Object} params - { email, purpose }
 * @returns {Object} { success, message }
 */
export const sendOtp = async ({ email, purpose }) => {
  // Delete any existing OTP for this email and purpose
  await Otp.deleteMany({ email, purpose });

  const otpCode = generateOtp();

  console.log(`\n========================================\n[OTP] Generated OTP: ${otpCode} for ${email} (Purpose: ${purpose})\n========================================\n`);

  // Save to the Otp collection
  await Otp.create({
    email,
    otp: otpCode,
    purpose,
  });

  // Send the email using nodemailer
  try {
    const transporter = getTransporter();
    
    const mailOptions = {
      from: `"Everloom Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Your OTP for Everloom Registration`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; max-width: 500px; margin: auto; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #111; text-align: center;">Verify Your Email</h2>
          <p>Thank you for registering at Everloom. Use the following One-Time Password (OTP) to complete your registration. This code is valid for 120 seconds (2 minutes).</p>
          <div style="font-size: 28px; font-weight: bold; background: #f9f9f9; padding: 15px; text-align: center; letter-spacing: 4px; color: #111; border: 1px dashed #ccc; margin: 20px 0;">
            ${otpCode}
          </div>
          <p style="font-size: 12px; color: #777; text-align: center;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send OTP to ${email}:`, error);
    throw new Error('Could not send OTP email. Please verify SMTP settings in your environment variables.');
  }
  
  return { success: true, message: 'OTP sent successfully' };
};

/**
 * Finds the OTP, verifies if it matches, deletes the OTP upon successful verification.
 * @param {Object} params - { email, otp, purpose }
 * @returns {Object} { ok: boolean }
 */
export const verifyOtp = async ({ email, otp, purpose }) => {
  const otpRecord = await Otp.findOne({ email, purpose, otp });

  if (!otpRecord) {
    return { ok: false };
  }

  // Delete the OTP document upon successful verification
  await Otp.deleteOne({ _id: otpRecord._id });

  return { ok: true };
};

/**
 * Calculates remaining seconds until OTP expiration.
 * @param {string} email
 * @param {string} purpose
 * @returns {number} Remaining seconds
 */
export const getRemainingSeconds = async (email, purpose) => {
  const otpRecord = await Otp.findOne({ email, purpose });
  if (!otpRecord) return 0;
  
  const elapsedMs = Date.now() - otpRecord.createdAt.getTime();
  const remainingSeconds = Math.max(0, 120 - Math.floor(elapsedMs / 1000));
  return remainingSeconds;
};

/**
 * Validates if the OTP is expired. If yes, sends a new one. If active, throws an error.
 * @param {string} email
 * @param {string} purpose
 * @returns {number} New remaining seconds
 */
export const resendOtp = async (email, purpose) => {
  const remaining = await getRemainingSeconds(email, purpose);
  if (remaining > 0) {
    throw new Error(`OTP is still active. Please wait ${remaining} seconds.`);
  }
  
  // Deletes any old expired/inactive OTP record
  await Otp.deleteMany({ email, purpose });
  
  // Send new OTP
  await sendOtp({ email, purpose });
  
  // Return the new remaining seconds (120)
  return 120;
};
