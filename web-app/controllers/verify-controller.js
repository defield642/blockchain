let logger = require("../services/logger");
let encryption = require('../services/encryption');
let certificates = require('../database/models/certificates');
let moment = require('moment');
let title = "Verification Portal";
let root = "verify";
async function postVerify(req,res,next) {
    try {
        let proofObject = req.body.proofObject;
        proofObject = JSON.parse(proofObject);

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

            res.render("verify-success", { title, root,
                logInType: req.session.user_type || "none",
                certData : certificateDbPublic,
                proofData : proofObject.disclosedData
            })

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
