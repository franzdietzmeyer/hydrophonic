// Hydrophonic, protein-to-music synthesizer. Copyright (C) 2026 Franz Dietzmeyer
// SPDX-License-Identifier: AGPL-3.0-or-later  (see LICENSE; source: https://github.com/franzdietzmeyer/hydrophonic)
// ---------- App / UI ----------
const $ = id => document.getElementById(id);
const UNIPROT_RE = /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$/;
const SS_COL = {H: '#ff5d6c', E: '#4fa8ff', C: '#6f7a68'};
const SS_NAME = {H: 'helix', E: 'sheet', C: 'coil'};
const THREE_OF = Object.fromEntries(Object.entries(THREE).filter(([k]) => k !== 'MSE').map(([k, v]) => [v, k]));
const CARTS = [['1A2C', 'thrombin'], ['4HHB', 'hemoglobin'], ['1GFL', 'GFP'], ['1UBQ', 'ubiquitin'], ['P69905', 'AlphaFold']];
const state = {prot: null, chain: null, F: null, styleKey: 'piano', raw: false, win: 9, bpm: null, coupling: 0.4, seed: 0,
  song: null, rig: null, master: null, wave: null, fft: null, playing: false, cur: null, block: -1, playToken: 0};
let viz = null;

function setStatus(msg, err){ const s = $('status'); s.textContent = msg.toUpperCase(); s.classList.toggle('err', !!err); s.title = msg; }

async function loadQuery(q){
  q = q.trim();
  const up = q.toUpperCase();
  if (/^[0-9][A-Z0-9]{3}$/.test(up)) return parseCif(await fetchText(`https://files.rcsb.org/download/${up}.cif`), up);
  if (UNIPROT_RE.test(up)) {
    const j = JSON.parse(await fetchText(`https://alphafold.ebi.ac.uk/api/prediction/${up}`));
    if (!j.length || !j[0].cifUrl) throw new Error('No AlphaFold model found for ' + up);
    const P = parseCif(await fetchText(j[0].cifUrl), 'AF-' + up);
    P.chains.forEach(c => { c.b = c.b.map(v => 100 - v); });   // pLDDT -> uncertainty
    P.title = (P.title || 'AlphaFold model') + ' [AlphaFold DB, CC BY 4.0]';
    return P;
  }
  return parseFasta(q);
}

function useProtein(P){
  const was = state.playing; if (was) stop();
  state.prot = P;
  const sel = $('chain'); sel.innerHTML = '';
  P.chains.forEach((c, i) => { const o = document.createElement('option'); o.value = i;
    o.textContent = `${c.id}  ${c.seq.length} AA`; sel.appendChild(o); });
  selectChain(0);
  setStatus(`Loaded ${P.label}${P.title ? ': ' + P.title : ''}`);
  ['play', 'wav'].forEach(id => $(id).disabled = false);
  $('insert').style.display = 'none';
}
function selectChain(i){
  state.chain = state.prot.chains[i];
  if (state.chain.seq.length < 16) setStatus('Chain is very short; pick a longer one for a real song.', true);
  recompute();
  if (viz) viz.setProtein(state.chain, state.F);
  $('hudProt').textContent = `${state.prot.label} chain ${state.chain.id} | ${state.chain.seq.length} aa` + (state.chain.ca ? '' : ' | generated path');
  state.block = -1; renderSteps(0, -1);
}
const makeSong = () => buildSong(state.chain, state.F, STYLES[state.styleKey],
  {raw: state.raw, coupling: state.coupling, seed: state.seed, bpm: state.bpm});
function recompute(){
  renderStyleDesc();
  if (!state.chain) return;
  state.F = computeFeatures(state.chain, state.win);
  const S = makeSong();
  if (state.song && state.playing && state.song.steps.length === S.steps.length) Object.assign(state.song, S);  // live update
  else if (!state.playing) state.song = S;
  const st = STYLES[state.styleKey];
  const secs = S.steps.length * 60 / S.bpm / (st.stepNote === '8n' ? 2 : 4);
  const ss = state.chain.ss.join('');
  $('info').innerHTML = `CHAIN ${state.chain.id} | ${S.n} RESIDUES<br>H ${ss.split('H').length - 1} &middot; E ${ss.split('E').length - 1} &middot; C ${ss.split('C').length - 1}` +
    ` | SS: ${state.chain.ssSource.toUpperCase()}`;
  $('sKey').textContent = S.keyName.toUpperCase();
  $('sLen').textContent = `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`;
  drawPlot();
}

