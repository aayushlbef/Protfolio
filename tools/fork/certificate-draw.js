/* ==========================================================================
   FORKED DRAW FUNCTION — replaces upstream drawOld() in the certificate variant
   --------------------------------------------------------------------------
   Upstream drawOld() drew a fixed fictional award: "ORBIT SOCIETY OF DESIGN",
   "Certificate of Excellence", presented to "Nocturne Studio", countersigned by
   "Ilya Marchetti" and "Dara Okonkwo". Those strings are canvas literals with
   no runtime API behind them, so the owner's own scans could not be shown.

   Everything below the `rule()` helper -- aged rag paper, foxing, fibre pass,
   vignette, engraved double border, corner lozenges, wax seal -- is the
   original authored code, carried over byte-for-byte. Only the typography
   block is replaced, so the sheet keeps ThreeUI's paper stock and simply
   carries a real certificate instead of invented text.
   ========================================================================== */

/* Certificate records are injected by tools/patch-certificate-variant.mjs */
const CERTS = window.__CERTS__ || [];
const certImgs = [];
let curCert = 0;

/* Upstream declared these immediately above drawOld(); the patch splices that
   whole region out, so they are re-declared here. */
const INK='#3B2A17', SEAL='#8E2B22';

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
  const meta  = CERTS[idx] || { title:'', issuer:'', detail:'' };
  const img   = certImgs[idx] || null;
  const rnd   = rng(4711 + idx*131);

  ctx.fillStyle='#EFE4CB'; ctx.fillRect(0,0,TW,TH);

  // foxing and mottle, then a rag-paper fibre pass
  for(let i=0;i<170;i++){
    const x=rnd()*TW, y=rnd()*TH, r=40+rnd()*190, a=0.012+rnd()*0.026;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(146,112,62,'+a+')'); g.addColorStop(1,'rgba(146,112,62,0)');
    ctx.fillStyle=g; ctx.fillRect(x-r,y-r,2*r,2*r);
  }
  ctx.lineWidth=1;
  for(let i=0;i<2600;i++){
    const x=rnd()*TW, y=rnd()*TH, a=rnd()*Math.PI, l=3+rnd()*11;
    ctx.strokeStyle = rnd()<0.5 ? 'rgba(255,250,238,.22)' : 'rgba(120,96,58,.13)';
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(a)*l, y+Math.sin(a)*l); ctx.stroke();
  }
  const vg=ctx.createRadialGradient(TW/2,TH/2,TH*0.28,TW/2,TH/2,TH*0.72);
  vg.addColorStop(0,'rgba(120,92,48,0)'); vg.addColorStop(1,'rgba(120,92,48,.20)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,TW,TH);

  // engraved double rule with corner lozenges
  ctx.strokeStyle=INK;
  ctx.lineWidth=4.5; ctx.strokeRect(62,62,TW-124,TH-124);
  ctx.lineWidth=1.4; ctx.strokeRect(80,80,TW-160,TH-160);
  ctx.fillStyle=INK;
  [[80,80],[TW-80,80],[TW-80,TH-80],[80,TH-80]].forEach(([x,y])=>{
    ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4);
    ctx.fillRect(-7,-7,14,14); ctx.restore();
  });

  const rule=(y,half)=>{
    ctx.strokeStyle=INK; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(600-half,y); ctx.lineTo(600-16,y);
    ctx.moveTo(600+16,y); ctx.lineTo(600+half,y); ctx.stroke();
    ctx.save(); ctx.translate(600,y); ctx.rotate(Math.PI/4);
    ctx.fillStyle=INK; ctx.fillRect(-5,-5,10,10); ctx.restore();
  };

  /* ---- masthead (replaces the fictional "ORBIT SOCIETY OF DESIGN") ---- */
  ctx.fillStyle='rgba(59,42,23,.78)';
  ctx.font='500 23px Inter, sans-serif';
  track(ctx,'CERTIFICATE',600,206,9,true);
  rule(252,215);

  /* ---- the actual certificate scan, mounted like a print ---- */
  const boxX=104, boxW=TW-208, boxY=290, boxH=690;
  if(img){
    const sc = Math.min(boxW/img.width, boxH/img.height);
    const dw = img.width*sc, dh = img.height*sc;
    const dx = 600 - dw/2, dy = boxY + (boxH - dh)/2;

    ctx.save();
    ctx.shadowColor='rgba(60,44,22,.34)'; ctx.shadowBlur=26;
    ctx.shadowOffsetY=9;
    ctx.fillStyle='#ffffff'; ctx.fillRect(dx-3, dy-3, dw+6, dh+6);
    ctx.restore();

    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.strokeStyle='rgba(59,42,23,.42)'; ctx.lineWidth=1.2;
    ctx.strokeRect(dx-3.5, dy-3.5, dw+7, dh+7);
  } else {
    ctx.fillStyle='rgba(59,42,23,.10)'; ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle='rgba(59,42,23,.45)'; ctx.font='italic 400 40px "EB Garamond", Georgia, serif';
    mid(ctx,'certificate unavailable', boxY + boxH/2);
  }

  /* ---- caption block (replaces "of Excellence" / "PRESENTED TO" etc.) ---- */
  const capY = boxY + boxH + 78;
  ctx.fillStyle=INK; ctx.font='500 54px "EB Garamond", Georgia, serif';
  mid(ctx, meta.issuer, capY);
  // 19px / 6px tracking keeps the widest caption inside the 80..1120 border
  ctx.fillStyle='rgba(59,42,23,.72)'; ctx.font='500 19px Inter, sans-serif';
  track(ctx, String(meta.detail||'').toUpperCase(), 600, capY+42, 6, true);

  /* ---- wax seal, as authored ---- */
  ctx.save(); ctx.translate(258,1372);
  const sg=ctx.createRadialGradient(-24,-28,4,0,0,96);
  sg.addColorStop(0,'#B24236'); sg.addColorStop(1,'#7A2019');
  ctx.fillStyle=sg; ctx.beginPath();
  for(let i=0;i<=48;i++){ const a=i/48*Math.PI*2, r=84+Math.sin(a*9)*4.5;
    ctx[i?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(255,220,205,.30)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(0,0,63,0,7); ctx.stroke();
  ctx.fillStyle='rgba(255,226,212,.90)';
  ctx.font='400 74px "EB Garamond", Georgia, serif';
  mid(ctx,'A',26,0);
  ctx.font='500 13px Inter, sans-serif'; ctx.fillStyle='rgba(255,226,212,.62)';
  track(ctx,'EST MMXVI',0,-40,4,true);
  ctx.restore();

  /* ---- recipient (replaces the two invented countersignatures) ---- */
  ctx.strokeStyle='rgba(59,42,23,.55)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(470,1392); ctx.lineTo(1000,1392); ctx.stroke();
  ctx.fillStyle='rgba(59,42,23,.86)'; ctx.font='italic 400 40px "EB Garamond", Georgia, serif';
  ctx.fillText('Aayush Kumar Gupta',470,1362);
  ctx.fillStyle='rgba(59,42,23,.55)'; ctx.font='500 15px Inter, sans-serif';
  track(ctx,'RECIPIENT',470,1424,5,false);

  rule(1500,180);
  ctx.fillStyle='rgba(59,42,23,.62)'; ctx.font='500 18px Inter, sans-serif';
  track(ctx,'AAYUSH GUPTA · PORTFOLIO',600,1556,6,true);
}
