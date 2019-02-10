let crypto = require('crypto');
let jwt = require('jsonwebtoken');
let mongoose = require('./../connection');
const secretConfig = require('./../../config/secret');
const dbConfig = require('./../../config/db');

const {
    iterations,
    keylen,
    digest,
    saltByteSize
} = dbConfig.documents.passwords;

module.exports = userSchema = new mongoose.Schema({
        email: {
            type: String,
            unique: true,
            required: true
        },
        hash: {
            type: String,
            required: true
        },
        salt: {
            type: String,
            required: true
        }
    }, {
        versionKey: dbConfig.documents.versionKey
    }
);

userSchema.methods.setHash = (user, password) => {
    user.salt = crypto.randomBytes(saltByteSize).toString('hex');
    user.hash = crypto.pbkdf2Sync(
        password,
        user.salt,
        iterations,
        keylen,
        digest
    ).toString('hex');
};

userSchema.methods.validPassword = (user, password) => {
    return user.hash === crypto.pbkdf2Sync(
        password,
        user.salt,
        iterations,
        keylen,
        digest
    ).toString('hex');
};

userSchema.methods.generateJwt = (user) => {
    return jwt.sign({
        _id: user._id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7),
    }, secretConfig.jwtSecret);
};