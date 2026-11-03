import * as THREE from "three";
import "./style.css";

// =====================================================
// ROCKET SOCCER 3D — COMPLETE GAME ENGINE
// =====================================================

const app = document.querySelector("#app");

if (!app) {
  throw new Error('Could not find "#app" in index.html.');
}

// -----------------------------------------------------
// GAME SETTINGS
// -----------------------------------------------------

const FIELD_X = 46;
const FIELD_Z = 30;
const WALL_HEIGHT = 3;
const BALL_RADIUS = 0.85;
const CAR_RADIUS = 1.25;
const MATCH_LENGTH = 180;

let blueScore = 0;
let orangeScore = 0;
let timeLeft = MATCH_LENGTH;

let gameStarted = false;
let paused = false;
let gameOver = false;

let blueBoost = 100;
let orangeBoost = 100;

let blueYaw = 0;
let orangeYaw = Math.PI;

let jumpVelocity = 0;
let orangeJumpVelocity = 0;

const keys = {};
const clock = new THREE.Clock();

// -----------------------------------------------------
// SCENE
// -----------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x83c9f5);
scene.fog = new THREE.Fog(0x83c9f5, 65, 145);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);

camera.position.set(0, 13, 22);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

app.appendChild(renderer.domElement);

// -----------------------------------------------------
// LIGHTING
// -----------------------------------------------------

const ambientLight = new THREE.HemisphereLight(
  0xffffff,
  0x426078,
  2
);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(-20, 45, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(sun);

// -----------------------------------------------------
// MATERIALS
// -----------------------------------------------------

const materials = {
  grass: new THREE.MeshStandardMaterial({
    color: 0x168b43,
    roughness: 0.9
  }),
  darkGrass: new THREE.MeshStandardMaterial({
    color: 0x11783a,
    roughness: 0.9
  }),
  white: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.65
  }),
  blue: new THREE.MeshStandardMaterial({
    color: 0x087bff,
    metalness: 0.35,
    roughness: 0.3
  }),
  blueGlass: new THREE.MeshStandardMaterial({
    color: 0x8edaff,
    metalness: 0.4,
    roughness: 0.15
  }),
  orange: new THREE.MeshStandardMaterial({
    color: 0xff7518,
    metalness: 0.3,
    roughness: 0.35
  }),
  orangeGlass: new THREE.MeshStandardMaterial({
    color: 0xffd19a,
    metalness: 0.3,
    roughness: 0.2
  }),
  black: new THREE.MeshStandardMaterial({
    color: 0x171b24,
    roughness: 0.65
  }),
  ball: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.05
  })
};

// -----------------------------------------------------
// FIELD
// -----------------------------------------------------

const field = new THREE.Mesh(
  new THREE.BoxGeometry(FIELD_X * 2, 1, FIELD_Z * 2),
  materials.grass
);

field.position.y = -0.55;
field.receiveShadow = true;
scene.add(field);

// Grass stripes
for (let i = 0; i < 12; i++) {
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(7.65, 0.025, FIELD_Z * 2),
    materials.darkGrass
  );

  stripe.position.set(-42.15 + i * 7.65, -0.035, 0);
  scene.add(stripe);
}

// Field markings
function makeLine(x, z, width, depth) {
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.035, depth),
    materials.white
  );

  line.position.set(x, 0.025, z);
  scene.add(line);
}

makeLine(0, 0, 0.16, FIELD_Z * 2);
makeLine(0, -FIELD_Z, FIELD_X * 2, 0.16);
makeLine(0, FIELD_Z, FIELD_X * 2, 0.16);
makeLine(-FIELD_X, 0, 0.16, FIELD_Z * 2);
makeLine(FIELD_X, 0, 0.16, FIELD_Z * 2);

const centerCircle = new THREE.Mesh(
  new THREE.RingGeometry(5.8, 6, 64),
  materials.white
);
centerCircle.rotation.x = -Math.PI / 2;
centerCircle.position.y = 0.035;
scene.add(centerCircle);

// -----------------------------------------------------
// WALLS
// -----------------------------------------------------

function createWall(x, z, width, depth, height = WALL_HEIGHT) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: 0x27445a,
      transparent: true,
      opacity: 0.45,
      roughness: 0.4
    })
  );

  wall.position.set(x, height / 2, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}

createWall(0, -FIELD_Z - 0.5, FIELD_X * 2, 1);
createWall(0, FIELD_Z + 0.5, FIELD_X * 2, 1);
createWall(-FIELD_X - 0.5, 0, 1, FIELD_Z * 2);
createWall(FIELD_X + 0.5, 0, 1, FIELD_Z * 2);

