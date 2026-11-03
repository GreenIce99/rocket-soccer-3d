
import * as THREE from "three";
import "./style.css";

// ======================================================
// ROCKET SOCCER 3D
// ======================================================

const game = document.getElementById("game");

if (!game) {
  throw new Error('Missing #game element in index.html');
}

const ui = {
  blueScore: document.getElementById("blueScore"),
  orangeScore: document.getElementById("orangeScore"),
  timer: document.getElementById("timer"),
  boostFill: document.getElementById("boostFill"),
  boostValue: document.getElementById("boostValue"),
  message: document.getElementById("message"),
  messageTitle: document.getElementById("messageTitle"),
  messageSub: document.getElementById("messageSub"),
  playBtn: document.getElementById("playBtn")
};

const FIELD_X = 46;
const FIELD_Z = 30;
const BALL_RADIUS = 0.9;
const MATCH_TIME = 180;

let blueScore = 0;
let orangeScore = 0;
let timeLeft = MATCH_TIME;
let blueBoost = 100;
let orangeBoost = 100;

let started = false;
let paused = false;
let gameOver = false;
let cameraMode = 0;
let kickoffTimer = 0;
let goalMessageTimer = 0;
let countdownValue = 0;

const keys = {};
const clock = new THREE.Clock();

// ======================================================
// SCENE AND RENDERER
// ======================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071426);
scene.fog = new THREE.Fog(0x071426, 100, 190);

const camera = new THREE.PerspectiveCamera(
  68,
  window.innerWidth / window.innerHeight,
  0.1,
  350
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

game.insertBefore(renderer.domElement, game.firstChild);

// ======================================================
// LIGHTING
// ======================================================

scene.add(
  new THREE.HemisphereLight(0xa9d9ff, 0x243447, 2.1)
);

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-25, 55, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -65;
sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65;
sun.shadow.camera.bottom = -65;
sun.shadow.bias = -0.0003;
scene.add(sun);

const blueGlow = new THREE.PointLight(0x168cff, 65, 48);
blueGlow.position.set(-39, 8, 0);
scene.add(blueGlow);

const orangeGlow = new THREE.PointLight(0xff781d, 65, 48);
orangeGlow.position.set(39, 8, 0);
scene.add(orangeGlow);

// ======================================================
// MATERIALS
// ======================================================

function material(color, roughness = 0.65, metalness = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

const grassMat = material(0x167b42, 0.95);
const stripeMat = material(0x116b39, 0.95);
const blueMat = material(0x087cff, 0.28, 0.48);
const orangeMat = material(0xff741c, 0.28, 0.42);
const blueGlass = material(0x80d8ff, 0.18, 0.25);
const orangeGlass = material(0xffd0a0, 0.2, 0.2);
const rubberMat = material(0x10141b, 0.95);
const metalMat = material(0x8da5bb, 0.28, 0.8);
const darkMetalMat = material(0x202c3c, 0.5, 0.65);
const ballMat = material(0xf4f7fb, 0.3, 0.12);
const darkBallMat = material(0x263342, 0.45, 0.2);

const lineMat = new THREE.MeshBasicMaterial({
  color: 0xeaf8ff
});

// ======================================================
// HELPER FUNCTIONS
// ======================================================

function addBox(parent, width, height, depth, mat, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
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
    new THREE.SphereGeometry(radius, 16, 12),
    mat
  );

  mesh.position.set(x, y, z);
  parent.add(mesh);

  return mesh;
}

function forwardVector(yaw) {
  return new THREE.Vector3(
    Math.cos(yaw),
    0,
    Math.sin(yaw)
  );
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

// ======================================================
// FIELD
// ======================================================

const field = new THREE.Mesh(
  new THREE.BoxGeometry(FIELD_X * 2, 1, FIELD_Z * 2),
  grassMat
);

field.position.y = -0.55;
field.receiveShadow = true;
scene.add(field);

// Alternating grass stripes
for (let i = 0; i < 12; i++) {
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(7.65, 0.025, FIELD_Z * 2),
    stripeMat
  );

  stripe.position.set(-42.15 + i * 7.65, -0.035, 0);
  scene.add(stripe);
}

function addFieldLine(x, z, width, depth) {
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.035, depth),
    lineMat
  );

  line.position.set(x, 0.025, z);
  scene.add(line);
}

