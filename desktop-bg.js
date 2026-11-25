/**
 * desktop-bg.js
 * Three.js animated desktop background — ported from the original hero section.
 *
 * Features:
 *   - Character portrait with flashlight reveal shader (with_mask / without_mask)
 *   - Floating binary "0"/"1" glyph particles (matrix rain)
 *   - Mouse-tracked torch and subtle parallax
 */

import * as THREE from 'three';

/* ==========================================================================
   CONFIGURATION
   ========================================================================== */
const config = {
  spotlightRadius: 0.32,
  spotlightFeather: 0.26,
  lerpSpeed: 0.06,
  particleCount: 140,
};

const state = {
  mouseX: window.innerWidth * 0.7,
  mouseY: window.innerHeight * 0.4,
  normMouseX: 0.7,
  normMouseY: 0.4,
  targetUV: new THREE.Vector2(0.65, 0.55),
  currentUV: new THREE.Vector2(0.65, 0.55),
};

/* ==========================================================================
   INIT — call once from main.js
   ========================================================================== */
export function initDesktopBackground() {
  const desktop = document.getElementById('desktop');
  if (!desktop) return;

  // Respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ── Create canvas ───────────────────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  canvas.id = 'desktop-bg-canvas';
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  desktop.prepend(canvas);

  /* ── Three.js basics ─────────────────────────────────────────────────── */
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    42,
    desktop.clientWidth / desktop.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 5.0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(desktop.clientWidth, desktop.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  /* ── Textures ────────────────────────────────────────────────────────── */
  const textureLoader = new THREE.TextureLoader();
  let characterMaterial = null;

  const texWithMask = textureLoader.load(
    `${import.meta.env.BASE_URL}images/with_mask.png`,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      if (characterMaterial) characterMaterial.needsUpdate = true;
    }
  );

  const texWithoutMask = textureLoader.load(
    `${import.meta.env.BASE_URL}images/without_mask.png`,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      if (characterMaterial) characterMaterial.needsUpdate = true;
    }
  );

  texWithMask.generateMipmaps = true;
  texWithMask.minFilter = THREE.LinearMipmapLinearFilter;
  texWithoutMask.generateMipmaps = true;
  texWithoutMask.minFilter = THREE.LinearMipmapLinearFilter;

  /* ── Character shader ────────────────────────────────────────────────── */
  const characterUniforms = {
    u_texMask: { value: texWithMask },
    u_texUnmask: { value: texWithoutMask },
    u_mouse: { value: state.currentUV },
    u_radius: { value: config.spotlightRadius },
    u_feather: { value: config.spotlightFeather },
    u_time: { value: 0 },
    u_active: { value: 1.0 },
  };

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vNormal = normalMatrix * normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D u_texMask;
    uniform sampler2D u_texUnmask;
    uniform vec2 u_mouse;
    uniform float u_radius;
    uniform float u_feather;
    uniform float u_time;
    uniform float u_active;
    varying vec2 vUv;

    float softFalloff(float d, float r, float f) {
      float t = clamp((d - (r - f)) / f, 0.0, 1.0);
      return 1.0 - (t * t * (3.0 - 2.0 * t));
    }

    void main() {
      float dist = distance(vUv, u_mouse);
      float reveal = softFalloff(dist, u_radius, u_feather) * u_active;
      float penumbra = softFalloff(dist, u_radius * 1.55, u_feather * 1.8) * 0.35;
      float totalReveal = clamp(reveal + penumbra * (1.0 - reveal), 0.0, 1.0);

      vec4 colMask   = texture2D(u_texMask,   vUv);
      vec4 colUnmask = texture2D(u_texUnmask, vUv);

      float alpha = mix(colMask.a, colUnmask.a, totalReveal);
      if (alpha < 0.01) discard;

      vec4 baseColor = mix(colMask, colUnmask, totalReveal);

      float shadowFactor = mix(0.82, 1.0, reveal);
      float centreBright = (1.0 - smoothstep(0.0, u_radius * 0.75, dist)) * 0.10;
      float brightness   = 1.0 + centreBright * reveal;

      float edgeDist  = abs(dist - (u_radius - u_feather * 0.4));
      float edgeGlow  = (1.0 - smoothstep(0.0, u_feather * 0.9, edgeDist)) * 0.06 * reveal;
      vec3  edgeColor = vec3(0.92, 0.96, 1.0) * edgeGlow;

      baseColor.rgb *= shadowFactor * brightness;
      baseColor.rgb += edgeColor;

      float bottomFade = smoothstep(0.0, 0.12, vUv.y);
      gl_FragColor = vec4(baseColor.rgb, baseColor.a * bottomFade);
    }
  `;

  characterMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: characterUniforms,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });

  /* ── Responsive sizing helpers ───────────────────────────────────────── */
  function computeVisible(depth = 0) {
    const vFOV = (camera.fov * Math.PI) / 180;
    const h = 2 * Math.tan(vFOV / 2) * (camera.position.z - depth);
    const w = h * (desktop.clientWidth / desktop.clientHeight);
    return { width: w, height: h };
  }

  let vis = computeVisible();
  const isMobile = desktop.clientWidth < 900;
  let pSize = isMobile
    ? Math.min(vis.height * 0.65, vis.width * 0.85)
    : Math.min(vis.height * 0.96, vis.width * 0.52);
  let basePosY = isMobile ? vis.height * 0.05 : -vis.height * 0.02;

  let charGeo = new THREE.PlaneGeometry(pSize, pSize, 32, 32);
  const charMesh = new THREE.Mesh(charGeo, characterMaterial);
  charMesh.position.set(0, basePosY, 0); // centred
  scene.add(charMesh);

  /* ── Floating binary particles ───────────────────────────────────────── */
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(config.particleCount * 3);
  const glyphs = new Float32Array(config.particleCount);
  const sizes = new Float32Array(config.particleCount);
  const phases = new Float32Array(config.particleCount);
  const speeds = new Float32Array(config.particleCount);

  for (let i = 0; i < config.particleCount; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * vis.width * 1.4;
    positions[i * 3 + 1] = (Math.random() - 0.5) * vis.height * 1.3;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
    glyphs[i] = Math.random() < 0.5 ? 0 : 1;
    sizes[i] = Math.random() * 1.0 + 0.8;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = Math.random() * 0.4 + 0.2;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('aGlyph', new THREE.BufferAttribute(glyphs, 1));
  particleGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  particleGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  /* Create glyph texture atlas (0 and 1) */
  function createGlyphTexture() {
    const cell = 64;
    const c = document.createElement('canvas');
    c.width = cell * 2;
    c.height = cell;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(cell * 0.7)}px "JetBrains Mono", monospace`;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('0', cell * 0.5, cell * 0.54);
    ctx.fillText('1', cell * 1.5, cell * 0.54);
    return new THREE.CanvasTexture(c);
  }

  const particleUniforms = {
    u_time: { value: 0 },
    u_atlas: { value: createGlyphTexture() },
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
        uv.x = uv.x * 0.5 + step(0.5, vGlyph) * 0.5;
        uv.y = 1.0 - uv.y;
        vec4 texel = texture2D(u_atlas, uv);
        if (texel.a < 0.05) discard;
        gl_FragColor = vec4(texel.rgb, texel.a * vFade * 0.85);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  scene.add(new THREE.Points(particleGeo, particleMat));

  /* ── Mouse tracking ──────────────────────────────────────────────────── */
  const raycaster = new THREE.Raycaster();
  const mathPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  function onPointerMove(clientX, clientY) {
    const rect = desktop.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    state.normMouseX = sx / rect.width;
    state.normMouseY = sy / rect.height;

    const ndcX = (sx / rect.width) * 2 - 1;
    const ndcY = -(sy / rect.height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    raycaster.ray.intersectPlane(mathPlane, hit);

    const half = pSize * 0.5;
    state.targetUV.set(
      (hit.x - (charMesh.position.x - half)) / pSize,
      (hit.y - (charMesh.position.y - half)) / pSize
    );
  }

  window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY), {
    passive: true,
  });
  window.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 0) onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );

  /* ── Resize ──────────────────────────────────────────────────────────── */
  function onResize() {
    const w = desktop.clientWidth;
    const h = desktop.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    vis = computeVisible();
    const mob = w < 900;
    pSize = mob
      ? Math.min(vis.height * 0.65, vis.width * 0.85)
      : Math.min(vis.height * 0.96, vis.width * 0.52);
    basePosY = mob ? vis.height * 0.05 : -vis.height * 0.02;

    charGeo.dispose();
    charGeo = new THREE.PlaneGeometry(pSize, pSize, 32, 32);
    charMesh.geometry = charGeo;
    charMesh.position.set(0, basePosY, 0); // centred
  }

  window.addEventListener('resize', onResize);

  /* ── Render loop ─────────────────────────────────────────────────────── */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    if (document.hidden) return;

    const t = clock.getElapsedTime();

    // Smooth torch interpolation
    state.currentUV.x += (state.targetUV.x - state.currentUV.x) * config.lerpSpeed;
    state.currentUV.y += (state.targetUV.y - state.currentUV.y) * config.lerpSpeed;
    characterUniforms.u_mouse.value.copy(state.currentUV);
    characterUniforms.u_time.value = t;

    // Parallax tilt
    charMesh.rotation.y += ((state.normMouseX - 0.5) * 0.14 - charMesh.rotation.y) * 0.05;
    charMesh.rotation.x += (-(state.normMouseY - 0.5) * 0.10 - charMesh.rotation.x) * 0.05;
    charMesh.position.y = basePosY + Math.sin(t * 1.4) * 0.025;

    // Camera parallax
    camera.position.x += ((state.normMouseX - 0.5) * 0.15 - camera.position.x) * 0.04;
    camera.position.y += (-(state.normMouseY - 0.5) * 0.12 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    // Particle animation
    particleUniforms.u_time.value = t;
    const pos = particleGeo.attributes.position.array;
    for (let i = 0; i < config.particleCount; i++) {
      pos[i * 3 + 1] += speeds[i] * 0.003;
      pos[i * 3 + 0] += Math.sin(t * 0.5 + i) * 0.001;
      if (pos[i * 3 + 1] > vis.height * 0.7) {
        pos[i * 3 + 1] = -vis.height * 0.7;
      }
    }
    particleGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  onResize();
  animate();
}
