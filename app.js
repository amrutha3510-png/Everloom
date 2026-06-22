import express from "express";
import dotenv from "dotenv";
import expressLayouts from "express-ejs-layouts";
import session from "express-session";

import connectDB from "./src/configs/db.config.js";
import passport from "./src/configs/passport.config.js";
import nocache from "nocache";

import userRoutes from "./src/routes/user/index.js";
import adminRoutes from "./src/routes/admin/index.js";
import { toastFlash } from "./src/middlewares/toast.middleware.js";

dotenv.config();

connectDB();

const app = express();

// 1. Serve static files first (browser is allowed to cache these)
app.use(express.static("public"));

// 2. Disable caching for all subsequent dynamic routes (EJS HTML views)
app.use(nocache());

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || "everloom_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS in production
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Body Parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server Running On Port ${PORT}`); // nodemon restart trigger.
});