// -----------------------------------------------------
// GOALS
// -----------------------------------------------------

function createGoal(x, color, direction) {
  const group = new THREE.Group();

  const frameMaterial = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.55,
    roughness: 0.25
  });

  const postHeight = 5;
  const goalWidth = 15;
  const goalDepth = 5;

  const leftPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, postHeight, 0.55),
    frameMaterial
  );

  leftPost.position.set(0, postHeight / 2, -goalWidth / 2);
  group.add(leftPost);

  const rightPost = leftPost.clone();
  rightPost.position.z = goalWidth / 2;
  group.add(rightPost);

  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, goalWidth),
    frameMaterial
  );

  crossbar.position.set(0, postHeight, 0);
  group.add(crossbar);

  const net = new THREE.Mesh(
    new THREE.BoxGeometry(goalDepth, postHeight, goalWidth),
    new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    })
  );

  net.position.x = direction * goalDepth / 2;
  net.position.y = postHeight / 2;
  group.add(net);

  group.position.x = x;
  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
    }
  });

  scene.add(group);
  return group;
}

createGoal(-FIELD_X, 0x168bff, -1);
createGoal(FIELD_X, 0xff7518, 1);

// -----------------------------------------------------
// CAR CREATION
// -----------------------------------------------------

function createCar(colorMaterial, glassMaterial) {
  const car = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.75, 1.45),
    colorMaterial
  );

  body.position.y = 0.75;
  body.castShadow = true;
  car.add(body);

  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.25, 1.35),
    colorMaterial
  );

  hood.position.set(0.75, 1.05, 0);
  car.add(hood);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.65, 1.15),
    glassMaterial
  );

  cabin.position.set(-0.15, 1.35, 0);
  cabin.castShadow = true;
  car.add(cabin);

  // Front bumper
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.3, 1.5),
    materials.black
  );

  bumper.position.set(1.32, 0.55, 0);
  car.add(bumper);

  // Wheels
  const wheelGeometry = new THREE.CylinderGeometry(
    0.42,
    0.42,
    0.28,
    16
  );

  for (const x of [-0.8, 0.8]) {
    for (const z of [-0.82, 0.82]) {
      const wheel = new THREE.Mesh(
        wheelGeometry,
        materials.black
      );

      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.43, z);
      wheel.castShadow = true;
      car.add(wheel);
    }
  }

  // Headlights
  const lightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff
  });

  for (const z of [-0.48, 0.48]) {
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.18, 0.24),
      lightMaterial
    );

    light.position.set(1.27, 0.83, z);
    car.add(light);
  }

  // Rear lights
  const rearMaterial = new THREE.MeshBasicMaterial({
    color: 0xff2222
  });

  for (const z of [-0.48, 0.48]) {
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.15, 0.24),
      rearMaterial
    );

    light.position.set(-1.27, 0.78, z);
    car.add(light);
  }

  scene.add(car);
  return car;
}

const blueCar = createCar(materials.blue, materials.blueGlass);
const orangeCar = createCar(materials.orange, materials.orangeGlass);

blueCar.position.set(-12, 0, 0);
orangeCar.position.set(12, 0, 0);

// -----------------------------------------------------
// BALL
// -----------------------------------------------------

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_RADIUS, 32, 24),
  materials.ball
);

ball.position.set(0, BALL_RADIUS, 0);
ball.castShadow = true;
ball.receiveShadow = true;
scene.add(ball);

const ballLines = new THREE.Mesh(
  new THREE.IcosahedronGeometry(BALL_RADIUS * 1.005, 1),
  new THREE.MeshBasicMaterial({
    color: 0x222222,
    wireframe: true,
    transparent: true,
    opacity: 0.18
  })
);

ball.add(ballLines);

const ballVelocity = new THREE.Vector3();

// -----------------------------------------------------
// CAR PHYSICS
// -----------------------------------------------------

const blueVelocity = new THREE.Vector3();
const orangeVelocity = new THREE.Vector3();

const blueForward = new THREE.Vector3();
const orangeForward = new THREE.Vector3();

function getForward(yaw, target) {
  target.set(Math.cos(yaw), 0, Math.sin(yaw));
  return target;
}

