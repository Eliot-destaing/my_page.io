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
console.log(camera);
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

const popupPanelVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const popupPanelFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColorTop;
  uniform vec3 uColorBottom;
  uniform vec3 uAccent;
  uniform float uAlpha;
  uniform float uGlow;

  void main() {
    vec2 uv = vUv;
    float rim = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float border = smoothstep(0.06, 0.0, rim);
    float glowRing = smoothstep(0.18, 0.0, abs(uv.y - 0.8));
    vec3 base = mix(uColorBottom, uColorTop, pow(uv.y, 1.1));
    base = mix(base, uAccent, border * 0.5 + glowRing * uGlow * 0.4);
    float alpha = uAlpha * (0.78 + border * 0.2);
    if (alpha <= 0.01) discard;
    gl_FragColor = vec4(base, alpha);
  }
`;

function createPopupPanelMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColorTop: { value: new THREE.Color(0x433580) },
      uColorBottom: { value: new THREE.Color(0x0b051a) },
      uAccent: { value: new THREE.Color(0x8fc0ff) },
      uAlpha: { value: 0.0 },
      uGlow: { value: 0.0 },
    },
    vertexShader: popupPanelVertexShader,
    fragmentShader: popupPanelFragmentShader,
  });
}

function createTextLabel({
  text,
  fontSize = 72,
  lineHeight = 1.25,
  color = '#ffffff',
  align = 'left',
  fontFamily = '"Segoe UI", "Montserrat", sans-serif',
  paddingX = 70,
  paddingY = 50,
  canvasWidth = 1400,
  targetWidth = 1.55,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  const words = text.split(' ');
  const lines = [];
  const maxLineWidth = canvasWidth - paddingX * 2;
  let currentLine = '';
  words.forEach(word => {
    const tentative = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(tentative);
    if (metrics.width > maxLineWidth && currentLine.length) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = tentative;
    }
  });
  if (currentLine.length) {
    lines.push(currentLine);
  }

  const lineHeightPx = fontSize * lineHeight;
  const totalHeight = Math.ceil(lines.length * lineHeightPx + paddingY * 2);
  canvas.height = totalHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const drawX =
    align === 'center' ? canvas.width / 2 : align === 'right' ? canvas.width - paddingX : paddingX;
  lines.forEach((line, index) => {
    ctx.fillText(line, drawX, paddingY + index * lineHeightPx);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 8);

  const aspect = canvas.height / canvas.width;
  const height = targetWidth * aspect;
  const geometry = new THREE.PlaneGeometry(targetWidth, height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 11;

  return { mesh, material, width: targetWidth, height };
}

function createPopup(project) {
  const popupGroup = new THREE.Group();
  popupGroup.name = `popup-${project.id}`;

  const panelMaterial = createPopupPanelMaterial();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.1), panelMaterial);
  panel.renderOrder = 10;
  panel.layers.enable(1);
  popupGroup.add(panel);

  const panelWidth = 1.9;
  const halfPanelWidth = panelWidth / 2;
  const panelHeight = 1.1;
  const topMargin = 0.18;
  const leftMargin = 0.18;
  const contentZ = 0.02;

  let cursorY = panelHeight / 2 - topMargin;
  const textMaterials = [];

  const titleLabel = createTextLabel({
    text: project.name,
    fontSize: 86,
    lineHeight: 1.08,
    color: '#f3f6ff',
    canvasWidth: 1500,
    paddingX: 90,
    paddingY: 60,
    targetWidth: 1.52,
  });
  titleLabel.mesh.position.set(
    -halfPanelWidth + leftMargin + titleLabel.width / 2,
    cursorY - titleLabel.height / 2,
    contentZ
  );
  popupGroup.add(titleLabel.mesh);
  textMaterials.push(titleLabel.material);
  cursorY -= titleLabel.height + 0.07;

  if (project.subtitle) {
    const subtitleLabel = createTextLabel({
      text: project.subtitle,
      fontSize: 52,
      lineHeight: 1.1,
      color: '#9fd0ff',
      canvasWidth: 1300,
      paddingX: 90,
      paddingY: 40,
      targetWidth: 1.45,
    });
    subtitleLabel.mesh.position.set(
      -halfPanelWidth + leftMargin + subtitleLabel.width / 2,
      cursorY - subtitleLabel.height / 2,
      contentZ
    );
    popupGroup.add(subtitleLabel.mesh);
    textMaterials.push(subtitleLabel.material);
    cursorY -= subtitleLabel.height + 0.08;
  }

  const bodyLabel = createTextLabel({
    text: project.description,
    fontSize: 48,
    lineHeight: 1.45,
    color: '#c6d6ff',
    canvasWidth: 1500,
    paddingX: 90,
    paddingY: 50,
    targetWidth: 1.52,
  });
  bodyLabel.mesh.position.set(
    -halfPanelWidth + leftMargin + bodyLabel.width / 2,
    cursorY - bodyLabel.height / 2,
    contentZ
  );
  popupGroup.add(bodyLabel.mesh);
  textMaterials.push(bodyLabel.material);

  const buttonBackground = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.24),
    new THREE.MeshBasicMaterial({
      color: 0x7ab8ff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );
  buttonBackground.position.set(0.0, -0.45, 0.01);
  buttonBackground.layers.enable(1);
  popupGroup.add(buttonBackground);

  const buttonOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.85, 0.24)),
    new THREE.LineBasicMaterial({
      color: 0xb3d9ff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  buttonOutline.position.set(0.0, -0.45, 0.012);
  buttonOutline.layers.enable(1);
  popupGroup.add(buttonOutline);

  const buttonLabel = createTextLabel({
    text: 'Voir sur GitHub',
    fontSize: 56,
    lineHeight: 1.0,
    color: '#e7f4ff',
    canvasWidth: 1024,
    paddingX: 40,
    paddingY: 36,
    targetWidth: 0.7,
    align: 'center',
  });
  buttonLabel.mesh.position.set(0.0, -0.45, 0.02);
  popupGroup.add(buttonLabel.mesh);
  textMaterials.push(buttonLabel.material);

  const buttonMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.24),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false })
  );
  buttonMesh.position.set(0.0, -0.45, 0.025);
  buttonMesh.userData.openLink = project.link;
  popupGroup.add(buttonMesh);

  buttonBackground.material.opacity = 0.0;
  buttonOutline.material.opacity = 0.0;

  popupGroup.userData = {
    button: buttonMesh,
    project,
    panelUniforms: panelMaterial.uniforms,
    buttonBackground,
    buttonOutline,
    textMaterials,
    tweens: [],
  };

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

function clearPopupTweens(popup) {
  if (!popup || !popup.userData || !popup.userData.tweens) return;
  popup.userData.tweens.forEach(tween => {
    if (tween) {
      tween.kill();
    }
  });
  popup.userData.tweens.length = 0;
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
      node.material.metalness = Math.min(node.material.metalness ?? 0.25, 0.35);
      node.material.roughness = Math.min(node.material.roughness ?? 0.85, 0.9);
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
  clearPopupTweens(popup);

  popup.scale.setScalar(1);
  const { panelUniforms, buttonBackground, buttonOutline, textMaterials } = popup.userData;
  panelUniforms.uAlpha.value = 0;
  panelUniforms.uGlow.value = 0;
  buttonBackground.material.opacity = 0.0;
  buttonOutline.material.opacity = 0.0;
  textMaterials.forEach(material => {
    material.opacity = 0.0;
  });

  const scaleTween = gsap.fromTo(
    popup.scale,
    { x: 0.82, y: 0.82, z: 0.82 },
    { x: 1, y: 1, z: 1, duration: 0.6, ease: 'expo.out' }
  );
  const panelFade = gsap.to(panelUniforms.uAlpha, {
    value: 1,
    duration: 0.55,
    ease: 'sine.out',
  });
  const glowLoop = gsap.to(panelUniforms.uGlow, {
    value: 0.9,
    duration: 1.8,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });
  const buttonPulse = gsap.to(buttonBackground.material, {
    opacity: 0.42,
    duration: 1.2,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });
  const outlinePulse = gsap.to(buttonOutline.material, {
    opacity: 0.7,
    duration: 1.2,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });
  const textFade = gsap.to(textMaterials, {
    opacity: 1,
    duration: 0.6,
    ease: 'sine.out',
    stagger: 0.08,
  });

  popup.userData.tweens.push(scaleTween, panelFade, glowLoop, buttonPulse, outlinePulse, textFade);
}

function closePopup() {
  if (!activePopup) return;
  const popup = activePopup;
  activePopup = null;
  clearPopupTweens(popup);

  const { panelUniforms, buttonBackground, buttonOutline, textMaterials } = popup.userData;

  const fadeOutPanel = gsap.to(panelUniforms.uAlpha, {
    value: 0,
    duration: 0.35,
    ease: 'expo.in',
    onComplete: () => {
      panelUniforms.uGlow.value = 0;
    },
  });
  const fadeTexts = gsap.to(textMaterials, {
    opacity: 0,
    duration: 0.25,
    ease: 'expo.in',
  });
  const fadeButton = gsap.to(buttonBackground.material, {
    opacity: 0,
    duration: 0.3,
    ease: 'sine.in',
  });
  const fadeOutline = gsap.to(buttonOutline.material, {
    opacity: 0,
    duration: 0.3,
    ease: 'sine.in',
  });
  const scaleTween = gsap.to(popup.scale, {
    x: 0.7,
    y: 0.7,
    z: 0.7,
    duration: 0.35,
    ease: 'expo.in',
    onComplete: () => {
      popup.visible = false;
      popup.scale.setScalar(1);
      textMaterials.forEach(material => {
        material.opacity = 0.0;
      });
    },
  });

  popup.userData.tweens.push(fadeOutPanel, fadeTexts, fadeButton, fadeOutline, scaleTween);
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
  if (projectAnchors.length) {
    alignCameraToTarget(projectAnchors[0].position);
    setFocus(projectAnchors[0]);
  }
  animate();
}

bootstrap();
