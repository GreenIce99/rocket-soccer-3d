import * as THREE from 'three';
import './style.css';

// ======================================================
// ROCKET SOCCER 3D — ARENA UPGRADE
// ======================================================

const $ = (id) => document.getElementById(id);

const game = $('game');

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

if (!game || Object.values(ui).some((element) => !element)) {
  throw new Error('Game UI is incomplete. Check index.html.');
}

// Arena dimensions
const FIELD_X = 55;
const FLAT_Z = 34;
const WALL_RADIUS = 9;
const WALL_HEIGHT = 9;
const BALL_RADIUS = 1.15;
const MATCH_LENGTH = 180;

const clock = new THREE.Clock();
const keys = Object.create(null);

let blueScore = 0;
let orangeScore = 0;
let timeLeft = MATCH_LENGTH;
let running = false;
let paused = false;
let finished = false;
let cameraMode = 0;
let kickoff = 2;
let boost = 100;

let audio = null;
let masterGain = null;
let musicGain = null;
let effectsGain = null;
let soundEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071321);
scene.fog = new THREE.Fog(0x071321, 100, 230);

const camera = new THREE.PerspectiveCamera(
  68,
  window.innerWidth / window.innerHeight,
  0.1,
  400
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
renderer.toneMappingExposure = 1.15;

renderer.domElement.setAttribute('aria-label', 'Rocket Soccer 3D');
game.prepend(renderer.domElement);

// ======================================================
// LIGHTING
// ======================================================

scene.add(new THREE.HemisphereLight(0xb8dcff, 0x182b24, 2.2));

const sun = new THREE.DirectionalLight(0xfff3df, 2.7);
sun.position.set(-30, 65, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -85;
sun.shadow.camera.right = 85;
sun.shadow.camera.top = 85;
sun.shadow.camera.bottom = -85;
sun.shadow.bias = -0.0002;
scene.add(sun);

const blueLight = new THREE.PointLight(0x168cff, 110, 65);
blueLight.position.set(-48, 12, 0);
scene.add(blueLight);

const orangeLight = new THREE.PointLight(0xff7628, 110, 65);
orangeLight.position.set(48, 12, 0);
scene.add(orangeLight);

for (const x of [-42, -14, 14, 42]) {
  for (const z of [-48, 48]) {
    const lamp = new THREE.PointLight(0xd9edff, 38, 60);
    lamp.position.set(x, 20, z);
    scene.add(lamp);
  }
}

// ======================================================
// MATERIALS AND HELPERS
// ======================================================

const material = (color, roughness = 0.55, metalness = 0) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });

const mats = {
  grass1: material(0x168047, 0.95),
  grass2: material(0x126e3d, 0.95),
  dark: material(0x091522, 0.65, 0.3),
  wall: material(0x142b43, 0.45, 0.35),
  metal: material(0x8ba7c1, 0.3, 0.75),
  white: material(0xeaf5ff, 0.5),
  blue: material(0x087dff, 0.23, 0.55),
  orange: material(0xff7624, 0.23, 0.55),
  black: material(0x080e17, 0.85),
  glass: material(0x163b59, 0.15, 0.65),
  ball: material(0xf5f7fa, 0.28, 0.15),
  ballDark: material(0x26394d, 0.4, 0.2)
};

function addBox(parent, w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  return mesh;
}

function addSphere(parent, radius, mat, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 18),
    mat
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  return mesh;
}

const clamp = THREE.MathUtils.clamp;

function smooth(value) {
  return value * value * (3 - 2 * value);
}

// ======================================================
// BIGGER STADIUM
// ======================================================

const arena = new THREE.Group();
scene.add(arena);

// Large base
addBox(
  arena,
  FIELD_X * 2 + 24,
  2,
  FLAT_Z * 2 + WALL_RADIUS * 2 + 24,
  mats.dark,
  0,
  -1.3,
  0
);

// Grass stripes
for (let i = 0; i < 22; i++) {
  addBox(
    arena,
    5,
    0.08,
    FLAT_Z * 2,
    i % 2 === 0 ? mats.grass1 : mats.grass2,
    -52.5 + i * 5,
    -0.25,
    0
  );
}

// Field markings
const lineMat = new THREE.MeshBasicMaterial({
  color: 0xeaf7ff
});

function fieldLine(x, z, width, depth) {
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.045, depth),
    lineMat
  );

  line.position.set(x, -0.17, z);
  arena.add(line);
}

