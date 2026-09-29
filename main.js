import * as THREE from 'three';
import { animate, createTimeline, stagger } from 'animejs';

/* ==========================================================================
   STATE & CONFIGURATION
   ========================================================================== */
const config = {
  spotlightRadius: 0.32,
  spotlightFeather: 0.26,
  lerpSpeed: 0.06,
  parallaxStrength: 0.25,
  particleCount: 140
};

const state = {
  mouseX: window.innerWidth * 0.7,
  mouseY: window.innerHeight * 0.4,
  normMouseX: 0.7,
  normMouseY: 0.4,
  targetUV: new THREE.Vector2(0.65, 0.55),
  currentUV: new THREE.Vector2(0.65, 0.55),
  isHoveringCanvas: true,
  audioContext: null
};

/* ==========================================================================
   DOM REFERENCES
   ========================================================================== */
const canvas = document.getElementById('webgl-canvas');
const heroFrame = document.querySelector('.hero-frame');
const heroTitle = document.getElementById('heroTitle');
const heroDesc = document.getElementById('heroDesc');
const menuBtn = document.getElementById('menuBtn');
const menuOverlay = document.getElementById('menuOverlay');
const drawerClose = document.getElementById('drawerClose');

/* ==========================================================================
   WEB AUDIO API SOUND FX (Futuristic Haptic Feedback)
   ========================================================================== */
function initAudio() {
  if (!state.audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    state.audioContext = new AudioCtx();
  }
  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }
}

// Browsers keep an AudioContext suspended until a real user gesture. Unlock it
// on the first one so hover SFX work immediately, not just after a click.
function unlockAudio() {
  initAudio();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
  window.removeEventListener('touchstart', unlockAudio);
}
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);
window.addEventListener('touchstart', unlockAudio, { passive: true });

function playSfx(type = 'hover') {
  try {
    initAudio();
    // A suspended context has a frozen clock, so nothing would be audible
    if (!state.audioContext || state.audioContext.state !== 'running') return;

    const osc = state.audioContext.createOscillator();
    const gain = state.audioContext.createGain();
    const now = state.audioContext.currentTime;

    osc.connect(gain);
    gain.connect(state.audioContext.destination);

    if (type === 'hover') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.06);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'reveal') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.linearRampToValueAtTime(360, now + 0.2);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (e) {
    // Audio context may require user gesture
  }
}

