import { 
    registerUser as registerUserService, 
    validateUserLogin, 
    verifyRegistration,
    requestPasswordReset,
    resetPassword 
} from '../../services/user/auth.service.js';
import { getRemainingSeconds, resendOtp, sendOtp, verifyOtp } from '../../services/general/otp.service.js';

export const getHomePage = (req, res) => {
    res.render("user/auth/home", {
        title: "Home | Everloom"
    });
};

export const logoutUser = (req, res) => {
    // 1. Remove ONLY the user data and passport data
    if (req.session) {
        req.session.user = null;
        if (req.session.passport) {
            req.session.passport = null;
        }
    }
    
    req.session.toast = { type: 'success', message: 'You have been logged out successfully.' };

    // 2. Save the session (retains req.session.admin if admin is logged in)
    return req.session.save((saveErr) => {
        if (saveErr) console.error("Session save error during user logout redirect:", saveErr);
        return res.redirect('/login');
    });
};

export const getRegisterPage = (req, res) => {
    res.render("user/auth/register", {
        title: "Register"
    });
};

export const getLoginPage = (req, res) => {
    try {
        // If user is already logged in, redirect to home page
        if (req.session && req.session.user) {
            return res.redirect('/');
        }
        
        res.render("user/auth/login", {
            title: "Login"
        });
    } catch (error) {
        console.error("Error rendering login page:", error);
        res.status(500).send("Internal Server Error");
    }
};

// Handle login form submission with backend validation (PRG Pattern)
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Check for empty fields
        if (!email || !password) {
            req.session.toast = { type: 'error', message: 'All fields are required.' };
            req.session.oldData = { email };
            return res.redirect('/login');
        }

        // 2. Validate email format using regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            req.session.toast = { type: 'error', message: 'Please enter a valid email address.' };
            req.session.oldData = { email };
            return res.redirect('/login');
        }

        // Use AuthService to validate
        const result = await validateUserLogin(email, password);
        
        if (result.success) {
            // Set session namespace
            if (!req.session) {
                return res.status(500).send("Session not initialized");
            }
            req.session.user = { id: result.user._id, email: result.user.email };
            req.session.toast = { type: 'success', message: 'Login successful! Welcome back.' };
            // Explicitly save session before redirect to prevent race condition
            return req.session.save((err) => {
                if (err) console.error('Session save error:', err);
                return res.redirect("/");
            });
        } else {
            req.session.toast = { type: 'error', message: result.message };
            req.session.oldData = { email };
            return res.redirect('/login');
        }
    } catch (error) {
        console.error("Login Error:", error);
        req.session.toast = { type: 'error', message: 'An error occurred during login. Please try again.' };
        req.session.oldData = { email: req.body.email };
        return res.redirect('/login');
    }
};

// Handle registration form submission with backend validation (PRG Pattern)
export const registerUser = async (req, res) => {
    try {
        const { fullName, email, password, confirmPassword, referralCode } = req.body;

        // 1. Check for empty fields
        if (!fullName || fullName.trim() === "" || !email || !password || !confirmPassword) {
            req.session.toast = { type: 'error', message: 'All fields are required.' };
            req.session.oldData = { fullName, email, referralCode };
            return res.redirect('/register');
        }

        // 2. Validate email format using regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            req.session.toast = { type: 'error', message: 'Please enter a valid email address.' };
            req.session.oldData = { fullName, email, referralCode };
            return res.redirect('/register');
        }

        // 3. Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
        if (!passwordRegex.test(password)) {
            req.session.toast = { type: 'error', message: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character.' };
            req.session.oldData = { fullName, email, referralCode };
            return res.redirect('/register');
        }

        // 4. Check if passwords match
        if (password !== confirmPassword) {
            req.session.toast = { type: 'error', message: 'Passwords do not match.' };
            req.session.oldData = { fullName, email, referralCode };
            return res.redirect('/register');
        }

        // Use AuthService to register
        await registerUserService({ fullName, email, password, referralCode }); 

        // Store email temporarily to use in OTP page
        if (req.session) {
            req.session.tempEmail = email;
            req.session.toast = { type: 'success', message: 'OTP has been sent to your email.' };
        }

        // Proceed to OTP verification page
        return res.redirect("/verify");
    } catch (error) {
        console.error("Register Error:", error);
        req.session.toast = { type: 'error', message: error.message || 'An error occurred during registration. Please try again.' };
        req.session.oldData = { 
            fullName: req.body.fullName, 
            email: req.body.email, 
            referralCode: req.body.referralCode 
        };
        return res.redirect('/register');
    }
};

