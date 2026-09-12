import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Setup basic UI
document.querySelector('#app').innerHTML = `
  <div id="world-container"></div>
  <div id="brain-container"></div>
  <div id="ui-layer">
    <h1>Fly Brain Simulation</h1>
    <p>Living 3D World (Background) + 2D Connectome Blueprint (Top Left)</p>
    <div id="stats">Initializing...</div>
  </div>
`;

// ==========================================
// 1. WORLD SETUP (Main Background)
// ==========================================
const worldContainer = document.getElementById('world-container');
const worldScene = new THREE.Scene();
worldScene.fog = new THREE.FogExp2(0x0a1e3f, 0.0015);

const worldCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
worldCamera.position.set(0, 300, 800);

const worldRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
worldRenderer.setSize(window.innerWidth, window.innerHeight);
worldRenderer.setPixelRatio(window.devicePixelRatio);
worldRenderer.setClearColor(worldScene.fog.color);
worldContainer.appendChild(worldRenderer.domElement);

const worldControls = new OrbitControls(worldCamera, worldRenderer.domElement);
worldControls.enableDamping = true;
worldControls.dampingFactor = 0.05;

// World Environment
worldScene.add(new THREE.AmbientLight(0x404040));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(200, 500, 300);
worldScene.add(dirLight);

const gridHelper = new THREE.GridHelper(4000, 100, 0x00ffaa, 0x004433);
gridHelper.position.y = -200;
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

// Simulated Flies in the World
const fliesGroup = new THREE.Group();
for(let i=0; i<50; i++) {
  const flyMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(5, 10, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00ffaa, emissiveIntensity: 0.5 })
  );
  flyMesh.position.set((Math.random() - 0.5) * 1000, (Math.random()) * 400, (Math.random() - 0.5) * 1000);
  flyMesh.userData = { 
    speed: Math.random() * 2 + 1, 
    offset: Math.random() * Math.PI * 2 
  };
  fliesGroup.add(flyMesh);
}
worldScene.add(fliesGroup);


// ==========================================
// 2. BRAIN PREVIEW SETUP (Top Left)
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
    document.getElementById('stats').innerText = \`Loaded \${nodes.length.toLocaleString()} neurons in preview.\`;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);

    nodes.forEach((node, i) => {
      const idx = i * 3;
      positions[idx] = node.x;
      positions[idx + 1] = -node.y; // Invert Y
      positions[idx + 2] = node.z;

      // Procedural color based on neuron type
      const color = new THREE.Color();
      let hash = 0;
      const typeStr = node.type || "Unknown";
      for (let j = 0; j < typeStr.length; j++) {
        hash = typeStr.charCodeAt(j) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash % 360) / 360;
      color.setHSL(hue, 0.8, 0.6);
      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 4,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.8
    });

    const brainPoints = new THREE.Points(geometry, material);
    brainScene.add(brainPoints);
  });


// ==========================================
// 3. ANIMATION LOOP
// ==========================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  // Animate world
  envPoints.rotation.y = time * 0.02;
  
  fliesGroup.children.forEach(fly => {
    fly.position.y += Math.sin(time * fly.userData.speed + fly.userData.offset) * 1.5;
    fly.position.x += Math.cos(time * fly.userData.speed * 0.5) * 1;
    fly.rotation.y = time;
    fly.rotation.x = Math.sin(time);
  });

  worldControls.update();
  worldRenderer.render(worldScene, worldCamera);

  // Animate brain preview
  brainControls.update();
  brainRenderer.render(brainScene, brainCamera);
}

animate();

window.addEventListener('resize', () => {
  // Update World
  worldCamera.aspect = window.innerWidth / window.innerHeight;
  worldCamera.updateProjectionMatrix();
  worldRenderer.setSize(window.innerWidth, window.innerHeight);
  
  // Brain is fixed 350x350, no need to resize it on window resize
});
