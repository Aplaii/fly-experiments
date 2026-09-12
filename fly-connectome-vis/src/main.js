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

  const head = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), headMat);
  head.scale.set(1.2, 1, 0.9);
  head.position.set(0, 0, 4);
  fly.add(head);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), eyeMat);
  leftEye.position.set(1.8, 0.5, 4.2);
  leftEye.scale.set(0.8, 1.2, 1);
  fly.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), eyeMat);
  rightEye.position.set(-1.8, 0.5, 4.2);
  rightEye.scale.set(0.8, 1.2, 1);
  fly.add(rightEye);

  const wingGeo = new THREE.PlaneGeometry(3, 10);
  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.position.set(2, 2.5, -2);
  leftWing.rotation.x = Math.PI / 2.2;
  leftWing.rotation.y = -0.5;
  fly.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.set(-2, 2.5, -2);
  rightWing.rotation.x = Math.PI / 2.2;
  rightWing.rotation.y = 0.5;
  fly.add(rightWing);
  
  fly.userData.leftWing = leftWing;
  fly.userData.rightWing = rightWing;
  fly.scale.set(2, 2, 2);
  return fly;
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

// ==========================================
// 1. WORLD SETUP (Sunny Field)
// ==========================================
const worldContainer = document.getElementById('world-container');
const worldScene = new THREE.Scene();
worldScene.background = new THREE.Color(0x87CEEB); // Sky blue
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
worldControls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground

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

// Generate Flowers and Fruits
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
  
  const petalColor = Math.random() > 0.5 ? 0xFF69B4 : 0xFFD700; // Pink or Yellow
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

// Scatter Flora
for(let i=0; i<100; i++) {
  spawnFlower((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000);
}
for(let i=0; i<30; i++) {
  spawnFruit((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000);
}
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

// Orthographic Camera to force it into completely flat 2D
const brainCamera = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  frustumSize / -2,
  0.1,
  5000
);
brainCamera.position.set(0, 0, 1500);

const brainRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
brainRenderer.setSize(bWidth, bHeight);
brainRenderer.setPixelRatio(window.devicePixelRatio);
brainContainer.appendChild(brainRenderer.domElement);

// NO OrbitControls for the brain - locked in static position!
// We only keep the material reference to flash it red
let brainMaterial; 

fetch('full_brain.json')
  .then(res => res.json())
  .then(nodes => {
    document.getElementById('stats').innerText = `Sensory-Motor loop active. Monitoring ${nodes.length.toLocaleString()} neurons.`;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(nodes.length * 3);

    nodes.forEach((node, i) => {
      const idx = i * 3;
      positions[idx] = node.x;
      positions[idx + 1] = -node.y; // Invert Y
      positions[idx + 2] = node.z;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Automatically center the brain geometry
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);

    // Automatically scale the camera frustum to fit the whole brain perfectly (with 5% padding)
    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y);
    brainCamera.left = (maxDim / -2) * 1.05;
    brainCamera.right = (maxDim / 2) * 1.05;
    brainCamera.top = (maxDim / 2) * 1.05;
    brainCamera.bottom = (maxDim / -2) * 1.05;
    brainCamera.updateProjectionMatrix();

    // Solid red color for all neurons/synapses
    brainMaterial = new THREE.PointsMaterial({
      color: 0xff0000,
      size: 4,
      map: createGlowTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.15
    });

    const brainPoints = new THREE.Points(geometry, brainMaterial);
    brainScene.add(brainPoints);
  });


// ==========================================
// 3. ANIMATION & BEHAVIOR LOOP
// ==========================================
const clock = new THREE.Clock();

const velocity = new THREE.Vector3(0, 0, 1);
const speed = 80; 
let sensorySpike = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const time = clock.getElapsedTime();

  // --- SENSORY-MOTOR LOOP (Vision/Smell & Locomotion) ---
  if (fruits.length > 0) {
    let closestDist = Infinity;
    let closestFruit = null;
    let closestIndex = -1;
    
    fruits.forEach((fruit, idx) => {
      const dist = agentFly.position.distanceTo(fruit.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestFruit = fruit;
        closestIndex = idx;
      }
    });

    // Touch/Taste: Eat the fruit if very close
    if (closestDist < 15) {
      floraGroup.remove(closestFruit);
      fruits.splice(closestIndex, 1);
      sensorySpike = 1.0; 
      
      spawnFruit((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000);
    } else {
      // Locomotion: Steer towards the smell/vision source
      const targetPos = closestFruit.position.clone();
      targetPos.x += Math.sin(time * 5) * 50;
      targetPos.y += Math.cos(time * 4) * 30;
      
      const desiredDir = targetPos.sub(agentFly.position).normalize();
      velocity.lerp(desiredDir, dt * 2.0).normalize();
      
      agentFly.position.addScaledVector(velocity, speed * dt);
      
      if (agentFly.position.y < 5) agentFly.position.y = 5;
      
      const lookTarget = agentFly.position.clone().add(velocity);
      agentFly.lookAt(lookTarget);
    }
  }

  // Flap wings
  const flap = Math.sin(time * 60) * 0.6;
  agentFly.userData.leftWing.rotation.z = flap;
  agentFly.userData.rightWing.rotation.z = -flap;
  
  worldControls.update();
  worldRenderer.render(worldScene, worldCamera);

  // --- BRAIN VISUALIZATION UPDATE ---
  // Brain is totally static now, no rotation.
  // We just handle the sensory flash (pulsing brighter red)
  if (brainMaterial) {
    if (sensorySpike > 0) {
      // Flash bright white/yellow when eating, fading back to pure red
      brainMaterial.color.setRGB(1, sensorySpike, sensorySpike); 
      brainMaterial.opacity = 0.15 + (sensorySpike * 0.5);
      sensorySpike -= dt * 2.0;
    } else {
      brainMaterial.color.setHex(0xff0000);
      brainMaterial.opacity = 0.15;
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
