
import * as THREE from "three";
import "./style.css";

// =====================================================
// ROCKET SOCCER 3D
// =====================================================

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
const BALL_RADIUS = 0.85;
const MATCH_TIME = 180;

let blueScore = 0;
let orangeScore = 0;
let timeLeft = MATCH_TIME;

let started = false;
let paused = false;
let gameOver = false;
let cameraMode = 0;

let blueBoost = 100;
let orangeBoost = 100;

let blueYaw = 0;
let orangeYaw = Math.PI;

let blueJump = 0;
let orangeJump = 0;

const keys = {};
const clock = new THREE.Clock();

// =====================================================
// SCENE AND RENDERER
// =====================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x83c9f5);
scene.fog = new THREE.Fog(0x83c9f5, 80, 160);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);

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
renderer.toneMappingExposure = 1.1;

game.insertBefore(renderer.domElement, game.firstChild);

// =====================================================
// LIGHTING
// =====================================================

scene.add(
  new THREE.HemisphereLight(0xffffff, 0x456078, 2)
);

const sunlight = new THREE.DirectionalLight(0xffffff, 2.2);
sunlight.position.set(-25, 45, 25);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
sunlight.shadow.camera.left = -60;
sunlight.shadow.camera.right = 60;
sunlight.shadow.camera.top = 60;
sunlight.shadow.camera.bottom = -60;
scene.add(sunlight);

// =====================================================
// MATERIALS
// =====================================================

const grassMaterial = new THREE.MeshStandardMaterial({
  color: 0x168b43,
  roughness: 0.9
});

const stripeMaterial = new THREE.MeshStandardMaterial({
  color: 0x117a39,
  roughness: 0.9
});

const whiteMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff
});

const blueMaterial = new THREE.MeshStandardMaterial({
  color: 0x087bff,
  metalness: 0.3,
  roughness: 0.3
});

const orangeMaterial = new THREE.MeshStandardMaterial({
  color: 0xff7518,
  metalness: 0.3,
  roughness: 0.3
});

const glassBlueMaterial = new THREE.MeshStandardMaterial({
  color: 0x8edaff,
  metalness: 0.35,
  roughness: 0.2
});

const glassOrangeMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd19a,
  metalness: 0.35,
  roughness: 0.2
});

const blackMaterial = new THREE.MeshStandardMaterial({
  color: 0x171b24,
  roughness: 0.7
});

// =====================================================
// FIELD
// =====================================================

const field = new THREE.Mesh(
  new THREE.BoxGeometry(FIELD_X * 2, 1, FIELD_Z * 2),
  grassMaterial
);

field.position.y = -0.55;
field.receiveShadow = true;
scene.add(field);

// Alternating grass stripes
for (let i = 0; i < 12; i++) {
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(7.65, 0.025, FIELD_Z * 2),
    stripeMaterial
  );

  stripe.position.set(-42.15 + i * 7.65, -0.035, 0);
  scene.add(stripe);
}

function addFieldLine(x, z, width, depth) {
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.035, depth),
    whiteMaterial
  );

  line.position.set(x, 0.025, z);
  scene.add(line);
}

addFieldLine(0, 0, 0.15, FIELD_Z * 2);
addFieldLine(0, -FIELD_Z, FIELD_X * 2, 0.15);
addFieldLine(0, FIELD_Z, FIELD_X * 2, 0.15);
addFieldLine(-FIELD_X, 0, 0.15, FIELD_Z * 2);
addFieldLine(FIELD_X, 0, 0.15, FIELD_Z * 2);

const centerCircle = new THREE.Mesh(
  new THREE.RingGeometry(5.8, 6, 64),
  whiteMaterial
);

centerCircle.rotation.x = -Math.PI / 2;
centerCircle.position.y = 0.04;
scene.add(centerCircle);

// =====================================================
// WALLS
// =====================================================

