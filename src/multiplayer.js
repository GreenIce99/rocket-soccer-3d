
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
  width:min(480px,92vw); max-height:90vh; overflow:auto;
  padding:30px; box-sizing:border-box;
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
      Quick Match finds a waiting player or creates a room for you.
      Both players must join before the host starts.
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
let busy = false;

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

function setBusy(value) {
  busy = value;
  $('quickMatchBtn').disabled = value;
  $('createRoomBtn').disabled = value;
  $('joinRoomBtn').disabled = value;
  $('quickMatchBtn').textContent = value ? 'PLEASE WAIT...' : 'QUICK MATCH';
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

    const room = snapshot.val();
    const players = room.players || {};
    const names = Object.values(players).map(p => p.name || 'Player');

    $('onlinePlayers').textContent =
      names.length >= 2
        ? `${names[0]} vs ${names[1]} — both players connected`
        : `${names[0] || 'Player'} — waiting for an opponent...`;

    $('startOnlineBtn').disabled = !isHost ||
      names.length < 2 || room.status === 'playing';

    if (room.status === 'playing') {
      status('Match started! Gameplay synchronization is not connected yet.');

      window.dispatchEvent(new CustomEvent('rocket-online-start', {
        detail: {
          roomId: currentRoomId,
          roomCode: currentRoomCode,
          players
        }
      }));
    } else {
      status(names.length >= 2
        ? 'Opponent connected! Host can start the match.'
        : 'Room created. Share your code with a friend!');
    }
  }, error => {
    status(`Room update error: ${error.message}`);
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
  }, error => {
    status(`Chat error: ${error.message}`);
  });
}

async function createRoom() {
  if (busy) return;
  setBusy(true);
  status('Creating your room...');

  try {
    await playerReady;

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('You are not signed in to Firebase.');

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

    await onDisconnect(ref(database,
      `rooms/${currentRoomId}/players/${uid}`)).remove();

    showRoom();
    watchRoom();
    status('Room created! Share your code with a friend.');
  } catch (error) {
    status(`Could not create room: ${error.message}`);
    console.error(error);
  } finally {
    setBusy(false);
  }
}

async function joinRoom(code) {
  if (busy) return;

  code = code.toUpperCase().trim();

  if (!code || code.length !== 6) {
    status('Enter a valid 6-character room code.');
    return;
  }

  setBusy(true);
  status('Looking for room...');

  try {
    await playerReady;

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('You are not signed in to Firebase.');

    const roomsQuery = query(
      ref(database, 'rooms'),
      orderByChild('code'),
      equalTo(code)
    );

    const snapshot = await get(roomsQuery);

    if (!snapshot.exists()) {
      status('Room not found. Check the code.');
      return;
    }

    let foundId = null;

    snapshot.forEach(child => {
      foundId = child.key;
    });

    if (!foundId) {
      status('Room not found.');
      return;
    }

    const roomRef = ref(database, `rooms/${foundId}`);

    const result = await runTransaction(roomRef, room => {
      if (!room || room.status !== 'waiting') return;

      room.players = room.players || {};

      if (room.players[uid]) return room;
      if (Object.keys(room.players).length >= 2) return;

      room.players[uid] = {
        name: playerName(),
        joinedAt: Date.now()
      };

      return room;
    });

    if (!result.committed) {
      status('That room is full or the match has started.');
      return;
    }

    currentRoomId = foundId;
    currentRoomCode = code;
    isHost = false;

    await onDisconnect(ref(database,
      `rooms/${foundId}/players/${uid}`)).remove();

    showRoom();
    watchRoom();
    status('Joined room successfully!');
  } catch (error) {
    status(`Could not join room: ${error.message}`);
    console.error(error);
  } finally {
    setBusy(false);
  }
}

async function quickMatch() {
  if (busy) return;

  setBusy(true);
  status('Searching for an opponent...');

  try {
    await playerReady;

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('You are not signed in to Firebase.');

    const waitingQuery = query(
      ref(database, 'rooms'),
      orderByChild('status'),
      equalTo('waiting')
    );

    const snapshot = await get(waitingQuery);

    if (snapshot.exists()) {
      const candidates = [];

      snapshot.forEach(child => {
        const room = child.val();

        if (
          room &&
          room.host &&
          room.host !== uid &&
          room.status === 'waiting'
        ) {
          candidates.push({
            id: child.key,
            code: room.code
          });
        }
      });

      for (const candidate of candidates) {
        const roomRef = ref(database, `rooms/${candidate.id}`);

        const result = await runTransaction(roomRef, room => {
          if (!room || room.status !== 'waiting') return;
          if (!room.host || room.host === uid) return;

          room.players = room.players || {};

          if (room.players[uid]) return room;
          if (Object.keys(room.players).length >= 2) return;

          room.players[uid] = {
            name: playerName(),
            joinedAt: Date.now()
          };

          return room;
        });

        if (result.committed) {
          const joinedRoom = result.snapshot.val();

          currentRoomId = candidate.id;
          currentRoomCode = joinedRoom.code;
          isHost = false;

          await onDisconnect(ref(database,
            `rooms/${currentRoomId}/players/${uid}`)).remove();

          showRoom();
          watchRoom();
          status('Opponent found! Waiting for the host to start.');
          return;
        }
      }
    }

    // No available opponent: create a room and wait.
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

    await onDisconnect(ref(database,
      `rooms/${currentRoomId}/players/${uid}`)).remove();

    showRoom();
    watchRoom();
    status('No opponent found. Your room is ready — share the code!');
  } catch (error) {
    status(`Quick Match error: ${error.message}`);
    console.error('Quick Match failed:', error);
  } finally {
    setBusy(false);
  }
}

async function sendChat() {
  if (!currentRoomId) return;

  const messageText = $('onlineChatInput').value.trim();
  if (!messageText) return;

  $('onlineChatInput').value = '';

  try {
    await push(ref(database, `rooms/${currentRoomId}/chat`), {
      uid: auth.currentUser.uid,
      name: playerName(),
      text: messageText,
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

    const result = await runTransaction(roomRef, room => {
      if (!room || room.status !== 'waiting') return;
      if (Object.keys(room.players || {}).length < 2) return;

      room.status = 'playing';
      room.startedAt = Date.now();

      return room;
    });

    if (!result.committed) {
      status('You need two players before starting.');
      return;
    }

    status('Match started! Gameplay synchronization is the next step.');
  } catch (error) {
    status(`Could not start match: ${error.message}`);
  }
}

async function leaveRoom(removeRoom = true) {
  stopListeners();

  const oldRoomId = currentRoomId;
  const wasHost = isHost;

  if (oldRoomId && auth.currentUser) {
    const roomRef = ref(database, `rooms/${oldRoomId}`);
    const playerRef = ref(database,
      `rooms/${oldRoomId}/players/${auth.currentUser.uid}`);

    try {
      if (wasHost && removeRoom) {
        await remove(roomRef);
      } else {
        await remove(playerRef);
      }
    } catch (error) {
      console.warn('Room cleanup:', error);
    }
  }

  currentRoomId = null;
  currentRoomCode = null;
  isHost = false;

  showHome();
  status('You left the room.');
}

$('onlineClose').addEventListener('click', closePanel);

$('quickMatchBtn').addEventListener('click', quickMatch);
$('createRoomBtn').addEventListener('click', createRoom);

$('joinRoomBtn').addEventListener('click', () => {
  joinRoom($('joinCodeInput').value);
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
