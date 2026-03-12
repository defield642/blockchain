const certificates = require('../database/models/certificates');
const students = require('../database/models/students');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const validator = require('validator');
const mailService = require('../services/mail-service');
const archiver = require('archiver');

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

function canPreview(req, cert) {
    return true;
}

function canAccessTranscripts(req, cert) {
    return true;
}

function resolveCertificatePath(cert) {
    const absPath = path.resolve(cert.certificateFilePath);
    if (!absPath.startsWith(uploadsRoot)) {
        throw new Error("Invalid certificate file path.");
    }
    return absPath;
}

function resolveAttachmentPath(filePath) {
    const absPath = path.resolve(filePath);
    if (!absPath.startsWith(uploadsRoot)) {
        throw new Error("Invalid attachment file path.");
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
        const studentEmails = Array.from(new Set(certs.map(cert => cert.studentEmail).filter(Boolean)));
        const studentProfiles = await students.find(
            { email: { $in: studentEmails } },
            { email: 1, displayName: 1, githubLink: 1, linkedinLink: 1, portfolioLink: 1, resumeLink: 1, skills: 1, projectLinks: 1, profileImagePath: 1, profileCode: 1 }
        ).lean();
        const profileByEmail = new Map(studentProfiles.map(profile => [profile.email, profile]));

        const viewData = certs.map((cert) => ({
            _id: cert._id.toString(),
            studentName: cert.studentName,
            studentEmail: cert.studentEmail,
            universityName: cert.universityName,
            major: cert.major,
            departmentName: cert.departmentName,
            dateOfIssuing: moment(cert.dateOfIssuing).format('YYYY-MM-DD'),
            certificateFileName: cert.certificateFileName,
            profile: profileByEmail.get(cert.studentEmail) || null
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
            recruitStatus: req.query.recruit || "",
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
        const transcriptList = (cert.transcripts || []).filter((item) => item && item.filePath);
        const requestedTranscriptYearRaw = (req.query.transcriptYear || "").toString().trim();
        const requestedTranscriptYear = Number(requestedTranscriptYearRaw);
        const activeTranscript = transcriptList.find((item) => String(item.year) === requestedTranscriptYearRaw)
            || transcriptList.find((item) => item.year === requestedTranscriptYear)
            || transcriptList[0]
            || null;
        const activeTranscriptUrl = activeTranscript
            ? `${req.protocol}://${req.get("host")}/certificates/${cert._id.toString()}/transcripts/${activeTranscript.year}/file`
            : null;
        const activeTranscriptMime = (activeTranscript && activeTranscript.fileMime) ? String(activeTranscript.fileMime).toLowerCase() : "";
        const activeTranscriptIsOffice = !!activeTranscriptMime.match(/officedocument|msword|ms-excel|ms-powerpoint/);
        const activeTranscriptIsPdf = activeTranscriptMime === "application/pdf";

        res.render("certificate-view", {
            title: "Certificate Viewer",
            root: "public",
            logInType: req.session.user_type || "none",
            canDownload: canDownload(req, cert),
            canAccessTranscripts: canAccessTranscripts(req, cert),
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
                certificateFileSize: cert.certificateFileSize || 0,
                transcripts: transcriptList
            },
            fileExists,
            isPdf,
            isImage,
            isText,
            isAudio,
            isVideo,
            isOffice,
            fileUrl,
            activeTranscript,
            activeTranscriptUrl,
            activeTranscriptIsOffice,
            activeTranscriptIsPdf
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
        if (!canDownload(req, cert)) {
            return res.status(403).render("error");
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

async function downloadTranscript(req, res, next) {
    try {
        const cert = await certificates.findById(req.params.id).lean();
        if (!cert) {
            return res.status(404).render('error');
        }
        if (!canDownload(req, cert)) {
            return res.status(403).render("error");
        }
        const year = Number(req.params.year);
        const transcript = (cert.transcripts || []).find(item => item.year === year);
        if (!transcript) {
            return res.status(404).render('error');
        }
        const filePath = resolveAttachmentPath(transcript.filePath);
        if (!fs.existsSync(filePath)) {
            return res.status(404).render('error');
        }
        res.download(filePath, transcript.fileName);
    } catch (e) {
        next(e);
    }
}

async function viewTranscriptInline(req, res, next) {
    try {
        const cert = await certificates.findById(req.params.id).lean();
        if (!cert) {
            return res.status(404).render('error');
        }
        if (!canAccessTranscripts(req, cert)) {
            return res.status(403).render("error");
        }
        const year = Number(req.params.year);
        const transcript = (cert.transcripts || []).find(item => item.year === year);
        if (!transcript) {
            return res.status(404).render('error');
        }
        const filePath = resolveAttachmentPath(transcript.filePath);
        if (!fs.existsSync(filePath)) {
            return res.status(404).render('error');
        }
        res.sendFile(filePath, {
            headers: {
                "Content-Type": transcript.fileMime || "application/octet-stream",
                "Content-Disposition": `inline; filename="${transcript.fileName || "document"}"`
            }
        });
    } catch (e) {
        next(e);
    }
}

async function downloadAdditionalInfo(req, res, next) {
    try {
        const cert = await certificates.findById(req.params.id).lean();
        if (!cert) {
            return res.status(404).render('error');
        }
        if (!canDownload(req, cert)) {
            return res.status(403).render("error");
        }
        const index = Number(req.params.index);
        const files = cert.additionalInfoFiles || [];
        if (Number.isNaN(index) || index < 0 || index >= files.length) {
            return res.status(404).render('error');
        }
        const file = files[index];
        const filePath = resolveAttachmentPath(file.filePath);
        if (!fs.existsSync(filePath)) {
            return res.status(404).render('error');
        }
        res.download(filePath, file.fileName);
    } catch (e) {
        next(e);
    }
}

async function recruitStudent(req, res, next) {
    try {
        const employerEmail = (req.body.employerEmail || "").trim().toLowerCase();
        const employerMessage = (req.body.employerMessage || "").trim();
        if (!employerEmail) {
            return res.redirect("/certificates?recruit=invalid");
        }
        if (!employerMessage) {
            return res.redirect("/certificates?recruit=message");
        }

        const cert = await certificates.findById(req.params.id).lean();
        if (!cert) {
            return res.redirect("/certificates?recruit=missing");
        }

        await mailService.sendRecruitMessage(cert.studentEmail, employerEmail, employerMessage);
        return res.redirect("/certificates?recruit=sent");
    } catch (e) {
        next(e);
    }
}

async function downloadAllTranscripts(req, res, next) {
    try {
        const cert = await certificates.findById(req.params.id).lean();
        if (!cert) {
            return res.status(404).render('error');
        }
        if (!canDownload(req, cert)) {
            return res.status(403).render("error");
        }

        const transcripts = cert.transcripts || [];
        if (transcripts.length === 0) {
            return res.status(404).render('error');
        }

        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="transcripts_${cert._id}.zip"`);

        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.on("error", (err) => {
            throw err;
        });
        archive.pipe(res);

        transcripts.forEach((item) => {
            const filePath = resolveAttachmentPath(item.filePath);
            if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: item.fileName });
            }
        });

        archive.finalize();
    } catch (e) {
        next(e);
    }
}

module.exports = {
    listCertificates,
    viewCertificate,
    downloadCertificate,
    fileCertificate,
    downloadTranscript,
    viewTranscriptInline,
    downloadAdditionalInfo,
    downloadAllTranscripts,
    recruitStudent
};