addFieldLine(0, 0, 0.15, FIELD_Z * 2);
addFieldLine(0, -FIELD_Z, FIELD_X * 2, 0.15);
addFieldLine(0, FIELD_Z, FIELD_X * 2, 0.15);
addFieldLine(-FIELD_X, 0, 0.15, FIELD_Z * 2);
addFieldLine(FIELD_X, 0, 0.15, FIELD_Z * 2);

// Center circle
const centerCircle = new THREE.Mesh(
  new THREE.RingGeometry(5.8, 6, 80),
  lineMat
);

centerCircle.rotation.x = -Math.PI / 2;
centerCircle.position.y = 0.045;
scene.add(centerCircle);

const centerSpot = new THREE.Mesh(
  new THREE.CircleGeometry(0.22, 24),
  lineMat
);

centerSpot.rotation.x = -Math.PI / 2;
centerSpot.position.y = 0.05;
scene.add(centerSpot);

// Penalty area markings
for (const side of [-1, 1]) {
  addFieldLine(side * 34, 0, 0.13, 18);
  addFieldLine(side * 39, 0, 0.13, 18);
  addFieldLine(side * 36.5, -9, 5, 0.13);
  addFieldLine(side * 36.5, 9, 5, 0.13);
}

// ======================================================
// STADIUM
// ======================================================

const wallMat = material(0x18334c, 0.35, 0.35);

function addWall(x, y, z, width, height, depth) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    wallMat
  );

  wall.position.set(x, y, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(width, 7, depth * 0.35),
    new THREE.MeshStandardMaterial({
      color: 0x6abfff,
      roughness: 0.2,
      transparent: true,
      opacity: 0.13
    })
  );

  glass.position.set(x, y + height / 2 + 3.5, z);
  scene.add(glass);
}

addWall(0, 1.2, -FIELD_Z - 0.5, FIELD_X * 2, 2.4, 1);
addWall(0, 1.2, FIELD_Z + 0.5, FIELD_X * 2, 2.4, 1);

// Stadium stands
const standMat = material(0x101f34, 0.85);
const seatBlueMat = material(0x1261a8, 0.7);
const seatOrangeMat = material(0x9a4a1b, 0.7);

for (const side of [-1, 1]) {
  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(100, 10, 12),
    standMat
  );

  stand.position.set(0, 5, side * 41);
  stand.receiveShadow = true;
  scene.add(stand);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 34; col++) {
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.55, 0.8),
        col < 17 ? seatBlueMat : seatOrangeMat
      );

      seat.position.set(
        -43 + col * 2.6,
        1.2 + row * 1.5,
        side * (35 + row * 2.5)
      );

      scene.add(seat);
    }
  }
}

// Roof beams
for (let x = -42; x <= 42; x += 14) {
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.65, 90),
    darkMetalMat
  );

  beam.position.set(x, 17, 0);
  scene.add(beam);
}

// Floodlights
for (const x of [-35, -12, 12, 35]) {
  for (const z of [-39, 39]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.32, 13, 10),
      darkMetalMat
    );

    pole.position.set(x, 8, z);
    scene.add(pole);

    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.5, 1.4),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );

    lamp.position.set(x, 15, z);
    scene.add(lamp);

    const glow = new THREE.PointLight(0xc5e8ff, 28, 60);
    glow.position.set(x, 14, z);
    scene.add(glow);
  }
}

// ======================================================
// GOALS
// ======================================================

function createGoal(x, color, direction) {
  const group = new THREE.Group();
  const frameMat = material(color, 0.22, 0.65);
  const glowMat = new THREE.MeshBasicMaterial({ color });

  function frame(width, height, depth, px, py, pz) {
    const part = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      frameMat
    );

    part.position.set(px, py, pz);
    part.castShadow = true;
    group.add(part);
  }

  frame(0.65, 5.6, 0.65, 0, 2.8, -7.6);
  frame(0.65, 5.6, 0.65, 0, 2.8, 7.6);
  frame(0.65, 0.65, 15.8, 0, 5.6, 0);

  const netMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.42
  });

  for (let z = -7; z <= 7; z += 1.4) {
    const points = [
      new THREE.Vector3(direction * 0.5, 0.2, z),
      new THREE.Vector3(direction * 7, 0.2, z),
      new THREE.Vector3(direction * 7, 5.4, z)
    ];

    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        netMat
      )
    );
  }

  for (let y = 1; y <= 5; y++) {
    const points = [
      new THREE.Vector3(direction * 0.5, y, -7.5),
      new THREE.Vector3(direction * 7, y, -7.5),
      new THREE.Vector3(direction * 7, y, 7.5),
      new THREE.Vector3(direction * 0.5, y, 7.5)
    ];

    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        netMat
      )
    );
  }

  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 4.8, 14.5),
    glowMat
  );

  glow.position.set(-direction * 0.25, 2.6, 0);
  group.add(glow);

  group.position.x = x;
  scene.add(group);
}

