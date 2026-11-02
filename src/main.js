import * as THREE from 'three';
import './style.css';

// ==========================================
// ROCKET SOCCER 3D - IMPROVED GAME ENGINE
// ==========================================

const $ = (id) => document.getElementById(id);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c9ed);
scene.fog = new THREE.Fog(0x87c9ed, 80, 180);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

$('game').appendChild(renderer.domElement);

// ==========================================
// LIGHTING
// ==========================================

scene.add(new THREE.HemisphereLight(0xffffff, 0x35516b, 2));

const sunlight = new THREE.DirectionalLight(0xffffff, 2.2);
sunlight.position.set(-25, 45, 20);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
scene.add(sunlight);

// ==========================================
// ARENA
// ==========================================

const field = new THREE.Mesh(
  new THREE.BoxGeometry(90, 1, 60),
  new THREE.MeshStandardMaterial({
    color: 0x168c45,
    roughness: 0.9
  })
);

field.position.y = -0.6;
field.receiveShadow = true;
scene.add(field);

function addLine(x, z, width, depth) {
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.04, depth),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  line.position.set(x, -0.06, z);
  scene.add(line);
}

addLine(0, 0, 0.18, 60);
addLine(-44.5, 0, 0.5, 60);
addLine(44.5, 0, 0.5, 60);
addLine(0, -29.5, 90, 0.5);
addLine(0, 29.5, 90, 0.5);

const centerCircle = new THREE.Mesh(
  new THREE.RingGeometry(8, 8.18, 80),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
  })
);
centerCircle.rotation.x = -Math.PI / 2;
centerCircle.position.y = -0.045;
scene.add(centerCircle);

// ==========================================
// GOALS
// ==========================================

function createGoal(x, color) {
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.3,
    roughness: 0.4
  });

  for (const z of [-8, 8]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(1, 8, 1),
      material
    );
    post.position.set(0, 4, z);
    post.castShadow = true;
    group.add(post);
  }

  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.7, 17),
    material
  );
  crossbar.position.set(0, 8, 0);
  group.add(crossbar);

  const net = new THREE.Mesh(
    new THREE.BoxGeometry(8, 7.5, 16),
    new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    })
  );

  net.position.set(x < 0 ? -4 : 4, 3.8, 0);
  group.add(net);

  group.position.x = x;
  scene.add(group);
}

createGoal(-46, 0x249cff);
createGoal(46, 0xff7a20);

// ==========================================
// CAR CREATION
// ==========================================

function createCar(color) {
  const group = new THREE.Group();

  const paint = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.55,
    roughness: 0.28
  });

  const dark = new THREE.MeshStandardMaterial({
    color: 0x101827,
    metalness: 0.3,
    roughness: 0.35
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1, 2.2),
    paint
  );
  body.position.y = 0.9;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.8, 1.7),
    dark
  );
  cabin.position.set(-0.3, 1.7, 0);
  group.add(cabin);

  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 2.3),
    dark
  );
  bumper.position.set(2, 0.55, 0);
  group.add(bumper);

  for (const x of [-1.1, 1.1]) {
    for (const z of [-1.15, 1.15]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.48, 0.3, 20),
        dark
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.5, z);
      group.add(wheel);
    }
  }

  group.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });

  scene.add(group);
  return group;
}

// ==========================================
// BALL
// ==========================================

const ballRadius = 0.85;

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 32, 32),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.1
  })
);

ball.position.set(0, ballRadius, 0);
ball.castShadow = true;
scene.add(ball);

const ballLines = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius + 0.01, 16, 12),
  new THREE.MeshBasicMaterial({
    color: 0x263447,
    wireframe: true,
    transparent: true,
    opacity: 0.3
  })
);
ball.add(ballLines);

const ballVelocity = new THREE.Vector3();

// ==========================================
// PLAYERS
// ==========================================

const player = createCar(0x078cff);
const ai = createCar(0xff761c);

let playerYaw = 0;
let aiYaw = Math.PI;

const playerVelocity = new THREE.Vector3();
const aiVelocity = new THREE.Vector3();

let playerBoost = 100;
let aiBoost = 100;