// ---------- style pads + description ----------
function renderStylePads(){
  $('stylePads').innerHTML = STYLE_GROUPS.map(([g, keys]) => `<div class="sgroup"><div class="silk">${g}</div><div class="spads">` +
    keys.map(k => `<button class="pad" data-style="${k}" title="${STYLES[k].name}"><span class="led"></span>${STYLES[k].short}</button>`).join('') + '</div></div>').join('');
  document.querySelectorAll('[data-style]').forEach(b => b.onclick = () => setStyle(b.dataset.style));
  markStyle();
}
function markStyle(){ document.querySelectorAll('[data-style]').forEach(b => b.classList.toggle('on', b.dataset.style === state.styleKey)); }
function renderStyleDesc(){
  const st = STYLES[state.styleKey];
  const src = st.samples && st.samples.length ? 'sampled instruments' : 'synthesized';
  $('styleDesc').innerHTML = `<b>${st.name.toUpperCase()}</b>${st.legend[0]}<br><span style="color:#b98a3a">${st.bpm} BPM default &middot; ${src}</span>`;
  $('legend').innerHTML = (state.raw ? ['RAW 1:1: every residue sets pitch (hydropathy) and loudness (charge) directly, no chords, no smoothing'] : st.legend)
    .map(x => `<li>${x}</li>`).join('');
}
function setStyle(k){
  const was = state.playing; if (was) stop();
  state.styleKey = k; state.bpm = null; knobs.tempo.set(STYLES[k].bpm, true);
  markStyle();
  ensureSamples().then(() => { if (!state.playing) setStatus('Ready: ' + STYLES[state.styleKey].name); });
  recompute(); if (was) play();
}

