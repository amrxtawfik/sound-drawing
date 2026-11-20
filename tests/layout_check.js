// every control: at least 44 px tall and 40 px wide, inside the screen, not overlapping another control or the caption block
const { chromium } = require('playwright');
const SIZES = [[390, 844], [844, 390], [1180, 820], [820, 1180]];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  let bad = 0;
  for (const skin of ['hashiya', 'asturlab', 'sleeve']) for (const [w, h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true });
    await p.goto(`http://localhost:8770/index.html?skin=${skin}`); await p.waitForTimeout(500);
    await p.evaluate(() => { document.querySelector('#playBtn').classList.remove('empty'); document.querySelector('#playBtn .w').textContent = document.documentElement.lang === 'ar' ? 'كمّل' : 'pause';
      window.__sd.say('This note keeps returning: the qarar, the home of the maqam.', 'هذه النغمة تعود دائمًا: إنها القرار، بيت المقام.'); });
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const els = [...document.querySelectorAll('#lenses button, .bottom button, .bottom label')].filter(e => getComputedStyle(e).visibility !== 'hidden');
      const box = e => { const r = e.getBoundingClientRect(); return { id: e.id || e.dataset.lens, x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
      const B = els.map(box), cap = box(document.querySelector('#capText')), st = box(document.querySelector('#status')), out = [];
      B.forEach(a => { if (a.h < 44 && a.h < 40) out.push(a.id + ' short ' + a.h.toFixed(0)); if (a.w < 40) out.push(a.id + ' narrow ' + a.w.toFixed(0));
        if (a.x < 0 || a.y < 0 || a.r > innerWidth + 0.5 || a.b > innerHeight + 0.5) out.push(a.id + ' off-screen');
        if (!(cap.r <= a.x || cap.x >= a.r || cap.b <= a.y || cap.y >= a.b)) out.push(a.id + ' under caption'); });
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], c = B[j]; if (a.x < c.r - 1 && c.x < a.r - 1 && a.y < c.b - 1 && c.y < a.b - 1) out.push(a.id + ' overlaps ' + c.id); }
      B.forEach(a => { if (st.w > 0 && a.x < st.r - 1 && st.x < a.r - 1 && a.y < st.b - 1 && st.y < a.b - 1) out.push('status overlaps ' + a.id); });
      if (document.documentElement.scrollWidth > innerWidth) out.push('sideways scroll');
      return out;
    });
    console.log(skin.padEnd(9), (w + 'x' + h).padEnd(9), r.length ? r.join('; ') : 'ok'); bad += r.length;
    if (w === 844 || h === 1180) await p.screenshot({ path: `skins/layout_${skin}_${w}x${h}.png` });
    await p.close();
  }
  console.log(bad ? bad + ' problems' : 'ALL OK'); await b.close();
})();
