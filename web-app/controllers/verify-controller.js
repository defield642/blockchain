let logger = require("../services/logger");
let encryption = require('../services/encryption');
let certificates = require('../database/models/certificates');
let students = require('../database/models/students');
let moment = require('moment');
const crypto = require('crypto');
let title = "Verification Portal";
let root = "verify";
async function postVerify(req,res,next) {
    try {
        let rawInput = (req.body.proofObject || "").trim();
        if (!rawInput) {
            throw new Error("No proof provided.");
        }

        const addressCandidate = rawInput.replace(/\s+/g, "");
        if (/^[A-Z0-9]{32}$/.test(addressCandidate)) {
            const student = await students.findOne({ profileCode: addressCandidate }).lean();
            if (!student) {
                return res.render("verify-fail", {
                    title, root,
                    logInType: req.session.user_type || "none",
                    error: "Profile address not found."
                });
            }
            return res.redirect(`/profile/${addressCandidate}`);
        }

        const decodeBase64Json = (value) => {
            const cleaned = value.replace(/^proof:/i, "");
            const decoded = Buffer.from(cleaned, "base64").toString("utf8");
            return JSON.parse(decoded);
        };

        const tryParseJson = (value) => {
            return JSON.parse(value);
        };

        const tryParseUrlProof = (value) => {
            const parsed = new URL(value);
            const proofParam = parsed.searchParams.get("proof") || parsed.searchParams.get("p");
            if (!proofParam) return null;
            const decodedParam = decodeURIComponent(proofParam);
            if (decodedParam.trim().startsWith("{")) {
                return tryParseJson(decodedParam);
            }
            return decodeBase64Json(decodedParam);
        };

        let proofObject;
        try {
            proofObject = tryParseJson(rawInput);
        } catch (e) {
            try {
                if (/^https?:\/\//i.test(rawInput)) {
                    proofObject = tryParseUrlProof(rawInput);
                } else if (/^proof:/i.test(rawInput)) {
                    proofObject = decodeBase64Json(rawInput);
                } else if (/^[A-Za-z0-9+/=]+$/.test(rawInput)) {
                    proofObject = decodeBase64Json(rawInput);
                }
            } catch (err) {
                proofObject = null;
            }
        }

        if (!proofObject) {
            throw new Error("Invalid proof format");
        }

        if (!proofObject.disclosedData || Object.keys(proofObject.disclosedData).length === 0  ) {
            throw new Error("No parameter given. Provide parameters that need to be verified");
        }
        if (!proofObject.proof) {
            throw new Error("Invalid proof format");
        }

        const normalizeProof = (item) => {
            if (Buffer.isBuffer(item)) return item;
            if (item && item.type === "Buffer" && Array.isArray(item.data)) {
                return Buffer.from(item.data);
            }
            if (typeof item === "string") {
                const hex = item.startsWith("0x") ? item.slice(2) : item;
                const isHex = /^[0-9a-fA-F]+$/.test(hex) && hex.length > 0 && (hex.length % 2 === 0);
                if (item.startsWith("0x") || isHex) {
                    return Buffer.from(hex, "hex");
                }
                return item;
            }
            if (Array.isArray(item)) {
                return item.map((innerItem) => normalizeProof(innerItem));
            }
            if (item && typeof item === "object") {
                const mapped = {};
                Object.keys(item).forEach((key) => {
                    mapped[key] = normalizeProof(item[key]);
                });
                return mapped;
            }
            return item;
        };

        const certificateDbObject = await certificates.findOne({"_id": proofObject.certUUID}).select("studentName studentEmail _id dateOfIssuing universityName universityEmail major departmentName certificateFileHash");
        if (!certificateDbObject) {
            return res.render("verify-fail", {
                title, root,
                logInType: req.session.user_type || "none",
                error: "Certificate not found. Use the certificate ID from the student dashboard."
            });
        }

        const disclosedKeys = Object.keys(proofObject.disclosedData);
        const mismatched = disclosedKeys.filter((key) => {
            if (typeof certificateDbObject[key] === "undefined") return true;
            return String(certificateDbObject[key]) !== String(proofObject.disclosedData[key]);
        });
        if (mismatched.length > 0) {
            return res.render("verify-fail", {
                title, root,
                logInType: req.session.user_type || "none",
                error: `Disclosed data mismatch: ${mismatched.join(", ")}`
            });
        }

        const normalizedProof = normalizeProof(proofObject.proof);
        let proofIsCorrect = await encryption.verifyCertificateProof(normalizedProof, proofObject.disclosedData, proofObject.certUUID );

        if (proofIsCorrect) {
            let certificateDbPublic = await certificates.findOne({"_id": proofObject.certUUID}).select("studentName studentEmail _id dateOfIssuing universityName universityEmail");
            const studentProfile = await students.findOne(
                { email: certificateDbPublic.studentEmail },
                { githubLink: 1, linkedinLink: 1, portfolioLink: 1, resumeLink: 1, skills: 1, projectLinks: 1, profileCode: 1 }
            ).lean();

            let profileCode = studentProfile && studentProfile.profileCode ? String(studentProfile.profileCode).trim() : "";
            if (!profileCode || profileCode.length !== 32) {
                profileCode = crypto.randomBytes(16).toString("hex").toUpperCase();
                await students.updateOne(
                    { email: certificateDbPublic.studentEmail },
                    { $set: { profileCode } }
                );
            }

            return res.redirect(`/profile/${profileCode}?cert=${certificateDbPublic._id.toString()}&verified=1`);

        } else {
            res.render("verify-fail", {
                title, root,
                logInType: req.session.user_type || "none",
                error: "Proof verification failed. Ensure the proof matches the disclosed data and certificate."
            })
        }

    } catch (e) {
        logger.error(e);
        res.render("verify-fail", {
            title, root,
            logInType: req.session.user_type || "none",
            error: "Invalid proof JSON or missing fields."
        })
    }
}

module.exports = {postVerify};
