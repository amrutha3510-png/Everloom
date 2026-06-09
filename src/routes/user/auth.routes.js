import express from "express";
import {
    getRegisterPage,
    getLoginPage,
    getOtpVerifyPage,
    registerUser,
    loginUser,
    getHomePage,
    verifyOtpUser,
    resendOtpUser,
    getForgotPasswordPage,
    forgotPassword,
    getVerifyResetOtpPage,
    verifyResetOtp,
    resendResetOtp,
    getSetNewPasswordPage,
    setNewPassword
} from "../../controllers/user/auth.controller.js";

const router = express.Router();

router.get("/",getHomePage)

// Register Routes
router.get("/register", getRegisterPage);
router.post("/register", registerUser);

// Login Routes
router.get("/login", getLoginPage);
router.post("/login", loginUser); // Added POST method for login

// OTP Routes (Registration)
router.get("/verify", getOtpVerifyPage);
router.post("/verify", verifyOtpUser);
router.post("/resend-otp", resendOtpUser);

// Password Reset Routes
router.get("/forgot-password", getForgotPasswordPage);
router.post("/forgot-password", forgotPassword);
router.get("/verify-reset-otp", getVerifyResetOtpPage);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/resend-reset-otp", resendResetOtp);
router.get("/set-new-password", getSetNewPasswordPage);
router.post("/set-new-password", setNewPassword);

export default router;