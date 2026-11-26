/**
 * main.js
 * Windows 11 Desktop Portfolio Controller
 */

import { portfolioData } from './portfolio-data.js';
import { animate } from 'animejs';
import { initDesktopBackground } from './desktop-bg.js';
import { initCertViewer } from './cert-viewer.js';
import { initCursorSwarm } from './cursor-swarm.js';

let swarmController = null;

/* ==========================================================================
   SVG TEMPLATES
   ========================================================================== */

const FOLDER_SVG = `<svg viewBox="0 0 48 48" fill="none"><path d="M6 12c0-2.2 1.8-4 4-4h8l4 4h16c2.2 0 4 1.8 4 4v20c0 2.2-1.8 4-4 4H10c-2.2 0-4-1.8-4-4V12z" fill="url(#fg)"/><defs><linearGradient id="fg" x1="6" y1="8" x2="42" y2="40"><stop stop-color="#FFD54F"/><stop offset="1" stop-color="#FFB300"/></linearGradient></defs></svg>`;

const FILE_SVG = `<svg viewBox="0 0 48 48" fill="none"><path d="M12 4h16l12 12v24c0 2.2-1.8 4-4 4H12c-2.2 0-4-1.8-4-4V8c0-2.2 1.8-4 4-4z" fill="#E8EAED"/><path d="M28 4v8c0 2.2 1.8 4 4 4h8" fill="#BDBDBD"/><rect x="14" y="28" width="20" height="10" rx="2" fill="#D32F2F"/><text x="24" y="36" text-anchor="middle" fill="white" font-size="7" font-weight="bold" font-family="sans-serif">PDF</text></svg>`;

const PIN_FOLDER_SVG = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 4.5C2 3.67 2.67 3 3.5 3H6.5L8 4.5H14.5C15.33 4.5 16 5.17 16 6V13.5C16 14.33 15.33 15 14.5 15H3.5C2.67 15 2 14.33 2 13.5V4.5Z" fill="#FFB300"/></svg>`;

/* ==========================================================================
   1. RENDER DESKTOP ICONS
   ========================================================================== */

export function renderDesktopIcons() {
  const desktopGrid = document.getElementById('desktopGrid');
  if (!desktopGrid) return;

  desktopGrid.innerHTML = portfolioData.desktopFolders.map(folder => {
    const svg = folder.iconType === 'file' ? FILE_SVG : FOLDER_SVG;
    return `
      <button class="desktop-icon" data-section="${folder.id}" title="${folder.label}">
        <div class="desktop-icon-img">${svg}</div>
        <span class="desktop-icon-label">${folder.label}</span>
      </button>
    `;
  }).join('');
}

/* ==========================================================================
   2. RENDER TASKBAR PINS
   ========================================================================== */

export function renderTaskbarPins() {
  const taskbarPins = document.getElementById('taskbarPins');
  if (!taskbarPins) return;

  const sections = portfolioData.desktopFolders.filter(folder => folder.id !== 'resume');
  taskbarPins.innerHTML = sections.map(folder => `
    <button class="tb-pin" data-section="${folder.id}" title="${folder.label}" aria-label="${folder.label}">
      ${PIN_FOLDER_SVG}
    </button>
  `).join('');
}

/* ==========================================================================
   3. TASKBAR CLOCK
   ========================================================================== */

export function startClock() {
  const tbClock = document.getElementById('tbClock');
  if (!tbClock) return;

  const timeEl = tbClock.querySelector('.clock-time');
  const dateEl = tbClock.querySelector('.clock-date');

  function update() {
    const now = new Date();

    // Format: h:mm AM/PM
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes} ${ampm}`;

    // Format: M/DD/YYYY
    const month = now.getMonth() + 1;
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${month}/${day}/${year}`;

    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
  }

  update();
  return setInterval(update, 1000);
}

/* ==========================================================================
   4. OPEN SECTION
   ========================================================================== */

