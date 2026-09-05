const express = require('express');
const { getStudentsByFilter, getStudentFilters, getStudentProgress, getDashboardStats } = require('../controllers/facultyController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);
router.use(requireRole('faculty', 'admin'));

// GET /api/faculty/students?class=CSE&section=A&academicYear=2026-2027
router.get('/students', getStudentsByFilter);

// GET /api/faculty/dashboard-stats
router.get('/dashboard-stats', getDashboardStats);

// GET /api/faculty/student-filters
router.get('/student-filters', getStudentFilters);

// GET /api/faculty/students/:studentId/progress
router.get('/students/:studentId/progress', getStudentProgress);

module.exports = router;
