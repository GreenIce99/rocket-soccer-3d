import * as THREE from 'three';
import './style.css';

// ROCKET SOCCER 3D — rebuilt arcade prototype
const game = document.getElementById('game');
const $ = (id) => document.getElementById(id);
const ui = {
  blueScore: $('blueScore'), orangeScore: $('orangeScore'), timer: $('timer'),
  boostFill: $('boostFill'), boostValue: $('boostValue'), message: $('message'),
  messageTitle: $('messageTitle'), messageSub: $('messageSub'), playBtn: $('playBtn'),
  soundBtn: $('soundBtn')
};
if (!game || Object.values(ui).some((el) => !el)) throw new Error('Game UI is incomplete. Check index.html.');

const FIELD_X = 47, FIELD_Z = 27, BALL_R = 0.92, MATCH_SECONDS = 180;
const clock = new THREE.Clock();
const keys = Object.create(null);
let blueScore = 0, orangeScore = 0, timeLeft = MATCH_SECONDS;
let running = false, paused = false, finished = false, cameraMode = 0;
let kickoff = 2.0, goalPause = 0, boost = 100, soundEnabled = true;
let audio = null, engineOsc = null, engineGain = null, boostOsc = null, boostGain = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071321);
scene.fog = new THREE.Fog(0x071321, 105, 185);
const camera = new THREE.PerspectiveCamera( sixtyFive(), innerWidth / innerHeight, 0.1, 260 );
function sixtyFive(){ return 65; }
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.domElement.setAttribute('aria-label', 'Rocket Soccer 3D game');
game.prepend(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xb9e4ff, 0x203044, 2.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4df, 2.5);
sun.position.set(-28, 48, 24); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -62; sun.shadow.camera.right = 62;
sun.shadow.camera.top = 58; sun.shadow.camera.bottom = -58; sun.shadow.bias = -0.00025; scene.add(sun);
const blueLamp = new THREE.PointLight(0x168fff, 90, 48); blueLamp.position.set(-43, 8, 0); scene.add(blueLamp);
const orangeLamp = new THREE.PointLight(0xff7629, 90, 48); orangeLamp.position.set(43, 8, 0); scene.add(orangeLamp);

