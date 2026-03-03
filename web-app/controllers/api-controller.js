let logger = require("../services/logger");
let encryption = require('../services/encryption');
let certificates = require('../database/models/certificates');



async function getGenerateProof(req,res,next) {

    try {
        if (!req.session || req.session.user_type !== "student" || !req.session.email) {
            const err = new Error("Unauthorized access: student login required");
            err.status = 401;
            throw err;
        }

        if (!req.query.sharedAttributes || req.query.sharedAttributes.length === 0) {
            const err = new Error("Choose atleast one attribute to share");
            err.status = 400;
            throw err;
        }

        const sharedAttributes = Array.isArray(req.query.sharedAttributes)
            ? req.query.sharedAttributes
            : [req.query.sharedAttributes];

        let mTreeProof = await encryption.generateCertificateProof(sharedAttributes, req.query.certUUID, req.session.email);
        let disclosedData = await certificates.findOne({
            "_id" : req.query.certUUID,
            "studentEmail": req.session.email
        }).select(sharedAttributes.join(" ") + " -_id");
        if (!disclosedData) {
            const err = new Error("Certificate not found for current student");
            err.status = 404;
            throw err;
        }

        const encodeProof = (item) => {
            if (Buffer.isBuffer(item)) return "0x" + item.toString("hex");
            if (item && item.type === "Buffer" && Array.isArray(item.data)) {
                return "0x" + Buffer.from(item.data).toString("hex");
            }
            if (Array.isArray(item)) {
                return item.map((innerItem) => encodeProof(innerItem));
            }
            if (item && typeof item === "object") {
                const mapped = {};
                Object.keys(item).forEach((key) => {
                    mapped[key] = encodeProof(item[key]);
                });
                return mapped;
            }
            return item;
        };
        const proofHex = encodeProof(mTreeProof);

        res.status(200).send({
            proof: proofHex,
            disclosedData: disclosedData,
            certUUID: req.query.certUUID
        })
    } catch (e) {
        logger.error(e);
        next(e);
    }
}


async function apiErrorHandler(err, req, res, next) {

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    return res.status(err.status || 500).send(JSON.stringify(err.message, undefined, 4));
}


module.exports = {getGenerateProof, apiErrorHandler};
