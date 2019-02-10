let path = require('path');
let passport = require('passport');
let errorHandler = require('./error-handler');
let logger = require('./logger');
const consoleConfig = require('./../config/console');
let User = require('./../db/connection').model(require('./../config/db').models.user);

module.exports.register = (data, res) => {
    let user = new User(data);
    user.setHash(user, data.password);
    user.save((err) => {
        if (err) {
            if (err.code === 11000) {
                logger(
                    consoleConfig.messages.failure.createDuplicateAttempt,
                    consoleConfig.colors.failure
                );
                res.sendFile(path.resolve('public/retry-register.html'));
                return;
            }
            errorHandler(
                consoleConfig.messages.error.unknownSaveUserError,
                err
            );
            res.send({
                type: 'error',
                message: createFailedErrorMessage,
                errorObj: err
            })
        } else {
            res.status(200);
            logger(
                consoleConfig.messages.success.userCreatedAndLoggedIn(user),
                consoleConfig.colors.success
            );
            res.redirect(`/index?jwt=${user.generateJwt(user)}&email=${user.email}`);
        }
    });
};

module.exports.login = (req, res) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            logger(
                consoleConfig.messages.error.passportError,
                consoleConfig.colors.error
            );
            res.status(404).json(err);
            return;
        }
        if (user) {
            logger(
                consoleConfig.messages.success.userLoggedIn(user),
                consoleConfig.colors.success
            );
            res.status(200);
            res.redirect(`/index?jwt=${user.generateJwt(user)}&email=${user.email}`);
        } else {
            logger(
                consoleConfig.messages.failure.noSuchUser,
                consoleConfig.colors.failure
            );
            res.sendFile(path.resolve('public/retry-login.html'));
        }
    })(req, res);
};