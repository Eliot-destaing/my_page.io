// Version mise à jour - utilise GLTFLoader
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import gsap from './libs/gsap.min.js';

const loadingOverlay = document.getElementById('loading');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0; // Exposition normale pour voir les couleurs
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0416, 0.05); // Brouillard réduit pour mieux voir les objets

const cameraHolder = new THREE.Object3D();
scene.add(cameraHolder);
const pivot = new THREE.Object3D();
cameraHolder.add(pivot);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 60);
pivot.add(camera);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
// Bloom pour l'ambiance spatiale
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.6, 0.85);
bloomPass.threshold = 0.3;
bloomPass.strength = 0.7;
bloomPass.radius = 0.4;
composer.addPass(bloomPass);
const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms['offset'].value = 1.05;
vignettePass.uniforms['darkness'].value = 1.25;
composer.addPass(vignettePass);

// Éclairage très lumineux pour toute la scène
const ambient = new THREE.AmbientLight(0xffffff, 1.2); // Lumière ambiante très forte
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xffffff, 1.5); // Lumière principale très forte
keyLight.position.set(5, 5, 5);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 1.0); // Lumière de remplissage forte
fillLight.position.set(-5, 3, -5);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xffffff, 0.8); // Lumière latérale
rimLight.position.set(0, -5, -5);
scene.add(rimLight);
const accentLight = new THREE.DirectionalLight(0xffffff, 0.7); // Lumière d'accent
accentLight.position.set(0, 5, 0);
scene.add(accentLight);
const backLight = new THREE.DirectionalLight(0xffffff, 0.6); // Lumière arrière
backLight.position.set(0, 0, 5);
scene.add(backLight);
const sideLight1 = new THREE.DirectionalLight(0xffffff, 0.5); // Lumière latérale 1
sideLight1.position.set(5, 0, 0);
scene.add(sideLight1);
const sideLight2 = new THREE.DirectionalLight(0xffffff, 0.5); // Lumière latérale 2
sideLight2.position.set(-5, 0, 0);
scene.add(sideLight2);

