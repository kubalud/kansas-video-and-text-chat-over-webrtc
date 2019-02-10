module.exports = mongoose = require('mongoose');

let errorHandler = require('../services/error-handler');
let logger = require('../services/logger');
const dbConfig = require('./../config/db');
const consoleConfig = require('../config/console');

const { port, name, models } = dbConfig;

mongoose.set('useCreateIndex', true);
mongoose.model(models.user, require('./schemas/user'));

mongoose.connect(
    `mongodb://localhost:${port}/${name}`,
    { useNewUrlParser: true },
    (err) => {
        if (err) {
            errorHandler(
                consoleConfig.messages.errors.dbConnectionError,
                err
            );
        } else {
            logger(
                consoleConfig.messages.info.dbConnected,
                consoleConfig.colors.info
            );
        }
    }
);