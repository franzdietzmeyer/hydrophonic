const ACID_CLASS = {A:'root',V:'root',L:'root',I:'root',M:'root',G:'ghost',F:'oct',W:'oct',Y:'oct',
  K:'fifth',R:'fifth',H:'fifth',D:'third',E:'third',C:'sev',P:'slide',S:'rest',T:'rest',N:'rest',Q:'rest'};
const TONE_IDX = {A:0,V:2,L:0,I:2,M:1,F:4,W:5,Y:4,K:3,R:3,H:1,D:1,E:1,C:3,G:0,P:2,S:2,T:1,N:1,Q:3};

const LEGACY_STYLES = {
  acid: {
    name: 'Acid (303 line)', bpm: 126, stepNote: '16n', repeat: 2, mode: 'minor',
    prog: {H: ['i','i','VI','VII'], E: ['i','VII','VI','VII'], C: ['i','i','iv','iv']},
    legend: [
      'Tamed 303: less resonance and distortion than v0.1. Kick 4/4, clap and hats enter with section energy (helix 0.75, sheet 1.0, coil 0.5)',
      '303 line: 1 residue = 1 sixteenth. Aliphatic = root, aromatic = octave jump, K/R/H = fifth, D/E = third',
      'Charged residue = accent, Gly = ghost note, Pro = slide (backbone kink = pitch bend), S/T/N/Q = rest',
      'Filter cutoff follows smoothed hydropathy: hydrophobic core = dark, exposed surface = bright',
      'Hi-hat density = Euclidean rhythm from charge density per block; each block loops twice',
    ],
    build(R, out){
      const fx = R.fx = makeFx(out, {decay: 2.5, rev: 0.15, del: 0.2, delayTime: '8n.', fb: 0.4});
      R.nodes.push(...fx.nodes);
      R.kick = track(R, new Tone.MembraneSynth({pitchDecay: 0.045, octaves: 4.5,
        envelope: {attack: 0.001, decay: 0.38, sustain: 0, release: 0.1}})).connect(out);
      R.kick.volume.value = -3;
      const hp = track(R, new Tone.Filter(9000, 'highpass')).connect(out);
      R.hat = track(R, new Tone.NoiseSynth({envelope: {attack: 0.001, decay: 0.035, sustain: 0}})).connect(hp);
      R.hat.volume.value = -28;
      R.ohat = track(R, new Tone.NoiseSynth({envelope: {attack: 0.002, decay: 0.2, sustain: 0}})).connect(hp);
      R.ohat.volume.value = -30;
      const bp = track(R, new Tone.Filter({frequency: 1500, type: 'bandpass', Q: 0.8})).connect(out);
      bp.connect(fx.revIn);
      R.clap = track(R, new Tone.NoiseSynth({envelope: {attack: 0.003, decay: 0.15, sustain: 0}})).connect(bp);
      R.clap.volume.value = -12;
      const dist = track(R, new Tone.Distortion(0.12)).connect(out);
      dist.connect(fx.delIn);
      R.acid = track(R, new Tone.MonoSynth({oscillator: {type: 'sawtooth'},
        filter: {Q: 6, type: 'lowpass', rolloff: -24},
        envelope: {attack: 0.002, decay: 0.25, sustain: 0.35, release: 0.05},
        filterEnvelope: {attack: 0.002, decay: 0.2, sustain: 0.05, release: 0.1, baseFrequency: 250, octaves: 3}}));
      R.acid.volume.value = -16; R.acid.connect(dist);
      const sf = track(R, new Tone.Filter(1100, 'lowpass')).connect(out);
      sf.connect(fx.delIn); sf.connect(fx.revIn);
      R.stab = track(R, new Tone.PolySynth(Tone.Synth, {oscillator: {type: 'fattriangle', count: 3, spread: 18},
        envelope: {attack: 0.004, decay: 0.25, sustain: 0, release: 0.2}}));
      R.stab.volume.value = -22; R.stab.connect(sf);
      R.bell = bell(R, out, fx);
    },
    step(R, t, st, S){
      const {s} = st, ph = S.phrases[st.ph], E = ph.energy, chord = S.chords[st.b], F = S.F;
      const base = 36 + S.rootPc, aa = st.i >= 0 ? S.chain.seq[st.i] : null;
      if (S.raw) {
        if (s % 4 === 0) R.kick.triggerAttackRelease('C1', '8n', t, 1);
        if (s % 4 === 2) R.ohat.triggerAttackRelease('16n', t, 0.6);
        if (!aa) return;
        R.acid.filterEnvelope.baseFrequency = 150 + 1400 * (F.kd[st.i] + 4.5) / 9;
        R.acid.portamento = 0;
        const m = degToMidi(base + 12, 'minor', Math.round(-F.zKraw[st.i] * 7));
        R.acid.triggerAttackRelease(mtof(m), R.stepSec * 0.8, t, CHARGE[aa] ? 1 : 0.5);
        return;
      }
      if (s === 0 && st.rep === 0) {   // slow parameter moves, ramped over one bar
        R.acid.filter.Q.rampTo(ph.type === 'E' ? 9 : ph.type === 'H' ? 6 : 4, R.barSec, t);
        R.fx.revIn.gain.rampTo(0.06 + 0.35 * (F.bN ? F.bN[st.i] : 0.3), R.barSec, t);
      }
      if (E >= 0.3 && s % 4 === 0) R.kick.triggerAttackRelease('C1', '8n', t, 1);
      if (E >= 0.6 && (s === 4 || s === 12)) R.clap.triggerAttackRelease('16n', t, 0.8);
      if (E >= 0.45 && s % 4 === 2) R.ohat.triggerAttackRelease('16n', t, 0.7);
      if (E >= 0.6) {
        const k = clamp(4 + Math.round(S.blocks[st.b].chg * 12), 4, 11);
        if (euclid(k, 16, 1)[s] && s % 4 !== 2) R.hat.triggerAttackRelease('32n', t, s % 2 ? 0.35 : 0.7);
      }
      if (E >= 0.5 && (s === 6 || (E >= 0.9 && s === 14)))
        R.stab.triggerAttackRelease(chord.slice(0, 3).map(c => mtof(base + 24 + c)), R.stepSec * 1.2, t, 0.6);
      if (!aa) return;
      const cls = ACID_CLASS[aa];
      if (cls !== 'rest') {
        const T = chord.map(c => base + c);
        const m = {root: T[0], ghost: T[0], oct: T[0] + 12, fifth: T[2], third: T[1], sev: T[3], slide: T[1] + 12}[cls];
        const accent = !!CHARGE[aa];
        R.acid.filterEnvelope.octaves = accent ? 3.2 : 2.2;
        R.acid.filterEnvelope.baseFrequency = cutoff(F.zK[st.i], E);
        R.acid.portamento = aa === 'P' ? 0.07 : 0;
        const next = S.chain.seq[st.i + 1];
        const hold = next === 'P' ? 1.15 : cls === 'ghost' ? 0.35 : 0.7;
        R.acid.triggerAttackRelease(mtof(m), R.stepSec * hold, t, cls === 'ghost' ? 0.35 : accent ? 1 : 0.7);
      }
      if (aa === 'C') R.bell.triggerAttackRelease(mtof(snapToChord(base + 48, base, chord)), 0.5, t, 0.5);
    },
  },

  ambient: {
    name: 'Ambient', bpm: 72, gain: 2, stepNote: '8n', repeat: 1, mode: 'major',
    prog: {H: ['I','iii','IV','I'], E: ['vi','IV','I','V'], C: ['IV','I','ii','I']},
    legend: [
      '1 residue = 1 eighth note, one chord per 16-residue block, pads crossfade',
      'Pad brightness glides with smoothed hydropathy (hydrophobic = darker)',
      'Melody contour = smoothed hydropathy (hydrophilic = higher), residue size adds detail',
      'Note density = Euclidean rhythm from charge density; aromatics (F/W/Y) and Cys ring bells',
      'B-factor (flexibility) controls echo feedback: flexible loops smear out',
    ],
    build(R, out){
      const fx = R.fx = makeFx(out, {decay: 9, rev: 0.6, del: 0.3, delayTime: '4n.', fb: 0.45, delayTone: 2000});
      R.nodes.push(...fx.nodes);
      R.padF = track(R, new Tone.Filter(900, 'lowpass')).connect(out);
      const ch = track(R, new Tone.Chorus(0.6, 3.5, 0.5).start());
      ch.connect(R.padF); R.padF.connect(fx.revIn);
      R.pad = track(R, new Tone.PolySynth(Tone.Synth, {oscillator: {type: 'fatsawtooth', count: 3, spread: 25},
        envelope: {attack: 2.5, decay: 1, sustain: 0.8, release: 5}}));
      R.pad.volume.value = -16; R.pad.connect(ch);
      R.drone = track(R, new Tone.Synth({oscillator: {type: 'sine'}, envelope: {attack: 3, decay: 0, sustain: 1, release: 4}})).connect(out);
      R.drone.volume.value = -26;
      R.lead = track(R, new Tone.Synth({oscillator: {type: 'triangle'}, envelope: {attack: 0.04, decay: 0.6, sustain: 0.3, release: 1.8}}));
      R.lead.volume.value = -11; R.lead.connect(out); R.lead.connect(fx.revIn); R.lead.connect(fx.delIn);
      R.windF = track(R, new Tone.Filter(600, 'lowpass')).connect(out);
      R.windF.connect(fx.revIn);
      R.wind = track(R, new Tone.Noise('pink')); R.wind.volume.value = -30; R.wind.connect(R.windF);
      R.bell = bell(R, out, fx); R.bell.volume.value = -13;
    },
    step(R, t, st, S){
      const {s} = st, F = S.F, chord = S.chords[st.b], root = S.rootPc, aa = st.i >= 0 ? S.chain.seq[st.i] : null;
      if (st.k === 0) R.wind.start(t);
      if (S.raw) {
        if (st.k === 0) R.pad.triggerAttackRelease([0, 4, 7].map(c => mtof(48 + root + c)), R.totalSec, t, 0.5);
        if (!aa) return;
        const m = degToMidi(60 + root, 'major', Math.round(-F.zKraw[st.i] * 7));
        R.lead.triggerAttackRelease(mtof(m), R.stepSec * 0.9, t, CHARGE[aa] ? 0.9 : 0.4);
        return;
      }
      if (s === 0) {
        const z = S.blocks[st.b].zK;
        R.pad.triggerAttackRelease(chord.map(c => mtof(48 + root + c)), R.blockSec * 1.05, t, 0.5);
        R.drone.triggerAttackRelease(mtof(36 + root + chord[0]), R.blockSec * 1.02, t, 0.6);
        R.padF.frequency.rampTo(350 + 1500 * (1 - z) / 2, R.blockSec, t);
        R.windF.frequency.rampTo(300 + 900 * (1 - z) / 2, R.blockSec, t);
        R.fx.del.feedback.rampTo(0.3 + 0.35 * (F.bN ? F.bN[st.i] : 0.4), R.blockSec, t);
      }
      if (!aa) return;
      const k = clamp(2 + Math.round(S.blocks[st.b].chg * 14), 2, 7);
      if (euclid(k, 16, 3)[s]) {
        let m = degToMidi(64 + root, 'pentMajor', Math.round(-F.zK[st.i] * 3) + LOCAL[aa]);
        if (s % 4 === 0) m = snapToChord(m, 60 + root, chord);
        R.lead.triggerAttackRelease(mtof(m), R.stepSec * 3, t, 0.55);
      }
      if ('FWYC'.includes(aa) && s % 2 === 0)
        R.bell.triggerAttackRelease(mtof(snapToChord(84 + root + LOCAL[aa], 60 + root, chord)), 1.2, t, 0.45);
    },
  },

  berlin: {
    name: 'Berlin School', bpm: 116, stepNote: '16n', repeat: 2, mode: 'minor',
    prog: {H: ['i','VI','III','VII'], E: ['i','iv','VII','III'], C: ['i','i','VI','VI']},
    legend: [
      'Sequencer arpeggio: an 8-step motif is built from the first residues of each phrase',
      'The motif repeats; charged residues mutate single steps (repetition with variation)',
      'Arp filter sweeps slowly with smoothed hydropathy',
      'Octave-pulse bass on the chord root, string pad per block, soft kick in sheet sections',
      'Cys = bell',
    ],
    build(R, out){
      const fx = R.fx = makeFx(out, {decay: 4, rev: 0.3, del: 0.35, delayTime: '8n', fb: 0.35});
      R.nodes.push(...fx.nodes);
      R.seq = track(R, new Tone.MonoSynth({oscillator: {type: 'sawtooth'}, filter: {Q: 4, type: 'lowpass', rolloff: -24},
        envelope: {attack: 0.003, decay: 0.18, sustain: 0.2, release: 0.08},
        filterEnvelope: {attack: 0.002, decay: 0.15, sustain: 0.1, release: 0.1, baseFrequency: 300, octaves: 2.5}}));
      R.seq.volume.value = -10; R.seq.connect(out); R.seq.connect(fx.delIn);
      R.bass = track(R, new Tone.MonoSynth({oscillator: {type: 'square'}, filter: {Q: 2, type: 'lowpass'},
        envelope: {attack: 0.003, decay: 0.15, sustain: 0.4, release: 0.05},
        filterEnvelope: {attack: 0.002, decay: 0.12, sustain: 0.2, baseFrequency: 120, octaves: 2}})).connect(out);
      R.bass.volume.value = -10;
      const ch = track(R, new Tone.Chorus(0.4, 4, 0.6).start());
      const pf = track(R, new Tone.Filter(1400, 'lowpass')).connect(out);
      ch.connect(pf); pf.connect(fx.revIn);
      R.pad = track(R, new Tone.PolySynth(Tone.Synth, {oscillator: {type: 'fatsawtooth', count: 3, spread: 30},
        envelope: {attack: 1.2, decay: 0.5, sustain: 0.8, release: 2.5}}));
      R.pad.volume.value = -21; R.pad.connect(ch);
      R.kick = track(R, new Tone.MembraneSynth({pitchDecay: 0.05, octaves: 4,
        envelope: {attack: 0.002, decay: 0.3, sustain: 0, release: 0.1}})).connect(out);
      R.kick.volume.value = -7;
      R.bell = bell(R, out, fx);
    },
    step(R, t, st, S){
      const {s} = st, F = S.F, chord = S.chords[st.b], root = S.rootPc, ph = S.phrases[st.ph];
      const aa = st.i >= 0 ? S.chain.seq[st.i] : null;
      const T = [...chord, chord[0] + 12, chord[1] + 12];
      if (S.raw) {
        if (!aa) return;
        if (s % 2 === 0) R.bass.triggerAttackRelease(mtof(36 + root), R.stepSec, t, 0.7);
        R.seq.filterEnvelope.baseFrequency = 150 + 1400 * (F.kd[st.i] + 4.5) / 9;
        R.seq.triggerAttackRelease(mtof(degToMidi(48 + root, 'minor', Math.round(-F.zKraw[st.i] * 7))), R.stepSec * 0.6, t, 0.8);
        return;
      }
      if (s === 0 && st.rep === 0 && st.b % PHRASE === 0) {
        const lo = st.b * BLOCK;
        R.motif = Array.from({length: 8}, (_, j) => TONE_IDX[S.chain.seq[Math.min(S.n - 1, lo + j)]]);
      }
      if (s === 0 && st.rep === 0) R.pad.triggerAttackRelease(chord.map(c => mtof(60 + root + c)), R.blockSec * 1.02, t, 0.5);
      if (s % 2 === 0) R.bass.triggerAttackRelease(mtof(36 + root + chord[0] + (s % 4 === 2 ? 12 : 0)), R.stepSec * 1.2, t, 0.75);
      if (ph.energy >= 0.9 && s % 4 === 0) R.kick.triggerAttackRelease('C1', '8n', t, 0.8);
      if (!aa) return;
      let idx = R.motif ? R.motif[s % 8] : 0;
      if (CHARGE[aa]) idx = (idx + (CHARGE[aa] > 0 ? 1 : 5)) % 6;
      R.seq.filterEnvelope.baseFrequency = cutoff(F.zK[st.i], 0.8);
      R.seq.triggerAttackRelease(mtof(48 + root + T[idx]), R.stepSec * 0.6, t, s % 4 === 0 ? 0.9 : 0.6);
      if (aa === 'C') R.bell.triggerAttackRelease(mtof(snapToChord(84 + root, 60 + root, chord)), 0.6, t, 0.5);
    },
  },

};
