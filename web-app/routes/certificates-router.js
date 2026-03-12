const express = require('express');
const router = express.Router();
const certificatesController = require('../controllers/certificates-controller');

router.get('/', certificatesController.listCertificates);
router.get('/:id', certificatesController.viewCertificate);
router.get('/:id/download', certificatesController.downloadCertificate);
router.get('/:id/file', certificatesController.fileCertificate);
router.get('/:id/transcripts/:year/download', certificatesController.downloadTranscript);
router.get('/:id/transcripts/:year/file', certificatesController.viewTranscriptInline);
router.get('/:id/transcripts/download-all', certificatesController.downloadAllTranscripts);
router.get('/:id/additional/:index/download', certificatesController.downloadAdditionalInfo);
router.post('/:id/recruit', certificatesController.recruitStudent);

module.exports = router;
