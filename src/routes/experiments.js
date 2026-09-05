const express = require('express');
const {
  getExperimentById,
  updateExperiment,
  deleteExperiment,
  submitSection,
  getExperimentProgress,
} = require('../controllers/experimentController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/:experimentId/progress', getExperimentProgress);
router.post('/:experimentId/submit/:section', requireRole('student'), submitSection);
router.get('/:id', getExperimentById);
router.put('/:id', requireRole('faculty', 'admin'), updateExperiment);
router.delete('/:id', requireRole('faculty', 'admin'), deleteExperiment);

module.exports = router;
