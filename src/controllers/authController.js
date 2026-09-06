const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

/**
 * Generate JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * POST /api/auth/register
 * Register a new user (primarily used by admin for creating faculty/student accounts)
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and role are required.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    const user = await User.create({ name, email, password, role });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileCompleted: user.profileCompleted,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Login with email + password.
 * For students: if the account does not exist, returns needsRegistration: true
 * so the frontend can show a self-registration form instead of a plain error.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database unavailable. Please try again later.',
      });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Explicitly select password since it's excluded by default
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    const { role: hintRole } = req.body;

    if (!user) {
      // Special case: student login with unknown email → prompt self-registration
      if (hintRole === 'student') {
        return res.status(404).json({
          success: false,
          needsRegistration: true,
          message: 'No account found. Please complete registration.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been disabled. Contact admin.',
      });
    }

    // Strict Role Checking: Enforce that the user logs in through the correct portal
    if (hintRole && user.role !== hintRole) {
      const displayRole = user.role === 'admin' ? 'Administrator' : (user.role.charAt(0).toUpperCase() + user.role.slice(1));
      return res.status(401).json({
        success: false,
        message: `This account is registered as ${displayRole}. Please use ${displayRole} Login.`,
      });
    }

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileCompleted: user.profileCompleted,
          registrationNumber: user.registrationNumber,
          mobileNumber: user.mobileNumber,
          class: user.class,
          section: user.section,
          academicYear: user.academicYear,
          avatarUrl: user.avatarUrl,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/student-register
 * Student self-registration: creates a full student account in one step.
 * Used when a student logs in for the first time with no pre-existing account.
 */
const studentSelfRegister = async (req, res, next) => {
  try {
    const {
      name, email, password,
      registrationNumber, mobileNumber,
      class: studentClass, section, academicYear,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      // Account was just created (race condition) — just log them in
      const token = generateToken(existing);
      return res.json({
        success: true,
        message: 'Account already exists. Logging you in.',
        data: {
          token,
          user: {
            id: existing._id,
            name: existing.name,
            email: existing.email,
            role: existing.role,
            profileCompleted: existing.profileCompleted,
            registrationNumber: existing.registrationNumber,
            mobileNumber: existing.mobileNumber,
            class: existing.class,
            section: existing.section,
            academicYear: existing.academicYear,
          },
        },
      });
    }

    if (registrationNumber) {
      const regConflict = await User.findOne({
        registrationNumber: registrationNumber.toUpperCase(),
      });
      if (regConflict) {
        return res.status(400).json({
          success: false,
          message: 'Registration number is already in use.',
        });
      }
    }

    console.log('[DEBUG] Backend studentSelfRegister received payload:', {
      name, email, registrationNumber, mobileNumber, class: studentClass, section, academicYear
    });

    const user = await User.create({
      name,
      email,
      password,
      role: 'student',
      registrationNumber: registrationNumber ? registrationNumber.toUpperCase() : undefined,
      mobileNumber,
      class: studentClass ? studentClass.toUpperCase() : undefined,
      section: section ? section.toUpperCase() : undefined,
      academicYear,
      profileCompleted: true,
    });

    console.log('[DEBUG] Backend studentSelfRegister saved user:', user._id);

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileCompleted: user.profileCompleted,
          registrationNumber: user.registrationNumber,
          mobileNumber: user.mobileNumber,
          class: user.class,
          section: user.section,
          academicYear: user.academicYear,
          avatarUrl: user.avatarUrl,
        },
      },
    });
  } catch (error) {
    console.error('[DEBUG] Backend studentSelfRegister ERROR:', error.message, error.errors);
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Get current authenticated user's profile
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/profile-setup
 * Student first-login profile completion (for admin-pre-created accounts)
 */
const profileSetup = async (req, res, next) => {
  try {
    const { registrationNumber, mobileNumber } = req.body;

    if (!registrationNumber || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Registration number and mobile number are required.',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.registrationNumber && user.registrationNumber.toUpperCase() !== registrationNumber.toUpperCase()) {
      return res.status(400).json({
        success: false,
        message: 'Registration number does not match our records.',
      });
    }

    user.mobileNumber = mobileNumber;
    user.profileCompleted = true;
    await user.save();

    res.json({
      success: true,
      message: 'Profile setup complete.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/update-profile
 * Update user's profile (name and mobileNumber only)
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, mobileNumber } = req.body;

    if (!name || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Name and mobile number are required.',
      });
    }

    const updates = { name, mobileNumber };
    if (req.file && req.file.path) {
      updates.avatarUrl = req.file.path;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password
 * Body: { email, role }
 *
 * Always responds with a generic success message, whether or not an account
 * exists for that email — this prevents someone from using this endpoint to
 * discover which emails are registered. If a matching, active account is
 * found, a reset token is generated, hashed, stored with a 30-minute expiry,
 * and a reset link is emailed to the address on file.
 */
const forgotPassword = async (req, res, next) => {
  const genericResponse = {
    success: true,
    message: 'If an account exists for this email, a password reset link has been sent.',
  };

  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const query = { email: normalizedEmail };
    if (role) query.role = role;

    const user = await User.findOne(query);

    // Don't reveal whether the account exists — respond the same either way.
    if (!user || !user.isActive) {
      return res.json(genericResponse);
    }

    // Generate a random raw token; only the SHA-256 hash of it is stored.
    // The raw token goes out in the email and is never persisted anywhere.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save({ validateBeforeSave: false });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    // Token is a URL path param (matches the frontend route /reset-password/:token
    // and authService.resetPassword, which POSTs to /auth/reset-password/:token).
    // Role is appended only as an optional query hint, not read by the backend.
    const resetLink = `${frontendUrl}/reset-password/${rawToken}${user.role ? `?role=${user.role}` : ''}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your Vertex Lab password',
        html: `
          <p>Hi ${user.name || ''},</p>
          <p>We received a request to reset your password. Click the link below to choose a new one:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
        `,
        text: `Reset your password: ${resetLink} (expires in 30 minutes)`,
      });
    } catch (emailError) {
      // Roll back the token so a broken mailer doesn't leave a dangling,
      // unusable reset request on the account.
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      console.error('[forgotPassword] Failed to send email:', emailError.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to send the reset email right now. Please try again later.',
      });
    }

    return res.json(genericResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password/:token
 * Params: { token }
 * Body: { password }
 *
 * Verifies the token against the stored hash and expiry, then sets the new
 * password (hashed automatically by the User model's pre-save hook).
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This reset link is invalid or has expired. Please request a new one.',
      });
    }

    user.password = password; // pre-save hook hashes this
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  studentSelfRegister,
  getMe,
  profileSetup,
  updateProfile,
  forgotPassword,
  resetPassword,
};