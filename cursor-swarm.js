/**
 * cursor-swarm.js
 * Viral "Multiplayer Cursor Swarm" page-builder animation.
 *
 * Features:
 * - 14 Figma-style colored cursors with floating pill nametags (max 6 on mobile < 640px)
 * - Smooth spring-physics motion loop (60 FPS, transform: translate3d)
 * - Build-on-scroll / section-open via IntersectionObserver:
 *     * Containers & Cards: Figma bounding box + corner handles + dimension pill
 *     * Headings & Text: Fast smooth reveal with cursor tracking the line
 *     * Images & Media: Top-to-bottom wireframe scanline reveal with corner cursor
 * - Interactive trailing when moving real mouse, gentle orbit ring after 1.5s idle
 */

const AGENT_CONFIGS = [
  { name: 'Design Agent', color: '#FF5733' },
  { name: 'UI Bot',       color: '#33FF57' },
  { name: 'Layout AI',    color: '#3357FF' },
  { name: 'Copywriter',   color: '#F333FF' },
  { name: 'Motion',       color: '#FFB833' },
  { name: 'Grid Bot',     color: '#00D4FF' },
  { name: 'Shader AI',    color: '#FF3385' },
  { name: 'Typo AI',      color: '#38BDF8' },
  { name: 'Asset Bot',    color: '#A855F7' },
  { name: 'Pixel AI',     color: '#22C55E' },
  { name: 'Style Bot',    color: '#F97316' },
  { name: 'Sync AI',      color: '#EAB308' },
  { name: 'Flow Bot',     color: '#EC4899' },
  { name: 'Core AI',      color: '#14B8A6' },
];

const SELECTORS = {
  containers:
    '.about-profile-card, .about-card, .project-card, .cert-card, .skill-category, .timeline-item, .contact-link, .contact-form, .desktop-icon',
  texts:
    '.section-title, .about-name, .about-card h4, .about-bio-card p, .about-goals-card p, .project-info h3, .cert-info h4, .contact-heading, .contact-desc, .timeline-content h3',
  images:
    '.about-avatar, .project-preview img, .cert-preview img',
};

