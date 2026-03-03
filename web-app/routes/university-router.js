const express = require('express');
const router = express.Router();
const universityController = require('../controllers/university-controller');
const universityMiddleware = require('../middleware/university-middleware');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

let title = "University";
let root = "university";

const uploadDir = path.join(__dirname, "..", "uploads", "certificates");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname || "");
        const base = path.basename(file.originalname || "document", ext).replace(/[^a-zA-Z0-9_-]/g, "_");
        const unique = Date.now().toString(36) + "_" + Math.round(Math.random() * 1e9).toString(36);
        cb(null, `${base}_${unique}${ext}`);
    }
});

const upload = multer({ storage });

router.get('/register', function(req, res, next) {
    res.render('register-university', {   title, root,
        logInType: req.session.user_type || "none"
    });
});

router.get('/login',universityMiddleware.redirectToDashboardIfLoggedIn, function (req,res,next) {
    res.render('login-university',  {   title, root,
        logInType: req.session.user_type || "none"
    })
});

router.get('/dashboard', universityMiddleware.authenticateLogin, universityController.getDashboard);

router.get('/issue', universityMiddleware.authenticateLogin, function (req,res,next) {
    res.render('issue-university',  {   title, root,
        logInType: req.session.user_type || "none"
    })
});

router.post("/issue", upload.single("certificateFile"), universityController.postIssueCertificate);


router.post('/register/submit', universityController.postRegisterUniversity);

router.post('/login/submit', universityController.postLoginUniversity);

router.get('/logout', universityController.logOutAndRedirect);

module.exports = router;
