let displayNewMessage = (email, message) => {
    chatMessageListWrapperElement.classList.remove('hidden');
    let newMessageListItemElement = document.createElement("li");

    let sendingUserEmailElement = document.createElement('span');
    sendingUserEmailElement.innerHTML = `${email}: `;
    sendingUserEmailElement.style['opacity'] = '0.5';

    let messageElement = document.createElement('span');
    messageElement.innerHTML = message;
    messageElement.style['word-wrap'] = 'break-word';

    newMessageListItemElement.appendChild(sendingUserEmailElement);
    newMessageListItemElement.appendChild(messageElement);

    chatMessageListElement.appendChild(newMessageListItemElement);
    chatMessageListElement.scrollTo(0, chatMessageListElement.scrollHeight);
}

class PeerReference {
    onReceiveMessageCallback(event) {
        let data = JSON.parse(event.data);
        displayNewMessage(data.email, data.message);
    }

    createNewPC(videoElement, socketId) {
        let pc = new RTCPeerConnection(null);
        pc.ondatachannel = (event) => {
            this.receiveChannel = event.channel;
            this.receiveChannel.onmessage = this.onReceiveMessageCallback;
        };
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('send candidate', {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                }, socketId);
            }
        };
        pc.onaddstream = (event) => {
            videoElement.srcObject = event.stream;
        };
        pc.onremovestream = (event) => {
            console.log('Remote stream removed. Event: ', event);
        };
        return pc;
    }

    createNewVideoElement() {
        let newVideoElement = document.createElement('video')
        newVideoElement.setAttribute('autoplay', true);
        newVideoElement.setAttribute('playsinline', true);
        remoteVideosWrapper.appendChild(newVideoElement);
        return newVideoElement;
    };

    constructor(socketId) {
        let newVideoElement = this.createNewVideoElement();
        let pc = this.createNewPC(newVideoElement, socketId);
        pc.addStream(localStream);

        this.videoElement = newVideoElement;
        this.pc = pc;
        this.email = email;
        this.sendChannel = pc.createDataChannel('sendDataChannel', null);
    };
}

// setting STUN
let pcConfig = {
    'iceServers': [{
        'urls': 'stun:stun.l.google.com:19302'
    }]
};

// setting TURN
if (location.hostname !== 'localhost') {
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            let turnServer = JSON.parse(xhr.responseText);
            console.log('Got TURN server: ', turnServer);
            pcConfig.iceServers.push({
                'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
                'credential': turnServer.password
            });
            turnReady = true;
        }
    };
    xhr.open('GET', 'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913', true);
    xhr.send();
}

// variables
let currentRoom = '';
let connections = {};
let mySocketId = '';

let isChannelReady = false;
let isInitiator = false;
let isStarted = false;
let localStream;
let turnReady;

let socket = io.connect('http://localhost'); // TODO change on deploy

// login persistence
// grab from url
let jwt = new URL(window.location.href).searchParams.get("jwt");
let email = new URL(window.location.href).searchParams.get("email");

// save to localStorage
localStorage.setItem('kansas-jwt', jwt);
localStorage.setItem('kansas-email', email);

// element hooks
// videos
let localVideoElement = document.querySelector('[data-kc-videos__local--video]');
let remoteVideosWrapper = document.querySelector('[data-kc-videos__remote]');

// inside room
let leaveRoomButtonWrapperElement = document.querySelector('[data-kc-navigation__toolbar--left-span]');
let leaveRoomButtonElement = document.querySelector('[data-kc-leave-room-button]');

// outside room
let roomInputWrapperElement = document.querySelector('[data-kc-navigation__main]');
let roomInputElement = document.querySelector('[data-kc-room-input]');
let roomEntryButtonElement = document.querySelector('[data-kc-room-entry-button]');

// chat
let chatWrapperElement = document.querySelector('[data-kc-chat]');
let roomNameElement = document.querySelector('[data-kc-chat__room-name--h1]');
let chatMessageListElement = document.querySelector('[data-kc-chat__message-list--ul]');
let chatMessageListWrapperElement = document.querySelector('[data-kc-chat__message-list]');
let chatMessageInputElement = document.querySelector('[data-kc-chat__new-message--input]');
let chatMessageButtonElement = document.querySelector('[data-kc-chat__new-message--button]');

// logout
let logoutButtonElement = document.querySelector('[data-kc-logout--button]');

// setting user media
navigator.mediaDevices.getUserMedia({
    audio: false,
    video: true
}).then((stream) => {
    localVideoElement.srcObject = localStream = stream;
}).catch((e) => {
    console.log('getUserMedia() error: ' + e.name);
});

let onCreateSessionDescriptionError = (error) => {
    console.log('Failed to create session description: ' + error.toString());
}

// listeners
// logout
logoutButtonElement.addEventListener('submit', () => {
    localStorage.removeItem('kansas-jwt');
    localStorage.removeItem('kansas-email');
    socket.emit('send bye', currentRoom);
    socket.disconnect();
});