fieldLine(0, 0, 0.13, FLAT_Z * 2);
fieldLine(0, -FLAT_Z, FIELD_X * 2, 0.13);
fieldLine(0, FLAT_Z, FIELD_X * 2, 0.13);
fieldLine(-FIELD_X, 0, 0.13, FLAT_Z * 2);
fieldLine(FIELD_X, 0, 0.13, FLAT_Z * 2);

const centerCircle = new THREE.Mesh(
  new THREE.RingGeometry(6.7, 6.9, 80),
  lineMat
);

centerCircle.rotation.x = -Math.PI / 2;
centerCircle.position.y = -0.14;
arena.add(centerCircle);

// Penalty areas
for (const side of [-1, 1]) {
  fieldLine(side * 38, 0, 0.13, 25);
  fieldLine(side * 45, 0, 0.13, 25);
  fieldLine(side * 41.5, -12.5, 7, 0.13);
  fieldLine(side * 41.5, 12.5, 7, 0.13);
}

// ======================================================
// CURVED WALL GEOMETRY
// ======================================================

// The side walls are curved ramps instead of flat blocks.
// Cars can drive from the floor up the curved surface.

function wallHeight(z) {
  const distance = Math.abs(z);
  const t = clamp((distance - FLAT_Z) / WALL_RADIUS, 0, 1);
  const angle = t * Math.PI / 2;

  return WALL_HEIGHT * (1 - Math.cos(angle));
}

function wallSlope(z) {
  const distance = Math.abs(z);

  if (distance <= FLAT_Z || distance >= FLAT_Z + WALL_RADIUS) {
    return 0;
  }

  const t = (distance - FLAT_Z) / WALL_RADIUS;
  const angle = t * Math.PI / 2;

  return Math.tan(angle) * WALL_HEIGHT * Math.PI / (2 * WALL_RADIUS);
}

function createCurvedWall(side) {
  const vertices = [];
  const indices = [];
  const segments = 40;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * Math.PI / 2;

    const z = side * (FLAT_Z + WALL_RADIUS * Math.sin(angle));
    const y = WALL_HEIGHT * (1 - Math.cos(angle));

    vertices.push(-FIELD_X, y, z);
    vertices.push(FIELD_X, y, z);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;

    if (side > 0) {
      indices.push(a, c, b, b, c, d);
    } else {
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );

  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const wall = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x1b3853,
      roughness: 0.42,
      metalness: 0.25,
      side: THREE.DoubleSide
    })
  );

  wall.receiveShadow = true;
  arena.add(wall);

  // Glowing top rail
  const rail = addBox(
    arena,
    FIELD_X * 2,
    0.5,
    0.5,
    mats.metal,
    0,
    WALL_HEIGHT,
    side * (FLAT_Z + WALL_RADIUS)
  );

  rail.castShadow = false;
}

createCurvedWall(-1);
createCurvedWall(1);

// End walls
for (const side of [-1, 1]) {
  addBox(
    arena,
    1.2,
    10,
    FLAT_Z * 2 + WALL_RADIUS * 2,
    mats.wall,
    side * (FIELD_X + 1),
    4,
    0
  );
}

// Transparent stadium glass
const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x65bfff,
  roughness: 0.12,
  metalness: 0.15,
  transparent: true,
  opacity: 0.1,
  side: THREE.DoubleSide
});

for (const side of [-1, 1]) {
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(
      FIELD_X * 2,
      10,
      0.2
    ),
    glassMaterial
  );

  glass.position.set(
    0,
    14,
    side * (FLAT_Z + WALL_RADIUS)
  );

  arena.add(glass);
}

// ======================================================
// STADIUM DECORATION
// ======================================================

for (const side of [-1, 1]) {
  addBox(
    arena,
    115,
    12,
    13,
    mats.dark,
    0,
    5,
    side * 55
  );

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 38; col++) {
      const seatMat = col < 19 ? mats.blue : mats.orange;

      const seat = addBox(
        arena,
        2.1,
        0.55,
        0.9,
        seatMat,
        -49 + col * 2.65,
        1 + row * 1.5,
        side * (43 + row * 2)
      );

      seat.castShadow = false;
    }
  }
}

for (let x = -48; x <= 48; x += 16) {
  addBox(arena, 0.5, 0.5, 100, mats.metal, x, 22, 0);
}

