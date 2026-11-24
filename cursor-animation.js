/**
 * cursor-animation.js
 * Cinematic intro: 5 colored cursors enter the screen and "place"
 * desktop folder icons one by one, then converge and fade out.
 *
 * Uses anime.js v4 API: animate, createTimeline, stagger
 */

import { animate, createTimeline, stagger } from 'animejs';

// ─── Cursor configuration ────────────────────────────────────────────────────

const CURSORS = [
  { color: '#0078d4', label: 'Creating folders...',  entryFrom: 'top-left'     },
  { color: '#3cd083', label: 'Adding projects...',   entryFrom: 'top-right'    },
  { color: '#e6a836', label: 'Organizing files...',  entryFrom: 'bottom-left'  },
  { color: '#c084fc', label: 'Setting up...',         entryFrom: 'bottom-right' },
  { color: '#f97316', label: 'Almost done!',          entryFrom: 'right'        },
];

/**
 * Build the SVG arrow cursor markup for a given color.
 * @param {string} color - Hex color string
 */
function buildCursorSVG(color) {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M5 3l14 10-6 1-4 6-1-8z" fill="${color}" stroke="rgba(255,255,255,0.8)" stroke-width="1"/>
  </svg>`;
}

/**
 * Calculate the off-screen starting position for each cursor entry direction.
 * @param {string} direction
 * @returns {{ x: number, y: number }}
 */
function getEntryPosition(direction) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  switch (direction) {
    case 'top-left':     return { x: -60,    y: -60    };
    case 'top-right':    return { x: W + 60, y: -60    };
    case 'bottom-left':  return { x: -60,    y: H + 60 };
    case 'bottom-right': return { x: W + 60, y: H + 60 };
    case 'right':        return { x: W + 60, y: H / 2  };
    default:             return { x: -60,    y: H / 2  };
  }
}

/**
 * Calculate the resting position near the top of the screen for each cursor.
 * They park loosely in a row after entering.
 * @param {number} index
 * @returns {{ x: number, y: number }}
 */
function getParkPosition(index) {
  const W = window.innerWidth;
  const spacing = W / (CURSORS.length + 1);
  return { x: spacing * (index + 1), y: 80 };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Play the multi-cursor cinematic intro animation.
 *
 * @param {Function} onComplete - Called when the animation finishes (or is skipped).
 */
export function playCursorAnimation(onComplete) {
  // ── Respect prefers-reduced-motion ────────────────────────────────────────
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    skipToEnd(onComplete);
    return;
  }

  const stage = document.getElementById('cursorStage');
  if (!stage) {
    skipToEnd(onComplete);
    return;
  }

  // ── Build cursor DOM elements ──────────────────────────────────────────────
  const cursorEls = CURSORS.map((cfg, i) => {
    const el = document.createElement('div');
    el.className = 'animated-cursor';
    el.style.cssText = `
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      opacity: 0;
      transform: translate(${getEntryPosition(cfg.entryFrom).x}px, ${getEntryPosition(cfg.entryFrom).y}px);
      will-change: transform, opacity;
    `;

    el.innerHTML = buildCursorSVG(cfg.color);

    const labelEl = document.createElement('span');
    labelEl.className = 'cursor-label';
    labelEl.style.cssText = `
      margin-top: 4px;
      margin-left: 8px;
      font-size: 11px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: ${cfg.color};
      background: rgba(0,0,0,0.65);
      padding: 2px 6px;
      border-radius: 4px;
      opacity: 0;
      white-space: nowrap;
      pointer-events: none;
    `;
    labelEl.textContent = cfg.label;
    el.appendChild(labelEl);
    stage.appendChild(el);
    return el;
  });

  // ── Skip-on-click support ──────────────────────────────────────────────────
  let skipped = false;

  function handleSkip() {
    if (skipped) return;
    skipped = true;
    stage.removeEventListener('click', handleSkip);
    document.removeEventListener('keydown', handleSkipKey);
    skipToEnd(onComplete);
  }

  function handleSkipKey(e) {
    if (e.key === 'Escape' || e.key === ' ') handleSkip();
  }

  stage.addEventListener('click', handleSkip);
  document.addEventListener('keydown', handleSkipKey);

  // ── Build the main timeline ────────────────────────────────────────────────
  const tl = createTimeline({ defaults: { ease: 'outCubic' } });

  // Phase 1 (0 – 1500ms): Cursors fly in from screen edges to park positions
  cursorEls.forEach((el, i) => {
    const park = getParkPosition(i);
    tl.add(
      el,
      {
        opacity: [0, 1],
        translateX: [getEntryPosition(CURSORS[i].entryFrom).x, park.x],
        translateY: [getEntryPosition(CURSORS[i].entryFrom).y, park.y],
        duration: 700,
        ease: 'outCubic',
      },
      i * 200   // stagger 200ms per cursor
    );
  });

  // Phase 2 (1500 – 6000ms): Each cursor visits its assigned desktop icon
  const icons = Array.from(document.querySelectorAll('.desktop-icon'));
  const PHASE2_START = 1500;
  const ICON_STEP    = 550;   // ms between each icon being "placed"

  icons.forEach((icon, i) => {
    const cursorEl  = cursorEls[i % cursorEls.length];
    const labelEl   = cursorEl.querySelector('.cursor-label');
    const cursorCfg = CURSORS[i % CURSORS.length];
    const offset    = PHASE2_START + i * ICON_STEP;

    // 2a: Move cursor to icon position
    tl.add(
      cursorEl,
      {
        translateX: () => {
          const r = icon.getBoundingClientRect();
          return r.left + r.width / 2;
        },
        translateY: () => {
          const r = icon.getBoundingClientRect();
          return r.top + r.height / 2;
        },
        duration: 400,
        ease: 'inOutCubic',
      },
      offset
    );

    // 2b: Click effect – scale cursor down then back
    tl.add(
      cursorEl,
      {
        scale: [1, 0.85, 1],
        duration: 150,
        ease: 'inOutSine',
      },
      offset + 400
    );

    // 2c: Show label text briefly
    tl.add(
      labelEl,
      {
        opacity: [0, 1, 1, 0],
        duration: 400,
        ease: 'inOutSine',
      },
      offset + 420
    );

    // 2d: Icon appears
    tl.add(
      icon,
      {
        opacity: [0, 1],
        scale: [0.8, 1],
        duration: 350,
        ease: 'outBack',
      },
      offset + 450
    );
  });

  // Phase 3 (6000 – 8000ms): Cursors converge to center and fade out
  const PHASE3_START = 6000;
  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2;

  cursorEls.forEach((el, i) => {
    tl.add(
      el,
      {
        translateX: cx,
        translateY: cy,
        opacity: [1, 0],
        scale: [1, 0.5],
        duration: 700,
        ease: 'inCubic',
      },
      PHASE3_START + i * 60
    );
  });

  // Show .desktop-welcome during phase 3
  const welcome = document.querySelector('.desktop-welcome');
  if (welcome) {
    tl.add(
      welcome,
      {
        opacity: [0, 1],
        duration: 600,
        ease: 'outCubic',
      },
      PHASE3_START + 400
    );
  }

  // Finish: update body classes and call onComplete
  tl.add(
    document.body,
    {
      duration: 1,
      onComplete: () => {
        if (skipped) return; // already handled
        stage.removeEventListener('click', handleSkip);
        document.removeEventListener('keydown', handleSkipKey);
        finishIntro(onComplete);
      },
    },
    PHASE3_START + 1200
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Instantly finish the intro without animation (reduced-motion or skip).
 * @param {Function} onComplete
 */
function skipToEnd(onComplete) {
  // Make all desktop icons visible immediately
  document.querySelectorAll('.desktop-icon').forEach(el => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });

  const welcome = document.querySelector('.desktop-welcome');
  if (welcome) welcome.style.opacity = '1';

  // Clear the cursor stage
  const stage = document.getElementById('cursorStage');
  if (stage) stage.innerHTML = '';

  finishIntro(onComplete);
}

/**
 * Flip the body state classes and invoke onComplete.
 * @param {Function} onComplete
 */
function finishIntro(onComplete) {
  document.body.classList.remove('intro-playing');
  document.body.classList.add('intro-done');
  if (typeof onComplete === 'function') onComplete();
}
