const express = require('express');
const router = express.Router();
const students = require('../database/models/students');
const certificates = require('../database/models/certificates');

let title = "Blockchain Certificate";
let root = "index";

/* GET home page. */
router.get('/', function(req, res, next) { res.render('index', {   title, root,
    logInType: req.session.user_type || "none"
});});

router.get('/profile/:code', async function(req, res, next) {
    try {
        const code = (req.params.code || "").trim();
        const profile = await students.findOne({ profileCode: code }).lean();
        if (!profile) {
            return res.status(404).render('error');
        }

        const certsRaw = await certificates
            .find({ studentEmail: profile.email })
            .sort({ dateOfIssuing: -1 })
            .lean();

        const certs = certsRaw.map((cert) => ({
            _id: cert._id.toString(),
            universityName: cert.universityName,
            universityEmail: cert.universityEmail,
            departmentName: cert.departmentName,
            major: cert.major,
            dateOfIssuing: cert.dateOfIssuing,
            certificateFileName: cert.certificateFileName,
            transcripts: cert.transcripts || []
        }));

        const selectedCertId = (req.query.cert || "").toString().trim();
        const selectedCert = certs.find((item) => item._id === selectedCertId) || certs[0] || null;

        const selectedYearRaw = (req.query.year || "").toString().trim();
        const selectedYearNum = Number(selectedYearRaw);
        const selectedTranscript = selectedCert
            ? ((selectedCert.transcripts || []).find((item) => String(item.year) === selectedYearRaw)
                || (selectedCert.transcripts || []).find((item) => item.year === selectedYearNum)
                || (selectedCert.transcripts || [])[0]
                || null)
            : null;

        const selectedTranscriptIsOffice = !!(selectedTranscript && String(selectedTranscript.fileMime || "").toLowerCase().match(/officedocument|msword|ms-excel|ms-powerpoint/));
        const selectedTranscriptIsPdf = !!(selectedTranscript && String(selectedTranscript.fileMime || "").toLowerCase() === "application/pdf");
        const selectedTranscriptAbsoluteUrl = (selectedCert && selectedTranscript)
            ? `${req.protocol}://${req.get("host")}/certificates/${selectedCert._id}/transcripts/${selectedTranscript.year}/file`
            : null;

        res.render('profile-public', {
            title: 'Student Profile',
            root: "public",
            logInType: req.session.user_type || "none",
            profile,
            certs,
            selectedCert,
            selectedTranscript,
            selectedTranscriptIsOffice,
            selectedTranscriptIsPdf,
            selectedTranscriptAbsoluteUrl,
            verified: req.query.verified === "1"
        });
    } catch (e) {
        next(e);
    }
});




module.exports = router;
