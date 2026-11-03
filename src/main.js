import * as THREE from 'three';
import './style.css';

// ROCKET SOCCER 3D — rebuilt arcade prototype
const game = document.getElementById('game');
const $ = (id) => document.getElementById(id);

const ui = {
  blueScore: $('blueScore'),
  orangeScore: $('orangeScore'),
  timer: $('timer'),
  boostFill: $('boostFill'),
  boostValue: $('boostValue'),
  message: $('message'),
  messageTitle: $('messageTitle'),
  messageSub: $('messageSub'),
  playBtn: $('playBtn'),
  soundBtn: $('soundBtn')
};

if (!game || Object.values(ui).some((el) => !el)) {
  throw new Error('Game UI is incomplete. Check index.html.');
}

const FIELD_X = 47;
const FIELD_Z = 27;
const BALL_R = 0.92;
const MATCH_SECONDS = 180;

const clock = new THREE.Clock();
const keys = Object.create(null);

let blueScore = 0;
let orangeScore = 0;
let timeLeft = MATCH_SECONDS;
let running = false;
let paused = false;
let finished = false;
let cameraMode = 0;
let kickoff = 2;
let goalPause = 0;
let audio = null;
let engineOsc = null;
let engineGain = null;
let boostOsc = null;
let boostGain = null;
let soundEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071321);
scene.fog = new THREE.Fog(0x071321, 105, 185);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  260
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.domElement.setAttribute('aria-label', 'Rocket Soccer 3D game');
game.prepend(renderer.domElement);

// LIGHTING
const hemi = new THREE.HemisphereLight(0xb9e4ff, 0x203044, 2.1);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff4df, 2.5);
sun.position.set(-28, 48, 24);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -62;
sun.shadow.camera.right = 62;
sun.shadow.camera.top = 58;
sun.shadow.camera.bottom = -58;
sun.shadow.bias = -0.00025;
scene.add(sun);

const blueLamp = new THREE.PointLight(0x168fff, 90, 48);
blueLamp.position.set(-43, 8, 0);
scene.add(blueLamp);

const orangeLamp = new THREE.PointLight(0xff7629, 90, 48);
orangeLamp.position.set(43, 8, 0);
scene.add(orangeLamp);

// MATERIALS
const mat = (color, roughness = 0.55, metalness = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...extra
  });

const mats = {
  grassA: mat(0x177a42, 0.96),
  grassB: mat(0x126b39, 0.96),
  white: mat(0xe9f4fa, 0.65),
  wall: mat(0x142a40, 0.48, 0.3),
  dark: mat(0x091421, 0.55, 0.35),
  metal: mat(0x829db5, 0.3, 0.8),
  blue: mat(0x087dff, 0.24, 0.55),
  blueLight: mat(0x66dfff, 0.2, 0.35),
  orange: mat(0xff7624, 0.25, 0.5),
  orangeLight: mat(0xffc17a, 0.22, 0.3),
  tire: mat(0x080d13, 0.9),
  glass: mat(0x153b57, 0.18, 0.55),
  ball: mat(0xf1f5f8, 0.28, 0.16),
  ballDark: mat(0x283b4c, 0.42, 0.18)
};

