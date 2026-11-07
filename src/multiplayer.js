import { auth, database, playerReady } from "./firebase.js";

import {
  ref,
  push,
  set,
  get,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
  runTransaction,
  onValue,
  onDisconnect
} from "firebase/database";

/* ==========================================
   ROCKET SOCCER - MULTIPLAYER
   ========================================== */

let currentRoomId = null;
let currentRoomCode = null;
let currentOwnRoomId = null;
let currentTicketId = null;

let roomListener = null;
let chatListener = null;
let ticketListener = null;

let isHost = false;
let busy = false;
let joiningMatchedRoom = false;

const $ = id => document.getElementById(id);

function status(message) {
  const element = $("onlineStatus");
  if (element) element.textContent = message;
}

function playerName() {
  return $("onlineName")?.value.trim().slice(0, 16) || "Player";
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function getPlayerCount(players) {
  return Object.keys(players || {}).length;
}

function setBusy(value) {
  busy = value;

  $("quickMatchBtn").disabled = value;
  $("createRoomBtn").disabled = value;
  $("joinRoomBtn").disabled = value;

  $("quickMatchBtn").textContent =
    value ? "PLEASE WAIT..." : "QUICK MATCH";
}

function showRoom() {
  $("onlineHome").style.display = "none";
  $("onlineRoom").style.display = "block";
  $("roomCodeDisplay").textContent = currentRoomCode || "------";
}

function showHome() {
  $("onlineHome").style.display = "block";
  $("onlineRoom").style.display = "none";
  $("onlineChat").innerHTML = "";
}

function stopListeners() {
  if (roomListener) roomListener();
  if (chatListener) chatListener();
  if (ticketListener) ticketListener();

  roomListener = null;
  chatListener = null;
  ticketListener = null;
}

/* ==========================================
   STYLES AND PANEL
   ========================================== */

const style = document.createElement("style");

style.textContent = `
#onlinePanel {
  position:fixed;
  inset:0;
  z-index:100;
  display:none;
  align-items:center;
  justify-content:center;
  background:rgba(2,8,20,.94);
  backdrop-filter:blur(12px);
  font-family:Arial,sans-serif;
  color:white;
}

#onlinePanel.open {
  display:flex;
}

.online-card {
  width:min(480px,92vw);
  max-height:90vh;
  overflow:auto;
  box-sizing:border-box;
  padding:26px;
  border:1px solid #248dff;
  border-radius:16px;
  background:linear-gradient(145deg,#10233d,#07101e);
  box-shadow:0 0 45px #087bff33;
}

.online-card h2 {
  margin:0 0 8px;
  font-size:27px;
  letter-spacing:2px;
}

.online-sub {
  color:#a9c7e8;
  margin-bottom:22px;
}

.online-input {
  box-sizing:border-box;
  width:100%;
  padding:14px;
  margin:8px 0;
  color:white;
  background:#071629;
  border:1px solid #365777;
  border-radius:7px;
  font-size:16px;
}

.online-btn {
  width:100%;
  padding:14px;
  margin:6px 0;
  border:0;
  border-radius:7px;
  cursor:pointer;
  font-weight:800;
  letter-spacing:1px;
  color:#061323;
  background:linear-gradient(100deg,#55d0ff,#168cff);
}

.online-btn.secondary {
  color:white;
  background:#233b59;
  border:1px solid #45617e;
}

.online-btn:disabled {
  opacity:.5;
  cursor:wait;
}

.online-close {
  float:right;
  background:transparent;
  color:white;
  border:0;
  font-size:24px;
  cursor:pointer;
}

#onlineStatus {
  min-height:24px;
  color:#6ed0ff;
  margin:12px 0;
  line-height:1.5;
}

#roomCodeDisplay {
  font-size:34px;
  letter-spacing:8px;
  text-align:center;
  padding:15px;
  background:#071629;
  border-radius:8px;
}

#onlinePlayers {
  color:#c6ddf4;
  margin:12px 0;
}

#onlineChat {
  height:125px;
  overflow:auto;
  background:#071629;
  padding:10px;
  border-radius:7px;
  margin:10px 0;
  font-size:13px;
  overflow-wrap:anywhere;
}

.online-chat-row {
  display:flex;
  gap:6px;
}

.online-chat-row input {
  flex:1;
  min-width:0;
}

.online-small {
  font-size:12px;
  color:#9bb4d0;
}
`;

document.head.appendChild(style);

const panel = document.createElement("div");
panel.id = "onlinePanel";

panel.innerHTML = `
  <div class="online-card">

    <button class="online-close" id="onlineClose">×</button>

    <h2>ONLINE MULTIPLAYER</h2>

    <div class="online-sub">
      Play Rocket Soccer with a friend.
    </div>

    <div id="onlineHome">

      <input
        id="onlineName"
        class="online-input"
        maxlength="16"
        placeholder="Your player name"
        value="Player"
      >

      <button class="online-btn" id="quickMatchBtn">
        QUICK MATCH
      </button>

      <button class="online-btn secondary" id="createRoomBtn">
        CREATE PRIVATE ROOM
      </button>

      <input
        id="joinCodeInput"
        class="online-input"
        maxlength="6"
        placeholder="ENTER ROOM CODE"
      >

      <button class="online-btn secondary" id="joinRoomBtn">
        JOIN ROOM
      </button>

    </div>

    <div id="onlineRoom" style="display:none">

      <div class="online-small">YOUR ROOM CODE</div>

      <div id="roomCodeDisplay">------</div>

      <button class="online-btn secondary" id="copyCodeBtn">
        COPY ROOM CODE
      </button>

      <div id="onlinePlayers">
        Waiting for another player...
      </div>

      <div id="onlineChat"></div>

      <div class="online-chat-row">
        <input
          id="onlineChatInput"
          class="online-input"
          maxlength="120"
          placeholder="Type a message"
        >

        <button
          class="online-btn"
          id="sendChatBtn"
          style="width:90px"
        >
          SEND
        </button>
      </div>

      <button class="online-btn" id="startOnlineBtn">
        START MATCH
      </button>

      <button class="online-btn secondary" id="leaveRoomBtn">
        LEAVE ROOM
      </button>

    </div>

    <div id="onlineStatus">
      Connecting to Firebase...
    </div>

    <div class="online-small">
      Quick Match automatically searches for another player.
      If nobody is available, it waits for someone to join.
    </div>

  </div>
`;

document.body.appendChild(panel);

function openPanel() {
  panel.classList.add("open");
}

function closePanel() {
  panel.classList.remove("open");
}

/* ==========================================
   ROOM LISTENERS
   ========================================== */

function watchRoom() {
  if (!currentRoomId) return;

  if (roomListener) roomListener();
  if (chatListener) chatListener();

  const watchedRoomId = currentRoomId;

  const roomRef = ref(database, `rooms/${watchedRoomId}`);

  roomListener = onValue(
    roomRef,
    snapshot => {
      if (currentRoomId !== watchedRoomId) return;

      if (!snapshot.exists()) {
        status("This room no longer exists.");
        return;
      }

      const room = snapshot.val();
      const players = room.players || {};
      const names = Object.values(players).map(
        player => player.name || "Player"
      );

      $("onlinePlayers").textContent =
        names.length >= 2
          ? `${names[0]} vs ${names[1]} — BOTH PLAYERS CONNECTED!`
          : `${names[0] || "Player"} — waiting for an opponent...`;

      $("startOnlineBtn").disabled =
        !isHost ||
        names.length < 2 ||
        room.status === "playing";

      if (room.status === "playing") {
        status("Match started!");

        window.dispatchEvent(
          new CustomEvent("rocket-online-start", {
            detail: {
              roomId: watchedRoomId,
              roomCode: currentRoomCode,
              players
            }
          })
        );
      } else if (names.length >= 2) {
        status("Opponent connected! Host can start the match.");
      } else if (room.quickMatch) {
        status("Searching for an opponent...");
      } else {
        status("Room created. Share your code!");
      }
    },
    error => {
      status(`Room error: ${error.message}`);
    }
  );

  const messagesRef = ref(
    database,
    `rooms/${watchedRoomId}/chat`
  );

  chatListener = onValue(
    messagesRef,
    snapshot => {
      if (currentRoomId !== watchedRoomId) return;

      const messages = snapshot.val() || {};
      const entries = Object.values(messages).slice(-35);

      $("onlineChat").innerHTML = "";

      for (const message of entries) {
        const line = document.createElement("div");
        const name = document.createElement("b");
        const content = document.createElement("span");

        name.textContent = `${message.name || "Player"}: `;
        content.textContent = message.text || "";

        line.append(name, content);
        $("onlineChat").appendChild(line);
      }

      $("onlineChat").scrollTop = $("onlineChat").scrollHeight;
    },
    error => {
      status(`Chat error: ${error.message}`);
    }
  );
}

/* ==========================================
   CREATE ROOM
   ========================================== */

async function createRoom(quickMatch = false) {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    throw new Error("Firebase sign-in is not ready.");
  }

  const code = makeCode();
  const roomRef = push(ref(database, "rooms"));
  const roomId = roomRef.key;

  const roomData = {
    code,
    host: uid,
    status: "waiting",
    quickMatch,
    createdAt: Date.now(),

    players: {
      [uid]: {
        name: playerName(),
        joinedAt: Date.now()
      }
    }
  };

  await set(roomRef, roomData);

  await onDisconnect(
    ref(database, `rooms/${roomId}/players/${uid}`)
  ).remove();

  currentRoomId = roomId;
  currentOwnRoomId = roomId;
  currentRoomCode = code;
  isHost = true;

  showRoom();
  watchRoom();

  return { roomId, code };
}

