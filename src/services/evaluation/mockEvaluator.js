/**
 * Mock CAD Evaluator - Development Only
 *
 * This is a placeholder evaluator that returns a deterministic mock score.
 * It is clearly labeled as mock evaluation and does NOT perform any actual
 * CAD geometry comparison.
 *
 * Replace this with dxfEvaluator.js when real evaluation is implemented.
 *
 * Future evaluation could include:
 *  - DXF parsing (via dxf-parser or similar)
 *  - Layer comparison
 *  - Entity count comparison
 *  - Dimension checking
 *  - Geometric similarity scoring
 *  - Tolerance-based matching
 *  - AI-assisted evaluation
 */

/**
 * Generate a deterministic mock score based on submission metadata.
 * In real implementation, this would compare student DXF vs answer key DXF.
 *
 * @param {Object} submission - Mongoose Submission document
 * @param {Object} problem - Mongoose Problem document (with answerKeyFileUrl)
 * @returns {number} - Mock score between 60-100% of max marks
 */
const mockEvaluate = (submission, problem) => {
  // Use submission ID to generate a consistent (deterministic) score
  // so the same submission always gets the same mock score
  const idStr = submission._id.toString();
  const lastChar = idStr.charCodeAt(idStr.length - 1);

  // Score ranges from 60% to 100% of marks
  const maxMarks = problem.marks || 10;
  const scorePercent = 60 + (lastChar % 41); // 60 to 100
  const mockScore = Math.round((scorePercent / 100) * maxMarks * 10) / 10;

  return {
    score: mockScore,
    maxScore: maxMarks,
    isMock: true,
    evaluatorVersion: 'mock-v1.0',
    note: '[MOCK EVALUATION] Real CAD comparison not yet implemented.',
  };
};

module.exports = { mockEvaluate };