for (const x of [-45, -15, 15, 45]) {
  for (const z of [-48, 48]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.35, 18, 12),
      mats.metal
    );

    pole.position.set(x, 9, z);
    arena.add(pole);

    addBox(arena, 4, 0.6, 1.5, mats.white, x, 18.3, z);
  }
}

// ======================================================
// GOALS
// ======================================================

function createGoal(x, color, direction) {
  const group = new THREE.Group();
  scene.add(group);

  group.position.x = x;

  const frameMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.6,
    roughness: 0.2,
    emissive: color,
    emissiveIntensity: 0.5
  });

  addBox(group, 0.65, 7, 0.65, frameMat, 0, 3.5, -8);
  addBox(group, 0.65, 7, 0.65, frameMat, 0, 3.5, 8);
  addBox(group, 0.65, 0.65, 16, frameMat, 0, 7, 0);

  const netMaterial = new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.22
  });

  const net = new THREE.Mesh(
    new THREE.BoxGeometry(7, 6.5, 16),
    netMaterial
  );

  net.position.set(direction * 3.5, 3.4, 0);
  group.add(net);

  const glow = new THREE.PointLight(color, 55, 30);
  glow.position.set(x + direction * 3, 4, 0);
  scene.add(glow);

  return group;
}

createGoal(-FIELD_X, 0x168cff, 1);
createGoal(FIELD_X, 0xff7628, -1);

// ======================================================
// BALL
// ======================================================

const ballGroup = new THREE.Group();
scene.add(ballGroup);

addSphere(ballGroup, BALL_RADIUS, mats.ball, 0, 0, 0);

for (let i = 0; i < 12; i++) {
  const phi = Math.acos(1 - 2 * (i + 0.5) / 12);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;

  const normal = new THREE.Vector3(
    Math.cos(theta) * Math.sin(phi),
    Math.cos(phi),
    Math.sin(theta) * Math.sin(phi)
  );

  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(0.25, 5),
    mats.ballDark
  );

  patch.position.copy(normal).multiplyScalar(BALL_RADIUS * 0.99);
  patch.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal
  );

  ballGroup.add(patch);
}

let ballVelocity = new THREE.Vector3();

// ======================================================
// CARS
// ======================================================

function createCar(color, highlight) {
  const root = new THREE.Group();
  scene.add(root);

  const paint = material(color, 0.2, 0.65);
  const trim = material(highlight, 0.2, 0.5);
  const glass = material(0x143b5a, 0.15, 0.65);

  addBox(root, 2.6, 0.75, 4.2, paint, 0, 0.8, 0);
  addBox(root, 2.1, 0.55, 1.8, paint, 0, 1.35, 0.2);
  addBox(root, 1.8, 0.12, 1.2, glass, 0, 1.7, 0.15);

  addBox(root, 2.4, 0.16, 0.4, trim, 0, 0.95, -1.9);
  addBox(root, 2.3, 0.15, 0.3, mats.dark, 0, 1.35, 1.9);

  const wheels = [];

  for (const side of [-1, 1]) {
    for (const z of [-1.35, 1.35]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.52, 0.38, 24),
        mats.black
      );

      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.25, 0.5, z);
      wheel.castShadow = true;
      root.add(wheel);
      wheels.push(wheel);

      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.4, 20),
        mats.metal
      );

      rim.rotation.z = Math.PI / 2;
      rim.position.copy(wheel.position);
      root.add(rim);
    }

    const headlight = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.16, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xdaf7ff })
    );

    headlight.position.set(side * 0.75, 0.95, -2.12);
    root.add(headlight);

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.14, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff2828 })
    );

    tail.position.set(side * 0.75, 0.95, 2.12);
    root.add(tail);
  }

  addBox(root, 2.3, 0.15, 0.3, mats.dark, 0, 1.5, 1.8);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.38, 1.3, 14),
    new THREE.MeshBasicMaterial({
      color: highlight,
      transparent: true,
      opacity: 0.8
    })
  );

  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.8, 2.7);
  flame.visible = false;
  root.add(flame);

  const underglow = new THREE.PointLight(highlight, 18, 7);
  underglow.position.set(0, 0.4, 0);
  root.add(underglow);

  return {
    root,
    velocity: new THREE.Vector3(),
    yaw: 0,
    speed: 0,
    verticalSpeed: 0,
    grounded: true,
    boost: 100,
    wheels,
    flame,
    underglow,
    wallSide: 0,
    wallAngle: 0
  };
}

