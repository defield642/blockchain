const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student-controller');
const studentMiddleware = require('../middleware/student-middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
let title = "Student Dashboard";
let root = "student";

router.get('/dashboard', studentMiddleware.authenticateLogin, studentController.getDashboard);

router.get('/login',studentMiddleware.redirectToDashboardIfLoggedIn, function (req,res,next) {
    res.render('login-student',  {   title, root,
        logInType: req.session.user_type || "none"
    })
});

router.get('/reset', function(req, res, next) {
    studentController.getResetPage(req, res, next);
});

router.get('/logout', studentController.logOutAndRedirect);

router.post('/login/submit', studentController.postLoginStudent);

router.post('/reset/info', studentController.postResetInfo);

router.post('/profile', studentMiddleware.authenticateLogin, studentController.postUpdateProfile);

const profileDir = path.join(__dirname, "..", "uploads", "profiles");
fs.mkdirSync(profileDir, { recursive: true });
const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, profileDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname || "");
        const base = path.basename(file.originalname || "profile", ext).replace(/[^a-zA-Z0-9_-]/g, "_");
        const unique = Date.now().toString(36) + "_" + Math.round(Math.random() * 1e9).toString(36);
        cb(null, `${base}_${unique}${ext}`);
    }
});
const profileUpload = multer({ storage: profileStorage });

router.post('/profile/picture', studentMiddleware.authenticateLogin, profileUpload.single('profileImage'), async function (req, res) {
    if (!req.file) {
        return res.redirect("/student/dashboard");
    }
    await require('../database/models/students').updateOne(
        { _id: req.session.user_id },
        {
            $set: {
                profileImageName: req.file.originalname,
                profileImagePath: req.file.path,
                profileImageMime: req.file.mimetype
            }
        }
    );
    res.redirect("/student/dashboard");
});

router.get('/profile/image', async function (req, res, next) {
    try {
        const email = (req.query.email || "").trim().toLowerCase();
        if (!email) return res.status(404).render('error');
        const student = await require('../database/models/students').findOne({ email }).lean();
        if (!student || !student.profileImagePath) {
            return res.status(404).render('error');
        }
        const absPath = path.resolve(student.profileImagePath);
        if (!absPath.startsWith(profileDir)) {
            return res.status(403).render('error');
        }
        res.sendFile(absPath, {
            headers: {
                "Content-Type": student.profileImageMime || "image/jpeg"
            }
        });
    } catch (e) {
        next(e);
    }
});


module.exports = router;
