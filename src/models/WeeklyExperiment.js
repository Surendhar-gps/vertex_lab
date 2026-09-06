const mongoose = require('mongoose');

const weeklyExperimentSchema = new mongoose.Schema(
  {
    lab: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lab',
      required: true,
    },
    weekNumber: {
      type: Number,
      required: [true, 'Week number is required'],
      min: 1,
    },
    title: {
      type: String,
      required: [true, 'Experiment title is required'],
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
    dueDate: {
      type: Date,
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
    // Draft/Publish workflow: a weekly experiment starts as a draft so
    // faculty can add/edit questions freely; students only see it once
    // it's explicitly published.
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index: a lab can only have one experiment per week
weeklyExperimentSchema.index({ lab: 1, weekNumber: 1 }, { unique: true });

// Virtual: questions in this experiment
weeklyExperimentSchema.virtual('questions', {
  ref: 'Problem',
  localField: '_id',
  foreignField: 'weeklyExperiment',
  count: true,
});

module.exports = mongoose.model('WeeklyExperiment', weeklyExperimentSchema);