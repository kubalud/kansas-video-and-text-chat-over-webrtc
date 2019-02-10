let fs = require('fs');
let path = require('path');

const logPath = path.join(__dirname, './../log.txt');

module.exports = (predefinedMessage, color) => {
    if (color) {
        console.log(color, predefinedMessage);
    } else {
        console.log(predefinedMessage);
    }
    fs.appendFileSync(logPath, `${new Date()}: ${predefinedMessage}\n`);
}