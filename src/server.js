const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
console.log('EMAIL_USER loaded:', process.env.EMAIL_USER);
console.log('EMAIL_PASS loaded:', process.env.EMAIL_PASS ? 'yes (hidden)' : 'undefined');
const app = require('./app');
const connectDB = require('./config/db');


const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start server
const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Process terminated.');
      process.exit(0);
    });
  });
};

startServer();