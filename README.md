# Hydrophonic

**Turn any protein into music and audio-reactive visuals, right in the browser.**

Type a PDB ID, a UniProt accession (AlphaFold model) or paste a FASTA sequence. Hydrophonic reads the
sequence, secondary structure, hydropathy, charge and flexibility, composes a song in one of 15 styles
and renders a MilkDrop-style visualizer with the 3D backbone in the middle.

An artsy, nerdy science-communication project. No install, no server, no build step.

## Quick start

```bash
git clone https://github.com/<your-name>/hydrophonic.git
cd hydrophonic/web
python3 -m http.server 8000
```

Open <http://localhost:8000>, press **LOAD**, pick a sound, press **PLAY**.
Any static web server works; opening `web/index.html` directly from disk usually works too.

Keyboard: `Space` play/stop, `F` fullscreen, `N` next visual. Double-click a knob to reset it.

## Deploy

**Netlify:** connect the GitHub repo. `netlify.toml` already sets the publish directory to `web`, no build command.
Or drag the `web` folder onto <https://app.netlify.com/drop>.

**GitHub Pages / any static host:** serve the contents of `web/`.

## How a protein becomes music

| Level | Changes every | Protein source | Musical target |
|---|---|---|---|
| Song | once | net charge, mean hydropathy, sequence hash | major/minor, key, random seed |
| Section | 64 residues | majority secondary structure (with hysteresis) | arrangement, chord pool, instruments, visual preset |
| Block | 16 residues | smoothed hydropathy, charge density | chord, melody contour, filters, rhythm density, color |
| Step | 1 residue | residue identity (probability = BIO knob) | melodic interval, accents, ghost notes |

The composer writes phrase forms (AABA, ABAB, ...), motifs, chord progressions and cadences, so the music
stays musical while the protein steers it. `RAW 1:1` mode plays the naive mapping for comparison.

**Styles:** Piano, Baroque counterpoint, Orchestra, Music box, Jazz trio, Bossa nova, Gamelan,
Deep Techno, Acid, Drum & Bass, Synthwave, Berlin School, Ambient, 8-bit RPG, Lo-fi.

**Inputs:** PDB IDs (RCSB), UniProt accessions (AlphaFold DB), FASTA or plain sequences (no structure: a generated
path is shown and labeled), local `.cif` files, and an offline demo (PDB 1BD2, chain A).

## Project structure

```
web/
  index.html          built, self-contained app (this is what gets deployed)
  src/
    ui.html           page layout and styles (90s hardware look)
    bio.js            mmCIF / FASTA parsing, secondary structure, features
    engine.js         song structure, composer, sample loading, scheduling
    styles_*.js       the music styles
    viz.js            WebGL2 visualizer
    app.js            UI wiring
    demo.js           offline demo data
    build.py          inlines everything into web/index.html
legacy/streamlit/     the original Python / Streamlit prototype
```

After editing anything in `web/src`, rebuild:

```bash
python3 web/src/build.py
```

## Requirements

A current desktop browser with WebGL2 and Web Audio (Chrome, Edge, Firefox, Safari 15+).
Internet access is needed for Tone.js, protein data and instrument samples. Without samples the styles fall back to synthesizers.

## Credits

See [CREDITS.md](CREDITS.md). Code: MIT. Samples and data have their own licenses
(Salamander Grand Piano CC BY 3.0, FluidR3 GM MIT, PDB data CC0, AlphaFold DB CC BY 4.0).