const mat = (color, roughness = .55, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const mats = {
  grassA: mat(0x177a42, .96), grassB: mat(0x126b39, .96), white: mat(0xe9f4fa, .65),
  wall: mat(0x142a40, .48, .3), dark: mat(0x091421, .55, .35), metal: mat(0x829db5, .3, .8),
  blue: mat(0x087dff, .24, .55), blueLight: mat(0x66dfff, .2, .35), orange: mat(0xff7624, .25, .5),
  orangeLight: mat(0xffc17a, .22, .3), tire: mat(0x080d13, .9), glass: mat(0x153b57, .18, .55),
  ball: mat(0xf1f5f8, .28, .16), ballDark: mat(0x283b4c, .42, .18)
};
const addMesh = (parent, geo, material, pos, cast = true) => {
  const m = new THREE.Mesh(geo, material); m.position.set(...pos); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
};
const box = (parent, w, h, d, material, x, y, z) => addMesh(parent, new THREE.BoxGeometry(w,h,d), material, [x,y,z]);

// Pitch, markings and low arena walls
box(scene, 96, .8, 56, mats.dark, 0, -.48, 0);
for (let i=0;i<12;i++) box(scene, 8, .035, 54, i%2 ? mats.grassB : mats.grassA, -44+i*8, -.055, 0, false);
const lineMat = new THREE.MeshBasicMaterial({ color: 0xeaf7ff });
const fieldLine = (x,z,w,d) => addMesh(scene,new THREE.BoxGeometry(w,.035,d),lineMat,[x,.012,z],false);
fieldLine(0,0,.13,54); fieldLine(0,-27,94,.13); fieldLine(0,27,94,.13); fieldLine(-47,0,.13,54); fieldLine(47,0,.13,54);
const ring = addMesh(scene,new THREE.RingGeometry(5.6,5.78,80),lineMat,[0,.025,0],false); ring.rotation.x=-Math.PI/2;
addMesh(scene,new THREE.CircleGeometry(.2,24),lineMat,[0,.03,0],false).rotation.x=-Math.PI/2;
for (const side of [-1,1]) {
  fieldLine(side*35,0,.12,17); fieldLine(side*40,0,.12,17);
  fieldLine(side*37.5,-8,5,.12); fieldLine(side*37.5,8,5,.12);
}
// Side boards and transparent safety glass
for (const z of [-28,28]) {
  box(scene,96,2.2,1.1,mats.wall,0,1.05,z);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(96,7,.22),new THREE.MeshPhysicalMaterial({color:0x66bfff,roughness:.12,metalness:.15,transparent:true,opacity:.12,side:THREE.DoubleSide}));
  glass.position.set(0,5.6,z); scene.add(glass);
}
// Stands, seating blocks and roof trusses
for (const zSide of [-1,1]) {
  box(scene,108,10,13,mats.dark,0,5,zSide*39);
  for(let row=0;row<4;row++) for(let col=0;col<36;col++) {
    const seatMat = col<18 ? mats.blue : mats.orange;
    const seat = box(scene,1.85,.45,.85,seatMat,-46+col*2.65,1.1+row*1.55,zSide*(32+row*2.35));
    seat.castShadow=false;
  }
}
for(let x=-42;x<=42;x+=14) box(scene,.55,.55,88,mats.metal,x,17,0);
for(const x of [-38,-13,13,38]) for(const z of [-36,36]) {
  const pole=addMesh(scene,new THREE.CylinderGeometry(.2,.32,14,10),mats.metal,[x,7,z]);
  box(scene,4,.55,1.5,mats.white,x,14.3,z);
  const light=new THREE.PointLight(0xd7f1ff,30,56); light.position.set(x,13.5,z); scene.add(light);
}
// End wall panels around goal openings
for(const x of [-48,48]) for(const z of [-19,19]) box(scene,1.2,8,16,mats.wall,x,4,z);

function createGoal(x, color, inward) {
  const group=new THREE.Group(); group.position.set(x,0,0); scene.add(group);
  const frameMat=mat(color,.22,.65), glow=new THREE.MeshBasicMaterial({color});
  const post=(w,h,d,px,py,pz)=>box(group,w,h,d,frameMat,px,py,pz);
  post(.65,7,.65,0,3.5,-7); post(.65,7,.65,0,3.5,7); post(.65,.65,14,0,7,0);
  // net grid
  const netMat=new THREE.LineBasicMaterial({color,transparent:true,opacity:.35});
  for(let y=1;y<7;y+=1.2){const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,y,-7),new THREE.Vector3(inward*5,y,-7),new THREE.Vector3(inward*5,y,7),new THREE.Vector3(0,y,7)]);group.add(new THREE.Line(g,netMat));}
  for(let z=-7;z<=7;z+=1.4){const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.5,z),new THREE.Vector3(inward*5,.5,z),new THREE.Vector3(inward*5,7,z)]);group.add(new THREE.Line(g,netMat));}
  const aura=new THREE.Mesh(new THREE.PlaneGeometry(13,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.08,side:THREE.DoubleSide}));
  aura.position.set(inward*2.5,4,0); aura.rotation.y=Math.PI/2; group.add(aura);
  return group;
}
createGoal(-47,0x25aaff,1); createGoal(47,0xff852f,-1);