/* ==========================================================================
   THREE.JS 3D SCENE SETUP
   ========================================================================== */
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 5.0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setSize(heroFrame.clientWidth, heroFrame.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Texture Loader with explicit load callbacks
const textureLoader = new THREE.TextureLoader();

let characterMaterial = null;

const texWithMask = textureLoader.load(
  `${import.meta.env.BASE_URL}images/with_mask.png`,
  (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    if (characterMaterial) characterMaterial.needsUpdate = true;
    console.log('With-mask texture loaded successfully:', tex.image.width, 'x', tex.image.height);
  },
  undefined,
  (err) => console.error('Error loading with_mask.png:', err)
);

const texWithoutMask = textureLoader.load(
  `${import.meta.env.BASE_URL}images/without_mask.png`,
  (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    if (characterMaterial) characterMaterial.needsUpdate = true;
    console.log('Without-mask texture loaded successfully:', tex.image.width, 'x', tex.image.height);
  },
  undefined,
  (err) => console.error('Error loading without_mask.png:', err)
);

texWithMask.generateMipmaps = true;
texWithMask.minFilter = THREE.LinearMipmapLinearFilter;
texWithoutMask.generateMipmaps = true;
texWithoutMask.minFilter = THREE.LinearMipmapLinearFilter;

/* --------------------------------------------------------------------------
   HERO PORTRAIT MESH & FLASHLIGHT REVEAL SHADER
   -------------------------------------------------------------------------- */
const characterUniforms = {
  u_texMask: { value: texWithMask },
  u_texUnmask: { value: texWithoutMask },
  u_mouse: { value: state.currentUV },
  u_radius: { value: config.spotlightRadius },
  u_feather: { value: config.spotlightFeather },
  u_time: { value: 0 },
  u_active: { value: 1.0 }
};

const characterVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const characterFragmentShader = `
  uniform sampler2D u_texMask;
  uniform sampler2D u_texUnmask;
  uniform vec2 u_mouse;
  uniform float u_radius;
  uniform float u_feather;
  uniform float u_time;
  uniform float u_active;

  varying vec2 vUv;

  // Smooth cubic falloff — much softer than smoothstep
  float softFalloff(float d, float r, float f) {
    float t = clamp((d - (r - f)) / f, 0.0, 1.0);
    return 1.0 - (t * t * (3.0 - 2.0 * t));
  }

  void main() {
    float dist = distance(vUv, u_mouse);

    // Primary reveal mask — large soft edge so circle boundary is invisible
    float reveal = softFalloff(dist, u_radius, u_feather);
    reveal *= u_active;

    // Secondary wide penumbra — adds a second, even softer halo of partial reveal
    // so the transition isn't a sudden jump from dark to light
    float penumbra = softFalloff(dist, u_radius * 1.55, u_feather * 1.8) * 0.35;
    float totalReveal = clamp(reveal + penumbra * (1.0 - reveal), 0.0, 1.0);

    vec4 colMask   = texture2D(u_texMask,   vUv);
    vec4 colUnmask = texture2D(u_texUnmask, vUv);

    float alpha = mix(colMask.a, colUnmask.a, totalReveal);
    if (alpha < 0.01) discard;

    // Cross-fade textures based on combined reveal
    vec4 baseColor = mix(colMask, colUnmask, totalReveal);

    // ── Realistic flashlight lighting ──────────────────────────────────────
    // 1. Outside-beam: gradually shadow the masked image so it looks naturally
    //    dark / unlit rather than just dimmed uniformly
    float shadowFactor = mix(0.82, 1.0, reveal);

    // 2. Inside-beam: a very gentle neutral brightness lift (no colour cast)
    //    mimicking a slightly over-exposed camera flash centre
    float centreBright = (1.0 - smoothstep(0.0, u_radius * 0.75, dist)) * 0.10;
    float brightness   = 1.0 + centreBright * reveal;

    // 3. Edge scatter — an extremely faint, near-white halo right at the
    //    transition zone (like lens scatter, not a golden ring)
    float edgeDist  = abs(dist - (u_radius - u_feather * 0.4));
    float edgeGlow  = (1.0 - smoothstep(0.0, u_feather * 0.9, edgeDist)) * 0.06 * reveal;
    vec3  edgeColor = vec3(0.92, 0.96, 1.0) * edgeGlow; // cool-white scatter

    baseColor.rgb *= shadowFactor * brightness;
    baseColor.rgb += edgeColor;
    // ───────────────────────────────────────────────────────────────────────

    // Soft bottom fade to blend portrait into footer
    float bottomFade = smoothstep(0.0, 0.12, vUv.y);

    gl_FragColor = vec4(baseColor.rgb, baseColor.a * bottomFade);
  }
`;

characterMaterial = new THREE.ShaderMaterial({
  vertexShader: characterVertexShader,
  fragmentShader: characterFragmentShader,
  uniforms: characterUniforms,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  depthTest: false
});

// Calculate responsive plane geometry
function computeVisibleDimensions(depth = 0) {
  const vFOV = (camera.fov * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(vFOV / 2) * (camera.position.z - depth);
  const aspect = heroFrame.clientWidth / heroFrame.clientHeight;
  const visibleWidth = visibleHeight * aspect;
  return { width: visibleWidth, height: visibleHeight };
}

let currentVisible = computeVisibleDimensions(0);
const isInitialMobile = heroFrame.clientWidth < 900;
let currentPortraitSize = isInitialMobile 
  ? Math.min(currentVisible.height * 0.65, currentVisible.width * 0.85) 
  : Math.min(currentVisible.height * 0.96, currentVisible.width * 0.52);
let currentBasePosY = isInitialMobile ? currentVisible.height * 0.05 : -currentVisible.height * 0.02;

const characterGeometry = new THREE.PlaneGeometry(currentPortraitSize, currentPortraitSize, 32, 32);
const characterMesh = new THREE.Mesh(characterGeometry, characterMaterial);

// Position character on the right side of the hero section
const initialPosX = isInitialMobile ? 0 : currentVisible.width * 0.22;
characterMesh.position.set(initialPosX, currentBasePosY, 0);
scene.add(characterMesh);

/* --------------------------------------------------------------------------
   FLOATING 3D PARTICLES (Binary "0" / "1" glyph rain)
   -------------------------------------------------------------------------- */
const particleGeo = new THREE.BufferGeometry();
const particlePos = new Float32Array(config.particleCount * 3);
const particleGlyph = new Float32Array(config.particleCount); // 0 -> "0", 1 -> "1"
const particleSize = new Float32Array(config.particleCount);
const particlePhase = new Float32Array(config.particleCount);
const particleSpeed = new Float32Array(config.particleCount);

for (let i = 0; i < config.particleCount; i++) {
  particlePos[i * 3 + 0] = (Math.random() - 0.5) * currentVisible.width * 1.4;
  particlePos[i * 3 + 1] = (Math.random() - 0.5) * currentVisible.height * 1.3;
  particlePos[i * 3 + 2] = (Math.random() - 0.5) * 2.5;

  particleGlyph[i] = Math.random() < 0.5 ? 0 : 1;
  particleSize[i] = Math.random() * 1.0 + 0.8;
  particlePhase[i] = Math.random() * Math.PI * 2;
  particleSpeed[i] = Math.random() * 0.4 + 0.2;
}

particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
particleGeo.setAttribute('aGlyph', new THREE.BufferAttribute(particleGlyph, 1));
particleGeo.setAttribute('aSize', new THREE.BufferAttribute(particleSize, 1));
particleGeo.setAttribute('aPhase', new THREE.BufferAttribute(particlePhase, 1));

// 2-cell atlas: left half = "0", right half = "1"
function createGlyphTexture() {
  const cell = 64;
  const pCanvas = document.createElement('canvas');
  pCanvas.width = cell * 2;
  pCanvas.height = cell;
  const ctx = pCanvas.getContext('2d');
  ctx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(cell * 0.7)}px "JetBrains Mono", monospace`;
  ctx.shadowColor = 'rgba(60, 210, 130, 0.9)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#7dffb4';
  ctx.fillText('0', cell * 0.5, cell * 0.54);
  ctx.fillText('1', cell * 1.5, cell * 0.54);
  return new THREE.CanvasTexture(pCanvas);
}

const particleUniforms = {
  u_time: { value: 0 },
  u_atlas: { value: createGlyphTexture() }
};

const particleMat = new THREE.ShaderMaterial({
  uniforms: particleUniforms,
  vertexShader: `
    attribute float aGlyph;
    attribute float aSize;
    attribute float aPhase;
    uniform float u_time;
    varying float vGlyph;
    varying float vFade;

    void main() {
      vGlyph = aGlyph;
      // Flicker each glyph at its own rate for a CRT / matrix feel
      vFade = 0.45 + 0.55 * abs(sin(u_time * 1.6 + aPhase));

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * 60.0 / max(-mvPosition.z, 0.001);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform sampler2D u_atlas;
    varying float vGlyph;
    varying float vFade;

    void main() {
      vec2 uv = gl_PointCoord;
      // Pick the glyph cell, then flip V (gl_PointCoord origin is bottom-left)
      uv.x = uv.x * 0.5 + step(0.5, vGlyph) * 0.5;
      uv.y = 1.0 - uv.y;

      vec4 texel = texture2D(u_atlas, uv);
      if (texel.a < 0.05) discard;

      gl_FragColor = vec4(texel.rgb, texel.a * vFade * 0.85);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

/* ==========================================================================
   INTERACTION: MOUSE & TORCH TRACKING
   ========================================================================== */
const raycaster = new THREE.Raycaster();
const mathPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const rayIntersectPoint = new THREE.Vector3();

const cursorGlow = document.getElementById('cursorGlow');
const customCrosshair = document.getElementById('customCrosshair');

function updateTorchCoordinates(clientX, clientY) {
  const rect = heroFrame.getBoundingClientRect();
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;

  state.mouseX = screenX;
  state.mouseY = screenY;

  // Update custom crosshair & glow follower
  if (cursorGlow) {
    cursorGlow.style.transform = `translate3d(${clientX}px, ${clientY}px, 0)`;
  }
  if (customCrosshair) {
    customCrosshair.style.transform = `translate3d(${clientX}px, ${clientY}px, 0)`;
  }

  // Normalized Device Coordinates (-1 to +1)
  const ndcX = (screenX / rect.width) * 2 - 1;
  const ndcY = -(screenY / rect.height) * 2 + 1;

  state.normMouseX = screenX / rect.width;
  state.normMouseY = screenY / rect.height;

  // Raycast to character plane in 3D
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  raycaster.ray.intersectPlane(mathPlane, rayIntersectPoint);

  // Convert ray intersection into UV coordinates on character mesh
  const halfSize = currentPortraitSize * 0.5;
  const u = (rayIntersectPoint.x - (characterMesh.position.x - halfSize)) / currentPortraitSize;
  const v = (rayIntersectPoint.y - (characterMesh.position.y - halfSize)) / currentPortraitSize;

  state.targetUV.set(u, v);
}

// Global window mousemove
window.addEventListener('mousemove', (e) => {
  updateTorchCoordinates(e.clientX, e.clientY);
});

// Touch support for mobile / tablets
window.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    updateTorchCoordinates(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: true });

/* ==========================================================================
   MAGNETIC BUTTONS INTERACTION
   ========================================================================== */
const magneticButtons = document.querySelectorAll('.magnetic-btn, .social-btn, .nav-link');

magneticButtons.forEach((btn) => {
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    animate(btn, {
      translateX: x * 0.35,
      translateY: y * 0.35,
      duration: 250,
      ease: 'outQuad'
    });
  });

  btn.addEventListener('mouseenter', () => playSfx('hover'));

  btn.addEventListener('mouseleave', () => {
    animate(btn, {
      translateX: 0,
      translateY: 0,
      duration: 400,
      ease: 'outElastic(1, 0.4)'
    });
  });
});

/* Helper: rebuild hero title letter-spans */
function setHeroTitle(text) {
  heroTitle.innerHTML = '';
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.className = 'char-span';
    span.textContent = text[i];
    heroTitle.appendChild(span);
  }
}

