"""Synthetic test scene with ground truth, 48 kHz mono.

Sources (labels used in truth.json):
  voiceA  male voice, vowel /a/ (formants 700, 1150, 2600 Hz), maqam Bayati on D3, vibrato
  voiceB  female voice, vowel /i/ (formants 300, 2300, 3000 Hz), maqam Bayati on D4
  oud     plucked string (Karplus-Strong), bright attack, decay
  ney     breathy end-blown flute: few harmonics plus band noise
  drum    darbuka: dum (low body) and tek (sharp rim) in maqsum
  speech  talking, gliding syllables, formants moving
  quiet   room noise only
Writes scene.wav and scene_truth.json (list of {t0, t1, src, notes:[{t0,t1,cents_from_D}]}).
"""
import json, numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter

SR = 48000
rng = np.random.default_rng(7)
BAYATI = [0, 150, 300, 500, 700, 800, 1000, 1200]


def formant_filter(x, formants, bw=(80, 100, 140)):
    y = x.copy()
    out = np.zeros_like(x)
    for f, b in zip(formants, bw):
        r = np.exp(-np.pi * b / SR); th = 2 * np.pi * f / SR
        a = [1, -2 * r * np.cos(th), r * r]
        out += lfilter([1 - r], a, y)
    return out


def glottal(f_track):
    # band-limited sawtooth-like source with a soft spectral tilt
    ph = 2 * np.pi * np.cumsum(f_track) / SR
    y = np.zeros_like(f_track)
    fmax = f_track.max()
    for k in range(1, int((SR / 2 - 500) / fmax)):
        y += np.sin(k * ph) / k ** 1.2
    return y


