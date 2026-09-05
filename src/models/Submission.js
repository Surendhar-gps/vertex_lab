const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: true,
    },
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
    // Cloudinary file info - never store the file itself in MongoDB
    cadFileUrl: {
      type: String,
      required: function() { return this.mcqAnswer === undefined; },
    },
    mcqAnswer: {
      type: Number, // Index of the selected option
    },
    cadFilePublicId: {
      type: String,
    },
    cadFileName: {
      type: String,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    // Evaluation fields
    autoScore: {
      type: Number,
      default: null, // null until evaluated
    },
    finalScore: {
      type: Number,
      default: null, // null until evaluated; faculty can override
    },
    maxScore: {
      type: Number,
      default: 10,
    },
    // Faculty manual review
    facultyComment: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    evaluatedAt: {
      type: Date,
    },
    reviewedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'evaluated', 'reviewed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// One submission per student per problem (prevent duplicates)
submissionSchema.index({ student: 1, problem: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
