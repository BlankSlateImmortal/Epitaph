# Blender renders (set characters only)

Rendered 3D loops for the important, fixed characters. Everyone else uses the drawn options on the type page.
They show on the type page's **Blender 3D** tab (https://claude.ai/artifact/4vKVix76JFRbiAohD7HvF6#blender).

## Render a character
Run from this folder:

```
blender -b --factory-startup -P scripts/<scene>.py -- --char <key> [--frames N] [--samples N] [--still --frame F]
```

| scene | character | what it is |
|---|---|---|
| `book.py` | antholonious | the closed book: leather, gilt cover, spine kanji, clasp, ribbon |
| `universe.py` | universe | the fixed system: eclipsed core, name ring, five worlds turning in place |
| `blackhole.py` | sils | horizon, photon ring, shader accretion disk, lensed arc, letters falling in |
| `slime.py` | moinera | a metaball slime that keeps rearranging (in progress) |

- `--still` renders one frame to `renders/<scene>-<char>/still-XXXX.png` to check it.
- Without `--still`, it renders every frame and encodes `renders/<scene>-<char>.webm`, `.mp4` and a `.jpg` poster.
- Character data (name, concept, kanji, titles, accent colour) comes from `chars.json`. Edit that file and re-render
  to update a piece.
- Loops are exact: every motion is keyed so that the last frame leads back into the first.
- The engine is EEVEE (runs on this laptop's Intel Iris Xe). A 144–192 frame loop takes about 15–30 minutes, and
  longer when several render at once.

## Fonts
`fonts/` holds open Google Fonts. The `*-Bold/SemiBold/Black/ExtraBold.ttf` files are static cuts made from
the variable fonts with fontTools, because Blender draws variable fonts at their default thin weight.

## Then publish
Copy the new `.webm`, `.mp4` and `.jpg` next to the type page (`type-lab/renders/`), rebuild with
`python3 build-groups.py`, and publish `orbit-type.html` with those files to the same artifact URL.