// on connections (element listeners set after authentication)
socket.on('connect', () => {
    socket.emit('authentication', { email: email, jwt: jwt });
    socket.on('authenticated', () => {
        socket.on('id sent', (socketId) => {
            mySocketId = socketId;
        });

        socket.on('message sent', (message, senderEmail) => {
            // create li, then sender & message spans, add styles, append ul>li>spans, scroll to last
        });

        socket.on('room entered', (roomName) => {
            currentRoom = roomName; // set global room variable

            roomNameElement.innerHTML = `Room ${roomName}`; // set room name in chat element header

            roomInputWrapperElement.classList.add('hidden'); // hide room entrance input wrapper

            leaveRoomButtonWrapperElement.classList.remove('hidden'); // show room leave button
            chatWrapperElement.classList.remove('hidden'); // show chat wrapper
        });

        socket.on('room left', () => {
            roomInputWrapperElement.classList.remove('hidden'); // show room entrance input wrapper

            leaveRoomButtonWrapperElement.classList.add('hidden'); // hide room leave button
            chatWrapperElement.classList.add('hidden'); // hide chat wrapper
            chatMessageListWrapperElement.classList.add('hidden'); // hide chat message list wrapper

            chatMessageListElement.innerHTML = ''; // delete chat messages
        });

        let handleCreateOfferError = (event) => {
            console.log('createOffer() error: ', event);
        }

        socket.on('new peer joined', (socketId, email) => {
            chatMessageListWrapperElement.classList.remove('hidden');
            let newMessageListItemElement = document.createElement("li");

            let infoElement = document.createElement('span');
            infoElement.innerHTML = `${email} joined the room.`;
            infoElement.style['color'] = '#00ff00';
            infoElement.style['opacity'] = '0.5';

            newMessageListItemElement.appendChild(infoElement);

            chatMessageListElement.appendChild(newMessageListItemElement);
            chatMessageListElement.scrollTo(0, chatMessageListElement.scrollHeight);

            if (socketId !== mySocketId) {
                if (!connections[socketId]) {
                    connections[socketId] = new PeerReference(socketId, email);
                }
                connections[socketId].pc.createOffer((sessionDescription) => {
                    connections[socketId].pc.setLocalDescription(sessionDescription);
                    socket.emit('offer', sessionDescription, socketId);
                }, handleCreateOfferError);
            }
        });

        socket.on('answered', (message, socketId) => {
            connections[socketId].pc.setRemoteDescription(
                new RTCSessionDescription(message)
            );
        });

        socket.on('offered', (message, socketId, email) => {
            if (!connections[socketId]) {
                connections[socketId] = new PeerReference(socketId, email);
            }
            connections[socketId].pc.setRemoteDescription(new RTCSessionDescription(message));
            connections[socketId].pc.createAnswer().then(
                (sessionDescription) => {
                    connections[socketId].pc.setLocalDescription(sessionDescription);
                    socket.emit('answer', sessionDescription, socketId);
                },
                onCreateSessionDescriptionError
            );
        });

        socket.on('candidate sent', (message, socketId) => {
            var candidate = new RTCIceCandidate({
                sdpMLineIndex: message.label,
                candidate: message.candidate
            });
            connections[socketId].pc.addIceCandidate(candidate);
        });

        // on close
        socket.on('bye sent', (socketId) => {
            if (socketId !== mySocketId) {
                let senderEmail = connections[socketId].email;
                connections[socketId].pc.close();
                connections[socketId].sendChannel.close();
                connections[socketId].receiveChannel.close();
                connections[socketId].videoElement.parentNode.removeChild(
                    connections[socketId].videoElement
                );
                delete connections[socketId];

                chatMessageListWrapperElement.classList.remove('hidden');
                let newMessageListItemElement = document.createElement("li");

                let infoElement = document.createElement('span');
                infoElement.innerHTML = `${senderEmail} left the room.`;
                infoElement.style['color'] = '#ff0000';
                infoElement.style['opacity'] = '0.5';

                newMessageListItemElement.appendChild(infoElement);

                chatMessageListElement.appendChild(newMessageListItemElement);
                chatMessageListElement.scrollTo(0, chatMessageListElement.scrollHeight);
            }
        });

        // element listeners
        // on before unload
        window.onbeforeunload = () => {
            socket.emit('send bye', currentRoom);
        };

        // enter button listeners on input to trigger attached buttons
        // chat message
        chatMessageInputElement.addEventListener('keydown', (e) => {
            if (e.keyCode == 13) { // enter event keycode
                chatMessageButtonElement.click();
            }
        });

        // room entrance
        roomInputElement.addEventListener('keydown', (e) => {
            if (e.keyCode == 13) { // enter event keycode
                roomEntryButtonElement.click();
            }
        });

        // chat message emit
        chatMessageButtonElement.addEventListener('click', () => {
            if (chatMessageInputElement.value) { // empty check
                for (let socketId in connections) {
                    if (connections.hasOwnProperty(socketId)) {
                        connections[socketId].sendChannel.send(JSON.stringify({
                            message: chatMessageInputElement.value,
                            email: email
                        }));
                    }
                }
                displayNewMessage(email, chatMessageInputElement.value);
                chatMessageInputElement.value = '';
            }
        });

        // room navigation clicks
        // entering
        roomEntryButtonElement.addEventListener('click', () => {
            if (roomInputElement.value) { // empty check
                socket.emit('enter room', roomInputElement.value);
                roomInputElement.value = ''; // reset
            }
        });

        // leaving
        leaveRoomButtonElement.addEventListener('click', () => {
            connections = {};
            socket.emit('send bye', currentRoom);
            socket.emit('leave room', currentRoom);
        });
    });
});
