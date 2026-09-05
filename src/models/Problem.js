const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema(
  {
    weeklyExperiment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WeeklyExperiment',
      required: true,
    },
    lab: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lab',
      required: true,
    },
    questionNumber: {
      type: Number,
      required: [true, 'Question number is required'],
      min: 1,
    },
    type: {
      type: String,
      enum: ['mcq', 'skill_enhancer', 'practice_by_yourself'],
      required: [true, 'Section type is required'],
    },
    format: {
      type: String,
      enum: ['cad', 'mcq'],
      default: 'cad',
    },
    title: {
      type: String,
      required: [true, 'Question title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
    },
    answerKeyFileUrl: {
      type: String, // Cloudinary URL for reference/answer CAD file
    },
    answerKeyPublicId: {
      type: String, // Cloudinary public_id for deletion if needed
    },
    mcqOptions: [{
      text: { type: String, trim: true }
    }],
    mcqCorrectAnswer: {
      type: Number, // Index of the correct option
    },
    marks: {
      type: Number,
      default: 10,
      min: 1,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: unique question number per experiment and type
problemSchema.index({ weeklyExperiment: 1, type: 1, questionNumber: 1 }, { unique: true });

module.exports = mongoose.model('Problem', problemSchema);
