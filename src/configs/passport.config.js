import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/userModel.js';
import dotenv from 'dotenv';

dotenv.config();

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user exists by googleId
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    return done(null, user);
                }

                // If not, check if a user with that email already exists
                const email = profile.emails[0].value;
                user = await User.findOne({ email });

                if (user) {
                    // Link the googleId to the existing account
                    user.googleId = profile.id;
                    // If they previously signed up without verifying, let's consider Google as verification
                    if (!user.isVerified) {
                        user.isVerified = true;
                    }
                    await user.save();
                    return done(null, user);
                }

                // If it's a completely new user
                const newUser = new User({
                    googleId: profile.id,
                    fullName: profile.displayName,
                    email: email,
                    isVerified: true // Email is verified by Google
                });

                await newUser.save();
                return done(null, newUser);

            } catch (err) {
                console.error("Google Auth Error:", err);
                return done(err, null);
            }
        }
    )
);

export default passport;
