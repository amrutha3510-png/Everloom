import express from "express";
import dotenv from "dotenv";
import expressLayouts from "express-ejs-layouts";
import session from "express-session";

import connectDB from "./src/configs/db.config.js";

import userRoutes from "./src/routes/user/index.js";
import adminRoutes from "./src/routes/admin/index.js";
import { toastFlash } from "./src/middlewares/toast.middleware.js";

dotenv.config();

connectDB();

const app = express();

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || "everloom_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS in production
}));

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
app.use("/", userRoutes);
app.use("/admin", adminRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server Running On Port ${PORT}`);
});