const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');


const studentSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        unique: true,
        validate: {
            validator: validator.isEmail,
            message: '{VALUE} is not a valid email'
        }
    },
    registrationNumber: {
        type: String,
        trim: true,
        unique: true,
        sparse: true
    },
    name: {
        type: String,
        required: true,
        trim: true,

    },
    displayName: {
        type: String,
        trim: true
    },
    profileCode: {
        type: String,
        unique: true,
        sparse: true
    },
    profileImageName: {
        type: String,
        trim: true
    },
    profileImagePath: {
        type: String,
        trim: true
    },
    profileImageMime: {
        type: String,
        trim: true
    },
    githubLink: {
        type: String,
        trim: true
    },
    linkedinLink: {
        type: String,
        trim: true
    },
    portfolioLink: {
        type: String,
        trim: true
    },
    resumeLink: {
        type: String,
        trim: true
    },
    skills: {
        type: String,
        trim: true
    },
    projectLinks: [{
        type: String,
        trim: true
    }],
    password: {
        type: String,
        required: true,
        minlength: 2
    },

    publicKey: {  //hex value of key
        type: String,
        required: true,
        unique: true,
        minlength: 10
    },
    isAutoProvisioned: {
        type: Boolean,
        default: false
    },
    usesNationalIdPassword: {
        type: Boolean,
        default: false
    }

});

studentSchema.statics.saltAndHashPassword = async function (password) {

    return new Promise( (resolve, reject) => {
        bcrypt.hash(password, 10, function(err, hash) {
            if (err) {
                reject(err);
            }
            resolve(hash);
        });
    })

};

studentSchema.statics.validateByCredentials = function (email, password) {
    let User = this;

    const identifier = (email || "").trim();
    if (!identifier) {
        return Promise.reject();
    }

    const isEmail = validator.isEmail(identifier);
    const query = isEmail ? { email: identifier.toLowerCase() } : { registrationNumber: identifier };

    return User.findOne(query).then((user) => {
        if (!user) {
            return Promise.reject();
        }

        return new Promise((resolve, reject) => {
            // Use bcrypt.compare to compare password and user.password
            bcrypt.compare(password, user.password, (err, res) => {
                if (res) {
                    //Login was successful. Signals a successful login. Update
                    resolve(user);
                } else {
                    reject();
                }
            });
        });
    });
};


studentSchema.pre('save', async function (next) {
    let user = this;
    //isModified(password) returns true if in this database update the password was modified.
    //We only resalt the password if the password was modified. Otherwise password is already salted.

    if (user.isModified('password')) {

        try {
            let hash = await user.schema.statics.saltAndHashPassword(this.password);
            user.password = hash;
        } catch (e) {
            return next();
        }
    } else {
        return next();
    }
});


studentSchema.index({"email" : 1}, {unique: true});
studentSchema.index({"registrationNumber": 1}, {unique: true, sparse: true});
studentSchema.index({"profileCode": 1}, {unique: true, sparse: true});
let students = mongoose.model("students", studentSchema);
if (process.env.DISABLE_CREATE_INDEXES !== "1") {
    students.createIndexes();
}

module.exports = students;
