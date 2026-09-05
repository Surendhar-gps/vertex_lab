const User = require('../models/User');
const Lab = require('../models/Lab');
const WeeklyExperiment = require('../models/WeeklyExperiment');
const Problem = require('../models/Problem');
const Submission = require('../models/Submission');
const ExperimentSubmission = require('../models/ExperimentSubmission');
const { getLabProgress } = require('../services/progressService');

/**
 * GET /api/faculty/students
 * Filter by class, section, academicYear
 */
const getStudentsByFilter = async (req, res, next) => {
  try {
    const { class: className, section, academicYear } = req.query;

    const filter = { role: 'student' };
    if (className) filter.class = className;
    if (section) filter.section = section;
    if (academicYear) filter.academicYear = academicYear;

    const students = await User.find(filter)
      .select('name email registrationNumber class section academicYear mobileNumber profileCompleted')
      .sort({ registrationNumber: 1 });

    res.json({ success: true, data: { students, total: students.length } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/faculty/student-filters
 * Returns unique classes, sections, and academic years from the students in the database.
 */
const getStudentFilters = async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student' }).select('class section academicYear registrationNumber');

    const classes = [...new Set(students.map(s => s.class).filter(Boolean))].sort();
    const sections = [...new Set(students.map(s => s.section).filter(Boolean))].sort();
    const academicYears = [...new Set(students.map(s => s.academicYear).filter(Boolean))].sort();

    const regNumbers = [...new Set(students.map(s => s.registrationNumber).filter(Boolean))].sort();

    const studentsList = students.map(s => ({
      registrationNumber: s.registrationNumber,
      class: s.class,
      section: s.section,
      academicYear: s.academicYear
    }));

    res.json({
      success: true,
      data: { classes, sections, academicYears, regNumbers, studentsList }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/faculty/students/:studentId/progress
 */
const getStudentProgress = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const student = await User.findById(studentId).select(
      'name email registrationNumber class section academicYear'
    );
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const labFilter = {};
    if (student.class) labFilter.class = student.class;
    if (student.section) labFilter.section = student.section;
    if (student.academicYear) labFilter.academicYear = student.academicYear;

    const labs = await Lab.find(labFilter).populate('createdBy', 'name email');

    const labsWithProgress = await Promise.all(
      labs.map(async (lab) => {
        const experiments = await WeeklyExperiment.find({
          lab: lab._id,
          isActive: true,
        }).sort({ weekNumber: 1 });

        const experimentsWithProgress = await Promise.all(
          experiments.map(async (exp) => {
            const totalQuestions = await Problem.countDocuments({
              weeklyExperiment: exp._id,
              isActive: true,
            });

            const studentSubmissions = await Submission.find({
              weeklyExperiment: exp._id,
              student: studentId,
            });

            const finalSubmission = await ExperimentSubmission.findOne({
              weeklyExperiment: exp._id,
              student: studentId,
            });

            const completedQuestions = studentSubmissions.length;
            const percent =
              totalQuestions > 0
                ? Math.round((completedQuestions / totalQuestions) * 100)
                : 0;

            const totalScore = studentSubmissions.reduce(
              (acc, s) => acc + (s.finalScore ?? s.autoScore ?? 0),
              0
            );
            const maxScore = studentSubmissions.reduce(
              (acc, s) => acc + (s.maxScore || 10),
              0
            );

            return {
              ...exp.toObject(),
              totalQuestions,
              completedQuestions,
              percent,
              totalScore,
              maxScore,
              finalSubmission,
              submissions: studentSubmissions,
            };
          })
        );

        const labProgress = await getLabProgress(studentId, lab._id);

        return {
          ...lab.toObject(),
          ...labProgress,
          experiments: experimentsWithProgress,
        };
      })
    );

    res.json({
      success: true,
      data: { student, labs: labsWithProgress },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/faculty/dashboard-stats
 * Returns summary counts for the faculty dashboard.
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const facultyId = req.user._id;

    const labs = await Lab.find({ createdBy: facultyId });
    const labIds = labs.map((lab) => lab._id);

    const totalLabs = labs.length;

    const totalExperiments = await WeeklyExperiment.countDocuments({
      lab: { $in: labIds },
      isActive: true,
    });

    const totalStudents = await User.countDocuments({
      role: 'student',
      class: { $in: labs.map((l) => l.class) },
      section: { $in: labs.map((l) => l.section) },
    });

    const totalSubmissions = await ExperimentSubmission.countDocuments({
      lab: { $in: labIds },
    });

    res.json({
      success: true,
      data: {
        totalLabs,
        totalExperiments,
        totalStudents,
        totalSubmissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStudentsByFilter, getStudentFilters, getStudentProgress, getDashboardStats };