const player = createCar(0x087dff, 0x55dfff);
const rival = createCar(0xff7624, 0xffc17a);

player.root.position.set(-14, 0, 0);
rival.root.position.set(14, 0, 0);

player.yaw = -Math.PI / 2;
rival.yaw = Math.PI / 2;

function resetPositions() {
  player.root.position.set(-14, 0, 0);
  rival.root.position.set(14, 0, 0);

  player.yaw = -Math.PI / 2;
  rival.yaw = Math.PI / 2;

  for (const car of [player, rival]) {
    car.velocity.set(0, 0, 0);
    car.speed = 0;
    car.verticalSpeed = 0;
    car.grounded = true;
    car.wallSide = 0;
    car.wallAngle = 0;
    car.boost = 100;
    car.root.rotation.set(0, car.yaw, 0);
    car.flame.visible = false;
  }

  ballGroup.position.set(0, BALL_RADIUS, 0);
  ballVelocity.set(0, 0, 0);
}

// ======================================================
// AUDIO — MUCH QUIETER BY DEFAULT
// ======================================================

function initAudio() {
  if (audio) {
    if (audio.state === 'suspended') audio.resume();
    return;
  }

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return;

  audio = new AudioContextClass();

  masterGain = audio.createGain();
  musicGain = audio.createGain();
  effectsGain = audio.createGain();

  // Quiet defaults
  masterGain.gain.value = 0.16;
  musicGain.gain.value = 0.12;
  effectsGain.gain.value = 0.22;

  // Compressor prevents sudden loud peaks
  const compressor = audio.createDynamicsCompressor();

  compressor.threshold.value = -24;
  compressor.knee.value = 18;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.2;

  musicGain.connect(masterGain);
  effectsGain.connect(masterGain);
  masterGain.connect(compressor);
  compressor.connect(audio.destination);
}

function playTone(
  frequency,
  duration,
  type = 'sine',
  volume = 0.025,
  slide = 0
) {
  if (!soundEnabled || !audio) return;

  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  if (slide !== 0) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(30, frequency + slide),
      now + duration
    );
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(effectsGain);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function soundHit(power = 1) {
  playTone(
    100 + Math.min(power, 10) * 8,
    0.12,
    'triangle',
    0.025,
    -35
  );
}

function soundGoal() {
  playTone(390, 0.2, 'sine', 0.035, 100);
  playTone(520, 0.3, 'sine', 0.025, 120);
  playTone(650, 0.35, 'sine', 0.02, 100);
}

function soundClick() {
  playTone(480, 0.07, 'sine', 0.018, 80);
}

function soundJump() {
  playTone(180, 0.13, 'sine', 0.025, 130);
}

function soundBoost() {
  playTone(85, 0.16, 'triangle', 0.018, 45);
}

function soundToggle() {
  soundEnabled = !soundEnabled;

  ui.soundBtn.textContent = soundEnabled
    ? '♫ SOUND ON'
    : '♫ SOUND OFF';

  ui.soundBtn.setAttribute(
    'aria-pressed',
    String(soundEnabled)
  );

  if (masterGain && audio) {
    masterGain.gain.setTargetAtTime(
      soundEnabled ? 0.16 : 0,
      audio.currentTime,
      0.08
    );
  }
}

// ======================================================
// INPUT
// ======================================================

function forwardVector(yaw) {
  return new THREE.Vector3(
    -Math.sin(yaw),
    0,
    -Math.cos(yaw)
  );
}

function readPlayerControls() {
  return {
    throttle:
      (keys.KeyW || keys.ArrowUp ? 1 : 0) -
      (keys.KeyS || keys.ArrowDown ? 1 : 0),

    steer:
      (keys.KeyA || keys.ArrowLeft ? 1 : 0) -
      (keys.KeyD || keys.ArrowRight ? 1 : 0),

    boost: !!(keys.ShiftLeft || keys.ShiftRight),
    jump: !!keys.Space,
    brake: !!keys.KeyX
  };
}

