const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const labRoutes = require('./routes/labs');
const experimentRoutes = require('./routes/experiments');
const problemRoutes = require('./routes/problems');
const submissionRoutes = require('./routes/submissions');
const adminRoutes = require('./routes/admin');
const facultyRoutes = require('./routes/faculty');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet());

// CORS — only allow requests from the configured client URL
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy does not allow origin: ${origin}`));
      }
    },
    credentials: true,
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    success: isConnected,
    server: 'running',
    database: isConnected ? 'connected' : 'disconnected',
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/experiments', experimentRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/faculty', facultyRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found.`,
  });
});

// ─── Central Error Handler (must be last) ────────────────────────────────────
app.use(errorHandler);

module.exports = app;
