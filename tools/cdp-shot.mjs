// Minimal Chrome DevTools Protocol driver (no dependencies) so screenshots and
// DOM/console state are collected against the REAL clock. Headless
// --virtual-time-budget fast-forwards timers while the 1.4 MB certificate
// document is still parsing, which produces false negatives.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const [, , url, outPng, waitMsArg, evalExpr, afterMsArg, dragArg, wArg, hArg] = process.argv;
const waitMs = Number(waitMsArg || 20000);
const afterMs = Number(afterMsArg || 4000);
const winW = Number(wArg || 1200);
const winH = Number(hArg || 950);
// Optional horizontal drag across the sheet, to exercise the drag-to-turn
// paging. Real CDP input is required: the listener lives on the inner window of
// an opaque-origin iframe, so synthetic events on the iframe element would not
// reach it.
const drag = Number(dragArg || 0);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
const port = 9222 + Math.floor(Math.random() * 500);

const chrome = spawn(CHROME, [
  '--headless=new',
  '--no-sandbox',
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--window-size=' + winW + ',' + winH,
  url
], { stdio: 'ignore' });

let ws;
let msgId = 0;
const pending = new Map();
const consoleLines = [];

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('devtools endpoint never came up');
}

const wsUrl = await connect();
ws = new WebSocket(wsUrl);
await new Promise((r) => { ws.onopen = r; });

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    consoleLines.push(
      '[' + m.params.type + '] ' +
      m.params.args.map((a) => a.value ?? a.description ?? a.unserializableValue ?? '?').join(' ')
    );
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    consoleLines.push('[EXCEPTION] ' + (d.exception?.description || d.text));
  }
  if (m.method === 'Log.entryAdded') {
    const e = m.params.entry;
    consoleLines.push('[log:' + e.level + '] ' + e.text + (e.url ? '  <- ' + e.url : ''));
  }
};

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

// Real elapsed time - no virtual clock.
await sleep(waitMs);

let evalResult = null;
if (evalExpr) {
  try {
    const r = await send('Runtime.evaluate', {
      expression: evalExpr, returnByValue: true, awaitPromise: true
    });
    evalResult = r.result?.value ?? r.exceptionDetails?.text ?? null;
  } catch (e) {
    evalResult = 'eval error: ' + e.message;
  }
  // Give the page time to settle after the expression (e.g. a scroll) so the
  // screenshot reflects it.
  await sleep(afterMs);
}

if (drag > 0) {
  const y = 640;
  let x = 500;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    x += drag / steps;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
    await sleep(16);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0 });
  console.log('dragged horizontally by ' + drag + 'px (~' + (drag * 0.006).toFixed(2) + ' rad)');
  // Let the fling decay and the sheet settle onto a whole turn.
  await sleep(6000);
}

const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));

console.log('=== console (' + consoleLines.length + ') ===');
console.log(consoleLines.slice(0, 40).join('\n') || '(none)');
if (evalExpr) {
  console.log('\n=== evaluate ===');
  console.log(typeof evalResult === 'string' ? evalResult : JSON.stringify(evalResult, null, 1));
}
console.log('\nscreenshot: ' + outPng);

ws.close();
chrome.kill();
// Chrome may still be releasing the profile; a failure here is not important.
try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {}
process.exit(0);
