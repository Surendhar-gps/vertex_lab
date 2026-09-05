const User = require('../models/User');
const Lab = require('../models/Lab');
const WeeklyExperiment = require('../models/WeeklyExperiment');
const Problem = require('../models/Problem');
const Submission = require('../models/Submission');
const ExperimentSubmission = require('../models/ExperimentSubmission');
const ClassSection = require('../models/ClassSection');
const Department = require('../models/Department');
const papa = require('papaparse');
const xlsx = require('xlsx');

/**
 * Deletes every lab matching labFilter, plus everything that hangs off
 * those labs (weekly experiments, problems, and both submission types).
 * Used whenever a class/section or a whole department is removed, so
 * labs never get left behind as orphaned data.
 */
const cascadeDeleteLabsByFilter = async (labFilter) => {
  const labs = await Lab.find(labFilter).select('_id');
  const labIds = labs.map((l) => l._id);

  if (labIds.length === 0) {
    return { labsDeleted: 0 };
  }

  await WeeklyExperiment.deleteMany({ lab: { $in: labIds } });
  await Problem.deleteMany({ lab: { $in: labIds } });
  await Submission.deleteMany({ lab: { $in: labIds } });
  await ExperimentSubmission.deleteMany({ lab: { $in: labIds } });
  await Lab.deleteMany({ _id: { $in: labIds } });

  return { labsDeleted: labIds.length };
};

/**
 * GET /api/admin/stats
 */
