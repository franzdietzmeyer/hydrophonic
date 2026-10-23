// Hydrophonic, protein-to-music synthesizer. Copyright (C) 2026 Franz Dietzmeyer
// SPDX-License-Identifier: AGPL-3.0-or-later  (see LICENSE; source: https://github.com/franzdietzmeyer/hydrophonic)
// ---------- composer styles ----------
// bit reduction via a static WaveShaper curve (no AudioWorklet needed, works from file://)
function crusher(R, bits){ const L = Math.pow(2, bits - 1); return track(R, new Tone.WaveShaper(v => Math.round(v * L) / L, 4096)); }
// Rhythm templates: [startStep, lengthSteps] on a 16-slot grid
const RH_PIANO = {   // 8th-note grid, 16 slots = 2 bars
  sparse: [[[0,6],[6,2],[8,8]], [[0,4],[4,4],[8,6],[14,2]], [[0,3],[3,1],[4,4],[8,8]], [[0,8],[8,4],[12,4]]],
  mid:    [[[0,2],[2,2],[4,4],[8,2],[10,2],[12,4]], [[0,3],[3,1],[4,2],[6,2],[8,4],[12,4]], [[0,4],[4,2],[6,2],[8,2],[10,2],[12,2],[14,2]], [[0,2],[2,2],[4,2],[6,2],[8,6],[14,2]]],
  dense:  [[[0,1],[1,1],[2,1],[3,1],[4,2],[6,2],[8,1],[9,1],[10,1],[11,1],[12,4]], [[0,2],[2,1],[3,1],[4,2],[6,1],[7,1],[8,2],[10,2],[12,2],[14,2]]],
};
const RH_BOUNCE = {  // 16th grid, 1 bar: dotted, bouncy figures (handheld RPG feel)
  sparse: [[[0,4],[4,4],[8,6],[14,2]], [[0,6],[6,2],[8,8]], [[0,3],[3,1],[4,4],[8,4],[12,4]]],
  mid:    [[[0,3],[3,1],[4,2],[6,2],[8,3],[11,1],[12,4]], [[0,2],[2,2],[4,2],[6,2],[8,4],[12,2],[14,2]], [[0,2],[2,1],[3,1],[4,4],[8,2],[10,2],[12,4]]],
  dense:  [[[0,1],[1,1],[2,2],[4,1],[5,1],[6,2],[8,2],[10,1],[11,1],[12,2],[14,2]], [[0,2],[2,2],[4,1],[5,1],[6,1],[7,1],[8,2],[10,2],[12,1],[13,1],[14,2]]],
};
const RH_LEAD = {    // 16th grid, longer singing notes (synthwave / lo-fi)
  sparse: [[[0,8],[8,8]], [[0,6],[6,2],[8,8]], [[2,6],[8,4],[12,4]], [[0,4],[6,10]]],
  mid:    [[[0,4],[4,4],[8,4],[12,4]], [[0,3],[3,3],[6,2],[8,8]], [[0,6],[6,2],[8,4],[12,2],[14,2]]],
  dense:  [[[0,2],[2,2],[4,4],[8,2],[10,2],[12,4]], [[0,3],[3,3],[6,2],[8,3],[11,3],[14,2]]],
};