/* ==========================================
   MATCHMAKING QUEUE - FIXED
   ========================================== */

async function joinMatchmakingQueue() {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    throw new Error("You are not signed in.");
  }

  const queueRef = ref(database, "matchmaking/queue");
  const ticketRef = push(queueRef);

  currentTicketId = ticketRef.key;

  // Keep this ticket available even if the first transaction
  // snapshot does not include the earlier set() operation.
  const ticket = {
    uid,
    name: playerName(),
    status: "waiting",
    roomId: currentOwnRoomId,
    roomCode: currentRoomCode,
    createdAt: Date.now()
  };

  await set(ticketRef, ticket);
  await onDisconnect(ticketRef).remove();

  // Listen for another player matching with us.
  ticketListener = onValue(
    ticketRef,
    async snapshot => {
      if (!snapshot.exists()) return;

      const data = snapshot.val();

      if (data.status !== "paired") return;

      // The host already owns the room. It just waits
      // for the other player to join it.
      if (data.hostUid === uid) {
        status("Opponent found! Waiting for them to connect...");
        return;
      }

      if (data.joinerUid === uid && !joiningMatchedRoom) {
        joiningMatchedRoom = true;

        try {
          await enterMatchedRoom(data.roomId, data.roomCode);
        } catch (error) {
          status(`Could not join matched room: ${error.message}`);
          console.error(error);
        } finally {
          joiningMatchedRoom = false;
        }
      }
    },
    error => {
      status(`Matchmaking error: ${error.message}`);
    }
  );

  // ATOMIC MATCHMAKING TRANSACTION
  const result = await runTransaction(
    queueRef,
    queue => {
      if (!queue) queue = {};

      // FIX: Do not abort just because the ticket is missing
      // from the transaction's initial snapshot.
      const mine = queue[currentTicketId] || ticket;

      // Make sure our ticket is actually part of the queue.
      queue[currentTicketId] = mine;

      if (mine.status !== "waiting") {
        return queue;
      }

      const now = Date.now();

      // Expire old tickets.
      for (const key of Object.keys(queue)) {
        const item = queue[key];

        if (
          item &&
          item.status === "waiting" &&
          now - (item.createdAt || 0) > 120000
        ) {
          queue[key].status = "expired";
        }
      }

      // Find the oldest available opponent.
      const candidates = Object.entries(queue)
        .filter(([key, item]) =>
          key !== currentTicketId &&
          item &&
          item.uid !== uid &&
          item.status === "waiting" &&
          item.roomId &&
          now - (item.createdAt || 0) <= 120000
        )
        .sort((a, b) =>
          (a[1].createdAt || 0) -
          (b[1].createdAt || 0)
        );

      // Nobody available yet. Stay in the queue.
      if (candidates.length === 0) {
        return queue;
      }

      const [opponentTicketId, opponent] = candidates[0];

      const pairData = {
        status: "paired",
        roomId: opponent.roomId,
        roomCode: opponent.roomCode,
        hostUid: opponent.uid,
        joinerUid: uid,
        pairedAt: now
      };

      // Update both tickets in the SAME transaction.
      queue[opponentTicketId] = {
        ...opponent,
        ...pairData,
        opponentUid: uid,
        opponentName: mine.name
      };

      queue[currentTicketId] = {
        ...mine,
        ...pairData,
        opponentUid: opponent.uid,
        opponentName: opponent.name
      };

      return queue;
    }
  );

  if (!result.committed) {
    throw new Error(
      "Firebase did not save the matchmaking ticket. Check the database permissions."
    );
  }

  const updatedTicket =
    result.snapshot.val()?.[currentTicketId];

  if (updatedTicket?.status === "waiting") {
    status("Searching for an opponent... Your room is ready!");
  }
}

