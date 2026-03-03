let universities = require('../database/models/universities');
let students = require('../database/models/students');
let fabricEnrollment  = require('../services/fabric/enrollment');
let chaincode = require('../services/fabric/chaincode');
let logger = require("../services/logger");
let universityService = require("../services/university-service");
const crypto = require('crypto');
const fs = require('fs');


let title = "University";
let root = "university";


async function postRegisterUniversity(req, res, next) {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        const name = (req.body.name || "").trim();

        const existingUniversity = await universities.exists({
            $or: [{ email }, { name }]
        });
        if (existingUniversity) {
            return res.status(409).render("register-university", {
                title, root,
                logInType: req.session.user_type || "none",
                error: "University already exists. Try logging in."
            });
        }

        const studentEmailCollision = await students.exists({ email });
        if (studentEmailCollision) {
            return res.status(409).render("register-university", {
                title, root,
                logInType: req.session.user_type || "none",
                error: "This email is already registered as a student."
            });
        }

        let keys = await fabricEnrollment.registerUser(email);
        let location = "";

        let dbResponse = await universities.create({
            name,
            email,
            description: req.body.description,
            location: location,
            password: req.body.password,
            publicKey: keys.publicKey
        });

        let result = await chaincode.invokeChaincode("registerUniversity",
            [ name, keys.publicKey, location, req.body.description], false, email);
        logger.debug(`University Registered. Ledger profile: ${result}`);

        res.render("register-success", { title, root,
            logInType: req.session.user_type || "none"});
    }
    catch (e) {
        logger.error(e);
        if (e && e.code === 11000) {
            return res.status(409).render("register-university", {
                title, root,
                logInType: req.session.user_type || "none",
                error: "University already exists. Try logging in."
            });
        }
        return res.status(500).render("register-university", {
            title, root,
            logInType: req.session.user_type || "none",
            error: "Registration failed. Please try again."
        });
    }
}

async function postLoginUniversity (req,res,next) {
    try {
        let universityObject = await universities.validateByCredentials(req.body.email, req.body.password)
        req.session.user_id = universityObject._id;
        req.session.user_type = "university";
        req.session.email = universityObject.email;
        req.session.name = universityObject.name;

        return res.redirect("/university/issue")
    } catch (e) {
        logger.error(e);
        return res.status(401).render("login-university", {
            title,
            root,
            logInType: req.session.user_type || "none",
            error: "Invalid email or password."
        });
    }
}

async function logOutAndRedirect (req, res, next) {
    req.session.destroy(function () {
        res.redirect('/');
    });
}

async function postIssueCertificate(req,res,next) {
    try {
        if (!req.file) {
            throw new Error("Certificate document is required.");
        }

        const fileBuffer = fs.readFileSync(req.file.path);
        const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

        let certData = {
            studentEmail: req.body.studentEmail,
            studentName: req.body.studentName,
            universityName: req.session.name,
            universityEmail: req.session.email,
            major: req.body.major,
            departmentName:  req.body.department,
            dateOfIssuing: req.body.date,
            certificateFileName: req.file.originalname,
            certificateFilePath: req.file.path,
            certificateFileMime: req.file.mimetype,
            certificateFileSize: req.file.size,
            certificateFileHash: fileHash,
        };

        let serviceResponse = await universityService.issueCertificate(certData);

        if(serviceResponse) {
            res.render("issue-success", { title, root,
                logInType: req.session.user_type || "none"});
        }

    } catch (e) {
        logger.error(e);
        next(e);
    }
}

async function getDashboard(req, res, next) {
    try {
        let certData = await universityService.getCertificateDataforDashboard(req.session.name, req.session.email);
        res.render("dashboard-university", { title, root, certData,
            logInType: req.session.user_type || "none"});

    } catch (e) {
        logger.error(e);
        next(e);
    }
}
module.exports = {postRegisterUniversity, postLoginUniversity, logOutAndRedirect, postIssueCertificate, getDashboard};
