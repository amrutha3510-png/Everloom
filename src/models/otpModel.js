import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    required: true,
    enum: ['register', 'reset-password', 'email-change'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 120, // TTL index: document expires in 120 seconds
  },
});

const Otp = mongoose.model('Otp', otpSchema);
export default Otp;