// Car models face local -Z. Body pieces are grouped so yaw controls the whole vehicle.
function createCar(color, highlight, isPlayer) {
  const root=new THREE.Group(); scene.add(root);
  const bodyMat=mat(color,.22,.55), trimMat=mat(highlight,.2,.45), windowMat=mat(0x16364e,.16,.6,{transparent:true,opacity:.94});
  box(root,2.45,.72,3.65,bodyMat,0,.72,0);
  box(root,2.05,.52,1.55,bodyMat,0,1.25,.25);
  const hood=box(root,2.12,.24,1.05,trimMat,0,1.12,-1.08);
  box(root,1.72,.08,1.15,windowMat,0,1.58,.22);
  box(root,2.25,.13,.22,trimMat,0,.97,-1.78);
  box(root,2.35,.16,.24,mats.dark,0,.47,1.72);
  // side skirts and wheel arches
  for(const s of [-1,1]) {
    box(root,.13,.25,2.55,mats.dark,s*1.18,.47,0);
    for(const z of [-1.15,1.15]) {
      const wheel=addMesh(root,new THREE.CylinderGeometry(.48,.48,.32,20),mats.tire,[s*1.18,.48,z]);
      wheel.rotation.z=Math.PI/2;
      const hub=addMesh(root,new THREE.CylinderGeometry(.22,.22,.34,16),trimMat,[s*1.18,.48,z]); hub.rotation.z=Math.PI/2;
    }
    const head=addMesh(root,new THREE.BoxGeometry(.55,.13,.08),new THREE.MeshBasicMaterial({color:0xc9f5ff}),[s*.72,.93,-1.83],false);
    const tail=addMesh(root,new THREE.BoxGeometry(.55,.12,.08),new THREE.MeshBasicMaterial({color:0xff302c}),[s*.72,.92,1.84],false);
  }
  // roof stripe, spoiler, exhaust glow
  box(root,.16,.045,2.25,trimMat,0,1.48,.05);
  box(root,2.2,.12,.28,mats.dark,0,1.35,1.78);
  const exhaust=new THREE.PointLight(highlight,0,5); exhaust.position.set(0,.8,2.15); root.add(exhaust);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.34,.9,12),new THREE.MeshBasicMaterial({color:highlight,transparent:true,opacity:.85}));
  flame.rotation.x=-Math.PI/2; flame.position.set(0,.8,2.55); flame.visible=false; root.add(flame);
  root.userData={exhaust,flame,isPlayer,bodyMat,trimMat};
  return {root,velocity:new THREE.Vector3(),yaw:isPlayer?-Math.PI/2:Math.PI/2,boost:100,vertical:0,grounded:true,wheelSpin:0};
}
const player=createCar(0x087dff,0x72e8ff,true);
const rival=createCar(0xff7624,0xffc078,false);

// Ball with dark pentagon-like patches
const ball=new THREE.Group(); scene.add(ball);
const ballCore=addMesh(ball,new THREE.SphereGeometry(BALL_R,32,24),mats.ball,[0,0,0]);
for(let i=0;i<12;i++){
  const phi=Math.acos(1-2*(i+.5)/12), theta=Math.PI*(1+Math.sqrt(5))*i;
  const v=new THREE.Vector3(Math.cos(theta)*Math.sin(phi),Math.cos(phi),Math.sin(theta)*Math.sin(phi));
  const patch=addMesh(ball,new THREE.CircleGeometry(.23,5),mats.ballDark,[v.x*.91,v.y*.91,v.z*.91],false);
  patch.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),v);
}
const ballVel=new THREE.Vector3();

// Stadium accent strips and animated goal lights
for(let x=-44;x<=44;x+=4){const p=box(scene,.08,.12,.2,x%8===0?mats.blueLight:mats.orangeLight,x,.08,-27.45);p.castShadow=false;}