const nebulaUniforms = {
  uTime: { value: 0 },
  uColorInner: { value: new THREE.Color(0x5d4b73) }, // Encore plus lumineux
  uColorOuter: { value: new THREE.Color(0x2a1b3f) }, // Encore plus lumineux
  uAccent: { value: new THREE.Color(0x9470d8) }, // Encore plus lumineux
};
const nebulaMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  transparent: true,
  uniforms: nebulaUniforms,
  fragmentShader: /* glsl */`
    uniform vec3 uColorInner;
    uniform vec3 uColorOuter;
    uniform vec3 uAccent;
    uniform float uTime;
    varying vec3 vPos;
    float noise(vec3 p){
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f*f*(3.0-2.0*f);
      float n = dot(i, vec3(1.0, 57.0, 113.0));
      return mix(mix(mix(fract(sin(n+0.0)*43758.5453), fract(sin(n+1.0)*43758.5453), f.x),
                     mix(fract(sin(n+57.0)*43758.5453), fract(sin(n+58.0)*43758.5453), f.x), f.y),
                 mix(mix(fract(sin(n+113.0)*43758.5453), fract(sin(n+114.0)*43758.5453), f.x),
                     mix(fract(sin(n+170.0)*43758.5453), fract(sin(n+171.0)*43758.5453), f.x), f.y), f.z);
    }
    void main(){
      float radius = length(vPos);
      float gradient = smoothstep(1.0, 0.0, radius * 0.11);
      float distort = noise(vPos * 0.15 + uTime * 0.015);
      float glow = pow(1.0 - radius * 0.08, 4.0);
      vec3 base = mix(uColorOuter, uColorInner, gradient);
      vec3 color = mix(base, uAccent, distort * 0.35 + glow * 0.4);
      float alpha = clamp(gradient * 1.4, 0.0, 0.9);
      gl_FragColor = vec4(color, alpha);
    }
  `,
  vertexShader: /* glsl */`
    varying vec3 vPos;
    void main(){
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
});
const nebula = new THREE.Mesh(new THREE.SphereGeometry(30, 64, 64), nebulaMaterial);
scene.add(nebula);

const dustCount = 1400;
const dustGeometry = new THREE.BufferGeometry();
const dustPositions = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  const radius = THREE.MathUtils.randFloat(6, 13);
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi) * THREE.MathUtils.randFloat(0.8, 1.0);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  dustPositions.set([x, y, z], i * 3);
}
dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dustMaterial = new THREE.PointsMaterial({
  color: 0xd2d6ff,
  size: 0.06,
  transparent: true,
  opacity: 0.6,
  sizeAttenuation: true,
  depthWrite: false,
});
const dust = new THREE.Points(dustGeometry, dustMaterial);
scene.add(dust);

const debrisGroup = new THREE.Group();
scene.add(debrisGroup);
const debrisMaterial = new THREE.MeshStandardMaterial({
  color: 0x485079,
  metalness: 0.1,
  roughness: 0.8,
  emissive: new THREE.Color(0x111424),
});
// Débris de plusieurs tailles, plus loin dans le décor
const debrisSizes = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.7];
for (let i = 0; i < 120; i++) {
  const size = debrisSizes[Math.floor(Math.random() * debrisSizes.length)];
  const geometry = new THREE.TetrahedronGeometry(size, 1);
  const mesh = new THREE.Mesh(geometry, debrisMaterial.clone());
  const pos = new THREE.Vector3().randomDirection().multiplyScalar(THREE.MathUtils.randFloat(8.0, 25.0)); // Plus loin
  mesh.position.copy(pos);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  mesh.material.emissiveIntensity = THREE.MathUtils.randFloat(0.1, 0.5);
  mesh.userData.spin = new THREE.Vector3().set(Math.random(), Math.random(), Math.random()).multiplyScalar(THREE.MathUtils.randFloat(0.1, 0.4));
  debrisGroup.add(mesh);
}


const goldenRatio = (1 + Math.sqrt(5)) / 2;
const projectsData = [
  {
    id: 'semestre_bolivie',
    name: 'Semestre Bolivie',
    subtitle: 'Carnet d\'exploration à La Paz & Uyuni',
    file: 'objet3d/alpaga porte-clés 3d.glb',
    description:
      'Journal visuel de mission universitaire en Bolivie — immersion terrain, reportage photographique et narration sensible des communautés andines.',
    link: 'https://github.com/example/semestre-bolivie',
    // Paramètres personnalisés par objet
    distance: 4.2,      // Distance depuis le centre
    taille: 1.0,        // Taille de l'objet
    lumiereMax: 1.0,    // Multiplicateur de luminosité (1.0 = normal)
  },
  {
    id: 'retro_game_unity',
    name: 'Retro Game Unity',
    subtitle: 'Jeu Unity style années 90',
    file: 'objet3d/game boy modèle 3d.glb',
    description:
      'Jeu Unity inspiré des consoles 90s avec shaders CRT, scoring arcade et animations low-poly.',
    link: 'https://github.com/example/retro-game-unity',
    distance: 4.2,
    taille: 1.0,
    lumiereMax: 1.0,
  },
  {
    id: 'stage_ministere',
    name: 'Stage Ministère des Armées',
    subtitle: 'Stage de 18 semaines',
    file: 'objet3d/casque.glb',
    description:
      'Stage de 18 semaines au ministère des armées — développement d\'applications et systèmes pour la défense.',
    link: null, // Pas de GitHub
    distance: 4.2,
    taille: 1.0,
    lumiereMax: 0.5,    // Casque moins lumineux
  },
  {
    id: 'projet_ero',
    name: 'Projet ERO',
    subtitle: 'Parcours de graphes dans la ville de Montréal',
    file: 'objet3d/deneigeuse.glb',
    description:
      'Optimisation de parcours de graphes pour la gestion de la déneigement dans la ville de Montréal — développement en Python.',
    link: 'https://github.com/example/projet-ero',
    distance: 8.2,
    taille: 5.5,        // Déneigeuse plus grande
    lumiereMax: 0.7,
  },
];

const manager = new THREE.LoadingManager();
manager.onLoad = () => {
  loadingOverlay.classList.add('hidden');
};
const loader = new GLTFLoader(manager);
manager.onProgress = (url, loaded, total) => {
  if (!loadingOverlay.classList.contains('hidden')) {
    loadingOverlay.textContent = `Chargement des artefacts ${loaded} / ${total}`;
  }
};

const projectAnchors = [];
const projectTargets = [];

const tempBox = new THREE.Box3();
const tempSize = new THREE.Vector3();
const tempCenter = new THREE.Vector3();

function normalizeModel(object, targetSize = 1.6) {
  tempBox.setFromObject(object);
  if (tempBox.isEmpty()) {
    return object.scale.x || 1;
  }
  tempBox.getSize(tempSize);
  const maxAxis = Math.max(tempSize.x, tempSize.y, tempSize.z);
  const scale = maxAxis > 0 ? targetSize / maxAxis : 1;
  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);
  tempBox.setFromObject(object);
  tempBox.getCenter(tempCenter);
  object.position.sub(tempCenter);
  object.updateMatrixWorld(true);
  return object.scale.x;
}

function fibonacciSphere(index, total, radius) {
  const i = index + 0.5;
  const phi = Math.acos(1 - 2 * i / total);
  const theta = 2 * Math.PI * i / goldenRatio;
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createHTMLPopup(project) {
  const popup = document.createElement('div');
  popup.className = 'popup-container';
  popup.id = `popup-${project.id}`;
  
  popup.innerHTML = `
    <div class="popup-glass">
      <button class="popup-close" aria-label="Fermer">×</button>
      <div class="popup-3d-container">
        <canvas class="popup-3d-canvas"></canvas>
      </div>
      <div class="popup-content">
        <h2 class="popup-title">${project.name}</h2>
        ${project.subtitle ? `<h3 class="popup-subtitle">${project.subtitle}</h3>` : ''}
        <p class="popup-description">${project.description}</p>
        ${project.link ? `<button class="popup-button" data-link="${project.link}">
          <span>Voir sur GitHub</span>
        </button>` : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  const closeButton = popup.querySelector('.popup-close');
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopup();
  });
  
  const button = popup.querySelector('.popup-button');
  if (button && project.link) {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(project.link, '_blank');
    });
  }
  
  popup.addEventListener('click', (e) => {
    if (e.target === popup || e.target.classList.contains('popup-glass')) {
      closePopup();
    }
  });
  
  return popup;
}