const addMesh = (parent, geo, material, pos, cast = true) => {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(...pos);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const box = (parent, w, h, d, material, x, y, z) =>
  addMesh(
    parent,
    new THREE.BoxGeometry(w, h, d),
    material,
    [x, y, z]
  );

// FIELD
box(scene, 96, 0.8, 56, mats.dark, 0, -0.48, 0);

for (let i = 0; i < 12; i++) {
  box(
    scene,
    8,
    0.035,
    54,
    i % 2 ? mats.grassB : mats.grassA,
    -44 + i * 8,
    -0.055,
    0,
    false
  );
}

const lineMat = new THREE.MeshBasicMaterial({ color: 0xeaf7ff });

const fieldLine = (x, z, w, d) =>
  addMesh(
    scene,
    new THREE.BoxGeometry(w, 0.035, d),
    lineMat,
    [x, 0.012, z],
    false
  );

fieldLine(0, 0, 0.13, 54);
fieldLine(0, -27, 94, 0.13);
fieldLine(0, 27, 94, 0.13);
fieldLine(-47, 0, 0.13, 54);
fieldLine(47, 0, 0.13, 54);

const ring = addMesh(
  scene,
  new THREE.RingGeometry(5.6, 5.78, 80),
  lineMat,
  [0, 0.025, 0],
  false
);
ring.rotation.x = -Math.PI / 2;

addMesh(
  scene,
  new THREE.CircleGeometry(0.2, 24),
  lineMat,
  [0, 0.03, 0],
  false
).rotation.x = -Math.PI / 2;

for (const side of [-1, 1]) {
  fieldLine(side * 35, 0, 0.12, 17);
  fieldLine(side * 40, 0, 0.12, 17);
  fieldLine(side * 37.5, -8, 5, 0.12);
  fieldLine(side * 37.5, 8, 5, 0.12);
}

// STADIUM WALLS
for (const z of [-28, 28]) {
  box(scene, 96, 2.2, 1.1, mats.wall, 0, 1.05, z);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(96, 7, 0.22),
    new THREE.MeshPhysicalMaterial({
      color: 0x66bfff,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    })
  );

  glass.position.set(0, 5.6, z);
  scene.add(glass);
}

// STANDS
for (const zSide of [-1, 1]) {
  box(scene, 108, 10, 13, mats.dark, 0, 5, zSide * 39);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 36; col++) {
      const seatMat = col < 18 ? mats.blue : mats.orange;

      const seat = box(
        scene,
        1.85,
        0.45,
        0.85,
        seatMat,
        -46 + col * 2.65,
        1.1 + row * 1.55,
        zSide * (32 + row * 2.35)
      );

      seat.castShadow = false;
    }
  }
}

// ROOF AND FLOODLIGHTS
for (let x = -42; x <= 42; x += 14) {
  box(scene, 0.55, 0.55, 88, mats.metal, x, 17, 0);
}

for (const x of [-38, -13, 13, 38]) {
  for (const z of [-36, 36]) {
    addMesh(
      scene,
      new THREE.CylinderGeometry(0.2, 0.32, 14, 10),
      mats.metal,
      [x, 7, z]
    );

    box(scene, 4, 0.55, 1.5, mats.white, x, 14.3, z);

    const light = new THREE.PointLight(0xd7f1ff, 30, 56);
    light.position.set(x, 13.5, z);
    scene.add(light);
  }
}

// GOALS
for (const x of [-48, 48]) {
  for (const z of [-19, 19]) {
    box(scene, 1.2, 8, 16, mats.wall, x, 4, z);
  }
}

function createGoal(x, color, inward) {
  const group = new THREE.Group();
  group.position.set(x, 0, 0);
  scene.add(group);

  const frameMat = mat(color, 0.22, 0.65);

  const post = (w, h, d, px, py, pz) =>
    box(group, w, h, d, frameMat, px, py, pz);

  post(0.65, 7, 0.65, 0, 3.5, -7);
  post(0.65, 7, 0.65, 0, 3.5, 7);
  post(0.65, 0.65, 14, 0, 7, 0);

  const netMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35
  });

  for (let y = 1; y < 7; y += 1.2) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, y, -7),
      new THREE.Vector3(inward * 5, y, -7),
      new THREE.Vector3(inward * 5, y, 7),
      new THREE.Vector3(0, y, 7)
    ]);

    group.add(new THREE.Line(geometry, netMat));
  }

  for (let z = -7; z <= 7; z += 1.4) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.5, z),
      new THREE.Vector3(inward * 5, 0.5, z),
      new THREE.Vector3(inward * 5, 7, z)
    ]);

    group.add(new THREE.Line(geometry, netMat));
  }

  const aura = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 8),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide
    })
  );

  aura.position.set(inward * 2.5, 4, 0);
  aura.rotation.y = Math.PI / 2;
  group.add(aura);

  return group;
}

