const certificates = require('../database/models/certificates');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

const uploadsRoot = path.resolve(__dirname, "..", "uploads", "certificates");

function canDownload(req, cert) {
    if (!req.session || !cert) return false;
    if (req.session.user_type === "student") {
        return req.session.email === cert.studentEmail;
    }
    if (req.session.user_type === "university") {
        return req.session.email === cert.universityEmail;
    }
    return false;
}

function resolveCertificatePath(cert) {
    const absPath = path.resolve(cert.certificateFilePath);
    if (!absPath.startsWith(uploadsRoot)) {
        throw new Error("Invalid certificate file path.");
    }
    return absPath;
}

async function listCertificates(req, res, next) {
    try {
        const query = {};
        const q = (req.query.q || "").trim();
        if (q) {
            query.$or = [
                { studentName: { $regex: q, $options: "i" } },
                { universityName: { $regex: q, $options: "i" } },
                { studentEmail: { $regex: q, $options: "i" } }
            ];
        }
        if (req.query.university) {
            query.universityName = { $regex: req.query.university.trim(), $options: "i" };
        }
        if (req.query.major) {
            query.major = { $regex: req.query.major.trim(), $options: "i" };
        }
        if (req.query.department) {
            query.departmentName = { $regex: req.query.department.trim(), $options: "i" };
        }

        const sortKey = (req.query.sort || "newest").toLowerCase();
        let sortSpec = { dateOfIssuing: -1 };
        if (sortKey === "oldest") sortSpec = { dateOfIssuing: 1 };
        if (sortKey === "student") sortSpec = { studentName: 1 };
        if (sortKey === "university") sortSpec = { universityName: 1 };

        const certs = await certificates.find(query).sort(sortSpec).lean();
        const viewData = certs.map((cert) => ({
            _id: cert._id.toString(),
            studentName: cert.studentName,
            studentEmail: cert.studentEmail,
            universityName: cert.universityName,
            major: cert.major,
            departmentName: cert.departmentName,
            dateOfIssuing: moment(cert.dateOfIssuing).format('YYYY-MM-DD'),
            certificateFileName: cert.certificateFileName
        }));

        const groupBy = (items, key) => {
            const map = new Map();
            items.forEach((item) => {
                const k = item[key] || "Unknown";
                if (!map.has(k)) map.set(k, []);
                map.get(k).push(item);
            });
            return Array.from(map.entries()).map(([name, certs]) => ({ name, certs }));
        };

        const byUniversity = groupBy(viewData, "universityName");
        const byMajor = groupBy(viewData, "major");

        res.render("certificates-public", {
            title: "All Certificates",
            root: "public",
            logInType: req.session.user_type || "none",
            certs: viewData,
            filters: {
                q,
                university: req.query.university || "",
                major: req.query.major || "",
                department: req.query.department || "",
                sort: sortKey
            },
            grouped: {
                byUniversity,
                byMajor
            }
        });
    } catch (e) {
        next(e);
    }
}

async function viewCertificate(req, res, next) {
    try {
        const cert = await certificates.findById(req.params.id).lean();
        if (!cert) {
            return res.status(404).render('error');
        }

        const filePath = resolveCertificatePath(cert);
        const fileExists = fs.existsSync(filePath);
        const mime = cert.certificateFileMime || "application/octet-stream";
        const isPdf = mime === "application/pdf";
        const isImage = mime.startsWith("image/");
        const isText = mime.startsWith("text/") || mime === "application/json";
        const isAudio = mime.startsWith("audio/");
        const isVideo = mime.startsWith("video/");
        const isOffice = mime.includes("officedocument") || mime.includes("msword") || mime.includes("ms-excel") || mime.includes("ms-powerpoint");
        const fileUrl = `${req.protocol}://${req.get("host")}/certificates/${cert._id.toString()}/file`;

        res.render("certificate-view", {
            title: "Certificate Viewer",
            root: "public",
            logInType: req.session.user_type || "none",
            canDownload: canDownload(req, cert),
            cert: {
                _id: cert._id.toString(),
                studentName: cert.studentName,
                studentEmail: cert.studentEmail,
                universityName: cert.universityName,
                major: cert.major,
                departmentName: cert.departmentName,
                dateOfIssuing: moment(cert.dateOfIssuing).format('YYYY-MM-DD'),
                certificateFileName: cert.certificateFileName,
                certificateFileMime: cert.certificateFileMime || "application/octet-stream",
                certificateFileSize: cert.certificateFileSize || 0
            },
            fileExists,
            isPdf,
            isImage,
            isText,
            isAudio,
            isVideo,
            isOffice,
            fileUrl
        });
    } catch (e) {
        next(e);
    }
}

async function downloadCertificate(req, res, next) {
    try {
        const cert = await certificates.findById(req.params.id).lean();
        if (!cert) {
            return res.status(404).render('error');
        }
        if (!canDownload(req, cert)) {
            return res.status(403).render("error");
        }
        const filePath = resolveCertificatePath(cert);
        if (!fs.existsSync(filePath)) {
            return res.status(404).render('error');
        }
        res.download(filePath, cert.certificateFileName);
    } catch (e) {
        next(e);
    }
}

async function fileCertificate(req, res, next) {
    try {
        const cert = await certificates.findById(req.params.id).lean();
        if (!cert) {
            return res.status(404).render('error');
        }
        const filePath = resolveCertificatePath(cert);
        if (!fs.existsSync(filePath)) {
            return res.status(404).render('error');
        }
        res.sendFile(filePath, {
            headers: {
                "Content-Type": cert.certificateFileMime || "application/octet-stream",
                "Content-Disposition": `inline; filename="${cert.certificateFileName || "document"}"`
            }
        });
    } catch (e) {
        next(e);
    }
}

module.exports = { listCertificates, viewCertificate, downloadCertificate, fileCertificate };