// WebAudio synthesised SFX; starts only after the user presses Play.
function initAudio(){
  if(audio) { if(audio.state==='suspended') audio.resume(); return; }
  const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return;
  audio=new Ctx();
  engineOsc=audio.createOscillator(); engineOsc.type='sawtooth'; engineGain=audio.createGain(); engineGain.gain.value=0;
  const engineFilter=audio.createBiquadFilter(); engineFilter.type='lowpass'; engineFilter.frequency.value=380;
  engineOsc.connect(engineFilter).connect(engineGain).connect(audio.destination); engineOsc.start();
  boostOsc=audio.createOscillator(); boostOsc.type='triangle'; boostGain=audio.createGain(); boostGain.gain.value=0;
  boostOsc.connect(boostGain).connect(audio.destination); boostOsc.start();
}
function tone(freq=440,duration=.12,type='sine',volume=.12,slide=0){
  if(!soundEnabled||!audio)return; const o=audio.createOscillator(),g=audio.createGain(); const now=audio.currentTime;
  o.type=type;o.frequency.setValueAtTime(freq,now);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),now+duration);
  g.gain.setValueAtTime(volume,now);g.gain.exponentialRampToValueAtTime(.001,now+duration);
  o.connect(g).connect(audio.destination);o.start(now);o.stop(now+duration+.02);
}
function impactSound(power=1){tone(115+Math.min(power,12)*18,.16,'triangle',Math.min(.22,.07+power*.01),-65);}
function goalSound(){tone(440,.22,'sine',.16,220);setTimeout(()=>tone(660,.25,'sine',.15,180),130);setTimeout(()=>tone(880,.4,'sine',.13,120),280);}
function updateAudio(speed,boosting){
  if(!audio||!soundEnabled)return;
  const now=audio.currentTime;
  engineOsc.frequency.setTargetAtTime(58+Math.abs(speed)*10,now,.08);
  engineGain.gain.setTargetAtTime(running&&!paused?.025+Math.min(Math.abs(speed)/45,.045):0,now,.08);
  boostOsc.frequency.setTargetAtTime(85+Math.abs(speed)*5,now,.05);
  boostGain.gain.setTargetAtTime(boosting?.035:0,now,.06);
}

function resetPositions(){
  player.root.position.set(-12,.05,0);player.yaw=-Math.PI/2;player.velocity.set(0,0,0);player.vertical=0;player.grounded=true;player.boost=100;
  rival.root.position.set(12,.05,0);rival.yaw=Math.PI/2;rival.velocity.set(0,0,0);rival.vertical=0;rival.grounded=true;
  ball.position.set(0,BALL_R,0);ballVel.set(0,0,0);kickoff=2;goalPause=0;
}
resetPositions();

const forwardOf=(yaw)=>new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrapAngle=(a)=>Math.atan2(Math.sin(a),Math.cos(a));
function updateCar(car,dt,controls,ai=false){
  const fwd=forwardOf(car.yaw); let speed=car.velocity.dot(fwd);
  const steer=controls.steer||0, throttle=controls.throttle||0, handbrake=!!controls.handbrake, boosting=!!controls.boost&&car.boost>0&&throttle>0;
  const maxSpeed=boosting?39:25, accel=boosting?34:23;
  if(throttle!==0) speed+=throttle*accel*dt; else speed*=Math.exp(-1.0*dt);
  speed=clamp(speed,-12,maxSpeed);
  const turnStrength=(.65+Math.min(Math.abs(speed)/14,1.15))*(handbrake?1.55:1);
  car.yaw=wrapAngle(car.yaw+steer*turnStrength*dt*(speed<-.5?-1:1));
  const newForward=forwardOf(car.yaw);
  // Strong tire grip: sideways velocity decays rapidly unless handbrake is held.
  const longitudinal=newForward.clone().multiplyScalar(car.velocity.dot(newForward));
  const lateral=car.velocity.clone().sub(longitudinal);
  lateral.multiplyScalar(Math.exp(-(handbrake?2.8:13.5)*dt));
  car.velocity.copy(longitudinal.add(lateral));
  car.velocity.addScaledVector(newForward,(speed-car.velocity.dot(newForward))*Math.min(1,dt*10));
  if(boosting){car.boost=Math.max(0,car.boost-34*dt);car.velocity.addScaledVector(newForward,17*dt);}
  else if(!ai) car.boost=Math.min(100,car.boost+11*dt);
  car.root.position.addScaledVector(car.velocity,dt);
  car.root.position.x=clamp(car.root.position.x,-44.5,44.5);
  car.root.position.z=clamp(car.root.position.z,-24.5,24.5);
  if(controls.jump&&car.grounded){car.vertical=8.3;car.grounded=false;if(!ai)tone(240,.12,'sine',.08,120);}
  car.vertical-=22*dt;car.root.position.y+=car.vertical*dt;
  if(car.root.position.y<.05){car.root.position.y=.05;car.vertical=0;car.grounded=true;}
  car.root.rotation.y=car.yaw;
  car.root.userData.flame.visible=boosting;car.root.userData.exhaust.intensity=boosting?2.2:0;
  car.wheelSpin+=speed*dt*1.7;
  return {speed,boosting};
}
function playerControls(){
  return {throttle:(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),steer:(keys.KeyA||keys.ArrowLeft?1:0)-(keys.KeyD||keys.ArrowRight?1:0),boost:!!(keys.ShiftLeft||keys.ShiftRight),jump:!!keys.Space,handbrake:!!keys.KeyX};
}
function updateAI(dt){
  const target=new THREE.Vector3(ball.position.x+3.1,0,ball.position.z);
  const delta=target.clone().sub(rival.root.position);const desired=Math.atan2(-delta.x,-delta.z);
  const error=wrapAngle(desired-rival.yaw);
  const steer=clamp(error*2.4,-1,1);
  const distance=delta.length();
  let throttle=distance>3?1:.15;
  if(Math.abs(error)>1.8&&distance>8)throttle=.25;
  const jump=ball.position.y>2.8&&distance<8&&rival.grounded;
  return updateCar(rival,dt,{throttle,steer,boost:distance>12&&Math.abs(error)<.55&&rival.boost>8,jump,handbrake:false},true);
}