const getAdminStats = async (req, res, next) => {
  try {
    const [totalStudents, totalFaculty, totalClasses, totalSubmissions] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'faculty' }),
      ClassSection.countDocuments(),
      Submission.countDocuments(),
    ]);

    res.json({
      success: true,
      data: { totalStudents, totalFaculty, totalClasses, totalSubmissions },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/users?role=faculty&class=CSE&section=A
 */
const getUsers = async (req, res, next) => {
  try {
    const { role, class: userClass, section, search } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (userClass) filter.class = userClass.toUpperCase();
    if (section) filter.section = section.toUpperCase();
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { users, total: users.length } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users
 * Admin creates a new faculty user
 */
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and role are required.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered.',
      });
    }

    const user = await User.create({ name, email, password, role });
    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/students
 * Admin manually creates a fully-profiled student record
 */
const createStudentManual = async (req, res, next) => {
  try {
    const {
      name, email, password, registrationNumber,
      mobileNumber, class: studentClass, section, academicYear,
    } = req.body;

    const derivedName = name || email.split('@')[0];

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    if (registrationNumber) {
      const regConflict = await User.findOne({
        registrationNumber: registrationNumber.toUpperCase(),
      });
      if (regConflict) {
        return res.status(400).json({
          success: false,
          message: 'Registration number is already in use.',
        });
      }
    }

    const user = await User.create({
      name: derivedName,
      email,
      password,
      role: 'student',
      registrationNumber: registrationNumber ? registrationNumber.toUpperCase() : undefined,
      mobileNumber,
      class: studentClass ? studentClass.toUpperCase() : undefined,
      section: section ? section.toUpperCase() : undefined,
      academicYear,
      profileCompleted: true,
    });

    res.status(201).json({
      success: true,
      message: 'Student created successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/users/:id
 * Admin updates user (can disable/re-enable)
 */
const updateUser = async (req, res, next) => {
  try {
    // Prevent password update through this route
    delete req.body.password;

    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, message: 'User updated.', data: { user } });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/users/:id
 * Admin completely deletes a user and handles associated data safely
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Safety check: Prevent deleting self
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }

    // Clean up this student's own submissions so they don't linger as
    // orphaned records tied to a deleted account.
    await Submission.deleteMany({ student: user._id });
    await ExperimentSubmission.deleteMany({ student: user._id });

    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// ─── Class/Section Management ────────────────────────────────────────────────

/**
 * GET /api/admin/classes
 */
const getClassSections = async (req, res, next) => {
  try {
    const classes = await ClassSection.find().sort({ department: 1, section: 1, academicYear: -1 });
    res.json({ success: true, data: { classes } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/classes
 */
const createClassSection = async (req, res, next) => {
  try {
    const { department, section, academicYear } = req.body;

    if (!department || !section || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Department, section, and academic year are required.',
      });
    }

    const classSection = await ClassSection.create({
      department: req.body.department.toUpperCase(),
      section: req.body.section.toUpperCase(),
      academicYear: req.body.academicYear,
      createdBy: req.user._id,
    });

    console.log(`[DEBUG] createClassSection -> saved class ${classSection._id} (${classSection.department} ${classSection.section})`);

    res.status(201).json({
      success: true,
      message: 'Class section created.',
      data: { classSection },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'This class/section/year combination already exists.',
      });
    }
    next(error);
  }
};

/**
 * DELETE /api/admin/classes/:id
 * Deletes the class section, all students belonging to it, and every
 * lab (plus that lab's experiments/problems/submissions) assigned to
 * this exact class/section/year, so nothing is left orphaned.
 */
const deleteClassSection = async (req, res, next) => {
  try {
    const classSection = await ClassSection.findById(req.params.id);
    if (!classSection) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    const matchFilter = {
      class: classSection.department,
      section: classSection.section,
      academicYear: classSection.academicYear,
    };

    // Students in this exact class/section/year
    const studentsInClass = await User.find({ role: 'student', ...matchFilter }).select('_id');
    const studentIds = studentsInClass.map((s) => s._id);

    // Their submissions, so nothing lingers tied to a deleted student
    if (studentIds.length > 0) {
      await Submission.deleteMany({ student: { $in: studentIds } });
      await ExperimentSubmission.deleteMany({ student: { $in: studentIds } });
    }

    const studentDeleteResult = await User.deleteMany({ role: 'student', ...matchFilter });

    // Labs assigned to this exact class/section/year, and everything under them
    const { labsDeleted } = await cascadeDeleteLabsByFilter(matchFilter);

    await ClassSection.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: `Class section deleted along with ${studentDeleteResult.deletedCount} student(s) and ${labsDeleted} lab(s).`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/classes/:id/students
 * Quick add student to a classroom
 */
const addStudentToClass = async (req, res, next) => {
  try {
    const { registrationNumber, email, password } = req.body;
    if (!registrationNumber || !email || !password) {
      return res.status(400).json({ success: false, message: 'Registration number, email, and password are required.' });
    }

    const classSection = await ClassSection.findById(req.params.id);
    if (!classSection) return res.status(404).json({ success: false, message: 'Class not found.' });

    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.class = classSection.department;
      user.section = classSection.section;
      user.academicYear = classSection.academicYear;
      user.registrationNumber = registrationNumber.toUpperCase();
      await user.save();
    } else {
      const prefix = email.split('@')[0];
      user = await User.create({
        name: prefix,
        email: email.toLowerCase(),
        password: password,
        role: 'student',
        registrationNumber: registrationNumber.toUpperCase(),
        class: classSection.department,
        section: classSection.section,
        academicYear: classSection.academicYear,
        profileCompleted: false,
      });
    }

    res.status(201).json({ success: true, message: 'Student added to class successfully.', data: { user } });
  } catch (error) {
    next(error);
  }
};

// Helper for parsing uploaded files
const parseFile = (file) => {
  const ext = file.originalname.split('.').pop().toLowerCase();
  let data = [];

  if (ext === 'csv') {
    const csvString = file.buffer.toString('utf8');
    const result = papa.parse(csvString, { header: true, skipEmptyLines: true });
    data = result.data;
  } else if (ext === 'xlsx' || ext === 'xls') {
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    data = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  } else {
    throw new Error('Unsupported file format. Please upload CSV or Excel.');
  }
  return data;
};

const getDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json({ success: true, data: { departments } });
  } catch (error) {
    next(error);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Department name is required' });

    const existing = await Department.findOne({ name: name.toUpperCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Department already exists' });

    const dept = await Department.create({ name: name.toUpperCase(), createdBy: req.user._id });
    res.status(201).json({ success: true, message: 'Department created', data: { department: dept } });
  } catch (error) {
    next(error);
  }
};

const parseDepts = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const data = parseFile(req.file);

    // Group by department -> classes
    const preview = [];
    const deptsMap = {}; // name -> { isNew, sections: [] }

    const existingDepts = await Department.find();
    const existingClasses = await ClassSection.find();

    for (const row of data) {
      let dName = (row['Department'] || row['department'] || '').toString().trim().toUpperCase();
      let sec = (row['Section'] || row['section'] || '').toString().trim().toUpperCase();
      let year = (row['Academic Year'] || row['academicYear'] || row['Year'] || '').toString().trim();

      if (!dName) continue;

      if (!deptsMap[dName]) {
        deptsMap[dName] = {
          name: dName,
          isNew: !existingDepts.some(d => d.name === dName),
          classes: []
        };
      }

      if (sec && year) {
        const isNewClass = !existingClasses.some(c => c.department === dName && c.section === sec && c.academicYear === year);
        // Avoid duplicate pushes in preview
        if (!deptsMap[dName].classes.some(c => c.section === sec && c.academicYear === year)) {
          deptsMap[dName].classes.push({ section: sec, academicYear: year, isNew: isNewClass });
        }
      }
    }

    res.json({ success: true, data: { preview: Object.values(deptsMap) } });
  } catch (error) {
    next(error);
  }
};

const bulkDepts = async (req, res, next) => {
  try {
    const { preview } = req.body; // array of department objects from frontend confirmation
    let deptsCreated = 0;
    let classesCreated = 0;

    for (const dept of preview) {
      if (dept.isNew) {
        try {
          await Department.create({ name: dept.name, createdBy: req.user._id });
          deptsCreated++;
        } catch (e) { } // ignore duplicates
      }
      for (const cls of dept.classes) {
        if (cls.isNew) {
          try {
            await ClassSection.create({
              department: dept.name,
              section: cls.section,
              academicYear: cls.academicYear,
              createdBy: req.user._id
            });
            classesCreated++;
          } catch (e) { } // ignore duplicates
        }
      }
    }

    res.json({ success: true, message: `Created ${deptsCreated} departments and ${classesCreated} classes.` });
  } catch (error) {
    next(error);
  }
};

const parseStudents = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { classId } = req.body;
    if (!classId) return res.status(400).json({ success: false, message: 'classId is required' });

    const data = parseFile(req.file);
    const preview = [];

    const emailsInDB = (await User.find({}, 'email')).map(u => u.email);
    const regsInDB = (await User.find({ registrationNumber: { $ne: null } }, 'registrationNumber')).map(u => u.registrationNumber);

    for (const row of data) {
      let name = (row['Name'] || row['name'] || '').toString().trim();
      let email = (row['College Email'] || row['Email'] || row['email'] || '').toString().trim().toLowerCase();
      let regNo = (row['Registration Number'] || row['Registration'] || row['regNo'] || '').toString().trim().toUpperCase();
      let mobile = (row['Mobile Number'] || row['Mobile'] || row['mobile'] || '').toString().trim();
      let pass = (row['Temporary Password'] || row['Password'] || row['password'] || '').toString().trim();

      const errors = [];
      if (!name) errors.push('Name missing');
      if (!email) errors.push('Email missing');
      else if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('Invalid email format');
      else if (emailsInDB.includes(email)) errors.push('Email already exists');

      if (!regNo) errors.push('Reg Number missing');
      else if (regsInDB.includes(regNo)) errors.push('Reg Number already exists');

      if (!pass) errors.push('Temp Password missing');

      preview.push({
        name, email, registrationNumber: regNo, mobileNumber: mobile, password: pass,
        isValid: errors.length === 0,
        errors
      });
    }

    res.json({ success: true, data: { preview } });
  } catch (error) {
    next(error);
  }
};

const bulkStudents = async (req, res, next) => {
  try {
    const { preview, classId } = req.body;
    const classSection = await ClassSection.findById(classId);
    if (!classSection) return res.status(404).json({ success: false, message: 'Class not found' });

    let createdCount = 0;

    for (const row of preview) {
      if (row.isValid) {
        try {
          await User.create({
            name: row.name,
            email: row.email,
            password: row.password,
            role: 'student',
            registrationNumber: row.registrationNumber,
            mobileNumber: row.mobileNumber,
            class: classSection.department,
            section: classSection.section,
            academicYear: classSection.academicYear,
            profileCompleted: false
          });
          createdCount++;
        } catch (e) {
          console.error("Bulk insert row error:", e);
        }
      }
    }

    res.json({ success: true, message: `Added ${createdCount} students successfully.` });
  } catch (error) {
    next(error);
  }
};


const parseCombined = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const data = parseFile(req.file);

    const previewDepartments = {};
    const previewClasses = [];
    const previewStudents = [];

    const existingDepts = await Department.find();
    const existingClasses = await ClassSection.find();
    const emailsInDB = (await User.find({}, 'email')).map(u => u.email);
    const regsInDB = (await User.find({ registrationNumber: { $ne: null } }, 'registrationNumber')).map(u => u.registrationNumber);

    for (const row of data) {
      let dName = (row['Department'] || row['department'] || '').toString().trim().toUpperCase();
      let sec = (row['Section'] || row['section'] || '').toString().trim().toUpperCase();
      let year = (row['Academic Year'] || row['academicYear'] || row['Year'] || '').toString().trim();
      let name = (row['Name'] || row['name'] || '').toString().trim();
      let email = (row['College Email'] || row['Email'] || row['email'] || '').toString().trim().toLowerCase();
      let regNo = (row['Registration Number'] || row['Registration'] || row['regNo'] || '').toString().trim().toUpperCase();
      let mobile = (row['Mobile Number'] || row['Mobile'] || row['mobile'] || '').toString().trim();
      let pass = (row['Temporary Password'] || row['Password'] || row['password'] || '').toString().trim();

      // Validation for Dept & Class
      if (dName) {
        if (!previewDepartments[dName]) {
          previewDepartments[dName] = { name: dName, isNew: !existingDepts.some(d => d.name === dName) };
        }
        if (sec && year) {
          const classKey = `${dName}-${sec}-${year}`;
          if (!previewClasses.some(c => c.key === classKey)) {
            const isNewClass = !existingClasses.some(c => c.department === dName && c.section === sec && c.academicYear === year);
            previewClasses.push({ key: classKey, department: dName, section: sec, academicYear: year, isNew: isNewClass });
          }
        }
      }

      // Validation for Student
      if (name || email || regNo) {
        const errors = [];
        if (!name) errors.push('Name missing');
        if (!email) errors.push('Email missing');
        else if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('Invalid email format');
        else if (emailsInDB.includes(email)) errors.push('Email already exists');

        if (!regNo) errors.push('Reg Number missing');
        else if (regsInDB.includes(regNo)) errors.push('Reg Number already exists');

        if (!pass) errors.push('Temp Password missing');
        if (!dName || !sec || !year) errors.push('Missing department/section/year for this student');

        previewStudents.push({
          name, email, registrationNumber: regNo, mobileNumber: mobile, password: pass,
          department: dName, section: sec, academicYear: year,
          isValid: errors.length === 0,
          errors
        });
      }
    }

    res.json({
      success: true,
      data: {
        previewDepartments: Object.values(previewDepartments),
        previewClasses,
        previewStudents
      }
    });
  } catch (error) {
    next(error);
  }
};

