const mongoose = require('mongoose');

const labSchema = new mongoose.Schema(

  {

    title: {

      type: String,

      required: [true, 'Lab title is required'],

      trim: true,

    },

    description: {

      type: String,

      trim: true,

    },

    topic: {

      type: String,

      required: [true, 'Topic is required'],

      trim: true,

    },

    createdBy: {

      type: mongoose.Schema.Types.ObjectId,

      ref: 'User',

      required: true,

    },

    // Class assignment

    class: {

      type: String,

      required: [true, 'Class is required'],

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

      trim: true,

    },

    isActive: {

      type: Boolean,

      default: true,

    },

  },

  {

    timestamps: true,

    toJSON: { virtuals: true },

    toObject: { virtuals: true },

  }

);

// Virtual: experiments count

labSchema.virtual('experiments', {

  ref: 'WeeklyExperiment',

  localField: '_id',

  foreignField: 'lab',

  count: true,

});

module.exports = mongoose.model('Lab', labSchema);