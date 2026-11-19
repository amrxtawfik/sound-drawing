// headless Chrome with a fake microphone playing scene.wav; screenshots of each lens and palette
const { chromium } = require('playwright');
const scene = process.argv[2] || '/home/claude/sound-drawing-v2/test/scene.wav';
const dev = process.argv[3] || 'iphone';
const VP = dev === 'ipad' ? { width: 1180, height: 820 } : { width: 390, height: 844 };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + scene, '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: VP, deviceScaleFactor: 2, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8770/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await p.click('#micBtn');
  // let all three lenses take in the whole scene
  const secs = +process.argv[4] || 50;
  await p.waitForTimeout(6500); await p.screenshot({ path: `shots/${dev}_dawayer_singing.png` });
  await p.waitForTimeout(secs * 1000 - 6500);
  const fps = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); })(); }));
  console.log('render fps', fps, '| status:', await p.textContent('#status'));
  for (const lens of ['dawayer', 'qalam', 'daw']) {
    await p.mouse.move(10, 10); await p.click(`#lenses [data-lens=${lens}]`); await p.waitForTimeout(400);
    await p.screenshot({ path: `shots/${dev}_${lens}_night.png` });
  }
  await p.click('#paletteBtn'); await p.waitForTimeout(300);
  for (const lens of ['dawayer', 'qalam', 'daw']) { await p.click(`#lenses [data-lens=${lens}]`); await p.waitForTimeout(300); await p.screenshot({ path: `shots/${dev}_${lens}_bone.png` }); }
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
