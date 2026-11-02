import * as THREE from 'three';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8bb7d2);
scene.fog = new THREE.Fog(0x8bb7d2, 90, 190);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 13, 24);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.querySelector('#app').prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdaf0ff, 0x315044, 2.0));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(-25, 45, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
scene.add(sun);

const mat = (color, roughness = .7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const grassMat = mat(0x25834b);
const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8fff0 });
const wallMat = mat(0x243e58, .55, .25);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 58), grassMat);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

for (let i = 0; i < 9; i++) {
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(10, 58), mat(i % 2 ? 0x238049 : 0x2a8b50));
  stripe.rotation.x = -Math.PI / 2; stripe.position.set(-40 + i * 10, .012, 0); stripe.receiveShadow = true; scene.add(stripe);
}
function line(x1,z1,x2,z2,width=.16) {
  const dx=x2-x1, dz=z2-z1, len=Math.hypot(dx,dz);
  const m=new THREE.Mesh(new THREE.BoxGeometry(len,.035,width),lineMat);
  m.position.set((x1+x2)/2,.04,(z1+z2)/2); m.rotation.y=-Math.atan2(dz,dx); scene.add(m);
}
line(-43,-27,43,-27); line(-43,27,43,27); line(-43,-27,-43,27); line(43,-27,43,27);
line(0,-27,0,27,.12);
const circle = new THREE.Mesh(new THREE.RingGeometry(7.85,8,.16,96), lineMat);
circle.rotation.x=-Math.PI/2; circle.position.y=.05; scene.add(circle);
const spot = new THREE.Mesh(new THREE.CircleGeometry(.35,24),lineMat);
spot.rotation.x=-Math.PI/2; spot.position.y=.05; scene.add(spot);

function makeGoal(x, color, facing) {
  const group=new THREE.Group(); group.position.set(x,0,0);
  const frameMat=mat(color,.35,.45);
  const postGeo=new THREE.BoxGeometry(.65,6,.65);
  for (const z of [-7,7]) { const p=new THREE.Mesh(postGeo,frameMat); p.position.set(0,3,z); p.castShadow=true; group.add(p); }
  const bar=new THREE.Mesh(new THREE.BoxGeometry(.65,.65,14),frameMat); bar.position.y=6; bar.castShadow=true; group.add(bar);
  const net=new THREE.Mesh(new THREE.BoxGeometry(5,5.6,13.2),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.10,side:THREE.DoubleSide}));
  net.position.x=facing*2.3; net.position.y=2.8; group.add(net);
  scene.add(group);
}
makeGoal(-43,0x42baff,-1); makeGoal(43,0xff9b3d,1);

function createCar(color, accent) {
  const group=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(3.2,1.05,2.05),mat(color,.32,.35));
  body.position.y=.95; body.castShadow=true; group.add(body);
  const hood=new THREE.Mesh(new THREE.BoxGeometry(1.1,.35,1.9),mat(accent,.3,.25));
  hood.position.set(1.0,1.42,0); hood.castShadow=true; group.add(hood);
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.35,.8,1.65),mat(0x14283b,.25,.25));
  cabin.position.set(-.35,1.7,0); cabin.castShadow=true; group.add(cabin);
  const glass=new THREE.Mesh(new THREE.BoxGeometry(.08,.55,1.45),mat(0x77c9ed,.18,.2));
  glass.position.set(.34,1.75,0); group.add(glass);
  const wheels=[];
  for (const x of [-1,1]) for (const z of [-1,1]) {
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.32,16),mat(0x111820,.9));
    w.rotation.x=Math.PI/2; w.position.set(x,.55,z); w.castShadow=true; group.add(w); wheels.push(w);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.34,12),mat(accent,.3,.5));
    hub.rotation.x=Math.PI/2; hub.position.copy(w.position); group.add(hub);
  }
  const nose=new THREE.Mesh(new THREE.BoxGeometry(.16,.18,1.75),mat(accent,.3,.4));
  nose.position.set(1.63,1.05,0); group.add(nose);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.42,1.5,12),new THREE.MeshBasicMaterial({color:0x54dfff}));
  flame.rotation.z=-Math.PI/2; flame.position.set(-2.05,.9,0); flame.visible=false; group.add(flame);
  group.userData={wheels,flame};
  scene.add(group); return group;
}
const player=createCar(0x168fe0,0x70d7ff);
const opponent=createCar(0xe87922,0xffc16b);
player.position.set(-10,0,10); opponent.position.set(20,0,-8);

const ball=new THREE.Mesh(new THREE.SphereGeometry(1.25,32,24),mat(0xf5f7fa,.28,.12));
ball.position.set(0,1.3,0); ball.castShadow=true; scene.add(ball);
const ballEdges=new THREE.Mesh(new THREE.SphereGeometry(1.27,16,12),new THREE.MeshBasicMaterial({color:0x28384a,wireframe:true,transparent:true,opacity:.17}));
ball.add(ballEdges);

