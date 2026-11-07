import * as THREE from 'three';
import './style.css';
import { auth, database, playerReady } from './firebase.js';
import { ref, get, set, onValue } from 'firebase/database';

const $ = (id) => document.getElementById(id);

const ui = {
  blueScore: $('blueScore'),
  orangeScore: $('orangeScore'),
  timer: $('timer'),
  boostFill: $('boostFill'),
  boostValue: $('boostValue'),
  matchStatus: $('matchStatus'),
  gameMessage: $('gameMessage'),
  mainMenu: $('mainMenu'),
  pauseMenu: $('pauseMenu'),
  endMenu: $('endMenu'),
  endTitle: $('endTitle'),
  endScore: $('endScore')
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07101e);
scene.fog = new THREE.Fog(0x07101e, 48, 115);

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  250
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
$('game').prepend(renderer.domElement);

const clock = new THREE.Clock();

scene.add(new THREE.HemisphereLight(0x9ecbff, 0x26334a, 2.1));

const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(-12, 28, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
scene.add(sun);

const blueLight = new THREE.PointLight(0x168cff, 90, 32);
blueLight.position.set(-18, 7, 0);
scene.add(blueLight);

const orangeLight = new THREE.PointLight(0xff792c, 90, 32);
orangeLight.position.set(18, 7, 0);
scene.add(orangeLight);

const materials = {
  field: new THREE.MeshStandardMaterial({ color: 0x17633e, roughness: 0.88 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x101b2b, roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe9f3ff, roughness: 0.65 }),
  ball: new THREE.MeshStandardMaterial({ color: 0xf5f7fc, roughness: 0.42 }),
  black: new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.65 })
};

const arena = new THREE.Group();
scene.add(arena);

function box(parent, w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  return mesh;
}

function cylinder(parent, radius, length, material, x, y, z, rotationZ = 0) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 24),
    material
  );

  mesh.position.set(x, y, z);
  mesh.rotation.z = rotationZ;
  mesh.castShadow = true;
  parent.add(mesh);

  return mesh;
}

// STADIUM FLOOR
box(arena, 80, 1, 52, materials.dark, 0, -0.75, 0);
box(arena, 64, 0.35, 40, materials.field, 0, -0.05, 0);

// FIELD MARKINGS
const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xc7f4dd });

box(arena, 0.12, 0.025, 40, lineMaterial, 0, 0.14, 0);
box(arena, 64, 0.025, 0.12, lineMaterial, 0, 0.14, -20);
box(arena, 64, 0.025, 0.12, lineMaterial, 0, 0.14, 20);

const centerCircle = new THREE.Mesh(
  new THREE.TorusGeometry(5, 0.09, 8, 80),
  lineMaterial
);

centerCircle.rotation.x = Math.PI / 2;
centerCircle.position.y = 0.16;
arena.add(centerCircle);

// WALLS
const wallMat = new THREE.MeshStandardMaterial({
  color: 0x172a42,
  metalness: 0.25,
  roughness: 0.65
});

box(arena, 66, 4, 1, wallMat, 0, 1.7, -20.7);
box(arena, 66, 4, 1, wallMat, 0, 1.7, 20.7);
box(arena, 1, 4, 42, wallMat, -32.5, 1.7, 0);
box(arena, 1, 4, 42, wallMat, 32.5, 1.7, 0);

// STADIUM STANDS
const standMat = new THREE.MeshStandardMaterial({
  color: 0x243750,
  roughness: 0.9
});

box(arena, 76, 7, 5, standMat, 0, 4.8, -25);
box(arena, 76, 7, 5, standMat, 0, 4.8, 25);
box(arena, 5, 7, 48, standMat, -37, 4.8, 0);
box(arena, 5, 7, 48, standMat, 37, 4.8, 0);

// STADIUM LIGHTS
for (const x of [-27, -9, 9, 27]) {
  for (const z of [-25, 25]) {
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x52647b,
      metalness: 0.7
    });

    cylinder(arena, 0.16, 10, poleMat, x, 8, z);

    const lamp = new THREE.PointLight(0xffffff, 75, 28);
    lamp.position.set(x, 13, z);
    scene.add(lamp);

    box(arena, 1.8, 0.25, 0.7, materials.white, x, 13, z);
  }
}

// GOALS
function createGoal(x, color) {
  const group = new THREE.Group();
  arena.add(group);

  const frameMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.5,
    roughness: 0.35,
    emissive: color,
    emissiveIntensity: 0.3
  });

  const goalX = x < 0 ? -34 : 34;
  const direction = x < 0 ? 1 : -1;

  box(group, 0.55, 5, 13, frameMat, goalX, 2.4, 0);
  box(group, 4.5, 0.55, 13, frameMat, goalX + direction * 2, 5, 0);
  box(group, 4.5, 5, 0.45, frameMat, goalX + direction * 2, 2.4, -6.3);
  box(group, 4.5, 5, 0.45, frameMat, goalX + direction * 2, 2.4, 6.3);

  const netMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.13,
    wireframe: true
  });

  const net = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4.5, 12),
    netMat
  );

  net.position.set(goalX + direction * 2, 2.4, 0);
  group.add(net);

  return group;
}

