
const certificates = require('../database/models/certificates');
const students = require('../database/models/students');
const chaincode = require('./fabric/chaincode');
const logger = require("./logger");
const encryption = require('./encryption');
const certificateService = require('./certificate-service');




async function getCertificateDataforDashboard(studentPublicKey, studentEmail) {
    let certLedgerDataArray = await chaincode.invokeChaincode("getAllCertificateByStudent",
        [studentPublicKey], true, studentEmail);

    let certUUIDArray = certLedgerDataArray.map( element => {
        return element.certUUID
    });

    if (certUUIDArray.length === 0) {
        return [];
    }

    let certDBRecords = await certificates.find({
        _id: { $in: certUUIDArray },
        studentEmail
    }).lean().exec();

    return certificateService.mergeCertificateData(certDBRecords, certLedgerDataArray);
}


module.exports = {getCertificateDataforDashboard}