createGoal(-47, 0x25aaff, 1);
createGoal(47, 0xff852f, -1);

// CARS
function createCar(color, highlight, isPlayer) {
  const root = new THREE.Group();
  scene.add(root);

  const bodyMat = mat(color, 0.22, 0.55);
  const trimMat = mat(highlight, 0.2, 0.45);
  const windowMat = mat(0x16364e, 0.16, 0.6, {
    transparent: true,
    opacity: 0.94
  });

  box(root, 2.45, 0.72, 3.65, bodyMat, 0, 0.72, 0);
  box(root, 2.05, 0.52, 1.55, bodyMat, 0, 1.25, 0.25);
  box(root, 2.12, 0.24, 1.05, trimMat, 0, 1.12, -1.08);
  box(root, 1.72, 0.08, 1.15, windowMat, 0, 1.58, 0.22);
  box(root, 2.25, 0.13, 0.22, trimMat, 0, 0.97, -1.78);
  box(root, 2.35, 0.16, 0.24, mats.dark, 0, 0.47, 1.72);

  for (const s of [-1, 1]) {
    box(root, 0.13, 0.25, 2.55, mats.dark, s * 1.18, 0.47, 0);

    for (const z of [-1.15, 1.15]) {
      const wheel = addMesh(
        root,
        new THREE.CylinderGeometry(0.48, 0.48, 0.32, 20),
        mats.tire,
        [s * 1.18, 0.48, z]
      );

      wheel.rotation.z = Math.PI / 2;

      const hub = addMesh(
        root,
        new THREE.CylinderGeometry(0.22, 0.22, 0.34, 16),
        trimMat,
        [s * 1.18, 0.48, z]
      );

      hub.rotation.z = Math.PI / 2;
    }

    addMesh(
      root,
      new THREE.BoxGeometry(0.55, 0.13, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xc9f5ff }),
      [s * 0.72, 0.93, -1.83],
      false
    );

    addMesh(
      root,
      new THREE.BoxGeometry(0.55, 0.12, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff302c }),
      [s * 0.72, 0.92, 1.84],
      false
    );
  }

  box(root, 0.16, 0.045, 2.25, trimMat, 0, 1.48, 0.05);
  box(root, 2.2, 0.12, 0.28, mats.dark, 0, 1.35, 1.78);

  const exhaust = new THREE.PointLight(highlight, 0, 5);
  exhaust.position.set(0, 0.8, 2.15);
  root.add(exhaust);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.9, 12),
    new THREE.MeshBasicMaterial({
      color: highlight,
      transparent: true,
      opacity: 0.85
    })
  );

  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.8, 2.55);
  flame.visible = false;
  root.add(flame);

  root.userData = {
    exhaust,
    flame,
    isPlayer,
    bodyMat,
    trimMat
  };

  return {
    root,
    velocity: new THREE.Vector3(),
    yaw: isPlayer ? -Math.PI / 2 : Math.PI / 2,
    boost: 100,
    vertical: 0,
    grounded: true,
    wheelSpin: 0
  };
}

const player = createCar(0x087dff, 0x72e8ff, true);
const rival = createCar(0xff7624, 0xffc078, false);

// BALL
const ball = new THREE.Group();
scene.add(ball);

addMesh(
  ball,
  new THREE.SphereGeometry(BALL_R, 32, 24),
  mats.ball,
  [0, 0, 0]
);

for (let i = 0; i < 12; i++) {
  const phi = Math.acos(1 - 2 * (i + 0.5) / 12);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;

  const v = new THREE.Vector3(
    Math.cos(theta) * Math.sin(phi),
    Math.cos(phi),
    Math.sin(theta) * Math.sin(phi)
  );

  const patch = addMesh(
    ball,
    new THREE.CircleGeometry(0.23, 5),
    mats.ballDark,
    [v.x * 0.91, v.y * 0.91, v.z * 0.91],
    false
  );

  patch.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    v
  );
}

const ballVel = new THREE.Vector3();

