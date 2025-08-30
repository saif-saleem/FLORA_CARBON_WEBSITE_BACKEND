// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Parse JSON
app.use(express.json());

// --- CORS (lock to your frontends) ---
const allowed = [
  'http://localhost:5173',
  'https://floracarbon.netlify.app',
  'https://floracarbon.ai',
  'https://www.floracarbon.ai',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser tools (curl/Postman)
      if (!origin) return callback(null, true);

      if (allowed.includes(origin)) {
        return callback(null, true);
      }
      // Block everything else (safer in production)
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: false,
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

// --- Health check ---
app.get('/health', (_req, res) => res.status(200).send('ok'));

// --- Routes ---
app.use('/api/auth', require('./routes/auth'));

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ API running on port ${PORT}`));
