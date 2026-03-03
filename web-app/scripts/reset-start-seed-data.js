#!/usr/bin/env node
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const universities = require('../database/models/universities');
const students = require('../database/models/students');
const certificates = require('../database/models/certificates');

const UNIVERSITY_EMAIL = (process.env.SEED_UNIV_EMAIL || 'info@nairobi.ac.ke').trim().toLowerCase();
const UNIVERSITY_NAME = (process.env.SEED_UNIV_NAME || 'Nairobi University').trim();
const STUDENT_EMAIL = (process.env.SEED_STUDENT_EMAIL || 'timomark@gmail.com').trim().toLowerCase();

const MONGO_URI = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('MONGODB_URI_LOCAL/MONGODB_URI is not set.');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const certRes = await certificates.deleteMany({
    $or: [
      { studentEmail: STUDENT_EMAIL },
      { universityEmail: UNIVERSITY_EMAIL },
      { universityName: UNIVERSITY_NAME }
    ]
  });

  const studentRes = await students.deleteMany({ email: STUDENT_EMAIL });

  const univRes = await universities.deleteMany({
    $or: [
      { email: UNIVERSITY_EMAIL },
      { name: UNIVERSITY_NAME }
    ]
  });

  console.log(JSON.stringify({
    certificatesDeleted: certRes.deletedCount || 0,
    studentsDeleted: studentRes.deletedCount || 0,
    universitiesDeleted: univRes.deletedCount || 0,
    universityEmail: UNIVERSITY_EMAIL,
    universityName: UNIVERSITY_NAME,
    studentEmail: STUDENT_EMAIL
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});

