import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';
import { EffectComposer } from './libs/postprocessing/EffectComposer.js';
import { RenderPass } from './libs/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './libs/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './libs/postprocessing/ShaderPass.js';
import { VignetteShader } from './libs/postprocessing/VignetteShader.js';
import gsap from './libs/gsap.min.js';

const loadingOverlay = document.getElementById('loading');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0416, 0.06);

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
const keyLight = new THREE.PointLight(0x86a2ff, 1.3, 25, 1.8);
keyLight.position.set(4, 3, 3);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0xff9fd5, 0.9, 25, 2.0);
rimLight.position.set(-3, -4, -2);
scene.add(rimLight);

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
    id: 'ocr_sudoku',
    name: 'OCR Sudoku',
    file: 'assets/models/ocr_sudoku.gltf',
    description: 'Interface d’IA OCR capable de résoudre des grilles manuscrites grâce au traitement d’image et à la vision par ordinateur.',
    link: 'https://github.com/example/ocr-sudoku',
  },
  {
    id: 'semestre_bolivie',
    name: 'Semestre Bolivie',
    file: 'assets/models/semestre_bolivie.gltf',
    description: 'Journal visuel de mission universitaire en Bolivie — suivi terrain, reportage et mise en récit sensible.',
    link: 'https://github.com/example/semestre-bolivie',
  },
  {
    id: 'shell_posix',
    name: 'Shell POSIX',
    file: 'assets/models/shell_posix.gltf',
    description: 'Implémentation d’un shell POSIX minimaliste avec piping, redirections et scripts personnalisés.',
    link: 'https://github.com/example/shell-posix',
  },
  {
    id: 'retro_game_unity',
    name: 'Retro Game Unity',
    file: 'assets/models/retro_game_unity.gltf',
    description: 'Jeu Unity inspiré des consoles 90s avec shaders CRT, scoring arcade et animations low-poly.',
    link: 'https://github.com/example/retro-game-unity',
  },
  {
    id: 'stage_minarm',
    name: 'Stage MINARM',
    file: 'assets/models/stage_minarm.gltf',
    description: 'Prototype de mini-char autonome pour le ministère des Armées : navigation, capteurs inertiels, IHM embarquée.',
    link: 'https://github.com/example/stage-minarm',
  },
  {
    id: 'nebula_synth',
    name: 'Nebula Synth',
    file: 'assets/models/nebula_synth.gltf',
    description: 'Synthétiseur sonore WebGL génératif contrôlé par gestes — pads harmoniques, delays cosmiques.',
    link: 'https://github.com/example/nebula-synth',
  },
  {
    id: 'drone_mapper',
    name: 'Drone Mapper',
    file: 'assets/models/drone_mapper.gltf',
    description: 'Cartographie en temps réel par drone avec pipeline SLAM et alignement de nuages de points.',
    link: 'https://github.com/example/drone-mapper',
  },
  {
    id: 'holo_ui',
    name: 'Holo UI',
    file: 'assets/models/holo_ui.gltf',
    description: 'Suite d’interfaces holographiques modulaires pour cockpit spatial — design system et guidelines 3D.',
    link: 'https://github.com/example/holo-ui',
  },
  {
    id: 'atlas_cartography',
    name: 'Atlas Cartography',
    file: 'assets/models/atlas_cartography.gltf',
    description: 'Pipeline de cartographie interactive, rendu de reliefs planétaires et projection temps réel.',
    link: 'https://github.com/example/atlas-cartography',
  },
  {
    id: 'quantum_chess',
    name: 'Quantum Chess',
    file: 'assets/models/quantum_chess.gltf',
    description: 'Moteur de jeu en logique quantique avec superposition de coups et visualisation multi-timeline.',
    link: 'https://github.com/example/quantum-chess',
  },
  {
    id: 'titan_dashboard',
    name: 'Titan Dashboard',
    file: 'assets/models/titan_dashboard.gltf',
    description: 'Dashboard d’observatoire Titan : télémétrie, anomalies, suivi d’orbite en WebGL / WebXR.',
    link: 'https://github.com/example/titan-dashboard',
  },
  {
    id: 'aurora_shader',
    name: 'Aurora Shader',
    file: 'assets/models/aurora_shader.gltf',
    description: 'Suite de shaders temps réel pour reproduire des aurores boréales dynamiques et volumétriques.',
    link: 'https://github.com/example/aurora-shader',
  },
  {
    id: 'deep_research',
    name: 'Deep Research',
    file: 'assets/models/deep_research.gltf',
    description: 'Plateforme de fouille documentaire augmentée, recommandation contextuelle et interface 3D.',
    link: 'https://github.com/example/deep-research',
  },
  {
    id: 'terra_robotics',
    name: 'Terra Robotics',
    file: 'assets/models/terra_robotics.gltf',
    description: 'Robot de terrain autonome pour l’agriculture, navigation multi-capteurs et jumeau numérique.',
    link: 'https://github.com/example/terra-robotics',
  },
  {
    id: 'lidar_vision',
    name: 'Lidar Vision',
    file: 'assets/models/lidar_vision.gltf',
    description: 'Vision 3D LiDAR : segmentation sémantique, filtrage dynamique et rendu volumique colorisé.',
    link: 'https://github.com/example/lidar-vision',
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

function createProjectPopupTexture(project) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#120622';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, 'rgba(120, 140, 255, 0.3)');
  gradient.addColorStop(1, 'rgba(50, 10, 90, 0.8)');
  ctx.fillStyle = gradient;
  ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);
  ctx.strokeStyle = 'rgba(210, 220, 255, 0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
  ctx.fillStyle = '#f7f8ff';
  ctx.font = '64px "Segoe UI", sans-serif';
  ctx.fillText(project.name, 80, 130);
  ctx.font = '30px "Segoe UI", sans-serif';
  const textWidth = canvas.width - 160;
  const words = project.description.split(' ');
  let line = '';
  let y = 210;
  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > textWidth) {
      ctx.fillText(line.trim(), 80, y);
      line = word + ' ';
      y += 48;
    } else {
      line = testLine;
    }
  }
  if (line.trim().length) {
    ctx.fillText(line.trim(), 80, y);
  }
  ctx.font = '34px "Segoe UI", sans-serif';
  ctx.fillStyle = '#9dd6ff';
  ctx.fillText('Voir sur GitHub →', 80, canvas.height - 120);
  ctx.fillStyle = 'rgba(157, 214, 255, 0.35)';
  ctx.fillRect(60, canvas.height - 170, 360, 80);
  ctx.strokeStyle = 'rgba(157, 214, 255, 0.65)';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, canvas.height - 170, 360, 80);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createPopup(project) {
  const popupGroup = new THREE.Group();
  popupGroup.name = `popup-${project.id}`;
  const texture = createProjectPopupTexture(project);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), material);
  popupGroup.add(panel);
  const buttonGeometry = new THREE.PlaneGeometry(0.55, 0.12);
  const buttonMaterial = new THREE.MeshBasicMaterial({ color: 0x79b7ff, transparent: true, opacity: 0.0 });
  const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);
  buttonMesh.position.set(-0.45 + 0.55 / 2, -0.25, 0.01);
  buttonMesh.userData.openLink = project.link;
  popupGroup.add(buttonMesh);
  popupGroup.userData.button = buttonMesh;
  popupGroup.userData.project = project;
  popupGroup.visible = false;
  scene.add(popupGroup);
  return popupGroup;
}