const bulkCombined = async (req, res, next) => {
  try {
    const { previewDepartments, previewClasses, previewStudents } = req.body;
    let deptsCreated = 0;
    let classesCreated = 0;
    let studentsCreated = 0;

    // 1. Create Departments
    for (const dept of previewDepartments) {
      if (dept.isNew) {
        try {
          await Department.create({ name: dept.name, createdBy: req.user._id });
          deptsCreated++;
        } catch (e) { }
      }
    }

    // 2. Create Classes
    for (const cls of previewClasses) {
      if (cls.isNew) {
        try {
          await ClassSection.create({
            department: cls.department,
            section: cls.section,
            academicYear: cls.academicYear,
            createdBy: req.user._id
          });
          classesCreated++;
        } catch (e) { }
      }
    }

    // 3. Create Students
    for (const row of previewStudents) {
      if (row.isValid) {
        try {
          await User.create({
            name: row.name,
            email: row.email,
            password: row.password,
            role: 'student',
            registrationNumber: row.registrationNumber,
            mobileNumber: row.mobileNumber,
            class: row.department,
            section: row.section,
            academicYear: row.academicYear,
            profileCompleted: false
          });
          studentsCreated++;
        } catch (e) {
          console.error("Bulk insert student error:", e);
        }
      }
    }

    res.json({ success: true, message: `Created ${deptsCreated} departments, ${classesCreated} classes, and ${studentsCreated} students.` });
  } catch (error) {
    next(error);
  }
};

