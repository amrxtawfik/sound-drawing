# Sound drawing · دواير

Live: https://amrxtawfik.github.io/sound-drawing/

Sound becomes a drawing worth keeping, and the drawing teaches what you hear. Listen live or open a recording.
Everything runs in the browser; no audio leaves the device.

## Three lenses
- **دواير Dawayer**: one turn is one octave. Pigment settles like sand where the voice dwells, so a song leaves a rosette
  of its scale. The live note shows its overtones on the same spiral; drum hits ring the centre; the qarar is a mark on the rim.
- **قلم Qalam**: the voice writes right to left with a broad nib. Held notes are thick, glides are hairlines,
  breath splits the stroke, every attack leaves a nuqta, silence lifts the pen. A full page stays faint under the next.
- **ضوء Daw'**: the spectrum as light through a mashrabiya. Works for drums and DJ sets, where pitch does not exist.

## What it hears
Pitch (YIN), confidence, loudness, brightness, breath, vowel colour, onsets, 16 overtones, 48 log bands.
It never names a source: timbre maps to fixed visual axes, so similar sounds look alike and different ones look different.
The qarar locks slowly and only moves a mark; nothing already drawn ever moves.

## Tests
`python3 tests/sounds.py && python3 tests/scenes2.py && node tests/test_core.js` (feature and reference assertions on
synthetic scenes with ground truth). Browser tests run headless Chrome with a fake microphone.
