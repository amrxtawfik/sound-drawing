// node skins.js skin device lens secs : plays the maqam, shows a caption, wakes the controls and shoots
const { chromium } = require('playwright');
const [skin, dev, lens, secs, pal] = process.argv.slice(2);
const V = { iphone: [390, 844], ipad: [1180, 820] }[dev];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: V[0], height: V[1] }, deviceScaleFactor: 2, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:8770/index.html?skin=${skin}`);
  if (pal === 'bone') await p.click('#paletteBtn');
  await p.setInputFiles('#fileIn', process.env.FILE || 'maqam_d.wav');
  await p.click(`[data-lens="${lens}"]`);
  await p.waitForTimeout(+secs * 1000 - 1500);
  await p.evaluate(() => window.__sd.say('This note keeps returning: the qarar, the home of the maqam.', 'هذه النغمة تعود دائمًا: إنها القرار، بيت المقام.'));
  await p.mouse.move(5, 5); await p.mouse.move(100, 400);
  await p.waitForTimeout(1500);
  const out = `skins/${skin}_${dev}_${lens}${pal ? '_' + pal : ''}.png`;
  await p.screenshot({ path: out });
  console.log(out, errs.length ? errs : 'ok');
  await b.close();
})();
