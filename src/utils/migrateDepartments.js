require('dotenv').config();
const mongoose = require('mongoose');
const ClassSection = require('../models/ClassSection');
const Department = require('../models/Department');

const migrate = async () => {
  try {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const classes = await ClassSection.find();
    const uniqueDepts = [...new Set(classes.map(c => c.department.toUpperCase()))];
    
    console.log(`Found ${uniqueDepts.length} unique departments in ClassSection.`);
    
    for (const name of uniqueDepts) {
      const existing = await Department.findOne({ name });
      if (!existing) {
        await Department.create({ name });
        console.log(`Created Department: ${name}`);
      } else {
        console.log(`Department already exists: ${name}`);
      }
    }
    
    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
