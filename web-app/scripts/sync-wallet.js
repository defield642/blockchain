'use strict';

const universities = require('../database/models/universities');
const students = require('../database/models/students');
const enrollment = require('../services/fabric/enrollment');
const logger = require('../services/logger');
require('../database/mongoose');

async function main() {
  try {
    await enrollment.enrollAdmin();

    const [universityDocs, studentDocs] = await Promise.all([
      universities.find({}, { email: 1 }).lean(),
      students.find({}, { email: 1 }).lean()
    ]);

    const emailSet = new Set();
    for (const u of universityDocs) {
      if (u && u.email) emailSet.add(u.email);
    }
    for (const s of studentDocs) {
      if (s && s.email) emailSet.add(s.email);
    }

    const emails = Array.from(emailSet);
    let success = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        await enrollment.registerUser(email);
        success += 1;
      } catch (e) {
        failed += 1;
        logger.error(`Wallet sync failed for ${email}: ${e && e.message ? e.message : e}`);
      }
    }

    logger.info(`Wallet sync complete. Total: ${emails.length}, success: ${success}, failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    logger.error(`Wallet sync script failed: ${e && e.message ? e.message : e}`);
    process.exit(1);
  }
}

main();