createGoal(-FIELD_X, 0x168cff, -1);
createGoal(FIELD_X, 0xff7a22, 1);

// ======================================================
// CAR MODELS
// Cars face local +X.
// ======================================================

function createCar(bodyMat, glassMat, teamColor) {
  const car = new THREE.Group();
  const wheels = [];
  const exhausts = [];

  // Main body
  addBox(car, 2.8, 0.62, 1.65, bodyMat, 0, 0.72, 0);
  addBox(car, 1.0, 0.2, 1.55, bodyMat, 0.9, 1.08, 0);

  // Cabin
  addBox(car, 1.25, 0.72, 1.25, glassMat, -0.18, 1.28, 0);
  addBox(car, 0.9, 0.12, 1.28, bodyMat, -0.2, 1.66, 0);

  // Bumpers and side skirts
  addBox(car, 0.22, 0.28, 1.75, darkMetalMat, 1.48, 0.54, 0);
  addBox(car, 0.2, 0.28, 1.75, darkMetalMat, -1.48, 0.54, 0);

  for (const z of [-0.82, 0.82]) {
    addBox(car, 2.1, 0.18, 0.12, darkMetalMat, 0, 0.45, z);
  }

  // Rear spoiler
  addBox(car, 0.18, 0.55, 0.16, darkMetalMat, -1.1, 1.15, -0.55);
  addBox(car, 0.18, 0.55, 0.16, darkMetalMat, -1.1, 1.15, 0.55);
  addBox(car, 0.3, 0.12, 1.55, bodyMat, -1.1, 1.45, 0);

  // Wheels
  const tireGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.32, 24);
  const hubGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 16);
  const hubMat = material(teamColor, 0.25, 0.7);

  for (const x of [-0.9, 0.95]) {
    for (const z of [-0.88, 0.88]) {
      const wheel = new THREE.Group();

      const tire = new THREE.Mesh(tireGeometry, rubberMat);
      tire.rotation.x = Math.PI / 2;
      tire.castShadow = true;
      wheel.add(tire);

      const hub = new THREE.Mesh(hubGeometry, hubMat);
      hub.rotation.x = Math.PI / 2;
      wheel.add(hub);

      wheel.position.set(x, 0.43, z);
      car.add(wheel);
      wheels.push(wheel);
    }
  }

  // Headlights and taillights
  for (const z of [-0.55, 0.55]) {
    addSphere(
      car, 0.13,
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      1.45, 0.82, z
    );

    addSphere(
      car, 0.12,
      new THREE.MeshBasicMaterial({ color: 0xff263e }),
      -1.47, 0.8, z
    );
  }

  // Team stripe
  addBox(car, 1.7, 0.045, 0.12, hubMat, 0, 1.045, 0);

  // Boost exhausts
  for (const z of [-0.48, 0.48]) {
    const exhaust = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.85, 12),
      new THREE.MeshBasicMaterial({
        color: teamColor,
        transparent: true,
        opacity: 0.85
      })
    );

    exhaust.rotation.z = Math.PI / 2;
    exhaust.position.set(-1.75, 0.58, z);
    exhaust.visible = false;
    car.add(exhaust);
    exhausts.push(exhaust);
  }

  car.userData.wheels = wheels;
  car.userData.exhausts = exhausts;

  scene.add(car);
  return car;
}

const blueCar = createCar(blueMat, blueGlass, 0x45caff);
const orangeCar = createCar(orangeMat, orangeGlass, 0xffa14a);

// ======================================================
// BALL
// ======================================================

const ball = new THREE.Group();

const ballCore = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_RADIUS, 32, 24),
  ballMat
);

ballCore.castShadow = true;
ballCore.receiveShadow = true;
ball.add(ballCore);

// Dark ball panels
for (let i = 0; i < 8; i++) {
  const patch = new THREE.Mesh(
    new THREE.SphereGeometry(
      BALL_RADIUS * 1.006,
      8,
      6,
      (i / 8) * Math.PI * 2,
      Math.PI / 4,
      0.8,
      0.9
    ),
    darkBallMat
  );

  ball.add(patch);
}

const ballRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.02, 0.025, 6, 48),
  new THREE.MeshBasicMaterial({ color: 0x8dcfff })
);

ballRing.rotation.x = Math.PI / 2;
ball.add(ballRing);
scene.add(ball);

const ballVelocity = new THREE.Vector3();

// ======================================================
// PLAYER AND AI STATE
// ======================================================

const blueVelocity = new THREE.Vector3();
const orangeVelocity = new THREE.Vector3();

let blueYaw = 0;
let orangeYaw = Math.PI;

let blueVerticalVelocity = 0;
let orangeVerticalVelocity = 0;

let blueOnGround = true;
let orangeOnGround = true;
let blueJumpPressed = false;

// ======================================================
// CAR VISUAL ANIMATION
// ======================================================

function updateCarVisuals(car, velocity, boosting, dt) {
  for (const wheel of car.userData.wheels) {
    wheel.rotation.x += velocity.length() * dt * 0.8;
  }

  for (const exhaust of car.userData.exhausts) {
    exhaust.visible = boosting;

    if (boosting) {
      exhaust.scale.setScalar(0.85 + Math.random() * 0.35);
    }
  }
}

// ======================================================
// KEEP CARS INSIDE THE FIELD
// ======================================================

function limitCarPosition(car, velocity) {
  const limitX = FIELD_X - 2.2;
  const limitZ = FIELD_Z - 2.2;

  if (car.position.x < -limitX) {
    car.position.x = -limitX;
    velocity.x = Math.max(0, velocity.x);
  }

  if (car.position.x > limitX) {
    car.position.x = limitX;
    velocity.x = Math.min(0, velocity.x);
  }

  if (car.position.z < -limitZ) {
    car.position.z = -limitZ;
    velocity.z = Math.max(0, velocity.z);
  }

  if (car.position.z > limitZ) {
    car.position.z = limitZ;
    velocity.z = Math.min(0, velocity.z);
  }
}

// ======================================================
// PLAYER CONTROLS
// ======================================================

function updatePlayer(dt) {
  const forward = forwardVector(blueYaw);

  let throttle = 0;
  let steering = 0;

  if (keys.KeyW || keys.ArrowUp) throttle += 1;
  if (keys.KeyS || keys.ArrowDown) throttle -= 1;

  // A = left, D = right.
  if (keys.KeyA || keys.ArrowLeft) steering -= 1;
  if (keys.KeyD || keys.ArrowRight) steering += 1;

  const speed = blueVelocity.length();
  const directionSign = throttle < 0 ? -1 : 1;

  if (throttle !== 0) {
    blueVelocity.addScaledVector(forward, throttle * 34 * dt);
  }

  if (speed > 0.5 && steering !== 0) {
    const steeringPower = THREE.MathUtils.clamp(speed / 9, 0.25, 1);
    blueYaw += steering * 2.45 * dt * directionSign * steeringPower;
  }

  const boosting =
    (keys.ShiftLeft || keys.ShiftRight) && blueBoost > 0;

  if (boosting) {
    blueVelocity.addScaledVector(forward, 48 * dt);
    blueBoost = Math.max(0, blueBoost - 34 * dt);
  } else {
    blueBoost = Math.min(100, blueBoost + 16 * dt);
  }

  const maxSpeed = boosting ? 39 : 27;

  if (blueVelocity.length() > maxSpeed) {
    blueVelocity.setLength(maxSpeed);
  }

  blueVelocity.multiplyScalar(Math.pow(0.986, dt * 60));
  blueCar.position.addScaledVector(blueVelocity, dt);

  // Jump once per key press.
  if (keys.Space && !blueJumpPressed && blueOnGround) {
    blueVerticalVelocity = 10.5;
    blueOnGround = false;
    blueJumpPressed = true;
  }

  if (!keys.Space) {
    blueJumpPressed = false;
  }

  blueVerticalVelocity -= 25 * dt;
  blueCar.position.y += blueVerticalVelocity * dt;

  if (blueCar.position.y <= 0) {
    blueCar.position.y = 0;
    blueVerticalVelocity = 0;
    blueOnGround = true;
  }

  blueCar.rotation.y = -blueYaw;

  limitCarPosition(blueCar, blueVelocity);
  updateCarVisuals(blueCar, blueVelocity, boosting, dt);
}

