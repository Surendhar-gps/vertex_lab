const mongoose = require('mongoose');

const classSectionSchema = new mongoose.Schema(
  {
    department: {
      type: String,
      required: [true, 'Department / Class name is required'],
      trim: true,
      uppercase: true,
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      trim: true,
      uppercase: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: same dept + section + year cannot be duplicated
classSectionSchema.index(
  { department: 1, section: 1, academicYear: 1 },
  { unique: true }
);

module.exports = mongoose.model('ClassSection', classSectionSchema);
