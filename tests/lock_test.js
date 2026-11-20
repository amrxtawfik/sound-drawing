// plays a file into the page and reads Qalam's window before and after the lock
const { chromium } = require('playwright');
const file = process.argv[2] || 'maqam_d.wav';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/index.html');
  await p.evaluate(() => { const s = window.__sd; });
  await p.setInputFiles('#fileIn', file);
  const samples = [];
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(2000); samples.push(await p.evaluate(() => { const q = window.__sd.lenses.qalam.range(); return [+(window.__sd.last ? window.__sd.last.t : 0).toFixed(1), Math.round(q.lo), Math.round(q.hi), q.locked]; })); }
  console.log(samples.map(s => s.join(' ')).join('\n'));
  // the window must not change after the lock
  const after = samples.filter(s => s[3]); const moved = after.some(s => s[1] !== after[0][1] || s[2] !== after[0][2]);
  console.log('locked:', after.length > 0, 'moved after lock:', moved, 'errors:', errs.length ? errs : 'none');
  await b.close();
})();
