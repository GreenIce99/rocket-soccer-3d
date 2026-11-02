import * as THREE from 'three';
import './style.css';

// =====================================
// ROCKET SOCCER 3D
// =====================================

const $ = (id) => document.getElementById(id);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c9ed);
scene.fog = new THREE.Fog(0x87c9ed, 65, 150);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

$('game').appendChild(renderer.domElement);

// =====================================
// LIGHTING
// =====================================

scene.add(new THREE.HemisphereLight(0xffffff, 0x35516b, 2));

const sunlight = new THREE.DirectionalLight(0xffffff, 2.2);
sunlight.position.set(-25, 45, 20);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
scene.add(sunlight);

// =====================================
// FIELD
// =====================================

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

function addLine(x, z, width, depth, color = 0xffffff) {
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.035, depth),
    new THREE.MeshBasicMaterial({ color })
  );

  line.position.set(x, -0.06, z);
  scene.add(line);
}

addLine(0, 0, 0.18, 60);
addLine(-44.5, 0, 0.5, 60);
addLine(44.5, 0, 0.5, 60);
addLine(0, -29.5, 90, 0.5);
addLine(0, 29.5, 90, 0.5);

// Center circle
const circle = new THREE.Mesh(
  new THREE.RingGeometry(8, 8.18, 80),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
  })
);

circle.rotation.x = -Math.PI / 2;
circle.position.y = -0.045;
scene.add(circle);

// =====================================
// GOALS
// =====================================

function createGoal(x, color) {
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.3,
    roughness: 0.4
  });

  function post(y, z) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, y, 1),
      material
    );

    mesh.position.set(0, y / 2, z);
    mesh.castShadow = true;
    group.add(mesh);
  }

  post(8, -8);
  post(8, 8);

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

// =====================================
// CAR CREATION
// =====================================

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
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.8, 1.7),
    dark
  );

  cabin.position.set(-0.3, 1.7, 0);
  cabin.castShadow = true;
  group.add(cabin);

  // Front bumper
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 2.3),
    dark
  );

  bumper.position.set(2, 0.55, 0);
  group.add(bumper);

  // Wheels
  for (const x of [-1.1, 1.1]) {
    for (const z of [-1.15, 1.15]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.48, 0.3, 20),
        dark
      );

      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.5, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }

  group.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });

  scene.add(group);
  return group;
}

// =====================================
// BALL
// =====================================

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

const ballVelocity = new THREE.Vector3();

// Ball markings
const ballLines = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius + 0.008, 16, 12),
  new THREE.MeshBasicMaterial({
    color: 0x263447,
    wireframe: true,
    transparent: true,
    opacity: 0.3
  })
);

ball.add(ballLines);

// =====================================
// PLAYERS
// =====================================

const player = createCar(0x078cff);
const ai = createCar(0xff761c);

let playerYaw = 0;
let aiYaw = Math.PI;

let playerVelocity = new THREE.Vector3();
let aiVelocity = new THREE.Vector3();

let playerBoost = 100;
let jumping = false;
let jumpVelocity = 0;

let aiBoost = 100;

// =====================================
// GAME STATE
// =====================================

let blueScore = 0;
let orangeScore = 0;

let timeLeft = 180;
let playing = false;
let paused = false;
let overheadCamera = false;

let lastTime = 0;
let goalCooldown = 0;

const keys = {};

