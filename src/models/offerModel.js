import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Offer name is required'],
      trim: true
    },
    targetType: {
      type: String,
      enum: ['Product', 'Category'],
      required: [true, 'Target type must be Product or Category']
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      default: 'PERCENTAGE'
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [1, 'Discount value must be greater than 0']
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      required: [true, 'Expiry date is required']
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

const Offer = mongoose.models.Offer || mongoose.model('Offer', offerSchema);
export default Offer;
