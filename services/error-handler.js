let fs = require('fs');
let path = require('path');
const consoleConfig = require('./../config/console');

const { error: errorColor } = consoleConfig.colors;
const logPath = path.join(__dirname, './../log.txt');

module.exports = (predefinedMessage, internalError, next) => {
    console.log(errorColor, `${predefinedMessage}:`);
    console.log(errorColor, internalError);
    fs.appendFileSync(logPath, `${new Date()}: ${predefinedMessage}\n`);
}