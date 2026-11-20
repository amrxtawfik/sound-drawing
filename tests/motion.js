// film the Dawayer lens while a song plays: frames every 120 ms
const { chromium } = require('playwright');
const file = process.argv[2] || 'maqam_d.wav', tag = process.argv[3] || 'before', lens = process.argv[4] || 'dawayer';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  await p.goto('http://localhost:8770/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.evaluate(l => { document.querySelector(`#lenses [data-lens=${l}]`) && document.querySelector(`#lenses [data-lens=${l}]`).click(); }, lens);
  await p.setInputFiles('#fileIn', file);
  await p.waitForTimeout(9000);
  for (let i = 0; i < 40; i++) { await p.screenshot({ path: `motion/${tag}_${String(i).padStart(2, '0')}.png`, clip: { x: 290, y: 110, width: 600, height: 600 } }); await p.waitForTimeout(120); }
  await b.close();
})();
