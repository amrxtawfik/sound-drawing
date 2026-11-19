import json, numpy as np
from scipy.io import wavfile
import importlib.util
spec = importlib.util.spec_from_file_location('s', 'sounds.py')
# reuse generators without re-running the scene: exec the defs only
src = open('sounds.py').read().split('# ---- the scene ----')[0]
ns = {}; exec(src, ns)
SR = ns['SR']; voice = ns['voice']; speech = ns['speech']
rng = np.random.default_rng(3)
D3 = 146.83
phr = [[(0,.5),(1,.5),(2,1.),(1,.5),(0,1.4)], [(3,.5),(4,.5),(5,.8),(4,.5),(3,.5),(2,.5),(1,.4),(0,1.4)],
       [(2,.5),(3,.5),(4,1.),(3,.5),(2,.5),(1,.5),(0,1.4)], [(4,.5),(5,.5),(7,1.),(6,.5),(5,.5),(4,.6),(3,.5),(2,.5),(1,.5),(0,1.5)]]
out = []
while sum(len(o) for o in out) < 42 * SR:
    p = phr[rng.integers(0, len(phr))]
    out.append(voice(p, D3, (700, 1150, 2600)) * 0.8); out.append(np.zeros(int(rng.uniform(.5, 1.2) * SR)))
y = np.concatenate(out); y = y / np.abs(y).max() * .8 + 0.002 * rng.standard_normal(len(y))
wavfile.write('maqam_d.wav', SR, (y * 32767).astype(np.int16))
s = speech(32.0); s = s / np.abs(s).max() * .8 + 0.002 * rng.standard_normal(len(s))
wavfile.write('speech30.wav', SR, (s * 32767).astype(np.int16))
print('maqam', len(y)/SR, 'speech', len(s)/SR)
