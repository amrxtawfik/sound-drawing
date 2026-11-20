# Sound drawing: spec (v2.1)

## Purpose
Live or recorded sound becomes a drawing that is worth keeping, and that teaches what is heard.

## Principles
1. Draw in a frame that needs no estimate: absolute pitch, absolute time. Estimates (the qarar) are annotations
   that may move without touching what is already drawn. Qalam's pitch window is the one estimate that shapes the
   drawing, so it is made once per session and never moves after.
2. Never name a source. Timbre maps to fixed visual axes: brightness, breath, vowel colour.
3. Uncertainty is material: low confidence thins and breaks the ink; no pitch, no line.
4. Nothing on screen without a reason; the learning layer speaks only on confident events.
5. Nothing jumps: every control has a fixed slot; an unavailable control leaves its slot empty.

## Capture (src/tap.js, src/app.js)
An AudioWorklet gathers input into blocks of 1024 samples and posts them in order; the main thread may lag while it
draws but loses nothing. Fallback: a ScriptProcessor, where a jump in playbackTime is reported to the listener as a
glitch (pending hit dropped, onsets paused 0.1 s). Microphone and recordings share the path.

## Listening (src/listen.js), per frame of 2048 samples, hop 1024
db, level, kind (quiet | tone | breath | hit) with hysteresis, onset and its strength, f0 (YIN, decimated to 16 kHz),
confidence, centroid, brightness 0..1, breath 0..1, vowel 0..1, 16 harmonic amplitudes, 48 log bands (60 Hz to 8 kHz).
Confirmed hit (f.hit): an onset judged over the next 8 frames. It rose less than 4 dB after the onset (attacks at
once), and either stayed unpitched or fell 12 dB. A voice swells in; an oud pluck attacks at once but keeps ringing.
Tonic lock: histogram of held notes (10-cent bins) plus phrase-final notes; locks after 10 s of the same
candidate; replaced only by a challenger that wins by 25% for 10 s.

## Lenses (src/lenses.js): each owns a persistent paper canvas (never cleared by a re-estimate) and a live overlay
- Dawayer: angle = absolute pitch class (C at top), radius = octave (65 Hz to 1050 Hz spiral). Grain settles where the
  voice dwells; travel between notes leaves faint filaments; a glowing thread shows the last 2.2 s of melody; the live
  point glides (45 ms) and fades (350 ms); overtones fade in while a note is held; confirmed hits ring the centre;
  qarar as a rim mark.
- Qalam: a page written right to left in lines; height = pitch. The window starts wide (70 to 1000 Hz) and locks once,
  after about 4 s of held notes, to the 5th..95th percentile of held pitch plus 250 cents, at least 1800 cents wide;
  strokes made before the lock are set again once while the provisional page fades. Broad nib at a fixed angle, width
  from loudness, tapered ends; breath frays the stroke; confirmed hits leave a vermilion nuqta under the line.
- Daw': the log spectrum as a lattice of eight-pointed apertures scrolling right to left; energy opens them; a confirmed
  hit repaints its own column vermilion when it is confirmed.

## Design (index.html): three skins on one page, chosen by ?skin= and remembered
- الهامش (hashiya, default): the chrome is the margin of a manuscript page. Arabic only, Amiri (the Bulaq naskh).
  Words, no containers. The nuqta marks the current lens and is the listening light (opacity follows the level).
  Captions as a gloss with a hairline rule. On iPad landscape the margin is a 200 px column and the page sits left of it.
- أسطرلاب (asturlab): the chrome is an astrolabe's engraving. Arabic, Reem Kufi for labels, Markazi for text. A
  graduated limb across the bottom lights outward with the level; the Listen ring's needle points at the sung pitch
  class, the same angle as Dawayer.
- Sleeve: the chrome is the sleeve text of a record. English, Newsreader Italic and Hanken Grotesk, flush left.
Shared: one language per place; the canvas speaks it too (Arabic note names دو ري مي, Arabic-Indic numerals);
controls in two groups, listening (listen, open, pause or play, notes) and paper (night or paper, save, clear);
clear needs a second tap within 2 s; every hit box at least 44 px tall; controls fade after 3.5 s idle.
Fonts: OFL subsets from google/fonts, self-hosted in fonts/ with OFL.txt.

## Palettes: Night (indigo, gold, faience) and Bone, called Paper in the interface. Switch on screen.
## Learning: one caption at a time, in the place's language, only on confident events, at most every 8 s, 3 per kind.

## Tests
- test_core.js: listener features on synthetic scenes with ground truth (17 assertions, hits included).
- lock_test.js: Qalam locks once and never moves. hitprobe.js: hits under CPU load (six browsers). mic_probe.js: fake
  microphone through the worklet. layout_check.js: hit boxes, overlaps and edges for all skins at four sizes.
- motion.js: filmstrip of Dawayer while a song plays. skins.js: screenshots per skin, device, lens and palette.
- Still to do by hand: a real iPhone and iPad in Safari.
