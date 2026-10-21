# Credits and third-party licenses

The Hydrophonic code in this repository is MIT licensed (see `LICENSE`).
The app loads the following third-party resources at runtime. None of them are bundled in this repository.

| Resource | Author / source | License | Used for |
|---|---|---|---|
| [Tone.js](https://tonejs.github.io/) 14.8.49 | Yotam Mann and contributors, via jsDelivr | MIT | audio engine |
| Salamander Grand Piano | Alexander Holm, samples via `tonejs.github.io/audio/salamander` | CC BY 3.0 | Piano, Jazz |
| FluidR3 GM SoundFont | Frank Wen | MIT | orchestral, guitar, bass, e-piano, harpsichord, celesta, music box samples |
| MIDI.js soundfont conversion | [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) | CC BY 3.0 | hosted FluidR3 samples |
| PDB structures | [RCSB PDB](https://www.rcsb.org/) / wwPDB | CC0 1.0 (please credit the structure authors) | protein structures |
| AlphaFold models | [AlphaFold DB](https://alphafold.ebi.ac.uk/), EMBL-EBI / Google DeepMind | CC BY 4.0 | predicted structures (UniProt input) |
| Fonts: Orbitron, Share Tech Mono, VT323 | Google Fonts | SIL Open Font License | UI |

If you use AlphaFold models, please cite: Jumper, J. et al. Highly accurate protein structure prediction with AlphaFold. *Nature* 596, 583-589 (2021).

The offline demo (`web/src/demo.js`) contains sequence, secondary structure, B-factors and CA coordinates of chain A of PDB entry
[1BD2](https://www.rcsb.org/structure/1BD2) (Ding et al., Immunity 8, 403-411, 1998), PDB data under CC0.

The visualizer is an original implementation inspired by the ideas of MilkDrop (Ryan Geiss): feedback warp, decay, waveforms, shapes.
No MilkDrop or butterchurn code or presets are used.

Style names describe genres only. No melodies from existing works are used; all music is generated from the protein.
