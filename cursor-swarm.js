/**
 * cursor-swarm.js
 * Multiplayer Cursor Swarm page-builder animation with dynamic work-queue dispatch:
 * 1. Page load (0s - 1.0s): Blank desktop while cursors orbit in a circle at screen center.
 * 2. Build phase (1.0s+): Cursors fan out to build the portrait, desktop folders, and every
 *    individual taskbar component (.tb-btn, .tb-pin, .tray-icon, .tb-clock) in sync.
 *    As soon as a cursor finishes one component, it immediately moves to the next unbuilt item.
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
    '.about-profile-card, .about-card, .project-card, .cert-card, .skill-category, .timeline-item, .contact-link, .contact-form, .desktop-icon, .tb-btn, .tb-pin, .tray-icon, .tb-clock',
  texts:
    '.section-title, .about-name, .about-card h4, .about-bio-card p, .about-goals-card p, .project-info h3, .cert-info h4, .contact-heading, .contact-desc, .timeline-content h3',
  images:
    '.about-avatar, .project-preview img, .cert-preview img',
};

const SMALL_ITEM_SELECTOR = '.desktop-icon, .tb-btn, .tb-pin, .tray-icon, .tb-clock';

function createCursorSVG(color) {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4.5 2.5L19.5 11.2L12.1 13.1L8.9 19.8L4.5 2.5Z" fill="${color}" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

export function initCursorSwarm() {
  if (typeof window === 'undefined') return null;

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

  let isMobile = window.innerWidth < 640;
  let activeCount = isMobile ? 6 : 14;
  let rafId = null;

  const introStartAt = performance.now();
  const INTRO_ORBIT_MS = 1000;
  let introOrbitActive = true;
  let lastBuildEndAt = introStartAt + INTRO_ORBIT_MS + 100;

  const builtElements = new WeakSet();
  const queuedElements = new WeakSet();
  const observedSections = new WeakSet();
  const buildQueue = [];

  // Hide desktop icons, taskbar & its individual items, and background canvas initially
  const desktopIcons = Array.from(document.querySelectorAll('.desktop-icon'));
  const taskbar = document.getElementById('taskbar');
  const taskbarItems = taskbar
    ? Array.from(taskbar.querySelectorAll('.tb-btn, .tb-pin, .tray-icon, .tb-clock'))
    : [];
  const bgCanvas = document.getElementById('desktop-bg-canvas');

  desktopIcons.forEach((el) => el.classList.add('swarm-hidden'));
  taskbarItems.forEach((el) => el.classList.add('swarm-hidden'));
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
      stiffness: 0.22 + (i % 4) * 0.025,
      damping: 0.68,
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
     DISPATCH & WORK-QUEUE HELPERS
     ========================================================================== */
  function wakeSwarm(durationMs) {
    const now = performance.now();
    lastBuildEndAt = Math.max(lastBuildEndAt, now + durationMs);
    overlay.classList.add('is-active');
  }

  function pickNearbyAgents(cx, cy, count, durationMs, preferredAgent = null) {
    const now = performance.now();
    const freePool = agents.filter((a) => a.active && a.busyUntil <= now);
    const candidates = freePool.length >= count ? freePool : agents.filter((a) => a.active);

    const sorted = [...candidates].sort((a, b) => {
      if (preferredAgent && a === preferredAgent) return -1;
      if (preferredAgent && b === preferredAgent) return 1;
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

  function enqueueElement(el) {
    if (!el || builtElements.has(el) || queuedElements.has(el)) return;
    queuedElements.add(el);
    buildQueue.push(el);
  }

  /* ==========================================================================
     SYNCED BUILD EFFECTS
     ========================================================================== */

  function buildContainer(el, preferredAgent = null) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 6 || rect.height < 6) {
      el.classList.remove('swarm-hidden');
      return;
    }

    const isSmall = el.matches(SMALL_ITEM_SELECTOR);
    const arriveDelay = isSmall ? 170 : 240;
    const duration = isSmall ? 400 : 720;
    const cursorCount = isSmall ? 1 : 2;

    const startTime = performance.now();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dispatched = pickNearbyAgents(cx, cy, cursorCount, duration, preferredAgent);
    const accentColor = dispatched[0]?.color || '#3b82f6';

    if (dispatched[0]) {
      dispatched[0].taskFn = (now) => {
        const p = Math.max(0, Math.min(1, (now - startTime - arriveDelay) / (duration - arriveDelay)));
        const r = el.getBoundingClientRect();
        dispatched[0].targetX = r.left + r.width * (isSmall ? 0.25 + p * 0.5 : 0.08 + p * 0.25);
        dispatched[0].targetY = r.top + (isSmall ? r.height * 0.4 : 8);
      };
    }
    if (dispatched[1]) {
      dispatched[1].taskFn = (now) => {
        const p = Math.max(0, Math.min(1, (now - startTime - arriveDelay) / (duration - arriveDelay)));
        const r = el.getBoundingClientRect();
        dispatched[1].targetX = r.right - r.width * (0.08 + p * 0.25);
        dispatched[1].targetY = r.bottom - 8;
      };
    }

    setTimeout(() => {
      const r = el.getBoundingClientRect();
      const box = document.createElement('div');
      box.className = 'swarm-bbox';
      box.style.left = `${r.left}px`;
      box.style.top = `${r.top}px`;
      box.style.width = `${r.width}px`;
      box.style.height = `${r.height}px`;
      box.style.borderColor = accentColor;
      box.innerHTML = isSmall
        ? `<span class="swarm-handle tl" style="border-color:${accentColor}"></span>
           <span class="swarm-handle br" style="border-color:${accentColor}"></span>`
        : `<span class="swarm-handle tl" style="border-color:${accentColor}"></span>
           <span class="swarm-handle tr" style="border-color:${accentColor}"></span>
           <span class="swarm-handle bl" style="border-color:${accentColor}"></span>
           <span class="swarm-handle br" style="border-color:${accentColor}"></span>
           <span class="swarm-dim-badge" style="background:${accentColor}">${Math.round(r.width)} × ${Math.round(r.height)}</span>`;
      wireframeLayer.appendChild(box);

      el.classList.remove('swarm-hidden');
      el.classList.add('swarm-building-container');
      void el.offsetWidth;
      el.classList.add('swarm-built');

      setTimeout(() => {
        box.classList.add('is-fading');
        setTimeout(() => box.remove(), 200);
      }, duration - arriveDelay - 60);
    }, arriveDelay);
  }

  function buildText(el, preferredAgent = null) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 8) {
      el.classList.remove('swarm-hidden');
      return;
    }

    const arriveDelay = 170;
    const duration = 650;
    const startTime = performance.now();
    const dispatched = pickNearbyAgents(rect.left, rect.top + rect.height * 0.5, 1, duration, preferredAgent);

    if (dispatched[0]) {
      dispatched[0].taskFn = (now) => {
        const p = Math.max(0, Math.min(1, (now - startTime - arriveDelay) / (duration - arriveDelay)));
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
    }, arriveDelay);
  }

  function buildImage(el, preferredAgent = null) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 16 || rect.height < 16) {
      el.classList.remove('swarm-hidden');
      return;
    }

    const arriveDelay = 200;
    const duration = 800;
    const startTime = performance.now();
    const dispatched = pickNearbyAgents(rect.right, rect.top, 2, duration, preferredAgent);
    const accentColor = dispatched[0]?.color || '#00D4FF';

    if (dispatched[0]) {
      dispatched[0].taskFn = (now) => {
        const p = Math.max(0, Math.min(1, (now - startTime - arriveDelay) / (duration - arriveDelay)));
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
      const r = el.getBoundingClientRect();
      const scanBox = document.createElement('div');
      scanBox.className = 'swarm-scanbox';
      scanBox.style.left = `${r.left}px`;
      scanBox.style.top = `${r.top}px`;
      scanBox.style.width = `${r.width}px`;
      scanBox.style.height = `${r.height}px`;
      scanBox.style.borderColor = accentColor;
      scanBox.innerHTML = `<div class="swarm-scanline" style="background:linear-gradient(90deg, transparent, ${accentColor}, transparent); box-shadow: 0 0 10px ${accentColor};"></div>`;
      wireframeLayer.appendChild(scanBox);

      el.classList.remove('swarm-hidden');
      el.classList.add('swarm-building-image');
      void el.offsetWidth;
      el.classList.add('swarm-built');

      setTimeout(() => {
        scanBox.classList.add('is-fading');
        setTimeout(() => scanBox.remove(), 220);
      }, duration - arriveDelay - 80);
    }, arriveDelay);
  }

  function isElementInActiveView(el) {
    const panel = el.closest('.section-panel');
    if (!panel) return true;
    const activeSection = document.body.getAttribute('data-active-section');
    return (
      document.body.classList.contains('view-section') &&
      panel.getAttribute('data-section') === activeSection
    );
  }

  function triggerBuildForElement(el, preferredAgent = null) {
    if (!el || builtElements.has(el)) return;

    if (!isElementInActiveView(el)) {
      queuedElements.delete(el);
      return;
    }

    builtElements.add(el);

    if (el.matches(SELECTORS.images)) {
      buildImage(el, preferredAgent);
    } else if (el.matches(SELECTORS.texts)) {
      buildText(el, preferredAgent);
    } else if (el.matches(SELECTORS.containers)) {
      buildContainer(el, preferredAgent);
    } else {
      el.classList.remove('swarm-hidden');
    }
  }

  /* ==========================================================================
     1.0s CENTER ORBIT INTRO -> BUILD PORTRAIT, FOLDERS & TASKBAR COMPONENTS
     ========================================================================== */
  function buildPortraitCanvas(canvasEl) {
    const arriveDelay = 260;
    const sweepDuration = 900;
    const totalDuration = arriveDelay + sweepDuration;
    const startTime = performance.now();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const boxSize = Math.min(w * 0.55, h * 0.78);
    const left = (w - boxSize) * 0.5;
    const top = (h - boxSize) * 0.5;

    const dispatched = pickNearbyAgents(w * 0.5, h * 0.5, 4, totalDuration);
    const accentColor = dispatched[0]?.color || '#00D4FF';

    if (dispatched[0]) {
      dispatched[0].taskFn = (now) => {
        const p = Math.max(0, Math.min(1, (now - startTime - arriveDelay) / sweepDuration));
        dispatched[0].targetX = left + boxSize - 10;
        dispatched[0].targetY = top + boxSize * p;
      };
    }
    if (dispatched[1]) {
      dispatched[1].taskFn = (now) => {
        const p = Math.max(0, Math.min(1, (now - startTime - arriveDelay) / sweepDuration));
        dispatched[1].targetX = left + 10;
        dispatched[1].targetY = top + boxSize * p;
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

    setTimeout(() => {
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

      canvasEl.classList.remove('swarm-hidden');
      canvasEl.classList.add('swarm-building-image');
      void canvasEl.offsetWidth;
      canvasEl.classList.add('swarm-built');

      setTimeout(() => {
        box.classList.add('is-fading');
        setTimeout(() => box.remove(), 250);
      }, sweepDuration - 100);
    }, arriveDelay);
  }

  setTimeout(() => {
    introOrbitActive = false;

    // 1. Center portrait gets 4 cursors
    if (bgCanvas) {
      buildPortraitCanvas(bgCanvas);
    }

    // 2. Reveal taskbar backdrop shell smoothly and queue all desktop folders + every individual taskbar item
    if (taskbar) {
      taskbar.classList.remove('swarm-hidden');
      taskbar.classList.add('swarm-building-container');
      void taskbar.offsetWidth;
      taskbar.classList.add('swarm-built');
    }

    // Queue desktop icons and individual taskbar components so free cursors continuously flow through them!
    desktopIcons.forEach((icon) => enqueueElement(icon));
    taskbarItems.forEach((item) => enqueueElement(item));
    wakeSwarm(900);
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
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            !builtElements.has(entry.target) &&
            isElementInActiveView(entry.target)
          ) {
            enqueueElement(entry.target);
            wakeSwarm(600);
            io.unobserve(entry.target);
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

    // Scroll fallback so fast scrolling never misses any element
    body.addEventListener(
      'scroll',
      () => {
        if (!isElementInActiveView(body)) return;
        const bodyRect = body.getBoundingClientRect();
        targets.forEach((el) => {
          if (builtElements.has(el) || queuedElements.has(el)) return;
          const r = el.getBoundingClientRect();
          if (r.bottom >= bodyRect.top - 20 && r.top <= bodyRect.bottom + 60) {
            enqueueElement(el);
            wakeSwarm(600);
          }
        });
      },
      { passive: true }
    );
  }

  document.querySelectorAll('.section-panel .section-body').forEach(observeSectionBody);

  const builtSections = new Set();

  function triggerSectionBuild(sectionId) {
    if (builtSections.has(sectionId)) return;

    const panel = document.getElementById(`section-${sectionId}`);
    if (!panel) return;
    const body = panel.querySelector('.section-body');
    if (!body) return;

    const targets = Array.from(
      body.querySelectorAll(`${SELECTORS.containers}, ${SELECTORS.texts}, ${SELECTORS.images}`)
    );
    const hasUnbuilt = targets.some((el) => !builtElements.has(el));
    if (!hasUnbuilt) {
      builtSections.add(sectionId);
      return;
    }

    builtSections.add(sectionId);
    wakeSwarm(1100);

    setTimeout(() => {
      if (!isElementInActiveView(body)) return;
      const bodyRect = body.getBoundingClientRect();

      targets.forEach((el) => {
        if (builtElements.has(el)) return;
        const r = el.getBoundingClientRect();
        if (r.bottom >= bodyRect.top - 20 && r.top <= bodyRect.bottom + 60) {
          queuedElements.delete(el);
          enqueueElement(el);
        }
      });
    }, 300);
  }

  /* ==========================================================================
     60 FPS SPRING PHYSICS LOOP + CONTINUOUS QUEUE DISPATCH + AUTO-HIDE
     ========================================================================== */
  function dispatchQueueToFreeAgents(now) {
    if (buildQueue.length === 0) return;

    const freeAgents = agents.filter((a) => a.active && a.busyUntil <= now);
    for (let i = 0; i < freeAgents.length && buildQueue.length > 0; i++) {
      const agent = freeAgents[i];
      // Pick the closest queued element to this free agent so movement looks natural
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let q = 0; q < buildQueue.length; q++) {
        const r = buildQueue[q].getBoundingClientRect();
        const d = Math.hypot(r.left + r.width * 0.5 - agent.x, r.top + r.height * 0.5 - agent.y);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = q;
        }
      }
      const [nextEl] = buildQueue.splice(bestIdx, 1);
      triggerBuildForElement(nextEl, agent);
    }
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    if (document.hidden) return;

    if (introOrbitActive) {
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
      // Immediately hand off next unbuilt component to any cursor that just finished!
      dispatchQueueToFreeAgents(now);

      const isBuilding = buildQueue.length > 0 || now <= lastBuildEndAt + 220;
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

      a.targetX = Math.max(12, Math.min(window.innerWidth - 40, a.targetX));
      a.targetY = Math.max(12, Math.min(window.innerHeight - 8, a.targetY));

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
