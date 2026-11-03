
import { auth, database, playerReady } from './firebase.js';
import {
  ref,
  push,
  set,
  get,
  update,
  query,
  orderByChild,
  equalTo,
  runTransaction,
  onValue,
  onDisconnect,
  remove
} from 'firebase/database';

const style = document.createElement('style');
style.textContent = `
#onlinePanel {
  position:fixed; inset:0; z-index:100;
  display:none; align-items:center; justify-content:center;
  background:rgba(2,8,20,.92); backdrop-filter:blur(12px);
  font-family:Arial,sans-serif; color:white;
}
#onlinePanel.open {display:flex}
.online-card {
  width:min(480px,92vw); padding:30px;
  border:1px solid #248dff; border-radius:16px;
  background:linear-gradient(145deg,#10233d,#07101e);
  box-shadow:0 0 45px #087bff33;
}
.online-card h2 {
  margin:0 0 8px; font-size:28px; letter-spacing:2px;
}
.online-sub {color:#a9c7e8;margin-bottom:22px}
.online-input {
  box-sizing:border-box;width:100%;padding:14px;
  margin:8px 0;color:white;background:#071629;
  border:1px solid #365777;border-radius:7px;font-size:17px;
}
.online-btn {
  width:100%;padding:14px;margin:6px 0;
  border:0;border-radius:7px;cursor:pointer;
  font-weight:800;letter-spacing:1px;
  color:#061323;background:linear-gradient(100deg,#55d0ff,#168cff);
}
.online-btn.secondary {
  color:white;background:#233b59;border:1px solid #45617e;
}
.online-btn:disabled {opacity:.5;cursor:wait}
.online-close {
  float:right;background:transparent;color:white;
  border:0;font-size:24px;cursor:pointer;
}
#onlineStatus {min-height:24px;color:#6ed0ff;margin:12px 0}
#roomCodeDisplay {
  font-size:34px;letter-spacing:8px;text-align:center;
  padding:15px;background:#071629;border-radius:8px;
}
#onlinePlayers {color:#c6ddf4;margin:12px 0}
#onlineChat {
  height:125px;overflow:auto;background:#071629;
  padding:10px;border-radius:7px;margin:10px 0;
  font-size:13px;
}
.online-chat-row {display:flex;gap:6px}
.online-chat-row input {flex:1;min-width:0}
.online-small {font-size:12px;color:#9bb4d0}
`;
document.head.appendChild(style);

const panel = document.createElement('div');
panel.id = 'onlinePanel';
panel.innerHTML = `
  <div class="online-card">
    <button class="online-close" id="onlineClose">×</button>
    <h2>ONLINE MULTIPLAYER</h2>
    <div class="online-sub">Play Rocket Soccer with a friend.</div>

    <div id="onlineHome">
      <input id="onlineName" class="online-input"
        maxlength="16" placeholder="Your player name" value="Player">
      <button class="online-btn" id="quickMatchBtn">QUICK MATCH</button>
      <button class="online-btn secondary" id="createRoomBtn">CREATE PRIVATE ROOM</button>
      <input id="joinCodeInput" class="online-input"
        maxlength="6" placeholder="ENTER ROOM CODE">
      <button class="online-btn secondary" id="joinRoomBtn">JOIN ROOM</button>
    </div>

    <div id="onlineRoom" style="display:none">
      <div class="online-small">YOUR ROOM CODE</div>
      <div id="roomCodeDisplay">------</div>
      <div id="onlinePlayers">Waiting for another player...</div>
      <div id="onlineChat"></div>
      <div class="online-chat-row">
        <input id="onlineChatInput" class="online-input"
          maxlength="120" placeholder="Type a message">
        <button class="online-btn" id="sendChatBtn"
          style="width:90px">SEND</button>
      </div>
      <button class="online-btn" id="startOnlineBtn">START MATCH</button>
      <button class="online-btn secondary" id="leaveRoomBtn">LEAVE ROOM</button>
    </div>

    <div id="onlineStatus">Connecting to Firebase...</div>
    <div class="online-small">
      Online rooms are being connected. Live gameplay synchronization
      is the next integration step.
    </div>
  </div>
`;
document.body.appendChild(panel);

const $ = id => document.getElementById(id);

let currentRoomId = null;
let currentRoomCode = null;
let roomListener = null;
let chatListener = null;
let isHost = false;
let currentRoomData = null;

function status(message) {
  $('onlineStatus').textContent = message;
}

function openPanel() {
  panel.classList.add('open');
}

function closePanel() {
  panel.classList.remove('open');
}

