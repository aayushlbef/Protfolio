/* ==========================================================================
   FORKED DRAW FUNCTION â€” replaces upstream drawOld() in the certificate variant
   --------------------------------------------------------------------------
   Upstream drawOld() drew a fixed fictional award: "ORBIT SOCIETY OF DESIGN",
   "Certificate of Excellence", presented to "Nocturne Studio", countersigned by
   "Ilya Marchetti" and "Dara Okonkwo". Those strings are canvas literals with
   no runtime API behind them, so the owner's own scans could not be shown.

   The first iteration kept the authored rag paper, foxing, engraved border,
   rules and wax seal and only swapped the typography. That left a visible
   yellow sheet framing the scan, which read as a fake layer. It is gone now:
   the scan is the whole sheet, and the die-cut rounded corners from makeCertTexture
   still give it a physical edge. The bend shader, MeshPhysicalMaterial, sheen,
   rim light, drag physics and hover light are all untouched upstream code.
   ========================================================================== */

/* Certificate records are injected by tools/patch-certificate-variant.mjs */
const CERTS = window.__CERTS__ || [];
const certImgs = [];
let curCert = 0;

function loadCertImages(){
  if(!CERTS.length) return Promise.resolve();
  return Promise.all(CERTS.map(function(c){
    return new Promise(function(res){
      const im = new Image();
      im.onload = function(){ res(im); };
      im.onerror = function(){ res(null); };
      im.src = c.dataUri;
    });
  })).then(function(list){ certImgs.splice(0, certImgs.length); list.forEach(function(i){ certImgs.push(i); }); });
}

function drawCert(ctx, idx){
  const img = certImgs[idx] || null;

  if(img){
    // Full bleed: the generators pad every scan to the sheet's aspect ratio
    // with its own background, so this leaves no bare paper showing.
    ctx.drawImage(img, 0, 0, TW, TH);
    return;
  }

  // Only reachable if a scan failed to decode.
  ctx.fillStyle = '#15181a';
  ctx.fillRect(0, 0, TW, TH);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.font = '500 46px Inter, sans-serif';
  mid(ctx, 'certificate unavailable', TH/2);
}

/* --------------------------------------------------------------------------
   PARENT <-> SHEET CONTROL CHANNEL
   --------------------------------------------------------------------------
   The component mounts this document in a sandboxed, opaque-origin iframe, so
   the parent page cannot reach in and call anything here. postMessage is the
   one channel that crosses an opaque origin, so the prev/next cards use it to
   request a certificate; in the other direction the sheet reports which
   certificate is showing so the cards stay in step when the user drags.
   -------------------------------------------------------------------------- */
let turnTarget = null;
let turnGoal = null;
let turnFrom = 0;
let turnStart = 0;

// A turn must take the same wall-clock time whatever the frame rate. The sheet's
// own loop clamps dt to 0.05s, so a dt-based ease needs a fixed number of
// frames - on a slow device that is tens of seconds and the sheet never
// arrives, which reads as "the click did nothing". This is the duration in
// seconds instead.
const TURN_SECONDS = 0.55;

window.addEventListener('message', function(e){
  var d = e.data;
  if(!d || d.type !== 'cert-show') return;
  var n = CERTS.length;
  if(!n) return;
  var i = Math.round(Number(d.index));
  if(!isFinite(i)) return;
  turnTarget = ((i % n) + n) % n;
  // Clear the latched destination so the new request re-resolves it from
  // wherever the sheet has got to. Without this, a click arriving while a
  // previous turn is still animating is swallowed: the sheet finishes heading
  // for the old goal and then drops the newer request on the floor.
  turnGoal = null;
});

window.addEventListener('load', function(){
  // Report which certificate this sheet is actually showing, so the parent can
  // tell whether it needs to command a change. A freshly mounted sheet always
  // starts on the first one, which is what lets the parent avoid spinning it
  // for no reason.
  parent.postMessage({
    type: 'cert-ready',
    count: CERTS.length,
    index: curCert
  }, '*');
});

