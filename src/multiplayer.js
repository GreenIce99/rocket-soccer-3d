
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

const clientId = crypto.randomUUID
  ? crypto.randomUUID()
  : "tab_" + Date.now() + "_" + Math.random().toString(36).slice(2);

let currentRoomId = null;
let currentRoomCode = null;
let isHost = false;

let currentTicketId = null;
let searching = false;
let enteringRoom = false;
let busy = false;
let autoStartedRoomId = null;
let connectingRoomId = null;

let roomListener = null;
let chatListener = null;
let ticketListener = null;
let heartbeat = null;

const $ = id => document.getElementById(id);

function playerName() {
  return $("onlinePlayerName")?.value.trim().slice(0, 18) || "Player";
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function status(message) {
  const element = $("onlineStatus");
  if (element) element.textContent = message;
}

function setBusy(value) {
  busy = value;

  ["onlineQuickMatch", "onlineCreateRoom", "onlineJoinRoom"].forEach(id => {
    const button = $(id);
    if (button) button.disabled = value;
  });
}

function showHome() {
  $("onlineHome").style.display = "block";
  $("onlineRoom").style.display = "none";
}

function showRoom() {
  $("onlineHome").style.display = "none";
  $("onlineRoom").style.display = "block";
  $("onlineRoomCode").textContent = currentRoomCode || "------";
}

function stopRoomListeners() {
  if (roomListener) roomListener();
  if (chatListener) chatListener();

  roomListener = null;
  chatListener = null;
}

function stopQueueListener() {
  if (ticketListener) ticketListener();
  ticketListener = null;

  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

function addStyles() {
  if ($("rocketOnlineStyles")) return;

  const style = document.createElement("style");
  style.id = "rocketOnlineStyles";

  style.textContent = `
    #rocketOnlinePanel {
      width:min(92%,650px);
      margin:20px auto;
      padding:22px;
      box-sizing:border-box;
      border-radius:17px;
      background:linear-gradient(145deg,#101d35,#172b4c);
      border:1px solid rgba(100,180,255,.3);
      color:white;
      font-family:Arial,sans-serif;
      box-shadow:0 12px 35px rgba(0,0,0,.35);
    }

    #rocketOnlinePanel {
      position:fixed !important;
      z-index:10000 !important;
      top:50% !important;
      left:50% !important;
      transform:translate(-50%,-50%) !important;
      width:min(92vw,650px) !important;
      max-height:88vh;
      overflow-y:auto;
      margin:0 !important;
      display:none;
      border:1px solid rgba(91,190,255,.45);
      background:linear-gradient(145deg,rgba(7,18,36,.98),rgba(13,37,65,.98));
      box-shadow:0 0 0 100vmax rgba(1,6,15,.78),0 25px 90px rgba(0,0,0,.65);
      backdrop-filter:blur(18px);
    }

    #onlineMenuButton {
      min-width:115px;
      padding:12px 17px;
      margin:15px 0 0 10px;
      border:1px solid rgba(75,190,255,.65);
      border-radius:7px;
      color:#eaf7ff;
      background:linear-gradient(135deg,rgba(13,88,150,.9),rgba(8,43,83,.95));
      box-shadow:0 5px 22px rgba(0,130,255,.18);
      font-family:'Orbitron',sans-serif;
      font-size:10px;
      font-weight:800;
      letter-spacing:1px;
      cursor:pointer;
      transition:transform .2s ease,filter .2s ease,box-shadow .2s ease;
    }

    #onlineMenuButton:hover {
      transform:translateY(-2px);
      filter:brightness(1.2);
      box-shadow:0 8px 28px rgba(0,150,255,.35);
    }

    #onlineClose {
      position:absolute;
      top:13px;
      right:13px;
      width:34px;
      height:34px;
      padding:0;
      border:1px solid rgba(255,255,255,.2);
      border-radius:8px;
      color:white;
      background:rgba(255,255,255,.08);
      font-size:20px;
      cursor:pointer;
    }

    #rocketOnlinePanel * {
      box-sizing:border-box;
    }

    #rocketOnlinePanel h2 {
      text-align:center;
      margin:0 0 8px;
      font-size:25px;
    }

    #rocketOnlinePanel .onlineSubtitle {
      text-align:center;
      color:#b9c9df;
      margin-bottom:20px;
    }

    #rocketOnlinePanel input {
      width:100%;
      padding:13px;
      margin:7px 0;
      border:1px solid #49678c;
      border-radius:9px;
      background:#0b1628;
      color:white;
      font-size:16px;
    }

    #rocketOnlinePanel button {
      border:0;
      border-radius:9px;
      padding:13px 16px;
      font-size:14px;
      font-weight:bold;
      cursor:pointer;
    }

    #rocketOnlinePanel button:disabled {
      opacity:.5;
      cursor:not-allowed;
    }

    .onlinePrimary {
      width:100%;
      color:white;
      background:linear-gradient(90deg,#087cff,#00b8ff);
      margin-top:9px;
    }

    .onlineSecondary {
      color:white;
      background:#304866;
      flex:1;
    }

    .onlineGreen {
      color:white;
      background:#159b68;
      flex:1;
    }

    .onlineRed {
      color:white;
      background:#b83242;
      flex:1;
    }

    .onlineButtonRow {
      display:flex;
      gap:9px;
      margin-top:10px;
    }

    #onlineStatus {
      margin-top:15px;
      padding:12px;
      border-radius:9px;
      text-align:center;
      background:rgba(0,0,0,.22);
      color:#d6e6ff;
      min-height:42px;
      font-size:14px;
    }

    #onlineRoomCode {
      text-align:center;
      font-size:34px;
      font-weight:900;
      letter-spacing:7px;
      color:#65c5ff;
      padding:13px;
      background:#09172b;
      border-radius:12px;
      margin:12px 0;
    }

    #onlinePlayerList {
      background:rgba(0,0,0,.2);
      border-radius:10px;
      padding:12px;
      margin:12px 0;
      line-height:2;
    }

    #onlineChatMessages {
      height:130px;
      overflow-y:auto;
      background:#09172b;
      border-radius:9px;
      padding:10px;
      margin:10px 0;
      font-size:13px;
    }

    .onlineChatMessage {
      padding:4px 0;
      overflow-wrap:anywhere;
    }

    .onlineSmall {
      color:#9fb3cc;
      font-size:12px;
      text-align:center;
      margin-top:12px;
    }
  `;

  document.head.appendChild(style);
}

function createPanel() {
  if ($("rocketOnlinePanel")) return;

  addStyles();

  const panel = document.createElement("section");
  panel.id = "rocketOnlinePanel";

  panel.innerHTML = `
    <button id="onlineClose" aria-label="Close online menu">×</button>
    <h2>🌐 ONLINE PLAY</h2>

    <div class="onlineSubtitle">
      Play Rocket Soccer with a friend.
    </div>

    <div id="onlineHome">
      <input id="onlinePlayerName" maxlength="18"
        placeholder="Enter your player name" value="Player">

      <button id="onlineQuickMatch" class="onlinePrimary">
        ⚡ QUICK MATCH
      </button>

      <button id="onlineCancelSearch" class="onlinePrimary"
        style="display:none;background:#a63342">
        CANCEL SEARCH
      </button>

      <button id="onlineCreateRoom" class="onlineSecondary"
        style="width:100%;margin-top:9px">
        CREATE PRIVATE ROOM
      </button>

      <div style="text-align:center;margin:18px 0;color:#9fb3cc">
        OR JOIN A FRIEND
      </div>

      <input id="onlineJoinCode" maxlength="6"
        placeholder="ENTER ROOM CODE">

      <button id="onlineJoinRoom" class="onlinePrimary">
        JOIN ROOM
      </button>

      <div id="onlineStatus">
        Connecting to Firebase...
      </div>

      <div class="onlineSmall">
        Quick Match finds another waiting player automatically.
      </div>
    </div>

    <div id="onlineRoom" style="display:none">
      <div style="text-align:center;font-size:13px;color:#b9c9df">
        YOUR ROOM CODE
      </div>

      <div id="onlineRoomCode">------</div>

      <div id="onlinePlayerList">
        Waiting for an opponent...
      </div>

      <div class="onlineButtonRow">
        <button id="onlineCopy" class="onlineSecondary">COPY ROOM CODE</button>
        <button id="onlineStart" class="onlineGreen">START MATCH</button>
        <button id="onlineLeave" class="onlineRed">LEAVE ROOM</button>
      </div>

      <div style="margin-top:18px;font-weight:bold">ROOM CHAT</div>
      <div id="onlineChatMessages"></div>

      <div class="onlineButtonRow">
        <input id="onlineChatInput" placeholder="Type a message..." maxlength="180">
        <button id="onlineSend" class="onlineSecondary">SEND</button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  const onlineMenuButton = document.createElement("button");
  onlineMenuButton.id = "onlineMenuButton";
  onlineMenuButton.type = "button";
  onlineMenuButton.textContent = "ONLINE PLAY";

  onlineMenuButton.addEventListener("click", () => {
    panel.style.display = "block";
    status("Connected to Firebase. Choose a game mode.");
  });

  const menuActions = document.querySelector(".menu-actions");
  const playButton = $("playBtn");

  if (menuActions) {
    menuActions.appendChild(onlineMenuButton);
  } else if (playButton?.parentElement) {
    playButton.insertAdjacentElement("afterend", onlineMenuButton);
  } else {
    document.body.appendChild(onlineMenuButton);
  }

  $("onlineClose").onclick = () => {
    if (searching) {
      status("Cancel your search before closing the online menu.");
      return;
    }

    panel.style.display = "none";
  };

  $("onlineQuickMatch").onclick = quickMatch;
  $("onlineCancelSearch").onclick = cancelSearch;
  $("onlineCreateRoom").onclick = createPrivateRoom;
  $("onlineJoinRoom").onclick = () => joinRoom($("onlineJoinCode").value);
  $("onlineLeave").onclick = leaveRoom;
  $("onlineStart").onclick = startMatch;
  $("onlineSend").onclick = sendChat;
  $("onlineCopy").onclick = copyRoomCode;

  $("onlineChatInput").addEventListener("keydown", event => {
    if (event.key === "Enter") sendChat();
  });

  $("onlineJoinCode").addEventListener("input", event => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });
}

async function openRoom(roomId, roomData) {
  if (!roomId || !roomData) {
    throw new Error("Room information is missing.");
  }

  currentRoomId = roomId;
  currentRoomCode = roomData.code;
  isHost = roomData.host === clientId;
  autoStartedRoomId = null;

  const playerRef = ref(database, `rooms/${roomId}/players/${clientId}`);
  await onDisconnect(playerRef).remove();

  showRoom();
  watchRoom();

  status("Connected to room!");
}

function watchRoom() {
  stopRoomListeners();

  const roomRef = ref(database, `rooms/${currentRoomId}`);

  roomListener = onValue(roomRef, snapshot => {
    const room = snapshot.val();

    if (!room) {
      status("This room no longer exists.");
      currentRoomId = null;
      currentRoomCode = null;
      showHome();
      return;
    }

    const players = room.players || {};
    const entries = Object.entries(players);

    $("onlineRoomCode").textContent = room.code;
    $("onlinePlayerList").innerHTML = "";

    entries.forEach(([id, player], index) => {
      const line = document.createElement("div");

      line.textContent =
        `🚗 ${player.name || `Player ${index + 1}`}` +
        (id === clientId ? " (YOU)" : "");

      $("onlinePlayerList").appendChild(line);
    });

    isHost = room.host === clientId;

    const startButton = $("onlineStart");

    startButton.disabled =
      !isHost || entries.length !== 2 || room.status === "playing";

    startButton.textContent = isHost ? "START MATCH" : "WAITING FOR HOST";

    if (room.status === "playing") {
      status("MATCH FOUND! Starting the online game...");

      if (autoStartedRoomId !== currentRoomId) {
        autoStartedRoomId = currentRoomId;

        window.dispatchEvent(
          new CustomEvent("rocket-online-start", {
            detail: {
              roomId: currentRoomId,
              roomCode: room.code,
              players,
              playerId: clientId,
              isHost: room.host === clientId,
              startedAt: room.startedAt || Date.now()
            }
          })
        );
      }
    } else if (entries.length === 2) {
      status("Opponent connected! Ready to play.");
    } else {
      status("Waiting for an opponent...");
    }
  });

  const chatRef = ref(database, `rooms/${currentRoomId}/messages`);

  chatListener = onValue(chatRef, snapshot => {
    const messages = snapshot.val() || {};
    const output = $("onlineChatMessages");

    output.innerHTML = "";

    Object.values(messages)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .slice(-30)
      .forEach(message => {
        const line = document.createElement("div");
        line.className = "onlineChatMessage";

        const name = document.createElement("strong");
        name.textContent = (message.name || "Player") + ": ";

        const text = document.createElement("span");
        text.textContent = message.text || "";

        line.append(name, text);
        output.appendChild(line);
      });

    output.scrollTop = output.scrollHeight;
  });
}

/* QUICK MATCH */

async function quickMatch() {
  if (busy || searching || currentRoomId) return;

  setBusy(true);
  status("Connecting to matchmaking...");

  try {
    await playerReady;

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Firebase sign-in failed.");

    searching = true;

    const queueRef = ref(database, "matchmaking/queue");
    const ticketRef = push(queueRef);

    currentTicketId = ticketRef.key;

    const ticket = {
      clientId,
      uid,
      name: playerName(),
      status: "waiting",
      createdAt: Date.now(),
      lastSeen: Date.now()
    };

    await set(ticketRef, ticket);
    await onDisconnect(ticketRef).remove();

    ticketListener = onValue(ticketRef, async snapshot => {
      const entry = snapshot.val();

      if (!entry || entry.status !== "paired") return;
      if (enteringRoom || currentRoomId) return;

      enteringRoom = true;

      try {
        await connectToPair(entry);
      } catch (error) {
        console.error("Pair connection failed:", error);
        status("Could not connect to match: " + error.message);
        enteringRoom = false;
      }
    });

    status("Searching for an opponent...");
    $("onlineCancelSearch").style.display = "block";

    heartbeat = setInterval(() => {
      if (!searching || !currentTicketId) return;

      update(
        ref(database, `matchmaking/queue/${currentTicketId}`),
        { lastSeen: Date.now() }
      ).catch(error => console.warn("Queue heartbeat:", error));
    }, 10000);

    const roomId = push(ref(database, "rooms")).key;
    const roomCode = makeCode();
    const now = Date.now();

    const result = await runTransaction(queueRef, queue => {
      queue = queue || {};

      const mine = queue[currentTicketId] || ticket;
      queue[currentTicketId] = mine;

      if (mine.status === "paired") return queue;

      for (const [id, item] of Object.entries(queue)) {
        if (
          item &&
          item.status === "waiting" &&
          now - (item.lastSeen || item.createdAt || 0) > 45000
        ) {
          delete queue[id];
        }
      }

      const candidate = Object.entries(queue).find(([id, item]) =>
        id !== currentTicketId &&
        item &&
        item.clientId !== clientId &&
        item.status === "waiting" &&
        now - (item.lastSeen || item.createdAt || 0) <= 45000
      );

      if (!candidate) {
        queue[currentTicketId] = {
          ...mine,
          status: "waiting",
          lastSeen: now
        };

        return queue;
      }

      const [otherTicketId, other] = candidate;
      const hostId = other.clientId;

      const roomData = {
        code: roomCode,
        host: hostId,
        status: "waiting",
        quickMatch: true,
        createdAt: now,
        players: {
          [hostId]: {
            name: other.name || "Player 1",
            uid: other.uid || "",
            joinedAt: other.createdAt || now
          },
          [clientId]: {
            name: mine.name || "Player 2",
            uid,
            joinedAt: now
          }
        }
      };

      const pairing = {
        status: "paired",
        roomId,
        roomCode,
        hostId,
        pairedAt: now,
        roomData
      };

      queue[otherTicketId] = { ...other, ...pairing };
      queue[currentTicketId] = { ...mine, ...pairing };

      return queue;
    });

    if (!result.committed) {
      throw new Error("Firebase did not save the matchmaking queue.");
    }

    const myEntry = result.snapshot.val()?.[currentTicketId];

    if (myEntry?.status === "paired") {
      if (!enteringRoom && !currentRoomId) {
        enteringRoom = true;
        await connectToPair(myEntry);
      }
    } else {
      status("Searching for an opponent... Keep this tab open!");
    }

  } catch (error) {
    console.error("Quick Match failed:", error);
    status("Quick Match error: " + error.message);
    stopQueue();
  } finally {
    setBusy(false);
  }
}

async function connectToPair(entry) {
  if (!entry.roomId || !entry.roomData) {
    throw new Error("The match assignment is incomplete.");
  }

  if (currentRoomId === entry.roomId) return;
  if (connectingRoomId === entry.roomId) return;

  connectingRoomId = entry.roomId;

  try {
    status("Opponent found! Connecting...");

    const roomRef = ref(database, `rooms/${entry.roomId}`);

    const result = await runTransaction(roomRef, existingRoom => {
      return existingRoom || entry.roomData;
    });

    if (!result.snapshot.exists()) {
      throw new Error("The matched room could not be created.");
    }

    let room = result.snapshot.val();

    if (!room.players?.[clientId]) {
      throw new Error("Your player is missing from the matched room.");
    }

    if (room.quickMatch && room.status === "waiting") {
      const startResult = await runTransaction(roomRef, latestRoom => {
        if (!latestRoom) return;

        if (
          latestRoom.status === "waiting" &&
          latestRoom.quickMatch &&
          Object.keys(latestRoom.players || {}).length === 2
        ) {
          latestRoom.status = "playing";
          latestRoom.startedAt = Date.now();
        }

        return latestRoom;
      });

      if (startResult.snapshot.exists()) {
        room = startResult.snapshot.val();
      }
    }

    stopQueue();

    await openRoom(entry.roomId, room);

    if (currentTicketId) {
      await remove(
        ref(database, `matchmaking/queue/${currentTicketId}`)
      ).catch(() => {});
    }

    currentTicketId = null;
    status("MATCH FOUND! You're connected!");

  } finally {
    connectingRoomId = null;
  }
}

async function cancelSearch() {
  stopQueue();

  if (currentTicketId) {
    await remove(
      ref(database, `matchmaking/queue/${currentTicketId}`)
    ).catch(() => {});
  }

  currentTicketId = null;
  searching = false;
  enteringRoom = false;

  $("onlineCancelSearch").style.display = "none";

  setBusy(false);
  status("Search cancelled.");
}

function stopQueue() {
  searching = false;
  stopQueueListener();

  const cancelButton = $("onlineCancelSearch");
  if (cancelButton) cancelButton.style.display = "none";
}

/* PRIVATE ROOMS */

async function createPrivateRoom() {
  if (busy || currentRoomId) return;

  setBusy(true);

  try {
    await playerReady;

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Firebase sign-in failed.");

    const roomRef = push(ref(database, "rooms"));
    const roomId = roomRef.key;
    const code = makeCode();

    const roomData = {
      code,
      host: clientId,
      status: "waiting",
      quickMatch: false,
      createdAt: Date.now(),
      players: {
        [clientId]: {
          name: playerName(),
          uid,
          joinedAt: Date.now()
        }
      }
    };

    await set(roomRef, roomData);
    await openRoom(roomId, roomData);

    status("Private room created. Share your code!");

  } catch (error) {
    status("Could not create room: " + error.message);
    console.error(error);
  } finally {
    setBusy(false);
  }
}

async function joinRoom(code) {
  if (busy || currentRoomId) return;

  code = String(code || "").trim().toUpperCase();

  if (code.length !== 6) {
    status("Enter a valid 6-character room code.");
    return;
  }

  setBusy(true);

  try {
    await playerReady;

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Firebase sign-in failed.");

    const roomQuery = query(
      ref(database, "rooms"),
      orderByChild("code"),
      equalTo(code)
    );

    const snapshot = await get(roomQuery);

    if (!snapshot.exists()) {
      throw new Error("Room not found. Check the code.");
    }

    let roomId = null;

    snapshot.forEach(child => {
      if (!roomId) roomId = child.key;
    });

    const roomRef = ref(database, `rooms/${roomId}`);

    const result = await runTransaction(roomRef, room => {
      if (!room || room.status !== "waiting") return;

      room.players = room.players || {};

      if (room.players[clientId]) return room;
      if (Object.keys(room.players).length >= 2) return;

      room.players[clientId] = {
        name: playerName(),
        uid,
        joinedAt: Date.now()
      };

      return room;
    });

    if (!result.committed) {
      throw new Error("Room is full or the match has started.");
    }

    const room = result.snapshot.val();

    await openRoom(roomId, room);
    status("Joined room successfully!");

  } catch (error) {
    status("Could not join room: " + error.message);
    console.error(error);
  } finally {
    setBusy(false);
  }
}

async function startMatch() {
  if (!currentRoomId || !isHost) return;

  try {
    const roomRef = ref(database, `rooms/${currentRoomId}`);

    const result = await runTransaction(roomRef, room => {
      if (!room || room.host !== clientId) return;
      if (room.status !== "waiting") return;
      if (Object.keys(room.players || {}).length !== 2) return;

      room.status = "playing";
      room.startedAt = Date.now();

      return room;
    });

    if (!result.committed) {
      status("You need two players before starting.");
      return;
    }

    status("Match starting!");

  } catch (error) {
    status("Could not start match: " + error.message);
  }
}

/* CHAT */

async function sendChat() {
  if (!currentRoomId) return;

  const input = $("onlineChatInput");
  const message = input.value.trim();

  if (!message) return;

  input.value = "";

  try {
    await push(
      ref(database, `rooms/${currentRoomId}/messages`),
      {
        name: playerName(),
        text: message,
        timestamp: Date.now(),
        sender: clientId
      }
    );
  } catch (error) {
    status("Message could not be sent: " + error.message);
  }
}

async function copyRoomCode() {
  if (!currentRoomCode) return;

  try {
    await navigator.clipboard.writeText(currentRoomCode);
    status("Room code copied!");
  } catch {
    status("Your room code is: " + currentRoomCode);
  }
}

async function leaveRoom() {
  stopRoomListeners();
  stopQueue();

  const oldRoomId = currentRoomId;

  currentRoomId = null;
  currentRoomCode = null;
  currentTicketId = null;
  isHost = false;
  enteringRoom = false;
  autoStartedRoomId = null;

  if (oldRoomId) {
    try {
      const roomRef = ref(database, `rooms/${oldRoomId}`);

      await runTransaction(roomRef, room => {
        if (!room) return;

        room.players = room.players || {};
        delete room.players[clientId];

        const remaining = Object.keys(room.players);

        if (remaining.length === 0) return null;

        if (room.host === clientId) {
          room.host = remaining[0];
        }

        return room;
      });
    } catch (error) {
      console.warn("Room cleanup failed:", error);
    }
  }

  showHome();
  setBusy(false);
  status("You left the room.");

  window.dispatchEvent(new CustomEvent("rocket-online-leave"));
}

/* INITIALIZE */

async function initialize() {
  try {
    await playerReady;

    createPanel();

    status("Connected to Firebase. Ready to play!");

    console.log("Rocket Soccer multiplayer ready.");
    console.log("Unique tab player ID:", clientId);

  } catch (error) {
    console.error("Multiplayer initialization error:", error);
    createPanel();
    status("Firebase connection error: " + error.message);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
