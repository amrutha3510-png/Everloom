import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    size: { type: String, required: true },
    color: { type: String, required: true }
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Cancellation Requested', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'],
    default: 'Pending'
  },
  cancellationReason: {
    type: String
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  isStockRestored: {
    type: Boolean,
    default: false
  },
  isRefunded: {
    type: Boolean,
    default: false
  },
  allocatedCouponDiscount: {
    type: Number,
    default: 0,
    min: 0
  }
});

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  couponCode: {
    type: String
  },
  shippingCharge: {
    type: Number,
    default: 49
  },
  shippingAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    locality: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  status: {
    type: String,
    enum: ['Pending', 'Cancellation Requested', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Returned', 'Payment Failed'],
    default: 'Pending',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending',
    index: true
  },
  paymentMethod: {
    type: String,
    default: 'COD'
  },
  razorpayOrderId: {
    type: String,
    default: null,
    index: true
  },
  stockReservationStatus: {
    type: String,
    enum: ['NONE', 'ACTIVE', 'EXPIRED', 'COMPLETED'],
    default: 'NONE',
    index: true
  },
  stockReservationExpiresAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String
  },
  returnReason: {
    type: String
  },
  declineReason: {
    type: String
  },
  returnStatus: {
    type: String,
    enum: ['None', 'Pending', 'Approved', 'Declined'],
    default: 'None',
    index: true
  },
  isStockRestored: {
    type: Boolean,
    default: false
  },
  isRefunded: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Pre-save hook to generate unique readable Order ID
orderSchema.pre('save', function () {
  if (!this.orderId) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const randomDigits = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    this.orderId = `EVL-${dateStr}-${randomDigits}`;
  }
});

const Order = mongoose.model('Order', orderSchema);
export default Order;
