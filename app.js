(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var view = $('#view'), g = view.getContext('2d');
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  var store = {}; try { store = JSON.parse(localStorage.getItem('sound-drawing') || '{}'); } catch (e) { }
  var S = { lens: store.lens || 'dawayer', palette: store.palette || 'night', captions: store.captions !== false, running: false, mode: null, last: null, lenses: null, listener: null };
  function save() { try { localStorage.setItem('sound-drawing', JSON.stringify({ lens: S.lens, palette: S.palette, captions: S.captions })); } catch (e) { } }

  /* ---------- paper ---------- */
  function makeLenses() {
    var w = Math.round(innerWidth * DPR), h = Math.round(innerHeight * DPR), sq = Math.min(1800, Math.round(Math.min(w, h)));
    S.lenses = { dawayer: Lenses.Dawayer(sq), qalam: Lenses.Qalam(w, h), daw: Lenses.Daw(w, h) };
    applyPalette();
  }
  // every frame is kept, small, so a change of palette can redraw the paper from the record
  S.log = [];
  function keep(f) {
    S.log.push({ t: f.t, kind: f.kind, active: f.active, cents: f.cents, conf: f.conf, level: f.level, held: f.held, onset: f.onset, strength: f.strength,
      brightness: f.brightness, breath: f.breath, vowel: f.vowel, bands: f.bands });
    // the lattice only needs its visible window of spectra
    var keepBands = 400; if (S.log.length > keepBands) S.log[S.log.length - keepBands - 1].bands = null;
  }
  function applyPalette() {
    var P = Lenses.PALETTES[S.palette];
    Object.keys(S.lenses).forEach(function (k) {
      var L = S.lenses[k]; L.setPalette(P); L.clear();
      S.log.forEach(function (f) { if (k !== 'daw' || f.bands) L.frame(f); });
    });
    document.documentElement.dataset.palette = S.palette;
    $('#paletteBtn').setAttribute('aria-label', 'Palette: ' + P.name); $('#paletteBtn').title = 'Palette: ' + P.name;
  }
  function fit() {
    view.width = Math.round(innerWidth * DPR); view.height = Math.round(innerHeight * DPR);
    view.style.width = innerWidth + 'px'; view.style.height = innerHeight + 'px';
  }
  function placement(L) { // contain the lens paper inside the view, centred
    var W = view.width, H = view.height, pw = L.size[0], ph = L.size[1], k = Math.min(W / pw, H / ph);
    return { k: k, x: (W - pw * k) / 2, y: (H - ph * k) / 2 };
  }
  function render() {
    var P = Lenses.PALETTES[S.palette], L = S.lenses[S.lens], pl = placement(L), now = S.listener ? S.listener.state.t : 0;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = P.bg; g.fillRect(0, 0, view.width, view.height);
    g.setTransform(pl.k, 0, 0, pl.k, pl.x, pl.y);
    g.drawImage(L.guide, 0, 0); g.drawImage(L.paper, 0, 0);
    if (S.listener) L.qarar(g, S.listener.tonic.lockedCents());
    L.live(g, S.last, now, pl.k);
    g.setTransform(1, 0, 0, 1, 0, 0);
    requestAnimationFrame(render);
  }

  /* ---------- audio: microphone and recordings share one path ---------- */
  var AC = null, proc = null, ring = null, filled = 0, micStream = null, fileBuf = null, fileSrc = null, fileAt = 0, fileStart = 0, wake = null;
  function ctx() { if (!AC) { var K = window.AudioContext || window.webkitAudioContext; AC = new K(); } if (AC.state === 'suspended' && AC.resume) AC.resume(); return AC; }
  function ensureProc() {
    if (proc) return proc;
    var c = ctx();
    S.listener = S.listener || Listen.Listener(c.sampleRate);
    ring = new Float32Array(2048); filled = 0;
    proc = c.createScriptProcessor(1024, 1, 1);
    proc.onaudioprocess = function (e) {
      var x = e.inputBuffer.getChannelData(0);
      ring.copyWithin(0, 1024); ring.set(x, 1024); filled += 1024;
      e.outputBuffer.getChannelData(0).fill(0);
      if (filled < 2048) return;
      var f = S.listener.push(ring); S.last = f; keep(f);
      var Ls = S.lenses; Ls.dawayer.frame(f); Ls.qalam.frame(f); Ls.daw.frame(f);
      whisper(f);
      if (f.qararChanged) status();
    };
    var mute = c.createGain(); mute.gain.value = 0; proc.connect(mute); mute.connect(c.destination);
    return proc;
  }
  function holdScreen() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () { }); } catch (e) { } }
  function releaseScreen() { try { if (wake) wake.release(); } catch (e) { } wake = null; }

  function startMic() {
    stopAll();
    var c = ctx(); // created inside the tap, so iOS lets it run
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (stream) {
      micStream = stream; var src = c.createMediaStreamSource(stream); src.connect(ensureProc());
      S.mode = 'mic'; S.running = true; holdScreen(); status(); controlsIdle();
      $('#micBtn').textContent = 'Stop'; $('#micBtn').classList.add('on');
    }).catch(function () { say('The microphone is blocked here. Open this page on its own in Safari, or open a recording.', 'الميكروفون محجوب هنا. افتح الصفحة وحدها في سفاري، أو افتح تسجيلًا.', true); });
  }
  function stopMic() { if (micStream) { micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null; } $('#micBtn').textContent = 'Listen'; $('#micBtn').classList.remove('on'); }
  function openFile(file) {
    stopAll();
    var c = ctx();
    status('Opening ' + file.name);
    file.arrayBuffer().then(function (ab) { return new Promise(function (res, rej) { var p = c.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); })
      .then(function (buf) { fileBuf = buf; fileAt = 0; S.fileName = file.name.replace(/\.[^.]+$/, ''); $('#playBtn').hidden = false; playFile(); })
      .catch(function () { say('That file could not be opened.', 'تعذّر فتح هذا الملف.', true); status(); });
  }
  function playFile() {
    if (!fileBuf) return;
    var c = ctx(); ensureProc();
    fileSrc = c.createBufferSource(); fileSrc.buffer = fileBuf; fileSrc.connect(proc); fileSrc.connect(c.destination);
    var from = fileAt >= fileBuf.duration - 0.05 ? 0 : fileAt; fileStart = c.currentTime - from; fileSrc.start(0, from);
    var me = fileSrc; fileSrc.onended = function () { if (fileSrc === me) { fileAt = fileBuf.duration; S.running = false; $('#playBtn').textContent = 'Play'; status(); controlsShow(); releaseScreen(); } };
    S.mode = 'file'; S.running = true; $('#playBtn').textContent = 'Pause'; holdScreen(); status(); controlsIdle();
  }
  function pauseFile() { if (fileSrc) { var s = fileSrc; fileSrc = null; try { s.stop(); } catch (e) { } fileAt = ctx().currentTime - fileStart; } S.running = false; $('#playBtn').textContent = 'Play'; status(); releaseScreen(); }
  function stopAll() { stopMic(); if (fileSrc) pauseFile(); S.running = false; releaseScreen(); }

  /* ---------- the learning layer: one quiet caption, only on confident events ---------- */
  var cap = { lastAt: -99, shown: {}, run: { breath: 0, vowelHold: 0, brightHold: 0, hits: [] }, fast: null, slow: null, lastHeld: null, harmHold: 0 };
  var CAPS = {
    qarar: ['This note keeps returning: the qarar, the home of the maqam.', 'هذه النغمة تعود دائمًا: إنها القرار، بيت المقام.'],
    breath: ['Breath: noise around the tone. It settles as grain.', 'نَفَس: ضجيجٌ حول النغمة، يستقرّ حُبيباتٍ.'],
    bright: ['Brighter: more energy in the high overtones.', 'أسطع: طاقةٌ أكبر في التوافقيات العالية.'],
    vowel: ['Another colour of voice: the vowel or the singer changed, so the ink changed.', 'لونٌ آخر للصوت: تغيّر الحرف أو المغنّي، فتغيّر الحبر.'],
    hits: ['Hits: short bursts with no single pitch. Low ones leave heavy rings.', 'ضربات: دفقاتٌ قصيرة بلا نغمة واحدة؛ الغليظة تترك دوائر ثقيلة.'],
    overtones: ['Each point on the spiral is an overtone of the note you hear.', 'كل نقطة على اللولب نغمةٌ توافقية للنغمة التي تسمعها.'],
    octave: ['Same direction, one turn out: the jawab, an octave above.', 'الاتجاه نفسه بعد دورةٍ كاملة: الجواب.']
  };
  function fire(key, t) {
    if (!S.captions || t - cap.lastAt < 8 || (cap.shown[key] || 0) >= 3) return;
    cap.shown[key] = (cap.shown[key] || 0) + 1; cap.lastAt = t; say(CAPS[key][0], CAPS[key][1]);
  }
  function whisper(f) {
    var t = f.t, R = cap.run, fps = S.listener.fps;
    if (f.qararChanged && f.qarar !== null) fire('qarar', t);
    R.breath = f.kind === 'breath' ? R.breath + 1 : 0; if (R.breath > 1.2 * fps) fire('breath', t);
    if (f.onset && f.kind === 'hit') { R.hits.push(t); R.hits = R.hits.filter(function (h) { return t - h < 3; }); if (R.hits.length >= 4) fire('hits', t); }
    if (f.kind === 'tone' && f.conf > 0.4) {
      if (!cap.fast) { cap.fast = { b: f.brightness, v: f.vowel }; cap.slow = { b: f.brightness, v: f.vowel }; }
      cap.fast.b += (f.brightness - cap.fast.b) * 0.1; cap.fast.v += (f.vowel - cap.fast.v) * 0.1;
      cap.slow.b += (f.brightness - cap.slow.b) * 0.006; cap.slow.v += (f.vowel - cap.slow.v) * 0.006;
      R.brightHold = cap.fast.b - cap.slow.b > 0.22 ? R.brightHold + 1 : 0; if (R.brightHold > 0.6 * fps) fire('bright', t);
      R.vowelHold = Math.abs(cap.fast.v - cap.slow.v) > 0.28 ? R.vowelHold + 1 : 0; if (R.vowelHold > 0.8 * fps) fire('vowel', t);
      var strong = 0; for (var h = 1; h < 12; h++) if (f.harmonics[h] > -25) strong++;
      cap.harmHold = f.held && strong >= 4 ? cap.harmHold + 1 : 0; if (S.lens === 'dawayer' && cap.harmHold > fps) fire('overtones', t);
      if (f.held) {
        if (cap.lastHeld !== null && Math.abs(Math.abs(f.cents - cap.lastHeld) - 1200) < 50) fire('octave', t);
        if (cap.lastHeld === null || Math.abs(f.cents - cap.lastHeld) > 60) cap.lastHeld = f.cents;
      }
    }
  }
  var sayTimer = null;
  function say(en, ar, sticky) {
    var el = $('#caption'); $('#capEn').textContent = en; $('#capAr').textContent = ar || '';
    el.classList.add('on'); clearTimeout(sayTimer); sayTimer = setTimeout(function () { el.classList.remove('on'); }, sticky ? 9000 : 6500);
  }

  /* ---------- chrome ---------- */
  var NOTES = ['A', 'B♭', 'B', 'C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭'];
  function pcName(c) { var s = Math.round(c / 100), off = Math.round(c - s * 100); return NOTES[((s % 12) + 12) % 12] + (off ? (off > 0 ? ' +' : ' −') + Math.abs(off) + '¢' : ''); }
  function status(text) {
    var q = S.listener && S.listener.tonic.lockedCents();
    $('#status').textContent = text || [S.mode === 'mic' && S.running ? 'Listening' : S.mode === 'file' ? (S.fileName || '') + (S.running ? '' : ' · paused') : 'Sound drawing', q !== null && q !== undefined ? 'qarar ' + pcName(q) : ''].filter(Boolean).join(' · ');
  }
  var idleTimer = null;
  function controlsShow() { document.body.classList.remove('idle'); clearTimeout(idleTimer); if (S.running) idleTimer = setTimeout(function () { document.body.classList.add('idle'); }, 3500); }
  function controlsIdle() { controlsShow(); }
  ['pointerdown', 'pointermove', 'keydown'].forEach(function (ev) { addEventListener(ev, controlsShow, { passive: true }); });

  function setLens(id) {
    S.lens = id; save();
    document.querySelectorAll('#lenses button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lens === id)); });
  }
  document.querySelectorAll('#lenses button').forEach(function (b) { b.addEventListener('click', function () { setLens(b.dataset.lens); }); });
  $('#paletteBtn').addEventListener('click', function () { S.palette = S.palette === 'night' ? 'bone' : 'night'; save(); applyPalette(); });
  $('#capBtn').addEventListener('click', function () { S.captions = !S.captions; save(); $('#capBtn').setAttribute('aria-pressed', String(S.captions)); if (S.captions) say('Captions on: short notes on what you are seeing.', 'الشرح مفعّل: ملاحظاتٌ قصيرة عمّا تراه.'); });
  $('#micBtn').addEventListener('click', function () { if (S.mode === 'mic' && S.running) { stopMic(); S.running = false; releaseScreen(); status(); controlsShow(); } else startMic(); });
  $('#fileIn').addEventListener('change', function (e) { var f = e.target.files && e.target.files[0]; if (f) openFile(f); e.target.value = ''; });
  $('#playBtn').addEventListener('click', function () { ctx(); if (S.running && S.mode === 'file') { pauseFile(); controlsShow(); } else playFile(); });
  $('#clearBtn').addEventListener('click', function () {
    Object.keys(S.lenses).forEach(function (k) { S.lenses[k].clear(); });
    S.log = []; if (S.listener) S.listener.tonic.reset(); cap.shown = {}; status();
  });
  $('#saveBtn').addEventListener('click', function () {
    var L = S.lenses[S.lens], P = Lenses.PALETTES[S.palette], c = document.createElement('canvas'); c.width = L.size[0]; c.height = L.size[1];
    var x = c.getContext('2d'); x.fillStyle = P.bg; x.fillRect(0, 0, c.width, c.height); x.drawImage(L.guide, 0, 0); x.drawImage(L.paper, 0, 0);
    if (S.listener) L.qarar(x, S.listener.tonic.lockedCents());
    c.toBlob(function (blob) {
      var a = document.createElement('a'), d = new Date();
      a.href = URL.createObjectURL(blob); a.download = L.id + '-' + d.toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.png';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }, 'image/png');
  });
  var canMic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext;
  $('#micBtn').hidden = !canMic;

  fit(); makeLenses(); setLens(S.lens); $('#capBtn').setAttribute('aria-pressed', String(S.captions)); status();
  var resizeT = null;
  addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(fit, 120); });
  requestAnimationFrame(render);
  window.__sd = S;
})();
