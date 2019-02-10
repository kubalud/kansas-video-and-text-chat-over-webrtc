// setting STUN
var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

// setting TURN
if (location.hostname !== 'localhost') {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var turnServer = JSON.parse(xhr.responseText);
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
}).catch(function(e) {
    console.log('getUserMedia() error: ' + e.name);
});

function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
    console.log('Failed to create session description: ' + error.toString());
}

// peer connection creator
let createNewPC = (videoElement) => {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = (event) => {
        console.log('icecandidate event: ', event);
        if (event.candidate) {
            socket.emit('send candidate', {
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            });
        } else {
        console.log('End of candidates.');
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

// listeners
    // logout
    logoutButtonElement.addEventListener('submit', () => {
        localStorage.removeItem('kansas-jwt');
        localStorage.removeItem('kansas-email');
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
                chatMessageListWrapperElement.classList.remove('hidden');
                let newMessageListItemElement = document.createElement("li");

                let sendingUserEmailElement = document.createElement('span');
                sendingUserEmailElement.innerHTML = `${senderEmail}: `;
                sendingUserEmailElement.style['opacity'] = '0.5';

                let messageElement = document.createElement('span');
                messageElement.innerHTML = message;
                messageElement.style['word-wrap'] = 'break-word';

                newMessageListItemElement.appendChild(sendingUserEmailElement);
                newMessageListItemElement.appendChild(messageElement);

                chatMessageListElement.appendChild(newMessageListItemElement);
                chatMessageListElement.scrollTo(0, chatMessageListElement.scrollHeight);
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

            socket.on('new peer joined', (socketId, email) => {
                if (socketId !== mySocketId) {
                    let newVideoElement = document.createElement('video')
                    newVideoElement.setAttribute('autoplay', true);
                    newVideoElement.setAttribute('playsinline', true);
                    remoteVideosWrapper.appendChild(newVideoElement);

                    connections[socketId] = {
                        videoElement: newVideoElement,
                        pc: createNewPC(newVideoElement),
                        email: email
                    };

                    socket.emit('peer offer');
                }
            });

            socket.on('peer offer sent', (socketId, message) => {
                let pc = connections[socketId].pc
                pc.addStream(localStream);
                pc.setRemoteDescription(new RTCSessionDescription(message));
                pc.createAnswer().then(
                    setLocalAndSendMessage,
                    onCreateSessionDescriptionError
                );
            });

            socket.on('answer sent', (socketId) => {
                connections[socketId].pc.setRemoteDescription(new RTCSessionDescription(message));// TODO message
            });

            socket.on('candidate sent', (socketId, message) => {
                var candidate = new RTCIceCandidate({
                    sdpMLineIndex: message.label,
                    candidate: message.candidate
                });
                connections[socketId].pc.addIceCandidate(candidate);
            });

            socket.on('bye sent', (socketId) => {
                let senderEmail = connections[socketId].email;
                connections[socketId].pc.close();
                connections[socketId].videoElement.parentNode.removeChild(videoElement);
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
            });

            // element listeners
                // on before unload
                window.onbeforeunload = () => {
                    socket.emit('send metadata', 'bye', currentRoom);
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
                        socket.emit('send message', currentRoom, chatMessageInputElement.value);
                        chatMessageInputElement.value = ''; // reset
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
                        socket.emit('leave room', currentRoom);
                    });
        });
    });