function clampCar(car, velocity) {
  const maxX = FIELD_X - 2;
  const maxZ = FIELD_Z - 2;

  if (car.position.x < -maxX) {
    car.position.x = -maxX;
    velocity.x = Math.max(0, velocity.x);
  }

  if (car.position.x > maxX) {
    car.position.x = maxX;
    velocity.x = Math.min(0, velocity.x);
  }

  if (car.position.z < -maxZ) {
    car.position.z = -maxZ;
    velocity.z = Math.max(0, velocity.z);
  }

  if (car.position.z > maxZ) {
    car.position.z = maxZ;
    velocity.z = Math.min(0, velocity.z);
  }
}

function movePlayer(dt) {
  const forward = getForward(blueYaw, blueForward);
  const acceleration = 34;
  const maxSpeed = 27;

  let throttle = 0;
  let steering = 0;

  if (keys.KeyW || keys.ArrowUp) throttle += 1;
  if (keys.KeyS || keys.ArrowDown) throttle -= 1;
  if (keys.KeyA || keys.ArrowLeft) steering += 1;
  if (keys.KeyD || keys.ArrowRight) steering -= 1;

  if (Math.abs(throttle) > 0) {
    blueVelocity.addScaledVector(
      forward,
      throttle * acceleration * dt
    );
  }

  const speed = blueVelocity.length();

  if (speed > 0.5) {
    const reverseFactor = throttle < 0 ? -1 : 1;
    blueYaw += steering * 2.6 * dt * reverseFactor;
  }

  if (keys.ShiftLeft || keys.ShiftRight) {
    if (blueBoost > 0) {
      blueVelocity.addScaledVector(forward, 48 * dt);
      blueBoost = Math.max(0, blueBoost - 32 * dt);
    }
  } else {
    blueBoost = Math.min(100, blueBoost + 15 * dt);
  }

  const maxAllowedSpeed = 27 + (keys.ShiftLeft || keys.ShiftRight ? 12 : 0);

  if (blueVelocity.length() > maxAllowedSpeed) {
    blueVelocity.setLength(maxAllowedSpeed);
  }

  blueVelocity.multiplyScalar(Math.pow(0.985, dt * 60));

  blueCar.position.addScaledVector(blueVelocity, dt);
  blueCar.rotation.y = -blueYaw;

  if (keys.Space && blueCar.position.y <= 0.02) {
    jumpVelocity = 10;
  }

  if (blueCar.position.y > 0 || jumpVelocity > 0) {
    jumpVelocity -= 24 * dt;
    blueCar.position.y += jumpVelocity * dt;

    if (blueCar.position.y < 0) {
      blueCar.position.y = 0;
      jumpVelocity = 0;
    }
  }

  clampCar(blueCar, blueVelocity);
}

// -----------------------------------------------------
// AI — CONTINUOUS MOVEMENT AND BALL ATTACK
// -----------------------------------------------------

