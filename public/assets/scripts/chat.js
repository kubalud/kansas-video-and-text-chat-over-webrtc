
// variables
let currentRoom = '';
var socket = io.connect('http://localhost'); // TODO change on deploy

// login persistence
    // grab from url
    let jwt = new URL(window.location.href).searchParams.get("jwt");
    let email = new URL(window.location.href).searchParams.get("email");

    // save to localStorage
    localStorage.setItem('kansas-jwt', jwt);
    localStorage.setItem('kansas-email', email);

// element hooks
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

// listeners
    // logout
    logoutButtonElement.addEventListener('submit', () => {
        localStorage.removeItem('kansas-jwt');
        localStorage.removeItem('kansas-email');
        socket.disconnect();
    });

    let receivedMessages = 0;
    let messageAmount = 5000;

    // on connections (element listeners set after authentication)
    socket.on('connect', () => {
        socket.emit('authentication', { email: email, jwt: jwt });
        socket.on('authenticated', () => {
            socket.on('message sent', (message, senderEmail) => {
                receivedMessages++;
                if (receivedMessages === messageAmount) {
                    console.timeEnd('wait time');
                    receivedMessages = 0;
                    chatMessageButtonElement.click();
                }
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
                        for (i = 0; i < messageAmount; i++) {
                            socket.emit('send message', currentRoom, chatMessageInputElement.value);
                        }
                        console.time('wait time');
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
