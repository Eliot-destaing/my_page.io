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
renderer.toneMappingExposure = 1.1;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0416, 0.045);

const cameraHolder = new THREE.Object3D();
scene.add(cameraHolder);
const pivot = new THREE.Object3D();
cameraHolder.add(pivot);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 60);
pivot.add(camera);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.6, 0.85);
bloomPass.threshold = 0.2;
bloomPass.strength = 0.9;
bloomPass.radius = 0.5;
composer.addPass(bloomPass);
const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms['offset'].value = 1.05;
vignettePass.uniforms['darkness'].value = 1.25;
composer.addPass(vignettePass);

const ambient = new THREE.AmbientLight(0x6c7ba5, 0.6);
scene.add(ambient);
const keyLight = new THREE.PointLight(0x86a2ff, 1.45, 28, 1.6);
keyLight.position.set(4, 3, 3);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0xff9fd5, 0.9, 25, 2.0);
rimLight.position.set(-3, -4, -2);
scene.add(rimLight);
const fillLight = new THREE.PointLight(0x94b8ff, 0.8, 30, 1.4);
fillLight.position.set(0, 2, -4.5);
scene.add(fillLight);

const nebulaUniforms = {
  uTime: { value: 0 },
  uColorInner: { value: new THREE.Color(0x1d0b33) },
  uColorOuter: { value: new THREE.Color(0x03010f) },
  uAccent: { value: new THREE.Color(0x5430a8) },
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
for (let i = 0; i < 45; i++) {
  const geometry = new THREE.TetrahedronGeometry(THREE.MathUtils.randFloat(0.1, 0.3), 1);
  const mesh = new THREE.Mesh(geometry, debrisMaterial.clone());
  const pos = new THREE.Vector3().randomDirection().multiplyScalar(THREE.MathUtils.randFloat(2.2, 7.0));
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
    subtitle: 'Carnet d’exploration à La Paz & Uyuni',
    file: 'assets/models/semestre_bolivie.gltf',
    description:
      'Journal visuel de mission universitaire en Bolivie — immersion terrain, reportage photographique et narration sensible des communautés andines.',
    link: 'https://github.com/example/semestre-bolivie',
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
      <div class="popup-content">
        <h2 class="popup-title">${project.name}</h2>
        ${project.subtitle ? `<h3 class="popup-subtitle">${project.subtitle}</h3>` : ''}
        <p class="popup-description">${project.description}</p>
        <button class="popup-button" data-link="${project.link}">
          <span>Voir sur GitHub</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  const button = popup.querySelector('.popup-button');
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    window.open(project.link, '_blank');
  });
  
  popup.addEventListener('click', (e) => {
    if (e.target === popup || e.target.classList.contains('popup-glass')) {
      closePopup();
    }
  });
  
  return popup;
}

const popups = new Map();
let activePopup = null;

const slowMotion = { value: 1 };

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
    asset.traverse(node => {
      if (node.isMesh) {
        // Préserver les matériaux originaux du GLTF sans les modifier
        if (node.material) {
          const originalMaterial = node.material;
          // Si c'est un tableau de matériaux, prendre le premier
          const mat = Array.isArray(originalMaterial) ? originalMaterial[0] : originalMaterial;
          // Cloner seulement le matériau, pas les textures (elles sont déjà chargées)
          node.material = mat.clone();
          // Référencer les textures originales (ne pas cloner pour préserver les couleurs)
          if (mat.map) node.material.map = mat.map;
          if (mat.normalMap) node.material.normalMap = mat.normalMap;
          if (mat.emissiveMap) node.material.emissiveMap = mat.emissiveMap;
          if (mat.roughnessMap) node.material.roughnessMap = mat.roughnessMap;
          if (mat.metalnessMap) node.material.metalnessMap = mat.metalnessMap;
          if (mat.aoMap) node.material.aoMap = mat.aoMap;
          // S'assurer que le matériau est mis à jour
          node.material.needsUpdate = true;
          // Ajustements très légers pour la visibilité sans altérer les couleurs
          if (!node.material.emissive || node.material.emissive.equals(new THREE.Color(0x000000))) {
            node.material.emissive = new THREE.Color(0x000000);
          }
          node.material.emissiveIntensity = 0.1;
        }
        meshes.push(node);
      }
    });
    const targetVisualSize = 1.8;
    normalizeModel(asset, targetVisualSize);
    anchor.add(asset);

    let pos;
    if (projectsData.length === 1) {
      pos = new THREE.Vector3(0, 0, -4.5);
    } else {
      const radius = 4.2;
      pos = fibonacciSphere(index, projectsData.length, radius);
    }
    anchor.position.copy(pos);
    orientTowardsCenter(anchor);

    anchor.userData = {
      project,
      asset,
      baseScale: asset.scale.x,
      focusTween: null,
      highlight: false,
      floatOffset: Math.random() * Math.PI * 2,
      rotationSpeed: THREE.MathUtils.randFloat(0.2, 0.45),
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
  if (!pointerLocked && activePopup) {
    // keep pointer lock active while popup shows, if user escapes we close popup
    closePopup();
  }
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

function openPopup(project) {
  const popup = popups.get(project.id);
  if (!popup) return;
  activePopup = popup;
  toggleSlowMotion(true);
  
  popup.style.display = 'flex';
  popup.style.opacity = '0';
  
  const glass = popup.querySelector('.popup-glass');
  const title = popup.querySelector('.popup-title');
  const subtitle = popup.querySelector('.popup-subtitle');
  const description = popup.querySelector('.popup-description');
  const button = popup.querySelector('.popup-button');
  
  gsap.fromTo(popup, 
    { opacity: 0, scale: 0.9 },
    { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' }
  );
  
  gsap.fromTo(glass,
    { backdropFilter: 'blur(0px)', WebkitBackdropFilter: 'blur(0px)' },
    { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', duration: 0.6, ease: 'sine.out' }
  );
  
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
  
  gsap.to(popup, {
    opacity: 0,
    scale: 0.95,
    duration: 0.3,
    ease: 'expo.in',
    onComplete: () => {
      popup.style.display = 'none';
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
    currentTarget.userData.focusTween = gsap.to(currentTarget.userData.asset.scale, {
      x: currentTarget.userData.baseScale,
      y: currentTarget.userData.baseScale,
      z: currentTarget.userData.baseScale,
      duration: 0.4,
      ease: 'sine.out',
    });
  }
  currentTarget = target;
  if (currentTarget) {
    currentTarget.userData.highlight = true;
    if (currentTarget.userData.focusTween) {
      currentTarget.userData.focusTween.kill();
    }
    currentTarget.userData.focusTween = gsap.to(currentTarget.userData.asset.scale, {
      x: currentTarget.userData.baseScale * 1.2,
      y: currentTarget.userData.baseScale * 1.2,
      z: currentTarget.userData.baseScale * 1.2,
      duration: 0.5,
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
    asset.rotation.y += delta * anchor.userData.rotationSpeed;
    const float = Math.sin(clock.elapsedTime * 0.6 + anchor.userData.floatOffset) * 0.1;
    asset.position.y = float;
    asset.position.z = Math.cos(clock.elapsedTime * 0.4 + anchor.userData.floatOffset) * 0.05;
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
  if (projectAnchors.length) {
    alignCameraToTarget(projectAnchors[0].position);
    setFocus(projectAnchors[0]);
  }
  animate();
}

bootstrap();