export function openSection(sectionId) {
  if (!sectionId) return;

  document.body.classList.remove('view-desktop');
  document.body.classList.add('view-section');
  document.body.setAttribute('data-active-section', sectionId);

  // Update .tb-pin active states
  const pins = document.querySelectorAll('.tb-pin');
  pins.forEach(pin => {
    if (pin.getAttribute('data-section') === sectionId) {
      pin.setAttribute('data-active', 'true');
    } else {
      pin.removeAttribute('data-active');
    }
  });

  // Reset scroll position on active section body
  const sectionPanel = document.getElementById(`section-${sectionId}`);
  if (sectionPanel) {
    const sectionBody = sectionPanel.querySelector('.section-body');
    if (sectionBody) sectionBody.scrollTop = 0;
  }

  // Trigger collaborative cursor swarm build for newly opened section
  if (swarmController) {
    swarmController.triggerSectionBuild(sectionId);
  }
}

/* ==========================================================================
   5. CLOSE SECTION
   ========================================================================== */

export function closeSection() {
  document.body.classList.remove('view-section');
  document.body.classList.add('view-desktop');
  document.body.removeAttribute('data-active-section');

  const pins = document.querySelectorAll('.tb-pin');
  pins.forEach(pin => {
    pin.removeAttribute('data-active');
  });
}

/* ==========================================================================
   6. BIND NAVIGATION
   ========================================================================== */

export function bindNavigation() {
  const desktopGrid = document.getElementById('desktopGrid');
  const desktop = document.getElementById('desktop');

  function activateDesktopItem(btn) {
    const sectionId = btn.getAttribute('data-section');
    if (sectionId === 'resume') {
      const link = document.createElement('a');
      link.href = './Aayush Resume.pdf';
      link.download = 'Aayush Resume.pdf';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (sectionId) {
      openSection(sectionId);
    }
  }

  function selectDesktopItem(btn) {
    document.querySelectorAll('.desktop-icon.is-selected').forEach(el => {
      el.classList.remove('is-selected');
    });
    if (btn) btn.classList.add('is-selected');
  }

  if (desktopGrid) {
    let lastPointerType = 'mouse';
    desktopGrid.addEventListener('pointerdown', (e) => {
      lastPointerType = e.pointerType || 'mouse';
    });

    // Single-click selects on mouse; opens directly on touch devices
    desktopGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.desktop-icon');
      if (!btn) return;
      selectDesktopItem(btn);
      if (lastPointerType === 'touch') {
        activateDesktopItem(btn);
      }
    });

    // Double-click opens folder or downloads file
    desktopGrid.addEventListener('dblclick', (e) => {
      const btn = e.target.closest('.desktop-icon');
      if (!btn) return;
      selectDesktopItem(btn);
      activateDesktopItem(btn);
    });

    // Enter key opens selected/focused icon
    desktopGrid.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const btn = e.target.closest('.desktop-icon');
        if (btn) activateDesktopItem(btn);
      }
    });
  }

  // Clicking empty desktop background clears selection
  if (desktop) {
    desktop.addEventListener('click', (e) => {
      if (!e.target.closest('.desktop-icon')) {
        selectDesktopItem(null);
      }
    });
  }

  // Section back buttons: click to return to desktop
  document.querySelectorAll('.section-back, [data-action="close-section"]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeSection();
    });
  });

  // Taskbar pins: click to open section
  const taskbarPins = document.getElementById('taskbarPins');
  if (taskbarPins) {
    taskbarPins.addEventListener('click', (e) => {
      const btn = e.target.closest('.tb-pin');
      if (!btn) return;

      const sectionId = btn.getAttribute('data-section');
      if (sectionId) {
        openSection(sectionId);
      }
    });
  }

  // Escape key: close active section
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSection();
    }
  });
}

/* ==========================================================================
   7. CUSTOM CURSOR DOT
   ========================================================================== */

