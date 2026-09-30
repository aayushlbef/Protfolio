import * as THREE from 'three';
import { animate, createTimeline, stagger } from 'animejs';

/* ==========================================================================
   ABOUT SECTION
   Owns a second WebGL scene (the hero already has one) and the anime.js
   reveal timeline. The render loop stops while the section is scrolled away so
   the hero and the certificate sheet are never starved of frames.
   ========================================================================== */

const aboutSection = document.getElementById('about');
const aboutFrame = document.getElementById('aboutFrame');
const aboutCanvas = document.getElementById('about-canvas');
const aboutParagraph = document.getElementById('aboutParagraph');
const aboutFocus = document.getElementById('aboutFocus');
const crosshair = document.getElementById('customCrosshair');

if (aboutSection && aboutFrame && aboutCanvas) {
  initAbout();
}

function initAbout() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const config = {
    lerpSpeed: 0.06,
    tiltSpeed: 0.05,
    particleCount: 68
  };

  const state = {
    pointerX: 0.5,
    pointerY: 0.5,
    targetX: 0.5,
    targetY: 0.5,
    lift: 0,
    targetLift: 0,
    scroll: 0,
    targetScroll: 0,
    aspect: 1
  };

  // The shader's wipe is tweened by the anime timeline below rather than lerped
  // in the render loop, so it stays in step with the DOM reveal and does not
  // depend on the frame rate.
  const enterProxy = { v: 0 };

  /* ------------------------------------------------------------------------
     TEXT SPLITTING
     Wrapped here rather than with anime's text splitter so the spans stay
     valid for the whole timeline: the splitter re-splits on resize and would
     orphan a stagger mid-flight.
     ---------------------------------------------------------------------- */
  const words = splitWords(aboutParagraph);
  const chars = Array.from(aboutSection.querySelectorAll('.about-char'));
  const tags = Array.from(aboutFocus?.querySelectorAll('.about-tag') ?? []);
  const facts = Array.from(aboutSection.querySelectorAll('.about-fact'));
  const eyebrow = aboutSection.querySelector('.about-eyebrow');
  const lede = aboutSection.querySelector('.about-lede');
  const actions = aboutSection.querySelector('.about-actions');
  const scanline = aboutSection.querySelector('.about-scanline');

  // Replaced by the reveal below; until then the section must not paint, or it
  // flashes fully-formed content for a frame before the timeline starts.
  if (!reduceMotion) aboutSection.classList.add('about--pre');

  /* ==========================================================================
     THREE.JS — PHOTO PLATE SCENE
     ========================================================================== */
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    38,
    1,
    0.1,
    100
  );
  camera.position.set(0, 0, 3);

  const renderer = new THREE.WebGLRenderer({
    canvas: aboutCanvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);

  const photoUrl = `${import.meta.env.BASE_URL}images/${encodeURIComponent('About Me.JPG')}`;

  const photoTexture = new THREE.TextureLoader().load(
    photoUrl,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.needsUpdate = true;
      photoUniforms.u_photoAspect.value = tex.image.width / tex.image.height;
      photoUniforms.u_photo.value = tex;
      aboutFrame.setAttribute('data-plate', 'ready');
    },
    undefined,
    () => aboutFrame.setAttribute('data-plate', 'error')
  );

  const photoUniforms = {
    u_photo: { value: photoTexture },
    u_photoAspect: { value: 0.5625 },
    u_frame: { value: new THREE.Vector2(1, 1) },
    u_pointer: { value: new THREE.Vector2(0.5, 0.5) },
    u_time: { value: 0 },
    u_enter: { value: 0 },
    u_lift: { value: 0 },
    // The frame is locked to the photo's own 9:16, so the cover fit below is a
    // no-op and nothing is cropped. Left adjustable in case the frame ratio
    // ever has to differ from the image's.
    u_bias: { value: new THREE.Vector2(0, 0) }
  };

  const photoGeometry = new THREE.PlaneGeometry(1, 1, 48, 48);

  const photoMaterial = new THREE.ShaderMaterial({
    uniforms: photoUniforms,
    vertexShader: `
      uniform vec2 u_pointer;
      uniform float u_time;
      uniform float u_enter;
      uniform float u_lift;

      varying vec2 vUv;

      void main() {
        vUv = uv;

        vec3 p = position;

        // Card flex - the plate bows towards the pointer, strongest dead centre
        float dome = sin(uv.x * 3.14159265) * sin(uv.y * 3.14159265);
        float reach = 1.0 - smoothstep(0.0, 0.8, distance(uv, u_pointer));
        p.z += dome * reach * u_lift * 0.17;

        // Barely-there idle wave so the surface reads as alive when untouched
        p.z += sin(uv.y * 6.2831853 + u_time * 0.7) * 0.007 * (0.3 + u_enter * 0.7);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D u_photo;
      uniform float u_photoAspect;
      uniform vec2 u_frame;
      uniform float u_time;
      uniform float u_enter;
      uniform vec2 u_bias;

      varying vec2 vUv;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // Cover fit: keeps the image filling the plate, cropping the overflow axis
      vec2 coverUv(vec2 uv, float frameAspect, float imgAspect) {
        vec2 c = (uv - 0.5 + u_bias) / 1.0;
        if (frameAspect < imgAspect) {
          c.x /= frameAspect / imgAspect;
        } else {
          c.y /= imgAspect / frameAspect;
        }
        return c + 0.5;
      }

      void main() {
        float frameAspect = u_frame.x / u_frame.y;
        vec2 uv = coverUv(vUv, frameAspect, u_photoAspect);

        // ── Diagonal reveal wipe, bottom-left to top-right ──────────────────
        // The only thing this does is lift the photo out of the dark as it
        // travels. Nothing about the pixels themselves is altered, so once the
        // wipe finishes what is on screen is the untouched original frame.
        float along = (1.0 - uv.y) * 0.55 + uv.x * 0.45;
        float front = mix(0.98, -0.30, u_enter);
        float reveal = smoothstep(front, front + 0.30, 1.0 - along);

        vec3 col = texture2D(u_photo, uv).rgb;
        col *= mix(0.45, 1.0, reveal);

        // Just enough grain to keep the soft gradients from banding
        col += (hash21(vUv * u_frame + u_time * 60.0) - 0.5) * 0.012;

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide
  });

  const photoPlate = new THREE.Mesh(photoGeometry, photoMaterial);
  scene.add(photoPlate);

  /* --------------------------------------------------------------------------
     FLOATING 0/1 GLYPHS - the hero's motif, scaled down around the plate
     -------------------------------------------------------------------------- */
  const glyphCount = config.particleCount;
  const glyphPos = new Float32Array(glyphCount * 3);
  const glyphKind = new Float32Array(glyphCount);
  const glyphSize = new Float32Array(glyphCount);
  const glyphPhase = new Float32Array(glyphCount);
  const glyphSpeed = new Float32Array(glyphCount);

  for (let i = 0; i < glyphCount; i++) {
    glyphPos[i * 3 + 0] = (Math.random() - 0.5) * 2.6;
    glyphPos[i * 3 + 1] = (Math.random() - 0.5) * 3.2;
    glyphPos[i * 3 + 2] = (Math.random() - 0.5) * 1.2 - 0.2;
    glyphKind[i] = Math.random() < 0.5 ? 0 : 1;
    glyphSize[i] = Math.random() * 0.7 + 0.5;
    glyphPhase[i] = Math.random() * Math.PI * 2;
    glyphSpeed[i] = Math.random() * 0.18 + 0.07;
  }

  const glyphGeo = new THREE.BufferGeometry();
  glyphGeo.setAttribute('position', new THREE.BufferAttribute(glyphPos, 3));
  glyphGeo.setAttribute('aGlyph', new THREE.BufferAttribute(glyphKind, 1));
  glyphGeo.setAttribute('aSize', new THREE.BufferAttribute(glyphSize, 1));
  glyphGeo.setAttribute('aPhase', new THREE.BufferAttribute(glyphPhase, 1));

  const glyphUniforms = {
    u_time: { value: 0 },
    u_enter: { value: 0 },
    u_atlas: { value: createGlyphTexture() }
  };

  const glyphs = new THREE.Points(
    glyphGeo,
    new THREE.ShaderMaterial({
      uniforms: glyphUniforms,
      vertexShader: `
        attribute float aGlyph;
        attribute float aSize;
        attribute float aPhase;
        uniform float u_time;
        uniform float u_enter;
        varying float vGlyph;
        varying float vFade;

        void main() {
          vGlyph = aGlyph;
          vFade = (0.35 + 0.65 * abs(sin(u_time * 1.5 + aPhase))) * (0.25 + 0.75 * u_enter);

          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * 34.0 * (0.6 + 0.4 * u_enter) / max(-mv.z, 0.001);
          gl_Position = projectionMatrix * mv;
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

          gl_FragColor = vec4(texel.rgb, texel.a * vFade * 0.7);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  scene.add(glyphs);

  /* ==========================================================================
     SIZING
     ========================================================================== */
  function resize() {
    const width = aboutFrame.clientWidth;
    const height = aboutFrame.clientHeight;
    if (!width || !height) return;

    state.aspect = width / height;
    camera.aspect = state.aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    photoUniforms.u_frame.value.set(width, height);

    const visibleHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const visibleWidth = visibleHeight * state.aspect;

    // Fills the frame edge to edge. At rest the plate sits at z = 0 and lands on
    // the frame's exact bounds; the push-in during the reveal scales it just
    // enough to cover the corners as it tilts, so the frame never shows through.
    photoPlate.scale.set(
      visibleWidth,
      visibleHeight,
      1
    );
  }

  const frameObserver = new ResizeObserver(resize);
  frameObserver.observe(aboutFrame);
  resize();

  /* ==========================================================================
     POINTER
     ========================================================================== */
  function onPointerMove(e) {
    const rect = aboutFrame.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    const inside = x >= -0.2 && x <= 1.2 && y >= -0.2 && y <= 1.2;

    state.targetX = Math.min(Math.max(x, 0), 1);
    state.targetY = Math.min(Math.max(y, 0), 1);
    state.targetLift = inside ? 1 : 0;
  }

  aboutFrame.addEventListener('pointermove', onPointerMove);
  aboutFrame.addEventListener('pointerenter', () => { state.targetLift = 1; });
  aboutFrame.addEventListener('pointerleave', () => { state.targetLift = 0; });

  /* ==========================================================================
     REVEAL TIMELINE (ANIME.JS)
     ========================================================================== */
  let revealed = false;

  function playReveal() {
    if (revealed) return;
    revealed = true;

    aboutSection.classList.remove('about--pre');

    if (reduceMotion) {
      enterProxy.v = 1;
      return;
    }

    const tl = createTimeline({ defaults: { ease: 'outExpo' } });

    tl.add(enterProxy, { v: 1, duration: 1500, ease: 'inOutQuad' }, 0)
      .add(eyebrow, {
        opacity: [0, 1],
        translateY: [18, 0],
        duration: 700
      }, 0)
      .add(chars, {
        opacity: [0, 1],
        translateY: [46, 0],
        duration: 900,
        delay: stagger(48)
      }, '-=470')
      .add(lede, {
        opacity: [0, 1],
        translateY: [22, 0],
        duration: 800
      }, '-=520')
      .add(aboutFrame, {
        opacity: [0, 1],
        scale: [0.94, 1],
        duration: 1100
      }, '-=820')
      .add(scanline, {
        opacity: [0, 1],
        top: ['-8%', '104%'],
        duration: 1250,
        ease: 'inOutQuad'
      }, '-=900')
      .add(words, {
        opacity: [0, 1],
        translateY: [15, 0],
        duration: 720,
        delay: stagger(14)
      }, '-=880')
      .add(tags, {
        opacity: [0, 1],
        translateY: [18, 0],
        scale: [0.9, 1],
        duration: 750,
        delay: stagger(70),
        ease: 'outElastic(1, 0.5)'
      }, '-=680')
      .add(facts, {
        opacity: [0, 1],
        translateX: [-18, 0],
        duration: 720,
        delay: stagger(90)
      }, '-=600')
      .add(actions, {
        opacity: [0, 1],
        translateY: [18, 0],
        duration: 700
      }, '-=520');
  }

  if (reduceMotion) {
    playReveal();
  } else {
    const revealObserver = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) playReveal(); },
      { threshold: 0.15 }
    );
    revealObserver.observe(aboutSection);
    // Belt-and-braces: if the observer never fires (odd viewport, no IO) the
    // section must not stay permanently invisible.
    window.setTimeout(playReveal, 4000);
  }

  /* ==========================================================================
     MICRO-INTERACTIONS
     ========================================================================== */
  tags.forEach((tag) => {
    tag.addEventListener('pointerenter', () => {
      animate(tag, { translateY: -3, duration: 260, ease: 'outQuad' });
    });
    tag.addEventListener('pointerleave', () => {
      animate(tag, { translateY: 0, duration: 420, ease: 'outElastic(1, 0.45)' });
    });
  });

  aboutSection.querySelectorAll('.about-btn, .about-tag').forEach((el) => {
    el.addEventListener('mouseenter', () => crosshair?.classList.add('hovering'));
    el.addEventListener('mouseleave', () => crosshair?.classList.remove('hovering'));
  });

  aboutSection.querySelectorAll('.about-btn').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * 0.22;
      const y = (e.clientY - rect.top - rect.height / 2) * 0.3;
      animate(btn, { translateX: x, translateY: y, duration: 240, ease: 'outQuad' });
    });

    btn.addEventListener('mouseleave', () => {
      animate(btn, {
        translateX: 0,
        translateY: 0,
        duration: 500,
        ease: 'outElastic(1, 0.4)'
      });
    });
  });

  /* ==========================================================================
     RENDER LOOP
     ========================================================================== */
  const clock = new THREE.Clock();
  let aboutVisible = true;

  new IntersectionObserver(
    ([entry]) => { aboutVisible = entry.isIntersecting; },
    { rootMargin: '120px' }
  ).observe(aboutFrame);

  function animateScene() {
    requestAnimationFrame(animateScene);
    if (!aboutVisible || document.hidden) return;

    const t = clock.getElapsedTime();

    // Scroll position is sampled here rather than from a scroll listener: the
    // loop already runs only while the frame is on screen, which is exactly
    // when the value is needed.
    const rect = aboutFrame.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    state.targetScroll = clamp(
      (vh * 0.5 - (rect.top + rect.height * 0.5)) / (vh * 0.5),
      -1.2,
      1.2
    );

    // Pointer and scroll inertia
    state.pointerX += (state.targetX - state.pointerX) * config.lerpSpeed;
    state.pointerY += (state.targetY - state.pointerY) * config.lerpSpeed;
    state.lift += (state.targetLift - state.lift) * config.lerpSpeed * 1.6;
    state.scroll += (state.targetScroll - state.scroll) * 0.05;

    photoUniforms.u_time.value = t;
    photoUniforms.u_enter.value = enterProxy.v;
    photoUniforms.u_lift.value = state.lift;
    photoUniforms.u_pointer.value.set(state.pointerX, state.pointerY);
    glyphUniforms.u_time.value = t;
    glyphUniforms.u_enter.value = enterProxy.v;

    // Parallax tilt on the plate, and a slow drift so it never sits dead still
    const targetRotY = (state.pointerX - 0.5) * 0.2;
    const targetRotX = -(state.pointerY - 0.5) * 0.16;
    photoPlate.rotation.y += (targetRotY - photoPlate.rotation.y) * config.tiltSpeed;
    photoPlate.rotation.x += (targetRotX - photoPlate.rotation.x) * config.tiltSpeed;
    photoPlate.rotation.z = state.scroll * 0.035;
    photoPlate.position.y = state.scroll * -0.16 + Math.sin(t * 1.1) * 0.018;
    photoPlate.position.z = enterProxy.v * 0.1;

    const positions = glyphGeo.attributes.position.array;
    for (let i = 0; i < glyphCount; i++) {
      positions[i * 3 + 1] += glyphSpeed[i] * 0.0028;
      positions[i * 3 + 0] += Math.sin(t * 0.45 + i) * 0.0012;
      if (positions[i * 3 + 1] > 1.7) positions[i * 3 + 1] = -1.7;
    }
    glyphGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animateScene();
}

/* ==========================================================================
   HELPERS
   ========================================================================== */
function splitWords(el) {
  if (!el) return [];
  const nodes = Array.from(el.childNodes);
  const spans = [];

  nodes.forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE) return;
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((chunk) => {
      if (!chunk) return;
      if (/^\s+$/.test(chunk)) {
        frag.appendChild(document.createTextNode(chunk));
        return;
      }
      const span = document.createElement('span');
      span.className = 'about-word';
      span.textContent = chunk;
      frag.appendChild(span);
      spans.push(span);
    });
    el.replaceChild(frag, node);
  });

  return spans;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

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
