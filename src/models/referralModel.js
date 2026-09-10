import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  referredUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // One referral record per referred user
    index: true,
  },
  referralCode: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Completed',
  },
  rewardAmount: {
    type: Number,
    required: true,
    default: 100,
  },
  isRewarded: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

const Referral = mongoose.model('Referral', referralSchema);
export default Referral;