const popups = new Map();
let activePopup = null;
let popupRenderer = null;
let popupScene = null;
let popupCamera = null;
let popupObject = null;
let popupRotation = { x: 0, y: 0 };
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };

const slowMotion = { value: 1 };

// Système de compteur
function updateCounter() {
  const counterEl = document.getElementById('counter');
  if (!counterEl) return;
  
  const visited = projectAnchors.filter(a => a.userData.visited).length;
  const total = projectAnchors.length;
  
  counterEl.innerHTML = `${visited}/<span id="total">${total}</span>`;
  
  // Animation du compteur
  gsap.fromTo(counterEl, 
    { scale: 1.2 },
    { scale: 1, duration: 0.3, ease: 'back.out' }
  );
}

function toggleSlowMotion(active) {
  gsap.to(slowMotion, { value: active ? 0.2 : 1, duration: 0.6, ease: 'sine.out' });
}

function orientTowardsCenter(object) {
  const target = new THREE.Vector3();
  object.getWorldPosition(target);
  const lookAtMatrix = new THREE.Matrix4();
  lookAtMatrix.lookAt(target, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
  const quat = new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix);
  object.quaternion.copy(quat);
  object.rotateY(Math.PI);
}

async function loadProjects() {
  const promises = projectsData.map(async (project, index) => {
    const gltf = await loader.loadAsync(project.file);
    const anchor = new THREE.Group();
    anchor.name = project.name;
    const asset = gltf.scene;
    const meshes = [];
    
    // Charger le modèle et ajuster les matériaux selon les paramètres personnalisés
    asset.traverse(node => {
      if (node.isMesh) {
        meshes.push(node);
        // Ajuster la luminosité selon le paramètre lumiereMax
        if (node.material) {
          const originalMat = node.material;
          const lumiereMax = project.lumiereMax !== undefined ? project.lumiereMax : 1.0;
          
          // Si c'est un MeshStandardMaterial ou similaire, ajuster l'émissivité
          if (originalMat.isMeshStandardMaterial || originalMat.isMeshPhysicalMaterial) {
            if (!originalMat.emissive) {
              originalMat.emissive = new THREE.Color(0x000000);
            }
            // Réduire la luminosité en ajustant l'émissivité et la couleur
            originalMat.emissiveIntensity = lumiereMax * 0.3;
            originalMat.color.multiplyScalar(lumiereMax);
          } else if (originalMat.isMeshBasicMaterial) {
            // Pour MeshBasicMaterial, ajuster la couleur directement
            originalMat.color.multiplyScalar(lumiereMax);
          }
        }
      }
    });
    
    // Utiliser la taille personnalisée
    const targetVisualSize = project.taille !== undefined ? project.taille : 1.0;
    normalizeModel(asset, targetVisualSize);
    anchor.add(asset);

    let pos;
    if (projectsData.length === 1) {
      pos = new THREE.Vector3(0, 0, -4.5);
    } else {
      // Utiliser la distance personnalisée
      const radius = project.distance !== undefined ? project.distance : 4.2;
      pos = fibonacciSphere(index, projectsData.length, radius);
    }
    anchor.position.copy(pos);
    orientTowardsCenter(anchor);

    anchor.userData = {
      project,
      asset,
      baseScale: asset.scale.x,
      basePosition: new THREE.Vector3().copy(anchor.position),
      focusTween: null,
      highlight: false,
      visited: false,
      floatOffset: Math.random() * Math.PI * 2,
      rotationSpeed: THREE.MathUtils.randFloat(0.08, 0.15), // Rotation plus lente
      orbitSpeed: THREE.MathUtils.randFloat(0.3, 0.6),
      orbitRadius: THREE.MathUtils.randFloat(0.3, 0.6),
      orbitAxis: new THREE.Vector3(
        THREE.MathUtils.randFloat(-1, 1),
        THREE.MathUtils.randFloat(-1, 1),
        THREE.MathUtils.randFloat(-1, 1)
      ).normalize(),
      hoverTween: null,
      meshes,
    };

    projectAnchors.push(anchor);
    projectTargets.push(anchor);
    scene.add(anchor);

    const popup = createHTMLPopup(project);
    popups.set(project.id, popup);

    return anchor;
  });
  await Promise.all(promises);
}

