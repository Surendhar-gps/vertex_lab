const WeeklyExperiment = require('../models/WeeklyExperiment');
const Problem = require('../models/Problem');
const Lab = require('../models/Lab');
const Submission = require('../models/Submission');
const ExperimentSubmission = require('../models/ExperimentSubmission');
const { evaluateSubmission } = require('../services/evaluation/evaluationService');

/**
 * GET /api/labs/:labId/experiments
 */
const getExperimentsByLab = async (req, res, next) => {
  try {
    const experiments = await WeeklyExperiment.find({
      lab: req.params.labId,
      isActive: true,
    })
      .populate('createdBy', 'name email')
      .sort({ weekNumber: 1 });

    const experimentsWithCount = await Promise.all(
      experiments.map(async (exp) => {
        const questionCount = await Problem.countDocuments({
          weeklyExperiment: exp._id,
          isActive: true,
        });
        return { ...exp.toObject(), questionCount };
      })
    );

    res.json({
      success: true,
      data: { experiments: experimentsWithCount, total: experimentsWithCount.length },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/labs/:labId/experiments
 */
const createExperiment = async (req, res, next) => {
  try {
    const { weekNumber, title, description, instructions, dueDate } = req.body;

    if (!weekNumber || !title) {
      return res.status(400).json({
        success: false,
        message: 'Week number and title are required.',
      });
    }

    const lab = await Lab.findById(req.params.labId);
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Lab not found.' });
    }

    const experimentData = {
      lab: req.params.labId,
      weekNumber,
      title,
      description,
      instructions,
      createdBy: req.user.id || req.user._id,
    };
    if (dueDate) {
      experimentData.dueDate = dueDate;
    }

    const experiment = await WeeklyExperiment.create(experimentData);

    await experiment.populate('createdBy', 'name email');
    const experimentWithCount = { ...experiment.toObject(), questionCount: 0 };

    res.status(201).json({
      success: true,
      message: 'Weekly experiment created.',
      data: { experiment: experimentWithCount },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/experiments/:id
 * Get a single experiment with its questions + final submission state for student
 */
const getExperimentById = async (req, res, next) => {
  try {
    const experiment = await WeeklyExperiment.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('lab', 'title topic');

    if (!experiment) {
      return res.status(404).json({ success: false, message: 'Experiment not found.' });
    }

    let questions = await Problem.find({
      weeklyExperiment: experiment._id,
      isActive: true,
    }).sort({ questionNumber: 1 });

    if (req.user && req.user.role === 'student') {
      questions = questions.map(q => {
        const obj = q.toObject();
        delete obj.mcqCorrectAnswer;
        return obj;
      });
    }

    // Check if student has a final submission for this experiment
    let finalSubmission = null;
    if (req.user.role === 'student') {
      finalSubmission = await ExperimentSubmission.findOne({
        weeklyExperiment: experiment._id,
        student: req.user.id,
      });
    }

    res.json({
      success: true,
      data: { experiment, questions, finalSubmission },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/experiments/:experimentId/submit/:section
 * Student finalizes a specific section of their Weekly Experiment.
 */
const submitSection = async (req, res, next) => {
  try {
    const { experimentId, section } = req.params;
    const studentId = req.user.id;

    if (!['mcq', 'skill_enhancer', 'practice_by_yourself'].includes(section)) {
      return res.status(400).json({ success: false, message: 'Invalid section.' });
    }

    const experiment = await WeeklyExperiment.findById(experimentId).populate('lab');
    if (!experiment) {
      return res.status(404).json({ success: false, message: 'Experiment not found.' });
    }

    // Get or create ExperimentSubmission
    let finalSubmission = await ExperimentSubmission.findOne({
      weeklyExperiment: experimentId,
      student: studentId,
    });

    if (!finalSubmission) {
      finalSubmission = await ExperimentSubmission.create({
        weeklyExperiment: experimentId,
        lab: experiment.lab._id || experiment.lab,
        student: studentId,
      });
    }

    // Check if already submitted
    const statusField = section === 'mcq' ? 'mcqStatus' : section === 'skill_enhancer' ? 'skillEnhancerStatus' : 'practiceStatus';
    if (finalSubmission[statusField] === 'submitted' || finalSubmission[statusField] === 'evaluating' || finalSubmission[statusField] === 'evaluated') {
      return res.status(400).json({
        success: false,
        message: `You have already submitted the ${section} section.`,
      });
    }

    // Validate that all questions for THIS section are answered
    const sectionQuestions = await Problem.find({
      weeklyExperiment: experimentId,
      isActive: true,
      type: section,
    });

    if (sectionQuestions.length === 0) {
      return res.status(400).json({ success: false, message: 'No questions found for this section.' });
    }

    // Handle MCQ synchronously
    if (section === 'mcq') {
      const { answers } = req.body;
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ success: false, message: 'Answers payload is required for MCQ submission.' });
      }

      // Check if all active questions are answered
      const activeIds = sectionQuestions.map(q => q._id.toString());
      const answeredIds = Object.keys(answers);
      const allAnswered = activeIds.every(id => answeredIds.includes(id));
      
      if (!allAnswered) {
        const missing = sectionQuestions.filter(q => !answeredIds.includes(q._id.toString()));
        return res.status(400).json({
          success: false,
          message: `Complete all questions in this section before submitting. Missing: ${missing.map((q) => `Q${q.questionNumber}`).join(', ')}`,
        });
      }

      let sectionAutoScore = 0;
      let sectionMaxScore = 0;

      // Process each answer
      for (const q of sectionQuestions) {
        const studentAnswerIndex = answers[q._id.toString()];
        const isCorrect = studentAnswerIndex === q.mcqCorrectAnswer;
        const score = isCorrect ? q.marks : 0;
        
        // Upsert Submission
        await Submission.findOneAndUpdate(
          { student: studentId, problem: q._id, weeklyExperiment: experimentId },
          {
            lab: experiment.lab._id || experiment.lab,
            mcqAnswer: studentAnswerIndex,
            autoScore: score,
            finalScore: score,
            maxScore: q.marks,
            status: 'evaluated',
            evaluatedAt: new Date()
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        sectionAutoScore += score;
        sectionMaxScore += q.marks;
      }

      finalSubmission.mcqStatus = 'evaluated';
      // Accumulate to total
      finalSubmission.totalAutoScore = (finalSubmission.totalAutoScore || 0) + sectionAutoScore;
      finalSubmission.totalFinalScore = (finalSubmission.totalFinalScore || 0) + sectionAutoScore;
      finalSubmission.totalMaxScore = (finalSubmission.totalMaxScore || 0) + sectionMaxScore;
      await finalSubmission.save();

      return res.status(200).json({
        success: true,
        message: 'MCQ section submitted and evaluated successfully.',
        data: { finalSubmission },
      });
    }

    // Handle CAD evaluation asynchronously (Skill Enhancer / Practice)
    // Validate that all questions for THIS section are answered via file uploads
    const submissions = await Submission.find({
      weeklyExperiment: experimentId,
      student: studentId,
    }).populate('problem');

    const sectionSubmissions = submissions.filter(s => s.problem && s.problem.type === section);
    const submittedProblemIds = new Set(sectionSubmissions.map((s) => s.problem._id.toString()));
    
    const allUploaded = sectionQuestions.every((q) => submittedProblemIds.has(q._id.toString()));
    if (!allUploaded) {
      const missing = sectionQuestions.filter((q) => !submittedProblemIds.has(q._id.toString()));
      return res.status(400).json({
        success: false,
        message: `Complete all questions in this section before submitting. Missing uploads for: ${missing.map((q) => `Q${q.questionNumber}`).join(', ')}`,
      });
    }

    // Handle CAD evaluation asynchronously
    finalSubmission[statusField] = 'evaluating';
    await finalSubmission.save();

    const evaluationPromises = sectionSubmissions.map((sub) =>
      evaluateSubmission(sub._id).catch((err) =>
        console.error(`[FinalSubmit] Eval error sub ${sub._id}:`, err.message)
      )
    );

    Promise.all(evaluationPromises)
      .then(async () => {
        try {
          const updatedFinalSub = await ExperimentSubmission.findById(finalSubmission._id);
          updatedFinalSub[statusField] = 'evaluated';
          
          // We can optionally recalculate totals here if needed, but existing logic does it per submission or on the fly
          await updatedFinalSub.save();
        } catch (err) {
          console.error('[FinalSubmit] Error updating experiment submission status:', err.message);
        }
      })
      .catch((err) => console.error('[FinalSubmit] Batch error:', err.message));

    res.status(201).json({
      success: true,
      message: 'Section submitted successfully. Evaluation in progress.',
      data: { finalSubmission },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/experiments/:experimentId/progress
 */
const getExperimentProgress = async (req, res, next) => {
  try {
    const { experimentId } = req.params;
    const studentId = req.query.studentId || req.user.id;

    const questions = await Problem.find({
      weeklyExperiment: experimentId,
      isActive: true,
    });

    const submissions = await Submission.find({
      weeklyExperiment: experimentId,
      student: studentId,
    }).populate('problem', 'title questionNumber marks');

    let finalSubmission = null;
    let completedSectionsCount = 0;
    
    if (req.user.role === 'student') {
      finalSubmission = await ExperimentSubmission.findOne({
        weeklyExperiment: experimentId,
        student: studentId,
      });
      if (finalSubmission) {
        if (finalSubmission.mcqStatus === 'evaluated' || finalSubmission.mcqStatus === 'submitted') completedSectionsCount++;
        if (finalSubmission.skillEnhancerStatus === 'evaluated' || finalSubmission.skillEnhancerStatus === 'submitted' || finalSubmission.skillEnhancerStatus === 'evaluating') completedSectionsCount++;
        if (finalSubmission.practiceStatus === 'evaluated' || finalSubmission.practiceStatus === 'submitted' || finalSubmission.practiceStatus === 'evaluating') completedSectionsCount++;
      }
    }

    // There are 3 sections, so we calculate progress out of 3.
    // The requirement explicitly states "EVERY WEEKLY EXPERIMENT MUST HAVE ALL 3 SECTIONS"
    const totalSections = 3;
    const progress = totalSections > 0 ? Math.round((completedSectionsCount / totalSections) * 100) : 0;

    res.json({
      success: true,
      data: {
        questions,
        submissions,
        finalSubmission,
        progress,
        completedSectionsCount,
        totalSections
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/experiments/:id
 */
const updateExperiment = async (req, res, next) => {
  try {
    const experiment = await WeeklyExperiment.findById(req.params.id);
    if (!experiment) {
      return res.status(404).json({ success: false, message: 'Experiment not found.' });
    }
    if (experiment.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const updated = await WeeklyExperiment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, message: 'Experiment updated.', data: { experiment: updated } });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/experiments/:id
 */
const deleteExperiment = async (req, res, next) => {
  try {
    const experiment = await WeeklyExperiment.findById(req.params.id);
    if (!experiment) {
      return res.status(404).json({ success: false, message: 'Experiment not found.' });
    }
    if (experiment.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    await WeeklyExperiment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Experiment deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getExperimentsByLab,
  createExperiment,
  getExperimentById,
  updateExperiment,
  deleteExperiment,
  submitSection,
  getExperimentProgress,
};