window.addEventListener('keydown', (event) => {
  keys[event.code] = true;

  if (
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)
  ) {
    event.preventDefault();
  }

  if (event.repeat) return;

  if (event.code === 'KeyC') {
    cameraMode = (cameraMode + 1) % 3;
  }

  if (event.code === 'KeyR') {
    resetPositions();
  }

  if (event.code === 'Escape') {
    if (running) {
      running = false;
      paused = true;
      showMenu('GAME<br><span>PAUSED</span>', 'Press PLAY to continue.', 'RESUME');
    } else if (paused) {
      startMatch();
    }
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

window.addEventListener('blur', () => {
  for (const key of Object.keys(keys)) {
    keys[key] = false;
  }
});

// ======================================================
// WALL DRIVING PHYSICS
// ======================================================

function updateWallDriving(car, dt) {
  const position = car.root.position;
  const distance = Math.abs(position.z);

  if (distance < FLAT_Z - 0.5) {
    car.wallSide = 0;
    car.wallAngle = 0;
    position.y = Math.max(0, position.y);
    return;
  }

  const side = Math.sign(position.z);
  const rampDistance = clamp(
    distance - FLAT_Z,
    0,
    WALL_RADIUS
  );

  const t = rampDistance / WALL_RADIUS;
  const angle = t * Math.PI / 2;

  car.wallSide = side;
  car.wallAngle = angle;

  // Follow the curved arena surface
  position.y = wallHeight(position.z);

  // Align car body to the curved wall
  car.root.rotation.order = 'YXZ';
  car.root.rotation.y = car.yaw;
  car.root.rotation.x = side * angle;

  // Keep cars from going through the top rail
  if (distance > FLAT_Z + WALL_RADIUS) {
    position.z = side * (FLAT_Z + WALL_RADIUS);
  }
}

// ======================================================
// CAR MOVEMENT
// ======================================================

function updateCar(car, dt, controls, isPlayer = false) {
  const throttle = controls.throttle || 0;
  const steer = controls.steer || 0;

  const boosting =
    controls.boost &&
    car.boost > 0 &&
    throttle >= 0;

  const oldSpeed = car.speed;

  // Acceleration and braking
  if (throttle > 0) {
    car.speed += 24 * dt;
  } else if (throttle < 0) {
    if (car.speed > 1) {
      car.speed -= 38 * dt;
    } else {
      car.speed -= 16 * dt;
    }
  } else {
    car.speed *= Math.exp(-0.9 * dt);
  }

  if (controls.brake) {
    car.speed *= Math.exp(-7.5 * dt);

    if (Math.abs(car.speed) < 0.5) {
      car.speed = 0;
    }
  }

  if (boosting) {
    car.speed += 30 * dt;
    car.boost = Math.max(0, car.boost - 32 * dt);
  } else {
    car.boost = Math.min(100, car.boost + 10 * dt);
  }

  car.speed = clamp(
    car.speed,
    -12,
    boosting ? 39 : 26
  );

  // Steering
  const steeringPower =
    0.45 + Math.min(Math.abs(car.speed) / 15, 1.2);

  car.yaw +=
    steer *
    steeringPower *
    dt *
    (car.speed < -0.5 ? -1 : 1);

  const forward = forwardVector(car.yaw);

  // Acceleration in the direction the car faces
  const desiredX = forward.x * car.speed;
  const desiredZ = forward.z * car.speed;

  car.velocity.x = THREE.MathUtils.damp(
    car.velocity.x,
    desiredX,
    controls.brake ? 12 : 7,
    dt
  );

  car.velocity.z = THREE.MathUtils.damp(
    car.velocity.z,
    desiredZ,
    controls.brake ? 12 : 7,
    dt
  );

  // Move along the arena
  car.root.position.x += car.velocity.x * dt;
  car.root.position.z += car.velocity.z * dt;

  // Clamp length of arena
  car.root.position.x = clamp(
    car.root.position.x,
    -FIELD_X + 2,
    FIELD_X - 2
  );

  car.root.position.z = clamp(
    car.root.position.z,
    -FLAT_Z - WALL_RADIUS,
    FLAT_Z + WALL_RADIUS
  );

  // Wall height
  const distance = Math.abs(car.root.position.z);

  if (distance > FLAT_Z) {
    updateWallDriving(car, dt);
    car.grounded = true;
    car.verticalSpeed = 0;
  } else {
    car.wallSide = 0;
    car.wallAngle = 0;

    // Jumping
    if (controls.jump && car.grounded) {
      car.verticalSpeed = 8.5;
      car.grounded = false;

      if (isPlayer) soundJump();
    }

    car.verticalSpeed -= 22 * dt;
    car.root.position.y += car.verticalSpeed * dt;

    if (car.root.position.y <= 0) {
      car.root.position.y = 0;
      car.verticalSpeed = 0;
      car.grounded = true;
    }

    car.root.rotation.order = 'YXZ';
    car.root.rotation.x = 0;
    car.root.rotation.y = car.yaw;
  }

  // Wheel spin
  for (const wheel of car.wheels) {
    wheel.rotation.x += car.speed * dt * 0.8;
  }

  // Boost flame
  car.flame.visible = boosting;

  if (boosting) {
    car.flame.scale.setScalar(
      0.8 + Math.random() * 0.35
    );
  }

  car.underglow.intensity = boosting ? 28 : 12;

  if (isPlayer) {
    ui.boostFill.style.width = `${car.boost}%`;
    ui.boostValue.textContent = Math.round(car.boost);
  }

  if (isPlayer && boosting && oldSpeed < 10 && car.speed >= 10) {
    soundBoost();
  }
}

// ======================================================
// AI OPPONENT
// ======================================================

function updateAI(dt) {
  const dx = ballGroup.position.x - rival.root.position.x;
  const dz = ballGroup.position.z - rival.root.position.z;

  const desiredYaw = Math.atan2(-dx, -dz);

  let angleDifference = Math.atan2(
    Math.sin(desiredYaw - rival.yaw),
    Math.cos(desiredYaw - rival.yaw)
  );

  const steer = clamp(angleDifference * 2.2, -1, 1);
  const distance = Math.sqrt(dx * dx + dz * dz);

  const controls = {
    throttle: distance > 3 ? 1 : 0.15,
    steer,
    boost: distance > 12 && Math.abs(angleDifference) < 0.5,
    jump: ballGroup.position.y > 3 && distance < 8,
    brake: false
  };

  updateCar(rival, dt, controls, false);
}

// ======================================================
// BALL PHYSICS
// ======================================================

function updateBall(dt) {
  ballVelocity.y -= 18 * dt;

  ballGroup.position.addScaledVector(ballVelocity, dt);

  // Ground bounce
  if (ballGroup.position.y < BALL_RADIUS) {
    ballGroup.position.y = BALL_RADIUS;

    if (ballVelocity.y < -1) {
      ballVelocity.y *= -0.65;
    } else {
      ballVelocity.y = 0;
    }

    ballVelocity.x *= 0.985;
    ballVelocity.z *= 0.985;
  }

  // Side wall bounce
  const maxZ = FLAT_Z + WALL_RADIUS - BALL_RADIUS;

  if (Math.abs(ballGroup.position.z) > maxZ) {
    ballGroup.position.z =
      Math.sign(ballGroup.position.z) * maxZ;

    ballVelocity.z *= -0.7;
  }

  // End wall and goal
  const inGoal =
    Math.abs(ballGroup.position.z) < 8 &&
    ballGroup.position.y < 7;

  if (ballGroup.position.x > FIELD_X) {
    if (inGoal) {
      scoreGoal('BLUE');
      return;
    }

    ballGroup.position.x = FIELD_X;
    ballVelocity.x *= -0.7;
  }

  if (ballGroup.position.x < -FIELD_X) {
    if (inGoal) {
      scoreGoal('ORANGE');
      return;
    }

    ballGroup.position.x = -FIELD_X;
    ballVelocity.x *= -0.7;
  }

  // Ball rotation
  ballGroup.rotation.x += ballVelocity.z * dt * 0.45;
  ballGroup.rotation.z -= ballVelocity.x * dt * 0.45;

  // Car-ball collisions
  for (const car of [player, rival]) {
    const carCenter = car.root.position.clone();
    carCenter.y += 0.85;

    const difference = ballGroup.position.clone().sub(carCenter);

    const distance = difference.length();

    if (distance < 2.8) {
      if (distance < 0.001) {
        difference.set(1, 0.1, 0);
      }

      difference.normalize();

      const impact = Math.max(
        5,
        car.velocity.length() * 1.1 + 3
      );

      ballGroup.position.addScaledVector(
        difference,
        2.8 - distance + 0.03
      );

      ballVelocity.addScaledVector(difference, impact);
      ballVelocity.y += Math.max(0, car.verticalSpeed) * 0.3;

      if (distance > 2.5) {
        soundHit(car.velocity.length() * 0.3);
      }
    }
  }

  ballVelocity.multiplyScalar(Math.exp(-0.3 * dt));

  if (ballVelocity.length() > 42) {
    ballVelocity.setLength(42);
  }
}

// ======================================================
// CAMERA
// ======================================================

function updateCamera(dt) {
  const target = player.root.position.clone();
  target.y += 1.2;

  let desired;

  if (cameraMode === 0) {
    const forward = forwardVector(player.yaw);

    desired = target.clone()
      .addScaledVector(forward, -10)
      .add(new THREE.Vector3(0, 5.2, 0));
  } else if (cameraMode === 1) {
    desired = new THREE.Vector3(
      player.root.position.x,
      48,
      player.root.position.z + 5
    );
  } else {
    desired = new THREE.Vector3(
      player.root.position.x - 25,
      24,
      player.root.position.z + 30
    );
  }

  // Correct smoothing: camera approaches the target instead of flying away
  camera.position.lerp(
    desired,
    1 - Math.exp(-5.5 * dt)
  );

  camera.lookAt(target);
}

// ======================================================
// MATCH AND MENU
// ======================================================

function updateScore() {
  ui.blueScore.textContent = blueScore;
  ui.orangeScore.textContent = orangeScore;
}

function showMenu(title, subtitle, buttonText = 'PLAY') {
  ui.messageTitle.innerHTML = title;
  ui.messageSub.textContent = subtitle;
  ui.playBtn.textContent = buttonText;
  ui.message.classList.remove('hidden');
}

function startMatch() {
  initAudio();

  if (audio?.state === 'suspended') {
    audio.resume();
  }

  if (finished) {
    blueScore = 0;
    orangeScore = 0;
    timeLeft = MATCH_LENGTH;
    finished = false;
    updateScore();
  }

  resetPositions();

  running = true;
  paused = false;
  kickoff = 2;

  ui.message.classList.add('hidden');
  ui.matchStatus && (ui.matchStatus.textContent = 'KICKOFF');

  soundClick();
}

function scoreGoal(team) {
  if (!running || kickoff > 0) return;

  if (team === 'BLUE') {
    blueScore++;
  } else {
    orangeScore++;
  }

  updateScore();
  soundGoal();

  running = false;

  showMenu(
    team === 'BLUE'
      ? 'BLUE<br><span>GOAL!</span>'
      : 'ORANGE<br><span>GOAL!</span>',
    'What a shot! Get ready for kickoff.',
    'CONTINUE'
  );

  kickoff = 2.5;
}

function finishMatch() {
  running = false;
  finished = true;

  const winner =
    blueScore === orangeScore
      ? 'IT’S A DRAW!'
      : blueScore > orangeScore
        ? 'BLUE WINS!'
        : 'ORANGE WINS!';

  showMenu(
    winner,
    `FINAL SCORE: ${blueScore} - ${orangeScore}`,
    'PLAY AGAIN'
  );
}

ui.playBtn.addEventListener('click', () => {
  if (kickoff > 0 && blueScore + orangeScore > 0) {
    resetPositions();
    startMatch();
  } else {
    startMatch();
  }
});

ui.soundBtn.addEventListener('click', soundToggle);

// ======================================================
// HUD
// ======================================================

function updateHUD() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.ceil(timeLeft % 60);

  ui.timer.textContent =
    `${minutes}:${String(seconds).padStart(2, '0')}`;

  ui.boostFill.style.width = `${player.boost}%`;
  ui.boostValue.textContent = Math.round(player.boost);
}

// ======================================================
// GAME LOOP
// ======================================================

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.035);

  if (running) {
    if (kickoff > 0) {
      kickoff -= dt;
    } else {
      timeLeft -= dt;

      if (timeLeft <= 0) {
        timeLeft = 0;
        finishMatch();
      } else {
        updateCar(player, dt, readPlayerControls(), true);
        updateAI(dt);
        updateBall(dt);
      }
    }

    updateHUD();
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

// ======================================================
// RESIZE
// ======================================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 1.6)
  );
});

// ======================================================
// START
// ======================================================

resetPositions();

camera.position.set(-25, 16, 25);
camera.lookAt(0, 0, 0);

ui.soundBtn.textContent = '♫ SOUND ON';

showMenu(
  'ROCKET<br><span>SOCCER</span>',
  'A bigger arena. Better cars. Bigger plays.',
  'KICK OFF'
);

animate();