const keys=new Set();
let started=false, paused=false, cameraMode=0, blueScore=0, orangeScore=0;
let playerSpeed=0, playerVertical=0, playerY=0, playerYaw=0, playerBoost=100;
let aiSpeed=0, aiYaw=Math.PI, ballVel=new THREE.Vector3(), lastTime=0, messageTimer=0;
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
function showMessage(title,sub,duration=1.8){
  $('#messageTitle').textContent=title; $('#messageSub').textContent=sub;
  $('#centerMessage').classList.add('show'); messageTimer=duration;
}
function resetPositions(){
  player.position.set(-10,0,10); playerYaw=0; playerSpeed=0; playerY=0; playerVertical=0;
  opponent.position.set(20,0,-8); aiYaw=Math.PI; aiSpeed=0;
  ball.position.set(0,1.3,0); ballVel.set(0,0,0); playerBoost=100;
}
function score(team){
  if(team==='blue'){blueScore++;$('#blueScore').textContent=blueScore;}
  else {orangeScore++;$('#orangeScore').textContent=orangeScore;}
  showMessage(team==='blue'?'BLUE SCORES!':'ORANGE SCORES!', 'Get ready for the kickoff!', 2.2);
  resetPositions();
}
function addKey(code,down){ if(down) keys.add(code); else keys.delete(code); }
addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  addKey(e.code,true);
  if(e.repeat)return;
  if(e.code==='KeyR'&&started&&!paused){resetPositions();showMessage('RESET','Back to kickoff',1);}
  if(e.code==='KeyC'){cameraMode=(cameraMode+1)%2;}
  if(e.code==='Escape') togglePause();
});
addEventListener('keyup',e=>addKey(e.code,false));
document.querySelectorAll('#mobileControls button').forEach(btn=>{
  const code=btn.dataset.key;
  btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);addKey(code,true);});
  const release=e=>{e.preventDefault();addKey(code,false);};
  btn.addEventListener('pointerup',release); btn.addEventListener('pointercancel',release); btn.addEventListener('lostpointercapture',release);
});
function togglePause(){
  if(!started)return;
  paused=!paused; $('#pauseOverlay').classList.toggle('hidden',!paused);
  $('#status').textContent=paused?'PAUSED':'LIVE';
}
$('#pauseBtn').addEventListener('click',togglePause);
$('#resumeBtn').addEventListener('click',togglePause);
$('#playBtn').addEventListener('click',()=>{started=true;$('#startOverlay').classList.add('hidden');showMessage('KICKOFF!','WASD to drive • SHIFT to boost',1.7);});