function collideCarBall(car,isPlayer){
  const carCenter=car.root.position.clone().add(new THREE.Vector3(0,.8,0));
  const ballCenter=ball.position.clone();const diff=ballCenter.sub(carCenter);diff.y*=.65;
  const minDist=2.15;if(diff.lengthSq()>minDist*minDist)return;
  if(diff.lengthSq()<.0001)diff.set(isPlayer?1:-1,.1,0);
  diff.normalize();const speed=car.velocity.length();
  const impulse=7+speed*.72;
  ballVel.addScaledVector(diff,impulse);ballVel.y=Math.max(ballVel.y,2.1+speed*.12);
  car.velocity.addScaledVector(diff,-1.1);
  impactSound(speed*.35);
}
function updateBall(dt){
  ballVel.y-=18*dt;ball.position.addScaledVector(ballVel,dt);
  ballVel.multiplyScalar(Math.exp(-.38*dt));
  if(ball.position.y<BALL_R){ball.position.y=BALL_R;if(ballVel.y<0)ballVel.y*=-.58;ballVel.x*=.985;ballVel.z*=.985;}
  if(ball.position.z>FIELD_Z-BALL_R){ball.position.z=FIELD_Z-BALL_R;ballVel.z=-Math.abs(ballVel.z)*.72;}
  if(ball.position.z< -FIELD_Z+BALL_R){ball.position.z=-FIELD_Z+BALL_R;ballVel.z=Math.abs(ballVel.z)*.72;}
  // End boards bounce everywhere except the central goal mouth.
  const inMouth=Math.abs(ball.position.z)<7&&ball.position.y<7;
  if(ball.position.x>FIELD_X-BALL_R&&!inMouth){ball.position.x=FIELD_X-BALL_R;ballVel.x=-Math.abs(ballVel.x)*.72;}
  if(ball.position.x< -FIELD_X+BALL_R&&!inMouth){ball.position.x=-FIELD_X+BALL_R;ballVel.x=Math.abs(ballVel.x)*.72;}
  ball.rotation.x+=ballVel.z*dt*.55;ball.rotation.z-=ballVel.x*dt*.55;
  if(ball.position.x>48&&inMouth){scoreGoal('BLUE');}
  if(ball.position.x< -48&&inMouth){scoreGoal('ORANGE');}
}
function scoreGoal(team){
  if(goalPause>0)return;
  if(team==='BLUE')blueScore++;else orangeScore++;
  ui.blueScore.textContent=blueScore;ui.orangeScore.textContent=orangeScore;
  ui.messageTitle.innerHTML=team==='BLUE'?'BLUE<br><span>GOAL!</span>':'ORANGE<br><span>GOAL!</span>';
  ui.messageSub.textContent='What a shot! Get ready for kickoff.';ui.playBtn.textContent='CONTINUE';ui.message.classList.remove('hidden');
  goalPause=2.2;running=false;goalSound();
}
function updateCamera(dt){
  const target=new THREE.Vector3();let desired=new THREE.Vector3();
  if(cameraMode===0){
    const back=forwardOf(player.yaw).multiplyScalar(-1);
    desired.copy(player.root.position).add(new THREE.Vector3(0,6.4,0)).addScaledVector(back,11.5);
    target.copy(player.root.position).add(new THREE.Vector3(0,1.1,0)).addScaledVector(forwardOf(player.yaw),5);
  }else if(cameraMode===1){
    desired.set(0,56,0.1);target.set(0,0,0);
  }else{
    desired.set(-65,40,65);target.set(0,0,0);
  }
  camera.position.lerp(desired,1-Math.exp(-4.5*dt));camera.lookAt(target);
}
function updateHUD(){ui.boostFill.style.width=`${player.boost}%`;ui.boostValue.textContent=Math.round(player.boost);ui.timer.textContent=`${Math.floor(timeLeft/60)}:${String(Math.ceil(timeLeft%60)).padStart(2,'0')}`;}
function showMenu(title,sub,button='PLAY'){ui.messageTitle.innerHTML=title;ui.messageSub.textContent=sub;ui.playBtn.textContent=button;ui.message.classList.remove('hidden');}
function startMatch(){initAudio();if(audio?.state==='suspended')audio.resume();if(finished){blueScore=0;orangeScore=0;timeLeft=MATCH_SECONDS;ui.blueScore.textContent='0';ui.orangeScore.textContent='0';finished=false;resetPositions();}running=true;paused=false;ui.message.classList.add('hidden');}
function endMatch(){running=false;finished=true;const winner=blueScore===orangeScore?'DRAW':blueScore>orangeScore?'BLUE WINS':'ORANGE WINS';showMenu(winner,`Final score: ${blueScore} - ${orangeScore}`,'PLAY AGAIN');tone(520,.25,'sine',.14,160);}
function resetGame(){resetPositions();if(!finished){running=true;paused=false;ui.message.classList.add('hidden');}}