createGoal(-1, 0x168cff);
createGoal(1, 0xff792c);

for (const x of [-32, 32]) {
  box(arena, 0.15, 0.035, 13, materials.white, x, 0.17, 0);
}

// BALL
const ballGroup = new THREE.Group();
scene.add(ballGroup);

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(1.15, 32, 24),
  materials.ball
);

ball.castShadow = true;
ball.receiveShadow = true;
ballGroup.add(ball);

const patchMat = new THREE.MeshStandardMaterial({
  color: 0x26334a,
  roughness: 0.7
});

for (let i = 0; i < 5; i++) {
  const patch = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 5, 5),
    patchMat
  );

  const angle = (i / 5) * Math.PI * 2;

  patch.position.set(
    Math.cos(angle) * 0.84,
    0.15,
    Math.sin(angle) * 0.84
  );

  patch.scale.set(1, 0.8, 0.35);
  patch.lookAt(0, 0, 0);
  ballGroup.add(patch);
}

let ballVelocity = new THREE.Vector3();
ballGroup.position.set(0, 1.2, 0);

// CARS
function createCar(color) {
  const root = new THREE.Group();
  scene.add(root);

  const paint = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.5,
    roughness: 0.3
  });

  const darkPaint = new THREE.MeshStandardMaterial({
    color: 0x101827,
    metalness: 0.25,
    roughness: 0.5
  });

  const glass = new THREE.MeshStandardMaterial({
    color: 0x142c43,
    metalness: 0.65,
    roughness: 0.15
  });

  box(root, 2.5, 0.65, 4.1, paint, 0, 0.85, 0);
  box(root, 1.9, 0.8, 2.0, glass, 0, 1.45, -0.25);
  box(root, 2.35, 0.18, 0.65, darkPaint, 0, 0.65, -1.7);
  box(root, 2.1, 0.12, 0.6, darkPaint, 0, 1.35, 1.55);

  const wheels = [];

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x111722,
    roughness: 0.8
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x9aadc2,
    metalness: 0.8,
    roughness: 0.3
  });

  for (const x of [-1.2, 1.2]) {
    for (const z of [-1.25, 1.25]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.48, 0.32, 20),
        wheelMat
      );

      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.5, z);
      wheel.castShadow = true;
      root.add(wheel);
      wheels.push(wheel);

      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.34, 16),
        rimMat
      );

      rim.rotation.z = Math.PI / 2;
      rim.position.copy(wheel.position);
      root.add(rim);
    }
  }

  const headMat = new THREE.MeshBasicMaterial({ color: 0xdaf4ff });

  for (const x of [-0.85, 0.85]) {
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.16, 0.12),
      headMat
    );

    head.position.set(x, 0.92, -2.07);
    root.add(head);
  }

  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff392f });

  for (const x of [-0.85, 0.85]) {
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.13, 0.12),
      tailMat
    );

    tail.position.set(x, 0.92, 2.07);
    root.add(tail);
  }

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x55caff,
    transparent: true,
    opacity: 0.9
  });

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.38, 1.5, 12),
    flameMat
  );

  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.8, 2.65);
  flame.visible = false;
  root.add(flame);

  const underglow = new THREE.PointLight(color, 14, 5);
  underglow.position.set(0, 0.35, 0);
  root.add(underglow);

  root.userData = {
    wheels,
    flame,
    speed: 0,
    verticalSpeed: 0,
    grounded: true,
    boost: 100,
    velocity: new THREE.Vector3(),
    yaw: 0,
    underglow
  };

  return root;
}

const player = createCar(0x168cff);
const rival = createCar(0xff792c);

player.position.set(-13, 0, 0);
rival.position.set(13, 0, 0);

player.userData.yaw = -Math.PI / 2;
rival.userData.yaw = Math.PI / 2;

player.rotation.y = player.userData.yaw;
rival.rotation.y = rival.userData.yaw;

function setCarTeamColor(car, color) {
  car.traverse((obj) => {
    if (obj.isMesh && obj.material && obj.material.color) {
      if (
        obj.material.metalness > 0.3 &&
        obj.material.color.getHex() !== 0x9aadc2
      ) {
        obj.material.color.set(color);
      }
    }
  });

  car.userData.underglow.color.set(color);
}

function setPlayerColor(color) {
  if (onlineSession) return;
  setCarTeamColor(player, color);
}

function enforceOnlineTeamColors() {
  setCarTeamColor(player, 0x168cff);
  setCarTeamColor(rival, 0xff792c);
}

// INPUT
const keys = {};

let gameState = 'menu';
let timeLeft = 180;
let blueScore = 0;
let orangeScore = 0;
let countdown = 0;
let cameraMode = 0;
let selectedColor = '#168cff';

// ONLINE MATCH STATE
let onlineSession = null;
let onlineStartPending = false;

let remoteInput = {
  throttle: 0,
  steer: 0,
  braking: false,
  boosting: false,
  jump: false,
  sentAt: 0
};

let onlineInputUnsubscribe = null;
let onlineStateUnsubscribe = null;
let onlineLastSend = 0;
let onlineLastJump = false;
let onlineLastSnapshot = 0;
let controlledCar = player;

