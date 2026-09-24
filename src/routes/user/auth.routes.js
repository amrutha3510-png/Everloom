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
router.route("/register")
    .get(isGuest, getRegisterPage)
    .post(isGuest, registerUser);
router.get("/signup", isGuest, getRegisterPage);

// Login Routes
router.route("/login")
    .get(isGuest, getLoginPage)
    .post(isGuest, loginUser);
router.post("/logout", logoutUser);

// OTP Routes (Registration)
router.route("/verify")
    .get(isGuest, getOtpVerifyPage)
    .post(isGuest, verifyOtpUser);
router.post("/resend-otp", isGuest, resendOtpUser);

// Password Reset Routes
router.route("/forgot-password")
    .get(isGuest, getForgotPasswordPage)
    .post(isGuest, forgotPassword);

router.route("/verify-reset-otp")
    .get(isGuest, getVerifyResetOtpPage)
    .post(isGuest, verifyResetOtp);
router.post("/resend-reset-otp", isGuest, resendResetOtp);

router.route("/set-new-password")
    .get(isGuest, getSetNewPasswordPage)
    .post(isGuest, setNewPassword);

// Google Auth Routes
router.get("/auth/google", isGuest, passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", isGuest, passport.authenticate("google", { failureRedirect: "/login" }), googleAuthCallback);

export default router;