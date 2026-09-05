/**
 * Development Seed Script
 * ⚠️  DEVELOPMENT ONLY — Do NOT run in production
 *
 * Creates:
 *  - 1 Admin
 *  - 1 Faculty
 *  - 3 Students (different classes/sections/reg numbers)
 *  - 1 Lab
 *  - 2 Weekly Experiments
 *  - 5 Questions per experiment
 *
 * Usage: npm run seed
 * Credentials: See bottom of this file
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Lab = require('../models/Lab');
const WeeklyExperiment = require('../models/WeeklyExperiment');
const Problem = require('../models/Problem');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Lab.deleteMany({});
    await WeeklyExperiment.deleteMany({});
    await Problem.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // ─── Create Admin ─────────────────────────────────────────────────────
    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@college.edu',
      password: 'Admin@123',
      role: 'admin',
      profileCompleted: true,
    });
    console.log('👤 Admin created:', admin.email);

    // ─── Create Faculty ───────────────────────────────────────────────────
    const faculty = await User.create({
      name: 'Prof. Ramesh Kumar',
      email: 'faculty@college.edu',
      password: 'Faculty@123',
      role: 'faculty',
      profileCompleted: true,
    });
    console.log('👤 Faculty created:', faculty.email);

    // ─── Create Students ──────────────────────────────────────────────────
    const students = await User.create([
      {
        name: 'Arun Sharma',
        email: 'student4@college.edu',
        password: 'Student@123',
        role: 'student',
        registrationNumber: 'CSE001',
        mobileNumber: '9876543210',
        class: 'CSE',
        section: 'A',
        profileCompleted: true,
      },
      {
        name: 'Priya Nair',
        email: 'student2@college.edu',
        password: 'Student@123',
        role: 'student',
        registrationNumber: 'CSE025',
        mobileNumber: '9876543211',
        class: 'CSE',
        section: 'A',
        profileCompleted: true,
      },
      {
        name: 'Kiran Patel',
        email: 'student3@college.edu',
        password: 'Student@123',
        role: 'student',
        registrationNumber: 'CSE080',
        mobileNumber: '9876543212',
        class: 'CSE',
        section: 'B',
        profileCompleted: true,
        // Section B — should NOT see Section A lab
      },
    ]);
    console.log('👤 Students created:', students.map((s) => s.email).join(', '));

    // ─── Create Lab ───────────────────────────────────────────────────────
    const lab = await Lab.create({
      title: 'Engineering Graphics Lab',
      description: 'Fundamental CAD skills using AutoCAD for engineering students',
      topic: 'CAD & Engineering Drawing',
      createdBy: faculty._id,
      class: 'CSE',
      section: 'A',
      academicYear: '2026-27',
      regNoFrom: 'CSE001',
      regNoTo: 'CSE060',
    });
    console.log('🏛️  Lab created:', lab.title);

    // ─── Create Weekly Experiments ────────────────────────────────────────
    const exp1 = await WeeklyExperiment.create({
      lab: lab._id,
      weekNumber: 1,
      title: 'Basic 2D CAD Commands',
      description: 'Introduction to AutoCAD interface and basic 2D drawing commands.',
      instructions:
        'Complete all 5 questions using AutoCAD. Save each drawing as a .dxf file and upload.',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      createdBy: faculty._id,
    });

    const exp2 = await WeeklyExperiment.create({
      lab: lab._id,
      weekNumber: 2,
      title: 'Geometric Construction',
      description: 'Constructing geometric shapes and patterns using CAD tools.',
      instructions:
        'Use precision drawing tools. All dimensions must match the given specifications.',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      createdBy: faculty._id,
    });
    console.log('📅 Weekly experiments created: Week 1, Week 2');

    // ─── Create Problems (Week 1: 5 questions) ────────────────────────────
    const week1Questions = [
      {
        questionNumber: 1,
        title: 'Draw a rectangle 100x60mm',
        description: 'Draw a rectangle with width 100mm and height 60mm.',
        instructions: 'Use the RECT command. Snap to origin at (0,0).',
        marks: 10,
        type: 'skill_builder',
      },
      {
        questionNumber: 2,
        title: 'Draw a circle of radius 40mm',
        description: 'Draw a circle centered at (50,30) with radius 40mm.',
        instructions: 'Use the CIRCLE command with center and radius option.',
        marks: 10,
        type: 'skill_builder',
      },
      {
        questionNumber: 3,
        title: 'Draw a triangle with given dimensions',
        description: 'Draw an equilateral triangle with side length 80mm.',
        instructions: 'Use LINE command with polar coordinates.',
        marks: 10,
        type: 'skill_builder',
      },
      {
        questionNumber: 4,
        title: 'Draw a hexagon inscribed in a circle',
        description: 'Draw a regular hexagon inscribed in a circle of radius 50mm.',
        instructions: 'Use the POLYGON command with inscribed option.',
        marks: 10,
        type: 'practice_at_home',
      },
      {
        questionNumber: 5,
        title: 'Fillet and chamfer practice',
        description:
          'Draw a rectangle 120x80mm with fillets of R10mm at all corners.',
        instructions: 'Use FILLET command. Set radius before applying.',
        marks: 10,
        type: 'practice_at_home',
      },
    ];

    for (const q of week1Questions) {
      await Problem.create({ ...q, weeklyExperiment: exp1._id, lab: lab._id, createdBy: faculty._id });
    }
    console.log('❓ Week 1: 5 questions created');

    // ─── Create Problems (Week 2: 5 questions) ────────────────────────────
    const week2Questions = [
      {
        questionNumber: 1,
        title: 'Divide a line into equal parts',
        description: 'Divide a 100mm line into 7 equal parts geometrically.',
        instructions: 'Use the DIVIDE command or geometric construction method.',
        marks: 10,
        type: 'skill_builder',
      },
      {
        questionNumber: 2,
        title: 'Construct a tangent to a circle',
        description: 'Draw a tangent from external point P to a circle of radius 30mm.',
        instructions: 'Use geometric construction. Show construction lines.',
        marks: 10,
        type: 'skill_builder',
      },
      {
        questionNumber: 3,
        title: 'Construct an ellipse',
        description: 'Draw an ellipse with major axis 120mm and minor axis 80mm.',
        instructions: 'Use ELLIPSE command with axis and endpoint option.',
        marks: 10,
        type: 'skill_builder',
      },
      {
        questionNumber: 4,
        title: 'Draw a parabola',
        description: 'Draw a parabola with focus at 30mm from the directrix.',
        instructions: 'Use SPLINE command through calculated points.',
        marks: 15,
        type: 'practice_at_home',
      },
      {
        questionNumber: 5,
        title: 'Cycloidal curve',
        description: 'Draw one complete cycle of a cycloid traced by a circle of diameter 50mm.',
        instructions: 'Plot 12 points and connect with SPLINE.',
        marks: 15,
        type: 'practice_at_home',
      },
    ];

    for (const q of week2Questions) {
      await Problem.create({ ...q, weeklyExperiment: exp2._id, lab: lab._id, createdBy: faculty._id });
    }
    console.log('❓ Week 2: 5 questions created');

    // ─── Summary ──────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('✅ SEED COMPLETE');
    console.log('='.repeat(60));
    console.log('\n⚠️  DEVELOPMENT CREDENTIALS (do not use in production):');
    console.log('\n  Admin:');
    console.log('    Email   : admin@college.edu');
    console.log('    Password: Admin@123');
    console.log('\n  Faculty:');
    console.log('    Email   : faculty@college.edu');
    console.log('    Password: Faculty@123');
    console.log('\n  Students (Section A — can see the lab):');
    console.log('    Email   : student1@college.edu  (CSE001)');
    console.log('    Email   : student2@college.edu  (CSE025)');
    console.log('    Password: Student@123');
    console.log('\n  Student (Section B — CANNOT see Section A lab):');
    console.log('    Email   : student3@college.edu  (CSE080)');
    console.log('    Password: Student@123');
    console.log('\n  Lab: Engineering Graphics Lab (CSE Section A, CSE001-CSE060)');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seed();
