const Lab = require('../models/Lab');
const WeeklyExperiment = require('../models/WeeklyExperiment');
const Problem = require('../models/Problem');
const User = require('../models/User');
const ExperimentSubmission = require('../models/ExperimentSubmission');
const { getLabProgress } = require('../services/progressService');


/**
 * GET /api/labs
 * - Faculty/Admin: all labs they created or all labs
 * - Student: only PUBLISHED labs assigned to their class/section
 */
const getLabs = async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === 'faculty') {
      query.createdBy = req.user._id;
      console.log(`[DEBUG] getLabs (faculty) -> querying with createdBy: ${req.user._id}`);
    } else if (req.user.role === 'student') {
      // A student with no class/section assigned yet must see NO labs,
      // not every lab. Only build a real filter once both are present.
      if (!req.user.class || !req.user.section) {
        return res.json({ success: true, data: { labs: [], total: 0 } });
      }
      query = {
        isActive: true,
        isPublished: true, // students only ever see published labs
        class: req.user.class.toUpperCase(),
        section: req.user.section.toUpperCase(),
      };
    }
    // Admin sees all (including drafts)

    const labs = await Lab.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    console.log(`[DEBUG] getLabs -> found ${labs.length} labs`);

    let filteredLabs = labs;

    // Attach experiment count and progress
    const labsWithCount = await Promise.all(
      filteredLabs.map(async (lab) => {
        // Students only ever count published experiments toward totals
        const expQuery = { lab: lab._id, isActive: true };
        if (req.user.role === 'student') {
          expQuery.isPublished = true;
        }
        const count = await WeeklyExperiment.countDocuments(expQuery);

        let progressData = {};

        if (req.user.role === 'student') {
          const progress = await getLabProgress(req.user._id, lab._id);
          progressData = { ...progress };
        } else if (req.user.role === 'faculty' || req.user.role === 'admin') {
          const allStudentsInClass = await User.find({
            role: 'student',
            class: lab.class,
            section: lab.section,
            ...(lab.academicYear ? { academicYear: lab.academicYear } : {})
          }).select('registrationNumber');

          const assignedStudents = allStudentsInClass.map(s => s._id);
          const assignedCount = assignedStudents.length;

          const submittedStudentsCount = await ExperimentSubmission.distinct('student', {
            lab: lab._id,
            student: { $in: assignedStudents }
          });

          let completedCount = 0;
          if (count > 0 && assignedCount > 0) {
            const studentCompletionAgg = await ExperimentSubmission.aggregate([
              { $match: { lab: lab._id, student: { $in: assignedStudents }, status: 'evaluated' } },
              { $group: { _id: '$student', evaluatedCount: { $sum: 1 } } },
              { $match: { evaluatedCount: { $gte: count } } }
            ]);
            completedCount = studentCompletionAgg.length;
          }

          progressData = {
            assignedStudents: assignedCount,
            studentsSubmitted: submittedStudentsCount.length,
            studentsCompleted: completedCount,
          };
        }

        return {
          ...lab.toObject(),
          experimentCount: count,
          totalExperiments: count,
          ...progressData
        };
      })
    );

    res.json({
      success: true,
      data: { labs: labsWithCount, total: labsWithCount.length },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/labs
 * Faculty creates a new lab. Always starts as a draft (isPublished: false)
 * regardless of what's sent in the body, so students never see a lab
 * before faculty explicitly publishes it.
 */
const createLab = async (req, res, next) => {
  try {
    const { title, description, topic, class: labClass, section, academicYear } = req.body;

    if (!title || !topic || !labClass || !section) {
      return res.status(400).json({
        success: false,
        message: 'Title, topic, class, and section are required.',
      });
    }

    const lab = await Lab.create({
      title,
      description,
      topic,
      class: labClass,
      section,
      academicYear,
      createdBy: req.user._id,
      isPublished: false, // always starts as draft
    });

    console.log(`[DEBUG] createLab -> saved lab ${lab._id} with createdBy: ${lab.createdBy}`);

    await lab.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Lab created successfully.',
      data: { lab },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/labs/:id
 * Get a single lab with its experiments.
 * Students only see published experiments within the lab.
 */
const getLabById = async (req, res, next) => {
  try {
    const lab = await Lab.findById(req.params.id).populate('createdBy', 'name email');

    if (!lab) {
      return res.status(404).json({ success: false, message: 'Lab not found.' });
    }

    // A student should not be able to view an unpublished lab at all
    if (req.user && req.user.role === 'student' && !lab.isPublished) {
      return res.status(404).json({ success: false, message: 'Lab not found.' });
    }

    const expQuery = { lab: lab._id, isActive: true };
    if (req.user && req.user.role === 'student') {
      expQuery.isPublished = true;
    }

    const experiments = await WeeklyExperiment.find(expQuery).sort({ weekNumber: 1 });

    const experimentsWithCount = await Promise.all(
      experiments.map(async (exp) => {
        const questionCount = await Problem.countDocuments({
          weeklyExperiment: exp._id,
          isActive: true,
        });
        return { ...exp.toObject(), questionCount };
      })
    );

    let labData = lab.toObject();
    if (req.user && req.user.role === 'student') {
      const progress = await getLabProgress(req.user._id, lab._id);
      labData = { ...labData, ...progress };
    } else {
      const count = await WeeklyExperiment.countDocuments({ lab: lab._id, isActive: true });
      labData.experimentCount = count;
      labData.totalExperiments = count;
    }

    res.json({
      success: true,
      data: { lab: labData, experiments: experimentsWithCount },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/labs/:id
 * Faculty updates a lab (title, description, questions, etc. via nested
 * routes). isPublished is intentionally NOT settable here — publishing
 * only happens through the dedicated publishLab endpoint below, so it's
 * a deliberate action, not a side-effect of an unrelated edit.
 */
const updateLab = async (req, res, next) => {
  try {
    const lab = await Lab.findById(req.params.id);

    if (!lab) {
      return res.status(404).json({ success: false, message: 'Lab not found.' });
    }

    if (lab.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this lab.' });
    }

    // Strip isPublished/publishedAt from arbitrary updates
    const { isPublished, publishedAt, ...safeUpdates } = req.body;

    const updated = await Lab.findByIdAndUpdate(req.params.id, safeUpdates, {
      new: true,
      runValidators: true,
    }).populate('createdBy', 'name email');

    res.json({ success: true, message: 'Lab updated.', data: { lab: updated } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/labs/:id/publish
 * Faculty explicitly publishes a lab, making it visible to students.
 * Body: { publish: true } to publish, { publish: false } to unpublish/revert to draft.
 */
const publishLab = async (req, res, next) => {
  try {
    const lab = await Lab.findById(req.params.id);

    if (!lab) {
      return res.status(404).json({ success: false, message: 'Lab not found.' });
    }

    if (lab.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to publish this lab.' });
    }

    const shouldPublish = req.body.publish !== false; // default true

    lab.isPublished = shouldPublish;
    lab.publishedAt = shouldPublish ? new Date() : undefined;
    await lab.save();

    res.json({
      success: true,
      message: shouldPublish ? 'Lab published successfully.' : 'Lab reverted to draft.',
      data: { lab },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/labs/:id
 * Faculty/Admin deletes a lab
 */
const deleteLab = async (req, res, next) => {
  try {
    const lab = await Lab.findById(req.params.id);

    if (!lab) {
      return res.status(404).json({ success: false, message: 'Lab not found.' });
    }

    if (lab.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this lab.' });
    }

    await Lab.findByIdAndDelete(req.params.id);

    await WeeklyExperiment.deleteMany({ lab: req.params.id });
    await Problem.deleteMany({ lab: req.params.id });
    const Submission = require('../models/Submission');
    await Submission.deleteMany({ lab: req.params.id });
    await ExperimentSubmission.deleteMany({ lab: req.params.id });

    res.json({ success: true, message: 'Lab deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getLabs, createLab, getLabById, updateLab, publishLab, deleteLab };