// ======================================================
// AI OPPONENT
// ======================================================

function updateAI(dt) {
  // Approach the ball from the orange side.
  const target = new THREE.Vector3(
    THREE.MathUtils.clamp(ball.position.x + 3.2, -41, 41),
    0,
    THREE.MathUtils.clamp(ball.position.z, -25, 25)
  );

  const dx = target.x - orangeCar.position.x;
  const dz = target.z - orangeCar.position.z;
  const distance = Math.hypot(dx, dz);

  const desiredYaw = Math.atan2(dz, dx);
  const angle = normalizeAngle(desiredYaw - orangeYaw);

  orangeYaw += THREE.MathUtils.clamp(angle, -4.2 * dt, 4.2 * dt);

  const forward = forwardVector(orangeYaw);
  const ballDistance = orangeCar.position.distanceTo(ball.position);

  orangeVelocity.addScaledVector(
    forward,
    (distance > 4 ? 31 : 18) * dt
  );

  if (ballDistance > 6 && orangeBoost > 0) {
    orangeVelocity.addScaledVector(forward, 20 * dt);
    orangeBoost = Math.max(0, orangeBoost - 25 * dt);
  } else {
    orangeBoost = Math.min(100, orangeBoost + 15 * dt);
  }

  if (orangeVelocity.length() > 28) {
    orangeVelocity.setLength(28);
  }

  orangeVelocity.multiplyScalar(Math.pow(0.987, dt * 60));
  orangeCar.position.addScaledVector(orangeVelocity, dt);

  if (ball.position.y > 2.1 && ballDistance < 5.5 && orangeOnGround) {
    orangeVerticalVelocity = 8.5;
    orangeOnGround = false;
  }

  orangeVerticalVelocity -= 25 * dt;
  orangeCar.position.y += orangeVerticalVelocity * dt;

  if (orangeCar.position.y <= 0) {
    orangeCar.position.y = 0;
    orangeVerticalVelocity = 0;
    orangeOnGround = true;
  }

  orangeCar.rotation.y = -orangeYaw;

  limitCarPosition(orangeCar, orangeVelocity);

  updateCarVisuals(
    orangeCar,
    orangeVelocity,
    ballDistance > 6 && orangeBoost > 0,
    dt
  );
}

// ======================================================
// CAR / BALL COLLISION
// ======================================================

function collideCarWithBall(car, velocity, yaw, isAI) {
  const carCenter = new THREE.Vector3(
    car.position.x,
    car.position.y + 0.65,
    car.position.z
  );

  const difference = new THREE.Vector3(
    ball.position.x - carCenter.x,
    0,
    ball.position.z - carCenter.z
  );

  const distance = difference.length();
  const collisionDistance = 2.15;

  if (distance >= collisionDistance || distance < 0.001) {
    return;
  }

  const normal = difference.normalize();
  const forward = forwardVector(yaw);

  if (normal.dot(forward) < -0.55) {
    return;
  }

  const impactSpeed = Math.max(0, velocity.dot(normal));
  const push = (isAI ? 12 : 10) + impactSpeed * 0.9;

  ballVelocity.x += normal.x * push + forward.x * 3;
  ballVelocity.z += normal.z * push + forward.z * 3;
  ballVelocity.y = Math.max(
    ballVelocity.y,
    3.2 + impactSpeed * 0.12
  );

  const overlap = collisionDistance - distance;

  ball.position.x += normal.x * (overlap + 0.04);
  ball.position.z += normal.z * (overlap + 0.04);

  if (ballVelocity.length() > 39) {
    ballVelocity.setLength(39);
  }
}

// ======================================================
// BALL PHYSICS
// ======================================================

