let students = require('../database/models/students');
let universities = require('../database/models/universities');
let certificates = require('../database/models/certificates');
let fabricEnrollment  = require('../services/fabric/enrollment');
let chaincode = require('../services/fabric/chaincode');
let logger = require("../services/logger");
let studentService = require('../services/student-service');
let validator = require('validator');

let title = "Student Dashboard";
let root = "student";


async function postRegisterStudent(req, res, next) {
    try {
        const email = (req.body.email || "").trim().toLowerCase();

        const existing = await students.findOne({ email });
        if (existing) {
            const isLegacyAutoProvisioned = typeof existing.isAutoProvisioned === "undefined";
            const hasIssuedCertificates = await certificates.exists({ studentEmail: email });
            if (existing.isAutoProvisioned || isLegacyAutoProvisioned || hasIssuedCertificates) {
                existing.name = req.body.name;
                existing.password = req.body.password;
                existing.isAutoProvisioned = false;
                await existing.save();
                return res.render("register-success", {
                    title, root,
                    logInType: req.session.user_type || "none"
                });
            }
            return res.status(409).render("register-student", {
                title, root,
                logInType: req.session.user_type || "none",
                error: "Student already exists. Please log in."
            });
        }

        const universityEmailCollision = await universities.exists({ email });
        if (universityEmailCollision) {
            return res.status(409).render("register-student", {
                title, root,
                logInType: req.session.user_type || "none",
                error: "This email is already registered as a university."
            });
        }

        let keys = await fabricEnrollment.registerUser(email);

        await students.create({
            name : req.body.name,
            email,
            password: req.body.password,
            publicKey: keys.publicKey
        });


        res.render("register-success", { title, root,
            logInType: req.session.user_type || "none"});
    }
    catch (e) {
        logger.error(e);
        if (e && e.code === 11000) {
            return res.status(409).render("register-student", {
                title, root,
                logInType: req.session.user_type || "none",
                error: "Student already exists. Please log in."
            });
        }
        return res.status(500).render("register-student", {
            title, root,
            logInType: req.session.user_type || "none",
            error: "Registration failed. Please try again."
        });
    }
}

async function logOutAndRedirect (req, res, next) {
    req.session.destroy(function () {
        res.redirect('/');
    });
};


async function postLoginStudent (req,res,next) {
    try {
        const identifier = (req.body.identifier || req.body.email || "").trim();
        let studentObject = await students.validateByCredentials(identifier, req.body.password)

        req.session.user_id = studentObject._id;
        req.session.user_type = "student";
        req.session.email = studentObject.email;
        req.session.name = studentObject.name;
        req.session.publicKey = studentObject.publicKey;

        return res.redirect("/student/dashboard")
    } catch (e) {
        logger.error(e);
        return res.status(401).render("login-student", {
            title,
            root,
            logInType: req.session.user_type || "none",
            error: "Invalid student email/registration number or national ID number."
        });
    }
}


async function getDashboard(req, res, next) {
    try {
        let certData = await studentService.getCertificateDataforDashboard(req.session.publicKey, req.session.email);
        let studentProfile = await students.findById(req.session.user_id).lean();
        if (!studentProfile.profileCode || studentProfile.profileCode.length !== 32) {
            const code = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join("").toUpperCase();
            await students.updateOne({ _id: req.session.user_id }, { $set: { profileCode: code } });
            studentProfile = await students.findById(req.session.user_id).lean();
        }
        if (!studentProfile.displayName) {
            await students.updateOne({ _id: req.session.user_id }, { $set: { displayName: studentProfile.name } });
            studentProfile = await students.findById(req.session.user_id).lean();
        }
        res.render("dashboard-student", { title, root, certData,
            studentProfile,
            logInType: req.session.user_type || "none"});

    } catch (e) {
        logger.error(e);
        next(e);
    }
}

async function postUpdateProfile(req, res, next) {
    try {
        const projectLinks = (req.body.projectLinks || "")
            .split(/\r?\n/)
            .map(link => link.trim())
            .filter(Boolean);

        await students.updateOne(
            { _id: req.session.user_id },
            {
                $set: {
                    displayName: (req.body.displayName || "").trim(),
                    githubLink: (req.body.githubLink || "").trim(),
                    linkedinLink: (req.body.linkedinLink || "").trim(),
                    portfolioLink: (req.body.portfolioLink || "").trim(),
                    resumeLink: (req.body.resumeLink || "").trim(),
                    skills: (req.body.skills || "").trim(),
                    projectLinks
                }
            }
        );

        return res.redirect("/student/dashboard");
    } catch (e) {
        logger.error(e);
        return res.status(500).redirect("/student/dashboard");
    }
}

function getResetPage(req, res, next) {
    res.render("reset-student", {
        title,
        root,
        logInType: req.session.user_type || "none"
    });
}

async function postResetInfo(req, res, next) {
    try {
        const identifier = (req.body.identifier || "").trim();
        if (!identifier) {
            return res.status(400).render("reset-student", {
                title,
                root,
                logInType: req.session.user_type || "none",
                error: "Enter your student email or registration number."
            });
        }

        const isEmail = validator.isEmail(identifier);
        const query = isEmail ? { email: identifier.toLowerCase() } : { registrationNumber: identifier };
        const student = await students.findOne(query);

        if (!student || !student.usesNationalIdPassword) {
            return res.render("reset-student", {
                title,
                root,
                logInType: req.session.user_type || "none",
                info: "Contact your university for login assistance."
            });
        }

        return res.render("reset-student", {
            title,
            root,
            logInType: req.session.user_type || "none",
            info: "Use your National Id Number as your password."
        });
    } catch (e) {
        logger.error(e);
        return res.status(500).render("reset-student", {
            title,
            root,
            logInType: req.session.user_type || "none",
            error: "Unable to process your request. Please try again."
        });
    }
}

module.exports = {
    postRegisterStudent,
    postLoginStudent,
    logOutAndRedirect,
    getDashboard,
    getResetPage,
    postResetInfo,
    postUpdateProfile
};
