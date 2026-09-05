const mongoose = require('mongoose');

/**
 * ExperimentSubmission tracks the FINAL submission state of a student
 * for a whole Weekly Experiment (not individual questions).
 * 
 * Individual CAD file uploads are tracked in the Submission model.
 * This model stores:
 *  - When the student finalized the experiment
 *  - Whether evaluation has been triggered
 */
const experimentSubmissionSchema = new mongoose.Schema(
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
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // When the student clicked "Submit Weekly Experiment"
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    // Instead of one global status, we now track sections independently
    mcqStatus: {
      type: String,
      enum: ['not_submitted', 'submitted', 'evaluated'],
      default: 'not_submitted',
    },
    skillEnhancerStatus: {
      type: String,
      enum: ['not_submitted', 'submitted', 'evaluating', 'evaluated'],
      default: 'not_submitted',
    },
    practiceStatus: {
      type: String,
      enum: ['not_submitted', 'submitted', 'evaluating', 'evaluated'],
      default: 'not_submitted',
    },
    // Summary scores (populated after all question evaluations complete)
    totalAutoScore: {
      type: Number,
      default: null,
    },
    totalMaxScore: {
      type: Number,
      default: null,
    },
    totalFinalScore: {
      type: Number,
      default: null,
    },
    evaluatedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// One final submission per student per experiment
experimentSubmissionSchema.index(
  { weeklyExperiment: 1, student: 1 },
  { unique: true }
);

module.exports = mongoose.model('ExperimentSubmission', experimentSubmissionSchema);
