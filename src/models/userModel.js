import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  password: {
    type: String,
  },
  referralCode: {
    type: String,
    trim: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  phone: {
    type: String,
    trim: true,
  },
  profileImage: {
    type: String, // Cloudinary secure URL
  },
  profileImageId: {
    type: String, // Cloudinary public_id (used for deletion)
  },
  dob: {
    type: String, // stored as YYYY-MM-DD to match HTML date input
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active',
    index: true,
  },
  pendingEmail: {
    type: String, // temporary field during email-change OTP flow
    trim: true,
    lowercase: true,
  },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;
