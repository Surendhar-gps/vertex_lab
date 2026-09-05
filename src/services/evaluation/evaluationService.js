/**
 * Evaluation Service — orchestrates the CAD evaluation pipeline.
 * 
 * Uses real DXF evaluation when answer key is available.
 * Falls back to mock evaluation for development/testing.
 */

const { evaluateDxf } = require('./evaluator');
const Submission = require('../../models/Submission');
const Problem = require('../../models/Problem');
const axios = require('axios');

/**
 * Main evaluation function — called after student finalizes the experiment.
 * @param {string} submissionId - MongoDB ObjectId of the Submission
 */
const evaluateSubmission = async (submissionId) => {
  try {
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    const problem = await Problem.findById(submission.problem);
    if (!problem) {
      throw new Error(`Problem not found: ${submission.problem}`);
    }

    let result;

    // Real DXF evaluation if we have the student's file and answer key
    if (submission.cadFileUrl && problem.answerKeyFileUrl) {
      try {
        const studentResponse = await axios.get(submission.cadFileUrl);
        const answerResponse = await axios.get(problem.answerKeyFileUrl);
        
        result = evaluateDxf(
          studentResponse.data,
          answerResponse.data,
          problem.marks || 10
        );
      } catch (err) {
        console.error('Failed to download DXF files:', err);
        result = mockEvaluate(submission, problem);
      }
    } else {
      // Fallback mock
      result = mockEvaluate(submission, problem);
    }

    submission.autoScore = result.score !== undefined ? result.score : result.autoScore;
    submission.finalScore = result.score !== undefined ? result.score : result.autoScore;
    submission.maxScore = result.maxScore || problem.marks || 10;
    submission.status = 'evaluated';
    submission.evaluatedAt = new Date();

    await submission.save();

    console.log(
      `[Evaluation] Submission ${submissionId} evaluated: ${result.autoScore}/${result.maxScore}`
    );

    return submission;
  } catch (error) {
    console.error(`[Evaluation] Error evaluating submission ${submissionId}:`, error.message);
    throw error;
  }
};

/**
 * Fallback mock evaluator (used when no DXF can be fetched)
 */
function mockEvaluate(submission, problem) {
  const maxScore = problem.marks || 10;
  // Give partial credit based on file being uploaded
  const autoScore = submission.cadFileUrl ? Math.round(maxScore * 0.6) : 0;
  return { autoScore, maxScore, percentage: Math.round((autoScore / maxScore) * 100), isMock: true };
}

module.exports = { evaluateSubmission };
