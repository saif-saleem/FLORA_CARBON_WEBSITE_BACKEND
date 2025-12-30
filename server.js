// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Parse JSON
app.use(express.json());

// --- CORS (open for all origins - flexible for development) ---
app.use(
  cors({
    origin: '*', // Allow all origins
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'X-Requested-With'],
  })
);

// --- Database connect ---
mongoose
  .connect(process.env.MONGO_URI, { autoIndex: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// --- Root route ---
app.get('/', (_req, res) => {
  res.status(200).json({ message: 'Flora Carbon backend is running successfully!' });
});

// --- Health check ---
app.get('/health', (_req, res) => res.status(200).send('ok'));

// --- Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/contact', require('./routes/contact'));

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on localhost:${PORT}`));
