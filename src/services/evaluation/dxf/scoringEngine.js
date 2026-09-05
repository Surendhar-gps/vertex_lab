/**
 * DXF Scoring Engine — applies criteria-based partial scoring.
 */

const DEFAULT_TOLERANCE = 0.5;

/**
 * Compare two numbers within tolerance
 */
function withinTolerance(a, b, tolerance = DEFAULT_TOLERANCE) {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Score an experiment based on criteria.
 * @param {Object} studentGeo - parsed geometry from student DXF
 * @param {Object} answerGeo - parsed geometry from answer key DXF
 * @param {Object} config - evaluationConfig from Problem model
 * @param {number} maxScore - max marks for the problem
 * @returns {{ autoScore, maxScore, percentage, confidence, criteria }}
 */
function scoreSubmission(studentGeo, answerGeo, config = {}, maxScore = 10) {
  const tolerance = config.tolerance || DEFAULT_TOLERANCE;
  const checkOrigin = config.checkOrigin || false;
  const criteria = [];

  // If no geometry in student DXF
  if (!studentGeo.isValid || studentGeo.entities.length === 0) {
    return {
      autoScore: 0,
      maxScore,
      percentage: 0,
      confidence: 0.9,
      criteria: [{ name: 'geometry', passed: false, score: 0, max: maxScore, reason: 'No valid geometry found' }],
    };
  }

  // If no answer key geometry
  if (!answerGeo || !answerGeo.isValid || answerGeo.entities.length === 0) {
    // Cannot evaluate without answer key — give benefit of the doubt
    return {
      autoScore: Math.round(maxScore * 0.5),
      maxScore,
      percentage: 50,
      confidence: 0.3,
      criteria: [{ name: 'geometry', passed: true, score: Math.round(maxScore * 0.5), max: maxScore, reason: 'No answer key — partial credit' }],
    };
  }

  // ─── Criteria-Based Scoring ───────────────────────────────────────────────

  // 1. Geometry presence (always checked) — 20% of marks
  const geoMarks = Math.round(maxScore * 0.2);
  criteria.push({
    name: 'geometry_present',
    passed: true,
    score: geoMarks,
    max: geoMarks,
    reason: 'Valid geometry found',
  });

  // Analyze geometry
  const sBounds = studentGeo.bounds;
  const aBounds = answerGeo.bounds;

  let remainingMarks = maxScore - geoMarks;
  let totalEarned = geoMarks;

  // 2. Dimension check — width (30% of remaining)
  if (aBounds && sBounds) {
    const widthMarks = Math.round(remainingMarks * 0.35);
    const widthMatch = withinTolerance(sBounds.width, aBounds.width, tolerance * 2);
    criteria.push({
      name: 'width',
      expected: round2(aBounds.width),
      actual: round2(sBounds.width),
      passed: widthMatch,
      score: widthMatch ? widthMarks : 0,
      max: widthMarks,
      reason: widthMatch
        ? `Width ${round2(sBounds.width)} ≈ expected ${round2(aBounds.width)}`
        : `Width ${round2(sBounds.width)} ≠ expected ${round2(aBounds.width)} (tolerance ±${tolerance * 2})`,
    });
    if (widthMatch) totalEarned += widthMarks;

    // 3. Height check (30% of remaining)
    const heightMarks = Math.round(remainingMarks * 0.35);
    const heightMatch = withinTolerance(sBounds.height, aBounds.height, tolerance * 2);
    criteria.push({
      name: 'height',
      expected: round2(aBounds.height),
      actual: round2(sBounds.height),
      passed: heightMatch,
      score: heightMatch ? heightMarks : 0,
      max: heightMarks,
      reason: heightMatch
        ? `Height ${round2(sBounds.height)} ≈ expected ${round2(aBounds.height)}`
        : `Height ${round2(sBounds.height)} ≠ expected ${round2(aBounds.height)} (tolerance ±${tolerance * 2})`,
    });
    if (heightMatch) totalEarned += heightMarks;

    remainingMarks = remainingMarks - widthMarks - heightMarks;

    // 4. Closure check (15% of remaining)
    const closureMarks = Math.round(remainingMarks * 0.5);
    const studentClosed = checkClosure(studentGeo.entities, tolerance);
    const answerClosed = checkClosure(answerGeo.entities, tolerance);
    if (answerClosed) {
      criteria.push({
        name: 'closed',
        passed: studentClosed,
        score: studentClosed ? closureMarks : 0,
        max: closureMarks,
        reason: studentClosed ? 'Shape is properly closed' : 'Shape is not closed',
      });
      if (studentClosed) totalEarned += closureMarks;
      remainingMarks -= closureMarks;
    }

    // 5. Origin check (remaining marks if required)
    if (checkOrigin && remainingMarks > 0) {
      const originMarks = remainingMarks;
      const studentNearOrigin = sBounds && Math.abs(sBounds.minX) <= tolerance * 4 && Math.abs(sBounds.minY) <= tolerance * 4;
      const answerNearOrigin = aBounds && Math.abs(aBounds.minX) <= tolerance * 4 && Math.abs(aBounds.minY) <= tolerance * 4;

      if (answerNearOrigin) {
        criteria.push({
          name: 'origin',
          passed: studentNearOrigin,
          score: studentNearOrigin ? originMarks : 0,
          max: originMarks,
          reason: studentNearOrigin
            ? `Shape starts near origin (0,0)`
            : `Shape not at origin — found at (${round2(sBounds.minX)}, ${round2(sBounds.minY)})`,
        });
        if (studentNearOrigin) totalEarned += originMarks;
      }
    }

    // 6. Circle-specific checks
    const studentCircles = studentGeo.entities.filter((e) => e.type === 'CIRCLE');
    const answerCircles = answerGeo.entities.filter((e) => e.type === 'CIRCLE');
    if (answerCircles.length > 0 && studentCircles.length > 0 && remainingMarks > 0) {
      const circleMarks = remainingMarks;
      const radiusMatch = studentCircles.some((sc) =>
        answerCircles.some((ac) => withinTolerance(sc.radius, ac.radius, tolerance))
      );
      criteria.push({
        name: 'radius',
        passed: radiusMatch,
        score: radiusMatch ? circleMarks : 0,
        max: circleMarks,
        reason: radiusMatch
          ? 'Circle radius matches'
          : `Circle radius mismatch (expected ~${round2(answerCircles[0].radius)}, got ${round2(studentCircles[0].radius)})`,
      });
      if (radiusMatch) totalEarned += circleMarks;
    }
  }

  const clampedScore = Math.min(maxScore, Math.max(0, totalEarned));
  const confidence = aBounds ? 0.85 : 0.4;

  return {
    autoScore: clampedScore,
    maxScore,
    percentage: Math.round((clampedScore / maxScore) * 100),
    confidence,
    criteria,
  };
}

function checkClosure(entities, tolerance) {
  const polylines = entities.filter((e) => e.type === 'LWPOLYLINE');
  if (polylines.some((p) => p.isClosed)) return true;

  // Check if lines form a closed loop
  const lines = entities.filter((e) => e.type === 'LINE');
  if (lines.length < 3) return false;

  // Simple closure check: endpoints should connect
  let closedCount = 0;
  for (let i = 0; i < lines.length; i++) {
    for (let j = 0; j < lines.length; j++) {
      if (i === j) continue;
      if (
        withinTolerance(lines[i].x2, lines[j].x1, tolerance) &&
        withinTolerance(lines[i].y2, lines[j].y1, tolerance)
      ) {
        closedCount++;
      }
    }
  }
  return closedCount >= lines.length;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { scoreSubmission, withinTolerance };