const parseFaculty = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const data = parseFile(req.file);
    const preview = [];

    const emailsInDB = (await User.find({}, 'email')).map(u => u.email);

    for (const row of data) {
      let name = (row['Name'] || row['name'] || '').toString().trim();
      let email = (row['College Email'] || row['Email'] || row['email'] || '').toString().trim().toLowerCase();
      let pass = (row['Temporary Password'] || row['Password'] || row['password'] || '').toString().trim();
      let dept = (row['Department'] || row['department'] || '').toString().trim().toUpperCase();

      const errors = [];
      if (!name) errors.push('Name missing');
      if (!email) errors.push('Email missing');
      else if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('Invalid email format');
      else if (emailsInDB.includes(email)) errors.push('Email already exists');
      if (!pass) errors.push('Temp Password missing');

      preview.push({
        name, email, password: pass, class: dept,
        isValid: errors.length === 0,
        errors
      });
    }

    res.json({ success: true, data: { preview } });
  } catch (error) {
    next(error);
  }
};

const bulkFaculty = async (req, res, next) => {
  try {
    const { preview } = req.body;
    let createdCount = 0;

    for (const row of preview) {
      if (row.isValid) {
        try {
          await User.create({
            name: row.name,
            email: row.email,
            password: row.password,
            role: 'faculty',
            class: row.class || null,
            profileCompleted: false
          });
          createdCount++;
        } catch (e) {
          console.error("Bulk insert faculty error:", e);
        }
      }
    }

    res.json({ success: true, message: `Added ${createdCount} faculty successfully.` });
  } catch (error) {
    next(error);
  }
};


