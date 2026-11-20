# Sound drawing · دواير

Live: https://amrxtawfik.github.io/sound-drawing/

Sound becomes a drawing worth keeping, and the drawing teaches what you hear. Listen live or open a recording.
Everything runs in the browser; no audio leaves the device.

## Three lenses
- **دواير Dawayer**: one turn is one octave. Pigment settles like sand where the voice dwells, so a song leaves a rosette
  of its scale, and the paths between notes stay as faint filaments. The last two seconds of melody glow as a thread
  along the spiral; held notes bloom with their overtones; drum strokes ring the centre; the qarar is a mark on the rim.
- **قلم Qalam**: the voice writes right to left with a broad nib. The page learns the singer's range once, in the first
  seconds of held notes, and never moves after. Held notes are thick, glides are hairlines, strokes taper, breath frays
  the line, each drum stroke leaves a vermilion nuqta, silence lifts the pen. A full page stays faint under the next.
- **ضوء Daw'**: the spectrum as light through a mashrabiya. Works for drums and DJ sets, where pitch does not exist.

## Three designs
The interface comes in three designs, chosen with `?skin=` and remembered on the device:
- [الهامش, the margin](https://amrxtawfik.github.io/sound-drawing/?skin=hashiya) (default): Arabic, set in Amiri, as the margin of a manuscript page.
- [أسطرلاب, the astrolabe](https://amrxtawfik.github.io/sound-drawing/?skin=asturlab): Arabic Kufi engraving; the limb lights with the voice and the needle points at the sung note.
- [Sleeve](https://amrxtawfik.github.io/sound-drawing/?skin=sleeve): English, as the sleeve text of a record.

## What it hears
Pitch (YIN), confidence, loudness, brightness, breath, vowel colour, onsets and confirmed drum strokes, 16 overtones,
48 log bands. It never names a source: timbre maps to fixed visual axes, so similar sounds look alike and different
ones look different. The qarar locks slowly and only moves a mark; nothing already drawn ever moves. Audio is captured
on the audio thread (AudioWorklet), so heavy drawing never drops sound.

## Tests
`python3 tests/sounds.py && python3 tests/scenes2.py && node tests/test_core.js` (17 assertions on synthetic scenes with
ground truth). Browser tests (headless Chrome, served from the repo root on port 8770): `lock_test.js`, `hitprobe.js`,
`mic_probe.js`, `layout_check.js`, `motion.js`, `skins.js`. See SPEC.md.

Fonts are subsets of OFL families from google/fonts; licences in `fonts/OFL.txt`.