/* ==========================================================================
   NAVIGATION TABS
   ========================================================================== */
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    playSfx('click');
    navLinks.forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
  });
});

/* ==========================================================================
   MENU OVERLAY
   ========================================================================== */
menuBtn.addEventListener('click', () => {
  playSfx('click');
  menuOverlay.classList.add('open');
});

drawerClose.addEventListener('click', () => {
  playSfx('click');
  menuOverlay.classList.remove('open');
});

menuOverlay.addEventListener('click', (e) => {
  if (e.target === menuOverlay) {
    menuOverlay.classList.remove('open');
  }
});

// ESC key to close modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    menuOverlay.classList.remove('open');
  }
});

/* ==========================================================================
   ENTRANCE CINEMATIC TIMELINE (ANIME.JS)
   ========================================================================== */
function runEntranceAnimation() {
  const tl = createTimeline({
    defaults: {
      ease: 'outExpo',
      duration: 1000
    }
  });

  tl.add('.header', {
    opacity: [0, 1],
    translateY: [-30, 0],
    duration: 850
  })
  .add('.char-span', {
    opacity: [0, 1],
    translateY: [60, 0],
    duration: 900,
    delay: stagger(50)
  }, '-=550')
  .add('.hero-description', {
    opacity: [0, 1],
    translateY: [25, 0],
    duration: 800
  }, '-=500')
  .add('.hero-actions .magnetic-btn', {
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 700,
    delay: stagger(100)
  }, '-=450')
  .add('.hero-footer', {
    opacity: [0, 1],
    translateY: [25, 0],
    duration: 800
  }, '-=450');
}

