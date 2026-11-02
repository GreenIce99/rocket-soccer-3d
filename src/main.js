
import * as THREE from 'three';
import './style.css';

// ==========================================
// ROCKET SOCCER 3D - REBUILT GAME ENGINE
// ==========================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8bb7d2);
scene.fog = new THREE.Fog(0x8bb7d2, 100, 190);

const camera = new THREE.PerspectiveCamera(
  65, window.innerWidth / window.innerHeight, 0.1, 400
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

document.querySelector('#app').prepend(renderer.domElement);

// LIGHTING
scene.add(new THREE.HemisphereLight(0xffffff, 0x315044, 2));

const sunlight = new THREE.DirectionalLight(0xffffff, 2.2);
sunlight.position.set(-25, 45, 25);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
scene.add(sunlight);

// MATERIALS
const material = (color, roughness = 0.6, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const whiteLine = new THREE.MeshBasicMaterial({ color: 0xffffff });

// FIELD
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 58),
  material(0x25834b)
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// FIELD STRIPES
for (let i = 0; i < 9; i++) {
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 58),
    material(i % 2 ? 0x238049 : 0x2a8b50)
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(-40 + i * 10, 0.02, 0);
  scene.add(stripe);
}

function addLine(x1, z1, x2, z2, width = 0.15) {
  const dx = x2 - x1;
  const dz = z2 - z1;

  const line = new THREE.Mesh(
    new THREE.BoxGeometry(Math.hypot(dx, dz), 0.04, width),
    whiteLine
  );

  line.position.set((x1 + x2) / 2, 0.05, (z1 + z2) / 2);
  line.rotation.y = -Math.atan2(dz, dx);
  scene.add(line);
}

addLine(-43, -27, 43, -27);
addLine(-43, 27, 43, 27);
addLine(-43, -27, -43, 27);
addLine(43, -27, 43, 27);
addLine(0, -27, 0, 27);

const centerCircle = new THREE.Mesh(
  new THREE.RingGeometry(7.85, 8, 64),
  whiteLine
);
centerCircle.rotation.x = -Math.PI / 2;
centerCircle.position.y = 0.06;
scene.add(centerCircle);

// GOALS
function createGoal(x, color) {
  const group = new THREE.Group();
  group.position.x = x;

  const frame = material(color, 0.35, 0.4);

  for (const z of [-7, 7]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 6, 0.65),
      frame
    );
    post.position.set(0, 3, z);
    post.castShadow = true;
    group.add(post);
  }

  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.65, 14),
    frame
  );
  crossbar.position.y = 6;
  group.add(crossbar);

  scene.add(group);
}

createGoal(-43, 0x42baff);
createGoal(43, 0xff9b3d);

// ==========================================
// CAR CREATION
// ==========================================

function createCar(color, accent) {
  const car = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.05, 2.05),
    material(color, 0.32, 0.3)
  );
  body.position.y = 1;
  body.castShadow = true;
  car.add(body);

  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.35, 1.9),
    material(accent)
  );
  hood.position.set(1, 1.5, 0);
  car.add(hood);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.8, 1.65),
    material(0x14283b, 0.25, 0.2)
  );
  cabin.position.set(-0.35, 1.75, 0);
  car.add(cabin);

  const wheels = [];

  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.48, 0.32, 16),
        material(0x111820)
      );

      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.55, z);
      car.add(wheel);
      wheels.push(wheel);
    }
  }

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 1.5, 12),
    new THREE.MeshBasicMaterial({ color: 0x54dfff })
  );

  flame.rotation.z = -Math.PI / 2;
  flame.position.set(-2.1, 0.9, 0);
  flame.visible = false;
  car.add(flame);

  car.userData.wheels = wheels;
  car.userData.flame = flame;

  scene.add(car);
  return car;
}

const player = createCar(0x168fe0, 0x70d7ff);
const opponent = createCar(0xe87922, 0xffc16b);

// Heading zero means facing toward positive X.
let playerYaw = 0;
let aiYaw = Math.PI;

player.position.set(-10, 0, 10);
opponent.position.set(20, 0, -8);