// STADIUM ACCENTS
for (let x = -44; x <= 44; x += 4) {
  const p = box(
    scene,
    0.08,
    0.12,
    0.2,
    x % 8 === 0 ? mats.blueLight : mats.orangeLight,
    x,
    0.08,
    -27.45
  );

  p.castShadow = false;
}

// SOUND SYSTEM
function initAudio() {
  if (audio) {
    if (audio.state === 'suspended') audio.resume();
    return;
  }

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return;

  audio = new AudioContextClass();

  engineOsc = audio.createOscillator();
  engineOsc.type = 'sawtooth';

  engineGain = audio.createGain();
  engineGain.gain.value = 0;

  const engineFilter = audio.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 380;

  engineOsc
    .connect(engineFilter)
    .connect(engineGain)
    .connect(audio.destination);

  engineOsc.start();

  boostOsc = audio.createOscillator();
  boostOsc.type = 'triangle';

  boostGain = audio.createGain();
  boostGain.gain.value = 0;

  boostOsc.connect(boostGain).connect(audio.destination);
  boostOsc.start();
}

function tone(
  freq = 440,
  duration = 0.12,
  type = 'sine',
  volume = 0.12,
  slide = 0
) {
  if (!soundEnabled || !audio) return;

  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, now);

  if (slide) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(30, freq + slide),
      now + duration
    );
  }

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function impactSound(power = 1) {
  tone(
    115 + Math.min(power, 12) * 18,
    0.16,
    'triangle',
    Math.min(0.22, 0.07 + power * 0.01),
    -65
  );
}

function goalSound() {
  tone(440, 0.22, 'sine', 0.16, 220);

  setTimeout(() => {
    tone(660, 0.25, 'sine', 0.15, 180);
  }, 130);

  setTimeout(() => {
    tone(880, 0.4, 'sine', 0.13, 120);
  }, 280);
}

function updateAudio(speed, boosting) {
  if (!audio || !soundEnabled) return;

  const now = audio.currentTime;

  engineOsc.frequency.setTargetAtTime(
    58 + Math.abs(speed) * 10,
    now,
    0.08
  );

  engineGain.gain.setTargetAtTime(
    running && !paused
      ? 0.025 + Math.min(Math.abs(speed) / 45, 0.045)
      : 0,
    now,
    0.08
  );

  boostOsc.frequency.setTargetAtTime(
    85 + Math.abs(speed) * 5,
    now,
    0.05
  );

  boostGain.gain.setTargetAtTime(
    boosting ? 0.035 : 0,
    now,
    0.06
  );
}

// GAME RESET
function resetPositions() {
  player.root.position.set(-12, 0.05, 0);
  player.yaw = -Math.PI / 2;
  player.velocity.set(0, 0, 0);
  player.vertical = 0;
  player.grounded = true;
  player.boost = 100;

  rival.root.position.set(12, 0.05, 0);
  rival.yaw = Math.PI / 2;
  rival.velocity.set(0, 0, 0);
  rival.vertical = 0;
  rival.grounded = true;

  ball.position.set(0, BALL_R, 0);
  ballVel.set(0, 0, 0);

  kickoff = 2;
  goalPause = 0;
}

resetPositions();

const forwardOf = (yaw) =>
  new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));

const clamp = (v, a, b) =>
  Math.max(a, Math.min(b, v));

const wrapAngle = (a) =>
  Math.atan2(Math.sin(a), Math.cos(a));

