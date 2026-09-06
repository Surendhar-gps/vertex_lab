const mongoose = require('mongoose');

const YEAR_LEVELS = ['I', 'II', 'III', 'IV'];

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
      required: [true, 'Year level is required'],
      trim: true,
      uppercase: true,
      enum: {
        values: YEAR_LEVELS,
        message: 'Year level must be one of I, II, III, IV',
      },
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

classSectionSchema.statics.YEAR_LEVELS = YEAR_LEVELS;

module.exports = mongoose.model('ClassSection', classSectionSchema);