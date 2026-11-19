const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  await p.setInputFiles('#fileIn', 'maqam_d.wav');
  await p.waitForTimeout(40000);
  const r = await p.evaluate(() => ({ frames: window.__sd.log.length, status: document.querySelector('#status').textContent, play: document.querySelector('#playBtn').textContent }));
  console.log(JSON.stringify(r));
  await p.mouse.move(5, 5);
  await p.screenshot({ path: 'shots/ipad_file_dawayer.png' });
  await p.click('#lenses [data-lens=qalam]'); await p.waitForTimeout(300); await p.screenshot({ path: 'shots/ipad_file_qalam.png' });
  // palette switch must redraw from the record and keep the qarar
  await p.click('#paletteBtn'); await p.waitForTimeout(800); await p.screenshot({ path: 'shots/ipad_file_qalam_bone.png' });
  await p.click('#lenses [data-lens=daw]'); await p.waitForTimeout(300); await p.screenshot({ path: 'shots/ipad_file_daw_bone.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
