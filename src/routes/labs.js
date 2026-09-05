const express = require('express');
const { getLabs, createLab, getLabById, updateLab, deleteLab } = require('../controllers/labController');
const {
  getExperimentsByLab,
  createExperiment,
} = require('../controllers/experimentController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get('/', getLabs);
router.post('/', requireRole('faculty', 'admin'), createLab);
router.get('/:id', getLabById);
router.put('/:id', requireRole('faculty', 'admin'), updateLab);
router.delete('/:id', requireRole('faculty', 'admin'), deleteLab);

// Nested experiments under labs
router.get('/:labId/experiments', getExperimentsByLab);
router.post('/:labId/experiments', requireRole('faculty', 'admin'), createExperiment);

module.exports = router;