function getLocalInput() {
  return {
    throttle:
      (keys.w || keys.arrowup ? 1 : 0) +
      (keys.s ? -1 : 0),

    steer:
      (keys.a || keys.arrowleft ? 1 : 0) +
      (keys.d || keys.arrowright ? -1 : 0),

    braking: !!keys.arrowdown,
    boosting: !!keys.shift,
    jump: !!keys[' '],
    sentAt: Date.now()
  };
}

function setCarFromSnapshot(car, state) {
  if (!state || !car) return;

  car.position.set(state.x || 0, state.y || 0, state.z || 0);
  car.rotation.y = state.yaw || 0;
  car.userData.yaw = state.yaw || 0;
  car.userData.speed = state.speed || 0;
  car.userData.verticalSpeed = state.verticalSpeed || 0;
  car.userData.grounded = !!state.grounded;

  car.userData.boost = Number.isFinite(state.boost)
    ? state.boost
    : 100;

  if (state.vx !== undefined) {
    car.userData.velocity.set(
      state.vx || 0,
      state.vy || 0,
      state.vz || 0
    );
  }

  car.userData.flame.visible = !!state.boosting;
}

function carSnapshot(car, boosting = false) {
  return {
    x: car.position.x,
    y: car.position.y,
    z: car.position.z,
    yaw: car.userData.yaw,
    speed: car.userData.speed,
    verticalSpeed: car.userData.verticalSpeed,
    grounded: car.userData.grounded,
    boost: car.userData.boost,
    vx: car.userData.velocity.x,
    vy: car.userData.velocity.y,
    vz: car.userData.velocity.z,
    boosting
  };
}

function applyOnlineSnapshot(state) {
  if (!state || !onlineSession || onlineSession.isHost) return;

  setCarFromSnapshot(player, state.blue);
  setCarFromSnapshot(rival, state.orange);

  ui.boostFill.style.width = `${rival.userData.boost}%`;
  ui.boostValue.textContent = Math.round(rival.userData.boost);

  if (state.ball) {
    ballGroup.position.set(
      state.ball.x,
      state.ball.y,
      state.ball.z
    );

    ballVelocity.set(
      state.ball.vx || 0,
      state.ball.vy || 0,
      state.ball.vz || 0
    );
  }

  if (Number.isFinite(state.blueScore)) {
    blueScore = state.blueScore;
  }

  if (Number.isFinite(state.orangeScore)) {
    orangeScore = state.orangeScore;
  }

  if (Number.isFinite(state.timeLeft)) {
    timeLeft = state.timeLeft;
  }

  if (Number.isFinite(state.countdown)) {
    countdown = state.countdown;
  }

  if (state.gameState) {
    gameState = state.gameState;

    if (gameState === 'ended') {
      ui.endMenu.classList.remove('hidden');

      ui.endTitle.textContent = blueScore > orangeScore
        ? 'BLUE WINS!'
        : blueScore < orangeScore
          ? 'ORANGE WINS!'
          : 'IT’S A DRAW!';

      ui.endScore.textContent = `${blueScore} - ${orangeScore}`;
    } else {
      ui.endMenu.classList.add('hidden');
    }
  }

  updateScore();
}

async function publishOnlineSnapshot() {
  if (!onlineSession?.isHost || !onlineSession.roomId) return;

  const now = performance.now();

  if (now - onlineLastSnapshot < 45) return;
  onlineLastSnapshot = now;

  const snapshot = {
    blue: carSnapshot(player, !!keys.shift),
    orange: carSnapshot(rival, !!remoteInput.boosting),

    ball: {
      x: ballGroup.position.x,
      y: ballGroup.position.y,
      z: ballGroup.position.z,
      vx: ballVelocity.x,
      vy: ballVelocity.y,
      vz: ballVelocity.z
    },

    blueScore,
    orangeScore,
    timeLeft,
    countdown,
    gameState,
    sentAt: Date.now()
  };

  try {
    await set(
      ref(database, `rooms/${onlineSession.roomId}/gameState`),
      snapshot
    );
  } catch (error) {
    console.warn('Online state sync failed:', error);
  }
}

async function sendOnlineInput() {
  if (!onlineSession || onlineSession.isHost || !onlineSession.roomId) {
    return;
  }

  const now = performance.now();

  if (now - onlineLastSend < 45) return;
  onlineLastSend = now;

  const input = getLocalInput();
  const risingJump = input.jump && !onlineLastJump;
  onlineLastJump = input.jump;

  try {
    await set(
      ref(
        database,
        `rooms/${onlineSession.roomId}/inputs/${onlineSession.playerId}`
      ),
      {
        ...input,
        jump: risingJump,
        sentAt: Date.now()
      }
    );
  } catch (error) {
    console.warn('Online input sync failed:', error);
  }
}

