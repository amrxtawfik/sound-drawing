/* Lenses: each turns the listener's frames into a drawing on its own paper.
   paper: deposited marks, never cleared by a change of estimate. guide: static scaffolding. live: redrawn per frame.
   Every lens receives every frame, so switching lens mid-song shows the whole song. */
(function (root) {
  'use strict';

  var PALETTES = {
    night: { name: 'Night', bg: '#0B0C17', ink: '#E9DFC6', faint: 'rgba(233,223,198,0.10)', faint2: 'rgba(233,223,198,0.22)',
      open: [226, 182, 90], front: [79, 193, 185], light: [255, 243, 214], hit: [224, 87, 58], live: '#4FC1B9', blend: 'lighter', text: '#D9D2BF' },
    bone: { name: 'Bone', bg: '#EFE7D8', ink: '#1B1A17', faint: 'rgba(27,26,23,0.09)', faint2: 'rgba(27,26,23,0.22)',
      open: [27, 26, 23], front: [36, 70, 128], light: [120, 104, 80], hit: [200, 67, 31], live: '#C8431F', blend: 'multiply', text: '#2A2722' }
  };
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  // the colour of a sound: vowel moves it between two inks, brightness lifts it toward light
  function inkOf(P, f) { var c = mix(P.open, P.front, smooth((f.vowel - 0.2) / 0.6)); return mix(c, P.light, 0.55 * smooth(f.brightness)); }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }
  // the type the drawing speaks in: set by the interface's design before the guides are drawn
  var TYPE = { face: 'ui-sans-serif, system-ui, -apple-system, sans-serif', mono: 'ui-monospace, Menlo, monospace',
    notes: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'], qarar: 'qarar', num: function (s) { return String(s); }, hz: function (hz) { return hz >= 1000 ? (hz / 1000) + 'k' : String(hz); }, scale: 1 };
  function rand(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function layer(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------------- Dawayer: the turning ---------------- */
  // angle = absolute pitch class (C at the top), radius = octave: one turn per octave, 65 Hz to 1050 Hz
  function Dawayer(size) {
    var S = size, paper = layer(S, S), guide = layer(S, S), pg = paper.getContext('2d'), gg = guide.getContext('2d');
    var cx = S / 2, cy = S / 2, R0 = S * 0.13, R1 = S * 0.41, CLO = 1200 * Math.log2(65 / 440), CHI = 1200 * Math.log2(1050 / 440);
    var P = null, rnd = rand(7), last = null, rings = [], lp = { c: null, a: 0, lvl: 0 }, hA = new Float32Array(17), lastWall = null;
    function rad(c) { return R0 + (R1 - R0) * (c - CLO) / (CHI - CLO); }
    function ang(c) { return -Math.PI / 2 + 2 * Math.PI * ((((c - 300) % 1200) + 1200) % 1200) / 1200; }
    function pt(c) { var r = rad(c), a = ang(c); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
    function drawGuide() {
      gg.clearRect(0, 0, S, S);
      gg.strokeStyle = P.faint; gg.lineWidth = S / 900;
      gg.beginPath();
      for (var c = CLO; c <= CHI; c += 10) { var p = pt(c); if (c === CLO) gg.moveTo(p[0], p[1]); else gg.lineTo(p[0], p[1]); }
      gg.stroke();
      for (var q = 0; q < 24; q++) {
        var a = -Math.PI / 2 + 2 * Math.PI * q / 24, isNote = q % 2 === 0, r2 = R1 + S * (isNote ? 0.018 : 0.008);
        gg.strokeStyle = isNote ? P.faint2 : P.faint; gg.lineWidth = S / 700;
        gg.beginPath(); gg.moveTo(cx + (R1 + S * 0.004) * Math.cos(a), cy + (R1 + S * 0.004) * Math.sin(a)); gg.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a)); gg.stroke();
        if (isNote) {
          gg.fillStyle = P.faint2; gg.font = (S * 0.019 * TYPE.scale) + 'px ' + TYPE.face; gg.textAlign = 'center'; gg.textBaseline = 'middle';
          var rl = R1 + S * 0.038; gg.fillText(TYPE.notes[q / 2], cx + rl * Math.cos(a), cy + rl * Math.sin(a));
        }
      }
    }
    return {
      id: 'dawayer', paper: paper, guide: guide, size: [S, S],
      setPalette: function (p) { P = p; drawGuide(); },
      clear: function () { pg.clearRect(0, 0, S, S); last = null; rings = []; rnd = rand(7); },
      frame: function (f) {
        pg.globalCompositeOperation = P.blend;
        if (f.kind === 'tone' && f.cents === f.cents && f.conf > 0.2) {
          // pigment settles like sand where the voice dwells: many fine grains, jittered by the voice's own wobble
          var col = inkOf(P, f), nG = 3 + Math.round(18 * f.level * f.conf * (f.held ? 1 : 0.4)), a = 0.09 + 0.2 * f.conf, gmin = Math.max(1.3, S * 0.0016);
          pg.fillStyle = rgba(col, a);
          for (var gi = 0; gi < nG; gi++) {
            var u1 = rnd() || 1e-9, u2 = rnd(), gz = Math.sqrt(-2 * Math.log(u1)) * Math.cos(6.283 * u2), gr = Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(6.283 * rnd());
            var c2 = f.cents + gz * (6 + 25 * f.breath), r2 = rad(c2) + gr * S * 0.004, a2 = ang(c2), sz = gmin * (0.7 + 0.9 * rnd());
            pg.fillRect(cx + r2 * Math.cos(a2), cy + r2 * Math.sin(a2), sz, sz);
          }
          // travel leaves a filament along the spiral, so the paths between notes stay too
          if (last && last.t !== undefined && f.t - last.t < 0.08 && Math.abs(f.cents - last.c) < 500 && f.conf > 0.35) {
            pg.strokeStyle = rgba(col, 0.05 + 0.05 * f.level); pg.lineWidth = Math.max(0.8, S / 1100);
            pg.beginPath(); var steps = Math.max(1, Math.ceil(Math.abs(f.cents - last.c) / 12));
            for (var q = 0; q <= steps; q++) { var cq = last.c + (f.cents - last.c) * q / steps, pq = pt(cq); if (q) pg.lineTo(pq[0], pq[1]); else pg.moveTo(pq[0], pq[1]); }
            pg.stroke();
          }
          last = { c: f.cents, p: pt(f.cents), t: f.t };
        } else if (f.kind === 'breath' && f.level > 0.15) {
          // breath settles as grain around the last pitch, or near the rim when there was none
          var base = last ? last.p : [cx + R1 * 0.9 * Math.cos(f.t), cy + R1 * 0.9 * Math.sin(f.t)];
          pg.fillStyle = rgba(inkOf(P, f), 0.06 + 0.12 * f.breath);
          for (var k = 0; k < 5; k++) { var rr = S * 0.03 * rnd(), aa = 6.283 * rnd(); pg.fillRect(base[0] + rr * Math.cos(aa), base[1] + rr * Math.sin(aa), S / 900 + 1, S / 900 + 1); }
        }
        if (f.hit) {
          // hits ring the centre: low hits heavy and warm, bright hits thin
          var low = f.hit.brightness < 0.35, rr2 = R0 * (0.2 + 0.72 * (1 - Math.exp(-f.hit.strength / 25))) * (0.92 + 0.16 * rnd());
          pg.strokeStyle = rgba(low ? P.hit : P.light, low ? 0.07 : 0.045); pg.lineWidth = S * (low ? 0.004 : 0.0015);
          pg.beginPath(); pg.arc(cx, cy, rr2, 0, 6.283); pg.stroke();
          rings.push({ t: f.t, low: low, s: f.hit.strength });
        }
        pg.globalCompositeOperation = 'source-over';
      },
      live: function (g, f, now, k, log) {
        var wall = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000, dt = lastWall === null ? 0.016 : Math.min(0.1, Math.max(0.001, wall - lastWall)); lastWall = wall;
        // ripples for hits, soft
        rings = rings.filter(function (r) { return now - r.t < 1.2; });
        rings.forEach(function (r) {
          var u = (now - r.t) / 1.2, e = 1 - Math.pow(1 - u, 3);
          g.strokeStyle = rgba(r.low ? P.hit : P.light, 0.28 * (1 - u)); g.lineWidth = S * (r.low ? 0.004 : 0.0015) * (1 - u * 0.6);
          g.beginPath(); g.arc(cx, cy, R0 * (0.3 + 0.9 * e), 0, 6.283); g.stroke();
        });
        // the thread: the last two seconds of melody, glowing along the spiral and fading with age
        if (log && log.length) {
          var TAIL = 2.2, prev = null;
          g.lineCap = 'round';
          for (var i = log.length - 1; i >= 0 && now - log[i].t < TAIL; i--) {
            var e2 = log[i];
            if (e2.kind === 'tone' && e2.cents === e2.cents && e2.conf > 0.3) {
              if (prev && prev.t - e2.t < 0.08 && Math.abs(prev.cents - e2.cents) < 500) {
                var age = (now - e2.t) / TAIL, fade = Math.pow(1 - age, 1.6);
                g.strokeStyle = rgba(inkOf(P, e2), 0.85 * fade); g.lineWidth = S * (0.0012 + 0.005 * e2.level) * (1 - 0.6 * age);
                g.beginPath(); var st2 = Math.max(1, Math.ceil(Math.abs(prev.cents - e2.cents) / 10));
                for (var q2 = 0; q2 <= st2; q2++) { var cq2 = e2.cents + (prev.cents - e2.cents) * q2 / st2, pq2 = pt(cq2); if (q2) g.lineTo(pq2[0], pq2[1]); else g.moveTo(pq2[0], pq2[1]); }
                g.stroke();
              }
              prev = e2;
            } else prev = null;
          }
        }
        // the live point eases toward the voice and fades when it stops; it never jumps
        var target = f && f.kind === 'tone' && f.cents === f.cents && f.conf > 0.3 ? f.cents : null;
        if (target !== null) {
          if (lp.c === null || Math.abs(target - lp.c) > 700) lp.c = target;
          lp.c += (target - lp.c) * (1 - Math.exp(-dt / 0.045)); lp.a += (1 - lp.a) * (1 - Math.exp(-dt / 0.06)); lp.lvl = f.level;
        } else lp.a *= Math.exp(-dt / 0.35);
        if (lp.c !== null && lp.a > 0.02) {
          var p0 = pt(lp.c);
          g.fillStyle = P.live; g.globalAlpha = 0.18 * lp.a; g.beginPath(); g.arc(p0[0], p0[1], S * (0.016 + 0.01 * lp.lvl), 0, 6.283); g.fill();
          g.globalAlpha = lp.a; g.beginPath(); g.arc(p0[0], p0[1], S * (0.0045 + 0.004 * lp.lvl), 0, 6.283); g.fill(); g.globalAlpha = 1;
          // overtones bloom while a note is held, and fade slowly
          var holding = f && f.held && f.kind === 'tone', topOct = null;
          for (var h = 2; h <= 16; h++) {
            var want = holding ? Math.max(0, 1 + f.harmonics[h - 1] / 36) : 0;
            hA[h] += (want - hA[h]) * (1 - Math.exp(-dt / (want > hA[h] ? 0.18 : 0.5)));
            var ch = lp.c + 1200 * Math.log2(h); if (ch > CHI || hA[h] < 0.03) continue;
            var ph = pt(ch), octave = (h & (h - 1)) === 0; if (octave) topOct = ph;
            g.fillStyle = octave ? P.live : rgba(P.light, 1); g.globalAlpha = 0.65 * hA[h] * lp.a;
            g.beginPath(); g.arc(ph[0], ph[1], S * (0.002 + 0.0045 * hA[h]), 0, 6.283); g.fill(); g.globalAlpha = 1;
          }
          if (topOct) { g.strokeStyle = rgba(P.light, 0.12 * lp.a); g.lineWidth = S / 1200; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(topOct[0], topOct[1]); g.stroke(); }
        }
      },
      qarar: function (g, qc) { // a mark on the rim; moves nothing else
        if (qc === null || qc === undefined) return;
        var a = -Math.PI / 2 + 2 * Math.PI * ((((qc - 300) % 1200) + 1200) % 1200) / 1200, r1 = R1 + S * 0.065;
        g.fillStyle = P.live; g.beginPath();
        g.moveTo(cx + (R1 + S * 0.012) * Math.cos(a), cy + (R1 + S * 0.012) * Math.sin(a));
        g.lineTo(cx + r1 * Math.cos(a - 0.025), cy + r1 * Math.sin(a - 0.025)); g.lineTo(cx + r1 * Math.cos(a + 0.025), cy + r1 * Math.sin(a + 0.025)); g.fill();
        g.font = (S * 0.02 * TYPE.scale) + 'px ' + TYPE.face; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(TYPE.qarar, cx + (r1 + S * 0.035) * Math.cos(a), cy + (r1 + S * 0.035) * Math.sin(a));
      }
    };
  }

  /* ---------------- Qalam: the voice writes ---------------- */
  // a page written right to left; height is pitch on a fixed 70 to 1000 Hz scale.
  // A broad nib held at a fixed angle: held notes (horizontal travel) are thick, glides (vertical travel) are hairlines.
  function Qalam(w, h) {
    var W = w, H = h, paper = layer(W, H), guide = layer(W, H), pg = paper.getContext('2d'), gg = guide.getContext('2d');
    var P = null, rnd = rand(11);
    var portrait = H > W, LINES = portrait ? 6 : 4, SEC = portrait ? 10 : 16, mx = W * 0.06, my = H * 0.12;
    var lineH = (H * 0.8 - my) / LINES, WLO = 1200 * Math.log2(70 / 440), WHI = 1200 * Math.log2(1000 / 440), CLO = WLO, CHI = WHI;
    var NIB = -1.2, stroke = null, t0 = null;
    // The page learns its range once. After about 4 s of held notes the window locks to this voice and never moves again.
    // Until then strokes sit in a wide provisional window; at the lock they are set again, once, and the provisional ink fades out.
    var locked = false, heldC = [], buf = [], ghost = null, ghostT = 0, LOCK_HELD = 190, SPAN = 1800, MARGIN = 250;
    function clock() { return typeof performance !== 'undefined' ? performance.now() : 0; }
    function pctl(a, q) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; }
    function place(t, c) {
      var u = (t - t0) / SEC, line = Math.floor(u), frac = u - line;
      if (line >= LINES) return null;
      var x = W - mx - frac * (W - 2 * mx), top = my + line * lineH, y = top + lineH * 0.88 - (lineH * 0.8) * (c - CLO) / (CHI - CLO);
      return { x: x, y: y, line: line, base: top + lineH * 0.9 };
    }
    function drawGuide() {
      gg.clearRect(0, 0, W, H);
      gg.strokeStyle = P.faint; gg.lineWidth = 1;
      for (var l = 0; l < LINES; l++) { var y = my + l * lineH + lineH * 0.9; gg.beginPath(); gg.moveTo(mx, y); gg.lineTo(W - mx, y); gg.stroke(); }
    }
    function shape(g2, st) {
      var pts = st.pts; if (pts.length < 2) return false;
      g2.beginPath(); g2.moveTo(pts[0].x + pts[0].nx, pts[0].y + pts[0].ny);
      for (var i = 1; i < pts.length; i++) g2.lineTo(pts[i].x + pts[i].nx, pts[i].y + pts[i].ny);
      for (i = pts.length - 1; i >= 0; i--) g2.lineTo(pts[i].x - pts[i].nx, pts[i].y - pts[i].ny);
      g2.closePath(); return true;
    }
    function smoothed(st) { // a gentle moving average, so the vibrato shows as life in the line and not as teeth; the ends taper as a reed's do
      var p = st.pts, out = [];
      for (var i = 0; i < p.length; i++) { var a = 0, n = 0; for (var j = Math.max(0, i - 5); j <= Math.min(p.length - 1, i + 5); j++) { a += p[j].y; n++; } var tp = Math.min(1, (i + 1) / 7, (p.length - i) / 5); tp = 0.25 + 0.75 * tp * tp * (3 - 2 * tp); out.push({ x: p[i].x, y: a / n, nx: p[i].nx * tp, ny: p[i].ny * tp }); }
      return { pts: out };
    }
    function ink(g2, st) { if (shape(g2, smoothed(st))) { g2.fillStyle = rgba(st.col, st.a); g2.fill(); } }
    function lift() { if (stroke) ink(pg, stroke); stroke = null; }
    function newPage() { // the old page stays, faint, under the new one: a palimpsest
      lift(); pg.globalCompositeOperation = 'destination-out'; pg.fillStyle = 'rgba(0,0,0,0.82)'; pg.fillRect(0, 0, W, H); pg.globalCompositeOperation = 'source-over';
    }
    function draw(f) {
      var pos = place(f.t, f.cents === f.cents ? f.cents : 0);
      if (!pos) { newPage(); t0 = f.t; pos = place(f.t, f.cents === f.cents ? f.cents : 0); }
      if (f.kind === 'tone' && f.cents === f.cents && f.conf > 0.25) {
        var wdt = lineH * (0.01 + 0.042 * f.level), nx = Math.cos(NIB) * wdt / 2, ny = Math.sin(NIB) * wdt / 2;
        if (stroke && (stroke.line !== pos.line || Math.abs(stroke.pts[stroke.pts.length - 1].x - pos.x) > W * 0.05)) lift();
        if (!stroke) stroke = { pts: [], col: inkOf(P, f), a: 0.55 + 0.4 * f.conf, line: pos.line };
        var last = stroke.pts[stroke.pts.length - 1];
        // the ink follows the voice: colour drifts slowly with its timbre
        var c = inkOf(P, f); stroke.col = [stroke.col[0] * 0.9 + c[0] * 0.1, stroke.col[1] * 0.9 + c[1] * 0.1, stroke.col[2] * 0.9 + c[2] * 0.1];
        stroke.pts.push({ x: pos.x, y: last ? last.y * 0.5 + pos.y * 0.5 : pos.y, nx: nx, ny: ny });
        if (f.breath > 0.3 && last) { // dry brush: a few bristles break away
          pg.strokeStyle = rgba(stroke.col, 0.22); pg.lineWidth = 0.8;
          for (var b = 0; b < 3; b++) { var o = (rnd() - 0.5) * 2.6; if (rnd() < 0.5) continue; pg.beginPath(); pg.moveTo(last.x + o * last.nx, last.y + o * last.ny); pg.lineTo(pos.x + o * nx, pos.y + o * ny); pg.stroke(); }
        }
      } else {
        lift(); // silence and noise lift the pen
        if (f.kind === 'breath' && f.level > 0.2) {
          pg.fillStyle = rgba(inkOf(P, f), 0.16);
          for (var k = 0; k < 3; k++) pg.fillRect(pos.x + (rnd() - 0.5) * 6, pos.base - lineH * 0.3 + (rnd() - 0.5) * lineH * 0.3, 1.3, 1.3);
        }
      }
      if (f.hit) { // a vermilion nuqta under the line for each drum stroke, the rhombus that measures script
        var isHit = !!f.hit, s2 = lineH * (isHit ? 0.05 : 0.026) * (0.6 + 0.4 * Math.min(1, f.strength / 15)), ny2 = isHit ? pos.base + lineH * 0.05 : pos.y - lineH * 0.13;
        pg.fillStyle = isHit ? rgba(P.hit, 0.9) : rgba(inkOf(P, f), 0.85);
        pg.beginPath(); pg.moveTo(pos.x, ny2 - s2); pg.lineTo(pos.x + s2 * 0.8, ny2); pg.lineTo(pos.x, ny2 + s2); pg.lineTo(pos.x - s2 * 0.8, ny2); pg.closePath(); pg.fill();
      }
    }
    function lockNow() {
      var lo = pctl(heldC, 0.05) - MARGIN, hi = pctl(heldC, 0.95) + MARGIN;
      if (hi - lo < SPAN) { var mid = (hi + lo) / 2; lo = mid - SPAN / 2; hi = mid + SPAN / 2; }
      if (lo < WLO) { hi += WLO - lo; lo = WLO; }
      if (hi > WHI) { lo = Math.max(WLO, lo - (hi - WHI)); hi = WHI; }
      lift(); ghost = layer(W, H); ghost.getContext('2d').drawImage(paper, 0, 0); ghostT = clock();
      CLO = lo; CHI = hi; locked = true;
      var keep = buf, t00 = t0; buf = []; pg.clearRect(0, 0, W, H); stroke = null; t0 = t00; rnd = rand(11);
      for (var i = 0; i < keep.length; i++) draw(keep[i]);
    }
    return {
      id: 'qalam', paper: paper, guide: guide, size: [W, H],
      setPalette: function (p) { P = p; drawGuide(); },
      clear: function () { pg.clearRect(0, 0, W, H); stroke = null; t0 = null; rnd = rand(11); locked = false; heldC = []; buf = []; ghost = null; CLO = WLO; CHI = WHI; },
      range: function () { return { lo: CLO, hi: CHI, locked: locked }; },
      frame: function (f) {
        if (t0 === null) { if (!f.active) return; t0 = f.t; }
        if (!locked) {
          buf.push(f);
          if (f.held && f.kind === 'tone' && f.cents === f.cents) heldC.push(f.cents);
          if (heldC.length >= LOCK_HELD) { lockNow(); return; }
          if (buf.length > 2800) { locked = true; buf = []; } // a minute with no held notes (speech, drums): keep the wide window
        }
        draw(f);
      },
      live: function (g, f, now) {
        if (t0 === null) return;
        if (ghost) { // the provisional page fading under the settled one
          var u = (clock() - ghostT) / 900;
          if (u >= 1) ghost = null; else { g.globalAlpha = 1 - u; g.drawImage(ghost, 0, 0); g.globalAlpha = 1; }
        }
        if (stroke) ink(g, stroke); // the wet stroke, until the pen lifts
        var pos = place(now, f && f.cents === f.cents ? f.cents : (CLO + CHI) / 2); if (!pos) return;
        g.strokeStyle = P.faint2; g.lineWidth = 1; g.beginPath(); g.moveTo(pos.x, pos.base - lineH * 0.85); g.lineTo(pos.x, pos.base); g.stroke();
      },
      qarar: function (g, qc) {
        if (qc === null || qc === undefined || t0 === null) return;
        g.strokeStyle = P.live; g.globalAlpha = 0.3; g.setLineDash([2, 6]); g.lineWidth = 1;
        for (var l = 0; l < LINES; l++) for (var o = -5; o <= 3; o++) {
          var c = qc + 1200 * o; if (c < CLO || c > CHI) continue;
          var y = my + l * lineH + lineH * 0.88 - (lineH * 0.8) * (c - CLO) / (CHI - CLO);
          g.beginPath(); g.moveTo(mx, y); g.lineTo(W - mx, y); g.stroke();
        }
        g.setLineDash([]); g.globalAlpha = 1;
      }
    };
  }

  /* ---------------- Daw': light through a screen ---------------- */
  // the spectrum as a lattice of apertures; time moves right to left; energy opens the light
  function Daw(w, h) {
    var W = w, H = h, paper = layer(W, H), guide = layer(W, H), pg = paper.getContext('2d'), gg = guide.getContext('2d');
    var P = null, ROWS = 48, cell = (H * 0.78) / ROWS, top = H * 0.1, step = Math.max(4, Math.round(cell * 0.9)), n = 0, peak = -60, recent = [], GUT = cell * 3.4;
    function star(g2, x, y, r) { g2.rect(x - r * 0.72, y - r * 0.72, r * 1.44, r * 1.44); g2.moveTo(x, y - r); g2.lineTo(x + r, y); g2.lineTo(x, y + r); g2.lineTo(x - r, y); g2.closePath(); }
    function drawGuide() {
      gg.clearRect(0, 0, W, H);
      // the screen: closed apertures, drawn once
      gg.strokeStyle = P.faint; gg.lineWidth = 0.7; gg.beginPath();
      for (var x0 = step / 2 + 2; x0 < W - GUT; x0 += step) for (var r0 = 0; r0 < ROWS; r0++) star(gg, x0, top + r0 * cell + cell / 2, cell * 0.36);
      gg.stroke();
      gg.fillStyle = P.faint2; gg.font = Math.round(cell * 0.9) + 'px ' + TYPE.mono; gg.textAlign = 'right'; gg.textBaseline = 'middle';
      [100, 250, 500, 1000, 2000, 4000].forEach(function (hz) {
        var b = ROWS * Math.log(hz / 60) / Math.log(8000 / 60), y = top + (ROWS - b) * cell;
        gg.fillText(TYPE.hz(hz), W - 6, y);
      });
    }
    function column(bands, pk, col, k) { // k columns back from the newest
      var x = step / 2 + 2 + k * step;
      if (k) pg.clearRect(x - step / 2, 0, step, H);
      for (var b = 0; b < ROWS; b++) {
        var e = (bands[b] - (pk - 42)) / 42; if (e <= 0.32) continue; e = Math.min(1, (e - 0.32) / 0.68);
        var y = top + (ROWS - 1 - b) * cell + cell / 2, r = (cell * 0.5) * Math.pow(e, 0.6);
        // an eight-pointed aperture: two squares, one turned
        pg.fillStyle = rgba(col, 0.35 + 0.65 * e);
        pg.beginPath(); pg.rect(x - r * 0.72, y - r * 0.72, r * 1.44, r * 1.44); pg.fill();
        pg.save(); pg.translate(x, y); pg.rotate(Math.PI / 4); pg.beginPath(); pg.rect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44); pg.fill(); pg.restore();
      }
    }
    return {
      id: 'daw', paper: paper, guide: guide, size: [W, H],
      setPalette: function (p) { P = p; drawGuide(); },
      clear: function () { pg.clearRect(0, 0, W, H); n = 0; peak = -60; recent = []; },
      frame: function (f) {
        // a drum stroke is confirmed a few frames after it lands: find its column and light it vermilion
        if (f.hit) { for (var i = recent.length - 1; i >= 0; i--) if (recent[i].t <= f.hit.t + 0.03) { column(recent[i].bands, recent[i].peak, P.hit, recent[i].k); break; } }
        n++; if (n % 2) return;
        // shift the lattice one column to the right; the newest light enters at the left
        pg.globalCompositeOperation = 'copy'; pg.drawImage(paper, step, 0); pg.globalCompositeOperation = 'source-over';
        pg.clearRect(0, 0, step, H); pg.clearRect(W - GUT, 0, GUT, H);
        var mxb = -200; for (var b = 0; b < ROWS; b++) mxb = Math.max(mxb, f.bands[b]);
        peak = Math.max(mxb, peak - 0.15);
        recent.forEach(function (r) { r.k++; }); recent.push({ t: f.t, bands: f.bands, peak: peak, k: 0 }); if (recent.length > 10) recent.shift();
        column(f.bands, peak, inkOf(P, f), 0);
      },
      live: function () { },
      qarar: function () { }
    };
  }

  var API = { PALETTES: PALETTES, Dawayer: Dawayer, Qalam: Qalam, Daw: Daw, inkOf: inkOf };
  API.TYPE = TYPE;
  root.Lenses = API;
})(typeof self !== 'undefined' ? self : this);
