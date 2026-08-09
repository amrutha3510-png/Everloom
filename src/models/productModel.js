import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subcategory',
    required: true,
  },

  images: {
    type: [String],
    required: true,
    validate: [arrayLimit, 'A product must have at least 3 images']
  },
  imageIds: {
    type: [String]
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
    index: true,
  },
  variants: [{
    size: { type: String, required: true },
    color: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, validate: [Number.isInteger, 'Stock must be integer'] }
  }],
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  }
}, { timestamps: true });

function arrayLimit(val) {
  return val.length >= 3;
}

const Product = mongoose.model('Product', productSchema);
export default Product;
