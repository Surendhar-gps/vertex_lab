const Submission = require('../models/Submission');
const Problem = require('../models/Problem');
const { evaluateSubmission } = require('../services/evaluation/evaluationService');


/**
 * POST /api/submissions/upload
 * Student uploads a CAD file for a specific problem.
 * File is processed by Cloudinary multer middleware before this runs.
 */
const uploadSubmission = async (req, res, next) => {
  try {
    const { problem, weeklyExperiment, lab } = req.body;

    if (!problem || !weeklyExperiment || !lab) {
      return res.status(400).json({
        success: false,
        message: 'problem, weeklyExperiment, and lab are required.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No CAD file uploaded.',
      });
    }

    const problemDoc = await Problem.findById(problem);
    if (!problemDoc) {
      return res.status(404).json({ success: false, message: 'Problem not found.' });
    }

    // Check for existing submission (update instead of duplicate)
    let submission = await Submission.findOne({
      student: req.user.id,
      problem,
    });

    if (submission) {
      // Update existing submission
      submission.cadFileUrl = req.file.path;
      submission.cadFilePublicId = req.file.filename;
      submission.cadFileName = req.file.originalname;
      submission.uploadedAt = new Date();
      submission.status = 'pending';
      submission.autoScore = null;
      submission.finalScore = null;
      await submission.save();
    } else {
      // Create new submission
      submission = await Submission.create({
        problem,
        weeklyExperiment,
        lab,
        student: req.user.id,
        cadFileUrl: req.file.path,
        cadFilePublicId: req.file.filename,
        cadFileName: req.file.originalname,
        maxScore: problemDoc.marks,
      });
    }

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully. Complete all questions then submit the experiment.',
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/submissions/mcq
 * Student submits an MCQ answer.
 */
const submitMcq = async (req, res, next) => {
  try {
    const { problem, weeklyExperiment, lab, mcqAnswer } = req.body;

    if (!problem || !weeklyExperiment || !lab || mcqAnswer === undefined) {
      return res.status(400).json({
        success: false,
        message: 'problem, weeklyExperiment, lab, and mcqAnswer are required.',
      });
    }

    const problemDoc = await Problem.findById(problem);
    if (!problemDoc || problemDoc.format !== 'mcq') {
      return res.status(400).json({ success: false, message: 'Invalid MCQ problem.' });
    }

    // Defer evaluation: just save the student's answer as pending.
    // Scoring will happen when they click "Submit MCQ" at the experiment level.
    
    let submission = await Submission.findOne({
      student: req.user.id,
      problem,
    });

    if (submission) {
      submission.mcqAnswer = Number(mcqAnswer);
      submission.uploadedAt = new Date();
      submission.status = 'pending';
      // Clear out any previous scores if they change their answer
      submission.autoScore = null;
      submission.finalScore = null;
      await submission.save();
    } else {
      submission = await Submission.create({
        problem,
        weeklyExperiment,
        lab,
        student: req.user.id,
        mcqAnswer: Number(mcqAnswer),
        maxScore: problemDoc.marks,
        status: 'pending',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Answer submitted successfully.',
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/submissions/student
 * Get current student's submissions (optionally filtered by experiment)
 */
const getStudentSubmissions = async (req, res, next) => {
  try {
    const { experimentId, labId } = req.query;
    const filter = { student: req.user.id };
    if (experimentId) filter.weeklyExperiment = experimentId;
    if (labId) filter.lab = labId;

    const submissions = await Submission.find(filter)
      .populate('problem', 'title questionNumber marks type')
      .populate('weeklyExperiment', 'title weekNumber')
      .sort({ uploadedAt: -1 });

    res.json({ success: true, data: { submissions } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/submissions/:id
 * Get a single submission detail
 */
const getSubmissionById = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('problem', 'title description instructions marks answerKeyFileUrl')
      .populate('student', 'name email registrationNumber')
      .populate('weeklyExperiment', 'title weekNumber')
      .populate('lab', 'title');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    // Students can only see their own submissions
    if (
      req.user.role === 'student' &&
      submission.student._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, data: { submission } });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/submissions/:id/review
 * Faculty manually reviews and optionally overrides the score.
 * autoScore is NEVER changed — only finalScore is updated.
 */
const reviewSubmission = async (req, res, next) => {
  try {
    const { finalScore, facultyComment, acceptAutoScore } = req.body;

    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    if (acceptAutoScore) {
      // Accept the auto score without override
      submission.finalScore = submission.autoScore;
    } else if (finalScore !== undefined && finalScore !== null) {
      // Override: finalScore changes, autoScore stays untouched
      submission.finalScore = finalScore;
    }

    if (facultyComment !== undefined) {
      submission.facultyComment = facultyComment;
    }

    submission.status = 'reviewed';
    submission.reviewedBy = req.user.id;
    submission.reviewedAt = new Date();

    await submission.save();

    res.json({
      success: true,
      message: 'Submission reviewed.',
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/submissions/faculty/progress
 * Faculty views student progress for a given lab/experiment
 */
const getFacultyProgressView = async (req, res, next) => {
  try {
    const { labId, experimentId, studentId } = req.query;
    const filter = {};
    if (labId) filter.lab = labId;
    if (experimentId) filter.weeklyExperiment = experimentId;
    if (studentId) filter.student = studentId;

    const submissions = await Submission.find(filter)
      .populate('student', 'name email registrationNumber section class')
      .populate('problem', 'title questionNumber marks')
      .populate('weeklyExperiment', 'title weekNumber')
      .sort({ 'student.registrationNumber': 1, 'problem.questionNumber': 1 });

    res.json({ success: true, data: { submissions } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/submissions/faculty/students-for-experiment
 * Returns distinct students who have submissions for a given experiment,
 * plus the problems in that experiment with current scores.
 */
const getStudentsForExperiment = async (req, res, next) => {
  try {
    const { experimentId } = req.query;
    if (!experimentId) {
      return res.status(400).json({ success: false, message: 'experimentId is required.' });
    }

    const submissions = await Submission.find({ weeklyExperiment: experimentId })
      .populate('student', 'name email registrationNumber class section')
      .populate('problem', 'title questionNumber marks')
      .sort({ 'problem.questionNumber': 1 });

    // Group by student
    const studentMap = {};
    for (const sub of submissions) {
      const sid = sub.student?._id?.toString();
      if (!sid) continue;
      if (!studentMap[sid]) {
        studentMap[sid] = { student: sub.student, submissions: [] };
      }
      studentMap[sid].submissions.push(sub);
    }

    res.json({
      success: true,
      data: { students: Object.values(studentMap) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/submissions/manual-review
 * Faculty bulk-sets final scores for each question of a student in an experiment.
 * Body: { studentId, experimentId, scores: [{ problemId, score, comment }] }
 */
const manualReviewBulk = async (req, res, next) => {
  try {
    const { studentId, experimentId, scores } = req.body;

    if (!studentId || !experimentId || !Array.isArray(scores)) {
      return res.status(400).json({
        success: false,
        message: 'studentId, experimentId, and scores[] are required.',
      });
    }

    const results = [];

    for (const { problemId, score, comment } of scores) {
      if (problemId == null || score == null) continue;

      let submission = await Submission.findOne({
        student: studentId,
        problem: problemId,
        weeklyExperiment: experimentId,
      });

      if (!submission) {
        // Create a placeholder submission if none exists
        const problemDoc = await Problem.findById(problemId);
        if (!problemDoc) continue;
        submission = await Submission.create({
          student: studentId,
          problem: problemId,
          weeklyExperiment: experimentId,
          lab: problemDoc.lab,
          maxScore: problemDoc.marks,
          status: 'reviewed',
          finalScore: Number(score),
          facultyComment: comment || '',
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        });
      } else {
        submission.finalScore = Number(score);
        if (comment !== undefined) submission.facultyComment = comment;
        submission.status = 'reviewed';
        submission.reviewedBy = req.user.id;
        submission.reviewedAt = new Date();
        await submission.save();
      }

      results.push(submission._id);
    }

    res.json({
      success: true,
      message: `${results.length} submission(s) updated.`,
      data: { updated: results.length },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadSubmission,
  submitMcq,
  getStudentSubmissions,
  getSubmissionById,
  reviewSubmission,
  getFacultyProgressView,
  getStudentsForExperiment,
  manualReviewBulk,
};

