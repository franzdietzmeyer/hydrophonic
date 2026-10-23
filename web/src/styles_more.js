// Hydrophonic, protein-to-music synthesizer. Copyright (C) 2026 Franz Dietzmeyer
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0  (see LICENSE; https://github.com/franzdietzmeyer/hydrophonic)
// ---------- more composer styles: jazz, baroque, gamelan, drum & bass, bossa nova, music box ----------
const RH_BAROQUE = {   // 16th grid, 1 bar
  sparse: [[[0,2],[2,2],[4,4],[8,2],[10,2],[12,4]], [[0,4],[4,2],[6,2],[8,4],[12,4]]],
  mid:    [[[0,1],[1,1],[2,1],[3,1],[4,2],[6,2],[8,1],[9,1],[10,1],[11,1],[12,2],[14,2]],
           [[0,2],[2,1],[3,1],[4,2],[6,1],[7,1],[8,2],[10,2],[12,1],[13,1],[14,1],[15,1]]],
  dense:  [Array.from({length: 16}, (_, i) => [i, 1]),
           [[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[8,2],[10,1],[11,1],[12,1],[13,1],[14,2]]],
};
const JAZZ_POOLS = {
  major: {H: [['ii','V','I','vi'], ['I','vi','ii','V'], ['iii','vi','ii','V']],
          E: [['ii','V','iii','vi'], ['IV','V','iii','vi'], ['I','IV','ii','V']],
          C: [['I','IV','iii','vi'], ['ii','V','I','I']]},
  minor: {H: [['i','iv','VII','III'], ['i','VI','iv','v']],
          E: [['iv','VII','III','VI'], ['VI','v','i','i']],
          C: [['i','iv','i','v'], ['i','VI','iv','i']]},
};
const fold = (m, lo, hi) => { while (m > hi) m -= 12; while (m < lo) m += 12; return m; };
const pluckSynth = (decay = 0.6) => poly({oscillator: {type: 'triangle'}, envelope: {attack: 0.002, decay, sustain: 0, release: decay * 0.6}});

const MORE_STYLES = {
  jazz: {
    name: 'Jazz trio', bpm: 132, stepNote: '8n', repeat: 1, mode: 'auto', swing: 0.6, swingSub: '8n', gain: 0.9,
    samples: ['salamander', 'acoustic_bass'], pools: JAZZ_POOLS, rawPart: 'rh', rawCenter: 60,
    legend: [
      'Piano, upright bass and brushes; swung eighths, ii-V-I style progressions',
      'Walking bass in quarter notes: chord tones, then a chromatic approach into the next chord',
      'Charged residues decide whether the approach comes from above or below (with bio coupling)',
      'Piano comps rootless 3-7-9 voicings and plays the composed right-hand line',
      'Ride cymbal "ding ding-da-ding", hi-hat on 2 and 4, brush ghost notes',
    ],
    build(R, out){
      R.fx = makeFx(out, {decay: 1.8, rev: 0.22, del: 0}); R.nodes.push(...R.fx.nodes);
      R.piano = instrument(R, {sample: 'salamander', vol: -8, release: 1,
        synth: poly({harmonicity: 2, modulationIndex: 2.5, envelope: {attack: 0.004, decay: 1.2, sustain: 0.1, release: 1}}, Tone.FMSynth), synthVol: -9}, out, R.fx.revIn);
      R.bass = instrument(R, {sample: 'acoustic_bass', vol: -2, release: 0.25,
        synth: () => new Tone.MonoSynth({oscillator: {type: 'triangle'}, envelope: {attack: 0.004, decay: 0.4, sustain: 0.3, release: 0.1}, filterEnvelope: {baseFrequency: 220, octaves: 1.5}}), synthVol: -6}, out);
      const rideF = track(R, new Tone.Filter({frequency: 6500, type: 'bandpass', Q: 0.8})).connect(out); rideF.connect(R.fx.revIn);
      R.ride = track(R, new Tone.NoiseSynth({noise: {type: 'white'}, envelope: {attack: 0.001, decay: 0.32, sustain: 0}})).connect(rideF); R.ride.volume.value = -27;
      R.ping = track(R, new Tone.FMSynth({harmonicity: 5.3, modulationIndex: 12, envelope: {attack: 0.001, decay: 0.5, sustain: 0, release: 0.4},
        modulationEnvelope: {attack: 0.001, decay: 0.3, sustain: 0, release: 0.2}})).connect(rideF); R.ping.volume.value = -34;
      const hp = track(R, new Tone.Filter(7000, 'highpass')).connect(out);
      R.hat = track(R, new Tone.NoiseSynth({envelope: {attack: 0.003, decay: 0.04, sustain: 0}})).connect(hp); R.hat.volume.value = -30;
      const bf = track(R, new Tone.Filter({frequency: 2200, type: 'bandpass', Q: 0.6})).connect(out);
      R.brush = track(R, new Tone.NoiseSynth({noise: {type: 'pink'}, envelope: {attack: 0.01, decay: 0.14, sustain: 0}})).connect(bf); R.brush.volume.value = -26;
      R.kick = track(R, new Tone.MembraneSynth({pitchDecay: 0.03, octaves: 3, envelope: {attack: 0.002, decay: 0.25, sustain: 0}})).connect(out); R.kick.volume.value = -16;
      R.parts.rh = notePart(R, R.piano); R.parts.comp = notePart(R, R.piano); R.parts.bass = notePart(R, R.bass);
      R.parts.ride = (t, ev) => { R.ride.triggerAttackRelease(0.3, t, ev.v); R.ping.triggerAttackRelease(3100, 0.3, t, ev.v); };
      R.parts.hat = (t, ev) => R.hat.triggerAttackRelease(0.04, t, ev.v);
      R.parts.brush = (t, ev) => R.brush.triggerAttackRelease(0.12, t, ev.v);
      R.parts.kick = (t, ev) => R.kick.triggerAttackRelease('C1', 0.2, t, ev.v);
    },
    compose(S, rng){
      const bb = 36 + S.rootPc, kb = 48 + S.rootPc;
      const COMP = [[[0, 2, .5], [3, 1, .42]], [[1, 1, .45], [4, 2, .45]], [[2, 1, .42], [5, 2, .4]], [[0, 3, .5]], [[3, 1, .45], [6, 1, .38]]];
      forBlocks(S, c => {
        const ch = c.chord, next = S.chords[Math.min(S.nb - 1, c.b + 1)], E = c.ph.energy;
        // walking bass: 8 quarter notes over 2 bars
        const r = bb + ch[0], up = rng() < 0.5;
        const walk = up ? [r, bb + ch[1], bb + ch[2], bb + ch[3], r + 12, bb + ch[3], bb + ch[2]]
                        : [r, bb + ch[2], bb + ch[1], r, bb + ch[2] - 12 + 12, bb + ch[1], bb + ch[0] + 2];
        const aa = S.chain.seq[c.blk.lo + 14];
        let dir = rng() < 0.5 ? 1 : -1;
        if (aa && CHARGE[aa] && rng() < S.coupling + 0.2) dir = CHARGE[aa] > 0 ? 1 : -1;
        walk.push(bb + next[0] + dir);
        walk.forEach((m, x) => addEv(S, c.k + x * 2, {p: 'bass', n: [fold(m, 31, 55)], d: 1.9, v: x % 2 ? 0.7 : 0.85}));
        // comping: rootless 3-7-9
        const voic = [kb + ch[1], kb + ch[3], kb + ch[0] + 14].map(m => fold(m, 50, 70));
        for (const bar of [0, 8]) {
          if (c.ph.role === 'intro' && bar === 0 && c.j === 0) continue;
          pick(rng, COMP).forEach(([st, d, v]) => addEv(S, c.k + bar + st, {p: 'comp', n: voic, d, v: v * (0.8 + 0.3 * E)}));
        }
        // drums
        for (const bar of [0, 8]) {
          [0, 2, 3, 4, 6, 7].forEach(s => addEv(S, c.k + bar + s, {p: 'ride', v: (s % 2 === 0 ? 0.75 : 0.45) * (0.7 + 0.3 * E), d: 1}));
          [2, 6].forEach(s => addEv(S, c.k + bar + s, {p: 'hat', v: 0.6, d: 1}));
          if (E >= 0.75) [0, 2, 4, 6].forEach(s => addEv(S, c.k + bar + s, {p: 'kick', v: 0.35, d: 1}));
          for (let s = 1; s < 8; s += 2) if (rng() < 0.12 + 0.1 * E) addEv(S, c.k + bar + s, {p: 'brush', v: 0.35 + 0.3 * rng(), d: 1});
        }
        if (c.lastInPhrase) [11, 13, 15].forEach(s => addEv(S, c.k + s, {p: 'brush', v: 0.75, d: 1}));
      });
      const mel = composeMelody(S, rng, {center: 60 + S.rootPc + 12, rhythms: RH_PIANO, lo: -2, hi: 9, centerDeg: 2, vel: 0.7,
        when: ph => ph.role !== 'intro'});
      emitMelody(S, mel, 'rh', {legato: 0.95});
    },
  },

  baroque: {
    name: 'Baroque counterpoint', bpm: 84, stepNote: '16n', repeat: 2, mode: 'auto', gain: 1.3,
    samples: ['harpsichord', 'cello'], rawPart: 'hpsi', rawCenter: 60,
    legend: [
      'Harpsichord and cello continuo, running 16th-note lines',
      'First pass of each block: the subject alone. Second pass: a second voice enters',
      'Helix and coil sections: the second voice is a canon (same line one beat later, an octave lower)',
      'Sheet sections: the second voice is the mirror image (inversion) of the first, like paired strands',
      'Strong beats of the second voice are re-fitted to the chord, cello walks root, fifth, octave',
    ],
    build(R, out){
      R.fx = makeFx(out, {decay: 2.6, rev: 0.28, del: 0}); R.nodes.push(...R.fx.nodes);
      R.hpsi = instrument(R, {sample: 'harpsichord', vol: -8, release: 0.5,
        synth: () => new Tone.PolySynth(Tone.Synth, {oscillator: {type: 'sawtooth'}, envelope: {attack: 0.001, decay: 0.5, sustain: 0, release: 0.3}}), synthVol: -20}, out, R.fx.revIn);
      R.cello = instrument(R, {sample: 'cello', vol: -9, release: 0.5,
        synth: poly({oscillator: {type: 'sawtooth'}, envelope: {attack: 0.04, decay: 0.3, sustain: 0.6, release: 0.3}}), synthVol: -22}, out, R.fx.revIn);
      R.parts.hpsi = notePart(R, R.hpsi); R.parts.v2 = notePart(R, R.hpsi); R.parts.cello = notePart(R, R.cello);
    },
    compose(S, rng){
      const mode = S.mode, L = MODES[mode].length, center = 60 + S.rootPc;
      const v1 = composeMelody(S, rng, {center, rhythms: RH_BAROQUE, lo: 0, hi: 12, centerDeg: 4, vel: 0.72, forms: ['AABA', 'ABAB', 'AABB']});
      emitMelody(S, v1, 'hpsi', {legato: 0.9});
      for (const nt of v1) {
        const ph = nt.ph, inv = ph.type === 'E';
        const delay = inv ? 0 : 4, st2 = nt.st + delay;
        const tb = Math.min(S.nb - 1, nt.b + (st2 >= BLOCK ? 1 : 0));
        const cd = S.chords[tb].slice(0, 3).map(c => semiToDeg(c, mode));
        let d = inv ? 2 * (cd[0] + L) - nt.deg - L : nt.deg - L;   // mirror around the chord root, or one octave down
        if (st2 % 4 === 0) d = nearestDeg(d, cd, mode);
        while (d > 6) d -= L; while (d < -9) d += L;
        addEv(S, k0(S, nt.b, 1) + st2, {p: 'v2', n: center + degSemi(d, mode), d: nt.len * 0.9, v: nt.v * 0.75});
      }
      forBlocks(S, c => {
        const ch = c.chord, b2 = 36 + S.rootPc, E = c.ph.energy;
        const seq = [ch[0], ch[2], ch[0] + 12, ch[2]];
        if (E >= 0.9 && c.r === 1) for (let s = 0; s < 16; s += 2) addEv(S, c.k + s, {p: 'cello', n: [fold(b2 + seq[(s / 2) % 4], 33, 57)], d: 1.8, v: 0.65});
        else seq.forEach((x, q) => addEv(S, c.k + q * 4, {p: 'cello', n: [fold(b2 + x, 33, 57)], d: 3.6, v: 0.7}));
      });
    },
  },

  gamelan: {
    name: 'Gamelan', bpm: 92, stepNote: '16n', repeat: 2, mode: 'major', gain: 1.6,
    rawPart: 'metal', rawCenter: 60,
    legend: [
      'Approximate slendro tuning (5 nearly equal steps) for basic proteins, pelog-like for acidic ones',
      'Balungan (core melody) on the beat follows the smoothed hydropathy',
      'Kotekan: two interlocking parts, polos on even residues and sangsih on odd ones',
      'Paired instruments tuned slightly apart give the typical shimmering beat (ombak)',
      'Gong marks each 64-residue cycle; kempli keeps time; coil sections are calm, sheet sections play kotekan throughout',
    ],
    build(R, out){
      R.fx = makeFx(out, {decay: 3.8, rev: 0.4, del: 0}); R.nodes.push(...R.fx.nodes);
      const metal = (decay, detune, vol) => { const s = track(R, new Tone.PolySynth(Tone.FMSynth, {harmonicity: 2.76, modulationIndex: 2.4,
          envelope: {attack: 0.001, decay, sustain: 0, release: decay * 0.7}, modulationEnvelope: {attack: 0.001, decay: 0.2, sustain: 0, release: 0.2}}));
        s.set({detune}); s.volume.value = vol; s.connect(out); s.connect(R.fx.revIn); return s; };
      R.m1 = metal(1.8, 0, -11); R.m2 = metal(1.8, 26, -11);
      R.k1 = metal(0.45, 0, -15); R.k2 = metal(0.45, 26, -15);
      R.gong = track(R, new Tone.FMSynth({harmonicity: 0.51, modulationIndex: 1.6, envelope: {attack: 0.01, decay: 7, sustain: 0, release: 4},
        modulationEnvelope: {attack: 0.5, decay: 4, sustain: 0, release: 2}})); R.gong.volume.value = -2; R.gong.connect(out); R.gong.connect(R.fx.revIn);
      R.kempli = track(R, new Tone.FMSynth({harmonicity: 3.2, modulationIndex: 6, envelope: {attack: 0.001, decay: 0.06, sustain: 0, release: 0.05}})).connect(out);
      R.kempli.volume.value = -26;
      R.kendang = track(R, new Tone.MembraneSynth({pitchDecay: 0.025, octaves: 2.5, envelope: {attack: 0.001, decay: 0.18, sustain: 0}})).connect(out);
      R.kendang.volume.value = -12;
      R.parts.metal = (t, ev) => { const f = (Array.isArray(ev.n) ? ev.n : [ev.n]).map(mtof); R.m1.triggerAttackRelease(f, ev.d * R.stepSec, t, ev.v); R.m2.triggerAttackRelease(f, ev.d * R.stepSec, t, ev.v); };
      R.parts.kot = (t, ev) => { const f = mtof(ev.n); R.k1.triggerAttackRelease(f, 0.3, t, ev.v); R.k2.triggerAttackRelease(f, 0.3, t, ev.v); };
      R.parts.gong = (t, ev) => R.gong.triggerAttackRelease(mtof(ev.n), 6, t, ev.v);
      R.parts.kempli = (t, ev) => R.kempli.triggerAttackRelease(1180, 0.05, t, ev.v);
      R.parts.kendang = (t, ev) => R.kendang.triggerAttackRelease(ev.n, 0.15, t, ev.v);
    },
    compose(S, rng){
      const net = S.chain.seq.reduce((a, x) => a + (CHARGE[x] || 0), 0);
      const cents = net < 0 ? [0, 120, 270, 540, 670] : [0, 240, 480, 720, 960];
      const base = 60 + S.rootPc;
      const pitch = d => base + 12 * Math.floor(d / 5) + cents[((d % 5) + 5) % 5] / 100;
      const bal = [];
      for (let b = 0; b < S.nb; b++) { const blk = S.blocks[b];
        bal.push([0, 4, 8, 12].map(s => { const i = Math.min(S.n - 1, blk.lo + s), aa = S.chain.seq[i];
          return clamp(Math.round(-S.F.zK[i] * 3) + 2 + (rng() < S.coupling ? Math.sign(LOCAL[aa]) : 0), -2, 7); })); }
      const KEND = ['d..t.d..d.t..d..', 'd.t..t.dd..t.t..', 'd...t...d.t.t...'];
      let kend = KEND[0];
      forBlocks(S, c => {
        const type = c.ph.role === 'main' ? c.ph.type : 'C', notes = bal[c.b], E = c.ph.energy;
        if (c.j === 0 && c.r === 0) kend = pick(rng, KEND);
        notes.forEach((d, q) => addEv(S, c.k + q * 4, {p: 'metal', n: [pitch(d)], d: 4, v: 0.7}));
        [0, 4, 8, 12].forEach(s => addEv(S, c.k + s, {p: 'kempli', v: s === 0 ? 0.6 : 0.4, d: 1}));
        if (c.r === 0) addEv(S, c.k, {p: 'gong', n: pitch(0) - 24, v: c.j === 0 ? 0.9 : 0.45, d: 16});
        if (type !== 'C') for (let s = 0; s < 16; s++) if (kend[s] !== '.') addEv(S, c.k + s, {p: 'kendang', n: kend[s] === 'd' ? 'G2' : 'D3', v: 0.6, d: 1});
        const kot = type === 'E' || (type === 'H' && c.r === 1);
        if (kot) for (let s = 0; s < 16; s++) {
          const goal = notes[Math.min(3, Math.floor(s / 4) + 1)] ?? notes[3];
          const i = c.blk.lo + s, aa = S.chain.seq[i] || 'G';
          const polos = s % 2 === 0;
          let d = polos ? [goal, goal - 1][(s >> 1) % 2] : [goal + 1, goal + 2][(s >> 1) % 2];
          if (CHARGE[aa] && rng() < S.coupling) d += CHARGE[aa];
          addEv(S, c.k + s, {p: 'kot', n: pitch(d) + 12, v: polos ? 0.55 : 0.5, d: 1});
        }
      });
    },
  },

  dnb: {
    name: 'Drum & Bass', bpm: 172, stepNote: '16n', repeat: 2, mode: 'minor',
    rawPart: 'pluck', rawCenter: 60, rawKick: true,
    legend: [
      'Two-step breakbeat at 172 BPM; ghost snares appear where charged residues sit (with coupling)',
      'Reese bass (two detuned saws, slowly moving filter) plus sub, ducked by the kick',
      'Pads and pluck chords give the liquid side; coil sections become breakdowns without drums',
      'Snare rolls at phrase ends, open hats in sheet sections',
    ],
    build(R, out){
      R.fx = makeFx(out, {decay: 3.5, rev: 0.3, del: 0.28, delayTime: '8n.', fb: 0.35}); R.nodes.push(...R.fx.nodes);
      const K = drumKit(R, out, '909', R.fx); Object.assign(R.parts, drumParts(R, K));
      R.duck = track(R, new Tone.Gain(1)).connect(out);
      R.parts.kick = (t, ev) => { K.kick(t, ev.v); const g = R.duck.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.45, t); g.linearRampToValueAtTime(1, t + 0.18); };
      const rf = track(R, new Tone.Filter({frequency: 500, type: 'lowpass', Q: 2, rolloff: -24})).connect(R.duck);
      const lfo = track(R, new Tone.LFO(0.22, 220, 900).start()); lfo.connect(rf.frequency);
      const dist = track(R, new Tone.Distortion(0.2)).connect(rf);
      R.reese = track(R, new Tone.MonoSynth({oscillator: {type: 'fatsawtooth', count: 2, spread: 28}, filter: {type: 'lowpass', Q: 0.5},
        envelope: {attack: 0.01, decay: 0.3, sustain: 0.9, release: 0.2}, filterEnvelope: {baseFrequency: 3000, octaves: 0}})).connect(dist);
      R.reese.volume.value = -15;
      R.sub = track(R, new Tone.MonoSynth({oscillator: {type: 'sine'}, envelope: {attack: 0.01, decay: 0.2, sustain: 1, release: 0.2}, filterEnvelope: {baseFrequency: 400, octaves: 0}})).connect(R.duck);
      R.sub.volume.value = -8;
      const pc = track(R, new Tone.Chorus(0.6, 3, 0.6).start()).connect(R.duck); pc.connect(R.fx.revIn);
      R.pad = track(R, new Tone.PolySynth(Tone.Synth, {oscillator: {type: 'fattriangle', count: 3, spread: 30}, envelope: {attack: 2, decay: 0.5, sustain: 0.8, release: 3}}));
      R.pad.volume.value = -24; R.pad.connect(pc);
      R.pluck = track(R, new Tone.PolySynth(Tone.Synth, {oscillator: {type: 'triangle'}, envelope: {attack: 0.003, decay: 0.35, sustain: 0, release: 0.3}}));
      R.pluck.volume.value = -18; R.pluck.connect(R.duck); R.pluck.connect(R.fx.delIn);
      for (const k of ['reese', 'sub', 'pad', 'pluck']) R.parts[k] = notePart(R, R[k]);
    },
    compose(S, rng){
      const bb = 36 + S.rootPc, pb = 60 + S.rootPc;
      forBlocks(S, c => {
        const E = c.ph.energy, ch = c.chord, type = c.ph.role === 'main' ? c.ph.type : (c.ph.role === 'intro' ? 'I' : 'C');
        const dr = {};
        if (type === 'H' || type === 'E') {
          dr.kick = c.b % 2 ? 'X.........X..X..' : 'X.........X.....';
          dr.snare = '....X.......X...';
          dr.hat = type === 'E' ? 'x.oxx.oxx.oxx.ox' : 'x.x.x.x.x.x.x.x.';
          if (type === 'E' && c.j % 2 === 0) dr.ohat = '..............x.';
          let sn = dr.snare.split('');
          for (const s of [7, 9, 15]) { const aa = S.chain.seq[c.blk.lo + s]; if (aa && CHARGE[aa] && rng() < S.coupling + 0.3) sn[s] = 'o'; }
          dr.snare = sn.join('');
          if (c.lastInPhrase && c.lastRep) dr.snare = '....X...oxoxXxxX';
        } else dr.shaker = euclidPat(clamp(4 + Math.round(c.blk.chgN * 6), 4, 10), 1, 'o');
        if (type === 'I') dr.hat = 'x.x.x.x.x.x.x.x.';
        emitDrums(S, c.k, dr);
        const r = bb + ch[0], second = rng() < 0.5 ? bb + ch[2] : r + 12;
        const aa = S.chain.seq[c.blk.lo + 8];
        const n2 = aa && 'FWY'.includes(aa) && rng() < S.coupling ? r + 12 : second;
        if (type !== 'I') {
          addEv(S, c.k, {p: 'reese', n: [r], d: 7.5, v: 0.85}); addEv(S, c.k + 8, {p: 'reese', n: [fold(n2, 30, 52)], d: 7.5, v: 0.8});
          if (type !== 'C') { addEv(S, c.k, {p: 'sub', n: [r - 12], d: 7.5, v: 0.9}); addEv(S, c.k + 8, {p: 'sub', n: [fold(n2, 30, 52) - 12], d: 7.5, v: 0.9}); }
        }
        if (c.r === 0) addEv(S, c.k, {p: 'pad', n: ch.map(x => pb + x - 12), d: 16 * S.rep, v: 0.4});
        if (type === 'H' && c.r === 1 || type === 'C') [2, 10].forEach(s => addEv(S, c.k + s, {p: 'pluck', n: [pb + ch[0], pb + ch[1], pb + ch[3]], d: 2, v: 0.5}));
      });
    },
  },

  bossa: {
    name: 'Bossa nova', bpm: 128, stepNote: '8n', repeat: 1, mode: 'auto', gain: 0.9,
    samples: ['acoustic_guitar_nylon', 'acoustic_bass', 'flute'], pools: JAZZ_POOLS, rawPart: 'flute', rawCenter: 72,
    legend: [
      'Nylon guitar with syncopated chord pattern, upright bass on root and fifth',
      'Rim click plays the bossa clave, soft shaker and surdo-like kick',
      'Flute sings the composed melody (enters after the intro)',
      'Jazz-style progressions with 7th and 9th voicings; mode from net charge',
    ],
    build(R, out){
      R.fx = makeFx(out, {decay: 2, rev: 0.25, del: 0}); R.nodes.push(...R.fx.nodes);
      R.gtr = instrument(R, {sample: 'acoustic_guitar_nylon', vol: -5, release: 0.6, synth: pluckSynth(0.8), synthVol: -14}, out, R.fx.revIn);
      R.bass = instrument(R, {sample: 'acoustic_bass', vol: -3, release: 0.25,
        synth: () => new Tone.MonoSynth({oscillator: {type: 'triangle'}, envelope: {attack: 0.004, decay: 0.4, sustain: 0.3, release: 0.1}, filterEnvelope: {baseFrequency: 220, octaves: 1.5}}), synthVol: -6}, out);
      R.flute = instrument(R, {sample: 'flute', vol: -11, release: 0.5,
        synth: poly({oscillator: {type: 'sine'}, envelope: {attack: 0.06, decay: 0.2, sustain: 0.7, release: 0.4}}), synthVol: -16}, out, R.fx.revIn);
      R.rim = track(R, new Tone.MembraneSynth({pitchDecay: 0.004, octaves: 1, envelope: {attack: 0.001, decay: 0.03, sustain: 0}})).connect(out); R.rim.volume.value = -20;
      const sf = track(R, new Tone.Filter({frequency: 6500, type: 'bandpass', Q: 1.3})).connect(out);
      R.shaker = track(R, new Tone.NoiseSynth({envelope: {attack: 0.006, decay: 0.05, sustain: 0}})).connect(sf); R.shaker.volume.value = -30;
      R.kick = track(R, new Tone.MembraneSynth({pitchDecay: 0.04, octaves: 2.5, envelope: {attack: 0.002, decay: 0.3, sustain: 0}})).connect(out); R.kick.volume.value = -16;
      for (const k of ['gtr', 'bass', 'flute']) R.parts[k] = notePart(R, R[k]);
      R.parts.rim = (t, ev) => R.rim.triggerAttackRelease('E5', 0.03, t, ev.v);
      R.parts.shaker = (t, ev) => R.shaker.triggerAttackRelease(0.05, t, ev.v);
      R.parts.kick = (t, ev) => R.kick.triggerAttackRelease('A1', 0.25, t, ev.v);
    },
    compose(S, rng){
      const gb = 52 + S.rootPc, bb = 36 + S.rootPc;
      const GTR = [[0, 3, 5, 9, 12, 14], [0, 3, 6, 8, 11, 14], [1, 3, 6, 9, 11, 14]];
      let pat = GTR[0];
      forBlocks(S, c => {
        const ch = c.chord, E = c.ph.energy;
        if (c.j === 0) pat = pick(rng, GTR);
        const voic = [gb + ch[1], gb + ch[3], gb + ch[0] + 14, gb + ch[2] + 12].map(m => fold(m, 50, 72));
        pat.forEach(s => addEv(S, c.k + s, {p: 'gtr', n: voic, d: 1.6, v: s % 2 ? 0.45 : 0.55}));
        [[0, ch[0], 3], [3, ch[2], 1], [8, ch[0], 3], [11, ch[2], 1]].forEach(([s, x, d]) => addEv(S, c.k + s, {p: 'bass', n: [fold(bb + x, 31, 55)], d, v: 0.8}));
        [0, 3, 6, 10, 12].forEach(s => addEv(S, c.k + s, {p: 'rim', v: 0.7, d: 1}));
        for (let s = 0; s < 16; s++) addEv(S, c.k + s, {p: 'shaker', v: s % 2 ? 0.35 : 0.6 * (0.7 + 0.3 * E), d: 1});
        [0, 3, 8, 11].forEach(s => addEv(S, c.k + s, {p: 'kick', v: s % 8 ? 0.35 : 0.55, d: 1}));
      });
      const mel = composeMelody(S, rng, {center: 72 + S.rootPc - 12, rhythms: RH_PIANO, lo: 2, hi: 11, centerDeg: 5, vel: 0.65, when: ph => ph.role !== 'intro'});
      emitMelody(S, mel, 'flute', {legato: 0.95, shift: () => 12});
    },
  },

  musicbox: {
    name: 'Music box lullaby', bpm: 66, stepNote: '8n', repeat: 1, mode: 'major', gain: 1.8,
    samples: ['music_box', 'celesta', 'string_ensemble_1'],
    pools: {major: {H: [['I','IV','I','V'], ['I','vi','IV','V']], E: [['IV','V','iii','vi'], ['I','iii','IV','V']], C: [['I','IV','I','IV'], ['vi','IV','I','V']]}},
    rawPart: 'box', rawCenter: 72,
    legend: [
      'Music box melody, celesta broken chords, soft strings underneath',
      'Slow, simple harmony, gentle dynamics; good for kids and science outreach',
      'Melody contour from smoothed hydropathy, kept sparse',
      'The last block ends on a slow tonic arpeggio',
    ],
    build(R, out){
      R.fx = makeFx(out, {decay: 4.5, rev: 0.45, del: 0.12, delayTime: '4n', fb: 0.2}); R.nodes.push(...R.fx.nodes);
      R.box = instrument(R, {sample: 'music_box', vol: -6, release: 1.5,
        synth: () => new Tone.PolySynth(Tone.FMSynth, {harmonicity: 4.01, modulationIndex: 6, envelope: {attack: 0.001, decay: 1.6, sustain: 0, release: 1.2},
          modulationEnvelope: {attack: 0.001, decay: 0.3, sustain: 0, release: 0.3}}), synthVol: -12}, out, R.fx.revIn, R.fx.delIn);
      R.cel = instrument(R, {sample: 'celesta', vol: -12, release: 1, synth: pluckSynth(1), synthVol: -18}, out, R.fx.revIn);
      R.str = instrument(R, {sample: 'string_ensemble_1', vol: -20, release: 1.5, attack: 0.6,
        synth: poly({oscillator: {type: 'fatsine', count: 3, spread: 20}, envelope: {attack: 1.2, decay: 0.5, sustain: 0.8, release: 2}}), synthVol: -26}, out, R.fx.revIn);
      for (const k of ['box', 'cel', 'str']) R.parts[k] = notePart(R, R[k]);
    },
    compose(S, rng){
      const cb = 60 + S.rootPc;
      const ARP = [[0, [2], 2, .5], [1, [4], 2, .4], [2, [6], 2, .42], [3, [4], 2, .38], [4, [3], 2, .45], [5, [4], 2, .38], [6, [6], 2, .4], [7, [4], 2, .36]];
      forBlocks(S, c => {
        const ch = c.chord;
        emitPattern(S, c.k, 'cel', ARP, ch, cb - 12, 0.8 + 0.2 * c.ph.energy);
        emitPattern(S, c.k + 8, 'cel', ARP, ch, cb - 12, 0.75 + 0.2 * c.ph.energy);
        if (c.ph.role !== 'intro') addEv(S, c.k, {p: 'str', n: [48 + S.rootPc + ch[0], 48 + S.rootPc + ch[2], 60 + S.rootPc + ch[1]], d: 16, v: 0.35});
        if (c.isLast) [0, 2, 4, 6].forEach((s, x) => addEv(S, c.k + 8 + s, {p: 'box', n: [cb + 12 + [0, 4, 7, 12][x]], d: 8 - s, v: 0.5}));
      });
      const mel = composeMelody(S, rng, {center: 72 + S.rootPc, rhythms: {sparse: RH_PIANO.sparse, mid: RH_PIANO.sparse, dense: RH_PIANO.mid},
        lo: -1, hi: 10, centerDeg: 3, vel: 0.62, densBias: -0.15});
      emitMelody(S, mel, 'box', {legato: 1.0});
    },
  },
};

// ---------- registry: groups for the UI, order = display order ----------
const STYLE_GROUPS = [
  ['Keys & classic', ['piano', 'baroque', 'orchestra', 'musicbox']],
  ['Jazz & world',   ['jazz', 'bossa', 'gamelan']],
  ['Electronic',     ['techno', 'acid', 'dnb', 'synthwave', 'berlin', 'ambient']],
  ['Retro & chill',  ['rpg', 'lofi']],
];
const STYLE_SHORT = {piano: 'PIANO', baroque: 'BAROQUE', orchestra: 'ORCHESTRA', musicbox: 'MUSIC BOX', jazz: 'JAZZ', bossa: 'BOSSA',
  gamelan: 'GAMELAN', techno: 'TECHNO', acid: 'ACID', dnb: 'D&B', synthwave: 'SYNTHWAVE', berlin: 'BERLIN', ambient: 'AMBIENT', rpg: '8-BIT RPG', lofi: 'LO-FI'};
const STYLES = {};
{
  const all = {...NEW_STYLES, ...MORE_STYLES, acid: LEGACY_STYLES.acid, ambient: LEGACY_STYLES.ambient, berlin: LEGACY_STYLES.berlin};
  for (const [g, keys] of STYLE_GROUPS) for (const k of keys) { const s = all[k]; s.key = k; s.group = g; s.short = STYLE_SHORT[k]; STYLES[k] = s; }
}
