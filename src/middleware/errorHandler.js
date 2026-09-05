/**
 * Central error handling middleware.
 * Must be registered LAST in Express app.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => e.message);
    message = errors.join(', ');
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists.`;
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'Resource not found.';
  }

  // Multer file errors
  if (err.message && err.message.includes('Only .dxf files')) {
    statusCode = 400;
    message = err.message;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File too large. Maximum size is 20MB.';
  }

  // Don't expose stack traces in production
  const response = {
    success: false,
    message,
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  console.error(`[ERROR] ${statusCode} - ${message}`);
  res.status(statusCode).json(response);
};

module.exports = errorHandler;
