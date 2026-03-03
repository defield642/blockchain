const universities = require('../database/models/universities');
const certificates = require('../database/models/certificates');
const students = require('../database/models/students');
const fabricEnrollment  = require('../services/fabric/enrollment');
const chaincode = require('./fabric/chaincode');
const logger = require("./logger");
const encryption = require('./encryption');
const certificateService = require('./certificate-service');
const crypto = require('crypto');

/**
 * Create certificate object in database and ledger.
 * For ledger - data needs to be cryptographically signed by student and university private key.
 * @param {certificates.schema} certData
 * @returns {Promise<{}>}
 */
async function issueCertificate(certData) {
    certData.studentEmail = (certData.studentEmail || "").trim().toLowerCase();
    certData.universityEmail = (certData.universityEmail || "").trim().toLowerCase();

    let universityObj = await universities.findOne({"email": certData.universityEmail});
    let studentObj = await students.findOne({"email": certData.studentEmail});

    if (!studentObj) {
        try {
            const keys = await fabricEnrollment.registerUser(certData.studentEmail);
            const tempPassword = crypto.randomBytes(12).toString('hex');
            studentObj = await students.create({
                name: certData.studentName,
                email: certData.studentEmail,
                password: tempPassword,
                publicKey: keys.publicKey,
                isAutoProvisioned: true
            });
            logger.info(`Auto-created student profile for ${certData.studentEmail}`);
        } catch (e) {
            if (e && e.code === 11000) {
                studentObj = await students.findOne({"email": certData.studentEmail});
            } else {
                throw e;
            }
        }
    }
    if (!universityObj) throw new Error("Could not fetch university profile.");

    let certDBModel = new certificates(certData);

    let mTreeHash =  await encryption.generateMerkleRoot(certDBModel);
    let universitySignature = await encryption.createDigitalSignature(mTreeHash, certData.universityEmail);
    let studentSignature = await encryption.createDigitalSignature(mTreeHash, certData.studentEmail);

    let chaincodeResult = await chaincode.invokeChaincode("issueCertificate",
        [mTreeHash, universitySignature, studentSignature, certData.dateOfIssuing, certDBModel._id, universityObj.publicKey, studentObj.publicKey ], false, certData.universityEmail);

    logger.debug(chaincodeResult);

    let res = await certDBModel.save();
    if(!res) throw new Error("Could not create certificate in the database");

    return true; //If no errors were thrown, everything completed successfully.
}

/**
 * Fetch and return all certificates issued by a specific university
 * @param {String} universityName
 * @param {String} universtiyEmail
 * @returns {Promise<certificates[]>}
 */
async function getCertificateDataforDashboard(universityName, universtiyEmail) {
    let universityProfile = await chaincode.invokeChaincode("queryUniversityProfileByName",
        [universityName], true, universtiyEmail);

    let certLedgerDataArray = await chaincode.invokeChaincode("getAllCertificateByUniversity",
        [universityProfile.publicKey], true, universtiyEmail);

    let certUUIDArray = certLedgerDataArray.map( element => {
        return element.certUUID
    });

    if (certUUIDArray.length === 0) {
        return [];
    }

    let certDBRecords = await certificates.find({
        _id: { $in: certUUIDArray },
        universityEmail: universtiyEmail
    }).lean().exec();

    return certificateService.mergeCertificateData(certDBRecords, certLedgerDataArray);
}


module.exports = {issueCertificate,  getCertificateDataforDashboard};