async function beginOnlineSession(detail) {
  onlineStartPending = true;

  try {
    await playerReady;

    const roomId = detail?.roomId;

    if (!roomId) {
      throw new Error('Online room ID is missing.');
    }

    const roomSnapshot = await get(
      ref(database, `rooms/${roomId}`)
    );

    if (!roomSnapshot.exists()) {
      throw new Error('Online room no longer exists.');
    }

    const room = roomSnapshot.val();
    const players = room.players || {};
    const uid = auth.currentUser?.uid;

    const playerEntry = Object.entries(players).find(
      ([, data]) => data.uid === uid
    );

    if (!playerEntry) {
      throw new Error('Your player was not found in this room.');
    }

    const playerId = playerEntry[0];
    const isHost = room.host === playerId;

    const opponentEntry = Object.entries(players).find(
      ([id]) => id !== playerId
    );

    if (!opponentEntry) {
      throw new Error('Waiting for the other player.');
    }

    onlineSession = {
      roomId,
      playerId,
      opponentId: opponentEntry[0],
      isHost,
      roomCode: room.code
    };

    controlledCar = isHost ? player : rival;

    // Never let both online players use the same team color.
    enforceOnlineTeamColors();

    onlineLastSnapshot = 0;
    onlineLastSend = 0;
    onlineLastJump = false;

    remoteInput = {
      throttle: 0,
      steer: 0,
      braking: false,
      boosting: false,
      jump: false,
      sentAt: 0
    };

    if (onlineInputUnsubscribe) {
      onlineInputUnsubscribe();
    }

    if (onlineStateUnsubscribe) {
      onlineStateUnsubscribe();
    }

    if (isHost) {
      onlineInputUnsubscribe = onValue(
        ref(
          database,
          `rooms/${roomId}/inputs/${onlineSession.opponentId}`
        ),
        snapshot => {
          const value = snapshot.val();

          if (!value || Date.now() - (value.sentAt || 0) > 1500) {
            remoteInput = {
              throttle: 0,
              steer: 0,
              braking: false,
              boosting: false,
              jump: false,
              sentAt: 0
            };

            return;
          }

          remoteInput = value;

          if (value.jump) {
            jump(rival);
          }
        }
      );
    } else {
      onlineStateUnsubscribe = onValue(
        ref(database, `rooms/${roomId}/gameState`),
        snapshot => {
          applyOnlineSnapshot(snapshot.val());
        }
      );
    }

    onlineStartPending = false;
    startMatch();

  } catch (error) {
    console.error('Could not initialize online match:', error);

    onlineStartPending = false;
    onlineSession = null;

    alert(`Online match error: ${error.message}`);
  }
}

window.addEventListener('rocket-online-start', event => {
  beginOnlineSession(event.detail);
});

window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();

  if (
    [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)
  ) {
    event.preventDefault();
  }

  if (key === ' ' && !keys[' ']) {
    if (
      gameState === 'playing' &&
      (!onlineSession || onlineSession.isHost)
    ) {
      jump(player);
    }
  }

  keys[key] = true;

  if (key === 'escape') {
    if (gameState === 'playing') pauseGame();
    else if (gameState === 'paused') resumeGame();
  }

  if (key === 'c' && gameState === 'playing') {
    cameraMode = (cameraMode + 1) % 2;
  }

  if (key === 'r' && gameState === 'playing') {
    if (!onlineSession || onlineSession.isHost) {
      resetPositions();
    }
  }
});

window.addEventListener('keyup', event => {
  keys[event.key.toLowerCase()] = false;
});

function jump(car) {
  const data = car.userData;

  if (data.grounded) {
    data.verticalSpeed = 8.5;
    data.grounded = false;
    sound.jump();
  }
}

// AUDIO
let audioContext = null;
let masterGain = null;
let effectsGain = null;
let musicGain = null;
let engineOsc = null;
let engineGain = null;
let audioStarted = false;
let soundEnabled = true;
let musicOscillators = [];
let musicTimer = 0;

const volume = {
  master: 0.7,
  music: 0.35,
  effects: 0.85
};

function startAudio() {
  if (audioStarted) {
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }

    return;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  audioContext = new AudioCtx();

  masterGain = audioContext.createGain();
  effectsGain = audioContext.createGain();
  musicGain = audioContext.createGain();

  masterGain.gain.value = volume.master;
  effectsGain.gain.value = volume.effects;
  musicGain.gain.value = volume.music;

  effectsGain.connect(masterGain);
  musicGain.connect(masterGain);
  masterGain.connect(audioContext.destination);

  engineOsc = audioContext.createOscillator();
  engineOsc.type = 'sawtooth';

  engineGain = audioContext.createGain();
  engineGain.gain.value = 0;

  engineOsc.connect(engineGain);
  engineGain.connect(effectsGain);
  engineOsc.start();

  audioStarted = true;
  startMenuMusic();
}

function updateAudioVolumes() {
  if (!audioStarted) return;

  const now = audioContext.currentTime;

  masterGain.gain.setTargetAtTime(
    soundEnabled ? volume.master : 0,
    now,
    0.05
  );

  musicGain.gain.setTargetAtTime(volume.music, now, 0.05);
  effectsGain.gain.setTargetAtTime(volume.effects, now, 0.05);
}

