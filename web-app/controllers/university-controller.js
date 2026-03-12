let universities = require('../database/models/universities');
let students = require('../database/models/students');
let fabricEnrollment  = require('../services/fabric/enrollment');
let chaincode = require('../services/fabric/chaincode');
let logger = require("../services/logger");
let universityService = require("../services/university-service");
let passwordResets = require("../database/models/password-resets");
let mailService = require("../services/mail-service");
const crypto = require('crypto');
const fs = require('fs');
const validator = require('validator');


let title = "University";
let root = "university";


async function postRegisterUniversity(req, res, next) {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        const name = (req.body.name || "").trim();
        const password = req.body.password || "";
        const confirmPassword = req.body.confirmPassword || "";

        if (password !== confirmPassword) {
            return res.status(400).render("register-university", {
                title, root,
                logInType: req.session.user_type || "none",
                error: "Passwords do not match."
            });
        }

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
            password,
            publicKey: keys.publicKey
        });

        let result = await chaincode.invokeChaincode("registerUniversity",
            [ name, keys.publicKey, location, req.body.description], false, email);
        logger.debug(`University Registered. Ledger profile: ${result}`);

        req.session.user_id = dbResponse._id;
        req.session.user_type = "university";
        req.session.email = dbResponse.email;
        req.session.name = dbResponse.name;

        return res.redirect("/university/issue");
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
        const email = (req.body.email || "").trim().toLowerCase();
        let universityObject = await universities.validateByCredentials(email, req.body.password)
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
        const transcriptFiles = req.files || {};
        const transcripts = [
            { year: 1, file: (transcriptFiles.transcriptYear1 || [])[0] },
            { year: 2, file: (transcriptFiles.transcriptYear2 || [])[0] },
            { year: 3, file: (transcriptFiles.transcriptYear3 || [])[0] },
            { year: 4, file: (transcriptFiles.transcriptYear4 || [])[0] }
        ].filter(item => item.file);

        if (!req.body.confirmTranscripts) {
            throw new Error("Please confirm the transcript files before uploading.");
        }

        if (transcripts.length < 1) {
            throw new Error("At least one transcript file is required.");
        }

        const totalSize = transcripts.reduce((sum, item) => sum + (item.file.size || 0), 0);

        const transcriptData = transcripts.map((item) => {
            const buffer = fs.readFileSync(item.file.path);
            const hash = crypto.createHash("sha256").update(buffer).digest("hex");
            return {
                year: item.year,
                fileName: item.file.originalname,
                filePath: item.file.path,
                fileMime: item.file.mimetype,
                fileSize: item.file.size,
                fileHash: hash
            };
        });

        const combinedHash = crypto
            .createHash("sha256")
            .update(transcriptData.map(item => item.fileHash).join("|"))
            .digest("hex");

        const certificateBundleName = `Transcripts Bundle (${transcriptData.length} files)`;
        const primaryTranscript = transcripts[0].file;

        const additionalInfoFiles = (transcriptFiles.additionalInfoFiles || []).map((file) => {
            const buffer = fs.readFileSync(file.path);
            const hash = crypto.createHash("sha256").update(buffer).digest("hex");
            return {
                fileName: file.originalname,
                filePath: file.path,
                fileMime: file.mimetype,
                fileSize: file.size,
                fileHash: hash
            };
        });

        let certData = {
            studentEmail: req.body.studentEmail,
            studentName: req.body.studentName,
            studentRegistrationNumber: req.body.studentRegistrationNumber,
            studentNationalIdNumber: req.body.studentNationalIdNumber,
            universityName: req.session.name,
            universityEmail: req.session.email,
            major: req.body.major,
            departmentName:  req.body.department,
            dateOfIssuing: req.body.date,
            certificateFileName: certificateBundleName,
            certificateFilePath: primaryTranscript.path,
            certificateFileMime: "application/octet-stream",
            certificateFileSize: totalSize,
            certificateFileHash: combinedHash,
            transcripts: transcriptData,
            additionalInfoNotes: req.body.additionalInfoNotes,
            additionalInfoFiles
        };

        let serviceResponse = await universityService.issueCertificate(certData);

        if(serviceResponse) {
            return res.redirect("/university/dashboard");
        }

    } catch (e) {
        logger.error(e);
        return res.status(400).render("issue-university", {
            title,
            root,
            logInType: req.session.user_type || "none",
            error: e && e.message ? e.message : "Unable to issue certificate."
        });
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

function getResetPage(req, res, next) {
    res.render("reset-university", {
        title,
        root,
        logInType: req.session.user_type || "none",
        stage: "email"
    });
}

async function postResetRequest(req, res, next) {
    try {
        const email = (req.body.email || "").trim().toLowerCase();

        const university = await universities.findOne({ email });
        if (!university) {
            return res.status(400).render("reset-university", {
                title,
                root,
                logInType: req.session.user_type || "none",
                stage: "email",
                error: "University email not found."
            });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const codeHash = crypto.createHash("sha256").update(code).digest("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await passwordResets.deleteMany({ email });
        await passwordResets.create({ email, codeHash, expiresAt });

        await mailService.sendResetCode(email, code);

        return res.render("reset-university", {
            title,
            root,
            logInType: req.session.user_type || "none",
            stage: "code",
            info: "Code will expire in 15 minutes.",
            email
        });
    } catch (e) {
        logger.error(e);
        return res.status(500).render("reset-university", {
            title,
            root,
            logInType: req.session.user_type || "none",
            stage: "email",
            error: "Unable to send reset code. Please try again."
        });
    }
}

async function postResetConfirm(req, res, next) {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        const code = (req.body.code || "").trim();
        const password = req.body.password || "";
        const confirmPassword = req.body.confirmPassword || "";

        if (!code) {
            return res.status(400).render("reset-university", {
                title,
                root,
                logInType: req.session.user_type || "none",
                stage: "code",
                error: "Enter the reset code from your email."
            });
        }

        if (!password || password !== confirmPassword) {
            return res.status(400).render("reset-university", {
                title,
                root,
                logInType: req.session.user_type || "none",
                stage: "password",
                email,
                error: "Passwords do not match."
            });
        }

        const reset = await passwordResets.findOne({ email });
        if (!reset || reset.expiresAt < new Date()) {
            return res.status(400).render("reset-university", {
                title,
                root,
                logInType: req.session.user_type || "none",
                stage: "code",
                email,
                error: "Code expired or wrong code."
            });
        }

        const codeHash = crypto.createHash("sha256").update(code).digest("hex");
        if (codeHash !== reset.codeHash) {
            return res.status(400).render("reset-university", {
                title,
                root,
                logInType: req.session.user_type || "none",
                stage: "code",
                email,
                error: "Code expired or wrong code."
            });
        }

        const university = await universities.findOne({ email });
        if (!university) {
            return res.status(400).render("reset-university", {
                title,
                root,
                logInType: req.session.user_type || "none",
                stage: "email",
                error: "University not found for that email."
            });
        }

        if (!req.body.password || !req.body.confirmPassword) {
            return res.render("reset-university", {
                title,
                root,
                logInType: req.session.user_type || "none",
                stage: "password",
                email,
                info: "Code confirmed successfully."
            });
        }

        university.password = password;
        await university.save();
        await passwordResets.deleteMany({ email });

        return res.render("reset-university", {
            title,
            root,
            logInType: req.session.user_type || "none",
            stage: "success",
            success: "Password reset successfully."
        });
    } catch (e) {
        logger.error(e);
        return res.status(500).render("reset-university", {
            title,
            root,
            logInType: req.session.user_type || "none",
            stage: "email",
            error: "Unable to reset password. Please try again."
        });
    }
}

module.exports = {
    postRegisterUniversity,
    postLoginUniversity,
    logOutAndRedirect,
    postIssueCertificate,
    getDashboard,
    getResetPage,
    postResetRequest,
    postResetConfirm
};
