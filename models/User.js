const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Trial management fields (only for free plan)
  trialStartDate: { type: Date, default: null },
  trialEndDate: { type: Date, default: null },
  isTrialActive: { type: Boolean, default: false },
  // Subscription and payment fields
  hasPaidPlan: { type: Boolean, default: false },
  planType: { type: String, enum: ['free', 'individual', 'group', 'custom'], default: 'free' },
  subscriptionStartDate: { type: Date, default: null },
  subscriptionEndDate: { type: Date, default: null },
  // Payment details
  razorpayOrderId: { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  razorpaySignature: { type: String, default: null },
  paymentAmount: { type: Number, default: 0 },
  paymentCurrency: { type: String, default: 'INR' },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: null },
  lastPaymentDate: { type: Date, default: null },
  billingCycle: { type: String, enum: ['monthly', 'annual'], default: null },
  // ... existing fields ...
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
});

// This is a crucial security step: Hash the password before saving a new user
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', UserSchema);