import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  type: {
    type: String,
    enum: ['Credit', 'Debit'],
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  runningBalance: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['Success', 'Failed'],
    default: 'Success',
  },
  orderId: {
    type: String,
    trim: true,
  },
  razorpayOrderId: {
    type: String,
    trim: true,
  },
  razorpayPaymentId: {
    type: String,
    trim: true,
  },
  referenceId: {
    type: String,
    trim: true,
    index: true,
  },
}, { timestamps: true });

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
export default WalletTransaction;