const clock=new THREE.Clock();
function updatePlayer(dt){
  const forward=keys.has('KeyW')||keys.has('ArrowUp');
  const reverse=keys.has('KeyS')||keys.has('ArrowDown');
  const left=keys.has('KeyA')||keys.has('ArrowLeft');
  const right=keys.has('KeyD')||keys.has('ArrowRight');
  const boosting=(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&playerBoost>0&&forward;
  const maxSpeed=boosting?31:19;
  if(forward) playerSpeed+=26*dt;
  if(reverse) playerSpeed-=31*dt;
  if(!forward&&!reverse) playerSpeed*=Math.pow(.91,dt*60);
  playerSpeed=clamp(playerSpeed,-9,maxSpeed);
  if(boosting) playerBoost=Math.max(0,playerBoost-32*dt);
  else playerBoost=Math.min(100,playerBoost+13*dt);
  const steer=(right?1:0)-(left?1:0);
  if(Math.abs(playerSpeed)>.4) playerYaw+=steer*2.35*dt*(playerSpeed>=0?1:-1)*clamp(Math.abs(playerSpeed)/5,.25,1);
  playerY+=playerVertical*dt; playerVertical-=23*dt;
  if(playerY<0){playerY=0;playerVertical=0;}
  if(keys.has('Space')&&playerY===0) playerVertical=9.5;
  const dir=new THREE.Vector3(Math.cos(playerYaw),0,-Math.sin(playerYaw));
  player.position.addScaledVector(dir,playerSpeed*dt);
  player.position.x=clamp(player.position.x,-39,39); player.position.z=clamp(player.position.z,-24,24);
  player.position.y=playerY; player.rotation.y=playerYaw;
  player.userData.flame.visible=boosting;
  player.userData.flame.scale.setScalar(boosting?(.8+Math.random()*.35):0);
  player.userData.wheels.forEach(w=>w.rotation.z-=playerSpeed*dt*1.7);
}
function updateAI(dt){
  // Approach the ball from the orange-goal side so the car can push it
  // toward the blue goal (negative X).
  const goalDirection = new THREE.Vector3(-1, 0, 0);
  const approachPoint = new THREE.Vector3(
    ball.position.x - goalDirection.x * 3.2,
    0,
    ball.position.z
  );
  if (ball.position.x > 31) {
    approachPoint.set(34, 0, clamp(ball.position.z * 0.7, -19, 19));
  }
  approachPoint.x = clamp(approachPoint.x, -36, 37);
  approachPoint.z = clamp(approachPoint.z, -22, 22);

  const toTarget = new THREE.Vector3(
    approachPoint.x - opponent.position.x,
    0,
    approachPoint.z - opponent.position.z
  );
  const targetDistance = toTarget.length();

  // In this game's coordinate system yaw=0 points along +X.
  // atan2(-Z, X) therefore points the nose toward the target.
  const desiredYaw = targetDistance > 0.8
    ? Math.atan2(-toTarget.z, toTarget.x)
    : Math.atan2(-(ball.position.z - opponent.position.z),
                 ball.position.x - opponent.position.x);

  let angleDifference = Math.atan2(
    Math.sin(desiredYaw - aiYaw),
    Math.cos(desiredYaw - aiYaw)
  );
  aiYaw += clamp(angleDifference, -2.8 * dt, 2.8 * dt);

  const shouldDrive = targetDistance > 1.4;
  const boosting = shouldDrive && targetDistance > 10 && aiSpeed < 17;
  if (shouldDrive) aiSpeed += (boosting ? 25 : 18) * dt;
  else aiSpeed *= Math.pow(0.78, dt * 60);

  aiSpeed = clamp(aiSpeed, 0, boosting ? 22 : 14);
  const forward = new THREE.Vector3(Math.cos(aiYaw), 0, -Math.sin(aiYaw));
  opponent.position.addScaledVector(forward, aiSpeed * dt);
  opponent.position.x = clamp(opponent.position.x, -39, 39);
  opponent.position.z = clamp(opponent.position.z, -24, 24);
  opponent.rotation.y = -aiYaw;

  opponent.userData.flame.visible = boosting;
  opponent.userData.flame.scale.setScalar(boosting ? 1 : 0);
  opponent.userData.wheels.forEach(w => w.rotation.z -= aiSpeed * dt * 1.7);
}
function carBallCollision(car,carYaw,power){
  const carCenter=new THREE.Vector3(car.position.x,car.position.y+1.05,car.position.z);
  const delta=ball.position.clone().sub(carCenter);
  const dist=delta.length();
  if(dist<2.55&&dist>.001){
    const normal=delta.normalize();
    ball.position.copy(carCenter).addScaledVector(normal,2.56);
    const impulse=Math.max(power,7);
    ballVel.addScaledVector(normal,impulse);
    ballVel.x+=Math.cos(carYaw)*power*.48;
    ballVel.z-=Math.sin(carYaw)*power*.48;
    ballVel.y=Math.max(ballVel.y,2.3);
  }
}
function updateBall(dt){
  ballVel.y-=12*dt;
  ball.position.addScaledVector(ballVel,dt);
  if(ball.position.y<1.25){ball.position.y=1.25;ballVel.y=Math.abs(ballVel.y)*.58;if(Math.abs(ballVel.y)<1.1)ballVel.y=0;}
  if(Math.abs(ball.position.z)>26){ball.position.z=Math.sign(ball.position.z)*26;ballVel.z*=-.72;}
  // Side walls and goal-mouth openings.
  if(ball.position.x<-43.8||ball.position.x>43.8){
    const inGoal=Math.abs(ball.position.z)<7&&ball.position.y<6.1;
    if(inGoal){score(ball.position.x<0?'orange':'blue');return;}
    ball.position.x=clamp(ball.position.x,-43.8,43.8);ballVel.x*=-.72;
  }
  ballVel.multiplyScalar(Math.pow(.992,dt*60));
  ball.rotation.x+=ballVel.z*dt*.6; ball.rotation.z-=ballVel.x*dt*.6;
  carBallCollision(player,playerYaw,Math.abs(playerSpeed)*.62);
  carBallCollision(opponent,aiYaw,Math.abs(aiSpeed)*.7);
  ballVel.x=clamp(ballVel.x,-34,34);ballVel.z=clamp(ballVel.z,-28,28);ballVel.y=clamp(ballVel.y,-18,18);
}
function updateCamera(dt){
  const forward=new THREE.Vector3(Math.cos(playerYaw),0,-Math.sin(playerYaw));
  let desiredPos,look;
  if(cameraMode===0){
    desiredPos=player.position.clone().addScaledVector(forward,-15).add(new THREE.Vector3(0,8,0));
    look=player.position.clone().addScaledVector(forward,8).add(new THREE.Vector3(0,1,0));
  } else {
    desiredPos=new THREE.Vector3(0,48,0.01);look=new THREE.Vector3(0,0,0);
  }
  camera.position.lerp(desiredPos,1-Math.pow(.001,dt));
  const target=new THREE.Vector3();camera.getWorldDirection(target);
  camera.lookAt(look);
}
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.033);
  if(started&&!paused){
    updatePlayer(dt);updateAI(dt);updateBall(dt);updateCamera(dt);
    if(messageTimer>0){messageTimer-=dt;if(messageTimer<=0)$('#centerMessage').classList.remove('show');}
  } else if(!started){camera.position.lerp(new THREE.Vector3(0,33,48),.015);camera.lookAt(0,0,0);}
  $('#boostValue').textContent=Math.round(playerBoost);
  $('#boostFill').style.width=playerBoost+'%';
  renderer.render(scene,camera);
}
animate();

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