/* ==========================================
   ENTER MATCHED ROOM
   ========================================== */

async function enterMatchedRoom(roomId, code) {
  if (!roomId || !code) {
    throw new Error("The matchmaking room information is missing.");
  }

  const uid = auth.currentUser?.uid;

  if (!uid) {
    throw new Error("Firebase sign-in is not ready.");
  }

  status("Opponent found! Connecting...");

  const roomRef = ref(database, `rooms/${roomId}`);

  const result = await runTransaction(
    roomRef,
    room => {
      if (!room || room.status !== "waiting") return;

      room.players = room.players || {};

      if (room.players[uid]) return room;

      if (getPlayerCount(room.players) >= 2) return;

      room.players[uid] = {
        name: playerName(),
        joinedAt: Date.now()
      };

      return room;
    }
  );

  if (!result.committed) {
    throw new Error("The opponent room is no longer available.");
  }

  // Delete the temporary room we created while searching.
  if (currentOwnRoomId && currentOwnRoomId !== roomId) {
    await remove(ref(database, `rooms/${currentOwnRoomId}`));
  }

  currentRoomId = roomId;
  currentRoomCode = code;
  currentOwnRoomId = null;
  isHost = false;

  await onDisconnect(
    ref(database, `rooms/${roomId}/players/${uid}`)
  ).remove();

  showRoom();
  watchRoom();

  status("MATCH FOUND! You are connected!");
}

