const mongoose = require('mongoose');
const validator = require('validator');


const certificateSchema = new mongoose.Schema({

    studentName: {
        type: String,
        required: true,
        trim: true,

    },
    studentEmail: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        validate: {
            validator: validator.isEmail,
            message: '{VALUE} is not a valid email'
        }
    },
    universityName: {
        type: String,
        required: true,
        trim: true,
    },
    universityEmail: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        validate: {
            validator: validator.isEmail,
            message: '{VALUE} is not a valid email'
        }
    },
    major: {
        type: String,
        required: true,
        trim: true
    },
    departmentName: {
        type: String,
        required: true,
        trim: true
    },
    certificateFileName: {
        type: String,
        required: true,
        trim: true
    },
    certificateFilePath: {
        type: String,
        required: true,
        trim: true
    },
    certificateFileMime: {
        type: String,
        required: false,
        trim: true
    },
    certificateFileSize: {
        type: Number,
        required: false
    },
    certificateFileHash: {
        type: String,
        required: true,
        trim: true
    },
    dateOfIssuing: {
        type: Date,
        required: true
    },
});

certificateSchema.index({"studentEmail" : 1});
certificateSchema.index({"universityEmail" : 1});
certificateSchema.index({"studentEmail" : 1, "dateOfIssuing": -1});
certificateSchema.index({"universityEmail" : 1, "dateOfIssuing": -1});
certificateSchema.index({"universityName" : 1, "dateOfIssuing": -1});
certificateSchema.index({"studentName" : 1, "dateOfIssuing": -1});

let certificates = mongoose.model("certificates", certificateSchema);
certificates.createIndexes();

module.exports = certificates;
