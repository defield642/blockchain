const moment = require('moment');


/**
 * Merge certificate data from Database and Blockchain Ledger
 * Runtime is O(N) using a map keyed by certificate UUID.
 * @param {certificates[]} dbRecordArray
 * @param ledgerRecordArray
 * @returns {certificates[]}
 */
function mergeCertificateData(dbRecordArray, ledgerRecordArray) {
    const certMergedDataArray = [];
    const ledgerByUuid = new Map();

    for (let i = 0; i < ledgerRecordArray.length; i++) {
        const entry = ledgerRecordArray[i];
        if (entry && entry.certUUID) {
            ledgerByUuid.set(String(entry.certUUID), entry);
        }
    }

    for (let i = 0; i < dbRecordArray.length ; i++) {
        const dbEntry = dbRecordArray[i];
        const certUUID = dbEntry._id.toString();
        const chaincodeEntry = ledgerByUuid.get(certUUID);

        certMergedDataArray.push({
            studentName : dbEntry.studentName,
            studentEmail : dbEntry.studentEmail,
            universityName : dbEntry.universityName,
            universityEmail: dbEntry.universityEmail,
            departmentName : dbEntry.departmentName,
            dateOfIssuing: moment(dbEntry.dateOfIssuing).format('YYYY-MM-DD'),
            major: dbEntry.major,
            certUUID,
            hash: chaincodeEntry ? chaincodeEntry.certHash : null,
            certificateFileName: dbEntry.certificateFileName,
            certificateFileMime: dbEntry.certificateFileMime,
            certificateFileHash: dbEntry.certificateFileHash
        });
    }

    return certMergedDataArray;
}

module.exports = {mergeCertificateData};