// ---------- knobs ----------
function makeKnob(el, o){
  el.className = 'knob';
  el.innerHTML = `<div class="kcap" tabindex="0" role="slider" aria-label="${o.label}" title="${o.title || o.label}">
    <svg viewBox="0 0 60 60"><defs><radialGradient id="kg${o.id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#5d6268"/><stop offset="1" stop-color="#1c1e20"/></radialGradient></defs>
    <circle cx="30" cy="30" r="27" fill="#111" /><path class="ktrack" fill="none" stroke="#2c2e31" stroke-width="3.5" stroke-linecap="round"/>
    <path class="karc" fill="none" stroke="#ff7a1a" stroke-width="3.5" stroke-linecap="round" style="filter:drop-shadow(0 0 3px #ff7a1a)"/>
    <circle cx="30" cy="30" r="19" fill="url(#kg${o.id})" stroke="#0b0c0d"/>
    <line class="kptr" x1="30" y1="30" x2="30" y2="14" stroke="#ece7d6" stroke-width="3" stroke-linecap="round"/></svg></div>
    <div class="klabel">${o.label}</div><div class="kval"></div>`;
  const cap = el.querySelector('.kcap'), arc = el.querySelector('.karc'), ptr = el.querySelector('.kptr'), val = el.querySelector('.kval');
  const pt = a => { const r = (a - 90) * Math.PI / 180; return [30 + 24 * Math.cos(r), 30 + 24 * Math.sin(r)]; };
  const path = (a0, a1) => { const [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M${x0},${y0} A24,24 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1}`; };
  el.querySelector('.ktrack').setAttribute('d', path(-135, 135));
  let v = o.value;
  const K = {
    get: () => v,
    set(x, silent){
      x = clamp(o.min + Math.round((x - o.min) / o.step) * o.step, o.min, o.max); v = +x.toFixed(4);
      const a = -135 + 270 * (v - o.min) / (o.max - o.min);
      arc.setAttribute('d', a > -134.5 ? path(-135, a) : ''); ptr.setAttribute('transform', `rotate(${a} 30 30)`);
      val.textContent = o.fmt(v); cap.setAttribute('aria-valuenow', v);
      if (!silent) o.onChange(v);
    },
  };
  let drag = null;
  cap.addEventListener('pointerdown', e => { drag = {y: e.clientY, v}; cap.setPointerCapture(e.pointerId); e.preventDefault(); });
  cap.addEventListener('pointermove', e => { if (!drag) return; const range = o.max - o.min;
    const nv = drag.v + (drag.y - e.clientY) * range / (e.shiftKey ? 600 : 160); if (Math.abs(nv - v) >= o.step / 2) K.set(nv); });
  cap.addEventListener('pointerup', () => drag = null);
  cap.addEventListener('wheel', e => { e.preventDefault(); K.set(v - Math.sign(e.deltaY) * o.step); }, {passive: false});
  cap.addEventListener('dblclick', () => K.set(typeof o.def === 'function' ? o.def() : o.def));
  cap.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { K.set(v + o.step); e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { K.set(v - o.step); e.preventDefault(); } });
  K.set(v, true);
  return K;
}
const knobs = {
  tempo: makeKnob($('kTempo'), {id: 't', label: 'Tempo', title: 'tempo in BPM (live)', min: 40, max: 200, step: 1, value: STYLES[state.styleKey].bpm,
    def: () => STYLES[state.styleKey].bpm, fmt: v => v + ' BPM', onChange: v => {
      state.bpm = v;
      if (state.playing && state.rig) { Tone.Transport.bpm.rampTo(v, 0.3); state.rig.setBpm(v); state.song.bpm = v; $('hudBpm').textContent = `${v} BPM | ${state.song.keyName}`; }
      recompute(); }}),
  smooth: makeKnob($('kSmooth'), {id: 's', label: 'Smooth', title: 'hydropathy smoothing window in residues', min: 1, max: 25, step: 2, value: 9, def: 9,
    fmt: v => v + ' RES', onChange: v => { state.win = v; recompute(); if (viz && state.chain) viz.setProtein(state.chain, state.F); }}),
  coup: makeKnob($('kCoup'), {id: 'c', label: 'Bio', title: 'bio coupling: how strongly single residues pick notes', min: 0, max: 100, step: 5, value: 40, def: 40,
    fmt: v => v + '%', onChange: v => { state.coupling = v / 100; recompute(); }}),
};

// ---------- sequencer strip ----------
function renderSteps(b, active){
  const c = state.chain, el = $('steps');
  if (!el.children.length) el.innerHTML = Array.from({length: 16}, (_, s) => `<div class="step${s % 4 === 0 ? ' beat' : ''}"><span class="sl"></span><span class="aa">-</span><span class="nm">&nbsp;</span></div>`).join('');
  [...el.children].forEach((d, s) => {
    const i = b * BLOCK + s, ok = c && i < c.seq.length;
    d.className = 'step' + (s % 4 === 0 ? ' beat' : '') + (ok ? ' ' + c.ss[i] : ' empty') + (s === active ? ' act' : '');
    d.children[1].textContent = ok ? c.seq[i] : '-';
    d.children[2].textContent = ok ? i + 1 : '';
  });
}

// ---------- analyzer plot ----------
function drawPlot(){
  const cv = $('plot'), dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight || 230;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  g.strokeStyle = 'rgba(70,240,143,.06)'; for (let yy = 0; yy < H; yy += 3) { g.beginPath(); g.moveTo(0, yy + 0.5); g.lineTo(W, yy + 0.5); g.stroke(); }
  if (!state.chain) return;
  const c = state.chain, F = state.F, S = state.song, n = c.seq.length;
  const PW = W - 50, x = i => 10 + PW * (i + 0.5) / n;
  const top = 12, h = H - 92, y = v => top + h / 2 - (v / 4.6) * (h / 2);
  const ssY = top + h + 8, secY = ssY + 26;
  g.strokeStyle = '#1f3a28'; g.lineWidth = 1; g.beginPath(); g.moveTo(10, y(0)); g.lineTo(10 + PW, y(0)); g.stroke();
  for (let b = 0; b <= S.nb; b++) { const xx = x(b * BLOCK - 0.5);
    g.strokeStyle = b % PHRASE === 0 ? '#24442f' : '#132219'; g.beginPath(); g.moveTo(xx, top); g.lineTo(xx, secY + 20); g.stroke(); }
  const line = (arr, col, w, f = y, glow) => { g.strokeStyle = col; g.lineWidth = w; g.shadowColor = glow || 'transparent'; g.shadowBlur = glow ? 6 : 0; g.beginPath();
    arr.forEach((v, i) => i ? g.lineTo(x(i), f(v)) : g.moveTo(x(i), f(v))); g.stroke(); g.shadowBlur = 0; };
  line(F.kd, '#3f5a46', 1);
  if (F.bN) line(F.bN, 'rgba(70,240,143,.6)', 1.2, v => top + h - v * h);
  line(F.kdS, '#ffb000', 2.2, y, 'rgba(255,176,0,.8)');
  g.fillStyle = '#5f8a6c'; g.font = '11px "Share Tech Mono",monospace';
  g.fillText('HYDROPHOBIC', 14, top + 10); g.fillText('HYDROPHILIC', 14, top + h - 4);
  c.ss.forEach((s, i) => { g.fillStyle = SS_COL[s]; g.fillRect(x(i - 0.5), ssY, PW / n + 0.5, 18); });
  S.phrases.forEach((p, k) => {
    const x0 = x(k * PHRASE * BLOCK - 0.5), x1 = x(Math.min(n, (k + 1) * PHRASE * BLOCK) - 0.5);
    g.globalAlpha = 0.25 + 0.75 * p.energy; g.fillStyle = SS_COL[p.type]; g.fillRect(x0 + 1, secY, x1 - x0 - 2, 18);
    g.globalAlpha = 1; g.fillStyle = '#050806';
    if (x1 - x0 > 40) g.fillText((p.role !== 'main' ? p.role.toUpperCase() + ' ' : '') + SS_NAME[p.type].toUpperCase(), x0 + 5, secY + 13);
  });
  g.fillStyle = '#5f8a6c'; g.fillText('SS', W - 34, ssY + 13); g.fillText('SEC', W - 34, secY + 13);
  if (state.cur && state.cur.i >= 0) {
    const xx = x(state.cur.i); g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.shadowColor = '#fff'; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(xx, top); g.lineTo(xx, secY + 20); g.stroke(); g.shadowBlur = 0;
  }
  g.fillStyle = '#5f8a6c'; g.fillText('1', 10, H - 6); g.fillText(String(n), 10 + PW - 20, H - 6);
}

function onStep(st){
  state.cur = st;
  const S = state.song;
  if (viz) viz.onStep(st, S);
  if (st.b !== state.block) { state.block = st.b; }
  renderSteps(st.b, st.s);
  const ph = S.phrases[st.ph], chord = S.raw ? 'RAW' : chordName(S.rootPc, S.chordKeys[st.b]).split(' ')[0];
  if (st.i >= 0) { $('hudRes').textContent = `${THREE_OF[S.chain.seq[st.i]]} ${st.i + 1}`;
    $('hudSS').textContent = `${SS_NAME[S.chain.ss[st.i]]} | kd ${KD[S.chain.seq[st.i]].toFixed(1)}`; }
  $('hudChord').textContent = chord;
  const sec = ph.role !== 'main' ? ph.role : SS_NAME[ph.type];
  $('hudSec').textContent = `${sec} | block ${st.b + 1}/${S.nb}`;
  $('sBlock').textContent = `${st.b + 1}/${S.nb}${S.rep > 1 ? ' ' + (st.rep + 1) + '/' + S.rep : ''}`;
  $('sChord').textContent = chord; $('sSec').textContent = sec.toUpperCase();
  const evs = S.score && S.score[st.k];
  if (evs ? evs.some(e => e.p === 'kick') : st.s % 4 === 0) { const l = $('led'); l.classList.add('on'); setTimeout(() => l.classList.remove('on'), 90); }
  if (st.s % 2 === 0) drawPlot();
}

// ---------- audio ----------
function makeMaster(gain = 0.9){
  const lim = new Tone.Limiter(-1).toDestination();
  const comp = new Tone.Compressor({threshold: -18, ratio: 3, attack: 0.01, release: 0.25}).connect(lim);
  const inp = new Tone.Gain(gain).connect(comp);
  return {inp, lim, nodes: [inp, comp, lim]};
}
const masterGain = () => { const s = STYLES[state.styleKey]; return 0.9 * (s.gain || 1) * (state.raw ? (s.rawGain || 1) : 1); };
async function ensureSamples(){
  const st = STYLES[state.styleKey];
  if (!st.samples || !st.samples.length) return {};
  setStatus('Loading samples...');
  return loadStyleSamples(st, (d, n) => setStatus(`Loading samples ${d}/${n}...`));
}
const audioInfo = () => ` | audio ${Tone.context.state} ${Math.round(Tone.context.sampleRate / 100) / 10} kHz`;
function sampleReport(R){
  const st = STYLES[state.styleKey];
  if (!st.samples) return setStatus(`Playing: ${st.name} (synthesized)` + audioInfo());
  const fb = [...new Set(R.fallback)];
  setStatus(`Playing: ${st.name}` + (fb.length ? ` | synth fallback for: ${fb.join(', ')}` : ' | samples loaded') + audioInfo(), fb.length > 0);
}
async function play(){
  if (!state.chain) return;
  try { await Tone.start(); } catch (e) { console.error(e); }
  if (Tone.context.state !== 'running') { try { await Tone.context.rawContext.resume(); } catch (e) {} }
  if (Tone.context.state !== 'running') {
    setStatus('Audio is blocked by the browser: click anywhere on the page, then press PLAY again', true); return; }
  stop();
  const token = ++state.playToken;
  $('play').classList.add('down');
  try { await playInner(token); }
  catch (e) { console.error(e); stop(); setStatus('Playback failed: ' + (e && e.message || e) + ' (see browser console)', true); }
}
async function playInner(token){
  const samples = await ensureSamples();
  if (token !== state.playToken) return;   // a newer play/stop request won
  state.song = makeSong();
  state.master = makeMaster(masterGain());
  state.wave = new Tone.Waveform(1024); state.master.lim.connect(state.wave);
  state.fft = new Tone.Analyser('fft', 1024); state.master.lim.connect(state.fft);
  if (viz) { viz.setAudio(state.fft, state.wave); viz.setPlaying(true); }
  $('hudStyle').textContent = STYLES[state.styleKey].name; $('hudBpm').textContent = `${state.song.bpm} BPM | ${state.song.keyName}`;
  const T = Tone.Transport;
  state.rig = await createRig(state.song, T, state.master.inp, (st, time) => Tone.Draw.schedule(() => onStep(st), time), samples);
  sampleReport(state.rig);
  T.scheduleOnce(time => Tone.Draw.schedule(stop, time), state.rig.totalSec + 4);
  T.position = 0; T.start('+0.1');
  state.playing = true; $('stop').disabled = false;
  requestAnimationFrame(drawScope);
}
function stop(){
  state.playToken++;
  const T = Tone.Transport; T.stop(); T.cancel(0);
  if (state.rig) state.rig.dispose();
  if (state.master) state.master.nodes.forEach(n => n.dispose());
  if (state.wave) state.wave.dispose();
  if (state.fft) state.fft.dispose();
  if (viz) { viz.setAudio(null, null); viz.setPlaying(false); }
  state.rig = state.master = state.wave = state.fft = null; state.playing = false; state.cur = null;
  $('stop').disabled = true; $('play').classList.remove('down');
  if (state.chain) { renderSteps(Math.max(0, state.block), -1); drawPlot(); }
}
function drawScope(){
  const cv = $('scope'), dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight || 56;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  if (!state.wave) return;
  const v = state.wave.getValue();
  g.strokeStyle = '#46f08f'; g.lineWidth = 1.5; g.shadowColor = '#46f08f'; g.shadowBlur = 6; g.beginPath();
  v.forEach((s, i) => { const xx = i / (v.length - 1) * W, yy = H / 2 - s * H * 0.45; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); });
  g.stroke();
  if (state.playing) requestAnimationFrame(drawScope);
}

async function renderOffline(seconds){
  const S = makeSong();
  const samples = await ensureSamples();
  const buf = await Tone.Offline(async ctx => {
    const M = makeMaster(masterGain());
    await createRig(S, ctx.transport, M.inp, null, samples);
    ctx.transport.start(0);
  }, seconds || (S.steps.length * 60 / S.bpm / (S.style.stepNote === '8n' ? 2 : 4) + 5), 2, 44100);
  return buf.get();
}
function wavBlob(ab){
  const ch = ab.numberOfChannels, len = ab.length, sr = ab.sampleRate;
  const dv = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + len * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
  ws(36, 'data'); dv.setUint32(40, len * ch * 2, true);
  const data = Array.from({length: ch}, (_, c) => ab.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([dv], {type: 'audio/wav'});
}

// ---------- wiring ----------
$('carts').innerHTML = CARTS.map(([id, nm]) => `<button class="cart" data-q="${id}"><b>${id}</b>${nm}</button>`).join('');
$('load').onclick = async () => {
  setStatus('Loading ' + $('q').value.trim().slice(0, 30) + '...'); $('load').classList.add('down');
  try { useProtein(await loadQuery($('q').value)); }
  catch (e) { setStatus(`Could not load: ${e.message}. Try the offline demo or a .cif file.`, true); }
  $('load').classList.remove('down');
};
$('q').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !$('q').value.startsWith('>')) { e.preventDefault(); $('load').click(); } });
document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { $('q').value = b.dataset.q; $('load').click(); });
$('demo').onclick = () => { const d = JSON.parse(JSON.stringify(DEMO_1BD2));
  d.chains.forEach(c => { c.seq = c.seq.split(''); c.ss = c.ss.split(''); }); useProtein(d); };
$('file').onchange = async e => { const f = e.target.files[0]; if (!f) return;
  try { useProtein(parseCif(await f.text(), f.name)); } catch (err) { setStatus(err.message, true); } };
$('chain').onchange = e => { const was = state.playing; if (was) stop(); selectChain(+e.target.value); if (was) play(); };
$('reroll').onclick = () => { state.seed++; $('seedV').textContent = String(state.seed).padStart(2, '0'); recompute(); };
const setMode = raw => { const was = state.playing; if (was) stop(); state.raw = raw;
  $('modeSw').classList.toggle('on', raw); $('modeSw').setAttribute('aria-checked', raw);
  $('lRaw').classList.toggle('on-label', raw); $('lMus').classList.toggle('on-label', !raw); recompute(); if (was) play(); };
$('modeSw').onclick = () => setMode(!state.raw);
$('modeSw').onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setMode(!state.raw); } };
$('play').onclick = play; $('stop').onclick = stop;
$('wav').onclick = async () => {
  $('wav').disabled = true; $('wav').classList.add('on'); setStatus('Recording WAV offline (may take a few seconds)...');
  try {
    const ab = await renderOffline();
    const a = document.createElement('a'); a.href = URL.createObjectURL(wavBlob(ab));
    a.download = `hydrophonic_${state.prot.label}_${state.chain.id}_${state.styleKey}${state.raw ? '_raw' : ''}.wav`; a.click();
    setStatus('WAV exported.');
  } catch (e) { setStatus('Export failed: ' + e.message, true); }
  $('wav').disabled = false; $('wav').classList.remove('on');
};
window.addEventListener('resize', () => { if (state.chain) drawPlot(); });

// ---------- visualizer ----------
try { viz = new ProteinViz($('viz')); if (viz.failed) { $('vizErr').textContent = 'WebGL2 not available'; viz = null; } }
catch (e) { $('vizErr').textContent = 'Visualizer error: ' + e.message; console.error(e); viz = null; }
$('vizPads').innerHTML = [['auto', 'Auto'], ...Object.entries(VIZ_PRESETS).map(([k, p]) => [k, p.name.split(' ')[0]])]
  .map(([k, nm]) => `<button class="pad${k === 'auto' ? ' on' : ''}" data-viz="${k}" title="${k === 'auto' ? 'follows the song sections' : VIZ_PRESETS[k].name}"><span class="led"></span>${nm}</button>`).join('');
const markViz = () => document.querySelectorAll('[data-viz]').forEach(b => b.classList.toggle('on', viz && (viz.auto ? b.dataset.viz === 'auto' : b.dataset.viz === viz.presetKey)));
document.querySelectorAll('[data-viz]').forEach(b => b.onclick = () => { if (viz) { viz.setPreset(b.dataset.viz); markViz(); } });
if (viz) viz.onPreset = k => { $('hudPreset').textContent = VIZ_PRESETS[k].name; markViz(); };
$('vizColor').onchange = e => { if (viz) viz.colorOverride = +e.target.value; };
const fullscreen = () => { const s = $('stage'); document.fullscreenElement ? document.exitFullscreen() : s.requestFullscreen && s.requestFullscreen(); };
$('vizFull').onclick = fullscreen;
$('stage').ondblclick = fullscreen;
document.addEventListener('keydown', e => { if (['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target.tagName) || e.target.getAttribute('role') === 'slider') return;
  if (e.key === 'f') fullscreen(); else if (e.key === 'n' && viz) { viz.next(); markViz(); }
  else if (e.key === ' ') { e.preventDefault(); state.playing ? stop() : play(); } });

renderStylePads(); renderStyleDesc(); renderSteps(0, -1);
// unlock audio on the first interaction anywhere (some browsers only allow it inside a direct gesture)
// Safari counts click / touchend / keydown / mousedown as activation, not pointerdown; 'interrupted' is Safari's own state
const unlock = () => { if (Tone.context.state !== 'running') Tone.start().catch(() => {}); };
['pointerdown', 'mousedown', 'click', 'keydown', 'touchstart', 'touchend'].forEach(ev => document.addEventListener(ev, unlock, {capture: true, passive: true}));
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.playing) unlock(); });
window.addEventListener('error', e => setStatus('Error: ' + e.message, true));
window.addEventListener('unhandledrejection', e => setStatus('Error: ' + (e.reason && e.reason.message || e.reason), true));
window.__mf = {state, renderOffline, useProtein, loadQuery, setMode, setStyle, STYLES, makeSong, knobs, get viz(){ return viz; }};