function playerName() {
  return $('onlineName').value.trim().slice(0, 16) || 'Player';
}

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function showRoom() {
  $('onlineHome').style.display = 'none';
  $('onlineRoom').style.display = 'block';
  $('roomCodeDisplay').textContent = currentRoomCode || '------';
}

function showHome() {
  $('onlineHome').style.display = 'block';
  $('onlineRoom').style.display = 'none';
  $('onlineChat').innerHTML = '';
}

function stopListeners() {
  if (roomListener) roomListener();
  if (chatListener) chatListener();
  roomListener = null;
  chatListener = null;
}

function watchRoom() {
  stopListeners();

  const roomRef = ref(database, `rooms/${currentRoomId}`);

  roomListener = onValue(roomRef, snapshot => {
    if (!snapshot.exists()) {
      status('This room no longer exists.');
      leaveRoom(false);
      return;
    }

    currentRoomData = snapshot.val();
    const players = currentRoomData.players || {};
    const names = Object.values(players).map(p => p.name || 'Player');

    $('onlinePlayers').textContent =
      names.length >= 2
        ? `${names[0]} vs ${names[1]} — both players connected`
        : `${names[0] || 'Player'} — waiting for an opponent...`;

    $('startOnlineBtn').disabled = !isHost || names.length < 2;
    status(
      currentRoomData.status === 'playing'
        ? 'Match marked as started.'
        : names.length >= 2
          ? 'Opponent connected!'
          : 'Room created. Share your code!'
    );

    if (currentRoomData.status === 'playing') {
      window.dispatchEvent(new CustomEvent('rocket-online-start', {
        detail: {
          roomId: currentRoomId,
          roomCode: currentRoomCode,
          players
        }
      }));
    }
  });

  const messagesRef = ref(database, `rooms/${currentRoomId}/chat`);
  chatListener = onValue(messagesRef, snapshot => {
    const messages = snapshot.val() || {};
    const entries = Object.values(messages).slice(-35);

    $('onlineChat').innerHTML = '';

    for (const message of entries) {
      const line = document.createElement('div');
      const name = document.createElement('b');
      const content = document.createElement('span');

      name.textContent = `${message.name || 'Player'}: `;
      content.textContent = message.text || '';

      line.append(name, content);
      $('onlineChat').appendChild(line);
    }

    $('onlineChat').scrollTop = $('onlineChat').scrollHeight;
  });
}

async function createRoom() {
  status('Creating your room...');
  try {
    const uid = auth.currentUser.uid;
    const code = makeCode();
    const roomRef = push(ref(database, 'rooms'));

    currentRoomId = roomRef.key;
    currentRoomCode = code;
    isHost = true;

    await set(roomRef, {
      code,
      host: uid,
      status: 'waiting',
      createdAt: Date.now(),
      players: {
        [uid]: {
          name: playerName(),
          joinedAt: Date.now()
        }
      }
    });

    await onDisconnect(ref(database, `rooms/${currentRoomId}/players/${uid}`))
      .remove();

    showRoom();
    watchRoom();
    status('Room created! Share your code.');
  } catch (error) {
    status(`Could not create room: ${error.message}`);
  }
}

async function joinRoom(code) {
  if (!code || code.length !== 6) {
    status('Enter a valid 6-character room code.');
    return;
  }

  status('Looking for room...');
  try {
    const roomsQuery = query(
      ref(database, 'rooms'),
      orderByChild('code'),
      equalTo(code.toUpperCase())
    );

    const snapshot = await get(roomsQuery);

    if (!snapshot.exists()) {
      status('Room not found. Check the code.');
      return;
    }

    let foundId = null;
    let foundRoom = null;

    snapshot.forEach(child => {
      foundId = child.key;
      foundRoom = child.val();
    });

    if (!foundId || !foundRoom) {
      status('Room not found.');
      return;
    }

    const uid = auth.currentUser.uid;
    const playersRef = ref(database, `rooms/${foundId}/players`);

    const result = await runTransaction(playersRef, players => {
      players = players || {};

      if (players[uid]) return players;
      if (Object.keys(players).length >= 2) return;
      if (foundRoom.status !== 'waiting') return;

      players[uid] = {
        name: playerName(),
        joinedAt: Date.now()
      };

      return players;
    });

    if (!result.committed) {
      status('That room is full or the match has started.');
      return;
    }

    currentRoomId = foundId;
    currentRoomCode = code.toUpperCase();
    isHost = false;

    await onDisconnect(ref(database, `rooms/${foundId}/players/${uid}`))
      .remove();

    showRoom();
    watchRoom();
    status('Joined room successfully!');
  } catch (error) {
    status(`Could not join room: ${error.message}`);
  }
}

