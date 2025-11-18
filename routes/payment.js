const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Initialize Razorpay
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('⚠️ Razorpay credentials not found in environment variables!');
  console.error('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file');
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Pricing configuration (in INR - Indian Rupees)
const PRICING = {
  individual: {
    monthly: 1660, // ~$20 USD converted to INR
    annual: 1494, // ~$18 USD converted to INR (per month)
  },
  group: {
    monthly: 1660, // ~$20 USD per seat
    annual: 1328, // ~$16 USD per seat (per month)
  },
};

// CREATE PAYMENT ORDER (Protected)
router.post('/create-order', auth, async (req, res) => {
  try {
    console.log('Create order request received');
    console.log('Request body:', req.body);
    console.log('User from auth:', req.user ? req.user.id : 'No user');

    // Check if Razorpay is configured
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay credentials missing!');
      return res.status(500).json({ 
        msg: 'Payment gateway not configured. Please contact support.',
        error: 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set'
      });
    }

    const { planType, billingCycle } = req.body;

    // Validate request body
    if (!planType || !billingCycle) {
      return res.status(400).json({ msg: 'Missing planType or billingCycle in request body' });
    }

    // Validate plan type
    if (!['individual', 'group', 'custom'].includes(planType)) {
      return res.status(400).json({ msg: 'Invalid plan type' });
    }

    // For custom plan, return error (contact sales)
    if (planType === 'custom') {
      return res.status(400).json({ 
        msg: 'Please contact sales for custom enterprise plans',
        requiresContact: true 
      });
    }

    // Validate billing cycle
    if (!['monthly', 'annual'].includes(billingCycle)) {
      return res.status(400).json({ msg: 'Invalid billing cycle' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Calculate amount
    const amount = PRICING[planType][billingCycle];
    if (!amount) {
      return res.status(400).json({ msg: 'Invalid plan configuration' });
    }
    const totalAmount = billingCycle === 'annual' ? amount * 12 : amount;

    // Validate amount (must be at least 1 INR = 100 paise)
    if (totalAmount < 1) {
      return res.status(400).json({ msg: 'Invalid payment amount' });
    }

    // Create Razorpay order
    // Receipt must be max 40 characters - use short format
    const receiptId = `${user._id.toString().slice(-12)}${Date.now().toString().slice(-8)}`;
    const options = {
      amount: totalAmount * 100, // Convert to paise (smallest currency unit)
      currency: 'INR',
      receipt: receiptId, // Max 40 chars: last 12 chars of user ID + last 8 chars of timestamp = 20 chars
      notes: {
        userId: user._id.toString(),
        email: user.email,
        planType: planType,
        billingCycle: billingCycle,
      },
    };

    console.log('Creating Razorpay order with options:', { ...options, notes: options.notes });

    const order = await razorpay.orders.create(options);

    console.log('Razorpay order created:', order.id);

    // Store order ID in user (temporary, until payment is verified)
    user.razorpayOrderId = order.id;
    await user.save();

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Error creating order:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      response: err.error || err.description,
    });
    
    // Provide more specific error messages
    let errorMsg = 'Failed to create payment order';
    let statusCode = 500;
    
    if (err.error) {
      // Razorpay API error
      errorMsg = err.error.description || err.error.reason || errorMsg;
      statusCode = err.statusCode || 500;
    } else if (err.message) {
      errorMsg = err.message;
    }

    res.status(statusCode).json({ 
      msg: errorMsg,
      error: err.message || err.error?.description,
      details: process.env.NODE_ENV === 'development' ? {
        stack: err.stack,
        error: err.error
      } : undefined
    });
  }
});

// VERIFY PAYMENT AND ACTIVATE SUBSCRIPTION (Protected)
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType, billingCycle } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ msg: 'Missing payment details' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ msg: 'Payment verification failed' });
    }

    // Calculate subscription end date
    const subscriptionStartDate = new Date();
    const subscriptionEndDate = new Date();
    
    // Set subscription duration: 30 days for monthly, 365 days for annual
    if (billingCycle === 'monthly') {
      subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);
    } else {
      subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 365);
    }

    // Calculate amount
    const amount = PRICING[planType][billingCycle];
    const totalAmount = billingCycle === 'annual' ? amount * 12 : amount;

    // Update user subscription
    user.planType = planType;
    user.hasPaidPlan = true;
    user.razorpayOrderId = razorpay_order_id;
    user.razorpayPaymentId = razorpay_payment_id;
    user.razorpaySignature = razorpay_signature;
    user.paymentAmount = totalAmount;
    user.paymentCurrency = 'INR';
    user.paymentStatus = 'completed';
    user.lastPaymentDate = subscriptionStartDate;
    user.billingCycle = billingCycle;
    user.subscriptionStartDate = subscriptionStartDate;
    user.subscriptionEndDate = subscriptionEndDate;
    // Deactivate trial if active (user upgraded)
    user.isTrialActive = false;

    await user.save();

    res.json({
      msg: 'Payment verified and subscription activated successfully',
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate,
      planType: user.planType,
      billingCycle: user.billingCycle,
    });
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ msg: 'Failed to verify payment', error: err.message });
  }
});

// GET SUBSCRIPTION STATUS (Protected)
router.get('/subscription-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if subscription has expired
    if (user.hasPaidPlan && user.subscriptionEndDate && new Date() > user.subscriptionEndDate) {
      user.hasPaidPlan = false;
      user.paymentStatus = 'pending';
      await user.save();
    }

    res.json({
      hasPaidPlan: user.hasPaidPlan,
      planType: user.planType,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate,
      billingCycle: user.billingCycle,
      paymentStatus: user.paymentStatus,
      lastPaymentDate: user.lastPaymentDate,
    });
  } catch (err) {
    console.error('Error fetching subscription status:', err);
    res.status(500).json({ msg: 'Failed to fetch subscription status', error: err.message });
  }
});

// Test endpoint to verify route is working
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Payment route is working',
    razorpayConfigured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  });
});

module.exports = router;

