/**
 * cert-viewer.js
 * Interactive 3D certificate modal viewer.
 * Clicking a certificate card opens a fullscreen modal with the certificate
 * image rendered on a 3D paper plane that can be dragged to rotate.
 */

let overlay = null;
let currentRotX = 0;
let currentRotY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;
let startRotX = 0;
let startRotY = 0;

function createOverlay() {
  overlay = document.createElement('div');
  overlay.className = 'cert-viewer-overlay';
  overlay.innerHTML = `
    <div class="cert-viewer-content">
      <div class="cert-viewer-scene">
        <div class="cert-viewer-paper" id="certPaper">
          <img class="cert-viewer-img" id="certViewerImg" src="" alt="" draggable="false" />
        </div>
      </div>
      <div class="cert-viewer-info">
        <h3 id="certViewerTitle"></h3>
        <span id="certViewerIssuer"></span>
      </div>
      <button class="cert-viewer-close" id="certViewerClose" title="Close (Esc)">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
      <p class="cert-viewer-hint">Drag to rotate</p>
    </div>
  `;
  document.body.appendChild(overlay);

  // Close handlers
  document.getElementById('certViewerClose').addEventListener('click', closeViewer);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeViewer();
  });

  // Drag rotation handlers
  const paper = document.getElementById('certPaper');

  paper.addEventListener('mousedown', onDragStart);
  paper.addEventListener('touchstart', onDragStart, { passive: false });
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('mouseup', onDragEnd);
  window.addEventListener('touchend', onDragEnd);
}

function onDragStart(e) {
  isDragging = true;
  const point = e.touches ? e.touches[0] : e;
  startX = point.clientX;
  startY = point.clientY;
  startRotX = currentRotX;
  startRotY = currentRotY;
  e.preventDefault();
}

function onDragMove(e) {
  if (!isDragging) return;
  const point = e.touches ? e.touches[0] : e;
  const dx = point.clientX - startX;
  const dy = point.clientY - startY;
  currentRotY = startRotY + dx * 0.4;
  currentRotX = startRotX - dy * 0.4;
  // Clamp X rotation
  currentRotX = Math.max(-45, Math.min(45, currentRotX));
  updatePaperTransform();
}

function onDragEnd() {
  isDragging = false;
}

function updatePaperTransform() {
  const paper = document.getElementById('certPaper');
  if (paper) {
    paper.style.transform = `rotateX(${currentRotX}deg) rotateY(${currentRotY}deg)`;
  }
}

export function openCertViewer(imgSrc, title, issuer) {
  if (!overlay) createOverlay();

  currentRotX = 0;
  currentRotY = 0;

  const img = document.getElementById('certViewerImg');
  img.src = imgSrc;
  img.alt = title;
  document.getElementById('certViewerTitle').textContent = title;
  document.getElementById('certViewerIssuer').textContent = issuer;
  updatePaperTransform();

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
  });

  // Keyboard close
  document.addEventListener('keydown', onKeyDown);
}

function closeViewer() {
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.removeEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
  if (e.key === 'Escape') closeViewer();
}

/** Bind click listeners on all .cert-card elements */
export function initCertViewer() {
  document.querySelectorAll('.cert-card').forEach((card) => {
    card.style.cursor = 'none';
    card.addEventListener('click', () => {
      const img = card.querySelector('.cert-preview img');
      const title = card.querySelector('.cert-info h4');
      const issuer = card.querySelector('.cert-issuer');
      if (img) {
        openCertViewer(
          img.src,
          title ? title.textContent : '',
          issuer ? issuer.textContent : ''
        );
      }
    });
  });
}