function addWall(x, y, z, width, height, depth) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: 0x29485e,
      transparent: true,
      opacity: 0.42,
      roughness: 0.5
    })
  );

  wall.position.set(x, y, z);
  wall.receiveShadow = true;
  scene.add(wall);
}

addWall(0, 1.5, -FIELD_Z - 0.5, FIELD_X * 2, 3, 1);
addWall(0, 1.5, FIELD_Z + 0.5, FIELD_X * 2, 3, 1);

// =====================================================
// GOALS
// =====================================================

function createGoal(x, color, direction) {
  const group = new THREE.Group();

  const frameMaterial = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.5,
    roughness: 0.25
  });

  function framePart(width, height, depth, px, py, pz) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      frameMaterial
    );

    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    group.add(mesh);
  }

  framePart(0.55, 5, 0.55, 0, 2.5, -7.5);
  framePart(0.55, 5, 0.55, 0, 2.5, 7.5);
  framePart(0.55, 0.55, 15.5, 0, 5, 0);

  const net = new THREE.Mesh(
    new THREE.BoxGeometry(5, 5, 15),
    new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    })
  );

  net.position.set(direction * 2.5, 2.5, 0);
  group.add(net);

  group.position.x = x;
  scene.add(group);
}

createGoal(-FIELD_X, 0x168bff, -1);
createGoal(FIELD_X, 0xff7518, 1);

// =====================================================
// CAR CREATION
// =====================================================

function createCar(bodyMaterial, glassMaterial) {
  const car = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.7, 1.5),
    bodyMaterial
  );

  body.position.y = 0.75;
  body.castShadow = true;
  car.add(body);

  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.25, 1.4),
    bodyMaterial
  );

  hood.position.set(0.75, 1.08, 0);
  car.add(hood);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.65, 1.15),
    glassMaterial
  );

  cabin.position.set(-0.15, 1.3, 0);
  cabin.castShadow = true;
  car.add(cabin);

  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.3, 1.55),
    blackMaterial
  );

  bumper.position.set(1.3, 0.55, 0);
  car.add(bumper);

  const wheelGeometry = new THREE.CylinderGeometry(
    0.4, 0.4, 0.28, 16
  );

  for (const x of [-0.8, 0.8]) {
    for (const z of [-0.82, 0.82]) {
      const wheel = new THREE.Mesh(
        wheelGeometry,
        blackMaterial
      );

      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.42, z);
      wheel.castShadow = true;
      car.add(wheel);
    }
  }

  const headlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff
  });

  for (const z of [-0.48, 0.48]) {
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.17, 0.24),
      headlightMaterial
    );

    light.position.set(1.27, 0.82, z);
    car.add(light);
  }

  scene.add(car);
  return car;
}

const blueCar = createCar(blueMaterial, glassBlueMaterial);
const orangeCar = createCar(orangeMaterial, glassOrangeMaterial);

// =====================================================
// BALL
// =====================================================

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_RADIUS, 32, 24),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.05
  })
);

ball.castShadow = true;
ball.receiveShadow = true;
scene.add(ball);

const ballVelocity = new THREE.Vector3();

const ballOutline = new THREE.Mesh(
  new THREE.IcosahedronGeometry(BALL_RADIUS * 1.002, 1),
  new THREE.MeshBasicMaterial({
    color: 0x333333,
    wireframe: true,
    transparent: true,
    opacity: 0.12
  })
);

ball.add(ballOutline);

// =====================================================
// CAR VELOCITIES
// =====================================================

const blueVelocity = new THREE.Vector3();
const orangeVelocity = new THREE.Vector3();

function forwardVector(yaw) {
  return new THREE.Vector3(
    Math.cos(yaw),
    0,
    Math.sin(yaw)
  );
}