const NEW_STYLES = {
  piano: {
    name: 'Piano (grand)', bpm: 76, gain: 1.6, stepNote: '8n', repeat: 1, mode: 'auto', samples: ['salamander'],
    rawPart: 'rh', rawCenter: 60,
    legend: [
      'Salamander grand piano samples (fallback: FM synth). 1 residue = 1 eighth note, one chord per 16 residues',
      'Major or minor from net charge (acidic protein = minor). Key root from mean hydropathy',
      'Left hand: flowing arpeggio in helix sections, Alberti figure in sheets, sparse chords in coil',
      'Right hand: composed melody (AABA-type phrase forms) following the smoothed hydropathy contour',
      'Bio coupling sets how often a residue picks the next melodic interval instead of the composer',
    ],
    build(R, out){
      R.fx = makeFx(out, {decay: 3.5, rev: 0.32, del: 0, fb: 0.1}); R.nodes.push(...R.fx.nodes);
      R.piano = instrument(R, {sample: 'salamander', vol: -6, release: 1.4,
        synth: poly({harmonicity: 2, modulationIndex: 2.5, envelope: {attack: 0.004, decay: 1.4, sustain: 0.15, release: 1.2},
          modulationEnvelope: {attack: 0.004, decay: 0.6, sustain: 0.1, release: 0.6}}, Tone.FMSynth), synthVol: -7}, out, R.fx.revIn);
      R.parts.rh = notePart(R, R.piano); R.parts.lh = notePart(R, R.piano);
    },
    compose(S, rng){
      const lhBase = 48 + S.rootPc;
      const LH = {
        H: [[0,[0],3,.55],[1,[1],3,.38],[2,[2],3,.4],[3,[3],3,.38],[4,[4],3,.42],[5,[3],3,.36],[6,[2],2,.36],[7,[1],2,.34]],
        E: [[0,[2],1.5,.5],[1,[4],1.5,.36],[2,[3],1.5,.42],[3,[4],1.5,.36],[4,[2],1.5,.46],[5,[4],1.5,.36],[6,[3],1.5,.42],[7,[4],1.5,.36]],
        C: [[0,[0],8,.5],[2,[2,3,4],5,.32]],
      };
      forBlocks(S, c => {
        const pat = c.ph.role !== 'main' ? LH.C : LH[c.ph.type];
        const vs = 0.8 + 0.3 * c.ph.energy;
        emitPattern(S, c.k, 'lh', pat, c.chord, lhBase, vs);
        emitPattern(S, c.k + 8, 'lh', pat, c.chord, lhBase, vs * 0.95);
        if (c.isLast) addEv(S, c.k + 15, {p: 'lh', n: [lhBase + c.chord[0] - 12, lhBase + c.chord[0], lhBase + c.chord[2]], d: 8, v: 0.45});
      });
      const mel = composeMelody(S, rng, {center: 60 + S.rootPc, rhythms: RH_PIANO, lo: 0, hi: 11, centerDeg: 4, vel: 0.72});
      emitMelody(S, mel, 'rh', {legato: 1.0});
    },
  },

  orchestra: {
    name: 'Orchestra (film / musical)', bpm: 88, gain: 1.6, stepNote: '8n', repeat: 1, mode: 'auto',
    samples: ['string_ensemble_1', 'contrabass', 'french_horn', 'trumpet', 'flute', 'orchestral_harp', 'pizzicato_strings', 'timpani', 'glockenspiel'],
    rawPart: 'flute', rawCenter: 72,
    legend: [
      'FluidR3 GM orchestra samples (fallback: synths). Strings carry the harmony, contrabass the root',
      'The melody instrument follows the fold: helix = French horn, sheet = trumpet, coil = flute',
      'Harp arpeggios in calm sections, pizzicato ostinato and timpani when energy is high',
      'Aromatic residues (F/W/Y) under melody notes add glockenspiel sparkles',
      'Mode from net charge, phrase forms and chords from the composer',
    ],
    build(R, out){
      R.fx = makeFx(out, {decay: 4.5, rev: 0.45, del: 0, fb: 0.1}); R.nodes.push(...R.fx.nodes);
      const I = (sample, vol, synth, rel = 1) => instrument(R, {sample, vol, release: rel, synth, synthVol: vol - 8}, out, R.fx.revIn);
      const strings = poly({oscillator: {type: 'fatsawtooth', count: 3, spread: 20}, envelope: {attack: 0.5, decay: 0.3, sustain: 0.8, release: 1.2}});
      const soft = poly({oscillator: {type: 'triangle'}, envelope: {attack: 0.05, decay: 0.3, sustain: 0.7, release: 0.6}});
      const pluck = poly({oscillator: {type: 'triangle'}, envelope: {attack: 0.002, decay: 0.5, sustain: 0, release: 0.4}});
      R.strings = I('string_ensemble_1', -12, strings, 1.2); R.cb = I('contrabass', -8, soft);
      R.horn = I('french_horn', -8, soft); R.trumpet = I('trumpet', -11, soft); R.flute = I('flute', -9, soft);
      R.harp = I('orchestral_harp', -10, pluck, 1.5); R.pizz = I('pizzicato_strings', -9, pluck, 0.5);
      R.timp = I('timpani', -6, () => new Tone.MembraneSynth({pitchDecay: 0.08, octaves: 1.5, envelope: {attack: 0.002, decay: 0.8, sustain: 0}}), 1.5);
      R.glock = I('glockenspiel', -16, () => new Tone.FMSynth({harmonicity: 3.01, modulationIndex: 8, envelope: {attack: 0.001, decay: 1, sustain: 0, release: 1}}), 1);
      for (const k of ['strings','cb','horn','trumpet','flute','harp','pizz','glock']) R.parts[k] = notePart(R, R[k]);
      const tp = notePart(R, R.timp); R.parts.timp = tp;
    },
    compose(S, rng){
      const b4 = 48 + S.rootPc;
      forBlocks(S, c => {
        const E = c.ph.energy, ch = c.chord;
        addEv(S, c.k, {p: 'strings', n: [b4 + ch[0], b4 + ch[1], b4 + ch[2], b4 + ch[0] + 12], d: 16, v: 0.35 + 0.35 * E});
        addEv(S, c.k, {p: 'cb', n: [36 + S.rootPc + ch[0]], d: 8, v: 0.6});
        addEv(S, c.k + 8, {p: 'cb', n: [36 + S.rootPc + (E >= 0.9 ? ch[2] - 12 : ch[0])], d: 8, v: 0.55});
        if (E <= 0.8) emitPattern(S, c.k, 'harp', [[0,[2],2,.5],[1,[3],2,.4],[2,[4],2,.42],[3,[6],2,.4],[4,[7],2,.44],[5,[6],2,.38],[6,[4],2,.38],[7,[3],2,.36]], ch, b4 + 12, 0.8);
        if (E <= 0.8 && c.ph.type !== 'C') emitPattern(S, c.k + 8, 'harp', [[0,[2],2,.45],[2,[4],2,.4],[4,[6],2,.4],[6,[4],2,.36]], ch, b4 + 12, 0.8);
        if (E >= 0.9) for (let s = 0; s < 16; s += 2) addEv(S, c.k + s, {p: 'pizz', n: [b4 + (s % 4 ? ch[2] : ch[0])], d: 1, v: s % 8 ? 0.45 : 0.65});
        if (E >= 0.75 && c.j === 0) addEv(S, c.k, {p: 'timp', n: [36 + S.rootPc + ch[0]], d: 4, v: 0.8});
        if (c.lastInPhrase && c.nextPh && c.nextPh.energy > E) for (let s = 8; s < 16; s++) addEv(S, c.k + s, {p: 'timp', n: [36 + S.rootPc + ch[0]], d: 1, v: 0.25 + 0.05 * (s - 8)});
        if (c.isLast) addEv(S, c.k + 15, {p: 'timp', n: [36 + S.rootPc], d: 8, v: 0.7});
      });
      const mel = composeMelody(S, rng, {center: 60 + S.rootPc, rhythms: RH_PIANO, lo: -1, hi: 10, centerDeg: 3, vel: 0.8, forms: ['AABA', 'ABAB', 'AABC']});
      const inst = ph => ph.role === 'intro' ? 'flute' : ph.role === 'outro' ? 'horn' : {H: 'horn', E: 'trumpet', C: 'flute'}[ph.type];
      emitMelody(S, mel, inst, {legato: 1.0, shift: nt => inst(nt.ph) === 'flute' ? 12 : 0});
      for (const nt of mel) if ('FWY'.includes(nt.aa) && S.coupling > 0.15)
        addEv(S, k0(S, nt.b, 0) + nt.st, {p: 'glock', n: [snapToChord(nt.midi + 24, 60 + S.rootPc, S.chords[nt.b])], d: 2, v: 0.4});
    },
  },

  rpg: {
    name: '8-bit RPG (handheld)', bpm: 138, stepNote: '16n', repeat: 2, mode: 'major', gain: 0.9,
    rawPart: 'lead', rawCenter: 72, rawKick: true,
    legend: [
      'Handheld 4-channel setup: two pulse waves, a 4-bit style wave bass and a noise channel',
      'Pulse 1 sings a bouncy composed melody; on the repeat Pulse 2 doubles it a third below',
      'Calm sections: Pulse 2 plays fast chord arpeggios. Bass bounces in octaves, walks in sheet sections',
      'Drum fills at the end of each phrase; intro brings the melody in on the second pass',
      'Melody contour from smoothed hydropathy, coupling lets residues choose intervals',
    ],
    build(R, out){
      const crush = crusher(R, 6).connect(out);
      R.fx = makeFx(crush, {decay: 0.8, rev: 0.05, del: 0.1, delayTime: '8n', fb: 0.2}); R.nodes.push(...R.fx.nodes);
      const vib = track(R, new Tone.Vibrato({frequency: 5.5, depth: 0.06})).connect(crush);
      R.lead = track(R, new Tone.Synth({oscillator: {type: 'pulse', width: 0.5}, envelope: {attack: 0.003, decay: 0.12, sustain: 0.6, release: 0.05}}));
      R.lead.volume.value = -17; R.lead.connect(vib); R.lead.connect(R.fx.delIn);
      R.harm = track(R, new Tone.Synth({oscillator: {type: 'pulse', width: 0}, envelope: {attack: 0.002, decay: 0.1, sustain: 0.45, release: 0.04}})).connect(crush);
      R.harm.volume.value = -24;
      const wcrush = crusher(R, 4).connect(crush);
      R.bass = track(R, new Tone.Synth({oscillator: {type: 'triangle'}, envelope: {attack: 0.002, decay: 0.05, sustain: 0.8, release: 0.03}})).connect(wcrush);
      R.bass.volume.value = -8;
      Object.assign(R.parts, drumParts(R, drumKit(R, crush, 'gb')));
      for (const k of ['lead', 'harm', 'bass']) R.parts[k] = notePart(R, R[k]);
    },
    compose(S, rng){
      const bb = 48 + S.rootPc;
      const DR = {
        H: {kick: 'X.......x.......', snare: '....X.......X...', hat: 'x.o.x.o.x.o.x.o.'},
        E: {kick: 'X.....x.x.......', snare: '....X..o....X...', hat: 'xoxoxoxoxoxoxoxo'},
        C: {kick: 'X...............', snare: '............o...', hat: 'x...x...x...x...'},
      };
      forBlocks(S, c => {
        const type = c.ph.role === 'intro' ? 'C' : c.ph.type, ch = c.chord, E = c.ph.energy;
        let dr = DR[type];
        if (c.lastInPhrase && c.lastRep) dr = {...dr, snare: dr.snare.slice(0, 12) + 'xoxX'};
        emitDrums(S, c.k, dr, 0.6 + 0.4 * E);
        const T = toneList(ch, bb);
        if (type === 'E') [0, 2, 4, 6, 8, 10, 12, 14].forEach((s, x) => addEv(S, c.k + s, {p: 'bass', n: [[T[2], T[3], T[4], T[3]][x % 4]], d: 1.8, v: 0.9}));
        else if (type === 'H') for (let s = 0; s < 16; s += 2) addEv(S, c.k + s, {p: 'bass', n: [s % 4 ? T[6] : T[2]], d: 1.6, v: 0.9});
        else { addEv(S, c.k, {p: 'bass', n: [T[2]], d: 7, v: 0.8}); addEv(S, c.k + 8, {p: 'bass', n: [T[4]], d: 7, v: 0.75}); }
        if (type === 'C' && c.r === 0) for (let s = 0; s < 16; s++) addEv(S, c.k + s, {p: 'harm', n: [T[[3, 4, 6, 7][s % 4]] + 12], d: 0.9, v: 0.5});
      });
      const mel = composeMelody(S, rng, {center: 72 + S.rootPc - 12, rhythms: RH_BOUNCE, lo: 2, hi: 13, centerDeg: 7, vel: 0.8, forms: ['AABA', 'ABAB', 'AABC', 'ABAC']});
      emitMelody(S, mel, (ph, r) => (ph.role === 'intro' && r === 0) ? null : 'lead', {legato: 0.85});
      // harmony a diatonic third below on the repeat
      for (const nt of mel) if (nt.ph.type !== 'C' && nt.ph.role === 'main')
        addEv(S, k0(S, nt.b, S.rep - 1) + nt.st, {p: 'harm', n: 72 + S.rootPc - 12 + degSemi(nt.deg - 2, S.mode), d: nt.len * 0.85, v: nt.v * 0.8});
    },
  },

  synthwave: {
    name: 'Synthwave', bpm: 96, stepNote: '16n', repeat: 2, mode: 'minor',
    rawPart: 'lead', rawCenter: 60, rawKick: true,
    legend: [
      'Big kick on 1 and 3, gated-reverb snare on 2 and 4, 16th hats',
      'Pulsing 8th bass (octave 16ths in sheet sections), wide chorus pad, square arpeggio',
      'Saw lead with glide plays the composed melody in helix and sheet sections; coil = arp only',
      'Pad filter opens on exposed (hydrophilic) stretches',
    ],
    build(R, out){
      R.fx = makeFx(out, {decay: 3, rev: 0.3, del: 0.3, delayTime: '8n.', fb: 0.38}); R.nodes.push(...R.fx.nodes);
      Object.assign(R.parts, drumParts(R, drumKit(R, out, 'wave', R.fx)));
      R.bass = track(R, new Tone.MonoSynth({oscillator: {type: 'sawtooth'}, filter: {Q: 2, type: 'lowpass', rolloff: -24},
        envelope: {attack: 0.003, decay: 0.2, sustain: 0.4, release: 0.05}, filterEnvelope: {attack: 0.002, decay: 0.15, sustain: 0.2, baseFrequency: 160, octaves: 2.6}})).connect(out);
      R.bass.volume.value = -11;
      R.padF = track(R, new Tone.Filter(1200, 'lowpass')).connect(out); R.padF.connect(R.fx.revIn);
      const ch = track(R, new Tone.Chorus(1.5, 3.5, 0.7).start()).connect(R.padF);
      R.pad = track(R, new Tone.PolySynth(Tone.Synth, {oscillator: {type: 'fatsawtooth', count: 3, spread: 30}, envelope: {attack: 0.9, decay: 0.5, sustain: 0.8, release: 2}}));
      R.pad.volume.value = -26; R.pad.connect(ch);
      const af = track(R, new Tone.Filter(2200, 'lowpass')).connect(out); af.connect(R.fx.delIn);
      R.arp = track(R, new Tone.Synth({oscillator: {type: 'square'}, envelope: {attack: 0.002, decay: 0.1, sustain: 0.2, release: 0.05}})).connect(af);
      R.arp.volume.value = -27;
      const lc = track(R, new Tone.Chorus(3, 2, 0.4).start()).connect(out); lc.connect(R.fx.delIn); lc.connect(R.fx.revIn);
      R.lead = track(R, new Tone.MonoSynth({oscillator: {type: 'fatsawtooth', count: 2, spread: 12}, portamento: 0.04, filter: {Q: 1, type: 'lowpass'},
        envelope: {attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.3}, filterEnvelope: {attack: 0.05, decay: 0.4, sustain: 0.5, baseFrequency: 900, octaves: 2}})).connect(lc);
      R.lead.volume.value = -19;
      for (const k of ['bass', 'pad', 'arp', 'lead']) R.parts[k] = notePart(R, R[k]);
      R.parts.ctrl = (t, ev) => ev.fn(R, t);
    },
    compose(S, rng){
      const b3 = 36 + S.rootPc;
      forBlocks(S, c => {
        const E = c.ph.energy, ch = c.chord, type = c.ph.role === 'main' ? c.ph.type : 'C';
        const dr = {kick: E >= 0.9 ? 'X.......X.x.....' : 'X.......X.......', snare: E >= 0.45 ? '....X.......X...' : '',
          hat: E >= 0.6 ? 'x.o.x.o.x.o.x.o.' : E >= 0.4 ? 'x...x...x...x...' : ''};
        if (c.lastInPhrase && c.lastRep && E >= 0.45) dr.snare = '....X.......Xoxx';
        emitDrums(S, c.k, dr);
        if (type === 'E') for (let s = 0; s < 16; s++) addEv(S, c.k + s, {p: 'bass', n: [b3 + ch[0] + (s % 2 ? 12 : 0)], d: 0.8, v: s % 4 ? 0.6 : 0.85});
        else if (type === 'H') for (let s = 0; s < 16; s += 2) addEv(S, c.k + s, {p: 'bass', n: [b3 + ch[0]], d: 1.6, v: s % 4 ? 0.65 : 0.85});
        else { addEv(S, c.k, {p: 'bass', n: [b3 + ch[0]], d: 7, v: 0.7}); addEv(S, c.k + 8, {p: 'bass', n: [b3 + ch[0]], d: 7, v: 0.65}); }
        if (c.r === 0) {
          addEv(S, c.k, {p: 'pad', n: ch.map(x => 60 + S.rootPc + x - 12), d: 16 * S.rep, v: 0.45});
          const z = c.blk.zK;
          addEv(S, c.k, {p: 'ctrl', fn: (R, t) => R.padF.frequency.rampTo(700 + 2200 * (1 - z) / 2, R.blockSec, t)});
        }
        if (type === 'C' || (type === 'H' && c.r === 1)) for (let s = 0; s < 16; s++)
          addEv(S, c.k + s, {p: 'arp', n: [toneList(ch, 60 + S.rootPc)[[2, 3, 4, 6][s % 4]]], d: 0.8, v: 0.6});
      });
      const mel = composeMelody(S, rng, {center: 60 + S.rootPc, rhythms: RH_LEAD, lo: 2, hi: 11, centerDeg: 6, vel: 0.75,
        when: ph => ph.role === 'main' && ph.type !== 'C'});
      emitMelody(S, mel, 'lead', {legato: 0.95, shift: (nt, r) => (r === 1 && nt.ph.type === 'E') ? 12 : 0});
    },
  },

  lofi: {
    name: 'Lo-fi beats', bpm: 78, stepNote: '16n', repeat: 2, mode: 'major', swing: 0.55,
    samples: ['electric_piano_1', 'acoustic_bass', 'vibraphone'],
    pools: {major: {H: [['ii','V','I','vi'],['I','vi','ii','V'],['IV','iii','ii','I']],
                    E: [['vi','ii','V','I'],['IV','V','iii','vi']],
                    C: [['I','IV','I','IV'],['ii','V','ii','V']]}},
    rawPart: 'keys', rawCenter: 60, rawKick: true,
    legend: [
      'Swung 16ths, dusty boom-bap drums through a low-pass, vinyl crackle',
      'Electric piano plays rootless 7th/9th voicings (FluidR3 samples, fallback FM keys)',
      'Upright bass: root, fifth, and a chromatic approach note into the next chord',
      'Vibraphone melody only on the second pass of each block (call and space), from the composer',
      'Comp rhythm gets busier with charge density',
    ],
    build(R, out){
      const master = track(R, new Tone.Filter(5200, 'lowpass')).connect(out);
      R.fx = makeFx(master, {decay: 2.5, rev: 0.25, del: 0.15, delayTime: '8n', fb: 0.25, delayTone: 1800}); R.nodes.push(...R.fx.nodes);
      Object.assign(R.parts, drumParts(R, drumKit(R, master, 'lofi')));
      const wob = track(R, new Tone.Vibrato({frequency: 0.4, depth: 0.04})).connect(master); wob.connect(R.fx.revIn);
      R.keys = instrument(R, {sample: 'electric_piano_1', vol: -10, release: 0.8,
        synth: poly({harmonicity: 3, modulationIndex: 1.6, envelope: {attack: 0.005, decay: 1.2, sustain: 0.3, release: 0.8}}, Tone.FMSynth), synthVol: -18}, wob);
      R.bass = instrument(R, {sample: 'acoustic_bass', vol: -6, release: 0.3,
        synth: () => new Tone.MonoSynth({oscillator: {type: 'sine'}, envelope: {attack: 0.005, decay: 0.3, sustain: 0.5, release: 0.1}, filterEnvelope: {baseFrequency: 300, octaves: 1}})}, master);
      R.vib = instrument(R, {sample: 'vibraphone', vol: -13, release: 1.2,
        synth: () => new Tone.FMSynth({harmonicity: 4, modulationIndex: 2, envelope: {attack: 0.002, decay: 1.5, sustain: 0, release: 1}})}, master, R.fx.delIn);
      const cf = track(R, new Tone.Filter(2500, 'highpass')).connect(out);
      R.crackle = track(R, new Tone.Noise('pink')); R.crackle.volume.value = -46; R.crackle.connect(cf);
      R.tick = track(R, new Tone.NoiseSynth({envelope: {attack: 0.0005, decay: 0.002, sustain: 0}})).connect(cf); R.tick.volume.value = -24;
      for (const k of ['keys', 'bass', 'vib']) R.parts[k] = notePart(R, R[k]);
      R.parts.tick = (t, ev) => R.tick.triggerAttackRelease(0.002, t, ev.v);
      R.parts.ctrl = (t, ev) => ev.fn(R, t);
    },
    compose(S, rng){
      const kb = 48 + S.rootPc, bb = 36 + S.rootPc;
      addEv(S, 0, {p: 'ctrl', fn: (R, t) => R.crackle.start(t)});
      const COMP = {C: [[0, 14, .5]], H: [[0, 6, .5], [10, 5, .42]], E: [[0, 3, .5], [3, 3, .38], [8, 3, .46], [11, 4, .38]]};
      forBlocks(S, c => {
        const E = c.ph.energy, ch = c.chord, type = c.ph.role === 'main' ? c.ph.type : 'C';
        const voic = [kb + ch[1], kb + ch[3], kb + ch[0] + 14, kb + ch[2] + 12];
        const comp = c.blk.chgN > 0.65 && type !== 'C' ? COMP.E : COMP[type];
        comp.forEach(([st, d, v]) => addEv(S, c.k + st, {p: 'keys', n: voic, d, v}));
        const next = S.chords[Math.min(S.nb - 1, c.b + 1)];
        addEv(S, c.k, {p: 'bass', n: [bb + ch[0]], d: 6, v: 0.8});
        addEv(S, c.k + 10, {p: 'bass', n: [bb + ch[2]], d: 3, v: 0.6});
        if (c.lastRep) addEv(S, c.k + 14, {p: 'bass', n: [bb + next[0] - 1], d: 2, v: 0.55});
        const dr = type === 'C' ? {kick: 'X.........x.....', hat: 'x.x.x.x.x.x.x.x.'}
          : {kick: 'X......x..X.....', snare: '....X.......X...', hat: 'x.o.x.o.x.o.x.ox'};
        emitDrums(S, c.k, dr, 0.7 + 0.3 * E);
        for (let s = 0; s < 16; s++) if (rng() < 0.12) addEv(S, c.k + s, {p: 'tick', v: 0.3 + 0.7 * rng(), d: 1});
      });
      const mel = composeMelody(S, rng, {center: 60 + S.rootPc + 12, rhythms: {sparse: RH_LEAD.sparse, mid: RH_LEAD.sparse, dense: RH_LEAD.mid},
        lo: 0, hi: 9, centerDeg: 3, vel: 0.6, when: ph => ph.role === 'main'});
      emitMelody(S, mel, 'vib', {reps: 'last', legato: 0.9});
    },
  },

  techno: {
    name: 'Deep Techno', bpm: 124, stepNote: '16n', repeat: 2, mode: 'minor',
    rawPart: 'stab', rawCenter: 60, rawKick: true,
    legend: [
      'Warm 909-style kick with sidechain pumping on bass, chords and pad',
      'Rolling offbeat bass on the chord root; coupling lets residues push notes to fifth or octave',
      'Dub chord stabs through tape-style echo, rhythm chosen per phrase',
      'Hats, shaker (Euclidean density from charge) and rim percussion enter with section energy',
      'Noise riser before phrases that bring more energy; chord filter follows exposure (hydropathy)',
    ],
    build(R, out){
      R.fx = makeFx(out, {decay: 3.2, rev: 0.22, del: 0.35, delayTime: '8n.', fb: 0.48, delayTone: 1600}); R.nodes.push(...R.fx.nodes);
      const K = drumKit(R, out, '909');
      Object.assign(R.parts, drumParts(R, K));
      R.duck = track(R, new Tone.Gain(1)).connect(out);
      R.parts.kick = (t, ev) => { K.kick(t, ev.v); const g = R.duck.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.35, t); g.linearRampToValueAtTime(1, t + Math.min(0.28, R.stepSec * 3.2)); };
      R.bass = track(R, new Tone.MonoSynth({oscillator: {type: 'sawtooth'}, filter: {Q: 1, type: 'lowpass', rolloff: -24},
        envelope: {attack: 0.002, decay: 0.14, sustain: 0.25, release: 0.05}, filterEnvelope: {attack: 0.001, decay: 0.12, sustain: 0.1, baseFrequency: 85, octaves: 2.3}})).connect(R.duck);
      R.bass.volume.value = -9;
      R.stabF = track(R, new Tone.Filter({frequency: 800, type: 'lowpass', Q: 2})).connect(R.duck);
      R.stabF.connect(R.fx.delIn); R.stabF.connect(R.fx.revIn);
      R.stab = track(R, new Tone.PolySynth(Tone.Synth, {oscillator: {type: 'sawtooth'}, envelope: {attack: 0.004, decay: 0.28, sustain: 0, release: 0.25}}));
      R.stab.volume.value = -19; R.stab.connect(R.stabF);
      const pc = track(R, new Tone.Chorus(0.5, 3, 0.5).start()).connect(R.duck); pc.connect(R.fx.revIn);
      R.pad = track(R, new Tone.PolySynth(Tone.Synth, {oscillator: {type: 'fattriangle', count: 3, spread: 24}, envelope: {attack: 1.8, decay: 0.5, sustain: 0.8, release: 3}}));
      R.pad.volume.value = -30; R.pad.connect(pc);
      R.riserF = track(R, new Tone.Filter({frequency: 400, type: 'bandpass', Q: 3})).connect(out); R.riserF.connect(R.fx.revIn);
      R.riserG = track(R, new Tone.Gain(0)).connect(R.riserF);
      R.riser = track(R, new Tone.Noise('white')); R.riser.connect(R.riserG);
      for (const k of ['bass', 'stab', 'pad']) R.parts[k] = notePart(R, R[k]);
      R.parts.ctrl = (t, ev) => ev.fn(R, t);
    },
    compose(S, rng){
      const bb = 36 + S.rootPc, cb = 48 + S.rootPc;
      addEv(S, 0, {p: 'ctrl', fn: (R, t) => R.riser.start(t)});
      const STABS = [[3, 11], [3, 6, 11], [2, 10], [6, 14], [3, 7, 11, 14], [0, 3, 10]];
      const ROLL = [[1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], [2, 3, 6, 7, 10, 11, 14, 15], [1, 3, 5, 7, 9, 11, 13, 15]];
      let stabRh = null, rollRh = null, hatRot = 0;
      forBlocks(S, c => {
        const E = c.ph.energy, ch = c.chord, blk = c.blk;
        if (c.j === 0 && c.r === 0) { stabRh = pick(rng, STABS); rollRh = pick(rng, ROLL); hatRot = Math.floor(rng() * 4); }
        const intro0 = c.ph.role === 'intro' && c.j === 0;
        const dr = {};
        if (!intro0) dr.kick = 'X...X...X...X...';
        if (E >= 0.45) dr.hat = '..x...x...x...x.';
        if (E >= 0.7) dr.clap = '....x.......x...';
        dr.shaker = euclidPat(clamp(5 + Math.round(blk.chgN * 7), 5, 12), hatRot, 'o');
        if (E >= 0.6) dr.rim = euclidPat(c.ph.type === 'E' ? 5 : 3, hatRot + 2, 'x');
        if (E >= 0.9 && c.j % 2 === 1) dr.ohat = '..............x.';
        if (c.lastInPhrase && c.lastRep && E >= 0.7) dr.clap = '....x.......xoxx';
        emitDrums(S, c.k, dr, 0.85 + 0.15 * E);
        const rh = E >= 0.6 ? rollRh : [2, 6, 10, 14];
        if (!intro0) rh.forEach(s => {
          const aa = S.chain.seq[blk.lo + s];
          let n = bb + ch[0];
          if (aa && rng() < S.coupling) { if ('FWY'.includes(aa)) n += 12; else if (CHARGE[aa]) n = bb + ch[2]; }
          addEv(S, c.k + s, {p: 'bass', n: [n], d: 0.7, v: s % 4 === 1 || s % 4 === 2 ? 0.85 : 0.65});
        });
        if (E >= 0.5) stabRh.forEach(s => addEv(S, c.k + s, {p: 'stab', n: [cb + ch[0], cb + ch[1], cb + ch[2], cb + ch[3]], d: 1.2, v: 0.55}));
        if (c.r === 0) {
          addEv(S, c.k, {p: 'pad', n: [cb + 12 + ch[0], cb + 12 + ch[2], cb + 12 + ch[3]], d: 16 * S.rep, v: 0.4});
          const z = blk.zK, bn = S.F.bN ? S.F.bN[blk.lo] : 0.4;
          addEv(S, c.k, {p: 'ctrl', fn: (R, t) => { R.stabF.frequency.rampTo(450 + 1600 * (1 - z) / 2, R.blockSec, t);
            R.fx.revIn.gain.rampTo(0.12 + 0.3 * bn, R.blockSec, t); }});
        }
        if (c.lastInPhrase && c.lastRep && c.nextPh && c.nextPh.energy > E)
          addEv(S, c.k, {p: 'ctrl', fn: (R, t) => { const d = R.blockSec;
            R.riserG.gain.setValueAtTime(0, t); R.riserG.gain.linearRampToValueAtTime(0.12, t + d * 0.95); R.riserG.gain.linearRampToValueAtTime(0, t + d);
            R.riserF.frequency.setValueAtTime(300, t); R.riserF.frequency.exponentialRampToValueAtTime(7000, t + d); }});
      });
    },
  },
};

