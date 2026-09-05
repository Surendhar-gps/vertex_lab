const { parseDxf } = require('./parser');
const { matchLines, matchCircles } = require('./geometryMatcher');

/**
 * Evaluates a student's DXF against the answer key DXF.
 * @param {string} studentDxfString 
 * @param {string} answerDxfString 
 * @param {number} maxMarks 
 * @returns {Object} Evaluation result
 */
const evaluateDxf = (studentDxfString, answerDxfString, maxMarks = 10) => {
  try {
    const studentEntities = parseDxf(studentDxfString);
    const answerEntities = parseDxf(answerDxfString);

    const lineMatches = matchLines(studentEntities.lines, answerEntities.lines);
    const circleMatches = matchCircles(studentEntities.circles, answerEntities.circles);

    const totalExpected = lineMatches.totalExpected + circleMatches.totalExpected;
    const totalMatched = lineMatches.matches + circleMatches.matches;

    // If answer key is empty (no expected lines/circles), fallback to manual grading or 0
    if (totalExpected === 0) {
      return {
        score: 0,
        maxScore: maxMarks,
        isMock: false,
        evaluatorVersion: 'geom-v1.0',
        note: 'Answer key contains no verifiable lines or circles. Requires manual evaluation.',
        details: { expected: 0, matched: 0 }
      };
    }

    const ratio = totalMatched / totalExpected;
    const score = Math.round(ratio * maxMarks * 10) / 10;

    return {
      score,
      maxScore: maxMarks,
      isMock: false,
      evaluatorVersion: 'geom-v1.0',
      note: `Matched ${totalMatched} out of ${totalExpected} geometric entities.`,
      details: {
        expected: totalExpected,
        matched: totalMatched,
        lineExpected: lineMatches.totalExpected,
        lineMatched: lineMatches.matches,
        circleExpected: circleMatches.totalExpected,
        circleMatched: circleMatches.matches
      }
    };
  } catch (err) {
    console.error('evaluateDxf error:', err);
    return {
      score: 0,
      maxScore: maxMarks,
      isMock: false,
      evaluatorVersion: 'geom-v1.0',
      error: 'Evaluation crashed: DXF file may be corrupted or unsupported.',
      note: 'Failed to evaluate geometry.',
    };
  }
};

module.exports = { evaluateDxf };