function clampCar(car, velocity) {
  const limitX = FIELD_X - 2;
  const limitZ = FIELD_Z - 2;

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

// =====================================================
// PLAYER MOVEMENT
// =====================================================

function updatePlayer(dt) {
  const forward = forwardVector(blueYaw);

  let throttle = 0;
  let steering = 0;

  if (keys.KeyW || keys.ArrowUp) throttle += 1;
  if (keys.KeyS || keys.ArrowDown) throttle -= 1;
  if (keys.KeyA || keys.ArrowLeft) steering += 1;
  if (keys.KeyD || keys.ArrowRight) steering -= 1;

  if (throttle !== 0) {
    blueVelocity.addScaledVector(
      forward,
      throttle * 34 * dt
    );
  }

  if (blueVelocity.length() > 0.7) {
    blueYaw += steering * 2.6 * dt * (throttle < 0 ? -1 : 1);
  }

  const boosting = keys.ShiftLeft || keys.ShiftRight;

  if (boosting && blueBoost > 0) {
    blueVelocity.addScaledVector(forward, 45 * dt);
    blueBoost = Math.max(0, blueBoost - 32 * dt);
  } else {
    blueBoost = Math.min(100, blueBoost + 17 * dt);
  }

  const maxSpeed = boosting ? 39 : 27;

  if (blueVelocity.length() > maxSpeed) {
    blueVelocity.setLength(maxSpeed);
  }

  blueVelocity.multiplyScalar(Math.pow(0.985, dt * 60));

  blueCar.position.addScaledVector(blueVelocity, dt);
  blueCar.rotation.y = -blueYaw;

  if (keys.Space && blueCar.position.y <= 0.01) {
    blueJump = 10;
  }

  if (blueCar.position.y > 0 || blueJump > 0) {
    blueJump -= 24 * dt;
    blueCar.position.y += blueJump * dt;

    if (blueCar.position.y < 0) {
      blueCar.position.y = 0;
      blueJump = 0;
    }
  }

  clampCar(blueCar, blueVelocity);
}

// =====================================================
// ORANGE AI
// =====================================================

function updateAI(dt) {
  // The orange AI always attacks toward the blue goal.
  // Its approach point stays behind the ball on the
  // orange side, so it drives through the ball toward
  // the blue goal instead of stopping beside it.

  const targetX = THREE.MathUtils.clamp(
    ball.position.x + 2.5,
    -FIELD_X + 3,
    FIELD_X - 3
  );

  const targetZ = THREE.MathUtils.clamp(
    ball.position.z,
    -FIELD_Z + 3,
    FIELD_Z - 3
  );

  const dx = targetX - orangeCar.position.x;
  const dz = targetZ - orangeCar.position.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  const desiredYaw = Math.atan2(dz, dx);

  let angle = desiredYaw - orangeYaw;

  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;

  orangeYaw += THREE.MathUtils.clamp(
    angle,
    -5 * dt,
    5 * dt
  );

  const forward = forwardVector(orangeYaw);
  const ballDistance = orangeCar.position.distanceTo(ball.position);

  // Constant acceleration prevents the AI from freezing.
  orangeVelocity.addScaledVector(
    forward,
    (distance > 5 ? 34 : 25) * dt
  );

  if (ballDistance > 7 && orangeBoost > 0) {
    orangeVelocity.addScaledVector(forward, 22 * dt);
    orangeBoost = Math.max(0, orangeBoost - 24 * dt);
  } else {
    orangeBoost = Math.min(100, orangeBoost + 14 * dt);
  }

  if (orangeVelocity.length() > 28) {
    orangeVelocity.setLength(28);
  }

  // Never allow the AI to remain motionless while chasing.
  if (ballDistance > 2 && orangeVelocity.length() < 2) {
    orangeVelocity.addScaledVector(forward, 10 * dt);
  }

  orangeVelocity.multiplyScalar(Math.pow(0.995, dt * 60));

  orangeCar.position.addScaledVector(orangeVelocity, dt);
  orangeCar.rotation.y = -orangeYaw;

  if (
    ball.position.y > 2 &&
    ballDistance < 7 &&
    orangeCar.position.y <= 0.01
  ) {
    orangeJump = 8;
  }

  if (orangeCar.position.y > 0 || orangeJump > 0) {
    orangeJump -= 24 * dt;
    orangeCar.position.y += orangeJump * dt;

    if (orangeCar.position.y < 0) {
      orangeCar.position.y = 0;
      orangeJump = 0;
    }
  }

  clampCar(orangeCar, orangeVelocity);
}

// =====================================================
// CAR / BALL COLLISION
// =====================================================

function carHitsBall(car, velocity, yaw, ai) {
  const forward = forwardVector(yaw);

  const front = car.position.clone().addScaledVector(
    forward,
    1.4
  );

  const difference = new THREE.Vector3(
    ball.position.x - front.x,
    0,
    ball.position.z - front.z
  );

  const distance = difference.length();
  const collisionRange = BALL_RADIUS + 0.9;

  if (distance > collisionRange || distance < 0.001) {
    return;
  }

  const normal = difference.normalize();
  const impact = Math.max(0, velocity.dot(normal));

  const strength = Math.min(
    36,
    (ai ? 14 : 12) + impact * 0.9
  );

  ballVelocity.x += normal.x * strength;
  ballVelocity.z += normal.z * strength;
  ballVelocity.addScaledVector(forward, ai ? 5 : 3);
  ballVelocity.y = Math.max(ballVelocity.y, 4);

  const overlap = collisionRange - distance;

  ball.position.x += normal.x * (overlap + 0.03);
  ball.position.z += normal.z * (overlap + 0.03);

  if (ballVelocity.length() > 43) {
    ballVelocity.setLength(43);
  }
}

// =====================================================
// BALL PHYSICS
// =====================================================

function updateBall(dt) {
  ballVelocity.y -= 22 * dt;
  ball.position.addScaledVector(ballVelocity, dt);

  // Ground bounce
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

  // Side walls
  if (ball.position.z > FIELD_Z - BALL_RADIUS) {
    ball.position.z = FIELD_Z - BALL_RADIUS;
    ballVelocity.z = -Math.abs(ballVelocity.z) * 0.75;
  }

  if (ball.position.z < -FIELD_Z + BALL_RADIUS) {
    ball.position.z = -FIELD_Z + BALL_RADIUS;
    ballVelocity.z = Math.abs(ballVelocity.z) * 0.75;
  }

  // End walls, with openings for goals
  const insideGoalMouth =
    Math.abs(ball.position.z) < 7.5 &&
    ball.position.y < 5;

  if (!insideGoalMouth) {
    if (ball.position.x > FIELD_X - BALL_RADIUS) {
      ball.position.x = FIELD_X - BALL_RADIUS;
      ballVelocity.x = -Math.abs(ballVelocity.x) * 0.75;
    }

    if (ball.position.x < -FIELD_X + BALL_RADIUS) {
      ball.position.x = -FIELD_X + BALL_RADIUS;
      ballVelocity.x = Math.abs(ballVelocity.x) * 0.75;
    }
  }

  carHitsBall(blueCar, blueVelocity, blueYaw, false);
  carHitsBall(orangeCar, orangeVelocity, orangeYaw, true);

  ballVelocity.x *= Math.pow(0.998, dt * 60);
  ballVelocity.z *= Math.pow(0.998, dt * 60);

  ball.rotation.z += ballVelocity.x * dt * 0.35;
  ball.rotation.x -= ballVelocity.z * dt * 0.35;

  if (ballVelocity.length() > 45) {
    ballVelocity.setLength(45);
  }
}

// =====================================================
// SCORE AND GOALS
// =====================================================

function updateScore() {
  ui.blueScore.textContent = blueScore;
  ui.orangeScore.textContent = orangeScore;
}

function showMessage(title, subtitle) {
  ui.messageTitle.textContent = title;
  ui.messageSub.textContent = subtitle;
  ui.message.classList.remove("hidden");
}

function hideMessage() {
  ui.message.classList.add("hidden");
}

function resetPositions() {
  blueCar.position.set(-12, 0, 0);
  orangeCar.position.set(12, 0, 0);
  ball.position.set(0, BALL_RADIUS, 0);

  blueVelocity.set(0, 0, 0);
  orangeVelocity.set(0, 0, 0);
  ballVelocity.set(0, 0, 0);

  blueYaw = 0;
  orangeYaw = Math.PI;

  blueJump = 0;
  orangeJump = 0;

  blueBoost = 100;
  orangeBoost = 100;
}

function checkGoals() {
  if (
    ball.position.x >= FIELD_X - 0.8 &&
    Math.abs(ball.position.z) < 7.5 &&
    ball.position.y < 5
  ) {
    blueScore++;
    updateScore();
    resetPositions();
    showMessage("BLUE SCORES!", "Nice shot!");
    return;
  }

  if (
    ball.position.x <= -FIELD_X + 0.8 &&
    Math.abs(ball.position.z) < 7.5 &&
    ball.position.y < 5
  ) {
    orangeScore++;
    updateScore();
    resetPositions();
    showMessage("ORANGE SCORES!", "The AI scored!");
  }
}

// =====================================================
// TIMER
// =====================================================

function updateTimer() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);

  ui.timer.textContent =
    `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function updateBoost() {
  const amount = Math.round(blueBoost);

  ui.boostValue.textContent = amount;
  ui.boostFill.style.width = `${amount}%`;
}

// =====================================================
// CAMERA
// =====================================================

function updateCamera(dt) {
  if (cameraMode === 0) {
    const forward = forwardVector(blueYaw);

    const desired = blueCar.position.clone()
      .addScaledVector(forward, -12);

    desired.y += 7;

    const lookTarget = blueCar.position.clone();
    lookTarget.y += 1.2;

    camera.position.lerp(
      desired,
      1 - Math.pow(0.001, dt)
    );

    camera.lookAt(lookTarget);
  } else {
    const desired = new THREE.Vector3(0, 53, 0);

    camera.position.lerp(
      desired,
      1 - Math.pow(0.001, dt)
    );

    camera.lookAt(0, 0, 0);
  }
}

// =====================================================
// GAME START / PAUSE / END
// =====================================================

function startGame() {
  if (gameOver) {
    blueScore = 0;
    orangeScore = 0;
    timeLeft = MATCH_TIME;
    updateScore();
    updateTimer();
    resetPositions();
    gameOver = false;
  }

  started = true;
  paused = false;
  hideMessage();
  clock.getDelta();
}

function pauseGame() {
  if (!started || gameOver) return;

  paused = true;
  showMessage("PAUSED", "Press PLAY to continue.");
  ui.playBtn.textContent = "RESUME";
}

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

  ui.playBtn.textContent = "PLAY AGAIN";
}

// =====================================================
// BUTTON
// =====================================================

ui.playBtn.addEventListener("click", () => {
  if (paused && !gameOver && started) {
    paused = false;
    hideMessage();
    ui.playBtn.textContent = "PLAY";
    clock.getDelta();
    return;
  }

  ui.playBtn.textContent = "PLAY";
  startGame();
});

// =====================================================
// KEYBOARD
// =====================================================

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;

  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)
  ) {
    event.preventDefault();
  }

  if (event.code === "Escape") {
    if (paused) {
      if (started && !gameOver) {
        paused = false;
        hideMessage();
        ui.playBtn.textContent = "PLAY";
      }
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
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

window.addEventListener("blur", () => {
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
});

// =====================================================
// RESIZE
// =====================================================

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

// =====================================================
// MAIN LOOP
// =====================================================

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);

  if (started && !paused && !gameOver) {
    updatePlayer(dt);
    updateAI(dt);
    updateBall(dt);
    checkGoals();

    timeLeft -= dt;

    if (timeLeft <= 0) {
      timeLeft = 0;
      finishGame();
    }

    updateTimer();
    updateBoost();
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

// =====================================================
// INITIAL SETUP
// =====================================================

resetPositions();
updateScore();
updateTimer();
updateBoost();

camera.position.set(0, 15, 25);
camera.lookAt(0, 0, 0);

animate();