function tone(
  frequency,
  duration,
  type = 'sine',
  gain = 0.2,
  endFrequency = null
) {
  if (!audioStarted || !soundEnabled) return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const amp = audioContext.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);

  if (endFrequency) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      now + duration
    );
  }

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(effectsGain);

  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function noiseBurst(duration, gain, frequency = 900) {
  if (!audioStarted || !soundEnabled) return;

  const length = Math.floor(audioContext.sampleRate * duration);

  const buffer = audioContext.createBuffer(
    1,
    length,
    audioContext.sampleRate
  );

  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const amp = audioContext.createGain();

  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = frequency;

  amp.gain.setValueAtTime(gain, audioContext.currentTime);
  amp.gain.exponentialRampToValueAtTime(
    0.0001,
    audioContext.currentTime + duration
  );

  source.connect(filter);
  filter.connect(amp);
  amp.connect(effectsGain);

  source.start();
}

function stopMusic() {
  for (const osc of musicOscillators) {
    try {
      osc.stop();
    } catch {}
  }

  musicOscillators = [];
}

function playMusicNote(frequency, start, duration, gain = 0.035) {
  if (!audioStarted) return;

  const osc = audioContext.createOscillator();
  const amp = audioContext.createGain();

  osc.type = 'triangle';
  osc.frequency.value = frequency;

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.04);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp);
  amp.connect(musicGain);

  osc.start(start);
  osc.stop(start + duration + 0.02);

  musicOscillators.push(osc);
}

function startMenuMusic() {
  if (!audioStarted) return;

  stopMusic();

  const notes = [110, 164.81, 220, 164.81, 130.81, 196, 261.63, 196];
  let index = 0;

  function loop() {
    if (!audioStarted) return;

    if (gameState === 'menu' || gameState === 'paused') {
      const now = audioContext.currentTime;

      playMusicNote(notes[index % notes.length], now, 0.8, 0.025);

      playMusicNote(
        notes[(index + 2) % notes.length] * 2,
        now + 0.18,
        0.45,
        0.012
      );

      index++;
    }

    musicTimer = window.setTimeout(loop, 650);
  }

  loop();
}

const sound = {
  click() {
    tone(600, 0.08, 'sine', 0.1, 850);
  },

  boost() {
    tone(90, 0.4, 'sawtooth', 0.12, 380);
    noiseBurst(0.22, 0.08, 1200);
  },

  jump() {
    tone(180, 0.25, 'triangle', 0.16, 520);
  },

  hit() {
    tone(95, 0.16, 'sine', 0.22, 42);
    noiseBurst(0.12, 0.17, 650);
  },

  goal() {
    tone(330, 0.5, 'sawtooth', 0.14, 660);
    setTimeout(() => tone(440, 0.6, 'sawtooth', 0.14, 880), 160);
    setTimeout(() => tone(660, 0.8, 'triangle', 0.12, 990), 320);
  },

  brake() {
    noiseBurst(0.14, 0.04, 450);
  },

  countdown() {
    tone(500, 0.12, 'sine', 0.13);
  },

  kickoff() {
    tone(500, 0.22, 'triangle', 0.16, 900);
  }
};

// ENGINE SOUND
function updateEngineSound() {
  if (!audioStarted || !engineOsc || !engineGain) return;

  const speed = Math.abs(controlledCar.userData.speed);

  const boostOn =
    keys.shift &&
    controlledCar.userData.boost > 0 &&
    gameState === 'playing';

  const frequency = 48 + speed * 5 + (boostOn ? 45 : 0);
  const now = audioContext.currentTime;

  engineOsc.frequency.setTargetAtTime(frequency, now, 0.08);

  const target = gameState === 'playing'
    ? 0.025 + speed * 0.002 + (boostOn ? 0.045 : 0)
    : 0;

  engineGain.gain.setTargetAtTime(target, now, 0.1);
}

// SOUND AND SETTINGS
const soundToggle = $('soundToggle');

soundToggle.addEventListener('click', () => {
  startAudio();

  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? 'SOUND: ON' : 'SOUND: OFF';

  updateAudioVolumes();

  if (soundEnabled) sound.click();
});

$('masterVolume').addEventListener('input', event => {
  volume.master = Number(event.target.value) / 100;
  $('masterLabel').textContent = event.target.value + '%';
  updateAudioVolumes();
});

$('musicVolume').addEventListener('input', event => {
  volume.music = Number(event.target.value) / 100;
  $('musicLabel').textContent = event.target.value + '%';
  updateAudioVolumes();
});

$('effectsVolume').addEventListener('input', event => {
  volume.effects = Number(event.target.value) / 100;
  $('effectsLabel').textContent = event.target.value + '%';
  updateAudioVolumes();
});

// SCORE
function updateScore() {
  ui.blueScore.textContent = blueScore;
  ui.orangeScore.textContent = orangeScore;
}

// RESET
function resetPositions() {
  player.position.set(-13, 0, 0);
  rival.position.set(13, 0, 0);

  player.userData.yaw = -Math.PI / 2;
  rival.userData.yaw = Math.PI / 2;

  for (const car of [player, rival]) {
    car.rotation.y = car.userData.yaw;
    car.userData.speed = 0;
    car.userData.verticalSpeed = 0;
    car.userData.velocity.set(0, 0, 0);
    car.userData.grounded = true;
    car.userData.flame.visible = false;
  }

  ballGroup.position.set(0, 1.2, 0);
  ballVelocity.set(0, 0, 0);
}

