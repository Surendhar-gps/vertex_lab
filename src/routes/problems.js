const express = require('express');
const {
    createProblem,
    getProblemById,
    updateProblem,
    deleteProblem,
    parseQuestions,
    bulkQuestions,
    renumberQuestions,
} = require('../controllers/problemController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadAnswerKey } = require('../config/cloudinary');

const router = express.Router();

router.use(verifyToken);

// Faculty creates a problem (with optional DXF answer key upload)
router.post('/', requireRole('faculty', 'admin'), uploadAnswerKey.single('answerKeyFile'), createProblem);
router.get('/:id', getProblemById);
router.put('/:id', requireRole('faculty', 'admin'), uploadAnswerKey.single('answerKeyFile'), updateProblem);
router.delete('/:id', requireRole('faculty', 'admin'), deleteProblem);

// Bulk questions
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
router.post('/parse', requireRole('faculty', 'admin'), upload.single('file'), parseQuestions);
router.post('/bulk', requireRole('faculty', 'admin'), bulkQuestions);

// One-time fix: renumber existing questions per type
router.post('/renumber', requireRole('admin'), renumberQuestions);

module.exports = router;