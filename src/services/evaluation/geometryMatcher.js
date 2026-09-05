/**
 * Matches geometric entities from a student submission to the answer key.
 */

const TOLERANCE = 0.5; // mm tolerance

const distance = (x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

const isClose = (val1, val2) => Math.abs(val1 - val2) <= TOLERANCE;

const isPointClose = (x1, y1, x2, y2) => distance(x1, y1, x2, y2) <= TOLERANCE;

const matchLines = (studentLines, answerLines) => {
  let matches = 0;
  const matchedAnswerIndices = new Set();

  for (const sl of studentLines) {
    for (let i = 0; i < answerLines.length; i++) {
      if (matchedAnswerIndices.has(i)) continue;
      const al = answerLines[i];

      // Check both directions (start-to-start + end-to-end OR start-to-end + end-to-start)
      const dir1 = isPointClose(sl.x1, sl.y1, al.x1, al.y1) && isPointClose(sl.x2, sl.y2, al.x2, al.y2);
      const dir2 = isPointClose(sl.x1, sl.y1, al.x2, al.y2) && isPointClose(sl.x2, sl.y2, al.x1, al.y1);

      if (dir1 || dir2) {
        matches++;
        matchedAnswerIndices.add(i);
        break; // line matched, move to next student line
      }
    }
  }

  return {
    totalExpected: answerLines.length,
    matches,
    score: answerLines.length === 0 ? 0 : matches / answerLines.length
  };
};

const matchCircles = (studentCircles, answerCircles) => {
  let matches = 0;
  const matchedAnswerIndices = new Set();

  for (const sc of studentCircles) {
    for (let i = 0; i < answerCircles.length; i++) {
      if (matchedAnswerIndices.has(i)) continue;
      const ac = answerCircles[i];

      if (isPointClose(sc.cx, sc.cy, ac.cx, ac.cy) && isClose(sc.r, ac.r)) {
        matches++;
        matchedAnswerIndices.add(i);
        break;
      }
    }
  }

  return {
    totalExpected: answerCircles.length,
    matches,
    score: answerCircles.length === 0 ? 0 : matches / answerCircles.length
  };
};

module.exports = {
  matchLines,
  matchCircles,
};