def voice(notes, base, formants, vib=22, breath=0.02):
    fs, amps, prev = [], [], None
    for deg, dur in notes:
        n = int(dur * SR); t = np.arange(n) / SR
        c = BAYATI[deg % 8] + 1200 * (deg // 8) + rng.normal(0, 6)
        f = base * 2 ** (c / 1200)
        ff = np.full(n, f)
        if prev is not None: ff = prev * (f / prev) ** np.clip(t / 0.06, 0, 1)
        if dur > 0.4: ff *= 2 ** (vib * np.clip((t - 0.2) / 0.2, 0, 1) * np.sin(2 * np.pi * 5.4 * t) / 1200)
        fs.append(ff); amps.append(np.minimum(1, t / 0.04) * np.clip((dur - t) / 0.06, 0, 1)); prev = f
    f = np.concatenate(fs); a = np.concatenate(amps)
    src = glottal(f) + breath * rng.standard_normal(len(f))
    y = formant_filter(src, formants) * a
    return y / (np.abs(y).max() + 1e-9)


def oud(notes, base):
    out = []
    for deg, dur in notes:
        f = base * 2 ** (BAYATI[deg % 8] / 1200 + deg // 8)
        N = int(SR / f); n = int(dur * SR)
        buf = rng.uniform(-1, 1, N); y = np.zeros(n)
        for i in range(n):
            y[i] = buf[i % N]
            buf[i % N] = 0.996 * 0.5 * (buf[i % N] + buf[(i + 1) % N])
        out.append(y)
    y = np.concatenate(out)
    return y / np.abs(y).max()


def ney(notes, base):
    out, prev = [], None
    for deg, dur in notes:
        n = int(dur * SR); t = np.arange(n) / SR
        f = base * 2 ** (BAYATI[deg % 8] / 1200 + deg // 8)
        ph = 2 * np.pi * f * t
        tone = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
        noise = rng.standard_normal(n)
        r = np.exp(-np.pi * 400 / SR); th = 2 * np.pi * f / SR
        bandn = lfilter([1 - r], [1, -2 * r * np.cos(th), r * r], noise) * 6
        env = np.minimum(1, t / 0.15) * np.clip((dur - t) / 0.15, 0, 1)
        out.append((0.7 * tone + 0.6 * bandn + 0.15 * noise) * env)
    y = np.concatenate(out)
    return y / np.abs(y).max()


def darbuka(seconds, bpm=100):
    n = int(seconds * SR); y = np.zeros(n); beat = 60 / bpm
    pattern = [(0, 'dum'), (1, 'tek'), (1.5, 'tek'), (2, 'dum'), (3, 'tek')]
    hits = []
    t = 0.0
    while t < seconds - 0.3:
        for p, kind in pattern:
            tt = t + p * beat
            if tt >= seconds - 0.3: continue
            i = int(tt * SR); L = int(0.25 * SR); k = np.arange(L)
            if kind == 'dum':
                f = 90 * (1 + 0.6 * np.exp(-k / (0.01 * SR)))
                h = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-k / (0.09 * SR))
            else:
                h = (rng.standard_normal(L) * np.exp(-k / (0.006 * SR)) + 0.4 * np.sin(2 * np.pi * 900 * k / SR) * np.exp(-k / (0.02 * SR)))
            y[i:i + L] += h[:max(0, min(L, n - i))]
            hits.append({'t': round(tt, 3), 'kind': kind})
        t += 4 * beat
    return y / np.abs(y).max(), hits


def speech(seconds):
    out, total = [], 0
    while total < seconds:
        for s in range(rng.integers(4, 10)):
            dur = rng.uniform(0.09, 0.22); n = int(dur * SR); t = np.arange(n) / SR
            f = 125 * 2 ** (rng.normal(0, 150) / 1200) * 2 ** ((rng.normal(0, 300) * t / dur) / 1200)
            form = [rng.choice([300, 500, 700]), rng.choice([900, 1500, 2200]), 2700]
            y = formant_filter(glottal(f), form) * np.sin(np.pi * t / dur) ** 0.6
            out.append(y / (np.abs(y).max() + 1e-9) * 0.7); total += dur
            g = int(rng.uniform(0.03, 0.1) * SR); out.append(np.zeros(g)); total += g / SR
        p = int(rng.uniform(0.3, 0.9) * SR); out.append(np.zeros(p)); total += p / SR
    return np.concatenate(out)


# ---- the scene ----
D3, D4 = 146.83, 293.66
phraseA = [(0, .5), (1, .5), (2, 1.0), (1, .5), (0, 1.2)]
phraseA2 = [(3, .5), (4, .5), (5, .8), (4, .5), (3, .5), (2, .5), (1, .4), (0, 1.2)]
phraseB = [(4, .5), (5, .5), (4, .8), (3, .5), (2, .5), (1, .5), (0, 1.3)]
segments = []  # (src, signal, gain)


def add(src, sig, gain=0.8, notes=None):
    segments.append((src, sig * gain, notes))


add('quiet', np.zeros(int(1.5 * SR)))
add('voiceA', voice(phraseA + phraseA2, D3, (700, 1150, 2600)))
add('quiet', np.zeros(int(0.8 * SR)))
add('voiceB', voice(phraseB, D4, (300, 2300, 3000), vib=30))
add('quiet', np.zeros(int(0.8 * SR)))
add('speech', speech(4.0), 0.7)
add('quiet', np.zeros(int(0.6 * SR)))
add('oud', oud([(0, .45), (1, .45), (2, .45), (3, .9), (2, .45), (1, .45), (0, 1.2)], D3 * 2))
add('quiet', np.zeros(int(0.6 * SR)))
add('ney', ney([(4, 1.0), (5, .8), (4, .8), (2, 1.0), (0, 1.6)], D4))
add('quiet', np.zeros(int(0.6 * SR)))
dr, hits = darbuka(6.0)
add('drum', dr, 0.7)
add('quiet', np.zeros(int(0.6 * SR)))
add('voiceA', voice(phraseA2, D3, (700, 1150, 2600)))
add('voiceB', voice(phraseA, D4, (300, 2300, 3000), vib=30))
add('quiet', np.zeros(int(1.0 * SR)))

y, truth, t = [], [], 0.0
for src, sig, notes in segments:
    truth.append({'t0': round(t, 3), 't1': round(t + len(sig) / SR, 3), 'src': src})
    y.append(sig); t += len(sig) / SR
y = np.concatenate(y)
y = y + 0.003 * rng.standard_normal(len(y))
y = y / np.abs(y).max() * 0.85
wavfile.write('scene.wav', SR, (y * 32767).astype(np.int16))
json.dump({'sr': SR, 'duration': len(y) / SR, 'segments': truth, 'drum_hits': hits}, open('scene_truth.json', 'w'), indent=1)
print('scene', round(len(y) / SR, 1), 's')
for s in truth: print(f"  {s['t0']:6.2f}-{s['t1']:6.2f} {s['src']}")
