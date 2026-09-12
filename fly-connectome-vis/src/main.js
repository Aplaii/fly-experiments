import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Setup basic UI
document.querySelector('#app').innerHTML = `
  <div id="world-container"></div>
  <div id="brain-container"></div>
  <div id="ui-layer">
    <h1>Fly Ecosystem & Connectome</h1>
    <p>3D Fly Simulation + Volumetric Brain Scan</p>
    <div id="stats">Initializing...</div>
  </div>
`;

// ==========================================
// 0. HELPER FUNCTIONS (Models & Textures)
// ==========================================

// Create a realistic-looking fly using Three.js primitives
function createFly() {
  const fly = new THREE.Group();
  
  // Materials
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.8 }); // Dark brown
  const headMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }); // Blackish
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x7a0000, roughness: 0.3, metalness: 0.2 }); // Deep red compound eye
  
  // Wings: Translucent and slightly glossy
  const wingMat = new THREE.MeshPhysicalMaterial({ 
    color: 0xeeeeee, 
    transparent: true, 
    opacity: 0.4, 
    roughness: 0.1, 
    metalness: 0.1,
    transmission: 0.9,
    side: THREE.DoubleSide
  });

  // Thorax
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 16), bodyMat);
  thorax.scale.set(1, 0.8, 1.2);
  fly.add(thorax);

  // Abdomen
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(3.5, 16, 16), bodyMat);
  abdomen.scale.set(0.9, 0.7, 1.6);
  abdomen.position.set(0, -1, -6);
  // Tilt abdomen slightly down
  abdomen.rotation.x = -0.1;
  fly.add(abdomen);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), headMat);
  head.scale.set(1.2, 1, 0.9);
  head.position.set(0, 0, 4);
  fly.add(head);

  // Eyes
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), eyeMat);
  leftEye.position.set(1.8, 0.5, 4.2);
  leftEye.scale.set(0.8, 1.2, 1);
  fly.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), eyeMat);
  rightEye.position.set(-1.8, 0.5, 4.2);
  rightEye.scale.set(0.8, 1.2, 1);
  fly.add(rightEye);

  // Wings
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
  
  // Store wings for animation
  fly.userData.leftWing = leftWing;
  fly.userData.rightWing = rightWing;

  // Scale down the whole fly a bit
  fly.scale.set(2, 2, 2);
  return fly;
}

// Create a soft glowing dot texture for volumetric brain scanning
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
// 1. WORLD SETUP (Main Background)
// ==========================================
const worldContainer = document.getElementById('world-container');
const worldScene = new THREE.Scene();
worldScene.fog = new THREE.FogExp2(0x0a1e3f, 0.002);

const worldCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
worldCamera.position.set(0, 200, 600);

const worldRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
worldRenderer.setSize(window.innerWidth, window.innerHeight);
worldRenderer.setPixelRatio(window.devicePixelRatio);
worldRenderer.setClearColor(worldScene.fog.color);
worldContainer.appendChild(worldRenderer.domElement);

const worldControls = new OrbitControls(worldCamera, worldRenderer.domElement);
worldControls.enableDamping = true;
worldControls.dampingFactor = 0.05;

// World Environment
worldScene.add(new THREE.AmbientLight(0x888888));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(200, 500, 300);
worldScene.add(dirLight);

const gridHelper = new THREE.GridHelper(4000, 100, 0x00ffaa, 0x002233);
gridHelper.position.y = -100;
worldScene.add(gridHelper);

// Spores
const envGeo = new THREE.BufferGeometry();
const envCount = 2000;
const envPositions = new Float32Array(envCount * 3);
for (let i = 0; i < envCount * 3; i++) {
  envPositions[i] = (Math.random() - 0.5) * 4000;
}
envGeo.setAttribute('position', new THREE.BufferAttribute(envPositions, 3));
const envMat = new THREE.PointsMaterial({ color: 0x88ccff, size: 2, transparent: true, opacity: 0.4 });
const envPoints = new THREE.Points(envGeo, envMat);
worldScene.add(envPoints);

