// setting STUN
var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

// setting TURN
if (location.hostname !== 'localhost') {
  // TODO provide OWN stable TURN server in pc config and remove
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
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
var socket = io.connect('http://localhost'); // TODO change on deploy

// login persistence
    // grab from url
    let jwt = new URL(window.location.href).searchParams.get("jwt");
    let email = new URL(window.location.href).searchParams.get("email");

    // save to localStorage
    localStorage.setItem('kansas-jwt', jwt);
    localStorage.setItem('kansas-email', email);

// element hooks
    // videos
    var localVideo = document.querySelector('[data-kc-videos__local--video]');
    var remoteVideosWrapper = document.querySelector('[data-kc-videos__remote]');

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
    console.log('Adding local stream.');
    localStream = stream;
    localVideo.srcObject = stream;
    sendMessage('got user media');
    if (isInitiator) {
        maybeStart();
    }
}).catch(function(e) {
    console.log('getUserMedia() error: ' + e.name);
});

// listeners
    // on before unload
    window.onbeforeunload = function() {
        sendMessage(roomName, 'bye');
    };

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

            // element listeners
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

            // TODO webRTC distribution
            function sendMessage(message) {
                console.log('Client sending message: ', message);
                socket.emit('message', roomName, message);
            }
        });
    });
