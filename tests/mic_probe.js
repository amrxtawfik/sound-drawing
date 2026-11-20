// fake microphone playing scene.wav: does the mic path run through the worklet, draw, and find the drums?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + require('path').join(__dirname, 'scene.wav'), '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/index.html?skin=hashiya'); await p.waitForTimeout(400);
  await p.click('#micBtn'); await p.waitForTimeout(45000);
  const r = await p.evaluate(() => { const S = window.__sd; return { tap: S.tapKind, on: document.querySelector('#micBtn').classList.contains('on'), status: document.querySelector('#status').textContent, frames: S.log.length, tones: S.log.filter(f => f.kind === 'tone').length, hits: S.log.filter(f => f.hit).length, lvl: getComputedStyle(document.documentElement).getPropertyValue('--lvl') }; });
  await p.screenshot({ path: 'skins/mic_hashiya.png' });
  console.log(JSON.stringify(r), errs.length ? errs : 'no errors'); await b.close();
})();