let jumping = false;
let jumpVelocity = 0;

// ==========================================
// GAME STATE
// ==========================================

let blueScore = 0;
let orangeScore = 0;

let timeLeft = 180;
let playing = false;
let paused = false;
let overheadCamera = false;
let goalCooldown = 0;

let lastTime = 0;

const keys = {};

window.addEventListener('keydown', (event) => {
  keys[event.code] = true;

  if ([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Space'
  ].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === 'KeyR') resetPositions();
  if (event.code === 'KeyC') overheadCamera = !overheadCamera;

  if (event.code === 'Escape' && playing) {
    paused = !paused;

    $('message').style.display = paused ? 'flex' : 'none';
    $('messageTitle').textContent = paused ? 'PAUSED' : '';
    $('messageSub').textContent = paused ? 'Take a break!' : '';
    $('playBtn').textContent = paused ? 'RESUME' : 'PLAY';
  }

  if (event.code === 'Space' && !event.repeat) {
    if (player.position.y <= 0.02 && playing && !paused) {
      jumpVelocity = 10;
      jumping = true;
    }
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

window.addEventListener('blur', () => {
  for (const key in keys) keys[key] = false;
});

// ==========================================
// RESET POSITIONS
// ==========================================

function resetPositions() {
  player.position.set(-12, 0, 0);
  ai.position.set(12, 0, 0);

  playerYaw = 0;
  aiYaw = Math.PI;

  playerVelocity.set(0, 0, 0);
  aiVelocity.set(0, 0, 0);
  ballVelocity.set(0, 0, 0);

  ball.position.set(0, ballRadius, 0);

  playerBoost = 100;
  aiBoost = 100;

  jumping = false;
  jumpVelocity = 0;

  goalCooldown = 1;
}

// ==========================================
// PLAYER MOVEMENT
// ==========================================

function updatePlayer(dt) {
  const forward = new THREE.Vector3(
    Math.cos(playerYaw),
    0,
    Math.sin(playerYaw)
  );

  const accelerating = keys.KeyW || keys.ArrowUp;
  const reversing = keys.KeyS || keys.ArrowDown;
  const left = keys.KeyA || keys.ArrowLeft;
  const right = keys.KeyD || keys.ArrowRight;
  const boosting = keys.ShiftLeft || keys.ShiftRight;

  if (left) playerYaw += 2.7 * dt;
  if (right) playerYaw -= 2.7 * dt;

  if (accelerating) {
    playerVelocity.addScaledVector(forward, 23 * dt);
  }

  if (reversing) {
    playerVelocity.addScaledVector(forward, -13 * dt);
  }

  if (boosting && accelerating && playerBoost > 0) {
    playerVelocity.addScaledVector(forward, 32 * dt);
    playerBoost = Math.max(0, playerBoost - 28 * dt);
  } else {
    playerBoost = Math.min(100, playerBoost + 13 * dt);
  }

  const maxSpeed = boosting && playerBoost > 0 ? 34 : 21;

  if (playerVelocity.length() > maxSpeed) {
    playerVelocity.setLength(maxSpeed);
  }

  playerVelocity.multiplyScalar(Math.pow(0.985, dt * 60));
  player.position.addScaledVector(playerVelocity, dt);

  player.position.x = THREE.MathUtils.clamp(player.position.x, -42, 42);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -27, 27);

  if (jumping) {
    player.position.y += jumpVelocity * dt;
    jumpVelocity -= 25 * dt;

    if (player.position.y <= 0) {
      player.position.y = 0;
      jumping = false;
      jumpVelocity = 0;
    }
  }

  player.rotation.y = -playerYaw;
}

// ==========================================
// IMPROVED AI
// ==========================================

function updateAI(dt) {
  // Find the ball's position.
  const dx = ball.position.x - ai.position.x;
  const dz = ball.position.z - ai.position.z;

  const distance = Math.sqrt(dx * dx + dz * dz);

  // Predict where the ball will be shortly.
  const predictedX = ball.position.x + ballVelocity.x * 0.3;
  const predictedZ = ball.position.z + ballVelocity.z * 0.3;

  const targetDx = predictedX - ai.position.x;
  const targetDz = predictedZ - ai.position.z;

  const desiredYaw = Math.atan2(targetDz, targetDx);

  let difference = desiredYaw - aiYaw;

  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;

  aiYaw += THREE.MathUtils.clamp(
    difference,
    -3.8 * dt,
    3.8 * dt
  );

  const forward = new THREE.Vector3(
    Math.cos(aiYaw),
    0,
    Math.sin(aiYaw)
  );

  // Keep chasing the ball.
  if (distance > 1.3) {
    const acceleration = distance > 8 ? 29 : 21;
    aiVelocity.addScaledVector(forward, acceleration * dt);
  }

  // Boost when far from the ball.
  if (distance > 10 && aiBoost > 0) {
    aiVelocity.addScaledVector(forward, 20 * dt);
    aiBoost = Math.max(0, aiBoost - 18 * dt);
  } else {
    aiBoost = Math.min(100, aiBoost + 12 * dt);
  }

  // Keep the AI moving quickly.
  const maxSpeed = distance > 8 ? 29 : 24;

  if (aiVelocity.length() > maxSpeed) {
    aiVelocity.setLength(maxSpeed);
  }

  aiVelocity.multiplyScalar(Math.pow(0.994, dt * 60));

  ai.position.addScaledVector(aiVelocity, dt);

  ai.position.x = THREE.MathUtils.clamp(ai.position.x, -42, 42);
  ai.position.z = THREE.MathUtils.clamp(ai.position.z, -27, 27);

  ai.rotation.y = -aiYaw;
}

// ==========================================
// CAR AND BALL COLLISIONS
// ==========================================

function collideCarWithBall(car, velocity, yaw) {
  const difference = new THREE.Vector3(
    ball.position.x - car.position.x,
    0,
    ball.position.z - car.position.z
  );

  const distance = difference.length();
  const collisionDistance = 2.8;

  if (distance < collisionDistance && distance > 0.001) {
    const normal = difference.normalize();

    const overlap = collisionDistance - distance;

    ball.position.x += normal.x * overlap * 0.8;
    ball.position.z += normal.z * overlap * 0.8;

    const impact = Math.max(0, velocity.dot(normal));

    ballVelocity.x += normal.x * (impact * 0.9 + 9);
    ballVelocity.z += normal.z * (impact * 0.9 + 9);
    ballVelocity.y += 2.5;

    const forward = new THREE.Vector3(
      Math.cos(yaw),
      0,
      Math.sin(yaw)
    );

    ballVelocity.addScaledVector(forward, 5);

    if (ballVelocity.length() > 40) {
      ballVelocity.setLength(40);
    }
  }
}

// ==========================================
// BALL PHYSICS
// ==========================================

function updateBall(dt) {
  // Gravity
  ballVelocity.y -= 15 * dt;

  // Movement
  ball.position.addScaledVector(ballVelocity, dt);

  // Ground collision
  if (ball.position.y < ballRadius) {
    ball.position.y = ballRadius;

    if (ballVelocity.y < -1) {
      ballVelocity.y *= -0.65;
    } else {
      ballVelocity.y = 0;
    }

    ballVelocity.x *= 0.985;
    ballVelocity.z *= 0.985;
  }

  // Side walls
  if (Math.abs(ball.position.z) > 29) {
    ball.position.z = Math.sign(ball.position.z) * 29;
    ballVelocity.z *= -0.75;
  }

  // End walls
  if (Math.abs(ball.position.x) > 44) {
    const inGoal =
      Math.abs(ball.position.z) < 8 &&
      ball.position.y < 8;

    if (!inGoal) {
      ball.position.x = Math.sign(ball.position.x) * 44;
      ballVelocity.x *= -0.75;
    }
  }

  // Air resistance
  ballVelocity.multiplyScalar(Math.pow(0.997, dt * 60));

  // Collisions
  collideCarWithBall(player, playerVelocity, playerYaw);
  collideCarWithBall(ai, aiVelocity, aiYaw);

  // Speed limit
  if (ballVelocity.length() > 40) {
    ballVelocity.setLength(40);
  }

  // Ball rotation
  ball.rotation.x += ballVelocity.z * dt * 0.5;
  ball.rotation.z -= ballVelocity.x * dt * 0.5;
}

// ==========================================
// SCORING
// ==========================================

function scoreGoal(message) {
  blueScore = Math.max(0, blueScore);
  orangeScore = Math.max(0, orangeScore);

  $('blueScore').textContent = blueScore;
  $('orangeScore').textContent = orangeScore;

  goalCooldown = 2.5;

  $('messageTitle').textContent = message;
  $('messageSub').textContent = 'Get ready for kickoff!';
  $('playBtn').textContent = 'CONTINUE';
  $('message').style.display = 'flex';

  paused = true;
  resetPositions();
}

function checkGoals() {
  if (goalCooldown > 0) return;

  if (
    ball.position.x > 45 &&
    Math.abs(ball.position.z) < 8 &&
    ball.position.y < 8
  ) {
    blueScore++;
    scoreGoal('BLUE SCORES!');
  }

  if (
    ball.position.x < -45 &&
    Math.abs(ball.position.z) < 8 &&
    ball.position.y < 8
  ) {
    orangeScore++;
    scoreGoal('ORANGE SCORES!');
  }
}

// ==========================================
// CAMERA
// ==========================================

const cameraTarget = new THREE.Vector3();

function updateCamera(dt) {
  let desiredPosition;

  if (overheadCamera) {
    desiredPosition = new THREE.Vector3(
      player.position.x,
      42,
      player.position.z + 0.1
    );

    cameraTarget.set(
      player.position.x,
      0,
      player.position.z
    );
  } else {
    const forward = new THREE.Vector3(
      Math.cos(playerYaw),
      0,
      Math.sin(playerYaw)
    );

    desiredPosition = player.position.clone()
      .addScaledVector(forward, -13);

    desiredPosition.y += 8;

    cameraTarget.copy(player.position);
    cameraTarget.y += 1.2;
  }

  const smoothness = 1 - Math.pow(0.001, dt);

  camera.position.lerp(desiredPosition, smoothness);
  camera.lookAt(cameraTarget);
}

// ==========================================
// USER INTERFACE
// ==========================================

function updateUI() {
  $('boostFill').style.width = playerBoost + '%';
  $('boostValue').textContent = Math.round(playerBoost);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);

  $('timer').textContent =
    `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ==========================================
// START AND RESUME
// ==========================================

$('playBtn').addEventListener('click', () => {
  if (!playing) {
    playing = true;
    resetPositions();
  }

  if (goalCooldown > 0) {
    goalCooldown = 0;
  }

  paused = false;
  $('message').style.display = 'none';
});

// ==========================================
// MAIN GAME LOOP
// ==========================================

function animate(timestamp) {
  requestAnimationFrame(animate);

  const dt = Math.min(
    (timestamp - (lastTime || timestamp)) / 1000,
    0.033
  );

  lastTime = timestamp;

  if (playing && !paused) {
    updatePlayer(dt);
    updateAI(dt);
    updateBall(dt);
    checkGoals();

    if (goalCooldown > 0) {
      goalCooldown -= dt;
    }

    timeLeft -= dt;

    if (timeLeft <= 0) {
      timeLeft = 0;
      playing = false;
      paused = true;

      $('messageTitle').textContent =
        blueScore > orangeScore
          ? 'BLUE WINS!'
          : blueScore < orangeScore
            ? 'ORANGE WINS!'
            : 'IT’S A DRAW!';

      $('messageSub').textContent =
        `${blueScore} - ${orangeScore}`;

      $('playBtn').textContent = 'PLAY AGAIN';
      $('message').style.display = 'flex';

      blueScore = 0;
      orangeScore = 0;
      timeLeft = 180;

      $('blueScore').textContent = '0';
      $('orangeScore').textContent = '0';
    }

    updateUI();
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

// ==========================================
// RESIZE
// ==========================================

window.addEventListener('resize', () => {
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

// ==========================================
// INITIALIZE
// ==========================================

resetPositions();

camera.position.set(-20, 12, 0);
camera.lookAt(0, 0, 0);

requestAnimationFrame(animate);
