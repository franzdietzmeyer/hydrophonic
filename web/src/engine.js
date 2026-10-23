// Hydrophonic, protein-to-music synthesizer. Copyright (C) 2026 Franz Dietzmeyer
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0  (see LICENSE; https://github.com/franzdietzmeyer/hydrophonic)
// ---------- Music engine core ----------
const NOTE_NAMES = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const MODES = {minor:[0,2,3,5,7,8,10], major:[0,2,4,5,7,9,11], pentMajor:[0,2,4,7,9], pentMinor:[0,3,5,7,10]};
// chords as semitones above the key root (diatonic to natural minor / major)
const CHORDS = {
  i:[0,3,7,10], III:[3,7,10,14], iv:[5,8,12,15], v:[7,10,14,17], VI:[8,12,15,19], VII:[10,14,17,20],
  I:[0,4,7,11], ii:[2,5,9,12], iii:[4,7,11,14], IV:[5,9,12,16], V:[7,11,14,17], vi:[9,12,16,19],
};
// progression pools per section type; the composer picks one per phrase
const POOLS = {
  major: {H: [['I','V','vi','IV'],['I','vi','IV','V'],['I','IV','vi','V'],['I','iii','IV','V']],
          E: [['vi','IV','I','V'],['IV','V','iii','vi'],['I','V','IV','V'],['vi','V','IV','V']],
          C: [['IV','I','ii','V'],['vi','ii','V','I'],['I','ii','IV','I'],['IV','iii','ii','V']]},
  minor: {H: [['i','VI','III','VII'],['i','VII','VI','VII'],['i','iv','VI','VII'],['i','III','VII','VI']],
          E: [['i','VII','VI','VII'],['VI','VII','i','i'],['i','iv','VII','III'],['VI','III','VII','i']],
          C: [['i','iv','i','v'],['VI','iv','i','v'],['i','i','iv','iv'],['iv','v','i','i']]},
};
const BLOCK = 16;          // residues per block
const PHRASE = 4;          // blocks per phrase (section decisions happen here only)
const KEY_ROOTS = [9, 0, 2, 4, 5, 7];   // A C D E F G

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const euclid = (k, n, rot = 0) => Array.from({length: n}, (_, i) => (((i + rot) * k) % n) < k);
function degToMidi(base, mode, deg){
  const sc = MODES[mode], L = sc.length;
  return base + 12 * Math.floor(deg / L) + sc[((deg % L) + L) % L];
}
const degSemi = (d, mode) => degToMidi(0, mode, d);
function snapToChord(m, base, chord){
  let best = m, bd = 1e9;
  for (const c of chord) for (let o = -3; o <= 4; o++) {
    const x = base + c + 12 * o, d = Math.abs(x - m);
    if (d < bd) { bd = d; best = x; }
  }
  return best;
}
function semiToDeg(semi, mode){ for (let d = -14; d <= 28; d++) if (degSemi(d, mode) === semi) return d; return null; }
function nearestDeg(d, targets, mode){
  const L = MODES[mode].length; let best = d, bd = 1e9;
  for (const c of targets) for (let o = -4; o <= 4; o++) { const x = c + o * L, dd = Math.abs(x - d);
    if (dd < bd || (dd === bd && x < best)) { bd = dd; best = x; } }
  return best;
}
const LOCAL = {G:-1,A:-1,S:-1,C:0,T:0,P:-2,V:0,D:-1,N:0,I:1,L:1,E:0,Q:0,M:1,H:1,K:1,R:2,F:2,Y:2,W:3};
// residue -> melodic interval, used only with probability = bio coupling
const AA_IV = {A:-1,V:-1,L:-1,I:-2,M:-1,F:3,W:4,Y:3,K:2,R:2,H:1,D:-2,E:-2,S:1,T:1,N:1,Q:1,G:0,P:-3,C:2};

function hashStr(s){ let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function wpick(rng, items){ const tot = items.reduce((a, x) => a + x[1], 0); let r = rng() * tot;
  for (const [it, w] of items) if ((r -= w) <= 0) return it; return items[items.length - 1][0]; }

function chordName(rootPc, key){
  const c = CHORDS[key], pc = (rootPc + c[0]) % 12;
  return NOTE_NAMES[pc] + ((c[1] - c[0]) === 3 ? 'm' : '') + '  (' + key + ')';
}

// ---------- slow layer: blocks, phrases (hysteresis), key, chords, steps, score ----------
function buildSong(chain, F, style, opt = {}){
  const raw = !!opt.raw, n = chain.seq.length, nb = Math.ceil(n / BLOCK);
  const blocks = [];
  for (let b = 0; b < nb; b++) {
    const lo = b * BLOCK, hi = Math.min(n, lo + BLOCK);
    const fr = {H: 0, E: 0, C: 0}; let chg = 0, aro = 0;
    for (let i = lo; i < hi; i++) { fr[chain.ss[i]]++; chg += Math.abs(CHARGE[chain.seq[i]] || 0); if ('FWY'.includes(chain.seq[i])) aro++; }
    for (const k in fr) fr[k] /= (hi - lo);
    blocks.push({lo, hi, fr, chg: chg / (hi - lo), aro: aro / (hi - lo), zK: F.zK[Math.floor((lo + hi - 1) / 2)]});
  }
  const mc = blocks.reduce((a, b) => a + b.chg, 0) / nb;
  const sc = Math.sqrt(blocks.reduce((a, b) => a + (b.chg - mc) ** 2, 0) / nb) || 0.1;
  blocks.forEach(b => b.chgN = clamp((b.chg - mc) / (2 * sc) + 0.5, 0, 1));   // per-protein density 0..1

  const nph = Math.ceil(nb / PHRASE), phrases = [];
  let cur = null;
  for (let p = 0; p < nph; p++) {
    const fr = {H: 0, E: 0, C: 0}, bl = blocks.slice(p * PHRASE, (p + 1) * PHRASE);
    bl.forEach(b => { for (const k in fr) fr[k] += b.fr[k] / bl.length; });
    const best = Object.keys(fr).reduce((a, k) => fr[k] > fr[a] ? k : a, 'C');
    if (cur === null || raw) cur = best;
    else if (best !== cur && fr[best] >= 0.4 && fr[best] > fr[cur] + 0.1) cur = best;
    let role = 'main';
    if (p === 0 && nph >= 3) role = 'intro';
    if (p === nph - 1 && nph >= 4) role = 'outro';
    const energy = role === 'intro' ? 0.35 : role === 'outro' ? 0.4 : {H: 0.75, E: 1.0, C: 0.5}[cur];
    phrases.push({type: cur, role, energy, fr});
  }
  const meanKD = F.kd.reduce((a, v) => a + v, 0) / n;
  const net = chain.seq.reduce((a, x) => a + (CHARGE[x] || 0), 0);
  const rootPc = KEY_ROOTS[clamp(Math.floor((meanKD + 2) / 4 * 6), 0, 5)];
  const mode = style.mode === 'auto' ? (net < 0 ? 'minor' : 'major') : style.mode;
  const seed = hashStr(chain.seq.join('') + '|' + style.key) + (opt.seed || 0) * 7919;
  const rng = mulberry32(seed);

  // progressions: legacy styles have one per type, composer styles pick from pools with repetition
  const pools = style.pools ? style.pools[mode] : style.prog ? {H: [style.prog.H], E: [style.prog.E], C: [style.prog.C]} : POOLS[mode];
  const progs = []; let prevT = null, prevP = null;
  phrases.forEach(ph => {
    const prog = (prevT === ph.type && rng() < 0.6) ? prevP : pick(rng, pools[ph.type]);
    progs.push(prog); prevT = ph.type; prevP = prog;
  });
  const chordKeys = blocks.map((b, bi) => progs[Math.floor(bi / PHRASE)][bi % PHRASE]);
  const rep = raw ? 1 : style.repeat;
  const steps = [];
  for (let b = 0; b < nb; b++) for (let r = 0; r < rep; r++) for (let s = 0; s < BLOCK; s++) {
    const i = b * BLOCK + s;
    steps.push({k: steps.length, i: i < n ? i : -1, s, rep: r, b, ph: Math.floor(b / PHRASE)});
  }
  const S = {chain, F, style, raw, n, nb, blocks, phrases, rootPc, mode, chordKeys, rep,
    chords: chordKeys.map(k => CHORDS[k]), steps, coupling: opt.coupling ?? 0.4,
    bpm: opt.bpm || style.bpm, keyName: NOTE_NAMES[rootPc] + ' ' + mode};
  if (style.compose) {
    S.score = new Array(steps.length);
    if (raw) composeRaw(S); else style.compose(S, rng);
  }
  return S;
}

// ---------- composer helpers ----------
const k0 = (S, b, r) => (b * S.rep + r) * BLOCK;
function addEv(S, k, ev){ if (k < 0 || k >= S.score.length) return; (S.score[k] || (S.score[k] = [])).push(ev); }
function forBlocks(S, fn){
  for (let b = 0; b < S.nb; b++) {
    const p = Math.floor(b / PHRASE), ph = S.phrases[p], j = b % PHRASE;
    const nextPh = S.phrases[p + 1];
    for (let r = 0; r < S.rep; r++) fn({b, r, p, ph, j, k: k0(S, b, r), chord: S.chords[b], blk: S.blocks[b],
      lastInPhrase: j === PHRASE - 1 || b === S.nb - 1, lastRep: r === S.rep - 1, nextPh, isLast: b === S.nb - 1});
  }
}
// tone list: 0 root-12, 1 fifth-12, 2 root, 3 third, 4 fifth, 5 seventh, 6 root+12, 7 third+12, 8 fifth+12
function toneList(chord, base){ const [r, t, f, s] = chord;
  return [base + r - 12, base + f - 12, base + r, base + t, base + f, base + s, base + r + 12, base + t + 12, base + f + 12]; }
// pattern: [[step, [toneIdx...], lenSteps, vel], ...]
function emitPattern(S, k, part, pattern, chord, base, vs = 1){
  const T = toneList(chord, base);
  for (const [st, idx, len, v] of pattern) addEv(S, k + st, {p: part, n: idx.map(i => T[i]), d: len, v: v * vs});
}
// drum map: {part: 'X...x...o...'} with X=1, x=0.7, o=0.35
function emitDrums(S, k, map, vs = 1){
  for (const [part, pat] of Object.entries(map)) for (let s = 0; s < pat.length && s < 16; s++) {
    const v = {X: 1, x: 0.7, o: 0.35}[pat[s]]; if (v) addEv(S, k + s, {p: part, v: v * vs, d: 1});
  }
}
const euclidPat = (k, rot = 0, on = 'x') => euclid(k, 16, rot).map(x => x ? on : '.').join('');

// Melody composer: phrase forms (AABA ...), motifs with rhythm + intervals, chord-tone snapping, cadences.
// Returns notes [{b, st, len, deg, midi, v, ph, j, aa}] (emission is up to the style).
function composeMelody(S, rng, o){
  const mode = S.mode, L = MODES[mode].length, notes = [];
  const strong = o.strong || 4, lo = o.lo ?? -3, hi = o.hi ?? 10;
  S.phrases.forEach((ph, p) => {
    if (o.when && !o.when(ph)) return;
    const form = pick(rng, o.forms || ['AABA', 'ABAB', 'AABC', 'ABAC']);
    const motifs = {}; let prevDeg = null;
    for (let j = 0; j < PHRASE; j++) {
      const b = p * PHRASE + j; if (b >= S.nb) break;
      const letter = form[j], blk = S.blocks[b];
      let m = motifs[letter];
      if (!m) {
        const dens = clamp(0.2 + 0.5 * blk.chgN + 0.4 * (ph.energy - 0.5) + (o.densBias || 0), 0, 1);
        const bucket = dens < 0.38 ? 'sparse' : dens < 0.7 ? 'mid' : 'dense';
        const rhythm = pick(rng, o.rhythms[bucket] || o.rhythms.mid);
        const ivs = rhythm.map(([st], x) => {
          if (x === 0) return 0;
          const aa = S.chain.seq[blk.lo + st];
          if (aa && rng() < S.coupling) return AA_IV[aa];
          return wpick(rng, [[1, 3], [-1, 3], [2, 2], [-2, 2], [0, 1], [3, 0.7], [-3, 0.7], [4, 0.3], [-4, 0.3]]);
        });
        m = motifs[letter] = {rhythm, ivs};
      }
      const cd = S.chords[b].slice(0, 3).map(c => semiToDeg(c, mode)).filter(d => d !== null);
      const center = Math.round(-blk.zK * (o.contour ?? 3)) + (o.centerDeg || 2);
      let d = nearestDeg(prevDeg === null ? center : Math.round((prevDeg + center) / 2), cd, mode);
      m.rhythm.forEach(([st, len], x) => {
        if (x > 0) d += m.ivs[x];
        if (st % strong === 0) d = nearestDeg(d, cd, mode);
        while (d > hi) d -= L; while (d < lo) d += L;
        let ln = len;
        const lastNote = x === m.rhythm.length - 1;
        if (lastNote && (j === PHRASE - 1 || b === S.nb - 1)) {   // cadence: land on chord root, hold
          d = nearestDeg(d, [cd[0]], mode); while (d > hi) d -= L; while (d < lo) d += L; ln = BLOCK - st;
        }
        const arc = [0.85, 0.95, 1.05, 0.9][j];
        const v = clamp((o.vel || 0.7) * arc * (0.8 + 0.25 * ph.energy) * (st % strong === 0 ? 1 : 0.88), 0.05, 1);
        notes.push({b, st, len: ln, deg: d, midi: o.center + degSemi(d, mode), v, ph, j, aa: S.chain.seq[blk.lo + st]});
      });
      prevDeg = d;
    }
  });
  return notes;
}
// Emit melody notes into the score; reps: 'all' | 'last' | 'first'
function emitMelody(S, notes, part, o = {}){
  for (const nt of notes) for (let r = 0; r < S.rep; r++) {
    if (o.reps === 'last' && r !== S.rep - 1) continue;
    if (o.reps === 'first' && r !== 0) continue;
    const p = typeof part === 'function' ? part(nt.ph, r) : part;
    if (!p) continue;
    const shift = (o.shift ? o.shift(nt, r) : 0);
    addEv(S, k0(S, nt.b, r) + nt.st, {p, n: nt.midi + shift, d: nt.len * (o.legato || 0.92), v: nt.v * (o.vs || 1)});
  }
}
// Old 1:1 approach for A/B comparison
function composeRaw(S){
  const st = S.style, part = st.rawPart || 'lead', base = (st.rawCenter || 60) + S.rootPc;
  for (let b = 0; b < S.nb; b++) {
    const k = k0(S, b, 0);
    for (let s = 0; s < BLOCK; s++) {
      const i = b * BLOCK + s; if (i >= S.n) break;
      const aa = S.chain.seq[i];
      addEv(S, k + s, {p: part, n: degToMidi(base, S.mode, Math.round(-S.F.zKraw[i] * 7)), d: 0.9, v: CHARGE[aa] ? 0.95 : 0.5});
      if (st.rawKick && s % 4 === 0) addEv(S, k + s, {p: 'kick', v: 0.9, d: 1});
    }
    if (st.rawBass) addEv(S, k, {p: st.rawBass, n: [36 + S.rootPc + 12], d: 15, v: 0.5});
  }
}

// ---------- samples ----------
const GM_BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
const SAL_BASE = 'https://tonejs.github.io/audio/salamander/';
const SAMPLE_CACHE = new Map();
async function fetchText(url){ const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.text(); }
async function fetchBuf(url){ const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.arrayBuffer(); }
// decode with the one live AudioContext (Safari limits the number of contexts per page; buffers are shared with offline export)
const decodeAudio = ab => Tone.getContext().decodeAudioData(ab);
function noteToMidi(nm){ const m = nm.match(/^([A-G])(b|#|s)?(-?\d)$/); if (!m) return null;
  const acc = m[2] === 'b' ? -1 : m[2] ? 1 : 0;
  return 12 * (+m[3] + 1) + {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11}[m[1]] + acc; }
function loadSample(name){
  if (SAMPLE_CACHE.has(name)) return SAMPLE_CACHE.get(name);
  const p = (async () => {
    const out = {};
    if (name === 'salamander') {
      const names = ['A0']; for (let o = 1; o <= 7; o++) names.push('C' + o, 'Ds' + o, 'Fs' + o, 'A' + o); names.push('C8');
      await Promise.all(names.map(async nm => { out[noteToMidi(nm)] = await decodeAudio(await fetchBuf(SAL_BASE + nm + '.mp3')); }));
    } else {
      const txt = await fetchText(GM_BASE + name + '-mp3.js');
      const re = /"([A-G][b#]?-?\d)"\s*:\s*"data:audio\/[^;"]+;base64,([^"]+)"/g; let m; const jobs = [];
      while ((m = re.exec(txt))) {
        const midi = noteToMidi(m[1]); if (midi === null || midi % 3 !== 0) continue;
        const b64 = m[2];
        jobs.push((async () => { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); out[midi] = await decodeAudio(bin.buffer); })());
      }
      await Promise.all(jobs);
    }
    if (!Object.keys(out).length) throw new Error('no samples for ' + name);
    return out;
  })();
  SAMPLE_CACHE.set(name, p);
  p.catch(() => SAMPLE_CACHE.delete(name));
  return p;
}
// Loads all samples a style needs; failures fall back to synths
async function loadStyleSamples(style, onProgress){
  const res = {}, names = style.samples || [];
  let done = 0;
  const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
  await Promise.all(names.map(async nm => {
    // never block playback for long: slow or missing samples fall back to synths (they keep loading in the background)
    try { res[nm] = await Promise.race([loadSample(nm), timeout(15000)]); } catch (e) { res[nm] = null; console.warn('sample fallback:', nm, e.message); }
    done++; if (onProgress) onProgress(done, names.length);
  }));
  return res;
}
// spec: {sample: 'salamander' | GM name, synth: () => Tone instrument, vol, synthVol, release, attack}
function instrument(R, spec, ...dests){
  const buf = spec.sample && R.samples[spec.sample];
  let node;
  if (buf) { node = new Tone.Sampler({urls: buf, release: spec.release ?? 1, attack: spec.attack ?? 0}); node.volume.value = spec.vol ?? -8; R.used.push(spec.sample); }
  else { node = spec.synth(); node.volume.value = spec.synthVol ?? spec.vol ?? -12; if (spec.sample) R.fallback.push(spec.sample); }
  track(R, node); dests.forEach(d => node.connect(d));
  return node;
}

// ---------- shared audio helpers ----------
function track(R, ...nodes){ R.nodes.push(...nodes); return nodes[0]; }
// Reverb impulse responses are computed directly in JS (decaying stereo noise) and cached.
// Tone.Reverb renders them through a new OfflineAudioContext on every play, which some browsers handle badly.
const IR_CACHE = new Map();
function impulse(decay, preDelay = 0.02){
  const ctx = Tone.getContext().rawContext, sr = ctx.sampleRate, key = decay + '|' + sr;
  if (IR_CACHE.has(key)) return IR_CACHE.get(key);
  const len = Math.max(1, Math.floor(sr * (decay + preDelay))), pre = Math.floor(sr * preDelay);
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = pre; i < len; i++) { const t = (i - pre) / sr; d[i] = (Math.random() * 2 - 1) * Math.pow(10, -3 * t / decay); }
  }
  IR_CACHE.set(key, buf);
  return buf;
}
function makeFx(out, o = {}){
  const rev = new Tone.Convolver(impulse(o.decay || 3)).connect(out);
  const revIn = new Tone.Gain(o.rev ?? 0.25).connect(rev);
  const delF = new Tone.Filter(o.delayTone || 2800, 'lowpass').connect(out);
  delF.connect(revIn);
  const del = new Tone.FeedbackDelay({delayTime: o.delayTime || '8n.', feedback: o.fb ?? 0.35, wet: 1}).connect(delF);
  const delIn = new Tone.Gain(o.del ?? 0.25).connect(del);
  return {rev, revIn, del, delIn, delF, ready: Promise.resolve(), nodes: [rev, revIn, delF, del, delIn]};
}
function bell(R, out, fx){
  const b = track(R, new Tone.FMSynth({harmonicity: 3.01, modulationIndex: 10,
    envelope: {attack: 0.001, decay: 1.6, sustain: 0, release: 1.6},
    modulationEnvelope: {attack: 0.001, decay: 0.4, sustain: 0, release: 0.4}}));
  b.volume.value = -20; b.connect(out); b.connect(fx.revIn); b.connect(fx.delIn);
  return b;
}
const cutoff = (z, e) => 170 * Math.pow(2, (1 - z) * 1.6) * (0.55 + 0.45 * e);
const poly = (opts, voice = Tone.Synth) => () => new Tone.PolySynth(voice, opts);
// generic part: play notes of an event on an instrument
const notePart = (R, inst) => (t, ev) => {
  const n = Array.isArray(ev.n) ? ev.n.map(mtof) : mtof(ev.n);
  inst.triggerAttackRelease(n, Math.max(0.03, ev.d * R.stepSec), t, ev.v);
};

// Synth drum kits: flavor '909' | 'wave' | 'lofi' | 'gb'
function drumKit(R, out, flavor, fx){
  const K = {};
  const P = {
    '909':  {kPD: 0.045, kOct: 4.5, kDec: 0.45, kVol: -4, kNote: 'A0', click: -26, hp: 7500, hat: -30, sn: -18},
    'wave': {kPD: 0.05, kOct: 5, kDec: 0.5, kVol: -4, kNote: 'C1', click: -24, hp: 7000, hat: -32, sn: -14},
    'lofi': {kPD: 0.04, kOct: 3.5, kDec: 0.35, kVol: -6, kNote: 'C1', click: -40, hp: 5000, hat: -30, sn: -16},
    'gb':   {kPD: 0.02, kOct: 3, kDec: 0.12, kVol: -10, kNote: 'C2', click: -60, hp: 5000, hat: -26, sn: -18, osc: 'square'},
  }[flavor];
  const bus = track(R, flavor === 'lofi' ? new Tone.Filter(4200, 'lowpass') : new Tone.Gain(1)).connect(out);
  const kick = track(R, new Tone.MembraneSynth({pitchDecay: P.kPD, octaves: P.kOct, oscillator: {type: P.osc || 'sine'},
    envelope: {attack: 0.001, decay: P.kDec, sustain: 0, release: 0.05}})).connect(bus);
  kick.volume.value = P.kVol;
  const clickHp = track(R, new Tone.Filter(3000, 'highpass')).connect(bus);
  const click = track(R, new Tone.NoiseSynth({envelope: {attack: 0.0005, decay: 0.004, sustain: 0}})).connect(clickHp);
  click.volume.value = P.click;
  K.kick = (t, v) => { kick.triggerAttackRelease(P.kNote, 0.3, t, v); click.triggerAttackRelease(0.005, t, v); };
  const hp = track(R, new Tone.Filter(P.hp, 'highpass')).connect(bus);
  const hat = track(R, new Tone.NoiseSynth({noise: {type: 'white'}, envelope: {attack: 0.001, decay: flavor === 'gb' ? 0.02 : 0.03, sustain: 0}})).connect(hp);
  hat.volume.value = P.hat;
  K.hat = (t, v) => hat.triggerAttackRelease(0.03, t, v);
  const ohat = track(R, new Tone.NoiseSynth({envelope: {attack: 0.002, decay: 0.22, sustain: 0}})).connect(hp);
  ohat.volume.value = P.hat - 3;
  K.ohat = (t, v) => ohat.triggerAttackRelease(0.2, t, v);
  const shp = track(R, new Tone.Filter({frequency: 6500, type: 'bandpass', Q: 1.2})).connect(bus);
  const shaker = track(R, new Tone.NoiseSynth({envelope: {attack: 0.004, decay: 0.035, sustain: 0}})).connect(shp);
  shaker.volume.value = P.hat + 2;
  K.shaker = (t, v) => shaker.triggerAttackRelease(0.03, t, v);
  // snare: tonal body + filtered noise; 'wave' gets a gated reverb
  const snBus = track(R, new Tone.Gain(1)).connect(bus);
  if (flavor === 'wave') {
    const gate = track(R, new Tone.Gain(0)).connect(bus);
    const rv = track(R, new Tone.Convolver(impulse(1.6))).connect(gate);
    snBus.connect(rv); K._gate = gate;
  } else if (fx) snBus.connect(fx.revIn);
  const body = track(R, new Tone.MembraneSynth({pitchDecay: 0.01, octaves: 1.5, envelope: {attack: 0.001, decay: 0.1, sustain: 0}})).connect(snBus);
  body.volume.value = P.sn - 4;
  const snF = track(R, new Tone.Filter({frequency: flavor === 'gb' ? 3000 : 1800, type: 'highpass'})).connect(snBus);
  const snN = track(R, new Tone.NoiseSynth({envelope: {attack: 0.001, decay: flavor === 'gb' ? 0.09 : 0.16, sustain: 0}})).connect(snF);
  snN.volume.value = P.sn;
  K.snare = (t, v) => { if (flavor !== 'gb') body.triggerAttackRelease('E3', 0.1, t, v); snN.triggerAttackRelease(0.15, t, v);
    if (K._gate) { K._gate.gain.setValueAtTime(0.9, t); K._gate.gain.setValueAtTime(0, t + 0.32); } };
  const clF = track(R, new Tone.Filter({frequency: 1200, type: 'bandpass', Q: 1.3})).connect(snBus);
  const clap = track(R, new Tone.NoiseSynth({envelope: {attack: 0.001, decay: 0.022, sustain: 0}})).connect(clF);
  const clapT = track(R, new Tone.NoiseSynth({envelope: {attack: 0.001, decay: 0.16, sustain: 0}})).connect(clF);
  clap.volume.value = P.sn + 2; clapT.volume.value = P.sn;
  K.clap = (t, v) => { [0, 0.011, 0.022].forEach(o => clap.triggerAttackRelease(0.02, t + o, v)); clapT.triggerAttackRelease(0.15, t + 0.03, v); };
  const rim = track(R, new Tone.MembraneSynth({pitchDecay: 0.005, octaves: 1, envelope: {attack: 0.001, decay: 0.04, sustain: 0}})).connect(bus);
  rim.volume.value = -20;
  K.rim = (t, v) => rim.triggerAttackRelease('D5', 0.04, t, v);
  return K;
}
function drumParts(R, K){ const P = {}; for (const k of Object.keys(K)) if (k[0] !== '_') P[k] = (t, ev) => K[k](t, ev.v); return P; }

// ---------- rig: build instruments, schedule song ----------
async function createRig(S, transport, out, onStep, samples){
  const style = S.style;
  const R = {nodes: [], used: [], fallback: [], extraReady: [], samples: samples || {}, parts: {}};
  const div = style.stepNote === '8n' ? 2 : 4;
  R.setBpm = bpm => { R.bpm = bpm; R.stepSec = 60 / bpm / div; R.barSec = 60 / bpm * 4; R.blockSec = R.stepSec * BLOCK; R.totalSec = R.stepSec * S.steps.length; };
  R.setBpm(S.bpm);
  style.build(R, out, S);
  if (R.fx) await R.fx.ready;
  await Promise.all(R.extraReady);
  transport.bpm.value = S.bpm;
  transport.swing = style.swing || 0; transport.swingSubdivision = style.swingSub || '16n';
  let k = 0;
  R.eventId = transport.scheduleRepeat(time => {
    if (k >= S.steps.length) return;
    const st = S.steps[k++];
    try {
      if (S.score) { const evs = S.score[st.k]; if (evs) for (const ev of evs) { const f = R.parts[ev.p]; if (f) f(time, ev); } }
      else style.step(R, time, st, S);
    } catch (e) { console.error(e); }
    if (onStep) onStep(st, time);
  }, style.stepNote, 0);
  R.dispose = () => { R.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); };
  return R;
}
