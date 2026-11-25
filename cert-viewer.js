/**
 * cert-viewer.js
 * Interactive 3D certificate viewer with real Three.js physical waving paper shader.
 */

let overlay = null;

function createOverlay() {
  overlay = document.createElement('div');
  overlay.className = 'cert-viewer-overlay';
  overlay.innerHTML = `
    <div class="cert-viewer-content">
      <div class="cert-viewer-scene">
        <iframe id="certViewerIframe" class="cert-viewer-frame" src="" frameborder="0" allow="autoplay"></iframe>
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
      <p class="cert-viewer-hint"><i class="fas fa-arrows-alt"></i> Drag to rotate &amp; view 3D waving paper</p>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('certViewerClose').addEventListener('click', closeViewer);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeViewer();
  });
}

export function openCertViewer(index, title, issuer) {
  if (!overlay) createOverlay();

  const iframe = document.getElementById('certViewerIframe');
  const targetUrl = `./3d-paper-certificate.html?index=${index}`;

  if (!iframe.src.includes(`3d-paper-certificate.html?index=${index}`)) {
    iframe.src = targetUrl;
  } else {
    // If already on that document, post message to animate turn
    iframe.contentWindow?.postMessage({ type: 'cert-show', index }, '*');
  }

  document.getElementById('certViewerTitle').textContent = title || '';
  document.getElementById('certViewerIssuer').textContent = issuer || '';

  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
  });

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
  const cards = document.querySelectorAll('.cert-card');

  cards.forEach((card, idx) => {
    const certIndex = card.hasAttribute('data-cert-index')
      ? parseInt(card.getAttribute('data-cert-index'), 10)
      : idx;

    card.addEventListener('click', () => {
      const title = card.querySelector('.cert-info h4')?.textContent || '';
      const issuer = card.querySelector('.cert-issuer')?.textContent || '';

      // Open fullscreen 3D modal with waving paper
      openCertViewer(certIndex, title, issuer);
    });
  });
}