// ==========================================
// SOCCER BALL
// ==========================================

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(1.25, 32, 24),
  material(0xf5f7fa, 0.28, 0.12)
);

ball.position.set(0, 1.3, 0);
ball.castShadow = true;
scene.add(ball);

const ballVelocity = new THREE.Vector3();

// ==========================================
// GAME STATE
// ==========================================

const keys = new Set();
const justPressed = new Set();

let playerSpeed = 0;
let playerY = 0;
let playerVerticalSpeed = 0;
let playerBoost = 100;

let aiSpeed = 0;

let blueScore = 0;
let orangeScore = 0;

let started = false;
let paused = false;
let cameraMode = 0;
let messageTimer = 0;

const $ = selector => document.querySelector(selector);

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

// ==========================================
// KEYBOARD CONTROLS
// ==========================================

window.addEventListener('keydown', event => {
  const code = event.code;

  if (
    ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      .includes(code)
  ) {
    event.preventDefault();
  }

  if (!keys.has(code)) justPressed.add(code);
  keys.add(code);

  if (event.repeat) return;

  if (code === 'KeyR' && started && !paused) {
    resetPositions();
    showMessage('RESET!', 'Back to kickoff', 1);
  }

  if (code === 'KeyC') {
    cameraMode = (cameraMode + 1) % 2;
  }

  if (code === 'Escape') {
    togglePause();
  }
});

window.addEventListener('keyup', event => {
  keys.delete(event.code);
});

window.addEventListener('blur', () => {
  keys.clear();
  justPressed.clear();
});

// MOBILE CONTROLS
document.querySelectorAll('#mobileControls button').forEach(button => {
  const code = button.dataset.key;

  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);

    if (!keys.has(code)) justPressed.add(code);
    keys.add(code);
  });

  const release = event => {
    event.preventDefault();
    keys.delete(code);
  };

  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

// ==========================================
// UI
// ==========================================

function showMessage(title, subtitle, duration = 1.8) {
  $('#messageTitle').textContent = title;
  $('#messageSub').textContent = subtitle;
  $('#centerMessage').classList.add('show');
  messageTimer = duration;
}

function togglePause() {
  if (!started) return;

  paused = !paused;

  $('#pauseOverlay').classList.toggle('hidden', !paused);
  $('#status').textContent = paused ? 'PAUSED' : 'LIVE';
}

$('#pauseBtn').addEventListener('click', togglePause);
$('#resumeBtn').addEventListener('click', togglePause);

$('#playBtn').addEventListener('click', () => {
  started = true;
  $('#startOverlay').classList.add('hidden');
  showMessage('KICKOFF!', 'WASD to drive • SHIFT to boost', 1.7);
});

// ==========================================
// RESET AND SCORING
// ==========================================

function resetPositions() {
  player.position.set(-10, 0, 10);
  playerYaw = 0;
  playerSpeed = 0;
  playerY = 0;
  playerVerticalSpeed = 0;
  playerBoost = 100;

  opponent.position.set(20, 0, -8);
  aiYaw = Math.PI;
  aiSpeed = 0;

  ball.position.set(0, 1.3, 0);
  ballVelocity.set(0, 0, 0);
}

function scoreGoal(team) {
  if (team === 'blue') {
    blueScore++;
    $('#blueScore').textContent = blueScore;
    showMessage('BLUE SCORES!', 'Amazing shot!', 2.2);
  } else {
    orangeScore++;
    $('#orangeScore').textContent = orangeScore;
    showMessage('ORANGE SCORES!', 'Get ready for kickoff!', 2.2);
  }

  resetPositions();
}

// ==========================================
// PLAYER MOVEMENT - REBUILT
// ==========================================