function createCursorSVG(color) {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4.5 2.5L19.5 11.2L12.1 13.1L8.9 19.8L4.5 2.5Z" fill="${color}" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

export function initCursorSwarm() {
  if (typeof window === 'undefined') return null;

  // Create non-blocking overlay
  const overlay = document.createElement('div');
  overlay.className = 'swarm-overlay';
  overlay.id = 'swarmOverlay';
  overlay.setAttribute('aria-hidden', 'true');

  const wireframeLayer = document.createElement('div');
  wireframeLayer.className = 'swarm-wireframes';
  overlay.appendChild(wireframeLayer);

  const cursorLayer = document.createElement('div');
  cursorLayer.className = 'swarm-cursors';
  overlay.appendChild(cursorLayer);

  document.body.appendChild(overlay);

  // State
  let isMobile = window.innerWidth < 640;
  let activeCount = isMobile ? 6 : 14;
  let mouseX = window.innerWidth * 0.5;
  let mouseY = window.innerHeight * 0.5;
  let lastMouseMoveAt = performance.now() - 2000; // start in gentle orbit until user moves mouse
  let hasMouseMoved = false;
  let rafId = null;

  const builtElements = new WeakSet();
  const observedSections = new WeakSet();

  // Build agent pool (always create 14, toggle visibility based on breakpoint)
  const agents = AGENT_CONFIGS.map((cfg, i) => {
    const el = document.createElement('div');
    el.className = 'swarm-cursor';
    el.innerHTML = `
      <div class="swarm-cursor-arrow">${createCursorSVG(cfg.color)}</div>
      <span class="swarm-cursor-tag" style="background:${cfg.color};">${cfg.name}</span>
    `;
    cursorLayer.appendChild(el);

    // Spawn around edges organically
    const angle = (i / AGENT_CONFIGS.length) * Math.PI * 2;
    const startX = window.innerWidth * 0.5 + Math.cos(angle) * (window.innerWidth * 0.45);
    const startY = window.innerHeight * 0.5 + Math.sin(angle) * (window.innerHeight * 0.45);

    return {
      index: i,
      name: cfg.name,
      color: cfg.color,
      el,
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      targetX: startX,
      targetY: startY,
      // Slightly varied spring constants for organic staggered feel
      stiffness: 0.065 + (i % 5) * 0.012,
      damping: 0.72 + (i % 4) * 0.03,
      trailOffsetAngle: (i / 14) * Math.PI * 2,
      trailDist: 38 + (i % 4) * 20,
      busyUntil: 0,
      taskFn: null,
      active: i < activeCount,
    };
  });

  function syncAgentCount() {
    isMobile = window.innerWidth < 640;
    activeCount = isMobile ? 6 : 14;
    agents.forEach((a, i) => {
      a.active = i < activeCount;
      a.el.style.display = a.active ? 'flex' : 'none';
    });
  }
  syncAgentCount();

  window.addEventListener('resize', syncAgentCount, { passive: true });

  // Track real mouse
  function onPointerMove(x, y) {
    mouseX = x;
    mouseY = y;
    lastMouseMoveAt = performance.now();
    hasMouseMoved = true;
  }

  window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  /* ==========================================================================
     DISPATCH HELPERS
     ========================================================================== */
  function pickNearbyAgents(cx, cy, count, durationMs) {
    const now = performance.now();
    const pool = agents.filter((a) => a.active && a.busyUntil <= now);
    // Fallback to any active agents if all are busy
    const candidates = pool.length >= count ? pool : agents.filter((a) => a.active);

    const sorted = [...candidates].sort((a, b) => {
      const da = Math.hypot(a.x - cx, a.y - cy);
      const db = Math.hypot(b.x - cx, b.y - cy);
      return da - db;
    });

    const chosen = sorted.slice(0, count);
    chosen.forEach((a) => {
      a.busyUntil = now + durationMs;
    });
    return chosen;
  }

  /* ==========================================================================
     ELEMENT BUILD EFFECTS (0.8s - 1.1s)
     ========================================================================== */

  function buildContainer(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const duration = 900;
    const startTime = performance.now();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dispatched = pickNearbyAgents(cx, cy, 2, duration);
    const accentColor = dispatched[0]?.color || '#3b82f6';

    // Create Figma-style bounding box wireframe
    const box = document.createElement('div');
    box.className = 'swarm-bbox';
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.borderColor = accentColor;
    box.innerHTML = `
      <span class="swarm-handle tl" style="border-color:${accentColor}"></span>
      <span class="swarm-handle tr" style="border-color:${accentColor}"></span>
      <span class="swarm-handle bl" style="border-color:${accentColor}"></span>
      <span class="swarm-handle br" style="border-color:${accentColor}"></span>
      <span class="swarm-dim-badge" style="background:${accentColor}">${Math.round(rect.width)} × ${Math.round(rect.height)}</span>
    `;
    wireframeLayer.appendChild(box);

    // Subtle fade-in of the real element (force reflow so CSS transition always fires)
    el.classList.add('swarm-building-container');
    void el.offsetWidth;
    el.classList.add('swarm-built');

    // Assign cursors to opposite corners and sweep slightly
    if (dispatched[0]) {
      dispatched[0].taskFn = (now) => {
        const p = Math.min(1, (now - startTime) / duration);
        const r = el.getBoundingClientRect();
        dispatched[0].targetX = r.left + r.width * (0.05 + p * 0.15);
        dispatched[0].targetY = r.top + 6;
      };
    }
    if (dispatched[1]) {
      dispatched[1].taskFn = (now) => {
        const p = Math.min(1, (now - startTime) / duration);
        const r = el.getBoundingClientRect();
        dispatched[1].targetX = r.right - r.width * (0.05 + p * 0.15);
        dispatched[1].targetY = r.bottom - 6;
      };
    }

    setTimeout(() => {
      box.classList.add('is-fading');
      setTimeout(() => box.remove(), 250);
    }, duration - 180);
  }

  function buildText(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 8) return;

    const duration = 850;
    const startTime = performance.now();
    const dispatched = pickNearbyAgents(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5, 1, duration);

    el.classList.add('swarm-building-text');
    void el.offsetWidth;
    el.classList.add('swarm-built');

    if (dispatched[0]) {
      dispatched[0].taskFn = (now) => {
        const p = Math.min(1, (now - startTime) / duration);
        const r = el.getBoundingClientRect();
        dispatched[0].targetX = r.left + r.width * Math.min(0.98, p);
        dispatched[0].targetY = r.top + r.height * 0.6;
      };
    }
  }

  function buildImage(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 16 || rect.height < 16) return;

    const duration = 950;
    const startTime = performance.now();
    const dispatched = pickNearbyAgents(rect.right, rect.top, 2, duration);
    const accentColor = dispatched[0]?.color || '#00D4FF';

    // Wireframe scanline box
    const scanBox = document.createElement('div');
    scanBox.className = 'swarm-scanbox';
    scanBox.style.left = `${rect.left}px`;
    scanBox.style.top = `${rect.top}px`;
    scanBox.style.width = `${rect.width}px`;
    scanBox.style.height = `${rect.height}px`;
    scanBox.style.borderColor = accentColor;
    scanBox.innerHTML = `<div class="swarm-scanline" style="background:linear-gradient(90deg, transparent, ${accentColor}, transparent); box-shadow: 0 0 10px ${accentColor};"></div>`;
    wireframeLayer.appendChild(scanBox);

    el.classList.add('swarm-building-image');
    void el.offsetWidth;
    el.classList.add('swarm-built');

    if (dispatched[0]) {
      dispatched[0].taskFn = (now) => {
        const p = Math.min(1, (now - startTime) / duration);
        const r = el.getBoundingClientRect();
        dispatched[0].targetX = r.right - 8;
        dispatched[0].targetY = r.top + r.height * p;
      };
    }
    if (dispatched[1]) {
      dispatched[1].taskFn = () => {
        const r = el.getBoundingClientRect();
        dispatched[1].targetX = r.left + 8;
        dispatched[1].targetY = r.top + 8;
      };
    }

    setTimeout(() => {
      scanBox.classList.add('is-fading');
      setTimeout(() => scanBox.remove(), 250);
    }, duration - 150);
  }

  function triggerBuildForElement(el) {
    if (!el || builtElements.has(el)) return;
    // Only build if element is actually visible (not inside a hidden section panel)
    const panel = el.closest('.section-panel');
    if (panel) {
      const activeSection = document.body.getAttribute('data-active-section');
      if (!document.body.classList.contains('view-section') || panel.getAttribute('data-section') !== activeSection) {
        return;
      }
    }

    builtElements.add(el);

    if (el.matches(SELECTORS.images)) {
      buildImage(el);
    } else if (el.matches(SELECTORS.texts)) {
      buildText(el);
    } else if (el.matches(SELECTORS.containers)) {
      buildContainer(el);
    }
  }

  /* ==========================================================================
     INTERSECTION OBSERVER FOR SCROLLING INSIDE SECTIONS & DESKTOP
     ========================================================================== */
  function observeContainer(rootEl) {
    if (!rootEl || observedSections.has(rootEl)) return;
    observedSections.add(rootEl);

    const targets = rootEl.querySelectorAll(
      `${SELECTORS.containers}, ${SELECTORS.texts}, ${SELECTORS.images}`
    );

    const io = new IntersectionObserver(
      (entries) => {
        // Stagger simultaneous entries slightly for organic wave
        let delay = 0;
        entries.forEach((entry) => {
          if (entry.isIntersecting && !builtElements.has(entry.target)) {
            const target = entry.target;
            setTimeout(() => triggerBuildForElement(target), delay);
            delay = Math.min(delay + 45, 360);
            io.unobserve(target);
          }
        });
      },
      {
        root: rootEl.classList.contains('section-body') ? rootEl : null,
        threshold: 0.08,
        rootMargin: '0px 0px -10px 0px',
      }
    );

    targets.forEach((t) => io.observe(t));
  }

  // Observe desktop grid on startup
  const desktopGrid = document.getElementById('desktopGrid');
  if (desktopGrid) {
    observeContainer(desktopGrid);
  }

  // Observe all section bodies
  document.querySelectorAll('.section-panel .section-body').forEach((body) => {
    observeContainer(body);
  });

  /**
   * Called by main.js whenever a section folder is opened so visible elements
   * inside that section immediately trigger their collaborative build animation.
   */
  function triggerSectionBuild(sectionId) {
    const panel = document.getElementById(`section-${sectionId}`);
    if (!panel) return;
    const body = panel.querySelector('.section-body');
    if (!body) return;

    // Wait for panel slide-in transition to settle so bounding rects are accurate
    setTimeout(() => {
      const targets = body.querySelectorAll(
        `${SELECTORS.containers}, ${SELECTORS.texts}, ${SELECTORS.images}`
      );
      const bodyRect = body.getBoundingClientRect();
      let delay = 0;

      targets.forEach((el) => {
        if (builtElements.has(el)) return;
        const r = el.getBoundingClientRect();
        if (r.bottom >= bodyRect.top && r.top <= bodyRect.bottom + 40) {
          setTimeout(() => triggerBuildForElement(el), delay);
          delay = Math.min(delay + 50, 400);
        }
      });
    }, 320);
  }

  /* ==========================================================================
     60 FPS SPRING PHYSICS LOOP
     ========================================================================== */
  function tick(now) {
    rafId = requestAnimationFrame(tick);
    if (document.hidden) return;

    const isIdle = !hasMouseMoved || (now - lastMouseMoveAt > 1500);
    const orbitBaseAngle = now * 0.00055; // gentle rotation speed
    const orbitRadius = isMobile ? 72 : 112;

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (!a.active) continue;

      if (a.busyUntil > now && a.taskFn) {
        a.taskFn(now);
      } else {
        a.taskFn = null;
        if (isIdle) {
          // Gentle orbiting ring around real cursor (never obscuring center)
          const angle = orbitBaseAngle + (i / activeCount) * Math.PI * 2;
          const r = orbitRadius + Math.sin(now * 0.002 + i) * 14;
          a.targetX = mouseX + Math.cos(angle) * r;
          a.targetY = mouseY + Math.sin(angle) * r;
        } else {
          // Loosely trail behind real pointer with staggered offsets
          const r = a.trailDist;
          const angle = a.trailOffsetAngle + now * 0.0004;
          a.targetX = mouseX + Math.cos(angle) * r;
          a.targetY = mouseY + Math.sin(angle) * r;
        }
      }

      // Clamp target within viewport bounds so cursors stay visible
      a.targetX = Math.max(12, Math.min(window.innerWidth - 90, a.targetX));
      a.targetY = Math.max(12, Math.min(window.innerHeight - 36, a.targetY));

      // Spring physics integration
      const ax = (a.targetX - a.x) * a.stiffness;
      const ay = (a.targetY - a.y) * a.stiffness;
      a.vx = (a.vx + ax) * a.damping;
      a.vy = (a.vy + ay) * a.damping;
      a.x += a.vx;
      a.y += a.vy;

      a.el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
    }
  }

  rafId = requestAnimationFrame(tick);

  return {
    triggerSectionBuild,
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncAgentCount);
      overlay.remove();
    },
  };
}
