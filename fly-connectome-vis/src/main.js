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
// 3. ANIMATION & BEHAVIOR LOOP
// ==========================================
const clock = new THREE.Clock();
const velocity = new THREE.Vector3(0, 0, 1);
const speed = 80; 
let timeSinceEating = 100;

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const time = clock.getElapsedTime();
  timeSinceEating += dt;

  // --- SENSORY (Vision/Smell) & FREE LOCOMOTION ---
  // The fly is no longer forced to seek or eat. It wanders freely (no interference).
  
  // 1. Free, natural wandering flight
  velocity.x += Math.sin(time * 1.5) * dt * 2.0;
  velocity.y += Math.cos(time * 1.1) * dt * 1.0;
  velocity.z += Math.cos(time * 1.3) * dt * 2.0;
  
  // Gentle boundary steering so it doesn't fly infinitely into the void
  if (agentFly.position.length() > 800) {
    const centerDir = new THREE.Vector3(0, 50, 0).sub(agentFly.position).normalize();
    velocity.lerp(centerDir, dt * 1.0);
  }
  
  velocity.normalize();
  agentFly.position.addScaledVector(velocity, speed * dt);
  if (agentFly.position.y < 5) agentFly.position.y = 5; // ground collision
  
  const lookTarget = agentFly.position.clone().add(velocity);
  agentFly.lookAt(lookTarget);

  // 2. Passive Sensory Input (Brain fires naturally based on what it sees/smells)
  let closestDist = Infinity;
  fruits.forEach(fruit => {
    const dist = agentFly.position.distanceTo(fruit.position);
    if (dist < closestDist) closestDist = dist;
  });

  // If a fruit is within 150 units, the fly's visual/olfactory neurons fire passively.
  if (closestDist < 150) {
    // The closer the fruit, the more intense the sensory spike
    const intensity = 1.0 - (closestDist / 150.0);
    
    // Probability of a localized neural spike increases as it gets closer
    if (Math.random() < (intensity * 0.2)) {
      if (brainScene.userData.brainGeo) {
        const colors = brainScene.userData.brainGeo.attributes.color.array;
        const numN = brainScene.userData.numNeurons;
        // 500 to 2000 neurons fire depending on intensity
        const spikeCount = Math.floor(500 + (1500 * intensity));
        for (let k = 0; k < spikeCount; k++) {
          const idx = Math.floor(Math.random() * numN);
          activeNeurons.add(idx);
          colors[idx * 3 + 0] = 1.0; // R
          colors[idx * 3 + 1] = 0.0; // G
          colors[idx * 3 + 2] = 0.0; // B
        }
        brainScene.userData.brainGeo.attributes.color.needsUpdate = true;
      }
    }
  }

  // --- KINEMATICS ---
  const flap = Math.sin(time * 60) * 0.6;
  agentFly.userData.leftWing.rotation.z = flap;
  agentFly.userData.rightWing.rotation.z = -flap;
  
  agentFly.userData.headGroup.rotation.y = Math.sin(time * 3) * 0.3;
  agentFly.userData.headGroup.rotation.z = Math.cos(time * 2.5) * 0.2;
  
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

  // --- OPTIMIZED BRAIN VISUALIZATION DECAY ---
  // Only iterate through the specific neurons that are currently red to fade them back to white
  if (activeNeurons.size > 0 && brainScene.userData.brainGeo) {
    const colors = brainScene.userData.brainGeo.attributes.color.array;
    let needsColorUpdate = false;
    
    for (let idx of activeNeurons) {
      let g = colors[idx * 3 + 1];
      if (g < 1.0) {
        g += dt * 0.8; // Fading speed
        if (g > 1.0) g = 1.0;
        
        // As G and B approach 1.0, the red fades back into pure white
        colors[idx * 3 + 1] = g;
        colors[idx * 3 + 2] = g;
        needsColorUpdate = true;
      } else {
        // This neuron has successfully returned to pure white, remove from update list to save CPU
        activeNeurons.delete(idx);
      }
    }
    
    if (needsColorUpdate) {
      brainScene.userData.brainGeo.attributes.color.needsUpdate = true;
    }
  }

  brainRenderer.render(brainScene, brainCamera);
}

animate();

window.addEventListener('resize', () => {
  worldCamera.aspect = window.innerWidth / window.innerHeight;
  worldCamera.updateProjectionMatrix();
  worldRenderer.setSize(window.innerWidth, window.innerHeight);
});
