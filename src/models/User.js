const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Never return password in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'faculty', 'student'],
      required: [true, 'Role is required'],
    },
    // Student-specific fields
    registrationNumber: {
      type: String,
      unique: true,
      sparse: true, // Allow null/undefined but enforce uniqueness when set
      trim: true,
      uppercase: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'],
    },
    // Student profile completion flag
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    // Student class details (set during profile setup or by admin)
    class: {
      type: String,
      trim: true,
    },
    section: {
      type: String,
      trim: true,
      uppercase: true,
    },
    academicYear: {
      type: String,
      trim: true,
    },
    avatarUrl: {
      type: String,
    },
    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Never return password in JSON responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