export const getOtpVerifyPage = async (req, res) => {
    const email = req.session && req.session.tempEmail ? req.session.tempEmail : "";
    const remainingSeconds = email ? await getRemainingSeconds(email, 'register') : 0;
    res.render("user/auth/otp-verify", {
        title: "Verify OTP",
        email,
        remainingSeconds
    });
};

export const verifyOtpUser = async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        if (!email || !otp) {
            req.session.toast = { type: 'error', message: 'Email and OTP are required.' };
            req.session.tempEmail = email || (req.session && req.session.tempEmail);
            return res.redirect('/verify');
        }

        const result = await verifyRegistration(email, otp);
        if (result.success) {
            if (req.session) {
                if (req.session.tempEmail) {
                    delete req.session.tempEmail; // cleanup
                }
                req.session.user = { id: result.user._id, email: result.user.email };
                req.session.toast = { type: 'success', message: 'Registration verified successfully! Welcome to Everloom.' };
            }
            // Explicitly save session before redirect to prevent race condition
            return req.session.save((err) => {
                if (err) console.error('Session save error:', err);
                return res.redirect("/");
            });
        } else {
            req.session.toast = { type: 'error', message: result.message };
            req.session.tempEmail = email;
            return res.redirect('/verify');
        }
    } catch (error) {
        console.error("OTP Verify Error:", error);
        req.session.toast = { type: 'error', message: 'An error occurred during OTP verification.' };
        req.session.tempEmail = req.body.email || (req.session && req.session.tempEmail);
        return res.redirect('/verify');
    }
};

export const resendOtpUser = async (req, res) => {
    try {
        const email = req.session && req.session.tempEmail;
        if (!email) {
            req.session.toast = { type: 'error', message: 'Session expired. Please register again.' };
            return res.redirect('/register');
        }

        await resendOtp(email, 'register');
        req.session.toast = { type: 'success', message: 'A new OTP has been sent to your email.' };
        return res.redirect('/verify');
    } catch (error) {
        console.error("Resend OTP Error:", error);
        req.session.toast = { type: 'error', message: error.message || 'Could not resend OTP. Please try again.' };
        return res.redirect('/verify');
    }
};

// ==================== PASSWORD RESET FLOW ====================

export const getForgotPasswordPage = (req, res) => {
    res.render("user/auth/forgot-password", {
        title: "Forgot Password"
    });
};

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.trim()) {
            req.session.toast = { type: 'error', message: 'Please enter your email address.' };
            return res.redirect('/forgot-password');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            req.session.toast = { type: 'error', message: 'Please enter a valid email address.' };
            return res.redirect('/forgot-password');
        }

        const result = await requestPasswordReset(email.trim());
        if (!result.success) {
            req.session.toast = { type: 'error', message: result.message };
            return res.redirect('/forgot-password');
        }

        req.session.resetEmail = email.trim();
        req.session.toast = { type: 'success', message: 'OTP has been sent to your email.' };
        return res.redirect('/verify-reset-otp');
    } catch (error) {
        console.error("Forgot Password Error:", error);
        req.session.toast = { type: 'error', message: error.message || 'An error occurred. Please try again.' };
        return res.redirect('/forgot-password');
    }
};

export const getVerifyResetOtpPage = async (req, res) => {
    const email = req.session && req.session.resetEmail ? req.session.resetEmail : "";
    if (!email) {
        req.session.toast = { type: 'error', message: 'Session expired. Please start over.' };
        return res.redirect('/forgot-password');
    }
    const remainingSeconds = await getRemainingSeconds(email, 'reset-password');
    res.render("user/auth/verify-reset-otp", {
        title: "Verify OTP",
        email,
        remainingSeconds
    });
};