function updateAI(dt) {
  const dxToBall = ball.position.x - orangeCar.position.x;
  const dzToBall = ball.position.z - orangeCar.position.z;

  // Decide which direction the AI should attack.
  // The AI attacks toward the blue goal when the ball
  // is on the right side, and toward the orange goal
  // when the ball is on the left side.
  const attackDirection = ball.position.x >= 0 ? -1 : 1;

  // Approach from behind the ball, rather than aiming
  // directly at its center.
  const target = new THREE.Vector3(
    ball.position.x - attackDirection * 2.3,
    0,
    ball.position.z
  );

  // Keep the target inside the playable field.
  target.x = THREE.MathUtils.clamp(
    target.x,
    -FIELD_X + 3,
    FIELD_X - 3
  );

  target.z = THREE.MathUtils.clamp(
    target.z,
    -FIELD_Z + 3,
    FIELD_Z - 3
  );

  const targetDX = target.x - orangeCar.position.x;
  const targetDZ = target.z - orangeCar.position.z;

  const desiredYaw = Math.atan2(targetDZ, targetDX);

  let angleDifference = desiredYaw - orangeYaw;

  while (angleDifference > Math.PI) {
    angleDifference -= Math.PI * 2;
  }

  while (angleDifference < -Math.PI) {
    angleDifference += Math.PI * 2;
  }

  // Turn toward the target smoothly.
  const turnSpeed = 4.8;

  orangeYaw += THREE.MathUtils.clamp(
    angleDifference,
    -turnSpeed * dt,
    turnSpeed * dt
  );

  const forward = getForward(orangeYaw, orangeForward);

  const distanceToBall = Math.sqrt(
    dxToBall * dxToBall + dzToBall * dzToBall
  );

  // Always accelerate. Never turn the engine off
  // just because the AI is close to the ball.
  const acceleration = distanceToBall > 7 ? 32 : 23;

  orangeVelocity.addScaledVector(
    forward,
    acceleration * dt
  );

  // Boost when the AI is far from the ball.
  if (distanceToBall > 6 && orangeBoost > 0) {
    orangeVelocity.addScaledVector(
      forward,
      25 * dt
    );

    orangeBoost = Math.max(0, orangeBoost - 25 * dt);
  } else {
    orangeBoost = Math.min(100, orangeBoost + 12 * dt);
  }

  // Maintain a useful driving speed.
  const maxSpeed = distanceToBall > 8 ? 28 : 23;

  if (orangeVelocity.length() > maxSpeed) {
    orangeVelocity.setLength(maxSpeed);
  }

  // Light friction, so the AI doesn't lose all its speed.
  orangeVelocity.multiplyScalar(Math.pow(0.994, dt * 60));

  // If the AI gets stuck or nearly stops, give it a
  // forward push toward the ball.
  if (orangeVelocity.length() < 2 && distanceToBall > 2) {
    orangeVelocity.addScaledVector(forward, 9 * dt);
  }

  orangeCar.position.addScaledVector(orangeVelocity, dt);
  orangeCar.rotation.y = -orangeYaw;

  // AI jump when the ball is above the ground.
  if (
    ball.position.y > 2.2 &&
    distanceToBall < 7 &&
    orangeCar.position.y <= 0.02
  ) {
    orangeJumpVelocity = 8;
  }

  if (orangeCar.position.y > 0 || orangeJumpVelocity > 0) {
    orangeJumpVelocity -= 24 * dt;
    orangeCar.position.y += orangeJumpVelocity * dt;

    if (orangeCar.position.y < 0) {
      orangeCar.position.y = 0;
      orangeJumpVelocity = 0;
    }
  }

  clampCar(orangeCar, orangeVelocity);
}

// -----------------------------------------------------
// BALL COLLISIONS
// -----------------------------------------------------

function collideCarWithBall(car, velocity, yaw, isAI = false) {
  const forward = new THREE.Vector3(
    Math.cos(yaw),
    0,
    Math.sin(yaw)
  );

  // Approximate the front bumper position.
  const front = car.position.clone().addScaledVector(
    forward,
    1.45
  );

  const difference = new THREE.Vector3(
    ball.position.x - front.x,
    0,
    ball.position.z - front.z
  );

  const distance = difference.length();
  const collisionDistance = BALL_RADIUS + 0.85;

  if (distance >= collisionDistance || distance < 0.001) {
    return;
  }

  const normal = difference.normalize();

  // Only reward movement into the ball.
  const impactSpeed = Math.max(
    0,
    velocity.dot(normal)
  );

  const baseHit = isAI ? 13 : 11;

  const hitStrength = Math.min(
    34,
    baseHit + impactSpeed * 0.9
  );

  ballVelocity.x += normal.x * hitStrength;
  ballVelocity.z += normal.z * hitStrength;

  // Add some forward power to the shot.
  ballVelocity.addScaledVector(
    forward,
    isAI ? 5 : 3
  );

  // A small upward bounce.
  ballVelocity.y = Math.max(
    ballVelocity.y,
    3.5 + impactSpeed * 0.12
  );

  // Push the ball out of the car to prevent sticking.
  const overlap = collisionDistance - distance;

  ball.position.x += normal.x * (overlap + 0.04);
  ball.position.z += normal.z * (overlap + 0.04);

  if (ballVelocity.length() > 42) {
    ballVelocity.setLength(42);
  }
}

