import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Setup basic UI
document.querySelector('#app').innerHTML = `
  <div id="world-container"></div>
  <div id="brain-container"></div>
  <div id="ui-layer">
    <h1>Autonomous Fly Foraging Simulation</h1>
    <p>Sensory-Motor Loop: Vision, Smell, and Touch active.</p>
    <div id="stats">Initializing...</div>
  </div>
`;

// ==========================================
// 0. HELPER FUNCTIONS (Models & Textures)
// ==========================================

function createFly() {
  const fly = new THREE.Group();
  
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.8 }); 
  const headMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }); 
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x7a0000, roughness: 0.3, metalness: 0.2 }); 
  const legMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1.0 });
  
  const wingMat = new THREE.MeshPhysicalMaterial({ 
    color: 0xeeeeee, transparent: true, opacity: 0.4, 
    roughness: 0.1, metalness: 0.1, transmission: 0.9, side: THREE.DoubleSide
  });

  const thorax = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 16), bodyMat);
  thorax.scale.set(1, 0.8, 1.2);
  fly.add(thorax);

  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(3.5, 16, 16), bodyMat);
  abdomen.scale.set(0.9, 0.7, 1.6);
  abdomen.position.set(0, -1, -6);
  abdomen.rotation.x = -0.1;
  fly.add(abdomen);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.5, 4.2);
  
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), headMat);
  head.scale.set(1.2, 1, 0.9);
  headGroup.add(head);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), eyeMat);
  leftEye.position.set(1.8, 0.5, 0.5);
  leftEye.scale.set(0.8, 1.2, 1);
  headGroup.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), eyeMat);
  rightEye.position.set(-1.8, 0.5, 0.5);
  rightEye.scale.set(0.8, 1.2, 1);
  headGroup.add(rightEye);
  
  const antennaGeo = new THREE.CylinderGeometry(0.1, 0.2, 2);
  const leftAntenna = new THREE.Mesh(antennaGeo, headMat);
  leftAntenna.position.set(0.5, 0.5, 2.5);
  leftAntenna.rotation.x = Math.PI / 2.5;
  leftAntenna.rotation.z = -0.3;
  headGroup.add(leftAntenna);
  
  const rightAntenna = new THREE.Mesh(antennaGeo, headMat);
  rightAntenna.position.set(-0.5, 0.5, 2.5);
  rightAntenna.rotation.x = Math.PI / 2.5;
  rightAntenna.rotation.z = 0.3;
  headGroup.add(rightAntenna);

  fly.add(headGroup);

  const wingGeo = new THREE.PlaneGeometry(3, 10);
  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.position.set(1.5, 2.5, -2);
  leftWing.rotation.x = Math.PI / 2.2;
  leftWing.rotation.y = -0.3;
  fly.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.set(-1.5, 2.5, -2);
  rightWing.rotation.x = Math.PI / 2.2;
  rightWing.rotation.y = 0.3;
  fly.add(rightWing);
  
  const legs = [];
  function createLeg(x, y, z, rotY, isLeft) {
    const legGroup = new THREE.Group();
    legGroup.position.set(x, y, z);
    legGroup.rotation.y = rotY;
    legGroup.rotation.z = isLeft ? Math.PI / 4 : -Math.PI / 4;
    
    const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 4), legMat);
    femur.position.y = -2;
    legGroup.add(femur);
    
    const tibiaGroup = new THREE.Group();
    tibiaGroup.position.y = -4;
    tibiaGroup.rotation.z = isLeft ? -1.0 : 1.0; 
    legGroup.add(tibiaGroup);
    
    const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 5), legMat);
    tibia.position.y = -2.5;
    tibiaGroup.add(tibia);
    
    fly.add(legGroup);
    return { root: legGroup, knee: tibiaGroup, isLeft };
  }
  
  legs.push(createLeg(1.5, -1, 2.5, 0.5, true)); 
  legs.push(createLeg(-1.5, -1, 2.5, -0.5, false)); 
  legs.push(createLeg(2.0, -1, 0, 0, true)); 
  legs.push(createLeg(-2.0, -1, 0, 0, false)); 
  legs.push(createLeg(1.5, -1, -3, -0.5, true)); 
  legs.push(createLeg(-1.5, -1, -3, 0.5, false)); 

  fly.userData = { leftWing, rightWing, headGroup, legs };
  fly.scale.set(2, 2, 2);
  return fly;
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 16, 16);
  return new THREE.CanvasTexture(canvas);
}

// ==========================================
// 1. WORLD SETUP (Sunny Field)
// ==========================================
const worldContainer = document.getElementById('world-container');
const worldScene = new THREE.Scene();
worldScene.background = new THREE.Color(0x87CEEB); 
worldScene.fog = new THREE.Fog(0x87CEEB, 200, 2000);

const worldCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
worldCamera.position.set(0, 150, 400);

const worldRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
worldRenderer.setSize(window.innerWidth, window.innerHeight);
worldRenderer.setPixelRatio(window.devicePixelRatio);
worldContainer.appendChild(worldRenderer.domElement);

