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
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
    index: true,
  },
  colorOptions: [{
    name: { type: String, required: true },
    code: { type: String, required: true },
    images: { type: [String], required: true },
    imageIds: { type: [String] }
  }],
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
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

productSchema.virtual('images').get(function() {
  return (this.colorOptions && this.colorOptions[0] && this.colorOptions[0].images) || [];
});

productSchema.virtual('imageIds').get(function() {
  return (this.colorOptions && this.colorOptions[0] && this.colorOptions[0].imageIds) || [];
});

const Product = mongoose.model('Product', productSchema);
export default Product;