function updatePlayer(dt) {
  const forward = keys.has('KeyW') || keys.has('ArrowUp');
  const reverse = keys.has('KeyS') || keys.has('ArrowDown');
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');

  const boosting =
    (keys.has('ShiftLeft') || keys.has('ShiftRight')) &&
    playerBoost > 0;

  // ACCELERATION AND BRAKING
  if (forward) playerSpeed += 27 * dt;
  if (reverse) playerSpeed -= 34 * dt;

  // Natural friction when no direction is pressed.
  if (!forward && !reverse) {
    playerSpeed *= Math.pow(0.88, dt * 60);
  }

  const maxSpeed = boosting ? 31 : 20;
  playerSpeed = clamp(playerSpeed, -10, maxSpeed);

  // BOOST
  const usingBoost = boosting && forward && playerSpeed > 0;

  if (usingBoost) {
    playerBoost = Math.max(0, playerBoost - 30 * dt);
  } else {
    playerBoost = Math.min(100, playerBoost + 13 * dt);
  }

  // STEERING
  const steering = (right ? 1 : 0) - (left ? 1 : 0);

  if (Math.abs(playerSpeed) > 0.5) {
    const speedFactor = clamp(Math.abs(playerSpeed) / 6, 0.25, 1);

    playerYaw +=
      steering *
      2.5 *
      dt *
      speedFactor *
      (playerSpeed >= 0 ? 1 : -1);
  }

  // JUMP ONLY ON NEW SPACE PRESS
  if (justPressed.has('Space') && playerY <= 0.01) {
    playerVerticalSpeed = 10;
  }

  playerVerticalSpeed -= 24 * dt;
  playerY += playerVerticalSpeed * dt;

  if (playerY < 0) {
    playerY = 0;
    playerVerticalSpeed = 0;
  }

  // IMPORTANT:
  // Car nose is positive X.
  // Heading and visual rotation now agree.
  const direction = new THREE.Vector3(
    Math.cos(playerYaw),
    0,
    Math.sin(playerYaw)
  );

  player.position.x += direction.x * playerSpeed * dt;
  player.position.z += direction.z * playerSpeed * dt;

  player.position.x = clamp(player.position.x, -40, 40);
  player.position.z = clamp(player.position.z, -25, 25);
  player.position.y = playerY;

  // Correct visual facing direction.
  player.rotation.y = -playerYaw;

  // Wheels and boost flame.
  player.userData.wheels.forEach(wheel => {
    wheel.rotation.z -= playerSpeed * dt * 1.7;
  });

  player.userData.flame.visible = usingBoost;

  player.userData.flame.scale.setScalar(
    usingBoost ? 1 + Math.random() * 0.3 : 0
  );
}

// ==========================================
// AI OPPONENT - REBUILT
// ==========================================

function updateAI(dt) {
  // AI tries to get behind the ball and push toward the blue goal.
  const target = new THREE.Vector3(
    ball.position.x + 3.2,
    0,
    ball.position.z
  );

  target.x = clamp(target.x, -36, 37);
  target.z = clamp(target.z, -22, 22);

  const dx = target.x - opponent.position.x;
  const dz = target.z - opponent.position.z;

  const distance = Math.hypot(dx, dz);

  // Direction to target.
  const desiredYaw = Math.atan2(dz, dx);

  let difference = Math.atan2(
    Math.sin(desiredYaw - aiYaw),
    Math.cos(desiredYaw - aiYaw)
  );

  aiYaw += clamp(difference, -2.8 * dt, 2.8 * dt);

  // Accelerate toward the target.
  if (distance > 2.5) {
    aiSpeed += 18 * dt;
  } else {
    aiSpeed *= Math.pow(0.82, dt * 60);
  }

  const aiBoosting = distance > 12 && aiSpeed < 17;

  if (aiBoosting) {
    aiSpeed += 12 * dt;
  }

  aiSpeed = clamp(aiSpeed, 0, aiBoosting ? 23 : 16);

  const direction = new THREE.Vector3(
    Math.cos(aiYaw),
    0,
    Math.sin(aiYaw)
  );

  opponent.position.x += direction.x * aiSpeed * dt;
  opponent.position.z += direction.z * aiSpeed * dt;

  opponent.position.x = clamp(opponent.position.x, -40, 40);
  opponent.position.z = clamp(opponent.position.z, -25, 25);

  opponent.rotation.y = -aiYaw;

  opponent.userData.flame.visible = aiBoosting;

  opponent.userData.wheels.forEach(wheel => {
    wheel.rotation.z -= aiSpeed * dt * 1.7;
  });
}

