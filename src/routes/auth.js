const express = require('express');
const {
  register, login, studentSelfRegister, getMe, profileSetup, updateProfile,
  forgotPassword, resetPassword,
} = require('../controllers/authController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadAvatar } = require('../config/cloudinary');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/student-register', studentSelfRegister); // Self-registration for new students
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/me', verifyToken, getMe);
router.put('/profile-setup', verifyToken, requireRole('student'), profileSetup);
router.put('/update-profile', verifyToken, uploadAvatar.single('avatar'), updateProfile);

module.exports = router;