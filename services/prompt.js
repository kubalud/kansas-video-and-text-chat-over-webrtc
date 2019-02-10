let fs = require('fs');
let path = require('path');
let prompt = require('prompt');
let errorHandler = require('./error-handler');
const consoleConfig = require('./../config/console');

const secretConfigFilePath = path.join(__dirname, '../config/secret.json');

const getPromptConfigValidity = () => {
    return fs.existsSync(secretConfigFilePath)
        && JSON.parse(fs.readFileSync(secretConfigFilePath)).jwtSecret;
};

module.exports = () => {
    return new Promise((resolve, reject) => {
        if (!getPromptConfigValidity()) {
            prompt.start();
            prompt.get(consoleConfig.prompt, (err, userInput) => {
                if (err) {
                    errorHandler(
                        consoleConfig.messages.errors,
                        err,
                    );
                    reject();
                } else {
                    fs.writeFileSync(
                        secretConfigFilePath,
                        JSON.stringify({ jwtSecret: userInput.jwtSecret })
                    );
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
};