function updateBall(dt) {
  ballVelocity.y -= 22 * dt;

  ball.position.addScaledVector(ballVelocity, dt);

  // Ground collision.
  if (ball.position.y < BALL_RADIUS) {
    ball.position.y = BALL_RADIUS;

    if (ballVelocity.y < -1) {
      ballVelocity.y *= -0.58;
    } else {
      ballVelocity.y = 0;
    }

    ballVelocity.x *= Math.pow(0.985, dt * 60);
    ballVelocity.z *= Math.pow(0.985, dt * 60);
  }

  // Side walls.
  if (ball.position.z > FIELD_Z - BALL_RADIUS) {
    ball.position.z = FIELD_Z - BALL_RADIUS;
    ballVelocity.z = -Math.abs(ballVelocity.z) * 0.75;
  }

  if (ball.position.z < -FIELD_Z + BALL_RADIUS) {
    ball.position.z = -FIELD_Z + BALL_RADIUS;
    ballVelocity.z = Math.abs(ballVelocity.z) * 0.75;
  }

  // End walls, leaving openings for goals.
  const inGoalOpening = Math.abs(ball.position.z) < 7.5 &&
    ball.position.y < 5.1;

  if (!inGoalOpening) {
    if (ball.position.x > FIELD_X - BALL_RADIUS) {
      ball.position.x = FIELD_X - BALL_RADIUS;
      ballVelocity.x = -Math.abs(ballVelocity.x) * 0.75;
    }

    if (ball.position.x < -FIELD_X + BALL_RADIUS) {
      ball.position.x = -FIELD_X + BALL_RADIUS;
      ballVelocity.x = Math.abs(ballVelocity.x) * 0.75;
    }
  }

  // Car collisions.
  collideCarWithBall(
    blueCar,
    blueVelocity,
    blueYaw,
    false
  );

  collideCarWithBall(
    orangeCar,
    orangeVelocity,
    orangeYaw,
    true
  );

  // Ball rolling resistance.
  ballVelocity.x *= Math.pow(0.998, dt * 60);
  ballVelocity.z *= Math.pow(0.998, dt * 60);

  // Spin the ball based on its movement.
  ball.rotation.z += ballVelocity.x * dt * 0.35;
  ball.rotation.x -= ballVelocity.z * dt * 0.35;

  // Limit extreme speed.
  if (ballVelocity.length() > 45) {
    ballVelocity.setLength(45);
  }
}

// -----------------------------------------------------
// GOAL DETECTION
// -----------------------------------------------------

function checkGoals() {
  if (
    ball.position.x > FIELD_X - 1 &&
    Math.abs(ball.position.z) < 7.5 &&
    ball.position.y < 5
  ) {
    blueScore++;
    updateScore();
    showMessage("BLUE SCORES!", "Nice shot!");
    resetPositions();
    return;
  }

  if (
    ball.position.x < -FIELD_X + 1 &&
    Math.abs(ball.position.z) < 7.5 &&
    ball.position.y < 5
  ) {
    orangeScore++;
    updateScore();
    showMessage("ORANGE SCORES!", "The AI got one!");
    resetPositions();
  }
}

// -----------------------------------------------------
// RESET
// -----------------------------------------------------

function resetPositions() {
  ball.position.set(0, BALL_RADIUS, 0);
  ballVelocity.set(0, 0, 0);

  blueCar.position.set(-12, 0, 0);
  orangeCar.position.set(12, 0, 0);

  blueVelocity.set(0, 0, 0);
  orangeVelocity.set(0, 0, 0);

  blueYaw = 0;
  orangeYaw = Math.PI;

  jumpVelocity = 0;
  orangeJumpVelocity = 0;

  blueBoost = 100;
  orangeBoost = 100;
}

// -----------------------------------------------------
// CAMERA
// -----------------------------------------------------

let cameraMode = 0;

const cameraTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();

function updateCamera(dt) {
  if (cameraMode === 0) {
    const forward = new THREE.Vector3(
      Math.cos(blueYaw),
      0,
      Math.sin(blueYaw)
    );

    cameraTarget.copy(blueCar.position);
    cameraTarget.y += 1.5;

    desiredCameraPosition.copy(blueCar.position);
    desiredCameraPosition.addScaledVector(forward, -11);
    desiredCameraPosition.y += 7;

    camera.position.lerp(
      desiredCameraPosition,
      1 - Math.pow(0.001, dt)
    );

    camera.lookAt(cameraTarget);
  } else {
    camera.position.lerp(
      new THREE.Vector3(0, 48, 0.1),
      1 - Math.pow(0.001, dt)
    );

    camera.lookAt(0, 0, 0);
  }
}

// -----------------------------------------------------
// USER INTERFACE
// -----------------------------------------------------

function getElement(id) {
  return document.getElementById(id);
}

function updateScore() {
  const blue = getElement("blueScore");
  const orange = getElement("orangeScore");

  if (blue) blue.textContent = blueScore;
  if (orange) orange.textContent = orangeScore;
}

function updateBoost() {
  const value = getElement("boostValue");
  const fill = getElement("boostFill");

  if (value) {
    value.textContent = Math.round(blueBoost);
  }

  if (fill) {
    fill.style.width = `${blueBoost}%`;
  }
}

function updateTimer() {
  const status = getElement("status");

  if (!status) return;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);

  status.textContent =
    `${minutes}:${String(seconds).padStart(2, "0")}`;
}

