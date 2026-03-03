let students = require('../database/models/students');
let universities = require('../database/models/universities');
let certificates = require('../database/models/certificates');
let fabricEnrollment  = require('../services/fabric/enrollment');
let chaincode = require('../services/fabric/chaincode');
let logger = require("../services/logger");
let studentService = require('../services/student-service');

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
        const email = (req.body.email || "").trim().toLowerCase();
        let studentObject = await students.validateByCredentials(email, req.body.password)

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
            error: "Invalid email or password."
        });
    }
}


async function getDashboard(req, res, next) {
    try {
        let certData = await studentService.getCertificateDataforDashboard(req.session.publicKey, req.session.email);
        res.render("dashboard-student", { title, root, certData,
            logInType: req.session.user_type || "none"});

    } catch (e) {
        logger.error(e);
        next(e);
    }
}

module.exports = {postRegisterStudent, postLoginStudent, logOutAndRedirect, getDashboard};
