const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // This line is now correct
const auth = require('../middleware/auth');
const router = express.Router();

// SIGN UP ROUTE
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Create new user (password will be hashed by the pre-save hook in the model)
    user = new User({ name, email, password });
    await user.save();

    res.status(201).json({ msg: 'User registered successfully' });
  } catch (err) {
    console.error(err.message); // Log the error for debugging
    res.status(500).send('Server error');
  }
});

// SIGN IN ROUTE
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Create and return a JWT (the "keycard")
    const payload = { user: { id: user.id } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          name: user.name,
          email: user.email,
        });
      }
    );
  } catch (err) {
    console.error(err.message); // Log the error for debugging
    res.status(500).send('Server error');
  }
});

// GET USER DETAILS ROUTE (Protected)
router.get('/get', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Check if subscription has expired
    if (user.hasPaidPlan && user.subscriptionEndDate && new Date() > user.subscriptionEndDate) {
      user.hasPaidPlan = false;
      user.paymentStatus = 'pending';
      await user.save();
    }

    // Check if trial has expired
    if (user.isTrialActive && user.trialEndDate && new Date() > user.trialEndDate) {
      user.isTrialActive = false;
      await user.save();
    }

    // User is already attached to req by auth middleware
    res.json({
      name: req.user.name,
      email: req.user.email,
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate,
      isTrialActive: user.isTrialActive && user.trialEndDate && new Date() < user.trialEndDate,
      hasPaidPlan: user.hasPaidPlan && user.subscriptionEndDate && new Date() < user.subscriptionEndDate,
      planType: user.planType,
      subscriptionEndDate: user.subscriptionEndDate,
      billingCycle: user.billingCycle,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// START FREE TRIAL ROUTE (Protected) - Only for free plan
router.post('/start-trial', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Trial is only available for free plan
    if (user.planType !== 'free') {
      return res.status(400).json({ 
        msg: 'Trial is only available for the free plan. Please upgrade to a paid plan.' 
      });
    }

    // Check if user already has an active trial or paid plan
    if (user.hasPaidPlan) {
      return res.status(400).json({ msg: 'You already have a paid plan. Trial is not available for paid users.' });
    }

    if (user.isTrialActive) {
      // Check if trial is still valid
      if (user.trialEndDate && new Date() < user.trialEndDate) {
        return res.status(400).json({ msg: 'You already have an active trial' });
      }
    }

    // Check if user had a trial before (even if expired)
    if (user.trialStartDate) {
      return res.status(400).json({ 
        msg: 'You have already used your free trial. Please upgrade to a paid plan to continue.' 
      });
    }

    // Start 7-day trial
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    user.trialStartDate = trialStartDate;
    user.trialEndDate = trialEndDate;
    user.isTrialActive = true;
    user.planType = 'free'; // Ensure plan type is free

    await user.save();

    res.json({
      msg: 'Free trial started successfully',
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate,
      isTrialActive: user.isTrialActive,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// CHECK GPT ACCESS ROUTE (Protected)
router.get('/check-gpt-access', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Check if subscription has expired
    if (user.hasPaidPlan && user.subscriptionEndDate && new Date() > user.subscriptionEndDate) {
      user.hasPaidPlan = false;
      user.paymentStatus = 'pending';
      await user.save();
    }

    // Check if trial has expired
    if (user.isTrialActive && user.trialEndDate && new Date() > user.trialEndDate) {
      user.isTrialActive = false;
      await user.save();
    }

    // Check access: user must have active paid plan OR active trial (only for free plan)
    const hasActiveSubscription = user.hasPaidPlan && user.subscriptionEndDate && new Date() < user.subscriptionEndDate;
    const hasActiveTrial = user.planType === 'free' && user.isTrialActive && user.trialEndDate && new Date() < user.trialEndDate;
    const hasAccess = hasActiveSubscription || hasActiveTrial;

    res.json({
      hasAccess,
      hasPaidPlan: user.hasPaidPlan && user.subscriptionEndDate && new Date() < user.subscriptionEndDate,
      isTrialActive: user.isTrialActive && user.trialEndDate && new Date() < user.trialEndDate,
      trialEndDate: user.trialEndDate,
      subscriptionEndDate: user.subscriptionEndDate,
      planType: user.planType,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET TRIAL STATUS ROUTE (Protected)
router.get('/trial-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Check if subscription has expired
    if (user.hasPaidPlan && user.subscriptionEndDate && new Date() > user.subscriptionEndDate) {
      user.hasPaidPlan = false;
      user.paymentStatus = 'pending';
      await user.save();
    }

    // Check if trial has expired
    if (user.isTrialActive && user.trialEndDate && new Date() > user.trialEndDate) {
      user.isTrialActive = false;
      await user.save();
    }

    // Calculate days remaining for trial
    let daysRemaining = 0;
    if (user.isTrialActive && user.trialEndDate) {
      const now = new Date();
      const end = new Date(user.trialEndDate);
      if (end > now) {
        daysRemaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      }
    }

    // Calculate subscription days remaining
    let subscriptionDaysRemaining = 0;
    if (user.hasPaidPlan && user.subscriptionEndDate) {
      const now = new Date();
      const end = new Date(user.subscriptionEndDate);
      if (end > now) {
        subscriptionDaysRemaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      }
    }

    res.json({
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate,
      isTrialActive: user.isTrialActive && user.trialEndDate && new Date() < user.trialEndDate,
      hasPaidPlan: user.hasPaidPlan && user.subscriptionEndDate && new Date() < user.subscriptionEndDate,
      planType: user.planType,
      daysRemaining,
      subscriptionDaysRemaining,
      hasUsedTrial: !!user.trialStartDate,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate,
      billingCycle: user.billingCycle,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;