// CAR PHYSICS
function updateCar(car, dt, controls, ai = false) {
  const forward = forwardOf(car.yaw);
  let speed = car.velocity.dot(forward);

  const steer = controls.steer || 0;
  const throttle = controls.throttle || 0;
  const handbrake = !!controls.handbrake;

  const boosting =
    !!controls.boost &&
    car.boost > 0 &&
    throttle > 0;

  const maxSpeed = boosting ? 39 : 25;
  const acceleration = boosting ? 34 : 23;

  if (throttle !== 0) {
    speed += throttle * acceleration * dt;
  } else {
    speed *= Math.exp(-1.0 * dt);
  }

  speed = clamp(speed, -12, maxSpeed);

  const turnStrength =
    (0.65 + Math.min(Math.abs(speed) / 14, 1.15)) *
    (handbrake ? 1.55 : 1);

  car.yaw = wrapAngle(
    car.yaw +
    steer *
    turnStrength *
    dt *
    (speed < -0.5 ? -1 : 1)
  );

  const newForward = forwardOf(car.yaw);

  // Strong tire grip: lateral movement is removed quickly.
  const longitudinal = newForward
    .clone()
    .multiplyScalar(car.velocity.dot(newForward));

  const lateral = car.velocity.clone().sub(longitudinal);

  lateral.multiplyScalar(
    Math.exp(-(handbrake ? 2.8 : 13.5) * dt)
  );

  car.velocity.copy(longitudinal.add(lateral));

  car.velocity.addScaledVector(
    newForward,
    (speed - car.velocity.dot(newForward)) *
    Math.min(1, dt * 10)
  );

  if (boosting) {
    car.boost = Math.max(0, car.boost - 34 * dt);
    car.velocity.addScaledVector(newForward, 17 * dt);
  } else if (!ai) {
    car.boost = Math.min(100, car.boost + 11 * dt);
  }

  car.root.position.addScaledVector(car.velocity, dt);

  car.root.position.x = clamp(car.root.position.x, -44.5, 44.5);
  car.root.position.z = clamp(car.root.position.z, -24.5, 24.5);

  if (controls.jump && car.grounded) {
    car.vertical = 8.3;
    car.grounded = false;

    if (!ai) {
      tone(240, 0.12, 'sine', 0.08, 120);
    }
  }

  car.vertical -= 22 * dt;
  car.root.position.y += car.vertical * dt;

  if (car.root.position.y < 0.05) {
    car.root.position.y = 0.05;
    car.vertical = 0;
    car.grounded = true;
  }

  car.root.rotation.y = car.yaw;
  car.root.userData.flame.visible = boosting;
  car.root.userData.exhaust.intensity = boosting ? 2.2 : 0;

  car.wheelSpin += speed * dt * 1.7;

  return { speed, boosting };
}

function playerControls() {
  return {
    throttle:
      (keys.KeyW || keys.ArrowUp ? 1 : 0) -
      (keys.KeyS || keys.ArrowDown ? 1 : 0),

    steer:
      (keys.KeyA || keys.ArrowLeft ? 1 : 0) -
      (keys.KeyD || keys.ArrowRight ? 1 : 0),

    boost: !!(keys.ShiftLeft || keys.ShiftRight),
    jump: !!keys.Space,
    handbrake: !!keys.KeyX
  };
}

// AI OPPONENT
function updateAI(dt) {
  const target = new THREE.Vector3(
    ball.position.x + 3.1,
    0,
    ball.position.z
  );

  const delta = target.clone().sub(rival.root.position);
  const desired = Math.atan2(-delta.x, -delta.z);
  const error = wrapAngle(desired - rival.yaw);

  const steer = clamp(error * 2.4, -1, 1);
  const distance = delta.length();

  let throttle = distance > 3 ? 1 : 0.15;

  if (Math.abs(error) > 1.8 && distance > 8) {
    throttle = 0.25;
  }

  const jump =
    ball.position.y > 2.8 &&
    distance < 8 &&
    rival.grounded;

  return updateCar(
    rival,
    dt,
    {
      throttle,
      steer,
      boost:
        distance > 12 &&
        Math.abs(error) < 0.55 &&
        rival.boost > 8,
      jump,
      handbrake: false
    },
    true
  );
}