let pointerLocked = false;
const sensitivity = 0.0028;
const cameraAngles = { yaw: 0, pitch: 0 };

function updateCameraRotation(dx, dy) {
  cameraAngles.yaw -= dx * sensitivity;
  cameraAngles.pitch -= dy * sensitivity;
  cameraAngles.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraAngles.pitch));
  pivot.rotation.set(cameraAngles.pitch, cameraAngles.yaw, 0, 'YXZ');
}

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  document.body.classList.toggle('pointerlocked', pointerLocked);
  // Ne pas fermer la popup si elle est ouverte, on veut juste désactiver le pointer lock
  // La popup sera fermée manuellement par l'utilisateur
});

renderer.domElement.addEventListener('click', () => {
  if (!pointerLocked) {
    renderer.domElement.requestPointerLock();
    return;
  }
  handleSelection();
});

document.addEventListener('mousemove', event => {
  if (!pointerLocked) return;
  updateCameraRotation(event.movementX, event.movementY);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && activePopup) {
    closePopup();
  }
});

const raycaster = new THREE.Raycaster();
let currentTarget = null;

function handleSelection() {
  if (activePopup) {
    closePopup();
    return;
  }
  if (currentTarget) {
    openPopup(currentTarget.userData.project);
  }
}

function setupPopup3D(anchor, canvas) {
  // Créer le renderer 3D pour la popup
  popupRenderer = new THREE.WebGLRenderer({ 
    canvas: canvas, 
    antialias: true, 
    alpha: true 
  });
  popupRenderer.setSize(400, 400);
  popupRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  popupRenderer.outputColorSpace = THREE.SRGBColorSpace;
  
  // Créer la scène 3D pour la popup
  popupScene = new THREE.Scene();
  popupCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  popupCamera.position.set(0, 0, 5);
  
  // Éclairage pour la popup
  const popupAmbient = new THREE.AmbientLight(0xffffff, 1.0);
  popupScene.add(popupAmbient);
  const popupKey = new THREE.DirectionalLight(0xffffff, 1.2);
  popupKey.position.set(5, 5, 5);
  popupScene.add(popupKey);
  const popupFill = new THREE.DirectionalLight(0xffffff, 0.6);
  popupFill.position.set(-5, 3, -5);
  popupScene.add(popupFill);
  
  // Cloner l'objet 3D
  const originalAsset = anchor.userData.asset;
  popupObject = originalAsset.clone();
  popupObject.traverse(node => {
    if (node.isMesh && node.material) {
      node.material = node.material.clone();
    }
  });
  
  // Calculer la taille appropriée pour la popup
  const box = new THREE.Box3().setFromObject(popupObject);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 2.5 / maxDim; // Taille cible de 2.5 unités
  popupObject.scale.multiplyScalar(scale);
  
  // Centrer l'objet
  box.setFromObject(popupObject);
  const center = box.getCenter(new THREE.Vector3());
  popupObject.position.sub(center);
  
  popupScene.add(popupObject);
  popupRotation = { x: 0, y: 0 };
  
  // Gérer la rotation avec la souris
  let isDraggingPopup = false;
  let lastMousePosPopup = { x: 0, y: 0 };
  
  canvas.addEventListener('mousedown', (e) => {
    isDraggingPopup = true;
    lastMousePosPopup.x = e.clientX;
    lastMousePosPopup.y = e.clientY;
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (isDraggingPopup) {
      const dx = e.clientX - lastMousePosPopup.x;
      const dy = e.clientY - lastMousePosPopup.y;
      popupRotation.y += dx * 0.01;
      popupRotation.x += dy * 0.01;
      popupRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, popupRotation.x));
      lastMousePosPopup.x = e.clientX;
      lastMousePosPopup.y = e.clientY;
    }
  });
  
  canvas.addEventListener('mouseup', () => {
    isDraggingPopup = false;
  });
  
  canvas.addEventListener('mouseleave', () => {
    isDraggingPopup = false;
  });
  
  // Animation de la popup 3D
  function animatePopup() {
    if (!popupRenderer || !popupScene || !popupCamera || !popupObject) return;
    requestAnimationFrame(animatePopup);
    
    // Appliquer la rotation
    popupObject.rotation.y = popupRotation.y;
    popupObject.rotation.x = popupRotation.x;
    
    // Rotation automatique lente si pas de drag
    if (!isDraggingPopup) {
      popupRotation.y += 0.005;
    }
    
    popupRenderer.render(popupScene, popupCamera);
  }
  
  animatePopup();
}