export const verifyResetOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            req.session.toast = { type: 'error', message: 'Email and OTP are required.' };
            return res.redirect('/verify-reset-otp');
        }

        const result = await verifyOtp({ email, otp, purpose: 'reset-password' });
        if (!result.ok) {
            req.session.toast = { type: 'error', message: 'Invalid or expired OTP.' };
            req.session.resetEmail = email;
            return res.redirect('/verify-reset-otp');
        }

        // Set session flags for password reset authorization
        req.session.resetEmail = email;
        req.session.isOtpVerified = true;
        req.session.toast = { type: 'success', message: 'OTP verified. Please set your new password.' };
        return res.redirect('/set-new-password');
    } catch (error) {
        console.error("Verify Reset OTP Error:", error);
        req.session.toast = { type: 'error', message: 'An error occurred during verification.' };
        return res.redirect('/verify-reset-otp');
    }
};

export const resendResetOtp = async (req, res) => {
    try {
        const email = req.session && req.session.resetEmail;
        if (!email) {
            req.session.toast = { type: 'error', message: 'Session expired. Please start over.' };
            return res.redirect('/forgot-password');
        }

        await resendOtp(email, 'reset-password');
        req.session.toast = { type: 'success', message: 'A new OTP has been sent to your email.' };
        return res.redirect('/verify-reset-otp');
    } catch (error) {
        console.error("Resend Reset OTP Error:", error);
        req.session.toast = { type: 'error', message: error.message || 'Could not resend OTP.' };
        return res.redirect('/verify-reset-otp');
    }
};

export const getSetNewPasswordPage = (req, res) => {
    if (!req.session || !req.session.isOtpVerified) {
        req.session.toast = { type: 'error', message: 'Unauthorized. Please verify OTP first.' };
        return res.redirect('/forgot-password');
    }
    res.render("user/auth/set-new-password", {
        title: "Set New Password"
    });
};

export const setNewPassword = async (req, res) => {
    try {
        if (!req.session || !req.session.isOtpVerified) {
            req.session.toast = { type: 'error', message: 'Unauthorized. Please verify OTP first.' };
            return res.redirect('/forgot-password');
        }

        const { newPassword, confirmNewPassword } = req.body;
        const email = req.session.resetEmail;

        if (!newPassword || !confirmNewPassword) {
            req.session.toast = { type: 'error', message: 'All fields are required.' };
            return res.redirect('/set-new-password');
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            req.session.toast = { type: 'error', message: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character.' };
            return res.redirect('/set-new-password');
        }

        if (newPassword !== confirmNewPassword) {
            req.session.toast = { type: 'error', message: 'Passwords do not match.' };
            return res.redirect('/set-new-password');
        }

        const result = await resetPassword(email, newPassword);
        if (!result.success) {
            req.session.toast = { type: 'error', message: result.message };
            return res.redirect('/set-new-password');
        }

        req.session.resetEmail = null;
        req.session.isOtpVerified = null;

        req.session.toast = { type: 'success', message: 'Password reset successfully. You can now login.' };
        return req.session.save((err) => {
            if (err) console.error('Session save error:', err);
            return res.redirect('/login');
        });
    } catch (error) {
        console.error("Set New Password Error:", error);
        req.session.toast = { type: 'error', message: 'An error occurred while resetting password.' };
        return res.redirect('/set-new-password');
    }
};

export const googleAuthCallback = (req, res) => {
    if (!req.user) {
        req.session.toast = { type: 'error', message: 'Google Authentication failed.' };
        return res.redirect('/login');
    }

    if (req.user.status === 'blocked') {
        req.session.toast = { type: 'error', message: 'Your account has been blocked. Please contact support.' };
        
        // Clear ONLY the user/passport keys so the admin session survives
        if (req.session) {
            req.session.user = null;
            if (req.session.passport) {
                req.session.passport = null;
            }
        }

        return req.session.save((saveErr) => {
            if (saveErr) console.error("Session save error during Google block redirect:", saveErr);
            return res.redirect('/login');
        });
    }

    req.session.user = { id: req.user._id, email: req.user.email };
    req.session.toast = { type: 'success', message: 'Logged in with Google successfully!' };
    
    return req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        return res.redirect("/");
    });
};