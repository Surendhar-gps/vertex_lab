const WeeklyExperiment = require('../models/WeeklyExperiment');
const ExperimentSubmission = require('../models/ExperimentSubmission');

/**
 * Calculates the overall progress of a lab for a specific student.
 * 
 * Progress is purely based on the number of COMPLETED weekly experiments.
 * A weekly experiment is considered completed if there is an ExperimentSubmission
 * record for that student (meaning they explicitly clicked 'Submit Weekly Experiment').
 * 
 * @param {string} studentId 
 * @param {string} labId 
 * @returns {Promise<Object>} { totalExperiments, completedExperiments, progressPercentage }
 */
const getLabProgress = async (studentId, labId) => {
  try {
    // Get all active weekly experiments for this lab
    const experiments = await WeeklyExperiment.find({
      lab: labId,
      isActive: true,
    }).select('_id');

    const totalExperiments = experiments.length;

    if (totalExperiments === 0) {
      return { totalExperiments: 0, completedExperiments: 0, progressPercentage: 0 };
    }

    const experimentIds = experiments.map(exp => exp._id);

    // Count how many of these experiments have a final submission from the student
    const completedExperiments = await ExperimentSubmission.countDocuments({
      student: studentId,
      weeklyExperiment: { $in: experimentIds },
    });

    // Ensure we don't return impossible values
    const safeCompleted = Math.min(completedExperiments, totalExperiments);

    const progressPercentage = Math.round((safeCompleted / totalExperiments) * 100);

    return {
      totalExperiments,
      completedExperiments: safeCompleted,
      progressPercentage,
    };
  } catch (error) {
    console.error('Error calculating lab progress:', error);
    return { totalExperiments: 0, completedExperiments: 0, progressPercentage: 0 };
  }
};

module.exports = {
  getLabProgress,
};