/* ==========================================
   QUICK MATCH
   ========================================== */

async function quickMatch() {
  if (busy) return;

  setBusy(true);
  status("Connecting to matchmaking...");

  try {
    await playerReady;

    if (currentRoomId) {
      await leaveRoom();
    }

    status("Preparing your room...");

    await createRoom(true);

    status("Searching for an opponent...");

    await joinMatchmakingQueue();

  } catch (error) {
    status(`Quick Match error: ${error.message}`);
    console.error("Quick Match error:", error);
  } finally {
    setBusy(false);
  }
}

/* ==========================================
   JOIN PRIVATE ROOM
   ========================================== */

async function joinRoom(code) {
  if (busy) return;

  code = String(code || "").toUpperCase().trim();

  if (code.length !== 6) {
    status("Enter a valid 6-character room code.");
    return;
  }

  setBusy(true);
  status("Looking for room...");

  try {
    await playerReady;

    const uid = auth.currentUser?.uid;

    if (!uid) {
      throw new Error("Firebase sign-in is not ready.");
    }

    const roomsQuery = query(
      ref(database, "rooms"),
      orderByChild("code"),
      equalTo(code)
    );

    const snapshot = await get(roomsQuery);

    if (!snapshot.exists()) {
      throw new Error("Room not found. Check the code.");
    }

    let foundId = null;

    snapshot.forEach(child => {
      foundId = child.key;
    });

    if (!foundId) {
      throw new Error("Room not found.");
    }

    const roomRef = ref(database, `rooms/${foundId}`);

    const result = await runTransaction(
      roomRef,
      room => {
        if (!room || room.status !== "waiting") return;

        room.players = room.players || {};

        if (room.players[uid]) return room;

        if (getPlayerCount(room.players) >= 2) return;

        room.players[uid] = {
          name: playerName(),
          joinedAt: Date.now()
        };

        return room;
      }
    );

    if (!result.committed) {
      throw new Error("That room is full or the match has started.");
    }

    currentRoomId = foundId;
    currentRoomCode = code;
    currentOwnRoomId = null;
    isHost = false;

    await onDisconnect(
      ref(database, `rooms/${foundId}/players/${uid}`)
    ).remove();

    showRoom();
    watchRoom();

    status("Joined room successfully!");

  } catch (error) {
    status(`Could not join room: ${error.message}`);
    console.error(error);
  } finally {
    setBusy(false);
  }
}

/* ==========================================
   CHAT
   ========================================== */