// BALL COLLISIONS
function collideCarBall(car, isPlayer) {
  const carCenter = car.root.position.clone().add(
    new THREE.Vector3(0, 0.8, 0)
  );

  const ballCenter = ball.position.clone();
  const diff = ballCenter.sub(carCenter);
  diff.y *= 0.65;

  const minDist = 2.15;

  if (diff.lengthSq() > minDist * minDist) return;

  if (diff.lengthSq() < 0.0001) {
    diff.set(isPlayer ? 1 : -1, 0.1, 0);
  }

  diff.normalize();

  const speed = car.velocity.length();
  const impulse = 7 + speed * 0.72;

  ballVel.addScaledVector(diff, impulse);
  ballVel.y = Math.max(ballVel.y, 2.1 + speed * 0.12);

  car.velocity.addScaledVector(diff, -1.1);

  impactSound(speed * 0.35);
}

function updateBall(dt) {
  ballVel.y -= 18 * dt;
  ball.position.addScaledVector(ballVel, dt);

  ballVel.multiplyScalar(Math.exp(-0.38 * dt));

  if (ball.position.y < BALL_R) {
    ball.position.y = BALL_R;

    if (ballVel.y < 0) {
      ballVel.y *= -0.58;
    }

    ballVel.x *= 0.985;
    ballVel.z *= 0.985;
  }

  if (ball.position.z > FIELD_Z - BALL_R) {
    ball.position.z = FIELD_Z - BALL_R;
    ballVel.z = -Math.abs(ballVel.z) * 0.72;
  }

  if (ball.position.z < -FIELD_Z + BALL_R) {
    ball.position.z = -FIELD_Z + BALL_R;
    ballVel.z = Math.abs(ballVel.z) * 0.72;
  }

  const inMouth =
    Math.abs(ball.position.z) < 7 &&
    ball.position.y < 7;

  if (ball.position.x > FIELD_X - BALL_R && !inMouth) {
    ball.position.x = FIELD_X - BALL_R;
    ballVel.x = -Math.abs(ballVel.x) * 0.72;
  }

  if (ball.position.x < -FIELD_X + BALL_R && !inMouth) {
    ball.position.x = -FIELD_X + BALL_R;
    ballVel.x = Math.abs(ballVel.x) * 0.72;
  }

  ball.rotation.x += ballVel.z * dt * 0.55;
  ball.rotation.z -= ballVel.x * dt * 0.55;

  if (ball.position.x > 48 && inMouth) {
    scoreGoal('BLUE');
  }

  if (ball.position.x < -48 && inMouth) {
    scoreGoal('ORANGE');
  }
}

// SCORING
function scoreGoal(team) {
  if (goalPause > 0) return;

  if (team === 'BLUE') {
    blueScore++;
  } else {
    orangeScore++;
  }

  ui.blueScore.textContent = blueScore;
  ui.orangeScore.textContent = orangeScore;

  ui.messageTitle.innerHTML =
    team === 'BLUE'
      ? 'BLUE<br><span>GOAL!</span>'
      : 'ORANGE<br><span>GOAL!</span>';

  ui.messageSub.textContent =
    'What a shot! Get ready for kickoff.';

  ui.playBtn.textContent = 'CONTINUE';
  ui.message.classList.remove('hidden');

  goalPause = 2.2;
  running = false;

  goalSound();
}

// CAMERA
function updateCamera(dt) {
  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();

  if (cameraMode === 0) {
    const back = forwardOf(player.yaw).multiplyScalar(-1);

    desired
      .copy(player.root.position)
      .add(new THREE.Vector3(0, 6.4, 0))
      .addScaledVector(back, 11.5);

    target
      .copy(player.root.position)
      .add(new THREE.Vector3(0, 1.1, 0))
      .addScaledVector(forwardOf(player.yaw), 5);

  } else if (cameraMode === 1) {
    desired.set(0, 56, 0.1);
    target.set(0, 0, 0);

  } else {
    desired.set(-65, 40, 65);
    target.set(0, 0, 0);
  }

  camera.position.lerp(
    desired,
    1 - Math.exp(-4.5 * dt)
  );

  camera.lookAt(target);
}

// HUD
function updateHUD() {
  ui.boostFill.style.width = `${player.boost}%`;
  ui.boostValue.textContent = Math.round(player.boost);

  ui.timer.textContent =
    `${Math.floor(timeLeft / 60)}:${String(
      Math.ceil(timeLeft % 60)
    ).padStart(2, '0')}`;
}

