const express = require('express');
const {
  getAdminStats,
  getUsers,
  createUser,
  createStudentManual,
  updateUser,
  deleteUser,
  getClassSections,
  createClassSection,
  deleteClassSection,
  addStudentToClass,
  getDepartments,
  createDepartment,
  deleteDepartment,
  parseCombined,
  bulkCombined,
  parseFaculty,
  bulkFaculty,
  parseStudents,
  bulkStudents,
} = require('../controllers/adminController');
const { verifyToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.use(verifyToken);

// ─── Public/Shared Admin Data (Readable by all authenticated users) ───
// Students and Faculty need to read classes and departments for dropdowns.
router.get('/departments', getDepartments);
router.get('/classes', getClassSections);

// ─── Protected Admin Data (Admin only) ───
router.use(requireRole('admin'));

// Stats
router.get('/stats', getAdminStats);

// User management
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Manual student creation (full profile)
router.post('/students', createStudentManual);

// Class/Section management (Admin writes)
router.post('/classes', createClassSection);
router.delete('/classes/:id', deleteClassSection);
router.post('/classes/:id/students', addStudentToClass);

// Department management
router.post('/departments', createDepartment);
router.delete('/departments/:id', deleteDepartment);

// Bulk Imports
router.post('/parse-combined', upload.single('file'), parseCombined);
router.post('/bulk-combined', bulkCombined);

router.post('/parse-faculty', upload.single('file'), parseFaculty);
router.post('/bulk-faculty', bulkFaculty);

router.post('/parse-students', upload.single('file'), parseStudents);
router.post('/bulk-students', bulkStudents);

module.exports = router;
