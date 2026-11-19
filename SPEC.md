# Sound drawing v2: spec

## Purpose
Live or recorded sound becomes a drawing that is worth keeping, and that teaches what is heard.

## Principles
1. Draw in a frame that needs no estimate: absolute pitch, absolute time. Estimates (the qarar) are annotations
   that may move without touching what is already drawn.
2. Never name a source. Timbre maps to fixed visual axes: brightness, breath, vowel colour.
3. Uncertainty is material: low confidence thins and breaks the ink; no pitch, no line.
4. Nothing on screen without a reason; the learning layer speaks only on confident events.

## Listening (src/listen.js), per frame of 2048 samples, hop 1024
db, level, kind (quiet | tone | breath | hit) with hysteresis, onset and its strength, f0 (YIN, decimated to 16 kHz),
confidence, centroid, brightness 0..1, breath 0..1, vowel 0..1, 16 harmonic amplitudes, 48 log bands (60 Hz to 8 kHz).
Tonic lock: histogram of held notes (10-cent bins) plus phrase-final notes; locks after 10 s of the same
candidate; replaced only by a challenger that wins by 25% for 10 s. Manual tap overrides.

## Lenses (src/lens-*.js): each owns a persistent paper canvas (never cleared by a re-estimate) and a live overlay
- Dawayer: angle = absolute pitch class (C at top), radius = octave (65 Hz to 1050 Hz spiral). Deposit where the voice
  dwells; colour from brightness; grain from breath; harmonics of the live note as points; onsets as rings
  (heavy for low hits, thin for bright ones); qarar as a rim mark.
- Qalam: a page written right to left in lines of 16 s; height = pitch on a fixed 70 to 1000 Hz log scale; broad nib at a
  fixed angle, width from loudness; breath splits the stroke; onsets leave a nuqta; silence lifts the pen.
- Daw': the log spectrum as a lattice of apertures scrolling right to left; energy opens them.

## Palettes: Night (indigo, gold, faience) and Bone (bone, ink, vermilion). Switch on screen.
## Learning: off | whispers. One caption at a time, bilingual, only on confident events, at most every 8 s.
## Tests: node feature tests on synthetic scenes with ground truth; headless Chrome with a fake microphone; iPhone.