/* ==========================================================================
   WINDOW RESIZE HANDLER
   ========================================================================== */
function onWindowResize() {
  const width = heroFrame.clientWidth;
  const height = heroFrame.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  currentVisible = computeVisibleDimensions(0);
  const isMobile = width < 900;
  currentPortraitSize = isMobile 
    ? Math.min(currentVisible.height * 0.65, currentVisible.width * 0.85) 
    : Math.min(currentVisible.height * 0.96, currentVisible.width * 0.52);
  
  const posX = isMobile ? 0 : currentVisible.width * 0.22;
  currentBasePosY = isMobile ? currentVisible.height * 0.05 : -currentVisible.height * 0.02;

  characterGeometry.dispose();
  characterMesh.geometry = new THREE.PlaneGeometry(currentPortraitSize, currentPortraitSize, 32, 32);
  characterMesh.position.set(posX, currentBasePosY, 0);
}

window.addEventListener('resize', onWindowResize);

/* ==========================================================================
   HOVER INTERACTIONS FOR CURSOR
   ========================================================================== */
document.querySelectorAll('button, a, .magnetic-btn, .nav-link, .persona-toggle-btn').forEach((el) => {
  el.addEventListener('mouseenter', () => {
    customCrosshair?.classList.add('hovering');
  });
  el.addEventListener('mouseleave', () => {
    customCrosshair?.classList.remove('hovering');
  });
});

