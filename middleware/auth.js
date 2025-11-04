const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token and attach user to request
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');

    if (!token) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.user.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports = auth;

