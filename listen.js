/* Listen: per-frame audio features and live grouping of sounds into sources.
   Pure functions plus a small stateful Listener. Runs in the page and in node for tests.
   Frame: 2048-sample window, 1024 hop at the input rate (about 47 frames per second at 48 kHz). */
(function (root) {
  'use strict';

  function FFT(n) {
    var rev = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2), i, j, bits = Math.log2(n);
    for (i = 0; i < n; i++) { var r = 0; for (j = 0; j < bits; j++) r = (r << 1) | ((i >> j) & 1); rev[i] = r; }
    for (i = 0; i < n / 2; i++) { cos[i] = Math.cos(-2 * Math.PI * i / n); sin[i] = Math.sin(-2 * Math.PI * i / n); }
    return function (re, im) {
      for (i = 0; i < n; i++) { j = rev[i]; if (j > i) { var t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (var size = 2; size <= n; size <<= 1) {
        var half = size >> 1, step = n / size;
        for (i = 0; i < n; i += size) for (j = 0; j < half; j++) {
          var k = j * step, a = i + j, b = a + half;
          var tr = re[b] * cos[k] - im[b] * sin[k], ti = re[b] * sin[k] + im[b] * cos[k];
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    };
  }

  function melBank(nfft, sr, nb, fmin, fmax) {
    var mel = function (f) { return 2595 * Math.log10(1 + f / 700); }, inv = function (m) { return 700 * (Math.pow(10, m / 2595) - 1); };
    var pts = [], m0 = mel(fmin), m1 = mel(fmax), i;
    for (i = 0; i < nb + 2; i++) pts.push(Math.floor((nfft + 1) * inv(m0 + (m1 - m0) * i / (nb + 1)) / sr));
    var bank = [];
    for (i = 1; i <= nb; i++) {
      var w = [];
      for (var k = pts[i - 1]; k <= pts[i + 1]; k++) {
        var v = k < pts[i] ? (k - pts[i - 1]) / Math.max(1, pts[i] - pts[i - 1]) : (pts[i + 1] - k) / Math.max(1, pts[i + 1] - pts[i]);
        if (v > 0) w.push([k, v]);
      }
      bank.push(w);
    }
    return bank;
  }

  /* One analyser for one sample rate. frame(x) takes the newest 2048 samples and returns features. */
  function Analyser(sr) {
    var N = 2048, fft = FFT(N), re = new Float64Array(N), im = new Float64Array(N), hann = new Float64Array(N), i;
    for (i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    var bank = melBank(N, sr, 32, 60, Math.min(8000, sr / 2 - 100));
    var prevMag = new Float64Array(N / 2), binHz = sr / N;
    var lo = Math.round(80 / binHz), hi = Math.round(Math.min(8000, sr / 2 - 200) / binHz);
    // YIN on a 3x decimated copy (16 kHz at 48 kHz input)
    var dec = Math.max(1, Math.round(sr / 16000)), dsr = sr / dec, W = Math.floor(N / dec), tauMax = Math.min(Math.floor(dsr / 65), (W >> 1) - 1), tauMin = Math.floor(dsr / 1100);
    var xd = new Float64Array(W), d = new Float64Array(tauMax + 1);
    return {
      sr: sr, N: N, hop: N / 2,
      frame: function (x) {
        var mean = 0, e = 0;
        for (i = 0; i < N; i++) mean += x[i];
        mean /= N;
        for (i = 0; i < N; i++) { var v = x[i] - mean; e += v * v; re[i] = v * hann[i]; im[i] = 0; }
        var rms = Math.sqrt(e / N), db = 20 * Math.log10(rms + 1e-9);
        fft(re, im);
        var mag = new Float64Array(N / 2), sum = 0, wsum = 0, logsum = 0, cnt = 0, flux = 0, k;
        for (k = 1; k < N / 2; k++) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        for (k = lo; k < hi; k++) { var p = mag[k] * mag[k] + 1e-12; sum += p; wsum += p * k * binHz; logsum += Math.log(p); cnt++; }
        var centroid = wsum / sum, flatness = Math.exp(logsum / cnt) / (sum / cnt);
        for (k = 1; k < N / 2; k++) { var lm = Math.log(1 + 1000 * mag[k]), df = lm - prevMag[k]; if (df > 0) flux += df; prevMag[k] = lm; }
        var rsum = 0, roll = 0; for (k = lo; k < hi; k++) { rsum += mag[k] * mag[k]; if (rsum >= 0.85 * sum) { roll = k * binHz; break; } }
        // mfcc
        var mb = new Float64Array(32);
        for (var b = 0; b < 32; b++) { var s = 1e-10; bank[b].forEach(function (kv) { s += mag[kv[0]] * mag[kv[0]] * kv[1]; }); mb[b] = Math.log(s); }
        var mfcc = new Float64Array(13);
        for (var c = 0; c < 13; c++) { var a = 0; for (b = 0; b < 32; b++) a += mb[b] * Math.cos(Math.PI * c * (b + 0.5) / 32); mfcc[c] = a; }
        // pitch (YIN)
        for (i = 0; i < W; i++) { var acc = 0; for (var q = 0; q < dec; q++) acc += x[i * dec + q]; xd[i] = acc / dec - mean; }
        var run = 0, best = -1, Wi = W - tauMax;
        d[0] = 1;
        for (var tau = 1; tau <= tauMax; tau++) {
          var sacc = 0;
          for (i = 0; i < Wi; i++) { var dd = xd[i] - xd[i + tau]; sacc += dd * dd; }
          run += sacc; d[tau] = run > 0 ? sacc * tau / run : 1;
        }
        for (tau = tauMin; tau <= tauMax; tau++) if (d[tau] < 0.15) { while (tau + 1 <= tauMax && d[tau + 1] < d[tau]) tau++; best = tau; break; }
        if (best < 0) { var mv = 9; for (tau = tauMin; tau <= tauMax; tau++) if (d[tau] < mv) { mv = d[tau]; best = tau; } }
        var tb = best;
        if (best > tauMin && best < tauMax) { var A = d[best - 1], B = d[best], C = d[best + 1], den = A - 2 * B + C; if (den) tb = best + 0.5 * (A - C) / den; }
        var f0 = dsr / tb;
        // 48 log-spaced bands, 60 Hz to 8 kHz (for the lattice)
        var bands = new Float32Array(48);
        for (b = 0; b < 48; b++) {
          var f1 = 60 * Math.pow(8000 / 60, b / 48), f2 = 60 * Math.pow(8000 / 60, (b + 1) / 48), k1 = Math.max(1, Math.floor(f1 / binHz)), k2 = Math.max(k1 + 1, Math.ceil(f2 / binHz)), sb = 0;
          for (k = k1; k < k2 && k < N / 2; k++) sb += mag[k] * mag[k];
          bands[b] = 10 * Math.log10(sb / (k2 - k1) + 1e-12);
        }
        // flatness of the 2 to 8 kHz band (breath lives there), and low and mid energy (vowel colour)
        var hk1 = Math.round(2000 / binHz), hk2 = Math.min(N / 2 - 1, Math.round(8000 / binHz)), hl = 0, ha = 0, hc = 0, eLow = 1e-12, eMid = 1e-12;
        for (k = hk1; k < hk2; k++) { var hp = mag[k] * mag[k] + 1e-12; hl += Math.log(hp); ha += hp; hc++; }
        // vowel colour: energy where an open /a/ resonates (500 to 1300 Hz) against where a front /i/ does (1800 to 3200 Hz)
        for (k = Math.round(500 / binHz); k < Math.round(1300 / binHz); k++) eLow += mag[k] * mag[k];
        for (k = Math.round(1800 / binHz); k < Math.round(3200 / binHz); k++) eMid += mag[k] * mag[k];
        // amplitudes of the first 16 harmonics of f0, in dB relative to the strongest
        var harmonics = new Float32Array(16), hmax = -1e9;
        for (var h = 1; h <= 16; h++) {
          var kk = Math.round(h * f0 / binHz), m2 = 0;
          for (k = Math.max(1, kk - 1); k <= Math.min(N / 2 - 1, kk + 1); k++) m2 = Math.max(m2, mag[k]);
          harmonics[h - 1] = 20 * Math.log10(m2 + 1e-9); if (harmonics[h - 1] > hmax) hmax = harmonics[h - 1];
        }
        for (h = 0; h < 16; h++) harmonics[h] -= hmax;
        return { db: db, centroid: centroid, flatness: flatness, hiFlat: Math.exp(hl / hc) / (ha / hc), hiShare: ha / sum, front: eMid / (eLow + eMid), rolloff: roll, flux: flux, mfcc: mfcc, f0: f0, harm: Math.max(0, 1 - d[best]), mag: mag, bands: bands, harmonics: harmonics };
      }
    };
  }

  /* Tonic lock. History lives in absolute cents; the qarar is an annotation that locks slowly.
     Evidence: time on held notes (pitch class, 10-cent bins) plus a bonus for the last note before a pause. */
  function Tonic(fps) {
    var hist = new Float64Array(120), cand = null, candSince = 0, locked = null, lockedAt = null, manual = false;
    function score(bin) { var s = 0; for (var o = -2; o <= 2; o++) s += hist[(bin + o + 120) % 120] * Math.exp(-o * o / 2); return s; }
    function bestBin() { var bb = 0, bs = -1; for (var i = 0; i < 120; i++) { var sc = score(i); if (sc > bs) { bs = sc; bb = i; } } return { bin: bb, s: bs }; }
    return {
      hist: hist,
      add: function (cents, weight) { hist[Math.floor((((cents % 1200) + 1200) % 1200) / 10)] += weight; },
      update: function (t) {
        if (manual) return locked;
        var b = bestBin(); if (b.s < 3) return locked;          // need about 3 s of held notes first
        if (cand === null || Math.abs(((b.bin - cand + 60) % 120 + 120) % 120 - 60) > 2) { cand = b.bin; candSince = t; }
        if (locked === null) { if (t - candSince >= 10) { locked = cand; lockedAt = t; } }
        else if (cand !== locked && t - candSince >= 10 && score(cand) > 1.25 * score(locked)) { locked = cand; lockedAt = t; }
        return locked;
      },
      lockedCents: function () { return locked === null ? null : locked * 10 + 5; },
      pin: function (cents) { manual = cents !== null; locked = cents === null ? null : Math.floor((((cents % 1200) + 1200) % 1200) / 10); },
      reset: function () { hist.fill(0); cand = null; locked = null; manual = false; }
    };
  }

  /* Listener: one frame in, a description of what is heard out.
     kind: quiet | tone | breath | hit, with hysteresis so it does not flicker.
     brightness, breath and vowel are fixed axes (never re-fitted), so similar sounds always look similar. */
  function Listener(sr) {
    var an = Analyser(sr), fps = sr / an.hop, tonic = Tonic(fps);
    var st = { t: 0, n: 0, loud: -40, noise: null, fluxHist: [], lastOnset: -10, kind: 'quiet', kindN: 0, pending: null, pendingN: 0,
      f0Hist: [], held: { c: null, n: 0 }, lastTone: -10, lastNote: null, newQarar: false };
    function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function median(a) { var b = a.slice().sort(function (p, q) { return p - q; }); return b[b.length >> 1]; }
    return {
      fps: fps, hop: an.hop, N: an.N, tonic: tonic, state: st,
      push: function (x) {
        var f = an.frame(x), t = st.n / fps; st.n++; st.t = t;
        if (st.noise === null) st.noise = f.db;
        st.noise = f.db < st.noise ? f.db : st.noise + 0.25 / fps;
        st.loud = Math.max(f.db, st.loud - 1.5 / fps);
        var active = f.db > Math.max(st.noise + 12, st.loud - 42);
        // onsets: log spectral flux over an adaptive median threshold
        st.fluxHist.push(f.flux); if (st.fluxHist.length > Math.round(fps * 1.5)) st.fluxHist.shift();
        var fm = median(st.fluxHist), mad = median(st.fluxHist.map(function (v) { return Math.abs(v - fm); })) + 1e-6;
        var strength = (f.flux - fm) / (mad * 1.4826);
        var onset = active && strength > 4 && t - st.lastOnset > 0.07;
        if (onset) st.lastOnset = t;
        // raw kind for this frame
        var tonalRaw = active && f.harm > 0.62 && f.f0 > 62 && f.f0 < 1100;
        var raw = !active ? 'quiet' : tonalRaw ? 'tone' : (t - st.lastOnset < 0.1 ? 'hit' : (f.hiFlat > 0.3 || f.flatness > 0.2 ? 'breath' : 'tone'));
        if (raw === 'tone' && !tonalRaw) raw = 'breath';
        // hysteresis: a hit is taken at once; other changes need 3 frames
        if (raw === 'hit' || raw === st.kind) { st.kind = raw; st.pending = null; st.pendingN = 0; }
        else { if (raw === st.pending) st.pendingN++; else { st.pending = raw; st.pendingN = 1; } if (st.pendingN >= 3) { st.kind = raw; st.pending = null; st.pendingN = 0; } }
        // pitch: median of 5 with an octave guard
        var f0 = NaN, cents = NaN;
        if (tonalRaw) {
          st.f0Hist.push(f.f0); if (st.f0Hist.length > 5) st.f0Hist.shift();
          var m5 = median(st.f0Hist), r = f.f0 / m5;
          f0 = (r > 1.7 || r < 0.6) ? m5 : f.f0;
          cents = 1200 * Math.log2(f0 / 440);
          st.lastTone = t;
        } else if (t - st.lastTone > 0.15) st.f0Hist = [];
        // held notes feed the tonic: steady within 40 cents for at least 0.2 s
        var held = false;
        if (cents === cents) {
          if (st.held.c !== null && Math.abs(cents - st.held.c) < 40) { st.held.n++; st.held.c += (cents - st.held.c) / st.held.n; }
          else { if (st.held.n >= 0.2 * fps) st.lastNote = { c: st.held.c, n: st.held.n }; st.held = { c: cents, n: 1 }; }
          held = st.held.n >= 0.2 * fps;
          if (held) tonic.add(cents, 1 / fps);
        } else if (st.held.n >= 0.2 * fps && t - st.lastTone > 0.3) {
          // a pause after a held note: the phrase came to rest there
          tonic.add(st.held.c, 1.5); st.lastNote = { c: st.held.c, n: st.held.n }; st.held = { c: null, n: 0 };
        }
        var before = tonic.lockedCents();
        if (st.n % Math.round(fps / 2) === 0) tonic.update(t);
        var qarar = tonic.lockedCents();
        var brightness = clamp((Math.log2(Math.max(100, f.centroid)) - Math.log2(250)) / (Math.log2(4000) - Math.log2(250)));
        var breath = clamp(0.65 * clamp((f.hiFlat - 0.05) / 0.45) + 0.35 * clamp((0.9 - f.harm) / 0.5));
        return {
          t: t, db: f.db, level: clamp((f.db - (st.loud - 42)) / 42), active: active, kind: st.kind, onset: onset, strength: Math.max(0, strength),
          f0: f0, cents: cents, conf: tonalRaw ? clamp((f.harm - 0.55) / 0.4) : 0, held: held,
          centroid: f.centroid, brightness: brightness, breath: breath, vowel: Math.max(0, Math.min(1, (Math.log10(f.front / (1 - f.front + 1e-9)) + 3) / 3)),
          harmonics: f.harmonics, bands: f.bands, qarar: qarar, qararChanged: qarar !== before
        };
      }
    };
  }

  var API = { FFT: FFT, Analyser: Analyser, Listener: Listener, Tonic: Tonic };
  root.Listen = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : this);