const worldControls = new OrbitControls(worldCamera, worldRenderer.domElement);
worldControls.enableDamping = true;
worldControls.dampingFactor = 0.05;
worldControls.maxPolarAngle = Math.PI / 2 - 0.05;

// Lighting
worldScene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
sunLight.position.set(500, 1000, 500);
worldScene.add(sunLight);

// Grass Field
const groundGeo = new THREE.PlaneGeometry(4000, 4000);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 1.0, metalness: 0.0 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
worldScene.add(ground);

// Flora
const floraGroup = new THREE.Group();
const fruits = [];

function spawnFruit(x, z) {
  const fruitGeo = new THREE.SphereGeometry(6, 16, 16);
  const fruitMat = new THREE.MeshStandardMaterial({ color: 0xff3300, roughness: 0.4 });
  const fruit = new THREE.Mesh(fruitGeo, fruitMat);
  fruit.position.set(x, 6, z);
  floraGroup.add(fruit);
  fruits.push(fruit);
}

function spawnFlower(x, z) {
  const flower = new THREE.Group();
  
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 40), new THREE.MeshStandardMaterial({ color: 0x2E7D32 }));
  stem.position.y = 20;
  flower.add(stem);
  
  const petalColor = Math.random() > 0.5 ? 0xFF69B4 : 0xFFD700;
  const center = new THREE.Mesh(new THREE.SphereGeometry(4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  center.position.y = 40;
  flower.add(center);
  
  for(let p=0; p<5; p++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(5), new THREE.MeshStandardMaterial({ color: petalColor }));
    const angle = (p / 5) * Math.PI * 2;
    petal.position.set(Math.cos(angle)*6, 40, Math.sin(angle)*6);
    petal.scale.set(1, 0.2, 1);
    flower.add(petal);
  }
  
  flower.position.set(x, 0, z);
  floraGroup.add(flower);
}

for(let i=0; i<100; i++) spawnFlower((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000);
for(let i=0; i<30; i++) spawnFruit((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000);
worldScene.add(floraGroup);

// Add the single Agent Fly
const agentFly = createFly();
agentFly.position.set(0, 50, 0);
worldScene.add(agentFly);


// ==========================================
// 2. STATIC FLAT BRAIN PREVIEW SETUP (Top Left)
// ==========================================
const brainContainer = document.getElementById('brain-container');
const brainScene = new THREE.Scene();

const bWidth = 350;
const bHeight = 350;
const aspect = bWidth / bHeight;
const frustumSize = 1000;

const brainCamera = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  frustumSize / -2,
  0.1,
  5000
);
brainCamera.position.set(0, 0, 1500);

const brainRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
brainRenderer.setSize(bWidth, bHeight);
brainRenderer.setPixelRatio(window.devicePixelRatio);
brainContainer.appendChild(brainRenderer.domElement);

let activeNeurons = new Set();

fetch('full_brain.json')
  .then(res => res.json())
  .then(nodes => {
    document.getElementById('stats').innerText = `Sensory-Motor loop active. Monitoring ${nodes.length.toLocaleString()} neurons.`;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);

    // Initialize all to white (low alpha is handled by the material)
    colors.fill(1.0);

    nodes.forEach((node, i) => {
      const idx = i * 3;
      positions[idx] = node.x;
      positions[idx + 1] = -node.y;
      positions[idx + 2] = node.z;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);

    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y);
    brainCamera.left = (maxDim / -2) * 1.05;
    brainCamera.right = (maxDim / 2) * 1.05;
    brainCamera.top = (maxDim / 2) * 1.05;
    brainCamera.bottom = (maxDim / -2) * 1.05;
    brainCamera.updateProjectionMatrix();

    const brainMaterial = new THREE.PointsMaterial({
      vertexColors: true, // Optimised: We color per-vertex rather than the whole material
      size: 3, // slightly smaller points for clarity
      map: createGlowTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.15 // Default to low alpha as requested
    });

    const brainPoints = new THREE.Points(geometry, brainMaterial);
    brainScene.add(brainPoints);
    
    brainScene.userData.brainGeo = geometry;
    brainScene.userData.numNeurons = nodes.length;
  });


// ==========================================
// 3. ANIMATION, BEHAVIOR & CONSCIENCE UPLOAD
// ==========================================
const clock = new THREE.Clock();

// Connect to the Python Biological Conscience
const ws = new WebSocket('ws://localhost:8765');
let biologicalState = {
  kinematics: { dx: 0, dy: 0, dz: 0, yaw: 0 },
  spikes: [],
  hormones: { serotonin: 0.5, octopamine: 0.0, dopamine: 0.0 }
};

ws.onopen = () => {
  document.getElementById('stats').innerText = `Brain Uploaded. Biological Conscience Online.`;
};