ui.playBtn.addEventListener('click',()=>{if(goalPause>0){goalPause=0;resetPositions();startMatch();}else startMatch();});
ui.soundBtn.addEventListener('click',()=>{soundEnabled=!soundEnabled;ui.soundBtn.textContent=soundEnabled?'♫ SOUND ON':'♫ SOUND OFF';ui.soundBtn.setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled){initAudio();tone(600,.08,'sine',.08);}else if(audio){engineGain.gain.setTargetAtTime(0,audio.currentTime,.03);boostGain.gain.setTargetAtTime(0,audio.currentTime,.03);}});
window.addEventListener('keydown',(e)=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.repeat)return;if(e.code==='KeyC')cameraMode=(cameraMode+1)%3;if(e.code==='KeyR')resetGame();if(e.code==='Escape'&&running){paused=true;running=false;showMenu('GAME<br><span>PAUSED</span>','Take a breather. Your match is waiting.','RESUME');}else if(e.code==='Escape'&&paused){startMatch();}});
window.addEventListener('keyup',(e)=>{keys[e.code]=false;});
window.addEventListener('blur',()=>{for(const k of Object.keys(keys))keys[k]=false;});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));});

// Intro camera and game loop
camera.position.set(-25,25,36);camera.lookAt(0,0,0);
function animate(){
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.033);
  if(goalPause>0){goalPause-=dt;if(goalPause<=0){resetPositions();} }
  if(running&&!paused&&!finished){
    if(kickoff>0){kickoff-=dt;}
    else{
      timeLeft=Math.max(0,timeLeft-dt);if(timeLeft<=0){endMatch();}
      const pc=updateCar(player,dt,playerControls());const ac=updateAI(dt);
      collideCarBall(player,true);collideCarBall(rival,false);updateBall(dt);
      updateAudio(pc.speed,pc.boosting);
    }
  }else updateAudio(0,false);
  updateCamera(dt);updateHUD();renderer.render(scene,camera);
}
showMenu('ROCKET<br><span>SOCCER</span>','Drive fast. Hit hard. Score goals.','KICK OFF');
animate();