/* ==========================================================================
   RENDER ANIMATION LOOP
   ========================================================================== */
const clock = new THREE.Clock();

// The hero is a full WebGL scene and the certificate viewer is another one.
// Rendering both at once starves the second of them, so the hero's loop stops
// while it is scrolled out of view and picks up where it left off on return.
let heroVisible = true;
if (typeof IntersectionObserver !== 'undefined') {
  new IntersectionObserver(
    ([entry]) => { heroVisible = entry.isIntersecting; },
    { rootMargin: '120px' }
  ).observe(heroFrame);
}

function animateScene() {
  requestAnimationFrame(animateScene);

  if (!heroVisible || document.hidden) return;

  const elapsedTime = clock.getElapsedTime();

  // 1. Smoothly interpolate spotlight UV toward target mouse position (Torch Inertia)
  state.currentUV.x += (state.targetUV.x - state.currentUV.x) * config.lerpSpeed;
  state.currentUV.y += (state.targetUV.y - state.currentUV.y) * config.lerpSpeed;
  characterUniforms.u_mouse.value.copy(state.currentUV);

  // 2. Uniform time updates
  characterUniforms.u_time.value = elapsedTime;

  // 3. 3D Parallax Tilt on Character Mesh
  const targetRotY = (state.normMouseX - 0.5) * 0.14;
  const targetRotX = -(state.normMouseY - 0.5) * 0.10;
  characterMesh.rotation.y += (targetRotY - characterMesh.rotation.y) * 0.05;
  characterMesh.rotation.x += (targetRotX - characterMesh.rotation.x) * 0.05;

  // Subtle breathing float on character mesh
  characterMesh.position.y = currentBasePosY + Math.sin(elapsedTime * 1.4) * 0.025;

  // 4. Subtle camera parallax
  camera.position.x += ((state.normMouseX - 0.5) * 0.15 - camera.position.x) * 0.04;
  camera.position.y += (-(state.normMouseY - 0.5) * 0.12 - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  // 5. Animate floating 3D glyph particles
  particleUniforms.u_time.value = elapsedTime;
  const positions = particleGeo.attributes.position.array;
  for (let i = 0; i < config.particleCount; i++) {
    positions[i * 3 + 1] += particleSpeed[i] * 0.003;
    positions[i * 3 + 0] += Math.sin(elapsedTime * 0.5 + i) * 0.001;

    // Reset particle to bottom when it drifts off top
    if (positions[i * 3 + 1] > currentVisible.height * 0.7) {
      positions[i * 3 + 1] = -currentVisible.height * 0.7;
    }
  }
  particleGeo.attributes.position.needsUpdate = true;

  // Render scene
  renderer.render(scene, camera);
}

// Start
onWindowResize();
animateScene();
runEntranceAnimation();

