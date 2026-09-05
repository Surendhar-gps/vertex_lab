const Problem = require('../models/Problem');
const WeeklyExperiment = require('../models/WeeklyExperiment');

const pathLib = require('path');
const xlsx = require('xlsx');
const papaparse = require('papaparse');

/**
 * POST /api/problems
 * Faculty creates a question
 */
const createProblem = async (req, res, next) => {
  try {
    let {
      weeklyExperiment,
      lab,
      questionNumber,
      type,
      format,
      title,
      description,
      instructions,
      marks,
      mcqOptions,
      mcqCorrectAnswer
    } = req.body;

    if (!weeklyExperiment || !lab || !questionNumber || !title) {
      return res.status(400).json({
        success: false,
        message:
          'weeklyExperiment, lab, questionNumber, and title are required.'
      });
    }

    const experiment = await WeeklyExperiment.findById(weeklyExperiment);

    if (!experiment) {
      return res.status(404).json({
        success: false,
        message: 'Weekly experiment not found.'
      });
    }

    let answerKeyFileUrl;
    let answerKeyPublicId;

    if (req.file) {
      answerKeyFileUrl = req.file.path;
      answerKeyPublicId = req.file.filename;
    }

    if (typeof mcqOptions === 'string') {
      try {
        mcqOptions = JSON.parse(mcqOptions);
      } catch (e) {
        mcqOptions = [];
      }
    }

    const existingCount = await Problem.countDocuments({
      weeklyExperiment,
      type
    });

    const calculatedQuestionNumber = existingCount + 1;

    let finalMarks = marks;

    if (!finalMarks) {
      finalMarks = type === 'mcq' ? 1 : 10;
    }

    const problem = await Problem.create({
      weeklyExperiment,
      lab,
      questionNumber: calculatedQuestionNumber,
      type,
      format,
      title,
      description,
      instructions,
      marks: finalMarks,
      answerKeyFileUrl,
      answerKeyPublicId,
      mcqOptions: mcqOptions || [],
      mcqCorrectAnswer:
        mcqCorrectAnswer != null
          ? Number(mcqCorrectAnswer)
          : undefined,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Question created.',
      data: { problem }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/problems/:id
 */
const getProblemById = async (req, res, next) => {
  try {
    const problem = await Problem.findById(req.params.id)
      .populate('weeklyExperiment', 'title weekNumber')
      .populate('lab', 'title')
      .populate('createdBy', 'name');

    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found.'
      });
    }

    const probObj = problem.toObject();

    if (req.user && req.user.role === 'student') {
      delete probObj.mcqCorrectAnswer;
    }

    res.json({
      success: true,
      data: { problem: probObj }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/problems/:id
 */
const updateProblem = async (req, res, next) => {
  try {
    const problem = await Problem.findById(req.params.id);

    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found.'
      });
    }

    if (
      problem.createdBy.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized.'
      });
    }

    if (req.file) {
      req.body.answerKeyFileUrl = req.file.path;
      req.body.answerKeyPublicId = req.file.filename;
    }

    if (typeof req.body.mcqOptions === 'string') {
      try {
        req.body.mcqOptions = JSON.parse(req.body.mcqOptions);
      } catch (e) { }
    }

    const updated = await Problem.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.json({
      success: true,
      message: 'Problem updated.',
      data: { problem: updated }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/problems/:id
 */
const deleteProblem = async (req, res, next) => {
  try {
    const problem = await Problem.findById(req.params.id);

    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found.'
      });
    }

    if (
      problem.createdBy.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized.'
      });
    }

    await Problem.findByIdAndDelete(req.params.id);

    const remainingProblems = await Problem.find({
      weeklyExperiment: problem.weeklyExperiment,
      type: problem.type
    }).sort({ questionNumber: 1 });

    for (let i = 0; i < remainingProblems.length; i++) {
      remainingProblems[i].questionNumber = i + 1;
      await remainingProblems[i].save();
    }

    res.json({
      success: true,
      message:
        'Problem deleted and remaining questions renumbered.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * GET /api/problems/template
 *
 * Download the correct MCQ Excel template
 * ============================================================
 */
const downloadTemplate = async (req, res, next) => {
  try {
    const headers = [
      'Title',
      'Description',
      'Instructions',
      'Marks',
      'Option 1',
      'Option 2',
      'Option 3',
      'Option 4',
      'Correct Option Index'
    ];

    const sampleRow = [
      'What is AutoCAD?',
      'Basic AutoCAD question',
      'Select the correct answer.',
      1,
      'A CAD software',
      'A programming language',
      'An operating system',
      'A database',
      1
    ];

    const worksheet = xlsx.utils.aoa_to_sheet([
      headers,
      sampleRow
    ]);

    // Set useful column widths
    worksheet['!cols'] = [
      { wch: 30 },
      { wch: 35 },
      { wch: 35 },
      { wch: 10 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 24 }
    ];

    // Freeze the header row
    worksheet['!freeze'] = {
      xSplit: 0,
      ySplit: 1
    };

    const workbook = xlsx.utils.book_new();

    xlsx.utils.book_append_sheet(
      workbook,
      worksheet,
      'MCQ Questions'
    );

    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="MCQ_Bulk_Import_Template.xlsx"'
    );

    res.send(buffer);

  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * POST /api/problems/parse
 *
 * Parses CSV/Excel file containing ONLY MCQ questions.
 *
 * Expected columns:
 *
 * Title
 * Description
 * Instructions
 * Marks
 * Option 1
 * Option 2
 * Option 3
 * Option 4
 * Correct Option Index
 * ============================================================
 */
const parseQuestions = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    let data = [];

    const ext = pathLib
      .extname(req.file.originalname)
      .toLowerCase();

    if (ext === '.csv') {
      const csvStr = req.file.buffer.toString('utf8');

      const result = papaparse.parse(csvStr, {
        header: true,
        skipEmptyLines: true
      });

      data = result.data;

    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.read(req.file.buffer, {
        type: 'buffer'
      });

      const sheetName = workbook.SheetNames[0];

      data = xlsx.utils.sheet_to_json(
        workbook.Sheets[sheetName],
        {
          defval: ''
        }
      );

    } else {
      return res.status(400).json({
        success: false,
        message:
          'Invalid file format. Please upload CSV or Excel.'
      });
    }

    const preview = [];

    for (const row of data) {

      const title = (row['Title'] || '')
        .toString()
        .trim();

      const description = (row['Description'] || '')
        .toString()
        .trim();

      const instructions = (row['Instructions'] || '')
        .toString()
        .trim();

      const marks = parseInt(row['Marks']) || 1;

      const opt1 = (row['Option 1'] || '')
        .toString()
        .trim();

      const opt2 = (row['Option 2'] || '')
        .toString()
        .trim();

      const opt3 = (row['Option 3'] || '')
        .toString()
        .trim();

      const opt4 = (row['Option 4'] || '')
        .toString()
        .trim();

      const correctIdx = parseInt(
        row['Correct Option Index']
      );

      const mcqOptions = [
        { text: opt1 },
        { text: opt2 },
        { text: opt3 },
        { text: opt4 }
      ];

      // Excel uses 1,2,3,4
      // Database uses 0,1,2,3
      let mcqCorrectAnswer = isNaN(correctIdx)
        ? 0
        : correctIdx - 1;

      if (
        mcqCorrectAnswer < 0 ||
        mcqCorrectAnswer > 3
      ) {
        mcqCorrectAnswer = 0;
      }

      const errors = [];

      if (!title) {
        errors.push('Title missing');
      }

      if (!opt1 && !opt2 && !opt3 && !opt4) {
        errors.push(
          'MCQ requires options (Option 1, 2, 3, 4)'
        );
      }

      if (
        isNaN(correctIdx) ||
        correctIdx < 1 ||
        correctIdx > 4
      ) {
        errors.push(
          'Correct Option Index must be between 1 and 4'
        );
      }

      preview.push({
        title,
        description,
        instructions,
        marks,
        type: 'mcq',
        format: 'mcq',
        mcqOptions,
        mcqCorrectAnswer,
        isValid: errors.length === 0,
        errors
      });
    }

    res.json({
      success: true,
      data: { preview }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * POST /api/problems/bulk
 *
 * Creates MCQ questions only.
 * ============================================================
 */
const bulkQuestions = async (req, res, next) => {
  try {
    const {
      preview,
      weeklyExperimentId,
      labId
    } = req.body;

    let createdCount = 0;

    const experiment =
      await WeeklyExperiment.findById(
        weeklyExperimentId
      );

    if (!experiment) {
      return res.status(404).json({
        success: false,
        message: 'Experiment not found'
      });
    }

    const existingCount =
      await Problem.countDocuments({
        weeklyExperiment: weeklyExperimentId,
        type: 'mcq'
      });

    let currentQNumber = existingCount + 1;

    const addedProblemIds = [];

    for (const row of preview) {

      if (row.isValid) {

        try {

          const newProblem = await Problem.create({
            weeklyExperiment: weeklyExperimentId,
            lab: labId,
            questionNumber: currentQNumber++,
            title: row.title,
            description: row.description,
            instructions: row.instructions,
            marks: row.marks || 1,
            format: 'mcq',
            type: 'mcq',
            mcqOptions: row.mcqOptions,
            mcqCorrectAnswer:
              row.mcqCorrectAnswer,
            createdBy: req.user._id
          });

          addedProblemIds.push(
            newProblem._id
          );

          createdCount++;

        } catch (e) {
          console.error(
            'Bulk MCQ insert error:',
            e
          );
        }
      }
    }

    if (addedProblemIds.length > 0) {
      await WeeklyExperiment.findByIdAndUpdate(
        weeklyExperimentId,
        {
          $push: {
            questions: {
              $each: addedProblemIds
            }
          }
        }
      );
    }

    res.json({
      success: true,
      message:
        `Added ${createdCount} MCQ question(s) successfully.`
    });

  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * POST /api/problems/renumber
 * ============================================================
 */
const renumberQuestions = async (req, res, next) => {
  try {
    const experiments =
      await WeeklyExperiment.find();

    let totalFixed = 0;

    for (const experiment of experiments) {

      const types = await Problem.distinct(
        'type',
        {
          weeklyExperiment: experiment._id
        }
      );

      for (const type of types) {

        const problems = await Problem.find({
          weeklyExperiment: experiment._id,
          type
        }).sort({
          questionNumber: 1,
          createdAt: 1
        });

        for (
          let i = 0;
          i < problems.length;
          i++
        ) {

          const correctNumber = i + 1;

          if (
            problems[i].questionNumber !==
            correctNumber
          ) {

            problems[i].questionNumber =
              correctNumber;

            await problems[i].save();

            totalFixed++;
          }
        }
      }
    }

    res.json({
      success: true,
      message:
        `Renumbering complete. Fixed ${totalFixed} question(s).`
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  parseQuestions,
  downloadTemplate,
  bulkQuestions,
  createProblem,
  getProblemById,
  updateProblem,
  deleteProblem,
  renumberQuestions
};