export function initCursorDot() {
  const cursorDot = document.getElementById('cursorDot');
  if (!cursorDot) return;

  const hoverSelector = 'a, button, .desktop-icon, .cert-card, .tb-btn, .tb-pin, .tray-icon, input, textarea, select, [role="button"]';

  window.addEventListener('mousemove', (e) => {
    cursorDot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    if (cursorDot.style.opacity !== '1') {
      cursorDot.style.opacity = '1';
    }
  }, { passive: true });

  window.addEventListener('mouseover', (e) => {
    const isHovering = Boolean(e.target.closest(hoverSelector));
    cursorDot.classList.toggle('hovering', isHovering);
  });

  document.addEventListener('mouseleave', () => {
    cursorDot.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    cursorDot.style.opacity = '1';
  });
}

/* ==========================================================================
   8. REVEAL ANIMATIONS
   ========================================================================== */

export function initRevealAnimations() {
  // Add reveal-up class to key card containers if not already present
  const contentCards = document.querySelectorAll(
    '.project-card, .cert-card, .skill-group, .timeline-item, .contact-card'
  );
  contentCards.forEach(el => el.classList.add('reveal-up'));

  const revealElements = document.querySelectorAll('.reveal-up');
  if (!revealElements.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => observer.observe(el));
}

/* ==========================================================================
   8b. WALLPAPER LIVE TYPING ANIMATION
   ========================================================================== */

export function initWallpaperTyping() {
  const introRoot = document.querySelector('.desktop-wallpaper-intro');
  if (!introRoot) return;

  const leftEls = Array.from(introRoot.querySelectorAll('.wallpaper-intro-left [data-type-text]'));
  const rightEls = Array.from(introRoot.querySelectorAll('.wallpaper-intro-right [data-type-text]'));
  const groups = [leftEls, rightEls].filter(group => group.length > 0);
  if (!groups.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    groups.flat().forEach(el => {
      el.textContent = el.dataset.typeText || '';
    });
    return;
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function runGroupLoop(els, startDelay) {
    els.forEach(el => {
      el.textContent = '';
      el.classList.remove('is-typing');
    });

    await sleep(startDelay);

    const totalLoops = 2;
    for (let cycle = 0; cycle < totalLoops; cycle++) {
      // Type each line in sequence
      for (const el of els) {
        const fullText = el.dataset.typeText || '';
        el.classList.add('is-typing');
        for (let i = 1; i <= fullText.length; i++) {
          el.textContent = fullText.slice(0, i);
          await sleep(75);
        }
        el.classList.remove('is-typing');
        await sleep(160);
      }

      // On the final loop, keep the completed text visible
      if (cycle === totalLoops - 1) break;

      const lastEl = els[els.length - 1];
      lastEl.classList.add('is-typing');
      await sleep(2000);
      lastEl.classList.remove('is-typing');

      for (let idx = els.length - 1; idx >= 0; idx--) {
        const el = els[idx];
        const current = el.textContent || '';
        el.classList.add('is-typing');
        for (let i = current.length - 1; i >= 0; i--) {
          el.textContent = current.slice(0, i);
          await sleep(35);
        }
        el.classList.remove('is-typing');
      }

      await sleep(400);
    }
  }

  runGroupLoop(leftEls, 250);
  runGroupLoop(rightEls, 450);
}

/* ==========================================================================
   9. INITIALIZATION
   ========================================================================== */

function init() {
  renderDesktopIcons();
  renderTaskbarPins();
  startClock();
  bindNavigation();
  initCursorDot();
  initWallpaperTyping();
  initRevealAnimations();

  // Portfolio ready immediately
  document.body.classList.remove('intro-playing');
  document.body.classList.add('intro-done');

  // Initialize Three.js animated desktop background
  initDesktopBackground();

  // Initialize 3D certificate viewer
  initCertViewer();

  // Initialize Multiplayer Cursor Swarm
  swarmController = initCursorSwarm();

  console.log('Portfolio ready!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