async function sendChat() {
  if (!currentRoomId) return;

  const messageText = $("onlineChatInput").value.trim();

  if (!messageText) return;

  $("onlineChatInput").value = "";

  try {
    await push(
      ref(database, `rooms/${currentRoomId}/chat`),
      {
        uid: auth.currentUser.uid,
        name: playerName(),
        text: messageText,
        sentAt: Date.now()
      }
    );
  } catch (error) {
    status(`Message failed: ${error.message}`);
  }
}

/* ==========================================
   START MATCH
   ========================================== */

async function startOnlineMatch() {
  if (!currentRoomId || !isHost) return;

  try {
    const roomRef = ref(database, `rooms/${currentRoomId}`);

    const result = await runTransaction(
      roomRef,
      room => {
        if (!room || room.status !== "waiting") return;

        if (getPlayerCount(room.players) < 2) return;

        room.status = "playing";
        room.startedAt = Date.now();

        return room;
      }
    );

    if (!result.committed) {
      status("You need two connected players before starting.");
      return;
    }

    status("Match started!");

  } catch (error) {
    status(`Could not start match: ${error.message}`);
  }
}

/* ==========================================
   LEAVE ROOM AND QUEUE
   ========================================== */

async function leaveRoom() {
  stopListeners();

  const uid = auth.currentUser?.uid;

  const oldRoomId = currentRoomId;
  const oldOwnRoomId = currentOwnRoomId;
  const oldTicketId = currentTicketId;
  const wasHost = isHost;

  currentRoomId = null;
  currentRoomCode = null;
  currentOwnRoomId = null;
  currentTicketId = null;

  isHost = false;
  joiningMatchedRoom = false;

  try {
    if (oldTicketId) {
      await remove(
        ref(database, `matchmaking/queue/${oldTicketId}`)
      );
    }

    if (oldOwnRoomId && wasHost) {
      await remove(
        ref(database, `rooms/${oldOwnRoomId}`)
      );
    } else if (oldRoomId && uid) {
      await remove(
        ref(database, `rooms/${oldRoomId}/players/${uid}`)
      );
    }
  } catch (error) {
    console.warn("Room cleanup:", error);
  }

  showHome();
  status("You left the room.");
}

/* ==========================================
   BUTTONS
   ========================================== */

$("onlineClose").addEventListener("click", closePanel);

$("quickMatchBtn").addEventListener("click", quickMatch);

$("createRoomBtn").addEventListener("click", async () => {
  if (busy) return;

  setBusy(true);

  try {
    await playerReady;

    if (currentRoomId) {
      await leaveRoom();
    }

    await createRoom(false);

  } catch (error) {
    status(`Could not create room: ${error.message}`);
    console.error(error);
  } finally {
    setBusy(false);
  }
});

$("joinRoomBtn").addEventListener("click", () => {
  joinRoom($("joinCodeInput").value);
});

$("joinCodeInput").addEventListener("input", event => {
  event.target.value = event.target.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
});

$("sendChatBtn").addEventListener("click", sendChat);

$("onlineChatInput").addEventListener("keydown", event => {
  if (event.key === "Enter") sendChat();
});

$("startOnlineBtn").addEventListener("click", startOnlineMatch);

$("leaveRoomBtn").addEventListener("click", leaveRoom);

$("copyCodeBtn").addEventListener("click", async () => {
  if (!currentRoomCode) return;

  try {
    await navigator.clipboard.writeText(currentRoomCode);
    status("Room code copied!");
  } catch (error) {
    status(`Your room code is ${currentRoomCode}`);
  }
});

/* ==========================================
   INITIALIZE
   ========================================== */

async function initializeOnline() {
  try {
    await playerReady;

    status("Connected to Firebase!");

    const button = document.createElement("button");

    button.className = "play-button";
    button.style.marginTop = "12px";
    button.innerHTML = "<span>ONLINE MULTIPLAYER</span><b>🌐</b>";

    button.addEventListener("click", openPanel);

    const playButton = document.getElementById("playBtn");

    if (playButton) {
      playButton.insertAdjacentElement("afterend", button);
    } else {
      document.body.appendChild(button);
    }

  } catch (error) {
    status(`Firebase connection failed: ${error.message}`);
    console.error(error);
  }
}

initializeOnline();

window.addEventListener("beforeunload", () => {
  stopListeners();
});
