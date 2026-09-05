require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const checkDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({}).select('+password');
    console.log(`Total users: ${users.length}`);

    const roles = { admin: 0, faculty: 0, student: 0 };
    for (const u of users) {
      if (roles[u.role] !== undefined) roles[u.role]++;
      if (u.role === 'student') {
        const isMatch = await u.comparePassword('Student@123');
        console.log(`Student ${u.email}: password match='Student@123' -> ${isMatch}`);
      }
    }
    
    console.log(`Roles count: Admin=${roles.admin}, Faculty=${roles.faculty}, Student=${roles.student}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkDB();