// START MATCH
function startMatch() {
  if (onlineStartPending) return;

  startAudio();
  sound.click();

  blueScore = 0;
  orangeScore = 0;
  timeLeft = 180;

  updateScore();
  resetPositions();

  if (onlineSession) {
    // Host is always BLUE; joining player is always ORANGE.
    enforceOnlineTeamColors();
    controlledCar = onlineSession.isHost ? player : rival;
  } else {
    controlledCar = player;
  }

  gameState = 'playing';

  ui.mainMenu.classList.add('hidden');
  ui.pauseMenu.classList.add('hidden');
  ui.endMenu.classList.add('hidden');

  $('hud').classList.add('visible');
  $('boostPanel').classList.add('visible');
  $('gameControls').classList.add('visible');

  ui.matchStatus.textContent = 'KICKOFF';
  countdown = 2.5;
  ui.gameMessage.textContent = 'GET READY!';

  startMenuMusic();
}

function pauseGame() {
  if (onlineSession) {
    ui.gameMessage.textContent = 'PAUSE IS DISABLED IN ONLINE MATCHES';
    return;
  }

  gameState = 'paused';
  ui.pauseMenu.classList.remove('hidden');
  ui.matchStatus.textContent = 'PAUSED';
  startMenuMusic();
}

function resumeGame() {
  gameState = 'playing';
  ui.pauseMenu.classList.add('hidden');
  ui.matchStatus.textContent = 'IN PLAY';
  sound.click();
}

function returnToMenu() {
  gameState = 'menu';

  if (onlineInputUnsubscribe) onlineInputUnsubscribe();
  if (onlineStateUnsubscribe) onlineStateUnsubscribe();

  onlineInputUnsubscribe = null;
  onlineStateUnsubscribe = null;
  onlineSession = null;
  onlineStartPending = false;
  controlledCar = player;

  ui.mainMenu.classList.remove('hidden');
  ui.pauseMenu.classList.add('hidden');
  ui.endMenu.classList.add('hidden');

  $('hud').classList.remove('visible');
  $('boostPanel').classList.remove('visible');
  $('gameControls').classList.remove('visible');

  ui.gameMessage.textContent = '';

  resetPositions();
  startMenuMusic();
}

function finishMatch() {
  gameState = 'ended';
  ui.endMenu.classList.remove('hidden');

  ui.endTitle.textContent = blueScore > orangeScore
    ? 'BLUE WINS!'
    : blueScore < orangeScore
      ? 'ORANGE WINS!'
      : 'IT’S A DRAW!';

  ui.endScore.textContent = `${blueScore} - ${orangeScore}`;

  startMenuMusic();
}

function scoreGoal(team) {
  if (gameState !== 'playing' || countdown > 0) return;

  if (team === 'blue') blueScore++;
  else orangeScore++;

  updateScore();
  sound.goal();

  ui.gameMessage.textContent = team === 'blue'
    ? 'BLUE SCORES!'
    : 'ORANGE SCORES!';

  gameState = 'goal';

  setTimeout(() => {
    if (gameState !== 'goal') return;

    resetPositions();
    ui.gameMessage.textContent = '';
    gameState = 'playing';
    countdown = 1.5;
  }, 1800);
}