async function quickMatch() {
  status('Searching for an opponent...');

  try {
    const uid = auth.currentUser.uid;
    const waitingQuery = query(
      ref(database, 'rooms'),
      orderByChild('status'),
      equalTo('waiting')
    );

    const snapshot = await get(waitingQuery);

    if (snapshot.exists()) {
      for (const child of Object.values(snapshot.val())) {
        // The room code is used to locate the room below.
        if (!child.code || !child.host || child.host === uid) continue;

        const roomQuery = query(
          ref(database, 'rooms'),
          orderByChild('code'),
          equalTo(child.code)
        );
        const roomSnapshot = await get(roomQuery);

        let roomId = null;
        roomSnapshot.forEach(item => { roomId = item.key; });

        if (!roomId) continue;

        const playersRef = ref(database, `rooms/${roomId}/players`);
        const result = await runTransaction(playersRef, players => {
          players = players || {};
          if (players[uid]) return players;
          if (Object.keys(players).length >= 2) return;
          players[uid] = {
            name: playerName(),
            joinedAt: Date.now()
          };
          return players;
        });

        if (result.committed) {
          currentRoomId = roomId;
          currentRoomCode = child.code;
          isHost = false;

          await onDisconnect(
            ref(database, `rooms/${roomId}/players/${uid}`)
          ).remove();

          showRoom();
          watchRoom();
          status('Opponent found!');
          return;
        }
      }
    }

    await createRoom();
    status('No opponent found yet. Your room is waiting!');
  } catch (error) {
    status(`Quick Match error: ${error.message}`);
  }
}

async function sendChat() {
  if (!currentRoomId) return;

  const text = $('onlineChatInput').value.trim();
  if (!text) return;

  $('onlineChatInput').value = '';

  try {
    await push(ref(database, `rooms/${currentRoomId}/chat`), {
      uid: auth.currentUser.uid,
      name: playerName(),
      text,
      sentAt: Date.now()
    });
  } catch (error) {
    status(`Message failed: ${error.message}`);
  }
}

async function startOnlineMatch() {
  if (!currentRoomId || !isHost) return;

  try {
    const roomRef = ref(database, `rooms/${currentRoomId}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return;

    const room = snapshot.val();
    if (Object.keys(room.players || {}).length < 2) {
      status('Wait for another player first.');
      return;
    }

    await update(roomRef, {
      status: 'playing',
      startedAt: Date.now()
    });

    status('Match started!');
  } catch (error) {
    status(`Could not start match: ${error.message}`);
  }
}

async function leaveRoom(removeRoom = true) {
  stopListeners();

  if (currentRoomId && auth.currentUser) {
    const roomRef = ref(database, `rooms/${currentRoomId}`);
    const playerRef = ref(
      database,
      `rooms/${currentRoomId}/players/${auth.currentUser.uid}`
    );

    try {
      await remove(playerRef);

      if (removeRoom && isHost) {
        await remove(roomRef);
      }
    } catch (error) {
      console.warn('Room cleanup:', error);
    }
  }

  currentRoomId = null;
  currentRoomCode = null;
  currentRoomData = null;
  isHost = false;

  showHome();
  status('You left the room.');
}

$('onlineClose').addEventListener('click', closePanel);

$('quickMatchBtn').addEventListener('click', quickMatch);
$('createRoomBtn').addEventListener('click', createRoom);

$('joinRoomBtn').addEventListener('click', () => {
  joinRoom($('joinCodeInput').value.trim());
});

$('joinCodeInput').addEventListener('input', event => {
  event.target.value = event.target.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
});

$('sendChatBtn').addEventListener('click', sendChat);
$('onlineChatInput').addEventListener('keydown', event => {
  if (event.key === 'Enter') sendChat();
});

$('startOnlineBtn').addEventListener('click', startOnlineMatch);
$('leaveRoomBtn').addEventListener('click', () => leaveRoom());

async function initializeOnline() {
  try {
    await playerReady;
    status('Connected to Firebase!');

    const button = document.createElement('button');
    button.className = 'play-button';
    button.style.marginTop = '12px';
    button.innerHTML = '<span>ONLINE MULTIPLAYER</span><b>🌐</b>';

    button.addEventListener('click', openPanel);

    const playButton = document.getElementById('playBtn');
    if (playButton) {
      playButton.insertAdjacentElement('afterend', button);
    } else {
      document.body.appendChild(button);
    }
  } catch (error) {
    status(`Firebase connection failed: ${error.message}`);
    console.error(error);
  }
}

initializeOnline();

window.addEventListener('beforeunload', () => {
  stopListeners();
});
