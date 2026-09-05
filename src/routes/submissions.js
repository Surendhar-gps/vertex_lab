const express = require('express');
const {
  uploadSubmission,
  submitMcq,
  getStudentSubmissions,
  getSubmissionById,
  reviewSubmission,
  getFacultyProgressView,
  getStudentsForExperiment,
  manualReviewBulk,
} = require('../controllers/submissionController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadStudentSubmission } = require('../config/cloudinary');

const router = express.Router();

router.use(verifyToken);

// Student routes
router.post(
  '/upload',
  requireRole('student'),
  uploadStudentSubmission.single('cadFile'),
  uploadSubmission
);
router.post('/mcq', requireRole('student'), submitMcq);
router.get('/student', requireRole('student'), getStudentSubmissions);

// Faculty routes
router.get('/faculty/progress', requireRole('faculty', 'admin'), getFacultyProgressView);
router.get('/faculty/students-for-experiment', requireRole('faculty', 'admin'), getStudentsForExperiment);
router.put('/:id/review', requireRole('faculty', 'admin'), reviewSubmission);
router.put('/manual-review', requireRole('faculty', 'admin'), manualReviewBulk);

// Shared (student sees own, faculty/admin sees all)
router.get('/:id', getSubmissionById);

module.exports = router;