// ==========================================
// BALL COLLISIONS
// ==========================================

function collideCarWithBall(car, yaw, speed) {
  const center = new THREE.Vector3(
    car.position.x,
    car.position.y + 1,
    car.position.z
  );

  const difference = ball.position.clone().sub(center);
  const distance = difference.length();

  if (distance < 2.6 && distance > 0.001) {
    const normal = difference.normalize();

    ball.position.copy(center).addScaledVector(normal, 2.6);

    const impact = Math.max(6, speed * 0.65);

    ballVelocity.addScaledVector(normal, impact);

    // Push in the direction the car is facing.
    ballVelocity.x += Math.cos(yaw) * impact * 0.45;
    ballVelocity.z += Math.sin(yaw) * impact * 0.45;

    ballVelocity.y = Math.max(ballVelocity.y, 2.5);
  }
}

function updateBall(dt) {
  ballVelocity.y -= 12 * dt;

  ball.position.addScaledVector(ballVelocity, dt);

  // Floor bounce.
  if (ball.position.y < 1.25) {
    ball.position.y = 1.25;
    ballVelocity.y = Math.abs(ballVelocity.y) * 0.55;

    if (Math.abs(ballVelocity.y) < 1) {
      ballVelocity.y = 0;
    }
  }

  // Side walls.
  if (Math.abs(ball.position.z) > 26) {
    ball.position.z = Math.sign(ball.position.z) * 26;
    ballVelocity.z *= -0.75;
  }

  // Goal lines.
  if (ball.position.x < -43.8 || ball.position.x > 43.8) {
    const insideGoal =
      Math.abs(ball.position.z) < 7 &&
      ball.position.y < 6;

    if (insideGoal) {
      scoreGoal(ball.position.x < 0 ? 'orange' : 'blue');
      return;
    }

    ball.position.x = clamp(ball.position.x, -43.8, 43.8);
    ballVelocity.x *= -0.75;
  }

  // Friction.
  ballVelocity.multiplyScalar(Math.pow(0.992, dt * 60));

  // Car impacts.
  collideCarWithBall(player, playerYaw, Math.abs(playerSpeed));
  collideCarWithBall(opponent, aiYaw, aiSpeed);

  // Speed limits.
  ballVelocity.x = clamp(ballVelocity.x, -34, 34);
  ballVelocity.y = clamp(ballVelocity.y, -18, 18);
  ballVelocity.z = clamp(ballVelocity.z, -28, 28);
}

// ==========================================
// CAMERA
// ==========================================

function updateCamera(dt) {
  let targetPosition;
  let lookAtPosition;

  if (cameraMode === 0) {
    const direction = new THREE.Vector3(
      Math.cos(playerYaw),
      0,
      Math.sin(playerYaw)
    );

    targetPosition = player.position.clone()
      .addScaledVector(direction, -16)
      .add(new THREE.Vector3(0, 9, 0));

    lookAtPosition = player.position.clone()
      .addScaledVector(direction, 8)
      .add(new THREE.Vector3(0, 1, 0));
  } else {
    targetPosition = new THREE.Vector3(0, 55, 0);
    lookAtPosition = new THREE.Vector3(0, 0, 0);
  }

  camera.position.lerp(
    targetPosition,
    1 - Math.pow(0.001, dt)
  );

  camera.lookAt(lookAtPosition);
}

// ==========================================
// MAIN GAME LOOP
// ==========================================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);

  if (started && !paused) {
    updatePlayer(dt);
    updateAI(dt);
    updateBall(dt);
    updateCamera(dt);

    if (messageTimer > 0) {
      messageTimer -= dt;

      if (messageTimer <= 0) {
        $('#centerMessage').classList.remove('show');
      }
    }
  } else if (!started) {
    camera.position.lerp(
      new THREE.Vector3(0, 35, 48),
      0.02
    );
    camera.lookAt(0, 0, 0);
  }

  $('#boostValue').textContent = Math.round(playerBoost);
  $('#boostFill').style.width = playerBoost + '%';

  renderer.render(scene, camera);

  justPressed.clear();
}

animate();

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
});