let messageTimeout;

function showMessage(title, subtitle) {
  const titleElement = getElement("messageTitle");
  const subElement = getElement("messageSub");
  const message = getElement("centerMessage");

  if (titleElement) titleElement.textContent = title;
  if (subElement) subElement.textContent = subtitle;

  if (message) {
    message.classList.remove("hidden");
  }

  clearTimeout(messageTimeout);

  messageTimeout = setTimeout(() => {
    if (message) message.classList.add("hidden");
  }, 1800);
}

// -----------------------------------------------------
// START AND PAUSE
// -----------------------------------------------------

function startGame() {
  gameStarted = true;
  paused = false;
  gameOver = false;

  const overlay = getElement("startOverlay");
  const pauseOverlay = getElement("pauseOverlay");

  if (overlay) overlay.classList.add("hidden");
  if (pauseOverlay) pauseOverlay.classList.add("hidden");

  showMessage("KICK OFF!", "Get the ball into the goal!");
}

function pauseGame() {
  if (!gameStarted || gameOver) return;

  paused = true;

  const overlay = getElement("pauseOverlay");
  if (overlay) overlay.classList.remove("hidden");
}

function resumeGame() {
  if (gameOver) return;

  paused = false;

  const overlay = getElement("pauseOverlay");
  if (overlay) overlay.classList.add("hidden");

  clock.getDelta();
}

function finishGame() {
  gameOver = true;
  paused = true;

  const title = blueScore > orangeScore
    ? "YOU WIN!"
    : blueScore < orangeScore
      ? "AI WINS!"
      : "IT'S A DRAW!";

  showMessage(
    title,
    `Final score: ${blueScore} - ${orangeScore}`
  );

  const playButton = getElement("playBtn");
  if (playButton) playButton.textContent = "PLAY AGAIN";
}

// -----------------------------------------------------
// BUTTONS
// -----------------------------------------------------

const playButton = getElement("playBtn");
const pauseButton = getElement("pauseBtn");
const resumeButton = getElement("resumeBtn");

if (playButton) {
  playButton.addEventListener("click", () => {
    if (gameOver) {
      blueScore = 0;
      orangeScore = 0;
      timeLeft = MATCH_LENGTH;
      updateScore();
      updateTimer();
      resetPositions();
    }

    startGame();
  });
}

if (pauseButton) {
  pauseButton.addEventListener("click", pauseGame);
}

if (resumeButton) {
  resumeButton.addEventListener("click", resumeGame);
}

// -----------------------------------------------------
// KEYBOARD INPUT
// -----------------------------------------------------

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;

  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space"
    ].includes(event.code)
  ) {
    event.preventDefault();
  }

  if (event.code === "Escape") {
    if (paused) {
      resumeGame();
    } else {
      pauseGame();
    }
  }

  if (event.code === "KeyC") {
    cameraMode = cameraMode === 0 ? 1 : 0;
  }

  if (event.code === "KeyR") {
    resetPositions();
  }

  if (event.code === "Enter" && !gameStarted) {
    startGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

window.addEventListener("blur", () => {
  for (const key of Object.keys(keys)) {
    keys[key] = false;
  }
});

// -----------------------------------------------------
// MOBILE CONTROLS
// -----------------------------------------------------

const mobileControls = getElement("mobileControls");

if (mobileControls) {
  mobileControls.querySelectorAll("[data-key]").forEach((button) => {
    const key = button.dataset.key;

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      keys[key] = true;
    });

    button.addEventListener("pointerup", () => {
      keys[key] = false;
    });

    button.addEventListener("pointerleave", () => {
      keys[key] = false;
    });

    button.addEventListener("pointercancel", () => {
      keys[key] = false;
    });
  });
}

// -----------------------------------------------------
// RESIZE
// -----------------------------------------------------

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );
});

// -----------------------------------------------------
// GAME LOOP
// -----------------------------------------------------

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);

  if (gameStarted && !paused && !gameOver) {
    movePlayer(dt);
    updateAI(dt);
    updateBall(dt);
    checkGoals();

    timeLeft -= dt;

    if (timeLeft <= 0) {
      timeLeft = 0;
      updateTimer();
      finishGame();
    }

    updateTimer();
    updateBoost();
  }

  updateCamera(dt);

  renderer.render(scene, camera);
}

// -----------------------------------------------------
// INITIALIZE
// -----------------------------------------------------

updateScore();
updateBoost();
updateTimer();
resetPositions();

animate();