// PHYSICS
function getForward(yaw) {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function updateCar(car, isPlayer, dt, inputOverride = null) {
  const data = car.userData;

  let throttle = 0;
  let steer = 0;
  let braking = false;
  let boosting = false;

  if (isPlayer || inputOverride) {
    const input = inputOverride || getLocalInput();

    throttle = THREE.MathUtils.clamp(Number(input.throttle) || 0, -1, 1);
    steer = THREE.MathUtils.clamp(Number(input.steer) || 0, -1, 1);
    braking = !!input.braking;
    boosting = !!input.boosting && data.boost > 0;

  } else {
    // This is ONLY used for offline AI matches.
    const targetX = ballGroup.position.x + 3.5;
    const targetZ = ballGroup.position.z * 0.85;

    const dx = targetX - car.position.x;
    const dz = targetZ - car.position.z;

    const desiredYaw = Math.atan2(-dx, -dz);

    let difference = desiredYaw - data.yaw;
    difference = Math.atan2(Math.sin(difference), Math.cos(difference));

    steer = THREE.MathUtils.clamp(difference * 2.1, -1, 1);
    throttle = Math.abs(difference) > 2.2 ? 0.35 : 1;
    boosting = Math.abs(difference) < 0.55 && data.boost > 15;
  }

  const speed = data.speed;
  const absSpeed = Math.abs(speed);

  const steeringStrength = 1.45 *
    THREE.MathUtils.clamp(absSpeed / 5, 0.22, 1);

  data.yaw += steer * steeringStrength * Math.sign(speed || 1) * dt;
  car.rotation.y = data.yaw;

  const facing = getForward(data.yaw);
  const side = new THREE.Vector3(-facing.z, 0, facing.x);

  if (throttle > 0) {
    data.speed += 25 * dt;
  } else if (throttle < 0) {
    if (data.speed > 1) {
      data.speed -= 42 * dt;
    } else {
      data.speed -= 17 * dt;
    }
  }

  if (braking) {
    data.speed *= Math.exp(-9.5 * dt);

    if (Math.abs(data.speed) < 0.7) {
      data.speed = 0;
    }

    if (absSpeed > 5 && Math.random() < dt * 2.5) {
      sound.brake();
    }

  } else if (throttle === 0) {
    data.speed *= Math.exp(-1.8 * dt);
  }

  if (boosting && data.boost > 0) {
    data.speed += 31 * dt;
    data.boost = Math.max(0, data.boost - 34 * dt);
  } else {
    data.boost = Math.min(100, data.boost + 12 * dt);
  }

  const maxSpeed = boosting ? 35 : 24;
  data.speed = THREE.MathUtils.clamp(data.speed, -11, maxSpeed);

  let velocity = facing.clone().multiplyScalar(data.speed);

  const lateral = data.velocity.dot(side);
  const grip = braking ? 0.08 : 0.035;

  velocity.addScaledVector(side, lateral * grip);

  if (boosting) {
    data.flame.visible = true;
    data.flame.scale.setScalar(0.85 + Math.random() * 0.5);
    data.flame.material.color.setHex(0x48cfff);
  } else {
    data.flame.visible = false;
  }

  data.velocity.lerp(velocity, 1 - Math.exp(-10 * dt));
  car.position.addScaledVector(data.velocity, dt);

  data.verticalSpeed -= 22 * dt;
  car.position.y += data.verticalSpeed * dt;

  if (car.position.y <= 0) {
    car.position.y = 0;
    data.verticalSpeed = 0;
    data.grounded = true;
  }

  car.position.x = THREE.MathUtils.clamp(car.position.x, -29, 29);
  car.position.z = THREE.MathUtils.clamp(car.position.z, -17.5, 17.5);

  for (const wheel of data.wheels) {
    wheel.rotation.x += data.speed * dt * 0.7;
  }

  if (car === controlledCar) {
    ui.boostFill.style.width = `${data.boost}%`;
    ui.boostValue.textContent = Math.round(data.boost);
  }
}

function updateBall(dt) {
  ballVelocity.y -= 13 * dt;
  ballGroup.position.addScaledVector(ballVelocity, dt);

  if (ballGroup.position.y < 1.15) {
    ballGroup.position.y = 1.15;

    if (Math.abs(ballVelocity.y) > 1.2) {
      ballVelocity.y *= -0.65;

      if (Math.abs(ballVelocity.y) > 3) {
        sound.hit();
      }

    } else {
      ballVelocity.y = 0;
    }

    ballVelocity.x *= 0.985;
    ballVelocity.z *= 0.985;
  }

  ballGroup.rotation.x += ballVelocity.z * dt * 0.35;
  ballGroup.rotation.z -= ballVelocity.x * dt * 0.35;

  if (ballGroup.position.z < -19 || ballGroup.position.z > 19) {
    ballGroup.position.z = THREE.MathUtils.clamp(
      ballGroup.position.z,
      -19,
      19
    );

    ballVelocity.z *= -0.78;
    sound.hit();
  }

  if (ballGroup.position.x < -32.5) {
    if (
      Math.abs(ballGroup.position.z) < 6.2 &&
      ballGroup.position.y < 5.1
    ) {
      scoreGoal('orange');
      return;
    }

    ballGroup.position.x = -32.5;
    ballVelocity.x *= -0.75;
    sound.hit();
  }

  if (ballGroup.position.x > 32.5) {
    if (
      Math.abs(ballGroup.position.z) < 6.2 &&
      ballGroup.position.y < 5.1
    ) {
      scoreGoal('blue');
      return;
    }

    ballGroup.position.x = 32.5;
    ballVelocity.x *= -0.75;
    sound.hit();
  }

  for (const car of [player, rival]) {
    const difference = ballGroup.position.clone().sub(
      new THREE.Vector3(
        car.position.x,
        car.position.y + 0.8,
        car.position.z
      )
    );

    const distance = difference.length();

    if (distance < 2.75) {
      difference.normalize();

      const carSpeed = car.userData.velocity.length();
      const impact = Math.max(5, carSpeed * 1.15 + 4);

      ballGroup.position.addScaledVector(
        difference,
        2.75 - distance + 0.03
      );

      ballVelocity.addScaledVector(difference, impact);

      ballVelocity.y += Math.max(
        0,
        car.userData.verticalSpeed
      ) * 0.35;

      if (car === player) {
        ballVelocity.x += -Math.sin(car.userData.yaw) * 2.5;
        ballVelocity.z += -Math.cos(car.userData.yaw) * 2.5;
      }

      if (distance > 2.55) {
        sound.hit();
      }
    }
  }

  ballVelocity.multiplyScalar(Math.exp(-0.45 * dt));

  if (ballVelocity.length() > 36) {
    ballVelocity.setLength(36);
  }
}

// CAMERA
function updateCamera(dt) {
  const followCar = onlineSession && !onlineSession.isHost
    ? rival
    : player;

  const target = new THREE.Vector3(
    followCar.position.x,
    followCar.position.y + 0.8,
    followCar.position.z
  );

  let desiredPosition;

  if (cameraMode === 0) {
    const facing = getForward(followCar.userData.yaw);

    desiredPosition = target.clone()
      .addScaledVector(facing, -8.5)
      .add(new THREE.Vector3(0, 4.5, 0));

  } else {
    desiredPosition = new THREE.Vector3(
      followCar.position.x + 2,
      24,
      followCar.position.z + 8
    );
  }

  const smoothness = 1 - Math.exp(-7 * dt);

  camera.position.lerp(desiredPosition, smoothness);

  camera.lookAt(
    target.x,
    target.y + (cameraMode === 0 ? 0.9 : 0),
    target.z
  );
}

// MENU PANELS
function closePanels() {
  document.querySelectorAll('.popup-panel').forEach(panel => {
    panel.classList.add('hidden');
  });
}

$('playBtn').addEventListener('click', startMatch);
$('resumeBtn').addEventListener('click', resumeGame);
$('quitBtn').addEventListener('click', returnToMenu);
$('againBtn').addEventListener('click', startMatch);
$('endHomeBtn').addEventListener('click', returnToMenu);

$('garageBtn').addEventListener('click', () => {
  startAudio();
  closePanels();
  $('garagePanel').classList.remove('hidden');
  sound.click();
});

$('settingsBtn').addEventListener('click', () => {
  startAudio();
  closePanels();
  $('settingsPanel').classList.remove('hidden');
  sound.click();
});

$('howBtn').addEventListener('click', () => {
  startAudio();
  closePanels();
  $('howPanel').classList.remove('hidden');
  sound.click();
});

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => {
    closePanels();
    sound.click();
  });
});

