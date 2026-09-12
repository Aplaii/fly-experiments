import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Setup basic UI
document.querySelector('#app').innerHTML = `
  <div id="ui-layer">
    <h1>Living Fly Brain Simulation</h1>
    <p>141,781 Neurons Rendering in Real-Time</p>
    <div id="stats">Initializing world...</div>
  </div>
`;

// 1. Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1e3f, 0.0015); // Deep blue misty world

const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 1000;
const camera = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  frustumSize / -2,
  0.1,
  5000
);
camera.position.set(0, 0, 1500);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(scene.fog.color);
document.getElementById('app').appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// 2. Create the World (Grid, Lights, Environment)
const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(200, 500, 300);
scene.add(dirLight);

// A digital grid floor for the "world"
const gridHelper = new THREE.GridHelper(4000, 100, 0x00ffaa, 0x004433);
gridHelper.position.y = -600;
scene.add(gridHelper);

// Floating dust/spores in the environment
const envGeo = new THREE.BufferGeometry();
const envCount = 5000;
const envPositions = new Float32Array(envCount * 3);
for (let i = 0; i < envCount * 3; i++) {
  envPositions[i] = (Math.random() - 0.5) * 4000;
}
envGeo.setAttribute('position', new THREE.BufferAttribute(envPositions, 3));
const envMat = new THREE.PointsMaterial({ color: 0x88ccff, size: 2, transparent: true, opacity: 0.4 });
const envPoints = new THREE.Points(envGeo, envMat);
scene.add(envPoints);

// 3. Load the 141k Neuron PointCloud
let brainPoints;
let originalPositions; // Store original positions for pulsing animation
let colors;

fetch('full_brain.json')
  .then(res => res.json())
  .then(nodes => {
    document.getElementById('stats').innerText = `Rendering ${nodes.length.toLocaleString()} Neurons`;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(nodes.length * 3);
    colors = new Float32Array(nodes.length * 3);
    
    // We will store original coords to animate them
    originalPositions = new Float32Array(nodes.length * 3);

    nodes.forEach((node, i) => {
      // Swapping Y and Z so the brain stands up correctly, depending on standard orientation
      // Neuprint is often X, Y, Z where Z is depth. We'll use x, -y, z
      const idx = i * 3;
      positions[idx] = node.x;
      positions[idx + 1] = -node.y; // Invert Y
      positions[idx + 2] = node.z;

      originalPositions[idx] = positions[idx];
      originalPositions[idx + 1] = positions[idx + 1];
      originalPositions[idx + 2] = positions[idx + 2];

      // Procedural color based on region/type
      const color = new THREE.Color();
      // Use coordinates to generate a gradient color (front-to-back, left-to-right)
      color.setHSL((node.x / 1000) + 0.5, 0.8, 0.6);
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
      opacity: 0.8,
      sizeAttenuation: true
    });

    brainPoints = new THREE.Points(geometry, material);
    scene.add(brainPoints);
  });

// 4. Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  // Make the environment particles slowly drift
  envPoints.rotation.y = time * 0.02;

  // Animate the brain if it's loaded
  if (brainPoints) {
    // 1. Brain slowly floats/bobs in the world
    brainPoints.position.y = Math.sin(time * 0.5) * 50;
    
    // 2. Fly evolves / swims through space
    brainPoints.position.z = Math.sin(time * 0.2) * 200;
    
    // 3. Brain rotates slightly
    brainPoints.rotation.y = Math.sin(time * 0.1) * 0.2;
    brainPoints.rotation.x = Math.cos(time * 0.15) * 0.1;

    // 4. Brain pulsing effect (Neurons firing / breathing)
    const positions = brainPoints.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      // Pulse outward from center based on a sine wave
      const x = originalPositions[i];
      const y = originalPositions[i + 1];
      const z = originalPositions[i + 2];
      
      const dist = Math.sqrt(x*x + y*y + z*z);
      // Creates a wave that travels through the brain
      const pulse = 1 + Math.sin(dist * 0.01 - time * 5) * 0.05;
      
      positions[i] = x * pulse;
      positions[i + 1] = y * pulse;
      positions[i + 2] = z * pulse;
    }
    brainPoints.geometry.attributes.position.needsUpdate = true;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -frustumSize * aspect / 2;
  camera.right = frustumSize * aspect / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
