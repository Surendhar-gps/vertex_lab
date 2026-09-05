/**
 * DXF Evaluator — main entry point for DXF evaluation.
 * Downloads student + answer key DXF, parses both, scores the student's work.
 */

const { parseDxf } = require('./parser');
const { scoreSubmission } = require('./scoringEngine');

/**
 * Evaluate a student's DXF submission against the answer key.
 * @param {string} studentDxfUrl - Cloudinary URL for student's DXF
 * @param {string} answerKeyUrl - Cloudinary URL for answer key DXF
 * @param {Object} config - evaluationConfig from Problem
 * @param {number} maxScore - max marks
 * @returns {Promise<{ autoScore, maxScore, percentage, confidence, criteria, error? }>}
 */
async function evaluateDxf(studentDxfUrl, answerKeyUrl, config = {}, maxScore = 10) {
  try {
    // Fetch student DXF
    let studentContent = '';
    let answerContent = '';

    try {
      const fetchWithTimeout = (url, timeout = 10000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
      };

      const studentResp = await fetchWithTimeout(studentDxfUrl);
      if (!studentResp.ok) throw new Error(`Failed to fetch student DXF: ${studentResp.status}`);
      studentContent = await studentResp.text();
    } catch (err) {
      console.error('[DXF Evaluator] Could not fetch student DXF:', err.message);
      return {
        autoScore: 0,
        maxScore,
        percentage: 0,
        confidence: 0,
        criteria: [],
        error: 'Unable to evaluate the uploaded DXF file.',
      };
    }

    // Fetch answer key DXF (optional — if absent, give partial credit)
    if (answerKeyUrl) {
      try {
        const fetchWithTimeout = (url, timeout = 10000) => {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), timeout);
          return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
        };
        const answerResp = await fetchWithTimeout(answerKeyUrl);
        if (answerResp.ok) {
          answerContent = await answerResp.text();
        }
      } catch (err) {
        console.warn('[DXF Evaluator] Could not fetch answer key DXF:', err.message);
      }
    }

    // Parse both DXFs
    const studentGeo = parseDxf(studentContent);
    const answerGeo = answerContent ? parseDxf(answerContent) : { entities: [], bounds: null, isValid: false };

    if (!studentGeo.isValid) {
      return {
        autoScore: 0,
        maxScore,
        percentage: 0,
        confidence: 0.9,
        criteria: [],
        error: studentGeo.error || 'Unable to evaluate the uploaded DXF file.',
      };
    }

    // Score
    const result = scoreSubmission(studentGeo, answerGeo, config, maxScore);
    return result;
  } catch (err) {
    console.error('[DXF Evaluator] Unexpected error:', err.message);
    return {
      autoScore: 0,
      maxScore,
      percentage: 0,
      confidence: 0,
      criteria: [],
      error: 'Unable to evaluate the uploaded DXF file.',
    };
  }
}

module.exports = { evaluateDxf };