ws.onmessage = (event) => {
  biologicalState = JSON.parse(event.data);
  
  // Directly map biological neural spikes to visual vertices
  if (brainScene.userData.brainGeo) {
    const colors = brainScene.userData.brainGeo.attributes.color.array;
    
    // First, gradually decay all neurons back to white
    for (let i = 0; i < colors.length; i += 3) {
      if (colors[i+1] < 1.0) {
        colors[i+1] += 0.05;
        colors[i+2] += 0.05;
      }
    }
    
    // Then set the spiking neurons to bright red/orange based on octopamine (arousal)
    const r = 1.0;
    const g = 1.0 - biologicalState.hormones.octopamine; // high octopamine = red, low = orange/yellow
    const b = biologicalState.hormones.dopamine; // dopamine adds blue/purple tint
    
    biologicalState.spikes.forEach(idx => {
      colors[idx * 3 + 0] = r;
      colors[idx * 3 + 1] = g;
      colors[idx * 3 + 2] = b;
    });
    
    brainScene.userData.brainGeo.attributes.color.needsUpdate = true;
  }
};

let timeSinceEating = 100;
const sugars = [];

// Helper to spawn sugar cubes
function spawnSugar(x, z) {
  const geo = new THREE.BoxGeometry(4, 4, 4);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 2, z);
  mesh.castShadow = true;
  floraGroup.add(mesh);
  sugars.push(mesh);
}
// Initial sugar spawn
for(let i=0; i<20; i++) spawnSugar((Math.random() - 0.5) * 4000, (Math.random() - 0.5) * 4000);


function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const time = clock.getElapsedTime();
  timeSinceEating += dt;

  // --- ENVIRONMENT SENSING ---
  let closestDist = Infinity;
  let closestItem = null;
  let closestIndex = -1;
  let itemType = null;
  
  fruits.forEach((fruit, idx) => {
    const dist = agentFly.position.distanceTo(fruit.position);
    if (dist < closestDist) {
      closestDist = dist;
      closestItem = fruit;
      closestIndex = idx;
      itemType = 'fruit';
    }
  });
  
  sugars.forEach((sugar, idx) => {
    const dist = agentFly.position.distanceTo(sugar.position);
    if (dist < closestDist) {
      closestDist = dist;
      closestItem = sugar;
      closestIndex = idx;
      itemType = 'sugar';
    }
  });

  let eatingType = null;
  if (closestDist < 15) {
    floraGroup.remove(closestItem);
    eatingType = itemType;
    timeSinceEating = 0;
    if (itemType === 'fruit') {
        fruits.splice(closestIndex, 1);
        spawnFruit((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000);
    } else {
        sugars.splice(closestIndex, 1);
        spawnSugar((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000);
    }
  }

  // SEND ENVIRONMENT STATE TO BRAIN
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ closestDist, eating: eatingType }));
  }

  // --- KINEMATICS (DRIVEN BY TRUE BIOLOGICAL MOTOR NEURONS) ---
  const motor = biologicalState.kinematics;
  const speedScale = 0.5;
  agentFly.position.x += motor.dx * speedScale;
  agentFly.position.y += motor.dy * speedScale;
  agentFly.position.z += motor.dz * speedScale;
  
  // The fly is naturally flying forward 
  const forwardVel = new THREE.Vector3(0, 0, 1).applyEuler(agentFly.rotation).multiplyScalar(40 * dt);
  agentFly.position.add(forwardVel);

  if (agentFly.position.y < 5) agentFly.position.y = 5; 
  if (agentFly.position.length() > 2000) agentFly.position.set(0,50,0); // boundary loop
  
  // Update UI Stats with Hormones
  if (ws.readyState === WebSocket.OPEN) {
      const s = Math.round(biologicalState.hormones.serotonin * 100);
      const o = Math.round(biologicalState.hormones.octopamine * 100);
      const d = Math.round(biologicalState.hormones.dopamine * 100);
      document.getElementById('stats').innerText = `BIOLOGICAL UPLOAD | Serotonin (Satiety): ${s}% | Octopamine (Arousal): ${o}% | Dopamine (Reward): ${d}%`;
  }

  // Flapping wings
  const flap = Math.sin(time * 60) * 0.6;
  agentFly.userData.leftWing.rotation.z = flap;
  agentFly.userData.rightWing.rotation.z = -flap;
  
  // Head and leg animation
  agentFly.userData.headGroup.rotation.y = motor.yaw * 0.1;
  
  agentFly.userData.legs.forEach((leg, idx) => {
    let sway = Math.sin(time * 10 + idx) * 0.1;
    let kneeBend = leg.isLeft ? -1.0 : 1.0;
    
    if (timeSinceEating < 1.5 && idx < 2) {
      const rubSpeed = time * 30;
      sway += Math.sin(rubSpeed) * 0.4;
      kneeBend += Math.cos(rubSpeed) * 0.5;
      leg.root.rotation.x = -1.0;
    } else {
      leg.root.rotation.x = 0.5; 
    }
    leg.root.rotation.z = (leg.isLeft ? (Math.PI / 4) : (-Math.PI / 4)) + sway;
    leg.knee.rotation.z = kneeBend + (sway * 0.5);
  });
  
  worldControls.update();
  worldRenderer.render(worldScene, worldCamera);
  brainRenderer.render(brainScene, brainCamera);
}

animate();

window.addEventListener('resize', () => {
  worldCamera.aspect = window.innerWidth / window.innerHeight;
  worldCamera.updateProjectionMatrix();
  worldRenderer.setSize(window.innerWidth, window.innerHeight);
});
