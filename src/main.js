
import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071426);
scene.fog = new THREE.Fog(0x071426, 65, 150);

const camera = new THREE.PerspectiveCamera(
  65, window.innerWidth / window.innerHeight, 0.1, 250
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
document.body.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9bdcff, 0x17351e, 2));

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(-15, 35, 20);
sun.castShadow = true;
scene.add(sun);

function material(color, roughness = 0.6, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function cube(w, h, d, color, x, y, z, parent = scene, metalness = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material(color, 0.4, metalness)
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(150, 100),
  material(0x176b45)
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.12;
floor.receiveShadow = true;
scene.add(floor);

// Arena
cube(100, 1, 2, 0x172b45, 0, 0, -30);
cube(100, 1, 2, 0x172b45, 0, 0, 30);
cube(2, 1, 60, 0x172b45, -50, 0, 0);
cube(2, 1, 60, 0x172b45, 50, 0, 0);

// Glowing-looking field markings
function line(x, z, w, d, color = 0xffffff) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.035, d),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.position.set(x, -0.045, z);
  scene.add(mesh);
}

line(0, 0, 0.12, 60);
const circle = new THREE.Mesh(
  new THREE.RingGeometry(7.9, 8.05, 64),
  new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
);
circle.rotation.x = -Math.PI / 2;
circle.position.y = -0.04;
scene.add(circle);

for (const x of [-38, 38]) {
  const goalColor = x < 0 ? 0x168bff : 0xff812c;
  cube(1, 5, 16, goalColor, x, 2.5, 0, scene, 0.3);
  cube(12, 1, 1, goalColor, x < 0 ? -44 : 44, 5, 0);
  cube(1, 5, 16, goalColor, x < 0 ? -44 : 44, 2.5, 0);
}

// Build the player's car
const car = new THREE.Group();
scene.add(car);

const bluePaint = material(0x168bff, 0.25, 0.45);
const darkPaint = material(0x101a2c, 0.35, 0.3);

const body = new THREE.Mesh(
  new THREE.BoxGeometry(2.3, 0.65, 3.5), bluePaint
);
body.position.y = 0.8;
body.castShadow = true;
car.add(body);

const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(1.55, 0.75, 1.65),
  material(0x7ddcff, 0.2, 0.4)
);
cabin.position.set(0, 1.4, -0.2);
cabin.castShadow = true;
car.add(cabin);

const wheels = [];
for (const x of [-1.15, 1.15]) {
  for (const z of [-1.05, 1.05]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.43, 0.43, 0.32, 20),
      darkPaint
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.48, z);
    wheel.castShadow = true;
    car.add(wheel);
    wheels.push(wheel);
  }
}

const flame = new THREE.Mesh(
  new THREE.ConeGeometry(0.38, 1.6, 16),
  new THREE.MeshBasicMaterial({ color: 0x31eaff })
);
flame.rotation.x = -Math.PI / 2;
flame.position.set(0, 0.85, 2.35);
flame.visible = false;
car.add(flame);

// Soccer ball
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(1.35, 32, 24),
  material(0xf4f7ff, 0.3)
);
ball.position.set(0, 1.4, 0);
ball.castShadow = true;
scene.add(ball);

const ballVelocity = new THREE.Vector3();
const carVelocity = new THREE.Vector3();
const keys = {};
let boost = 100;
let blueScore = 0;
let orangeScore = 0;
let timeLeft = 180;
let playing = false;
let cameraMode = 0;
let carHeight = 0;
let jumpVelocity = 0;
let elapsed = 0;

const $ = id => document.getElementById(id);

function resetPositions() {
  car.position.set(0, 0, 16);
  car.rotation.set(0, Math.PI, 0);
  carVelocity.set(0, 0, 0);
  carHeight = 0;
  jumpVelocity = 0;
  ball.position.set(0, 1.4, 0);
  ballVelocity.set(0, 0, 0);
}

function message(text) {
  const el = $('message');
  if (el) el.textContent = text;
}

$('playButton').addEventListener('click', () => {
  playing = true;
  $('overlay').style.display = 'none';
  resetPositions();
  message('KICKOFF!');
});

window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();

  if (e.code === 'KeyR') resetPositions();
  if (e.code === 'KeyC') cameraMode = (cameraMode + 1) % 2;
  if (e.code === 'Space' && playing && carHeight < 0.05) {
    jumpVelocity = 8.5;
  }
});

window.addEventListener('keyup', e => keys[e.code] = false);

