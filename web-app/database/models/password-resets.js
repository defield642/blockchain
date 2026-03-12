const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    codeHash: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
});

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const passwordResets = mongoose.model("password_resets", passwordResetSchema);

module.exports = passwordResets;
