let prompt = require('./services/prompt');

(async() => {
    await prompt();

    let express = require('express');
    let bodyParser = require('body-parser');
    let jwt = require('jsonwebtoken');
    let app = module.exports = express();
    let http = require('http').Server(app);
    let io = require('socket.io')(http);
    let authentication = require('./services/authentication');
    const jwtSecret = require('./config/secret').jwtSecret;
    const consoleConfig = require('./config/console');

    const errorHandler = require('./services/error-handler');
    const logger = require('./services/logger');


    let User = require('./db/connection').model(require('./config/db').models.user);

    let port = process.env.PORT || 3000;

    // Generic middleware
    app.use(express.static(require('path').join(__dirname, 'public')));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    require('./db/passport');
    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', "http://localhost:4200");
        res.setHeader('Access-Control-Allow-Method', 'GET, POST');
        res.setHeader('Access-Control-Allow-Headers', 'content-type');
        next();
    });

    // Route middleware
    app.get('/login', (req, res) => {
        res.sendFile(__dirname + '/public/login.html');
    });

    app.get('/register', (req, res) => {
        res.sendFile(__dirname + '/public/register.html');
    });

    app.post('/login', (req, res) => {
        authentication.login(req, res);
    });

    app.post('/register', (req, res) => {
        authentication.register(req.body, res);
    });

    app.post('/logout', (req, res) => {
        res.redirect('/login');
    });

    app.get('/index', (req, res) => {
        if (req.query.jwt) {
            if (jwt.verify(req.query.jwt, jwtSecret)) {
                res.sendFile(__dirname + '/public/app.html');
            } else {
                logger(
                    consoleConfig.messages.failure.jwtExpired,
                    consoleConfig.colors.failure
                );
                res.redirect('/login');
            }
        } else {
            logger(
                consoleConfig.messages.warning.noJWTIndexAccessAttempt,
                consoleConfig.colors.warning
            );
            res.redirect('/login');
        }
    });

    app.post('/verification', (req, res) => {
        if (req.body) {
            let { jwt: token, email } = req.body;
            if (token && email) {
                User.findOne({ email: email }, (err, data) => {
                    if (err) {
                        errorHandler(
                            consoleConfig.messages.errors.findUserFailed,
                            err
                        );
                        res.send('DB ERROR');
                    } else if (data) {
                        logger(
                            consoleConfig.messages.success.userAutoConnected(data),
                            consoleConfig.colors.success
                        );
                        res.redirect(`/index?jwt=${token}&email=${email}`);
                    } else {
                        logger(
                            consoleConfig.messages.info.redirectUnverified,
                            consoleConfig.colors.info
                        );
                        res.redirect('/login');
                    }
                });
            }
        } else {
            res.redirect('/login');
        }
    });

    app.get('*', (req, res) => {
        res.sendFile(__dirname + '/public/verification.html');
    });

    let authenticate = (socket, data, callback) => {
        let { email, jwt: token } = data;
        if (jwt.verify(token, jwtSecret)) {
            User.findOne({ email: email }, (err, found) => {
                if (err) {
                    errorHandler(
                        readUsersErrorMessage,
                        err
                    );
                    return callback(new Error("DB error"));
                } else if (found) {
                    logger(
                        consoleConfig.messages.success.userAuthenticated(found),
                        consoleConfig.colors.success
                    );
                    return callback(null, true);
                } else {
                    logger(
                        consoleConfig.messages.failure.noSuchUser,
                        consoleConfig.colors.failure
                    );
                    return callback(new Error("User not found"));
                }
            });
        }
    }

    let postAuthenticate = (socket, data) => {
        let email = data.email;

        User.findOne({ email: email }, (err, user) => {
            socket.client.user = user;
            logger(
                consoleConfig.messages.info.userAssociatedWithSocket(socket),
                consoleConfig.colors.info
            );
        });
    }

    let disconnect = (socket) => {
        if (socket.client.user) {
            logger(
                consoleConfig.messages.info.socketWithUserDisconnected(socket),
                consoleConfig.colors.info
            );
        } else {
            logger(
                consoleConfig.messages.info.socketDisconnected(socket),
                consoleConfig.colors.info
            );
        }
    };

    require('socketio-auth')(io, {
        authenticate: authenticate,
        postAuthenticate: postAuthenticate,
        disconnect: disconnect
    });

    io.on('connection', (socket) => {
        socket.on('enter room', (name) => {
            socket.join(name);
            socket.emit('room entered', (name));
        });

        socket.on('leave room', (name) => {
            socket.leave(name);
            socket.emit('room left', (name));
        });

        socket.on('send message', (roomName, msg) => {
            if (msg) {
                io.to(roomName).emit('message sent', msg, socket.client.user.email);
            }
        });
    });

    (function roomNews() {
        setTimeout(() => {
            logger(
                consoleConfig.messages.info.activeRooms
                    + JSON.stringify(io.sockets.adapter.rooms),
                consoleConfig.colors.info
            );
            roomNews();
        }, 10000)
    })();

    http.listen(port, () => {
        logger(
            consoleConfig.messages.info.serverListening(port),
            consoleConfig.colors.info
        );
    });
})();