window.addEventListener('keydown', (event) => {
  keys[event.code] = true;

  if (
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']
      .includes(event.code)
  ) {
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

// =====================================
// RESET
// =====================================

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

// =====================================
// PLAYER MOVEMENT
// =====================================

function updatePlayer(dt) {
  const forward = new THREE.Vector3(
    Math.cos(playerYaw),
    0,
    Math.sin(playerYaw)
  );

  const accelerating =
    keys.KeyW || keys.ArrowUp;

  const reversing =
    keys.KeyS || keys.ArrowDown;

  const left =
    keys.KeyA || keys.ArrowLeft;

  const right =
    keys.KeyD || keys.ArrowRight;

  const boosting =
    keys.ShiftLeft || keys.ShiftRight;

  if (left) {
    playerYaw += 2.7 * dt *
      (playerVelocity.length() > 0.5 ? 1 : 0.6);
  }

  if (right) {
    playerYaw -= 2.7 * dt *
      (playerVelocity.length() > 0.5 ? 1 : 0.6);
  }

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

  // Keep player inside arena
  player.position.x = THREE.MathUtils.clamp(player.position.x, -42, 42);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -27, 27);

  // Jump physics
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

// =====================================
// AI MOVEMENT
// =====================================

function updateAI(dt) {
  const target = new THREE.Vector3(
    ball.position.x + 3,
    0,
    ball.position.z
  );

  const dx = target.x - ai.position.x;
  const dz = target.z - ai.position.z;

  const desiredYaw = Math.atan2(dz, dx);

  let difference = desiredYaw - aiYaw;

  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;

  aiYaw += THREE.MathUtils.clamp(
    difference,
    -2.4 * dt,
    2.4 * dt
  );

  const forward = new THREE.Vector3(
    Math.cos(aiYaw),
    0,
    Math.sin(aiYaw)
  );

  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance > 2.5) {
    aiVelocity.addScaledVector(forward, 15 * dt);
  }

  if (distance > 13 && aiBoost > 0) {
    aiVelocity.addScaledVector(forward, 17 * dt);
    aiBoost = Math.max(0, aiBoost - 15 * dt);
  } else {
    aiBoost = Math.min(100, aiBoost + 8 * dt);
  }

  if (aiVelocity.length() > 23) {
    aiVelocity.setLength(23);
  }

  aiVelocity.multiplyScalar(Math.pow(0.988, dt * 60));

  ai.position.addScaledVector(aiVelocity, dt);

  ai.position.x = THREE.MathUtils.clamp(ai.position.x, -42, 42);
  ai.position.z = THREE.MathUtils.clamp(ai.position.z, -27, 27);

  ai.rotation.y = -aiYaw;
}

// =====================================
// CAR AND BALL COLLISIONS
// =====================================

function collideCarWithBall(car, velocity, yaw) {
  const difference = new THREE.Vector3(
    ball.position.x - car.position.x,
    0,
    ball.position.z - car.position.z
  );

  const distance = difference.length();
  const minimumDistance = 2.0;

  if (distance < minimumDistance && distance > 0.001) {
    const normal = difference.normalize();

    const overlap = minimumDistance - distance;

    ball.position.x += normal.x * overlap * 0.7;
    ball.position.z += normal.z * overlap * 0.7;

    const impact = Math.max(0, velocity.dot(normal));

    ballVelocity.x += normal.x * (impact * 0.65 + 5);
    ballVelocity.z += normal.z * (impact * 0.65 + 5);

    const facing = new THREE.Vector3(
      Math.cos(yaw),
      0,
      Math.sin(yaw)
    );

    ballVelocity.addScaledVector(facing, 2.5);

    ballVelocity.y += car.position.y > 0.2 ? 3 : 1.5;
  }
}

function updateBall(dt) {
  ballVelocity.y -= 15 * dt;

  ball.position.addScaledVector(ballVelocity, dt);

  // Floor bounce
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

  // End walls, leaving goal openings
  if (Math.abs(ball.position.x) > 44) {
    const inGoal = Math.abs(ball.position.z) < 8 &&
      ball.position.y < 8;

    if (!inGoal) {
      ball.position.x = Math.sign(ball.position.x) * 44;
      ballVelocity.x *= -0.75;
    }
  }

  // Air resistance
  ballVelocity.multiplyScalar(Math.pow(0.997, dt * 60));

  collideCarWithBall(player, playerVelocity, playerYaw);
  collideCarWithBall(ai, aiVelocity, aiYaw);

  // Limit extreme ball speeds
  if (ballVelocity.length() > 40) {
    ballVelocity.setLength(40);
  }

  ball.rotation.x += ballVelocity.z * dt * 0.5;
  ball.rotation.z -= ballVelocity.x * dt * 0.5;
}

// =====================================
// GOALS
// =====================================

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

function scoreGoal(message) {
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

// =====================================
// CAMERA
// =====================================

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

// =====================================
// UI
// =====================================

function updateUI(dt) {
  $('boostFill').style.width = playerBoost + '%';
  $('boostValue').textContent = Math.round(playerBoost);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);

  $('timer').textContent =
    `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// =====================================
// START GAME
// =====================================

$('playBtn').addEventListener('click', () => {
  if (paused && playing && goalCooldown > 0) {
    goalCooldown = 0;
  }

  if (!playing) {
    playing = true;
    resetPositions();
  }

  paused = false;
  $('message').style.display = 'none';
});

// =====================================
// GAME LOOP
// =====================================

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

    updateUI(dt);
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

// =====================================
// RESIZE
// =====================================

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

// =====================================
// INITIALIZE
// =====================================

resetPositions();

camera.position.set(-20, 12, 0);
camera.lookAt(0, 0, 0);

requestAnimationFrame(animate);