document.querySelectorAll('.color-choice').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.color-choice').forEach(item => {
      item.classList.remove('selected');
    });

    button.classList.add('selected');
    selectedColor = button.dataset.color;

    setPlayerColor(selectedColor);
    sound.click();
  });
});

// GAME LOOP
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.04);
  const elapsed = clock.elapsedTime;

  if (gameState === 'menu') {
    const t = elapsed * 0.2;

    camera.position.set(
      Math.sin(t) * 24,
      15 + Math.sin(t * 1.8) * 1.5,
      28 + Math.cos(t) * 8
    );

    camera.lookAt(0, 1, 0);

    player.position.set(
      -12,
      0,
      Math.sin(elapsed * 0.7) * 3
    );

    player.userData.yaw = -Math.PI / 2 +
      Math.sin(elapsed * 0.4) * 0.15;

    player.rotation.y = player.userData.yaw;

    rival.position.set(
      12,
      0,
      Math.cos(elapsed * 0.7) * 3
    );

    rival.userData.yaw = Math.PI / 2 +
      Math.sin(elapsed * 0.4) * 0.15;

    rival.rotation.y = rival.userData.yaw;

    ballGroup.position.set(
      Math.sin(elapsed * 0.5) * 2,
      1.2,
      Math.cos(elapsed * 0.5) * 2
    );

    ballGroup.rotation.y += dt * 0.5;
  }

  if (gameState === 'playing') {
    if (countdown > 0) {
      // The host owns the countdown in online matches.
      if (!onlineSession || onlineSession.isHost) {
        countdown -= dt;
      }

      ui.matchStatus.textContent = countdown > 1
        ? 'GET READY'
        : 'GO!';

      if (countdown <= 0) {
        ui.matchStatus.textContent = 'IN PLAY';
        ui.gameMessage.textContent = '';
        sound.kickoff();
      }

    } else {
      // The host owns the clock in online matches.
      if (!onlineSession || onlineSession.isHost) {
        timeLeft -= dt;
      }

      if (
        (!onlineSession || onlineSession.isHost) &&
        timeLeft <= 0
      ) {
        timeLeft = 0;
        finishMatch();
      }

      if (!onlineSession) {
        // OFFLINE: BLUE HUMAN VS ORANGE AI.
        updateCar(player, true, dt);
        updateCar(rival, false, dt);
        updateBall(dt);

      } else if (onlineSession.isHost) {
        // ONLINE HOST: SIMULATES BOTH REAL PLAYERS.
        updateCar(player, true, dt);
        updateCar(rival, false, dt, remoteInput);
        updateBall(dt);

      } else {
        // ONLINE GUEST: SENDS INPUT; HOST SENDS THE GAME STATE.
        sendOnlineInput();
      }
    }

    const minutes = Math.floor(timeLeft / 60);
    const seconds = Math.floor(timeLeft % 60);

    ui.timer.textContent =
      `${minutes}:${String(seconds).padStart(2, '0')}`;

    updateCamera(dt);
    updateEngineSound();
  }

  if (
    gameState === 'paused' ||
    gameState === 'ended' ||
    gameState === 'goal'
  ) {
    updateCamera(dt);
  }

  // Only the host publishes the authoritative match state.
  if (
    onlineSession?.isHost &&
    (
      gameState === 'playing' ||
      gameState === 'goal' ||
      gameState === 'ended'
    )
  ) {
    publishOnlineSnapshot();
  }

  renderer.render(scene, camera);
}

// RESIZE
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// START
returnToMenu();
animate();
