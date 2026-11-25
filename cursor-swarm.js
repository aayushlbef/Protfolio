/**
 * cursor-swarm.js
 * Multiplayer Cursor Swarm page-builder animation:
 * 1. Page load (0s - 1.0s): Blank desktop while cursors orbit in a circle at screen center.
 * 2. Build phase (1.0s+): Cursors fan out to build desktop icons & taskbar in sync.
 * 3. Section open / scroll: Cursors reappear briefly to build newly revealed elements in sync.
 * 4. Idle / Done: Cursors smoothly disappear until something changes on screen.
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

  // Create non-blocking overlay (visible during intro & builds, hidden when idle)
  const overlay = document.createElement('div');
  overlay.className = 'swarm-overlay is-active';
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
  let rafId = null;

  const introStartAt = performance.now();
  const INTRO_ORBIT_MS = 1000; // 1 second circular orbit in center with blank page
  let introOrbitActive = true;
  let lastBuildEndAt = introStartAt + INTRO_ORBIT_MS + 100;

  const builtElements = new WeakSet();
  const observedSections = new WeakSet();

  // Hide desktop icons, taskbar & background canvas initially until cursors finish the 1s orbit and build them
  const desktopIcons = Array.from(document.querySelectorAll('.desktop-icon'));
  const taskbar = document.getElementById('taskbar');
  const bgCanvas = document.getElementById('desktop-bg-canvas');
  desktopIcons.forEach((el) => el.classList.add('swarm-hidden'));
  if (taskbar) taskbar.classList.add('swarm-hidden');
  if (bgCanvas) bgCanvas.classList.add('swarm-hidden');

  // Pre-hide section elements until their section is opened / scrolled into view
  document
    .querySelectorAll(
      `.section-panel ${SELECTORS.containers.split(',').join(', .section-panel ')}, .section-panel ${SELECTORS.texts.split(',').join(', .section-panel ')}, .section-panel ${SELECTORS.images.split(',').join(', .section-panel ')}`
    )
    .forEach((el) => el.classList.add('swarm-hidden'));

  // Build agent pool (14 desktop, 6 mobile)
  const cx0 = window.innerWidth * 0.5;
  const cy0 = window.innerHeight * 0.5;
  const orbitR0 = isMobile ? 58 : 92;

  const agents = AGENT_CONFIGS.map((cfg, i) => {
    const el = document.createElement('div');
    el.className = 'swarm-cursor';
    el.innerHTML = `
      <div class="swarm-cursor-arrow">${createCursorSVG(cfg.color)}</div>
      <span class="swarm-cursor-tag" style="background:${cfg.color};">${cfg.name}</span>
    `;
    cursorLayer.appendChild(el);

    const angle = (i / AGENT_CONFIGS.length) * Math.PI * 2;
    const startX = cx0 + Math.cos(angle) * orbitR0;
    const startY = cy0 + Math.sin(angle) * orbitR0;

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
      stiffness: 0.14 + (i % 4) * 0.02,
      damping: 0.72,
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

  /* ==========================================================================
     DISPATCH HELPERS
     ========================================================================== */
  function wakeSwarm(durationMs) {
    const now = performance.now();
    lastBuildEndAt = Math.max(lastBuildEndAt, now + durationMs);
    overlay.classList.add('is-active');
  }

  function pickNearbyAgents(cx, cy, count, durationMs) {
    const now = performance.now();
    const pool = agents.filter((a) => a.active && a.busyUntil <= now);
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
    wakeSwarm(durationMs);
    return chosen;
  }

  /* ==========================================================================
     SYNCED BUILD EFFECTS (cursors move first, element builds in sync)
     ========================================================================== */

  function buildContainer(el, duration = 750) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      el.classList.remove('swarm-hidden');
      return;
    }

    const startTime = performance.now();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dispatched = pickNearbyAgents(cx, cy, 2, duration);
    const accentColor = dispatched[0]?.color || '#3b82f6';

    // Draw Figma wireframe box immediately as cursors arrive
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

    if (dispatched[0]) {
      dispatched[0].taskFn = (now) => {
        const p = Math.min(1, (now - startTime) / duration);
        const r = el.getBoundingClientRect();
        dispatched[0].targetX = r.left + r.width * (0.08 + p * 0.2);
        dispatched[0].targetY = r.top + 8;
      };
    }
    if (dispatched[1]) {
      dispatched[1].taskFn = (now) => {
        const p = Math.min(1, (now - startTime) / duration);
        const r = el.getBoundingClientRect();
        dispatched[1].targetX = r.right - r.width * (0.08 + p * 0.2);
        dispatched[1].targetY = r.bottom - 8;
      };
    }

    // Reveal element in sync after cursor reaches the bounding box (~220ms travel)
    setTimeout(() => {
      el.classList.remove('swarm-hidden');
      el.classList.add('swarm-building-container');
      void el.offsetWidth;
      el.classList.add('swarm-built');
    }, 220);

    setTimeout(() => {
      box.classList.add('is-fading');
      setTimeout(() => box.remove(), 220);
    }, duration - 120);
  }

  function buildText(el, duration = 700) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 8) {
      el.classList.remove('swarm-hidden');
      return;
    }

    const startTime = performance.now();
    const dispatched = pickNearbyAgents(rect.left, rect.top + rect.height * 0.5, 1, duration);

    if (dispatched[0]) {
      dispatched[0].taskFn = (now) => {
        const p = Math.min(1, (now - startTime) / duration);
        const r = el.getBoundingClientRect();
        dispatched[0].targetX = r.left + r.width * Math.min(0.98, p);
        dispatched[0].targetY = r.top + r.height * 0.6;
      };
    }

    setTimeout(() => {
      el.classList.remove('swarm-hidden');
      el.classList.add('swarm-building-text');
      void el.offsetWidth;
      el.classList.add('swarm-built');
    }, 160);
  }

  function buildImage(el, duration = 800) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 16 || rect.height < 16) {
      el.classList.remove('swarm-hidden');
      return;
    }

    const startTime = performance.now();
    const dispatched = pickNearbyAgents(rect.right, rect.top, 2, duration);
    const accentColor = dispatched[0]?.color || '#00D4FF';

    const scanBox = document.createElement('div');
    scanBox.className = 'swarm-scanbox';
    scanBox.style.left = `${rect.left}px`;
    scanBox.style.top = `${rect.top}px`;
    scanBox.style.width = `${rect.width}px`;
    scanBox.style.height = `${rect.height}px`;
    scanBox.style.borderColor = accentColor;
    scanBox.innerHTML = `<div class="swarm-scanline" style="background:linear-gradient(90deg, transparent, ${accentColor}, transparent); box-shadow: 0 0 10px ${accentColor};"></div>`;
    wireframeLayer.appendChild(scanBox);

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
      el.classList.remove('swarm-hidden');
      el.classList.add('swarm-building-image');
      void el.offsetWidth;
      el.classList.add('swarm-built');
    }, 180);

    setTimeout(() => {
      scanBox.classList.add('is-fading');
      setTimeout(() => scanBox.remove(), 220);
    }, duration - 120);
  }

  function triggerBuildForElement(el) {
    if (!el || builtElements.has(el)) return;

    const panel = el.closest('.section-panel');
    if (panel) {
      const activeSection = document.body.getAttribute('data-active-section');
      if (
        !document.body.classList.contains('view-section') ||
        panel.getAttribute('data-section') !== activeSection
      ) {
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
    } else {
      el.classList.remove('swarm-hidden');
    }
  }

  /* ==========================================================================
     1.0s CENTER ORBIT INTRO -> THEN BUILD DESKTOP (PORTRAIT + ICONS + TASKBAR)
     ========================================================================== */
  function buildPortraitCanvas(canvasEl) {
    const duration = 950;
    const startTime = performance.now();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const boxSize = Math.min(w * 0.55, h * 0.78);
    const left = (w - boxSize) * 0.5;
    const top = (h - boxSize) * 0.5;

    const dispatched = pickNearbyAgents(w * 0.5, h * 0.5, 4, duration);
    const accentColor = dispatched[0]?.color || '#00D4FF';

    // Figma bounding box + scanline over the center portrait
    const box = document.createElement('div');
    box.className = 'swarm-bbox';
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${boxSize}px`;
    box.style.height = `${boxSize}px`;
    box.style.borderColor = accentColor;
    box.innerHTML = `
      <span class="swarm-handle tl" style="border-color:${accentColor}"></span>
      <span class="swarm-handle tr" style="border-color:${accentColor}"></span>
      <span class="swarm-handle bl" style="border-color:${accentColor}"></span>
      <span class="swarm-handle br" style="border-color:${accentColor}"></span>
      <span class="swarm-dim-badge" style="background:${accentColor}">${Math.round(boxSize)} × ${Math.round(boxSize)}</span>
      <div class="swarm-scanline" style="background:linear-gradient(90deg, transparent, ${accentColor}, transparent); box-shadow: 0 0 12px ${accentColor};"></div>
    `;
    wireframeLayer.appendChild(box);

    // Assign 4 cursors to corners & sweeping scanline
    if (dispatched[0]) {
      dispatched[0].taskFn = (now) => {
        const p = Math.min(1, (now - startTime) / duration);
        dispatched[0].targetX = left + boxSize - 10;
        dispatched[0].targetY = top + boxSize * p;
      };
    }
    if (dispatched[1]) {
      dispatched[1].taskFn = (now) => {
        const p = Math.min(1, (now - startTime) / duration);
        dispatched[1].targetX = left + 10;
        dispatched[1].targetY = top + boxSize * (1 - p * 0.85);
      };
    }
    if (dispatched[2]) {
      dispatched[2].taskFn = () => {
        dispatched[2].targetX = left + boxSize * 0.15;
        dispatched[2].targetY = top + 12;
      };
    }
    if (dispatched[3]) {
      dispatched[3].taskFn = () => {
        dispatched[3].targetX = left + boxSize * 0.85;
        dispatched[3].targetY = top + boxSize - 12;
      };
    }

    // Reveal portrait canvas in sync with top-to-bottom scanline
    setTimeout(() => {
      canvasEl.classList.remove('swarm-hidden');
      canvasEl.classList.add('swarm-building-image');
      void canvasEl.offsetWidth;
      canvasEl.classList.add('swarm-built');
    }, 150);

    setTimeout(() => {
      box.classList.add('is-fading');
      setTimeout(() => box.remove(), 250);
    }, duration - 120);
  }

  setTimeout(() => {
    introOrbitActive = false;

    // Build center portrait background with 4 cursors + wireframe scanline
    if (bgCanvas) {
      buildPortraitCanvas(bgCanvas);
    }

    // Build desktop icons in staggered sync
    desktopIcons.forEach((icon, i) => {
      setTimeout(() => {
        triggerBuildForElement(icon);
      }, 180 + i * 75);
    });

    // Build taskbar
    if (taskbar) {
      setTimeout(() => {
        taskbar.classList.remove('swarm-hidden');
        taskbar.classList.add('swarm-building-container');
        void taskbar.offsetWidth;
        taskbar.classList.add('swarm-built');
        wakeSwarm(600);
      }, 180 + desktopIcons.length * 75);
    }
  }, INTRO_ORBIT_MS);

  /* ==========================================================================
     INTERSECTION OBSERVER FOR SCROLLING INSIDE SECTIONS
     ========================================================================== */
  function observeSectionBody(body) {
    if (!body || observedSections.has(body)) return;
    observedSections.add(body);

    const targets = body.querySelectorAll(
      `${SELECTORS.containers}, ${SELECTORS.texts}, ${SELECTORS.images}`
    );

    const io = new IntersectionObserver(
      (entries) => {
        let delay = 0;
        entries.forEach((entry) => {
          if (entry.isIntersecting && !builtElements.has(entry.target)) {
            const target = entry.target;
            setTimeout(() => triggerBuildForElement(target), delay);
            delay = Math.min(delay + 55, 380);
            io.unobserve(target);
          }
        });
      },
      {
        root: body,
        threshold: 0.06,
        rootMargin: '0px 0px -10px 0px',
      }
    );

    targets.forEach((t) => io.observe(t));
  }

  document.querySelectorAll('.section-panel .section-body').forEach(observeSectionBody);

  function triggerSectionBuild(sectionId) {
    const panel = document.getElementById(`section-${sectionId}`);
    if (!panel) return;
    const body = panel.querySelector('.section-body');
    if (!body) return;

    // Wake cursors immediately as section opens
    wakeSwarm(1100);

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
          delay = Math.min(delay + 55, 420);
        }
      });
    }, 300);
  }

  /* ==========================================================================
     60 FPS SPRING PHYSICS LOOP + AUTO-HIDE WHEN NOTHING CHANGES
     ========================================================================== */
  function tick(now) {
    rafId = requestAnimationFrame(tick);
    if (document.hidden) return;

    if (introOrbitActive) {
      // Phase 1 (0s - 1.0s): Orbit in a circle at screen center
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5;
      const r = isMobile ? 58 : 92;
      const spin = now * 0.0045;

      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        if (!a.active) continue;
        const angle = spin + (i / activeCount) * Math.PI * 2;
        a.targetX = cx + Math.cos(angle) * r;
        a.targetY = cy + Math.sin(angle) * r;
      }
    } else {
      // Phase 2+: Check if any cursors are still building
      const isBuilding = now <= lastBuildEndAt + 250;
      if (!isBuilding) {
        overlay.classList.remove('is-active');
      }
    }

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (!a.active) continue;

      if (!introOrbitActive && a.busyUntil > now && a.taskFn) {
        a.taskFn(now);
      } else if (!introOrbitActive) {
        a.taskFn = null;
      }

      // Clamp within viewport
      a.targetX = Math.max(12, Math.min(window.innerWidth - 90, a.targetX));
      a.targetY = Math.max(12, Math.min(window.innerHeight - 36, a.targetY));

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