function updateBall(dt) {
  ballVelocity.y -= 22 * dt;
  ball.position.addScaledVector(ballVelocity, dt);

  // Ground collision
  if (ball.position.y < BALL_RADIUS) {
    ball.position.y = BALL_RADIUS;

    if (ballVelocity.y < -1.2) {
      ballVelocity.y *= -0.62;
    } else {
      ballVelocity.y = 0;
    }

    ballVelocity.x *= Math.pow(0.985, dt * 60);
    ballVelocity.z *= Math.pow(0.985, dt * 60);
  }

  // Side walls
  if (ball.position.z > FIELD_Z - BALL_RADIUS) {
    ball.position.z = FIELD_Z - BALL_RADIUS;
    ballVelocity.z = -Math.abs(ballVelocity.z) * 0.78;
  }

  if (ball.position.z < -FIELD_Z + BALL_RADIUS) {
    ball.position.z = -FIELD_Z + BALL_RADIUS;
    ballVelocity.z = Math.abs(ballVelocity.z) * 0.78;
  }

  // End walls, with openings for the goals
  const inGoalMouth =
    Math.abs(ball.position.z) < 7.3 &&
    ball.position.y < 5.2;

  if (!inGoalMouth) {
    if (ball.position.x > FIELD_X - BALL_RADIUS) {
      ball.position.x = FIELD_X - BALL_RADIUS;
      ballVelocity.x = -Math.abs(ballVelocity.x) * 0.78;
    }

    if (ball.position.x < -FIELD_X + BALL_RADIUS) {
      ball.position.x = -FIELD_X + BALL_RADIUS;
      ballVelocity.x = Math.abs(ballVelocity.x) * 0.78;
    }
  }

  collideCarWithBall(blueCar, blueVelocity, blueYaw, false);
  collideCarWithBall(orangeCar, orangeVelocity, orangeYaw, true);

  ballVelocity.multiplyScalar(Math.pow(0.9985, dt * 60));

  if (ballVelocity.length() > 43) {
    ballVelocity.setLength(43);
  }

  ballCore.rotation.z += ballVelocity.x * dt * 0.35;
  ballCore.rotation.x -= ballVelocity.z * dt * 0.35;
  ball.rotation.y += ballVelocity.x * dt * 0.04;
}

// ======================================================
// HUD
// ======================================================

function updateScore() {
  if (ui.blueScore) ui.blueScore.textContent = blueScore;
  if (ui.orangeScore) ui.orangeScore.textContent = orangeScore;
}

