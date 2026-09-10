import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      required: [true, 'Coupon type is required']
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [1, 'Discount value must be at least 1']
    },
    minPurchase: {
      type: Number,
      default: 0,
      min: [0, 'Minimum purchase amount cannot be negative']
    },
    maxDiscount: {
      type: Number,
      default: null,
      min: [0, 'Maximum discount cannot be negative']
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required']
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    },
    description: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
export default Coupon;