function openPopup(project) {
  const popup = popups.get(project.id);
  if (!popup) return;
  activePopup = popup;
  toggleSlowMotion(true);
  
  // Marquer le projet comme visité
  const anchor = projectAnchors.find(a => a.userData.project.id === project.id);
  if (!anchor) return;
  
  if (!anchor.userData.visited) {
    anchor.userData.visited = true;
    updateCounter();
  }
  
  // Sauvegarder la position et rotation originales
  anchor.userData.originalPosition = anchor.position.clone();
  anchor.userData.originalRotation = anchor.rotation.clone();
  anchor.userData.originalScale = anchor.userData.asset.scale.clone();
  
  // Désactiver le pointer lock pour permettre les clics normaux
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
  
  // Ajouter la classe pour désactiver les interactions avec le canvas
  document.body.classList.add('popup-open');
  
  popup.style.display = 'flex';
  popup.style.opacity = '0';
  
  const canvas = popup.querySelector('.popup-3d-canvas');
  if (canvas) {
    setupPopup3D(anchor, canvas);
  }
  
  const glass = popup.querySelector('.popup-glass');
  const closeBtn = popup.querySelector('.popup-close');
  const title = popup.querySelector('.popup-title');
  const subtitle = popup.querySelector('.popup-subtitle');
  const description = popup.querySelector('.popup-description');
  const button = popup.querySelector('.popup-button');
  
  // Le backdrop-filter est déjà défini dans le CSS, pas besoin de l'animer avec GSAP
  glass.style.backdropFilter = 'blur(20px) saturate(180%)';
  glass.style.webkitBackdropFilter = 'blur(20px) saturate(180%)';
  
  gsap.fromTo(popup, 
    { opacity: 0, scale: 0.9 },
    { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' }
  );
  
  if (closeBtn) {
    gsap.fromTo(closeBtn,
      { opacity: 0, scale: 0.8, rotation: -90 },
      { opacity: 1, scale: 1, rotation: 0, duration: 0.4, ease: 'expo.out', delay: 0.2 }
    );
  }
  
  if (title) {
    gsap.fromTo(title,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', delay: 0.1 }
    );
  }
  
  if (subtitle) {
    gsap.fromTo(subtitle,
      { opacity: 0, y: -15 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out', delay: 0.2 }
    );
  }
  
  if (description) {
    gsap.fromTo(description,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', delay: 0.3 }
    );
  }
  
  if (button) {
    gsap.fromTo(button,
      { opacity: 0, y: 15, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'expo.out', delay: 0.4 }
    );
  }
}

function closePopup() {
  if (!activePopup) return;
  const popup = activePopup;
  activePopup = null;
  toggleSlowMotion(false);
  
  // Nettoyer la scène 3D de la popup
  if (popupRenderer) {
    popupRenderer.dispose();
    popupRenderer = null;
  }
  if (popupScene) {
    popupScene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    popupScene = null;
  }
  popupCamera = null;
  popupObject = null;
  
  // Retirer la classe pour réactiver les interactions avec le canvas
  document.body.classList.remove('popup-open');
  
  gsap.to(popup, {
    opacity: 0,
    scale: 0.95,
    duration: 0.3,
    ease: 'expo.in',
    onComplete: () => {
      popup.style.display = 'none';
      // Réactiver le pointer lock après la fermeture
      if (!document.pointerLockElement) {
        renderer.domElement.requestPointerLock();
      }
    }
  });
}

function setFocus(target) {
  if (currentTarget === target) return;
  if (currentTarget) {
    currentTarget.userData.highlight = false;
    if (currentTarget.userData.focusTween) {
      currentTarget.userData.focusTween.kill();
    }
    if (currentTarget.userData.hoverTween) {
      currentTarget.userData.hoverTween.kill();
    }
    currentTarget.userData.focusTween = gsap.to(currentTarget.userData.asset.scale, {
      x: currentTarget.userData.baseScale,
      y: currentTarget.userData.baseScale,
      z: currentTarget.userData.baseScale,
      duration: 0.4,
      ease: 'sine.out',
    });
    // Retour à la position de base
    currentTarget.userData.hoverTween = gsap.to(currentTarget.position, {
      x: currentTarget.userData.basePosition.x,
      y: currentTarget.userData.basePosition.y,
      z: currentTarget.userData.basePosition.z,
      duration: 0.5,
      ease: 'sine.out',
    });
  }
  currentTarget = target;
  if (currentTarget) {
    currentTarget.userData.highlight = true;
    if (currentTarget.userData.focusTween) {
      currentTarget.userData.focusTween.kill();
    }
    if (currentTarget.userData.hoverTween) {
      currentTarget.userData.hoverTween.kill();
    }
    currentTarget.userData.focusTween = gsap.to(currentTarget.userData.asset.scale, {
      x: currentTarget.userData.baseScale * 1.15,
      y: currentTarget.userData.baseScale * 1.15,
      z: currentTarget.userData.baseScale * 1.15,
      duration: 0.5,
      ease: 'expo.out',
    });
    // Mouvement vers la caméra au survol (depuis la position actuelle)
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);
    const currentPos = new THREE.Vector3();
    currentTarget.getWorldPosition(currentPos);
    const direction = new THREE.Vector3()
      .subVectors(cameraPos, currentPos)
      .normalize()
      .multiplyScalar(0.8); // Avancer de 0.8 unités vers la caméra
    const hoverPos = new THREE.Vector3()
      .copy(currentPos)
      .add(direction);
    currentTarget.userData.hoverTween = gsap.to(currentTarget.position, {
      x: hoverPos.x,
      y: hoverPos.y,
      z: hoverPos.z,
      duration: 0.6,
      ease: 'expo.out',
    });
  }
}

const tempDir = new THREE.Vector3();
const tempPos = new THREE.Vector3();
const clock = new THREE.Clock();

function alignCameraToTarget(position) {
  const dir = position.clone().normalize();
  const yaw = Math.atan2(dir.x, -dir.z);
  const pitch = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
  cameraAngles.yaw = yaw;
  cameraAngles.pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
  pivot.rotation.set(cameraAngles.pitch, cameraAngles.yaw, 0, 'YXZ');
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta() * slowMotion.value;
  nebulaUniforms.uTime.value += delta;

  debrisGroup.children.forEach(mesh => {
    mesh.rotation.x += mesh.userData.spin.x * delta;
    mesh.rotation.y += mesh.userData.spin.y * delta;
    mesh.rotation.z += mesh.userData.spin.z * delta;
  });


  projectAnchors.forEach(anchor => {
    const asset = anchor.userData.asset;
    const ud = anchor.userData;
    const t = clock.elapsedTime;
    
    // Rotation complexe mais lente
    asset.rotation.x += delta * ud.rotationSpeed * 0.3;
    asset.rotation.y += delta * ud.rotationSpeed;
    asset.rotation.z += delta * ud.rotationSpeed * 0.2;
    
    // Mouvement orbital complexe dans l'espace (seulement si pas en hover)
    if (!ud.highlight) {
      const orbitAngle = t * ud.orbitSpeed + ud.floatOffset;
      const orbitOffset = new THREE.Vector3()
        .copy(ud.orbitAxis)
        .multiplyScalar(Math.sin(orbitAngle) * ud.orbitRadius);
      
      // Flottement vertical
      const floatY = Math.sin(t * 0.5 + ud.floatOffset) * 0.15;
      
      // Position finale avec mouvement orbital
      anchor.position.copy(ud.basePosition)
        .add(orbitOffset)
        .add(new THREE.Vector3(0, floatY, 0));
    }
    
    // Flottement local de l'asset
    asset.position.y = Math.sin(t * 0.8 + ud.floatOffset) * 0.08;
    asset.position.x = Math.cos(t * 0.6 + ud.floatOffset) * 0.05;
    
    // Bloom sur les objets en focus
    anchor.userData.meshes.forEach(mesh => {
      if (anchor.userData.highlight) {
        mesh.layers.enable(1);
      } else {
        mesh.layers.disable(1);
      }
    });
  });

  if (!activePopup && projectTargets.length) {
    camera.getWorldDirection(tempDir);
    const origin = camera.getWorldPosition(tempPos.set(0, 0, 0));
    raycaster.set(origin, tempDir);
    const intersects = raycaster.intersectObjects(projectTargets, true);
    let target = null;
    if (intersects.length > 0) {
      let parent = intersects[0].object;
      while (parent && !parent.userData.project && parent.parent) {
        parent = parent.parent;
      }
      if (parent && parent.userData.project) {
        target = parent;
      }
    }
    setFocus(target);
  }

  composer.render();
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

async function bootstrap() {
  await loadProjects();
  updateCounter(); // Initialiser le compteur
  if (projectAnchors.length) {
    alignCameraToTarget(projectAnchors[0].position);
    setFocus(projectAnchors[0]);
  }
  animate();
}

bootstrap();
