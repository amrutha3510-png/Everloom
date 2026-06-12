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
                    // Refresh Google profile photo if user doesn't have a custom upload
                    const googlePhoto = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
                    if (googlePhoto && !user.profileImageId) {
                        // No custom Cloudinary upload — keep Google photo in sync
                        if (user.profileImage !== googlePhoto) {
                            user.profileImage = googlePhoto;
                            await user.save();
                        }
                    }
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
                    // Save Google profile photo if user doesn't have one
                    if (!user.profileImage && profile.photos && profile.photos[0]) {
                        user.profileImage = profile.photos[0].value;
                    }
                    await user.save();
                    return done(null, user);
                }

                // If it's a completely new user
                const newUser = new User({
                    googleId: profile.id,
                    fullName: profile.displayName,
                    email: email,
                    isVerified: true, // Email is verified by Google
                    profileImage: profile.photos && profile.photos[0] ? profile.photos[0].value : undefined,
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
