const express = require('express');
const router = express.Router();
const certificatesController = require('../controllers/certificates-controller');

router.get('/', certificatesController.listCertificates);
router.get('/:id', certificatesController.viewCertificate);
router.get('/:id/download', certificatesController.downloadCertificate);
router.get('/:id/file', certificatesController.fileCertificate);

module.exports = router;