function update(dt) {
  if (!playing) return;

  elapsed += dt;
  timeLeft -= dt;
  if (timeLeft <= 0) {
    timeLeft = 0;
    playing = false;
    $('overlay').style.display = 'grid';
    $('playButton').textContent = 'PLAY AGAIN';
    message('FULL TIME!');
  }

  const forward = new THREE.Vector3(
    Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y)
  );

  const accelerating = keys.KeyW || keys.ArrowUp;
  const reversing = keys.KeyS || keys.ArrowDown;
  const steering = (keys.KeyA || keys.ArrowLeft ? 1 : 0)
                 - (keys.KeyD || keys.ArrowRight ? 1 : 0);
  const boosting = keys.ShiftLeft || keys.ShiftRight;

  if (accelerating) carVelocity.addScaledVector(forward, 22 * dt);
  if (reversing) carVelocity.addScaledVector(forward, -13 * dt);

  const speed = carVelocity.length();
  if (speed > 0.5) car.rotation.y += steering * dt * 2.1
    * Math.min(speed / 8, 1) * (accelerating ? 1 : -1);

  const isBoosting = boosting && boost > 0 && accelerating;
  if (isBoosting) {
    carVelocity.addScaledVector(forward, 38 * dt);
    boost = Math.max(0, boost - 30 * dt);
  } else {
    boost = Math.min(100, boost + 10 * dt);
  }

  flame.visible = isBoosting;
  carVelocity.multiplyScalar(Math.exp(-1.4 * dt));
  if (carVelocity.length() > 27) carVelocity.setLength(27);
  car.position.addScaledVector(carVelocity, dt);

  car.position.x = THREE.MathUtils.clamp(car.position.x, -47, 47);
  car.position.z = THREE.MathUtils.clamp(car.position.z, -27, 27);

  jumpVelocity -= 22 * dt;
  carHeight += jumpVelocity * dt;
  if (carHeight < 0) {
    carHeight = 0;
    jumpVelocity = 0;
  }
  car.position.y = carHeight;

  wheels.forEach(w => {
    w.rotation.x += speed * dt * 1.8;
  });

  // Ball movement and bounce
  ballVelocity.y -= 12 * dt;
  ball.position.addScaledVector(ballVelocity, dt);
  ballVelocity.multiplyScalar(Math.exp(-0.38 * dt));

  if (ball.position.y < 1.35) {
    ball.position.y = 1.35;
    ballVelocity.y = Math.abs(ballVelocity.y) * 0.65;
    if (Math.abs(ballVelocity.y) < 0.7) ballVelocity.y = 0;
  }

  if (Math.abs(ball.position.x) > 48) {
    ball.position.x = Math.sign(ball.position.x) * 48;
    ballVelocity.x *= -0.7;
  }
  if (Math.abs(ball.position.z) > 28) {
    ball.position.z = Math.sign(ball.position.z) * 28;
    ballVelocity.z *= -0.7;
  }

  // Car hits the ball
  const delta = ball.position.clone().sub(
    car.position.clone().add(new THREE.Vector3(0, 1, 0))
  );
  const distance = delta.length();
  if (distance < 2.8 && distance > 0.01) {
    delta.normalize();
    ball.position.addScaledVector(delta, 2.8 - distance);
    ballVelocity.addScaledVector(carVelocity, 0.8);
    ballVelocity.addScaledVector(delta, 7);
    if (isBoosting) ballVelocity.addScaledVector(forward, 9);
  }

  // Goals
  if (ball.position.x < -46 && Math.abs(ball.position.z) < 7) {
    blueScore++;
    scoreGoal('BLUE SCORES!');
  } else if (ball.position.x > 46 && Math.abs(ball.position.z) < 7) {
    orangeScore++;
    scoreGoal('ORANGE SCORES!');
  }

  $('blueScore').textContent = blueScore;
  $('orangeScore').textContent = orangeScore;
  $('clock').textContent =
    `${Math.floor(timeLeft / 60)}:${String(Math.floor(timeLeft % 60)).padStart(2, '0')}`;
  $('boostFill').style.width = `${boost}%`;
  $('boostNumber').textContent = Math.round(boost);
}

function scoreGoal(text) {
  message(text);
  resetPositions();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.035);
  update(dt);

  const forward = new THREE.Vector3(
    Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y)
  );

  if (cameraMode === 0) {
    const target = car.position.clone().addScaledVector(forward, -10);
    target.y += 6;
    camera.position.lerp(target, 0.08);
    camera.lookAt(car.position.x, car.position.y + 1, car.position.z);
  } else {
    camera.position.lerp(new THREE.Vector3(0, 48, 0.1), 0.04);
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
camera.position.set(0, 8, 28);
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