/**
 * DELETE /api/admin/departments/:id
 * Deletes the department, every class/section under it, every student
 * in those classes, and every lab (plus its experiments/problems/
 * submissions) assigned to any class under this department.
 */
const deleteDepartment = async (req, res, next) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });

    const deptFilter = { class: dept.name };

    // Students under this department, and their submissions
    const studentsInDept = await User.find({ role: 'student', ...deptFilter }).select('_id');
    const studentIds = studentsInDept.map((s) => s._id);
    if (studentIds.length > 0) {
      await Submission.deleteMany({ student: { $in: studentIds } });
      await ExperimentSubmission.deleteMany({ student: { $in: studentIds } });
    }
    const studentDeleteResult = await User.deleteMany({ role: 'student', ...deptFilter });

    // Labs assigned anywhere under this department, and everything under them
    const { labsDeleted } = await cascadeDeleteLabsByFilter(deptFilter);

    // Cascade delete classes
    await ClassSection.deleteMany({ department: dept.name });

    await Department.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: `Department, its classes, ${studentDeleteResult.deletedCount} student(s), and ${labsDeleted} lab(s) deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  deleteDepartment,
  parseStudents,
  bulkStudents,
  parseCombined,
  bulkCombined,
  parseFaculty,
  bulkFaculty,
  getDepartments,
  createDepartment,
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
};