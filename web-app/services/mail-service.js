const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "true") === "true";
const SMTP_USER = process.env.SMTP_USER || "timothyn975@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "mkmp lxwk ehcj zrkn";
const SMTP_FROM = process.env.SMTP_FROM || "Blockchain Certificates <timothyn975@gmail.com>";

let transporter;

function getTransporter() {
    if (transporter) return transporter;
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
    return transporter;
}

async function sendResetCode(email, code) {
    const mailer = getTransporter();
    const text = `From Blockchain Certificates: use this code to reset password: ${code}`;
    return mailer.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: "Blockchain Certificates password reset code",
        text
    });
}

async function sendStudentIssueAlert(email, password) {
    const mailer = getTransporter();
    const text = `From Blockchain Certificates: your certificate has been issued. Use this password to login: ${password}`;
    return mailer.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: "Blockchain Certificates certificate issued",
        text
    });
}

async function sendRecruitMessage(studentEmail, employerEmail, message) {
    const mailer = getTransporter();
    const text = `From Blockchain Certificates: Employer ${employerEmail} sent you a message.\n\n${message}`;
    return mailer.sendMail({
        from: SMTP_FROM,
        to: studentEmail,
        subject: "Blockchain Certificates recruitment message",
        text
    });
}

module.exports = { sendResetCode, sendStudentIssueAlert, sendRecruitMessage };