const popups = new Map();
let activePopup = null;
const popupRaycaster = new THREE.Raycaster();

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
        node.material = node.material.clone();
        node.material.emissive = node.material.emissive || new THREE.Color(0x101026);
        node.material.emissiveIntensity = 0.35;
        meshes.push(node);
      }
    });
    const baseScale = 0.9;
    asset.scale.setScalar(baseScale);
    anchor.add(asset);

    const radius = 4.2;
    const pos = fibonacciSphere(index, projectsData.length, radius);
    anchor.position.copy(pos);
    orientTowardsCenter(anchor);

    anchor.userData = {
      project,
      asset,
      baseScale,
      focusTween: null,
      highlight: false,
      floatOffset: Math.random() * Math.PI * 2,
      rotationSpeed: THREE.MathUtils.randFloat(0.2, 0.45),
      meshes,
    };

    projectAnchors.push(anchor);
    projectTargets.push(anchor);
    scene.add(anchor);

    const popup = createPopup(project);
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
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    popupRaycaster.set(camera.getWorldPosition(new THREE.Vector3()), dir);
    const popup = activePopup;
    const intersections = popupRaycaster.intersectObjects([popup.userData.button], true);
    if (intersections.length > 0 && intersections[0].object.userData.openLink) {
      window.open(intersections[0].object.userData.openLink, '_blank');
    } else {
      closePopup();
    }
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
  popup.visible = true;
  toggleSlowMotion(true);
  gsap.fromTo(popup.scale, { x: 0.8, y: 0.8, z: 0.8 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'expo.out' });
}

function closePopup() {
  if (!activePopup) return;
  const popup = activePopup;
  activePopup = null;
  gsap.to(popup.scale, {
    x: 0.6,
    y: 0.6,
    z: 0.6,
    duration: 0.4,
    ease: 'expo.in',
    onComplete: () => {
      popup.visible = false;
      popup.scale.setScalar(1);
    },
  });
  toggleSlowMotion(false);
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

  if (activePopup) {
    const dir = camera.getWorldDirection(tempDir);
    const origin = camera.getWorldPosition(tempPos.set(0, 0, 0));
    activePopup.position.copy(origin).add(dir.multiplyScalar(1.6));
    activePopup.quaternion.copy(camera.quaternion);
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
  animate();
}

bootstrap();