// Simulated Real Flies in the World
const fliesGroup = new THREE.Group();
for(let i=0; i<30; i++) {
  const fly = createFly();
  fly.position.set((Math.random() - 0.5) * 800, (Math.random()) * 300, (Math.random() - 0.5) * 800);
  fly.userData.speed = Math.random() * 2 + 1;
  fly.userData.offset = Math.random() * Math.PI * 2;
  // Face the direction of travel roughly
  fly.lookAt(fly.position.x + 10, fly.position.y, fly.position.z + 10);
  fliesGroup.add(fly);
}
worldScene.add(fliesGroup);


// ==========================================
// 2. REALISTIC BRAIN PREVIEW SETUP (Top Left)
// ==========================================
const brainContainer = document.getElementById('brain-container');
const brainScene = new THREE.Scene();

const bWidth = 350;
const bHeight = 350;
// We switch back to Perspective Camera for a true volumetric 3D feel
const brainCamera = new THREE.PerspectiveCamera(45, bWidth / bHeight, 0.1, 5000);
brainCamera.position.set(0, 200, 1200);

const brainRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
brainRenderer.setSize(bWidth, bHeight);
brainRenderer.setPixelRatio(window.devicePixelRatio);
brainContainer.appendChild(brainRenderer.domElement);

const brainControls = new OrbitControls(brainCamera, brainRenderer.domElement);
brainControls.enableDamping = true;
brainControls.dampingFactor = 0.05;

// Load the 141k Neuron PointCloud into the Brain Scene
fetch('full_brain.json')
  .then(res => res.json())
  .then(nodes => {
    document.getElementById('stats').innerText = `Loaded ${nodes.length.toLocaleString()} neurons in scan.`;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);

    nodes.forEach((node, i) => {
      const idx = i * 3;
      positions[idx] = node.x;
      positions[idx + 1] = -node.y; // Invert Y
      positions[idx + 2] = node.z;

      const color = new THREE.Color();
      // To make it look like a real fluorescence microscopy volume scan:
      // We will base the color on depth and region, giving it a translucent gelatinous look
      const depthHue = (node.z + 500) / 1000; 
      
      // We can mix in the node type for slight tinting
      let hash = 0;
      const typeStr = node.type || "Unknown";
      for (let j = 0; j < typeStr.length; j++) {
        hash = typeStr.charCodeAt(j) + ((hash << 5) - hash);
      }
      
      // Realistic palette: Mostly glowing cyan/blue (DAPI), with some regions highlighted pink/red
      const baseHue = 0.55 + (hash % 100) / 1000.0; // Blues and purples
      color.setHSL(baseHue, 0.7, 0.4);
      
      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 6, // Slightly larger to overlap
      map: createGlowTexture(),
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false, // Prevents z-fighting so it looks like a continuous cloud
      transparent: true,
      opacity: 0.15 // Very low opacity to build up a volumetric density
    });

    const brainPoints = new THREE.Points(geometry, material);
    brainScene.add(brainPoints);
    
    // Add a slight slow rotation to the brain to show off its 3D volume
    brainScene.userData.brainMesh = brainPoints;
  });


// ==========================================
// 3. ANIMATION LOOP
// ==========================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  // Animate world (floating particles)
  envPoints.rotation.y = time * 0.02;
  
  // Animate the flies
  fliesGroup.children.forEach(fly => {
    // Forward movement
    fly.position.z -= fly.userData.speed * 2;
    fly.position.y += Math.sin(time * fly.userData.speed + fly.userData.offset) * 0.5;
    
    // Wrap around the world so they don't fly off forever
    if (fly.position.z < -1000) {
      fly.position.z = 1000;
      fly.position.x = (Math.random() - 0.5) * 800;
    }
    
    // Flap wings rapidly (blur effect)
    const flap = Math.sin(time * 50) * 0.5; // High frequency
    fly.userData.leftWing.rotation.z = flap;
    fly.userData.rightWing.rotation.z = -flap;
  });

  worldControls.update();
  worldRenderer.render(worldScene, worldCamera);

  // Slowly rotate the brain to show the volume (optional, looks very cool for a scan)
  if (brainScene.userData.brainMesh) {
    brainScene.userData.brainMesh.rotation.y = time * 0.1;
  }

  brainControls.update();
  brainRenderer.render(brainScene, brainCamera);
}

animate();

window.addEventListener('resize', () => {
  // Update World
  worldCamera.aspect = window.innerWidth / window.innerHeight;
  worldCamera.updateProjectionMatrix();
  worldRenderer.setSize(window.innerWidth, window.innerHeight);
});