function updateTimer() {
  if (!ui.timer) return;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);

  ui.timer.textContent =
    `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function updateBoost() {
  const amount = Math.round(blueBoost);

  if (ui.boostValue) {
    ui.boostValue.textContent = amount;
  }

  if (ui.boostFill) {
    ui.boostFill.style.width = `${amount}%`;
  }
}

function showMessage(title, subtitle) {
  if (!ui.message) return;

  ui.messageTitle.textContent = title;
  ui.messageSub.textContent = subtitle;
  ui.message.classList.remove("hidden");
}

function hideMessage() {
  if (ui.message) {
    ui.message.classList.add("hidden");
  }
}

// ======================================================
// RESET AND KICKOFF
// ======================================================

function resetPositions() {
  blueCar.position.set(-13, 0, 0);
  orangeCar.position.set(13, 0, 0);
  ball.position.set(0, BALL_RADIUS, 0);

  blueVelocity.set(0, 0, 0);
  orangeVelocity.set(0, 0, 0);
  ballVelocity.set(0, 0, 0);

  blueYaw = 0;
  orangeYaw = Math.PI;

  blueVerticalVelocity = 0;
  orangeVerticalVelocity = 0;

  blueOnGround = true;
  orangeOnGround = true;
  blueJumpPressed = false;

  blueBoost = 100;
  orangeBoost = 100;
}

function beginKickoff() {
  resetPositions();

  kickoffTimer = 3;
  countdownValue = 3;
  goalMessageTimer = 0;
  paused = false;

  if (ui.playBtn) {
    ui.playBtn.textContent = "PLAY";
  }

  showMessage("3", "GET READY!");
}

function scoreGoal(team) {
  if (team === "blue") {
    blueScore++;
    showMessage("BLUE SCORES!", "Great shot! Get ready...");
  } else {
    orangeScore++;
    showMessage("ORANGE SCORES!", "The opponent scored. Get ready...");
  }

  updateScore();
  resetPositions();

  paused = true;
  goalMessageTimer = 2;
}

function checkGoals() {
  if (
    ball.position.x >= FIELD_X - 0.6 &&
    Math.abs(ball.position.z) < 7.2 &&
    ball.position.y < 5.1
  ) {
    scoreGoal("blue");
    return;
  }

  if (
    ball.position.x <= -FIELD_X + 0.6 &&
    Math.abs(ball.position.z) < 7.2 &&
    ball.position.y < 5.1
  ) {
    scoreGoal("orange");
  }
}

// ======================================================
// MATCH END
// ======================================================

function finishGame() {
  gameOver = true;
  paused = true;

  let title = "IT'S A DRAW!";

  if (blueScore > orangeScore) title = "YOU WIN!";
  if (orangeScore > blueScore) title = "AI WINS!";

  showMessage(
    title,
    `Final score: ${blueScore} - ${orangeScore}`
  );

  if (ui.playBtn) {
    ui.playBtn.textContent = "PLAY AGAIN";
  }
}

// ======================================================
// CAMERA
// ======================================================

const cameraTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();

function updateCamera(dt) {
  if (cameraMode === 0) {
    const forward = forwardVector(blueYaw);

    desiredCameraPosition
      .copy(blueCar.position)
      .addScaledVector(forward, -11.5);

    desiredCameraPosition.y += 5.5;

    cameraTarget
      .copy(blueCar.position)
      .addScaledVector(forward, 5.5);

    cameraTarget.y += 1.25;

    camera.position.lerp(
      desiredCameraPosition,
      1 - Math.exp(-5.5 * dt)
    );

    camera.lookAt(cameraTarget);
  } else {
    desiredCameraPosition.set(0, 65, 0.1);
    cameraTarget.set(0, 0, 0);

    camera.position.lerp(
      desiredCameraPosition,
      1 - Math.exp(-4 * dt)
    );

    camera.lookAt(cameraTarget);
  }
}

// ======================================================
// START / PAUSE
// ======================================================

function startGame() {
  if (gameOver) {
    blueScore = 0;
    orangeScore = 0;
    timeLeft = MATCH_TIME;
    gameOver = false;

    updateScore();
    updateTimer();
  }

  started = true;
  paused = false;

  if (ui.playBtn) {
    ui.playBtn.textContent = "PLAY";
  }

  beginKickoff();
  clock.getDelta();
}

if (ui.playBtn) {
  ui.playBtn.addEventListener("click", () => {
    if (goalMessageTimer > 0) return;

    if (
      started &&
      paused &&
      !gameOver &&
      kickoffTimer <= 0
    ) {
      paused = false;
      hideMessage();

      ui.playBtn.textContent = "PLAY";
      clock.getDelta();
      return;
    }

    startGame();
  });
}

// ======================================================
// KEYBOARD
// ======================================================

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;

  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)
  ) {
    event.preventDefault();
  }

  if (event.repeat) return;

  if (event.code === "Escape" && started && !gameOver) {
    if (paused && goalMessageTimer <= 0 && kickoffTimer <= 0) {
      paused = false;
      hideMessage();

      if (ui.playBtn) {
        ui.playBtn.textContent = "PLAY";
      }
    } else if (!paused && kickoffTimer <= 0) {
      paused = true;
      showMessage("PAUSED", "Press RESUME to continue.");

      if (ui.playBtn) {
        ui.playBtn.textContent = "RESUME";
      }
    }
  }

  if (event.code === "KeyC") {
    cameraMode = cameraMode === 0 ? 1 : 0;
  }

  if (event.code === "KeyR" && started && !gameOver) {
    resetPositions();
    beginKickoff();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

window.addEventListener("blur", () => {
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
});

// ======================================================
// RESIZE
// ======================================================

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.75)
  );
});

// ======================================================
// MAIN GAME LOOP
// ======================================================

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);

  if (started && !gameOver) {
    // Goal celebration runs while the match is paused.
    if (goalMessageTimer > 0) {
      goalMessageTimer -= dt;

      if (goalMessageTimer <= 0) {
        goalMessageTimer = 0;
        beginKickoff();
      }
    } else if (!paused) {
      if (kickoffTimer > 0) {
        kickoffTimer -= dt;

        const nextNumber = Math.ceil(kickoffTimer);

        if (nextNumber > 0 && nextNumber !== countdownValue) {
          countdownValue = nextNumber;
          showMessage(String(nextNumber), "GET READY!");
        }

        if (kickoffTimer <= 0) {
          kickoffTimer = 0;
          hideMessage();
        }
      } else {
        updatePlayer(dt);
        updateAI(dt);
        updateBall(dt);
        checkGoals();

        if (!paused) {
          timeLeft -= dt;

          if (timeLeft <= 0) {
            timeLeft = 0;
            finishGame();
          }
        }
      }
    }

    updateTimer();
    updateBoost();
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

// ======================================================
// INITIAL SETUP
// ======================================================

resetPositions();
updateScore();
updateTimer();
updateBoost();

camera.position.set(-24, 16, 0);
camera.lookAt(0, 0, 0);

animate();
