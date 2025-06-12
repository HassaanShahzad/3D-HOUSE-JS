import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// === Scene Setup ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(130, 0, 100);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// === Controls ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 20;
controls.maxDistance = 250;

// === Lighting ===
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 100, -10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(2048, 2048);
directionalLight.shadow.bias = -0.001;
const d = 200;
Object.assign(directionalLight.shadow.camera, {
  left: -d, right: d, top: d, bottom: -d, near: 1, far: 500
});
scene.add(directionalLight);

scene.add(new THREE.AmbientLight(0xffffff, 0.2));
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.25);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

// === Ground ===
const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.ShadowMaterial({ opacity: 0.3 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// === Raycaster ===
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clickableMeshes = [];
let mixer;

// === Material Handling ===
const roofMaterialName = 'genting.004';
const roofColor = '#5CA9E9';
const otherMaterialColors = {
  'Glass.009': '#87CEEB',
  'Material.137': '#FFD700',
  'Material.136': '#228B22'
};

const materialDescriptions = {
  'Glass.009': 'Title of obj: WINDOW',
  'Material.137': 'Title of obj: ROOF',
  'Material.136': 'Title of obj: GARDEN'
};

// === Overlay for Roof (optional) ===
const overlay = document.getElementById('overlayContainer');
if (overlay) {
  overlay.style.display = 'none';
  overlay.style.opacity = '0';
}

const materialInfoBox = document.createElement('div');
materialInfoBox.id = 'materialInfo';

materialInfoBox.innerHTML = `
  <p id="materialText">Material info will appear here.</p>
  <button onclick="document.getElementById('materialInfo').style.display='none'">Close</button>
`;

document.body.appendChild(materialInfoBox);

// === Load Environment and Model ===
const pmremGenerator = new THREE.PMREMGenerator(renderer);
new RGBELoader().load('./env.hdr', (texture) => {
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  scene.environment = envMap;
  texture.dispose();
  pmremGenerator.dispose();
  loadModel();
});

function loadModel() {
  const dracoLoader = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  const loader = new GLTFLoader().setDRACOLoader(dracoLoader);

  loader.load('./model/nhouse2.glb', (gltf) => {
    const model = gltf.scene;
    model.scale.set(7.5, 7.5, 7.5);
    model.rotation.set(0, Math.PI / 1.3, 0);

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (mat.name === roofMaterialName || otherMaterialColors[mat.name]) {
            clickableMeshes.push(child);
          }
        });
      }
    });

    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    controls.target.copy(center);
    camera.lookAt(center);
  });
}

// === Click Handler ===
window.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(clickableMeshes, true);

  if (intersects.length > 0) {
    const clicked = intersects[0].object;
    const materials = Array.isArray(clicked.material) ? clicked.material : [clicked.material];

    materials.forEach((mat) => {
      if (mat.name === roofMaterialName) {
        mat.color.set(roofColor);
        if (overlay) {
          overlay.style.display = 'flex';
          requestAnimationFrame(() => {
            overlay.style.opacity = '1';
          });
        }
      } else if (otherMaterialColors[mat.name]) {
        mat.color.set(otherMaterialColors[mat.name]);

        // Show material info box
        const textBox = document.getElementById('materialText');
        textBox.textContent = materialDescriptions[mat.name] || 'Material clicked.';
        materialInfoBox.style.display = 'block';
      }
    });
  }
});

// === Escape Key to Close Overlays ===
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (overlay && overlay.style.display === 'flex') {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 300);
    }
    if (materialInfoBox.style.display === 'block') {
      materialInfoBox.style.display = 'none';
    }
  }
});

// === Animation Loop ===
function animate() {
  requestAnimationFrame(animate);
  if (mixer) mixer.update(0.016);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// === Resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
