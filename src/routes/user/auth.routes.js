import express from "express";
import passport from "passport";
import {
    getRegisterPage,
    getLoginPage,
    getOtpVerifyPage,
    registerUser,
    loginUser,
    logoutUser,
    getHomePage,
    verifyOtpUser,
    resendOtpUser,
    getForgotPasswordPage,
    forgotPassword,
    getVerifyResetOtpPage,
    verifyResetOtp,
    resendResetOtp,
    getSetNewPasswordPage,
    setNewPassword,
    googleAuthCallback
} from "../../controllers/user/auth.controller.js";
import { isGuest } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getHomePage);

// Register Routes
router.get("/register", isGuest, getRegisterPage);
router.post("/register", isGuest, registerUser);

// Login Routes
router.get("/login", isGuest, getLoginPage);
router.post("/login", isGuest, loginUser);
router.post("/logout", logoutUser);

// OTP Routes (Registration)
router.get("/verify", isGuest, getOtpVerifyPage);
router.post("/verify", isGuest, verifyOtpUser);
router.post("/resend-otp", isGuest, resendOtpUser);

// Password Reset Routes
router.get("/forgot-password", isGuest, getForgotPasswordPage);
router.post("/forgot-password", isGuest, forgotPassword);
router.get("/verify-reset-otp", isGuest, getVerifyResetOtpPage);
router.post("/verify-reset-otp", isGuest, verifyResetOtp);
router.post("/resend-reset-otp", isGuest, resendResetOtp);
router.get("/set-new-password", isGuest, getSetNewPasswordPage);
router.post("/set-new-password", isGuest, setNewPassword);

// Google Auth Routes
router.get("/auth/google", isGuest, passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", isGuest, passport.authenticate("google", { failureRedirect: "/login" }), googleAuthCallback);

export default router;