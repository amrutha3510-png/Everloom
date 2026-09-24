import 'dotenv/config';
import express from "express";
import expressLayouts from "express-ejs-layouts";
import session from "express-session";

import connectDB from "./src/configs/db.config.js";
import passport from "./src/configs/passport.config.js";
import nocache from "nocache";

import userRoutes from "./src/routes/user/index.js";
import adminRoutes from "./src/routes/admin/index.js";
import { toastFlash } from "./src/middlewares/toast.middleware.js";

connectDB();

const app = express();

// 1. Serve static files first (browser is allowed to cache these)
app.use(express.static("public"));

// Body Parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// User Session Middleware
const userSession = session({
    name: "user.sid",
    secret: process.env.SESSION_SECRET || "everloom_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS in production
});

// Admin Session Middleware
const adminSession = session({
    name: "admin.sid",
    secret: process.env.SESSION_SECRET || "everloom_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS in production
});

// Dynamic session middleware selection based on path
app.use((req, res, next) => {
    if (req.path.startsWith("/admin")) {
        adminSession(req, res, next);
    } else {
        userSession(req, res, next);
    }
});

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Toast flash and oldData parser
app.use(toastFlash);

// EJS
app.set("view engine", "ejs");
app.set("views", "./src/views");

// Layouts
app.use(expressLayouts);

// Default layout
app.set("layout", "layouts/user-layout");

// Routes
app.use("/admin", adminRoutes);
app.use("/", userRoutes);

// 404 Not Found Middleware
app.use((req, res) => {
    if (req.xhr || req.headers.accept?.includes("application/json")) {
        return res.status(404).json({ success: false, message: "Resource not found." });
    }
    res.status(404).render("404", {
        title: "Page Not Found",
        layout: "layouts/user-layout"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server Running On Port ${PORT}`); // nodemon restart trigger.
});