function showMenu(title, sub, button = 'PLAY') {
  ui.messageTitle.innerHTML = title;
  ui.messageSub.textContent = sub;
  ui.playBtn.textContent = button;
  ui.message.classList.remove('hidden');
}

// MATCH CONTROL
function startMatch() {
  initAudio();

  if (audio?.state === 'suspended') {
    audio.resume();
  }

  if (finished) {
    blueScore = 0;
    orangeScore = 0;
    timeLeft = MATCH_SECONDS;

    ui.blueScore.textContent = '0';
    ui.orangeScore.textContent = '0';

    finished = false;
    resetPositions();
  }

  running = true;
  paused = false;
  ui.message.classList.add('hidden');
}

function endMatch() {
  running = false;
  finished = true;

  const winner =
    blueScore === orangeScore
      ? 'DRAW'
      : blueScore > orangeScore
        ? 'BLUE WINS'
        : 'ORANGE WINS';

  showMenu(
    winner,
    `Final score: ${blueScore} - ${orangeScore}`,
    'PLAY AGAIN'
  );

  tone(520, 0.25, 'sine', 0.14, 160);
}

function resetGame() {
  resetPositions();

  if (!finished) {
    running = true;
    paused = false;
    ui.message.classList.add('hidden');
  }
}

// BUTTONS
ui.playBtn.addEventListener('click', () => {
  if (goalPause > 0) {
    goalPause = 0;
    resetPositions();
    startMatch();
  } else {
    startMatch();
  }
});

ui.soundBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;

  ui.soundBtn.textContent =
    soundEnabled ? '♫ SOUND ON' : '♫ SOUND OFF';

  ui.soundBtn.setAttribute(
    'aria-pressed',
    String(soundEnabled)
  );

  if (soundEnabled) {
    initAudio();
    tone(600, 0.08, 'sine', 0.08);
  } else if (audio) {
    engineGain.gain.setTargetAtTime(
      0,
      audio.currentTime,
      0.03
    );

    boostGain.gain.setTargetAtTime(
      0,
      audio.currentTime,
      0.03
    );
  }
});

// KEYBOARD
window.addEventListener('keydown', (e) => {
  if (
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']
      .includes(e.code)
  ) {
    e.preventDefault();
  }

  keys[e.code] = true;

  if (e.repeat) return;

  if (e.code === 'KeyC') {
    cameraMode = (cameraMode + 1) % 3;
  }

  if (e.code === 'KeyR') {
    resetGame();
  }

  if (e.code === 'Escape' && running) {
    paused = true;
    running = false;

    showMenu(
      'GAME<br><span>PAUSED</span>',
      'Take a breather. Your match is waiting.',
      'RESUME'
    );

  } else if (e.code === 'Escape' && paused) {
    startMatch();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('blur', () => {
  for (const key of Object.keys(keys)) {
    keys[key] = false;
  }
});

// RESIZE
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 1.6)
  );
});

// GAME LOOP
camera.position.set(-25, 25, 36);
camera.lookAt(0, 0, 0);

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);

  if (goalPause > 0) {
    goalPause -= dt;

    if (goalPause <= 0) {
      resetPositions();
    }
  }

  if (running && !paused && !finished) {
    if (kickoff > 0) {
      kickoff -= dt;

    } else {
      timeLeft = Math.max(0, timeLeft - dt);

      if (timeLeft <= 0) {
        endMatch();
      }

      const pc = updateCar(
        player,
        dt,
        playerControls()
      );

      const ac = updateAI(dt);

      collideCarBall(player, true);
      collideCarBall(rival, false);

      updateBall(dt);
      updateAudio(pc.speed, pc.boosting);
    }

  } else {
    updateAudio(0, false);
  }

  updateCamera(dt);
  updateHUD();

  renderer.render(scene, camera);
}

showMenu(
  'ROCKET<br><span>SOCCER</span>',
  'Drive fast. Hit hard. Score goals.',
  'KICK OFF'
);

animate();
