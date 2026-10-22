// Hydrophonic, protein-to-music synthesizer. Copyright (C) 2026 Franz Dietzmeyer
// SPDX-License-Identifier: AGPL-3.0-or-later  (see LICENSE; source: https://github.com/franzdietzmeyer/hydrophonic)
// ---------- Biology: parsing + per-residue features ----------
const THREE = {ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLN:'Q',GLU:'E',GLY:'G',HIS:'H',ILE:'I',
  LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',THR:'T',TRP:'W',TYR:'Y',VAL:'V',MSE:'M'};
// Kyte-Doolittle hydropathy
const KD = {A:1.8,R:-4.5,N:-3.5,D:-3.5,C:2.5,Q:-3.5,E:-3.5,G:-0.4,H:-3.2,I:4.5,L:3.8,K:-3.9,
  M:1.9,F:2.8,P:-1.6,S:-0.8,T:-0.7,W:-0.9,Y:-1.3,V:4.2};
const CHARGE = {D:-1,E:-1,K:1,R:1};

function cifTokenize(line){
  const re = /'(?:[^']|'(?=\S))*'(?=\s|$)|"(?:[^"]|"(?=\S))*"(?=\s|$)|\S+/g;
  const out = []; let m;
  while ((m = re.exec(line))) {
    let t = m[0];
    if ((t[0]==="'" || t[0]==='"') && t.length > 1 && t[t.length-1]===t[0]) t = t.slice(1,-1);
    out.push(t);
  }
  return out;
}

// Returns rows of one mmCIF category (handles loop_ and single key-value form)
function cifCategory(lines, cat){
  const prefix = '_' + cat + '.';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('loop_') && lines[i+1] && lines[i+1].startsWith(prefix)) {
      const keys = []; let j = i + 1;
      while (j < lines.length && lines[j].startsWith(prefix)) { keys.push(lines[j].trim().slice(prefix.length)); j++; }
      const rows = []; let buf = [];
      for (; j < lines.length; j++) {
        const L = lines[j];
        if (L.startsWith('#') || L.startsWith('loop_') || L.startsWith('_')) break;
        if (L.startsWith(';')) {
          let txt = L.slice(1); j++;
          while (j < lines.length && !lines[j].startsWith(';')) { txt += '\n' + lines[j]; j++; }
          buf.push(txt.trim());
        } else buf.push(...cifTokenize(L));
        while (buf.length >= keys.length) {
          const vals = buf.splice(0, keys.length); const o = {};
          keys.forEach((k, x) => o[k] = vals[x]); rows.push(o);
        }
      }
      return rows;
    }
    if (l.startsWith(prefix)) {
      const o = {}; let j = i;
      while (j < lines.length && lines[j].startsWith(prefix)) {
        const t = cifTokenize(lines[j]); const key = t[0].slice(prefix.length);
        if (t.length >= 2) o[key] = t[1];
        else {
          j++;
          if (lines[j] && lines[j].startsWith(';')) {
            let txt = lines[j].slice(1); j++;
            while (j < lines.length && !lines[j].startsWith(';')) { txt += '\n' + lines[j]; j++; }
            o[key] = txt.trim();
          } else if (lines[j]) o[key] = cifTokenize(lines[j])[0];
        }
        j++;
      }
      return [o];
    }
  }
  return [];
}

function parseCif(text, label){
  const lines = text.split(/\r?\n/);
  const atoms = cifCategory(lines, 'atom_site');
  if (!atoms.length) throw new Error('No _atom_site records found in file.');
  const model0 = atoms[0].pdbx_PDB_model_num;
  const chains = new Map();
  for (const a of atoms) {
    if (a.label_atom_id !== 'CA') continue;
    if (a.group_PDB !== 'ATOM' && !(a.group_PDB === 'HETATM' && a.label_comp_id === 'MSE')) continue;
    if (model0 && a.pdbx_PDB_model_num !== model0) continue;
    const alt = a.label_alt_id; if (alt && alt !== '.' && alt !== '?' && alt !== 'A') continue;
    const aa = THREE[a.label_comp_id]; if (!aa) continue;
    const id = a.auth_asym_id || a.label_asym_id;
    if (!chains.has(id)) chains.set(id, {id, labelAsym: a.label_asym_id, res: []});
    const c = chains.get(id);
    const key = a.label_seq_id + '|' + (a.pdbx_PDB_ins_code || '') + '|' + a.auth_seq_id;
    if (c.res.length && c.res[c.res.length-1].key === key) continue;
    c.res.push({key, seqId: +a.label_seq_id, aa, b: +a.B_iso_or_equiv,
      x: +a.Cartn_x, y: +a.Cartn_y, z: +a.Cartn_z});
  }
  const conf = cifCategory(lines, 'struct_conf');
  const sheet = cifCategory(lines, 'struct_sheet_range');
  const titleRow = cifCategory(lines, 'struct')[0];
  const title = titleRow && titleRow.title && titleRow.title !== '?' ? titleRow.title : '';
  const out = [];
  for (const c of chains.values()) {
    const ssMap = new Map();
    for (const r of conf) if (r.beg_label_asym_id === c.labelAsym && /HELX/.test(r.conf_type_id || ''))
      for (let k = +r.beg_label_seq_id; k <= +r.end_label_seq_id; k++) ssMap.set(k, 'H');
    for (const r of sheet) if (r.beg_label_asym_id === c.labelAsym)
      for (let k = +r.beg_label_seq_id; k <= +r.end_label_seq_id; k++) ssMap.set(k, 'E');
    let ss, ssSource;
    if (ssMap.size) { ss = c.res.map(r => ssMap.get(r.seqId) || 'C'); ssSource = 'file annotation'; }
    else { ss = caSecondaryStructure(c.res); ssSource = 'estimated from CA geometry'; }
    out.push({id: c.id, seq: c.res.map(r => r.aa), ss, ssSource,
      b: c.res.map(r => r.b), ca: c.res.map(r => [r.x, r.y, r.z])});
  }
  out.sort((a, b) => b.seq.length - a.seq.length);
  return {label, title, chains: out};
}

// Rough SS from CA geometry (only used when the file has no SS records, e.g. some models)
function caSecondaryStructure(res){
  const n = res.length, ss = new Array(n).fill('C');
  const d = (i, j) => Math.hypot(res[i].x-res[j].x, res[i].y-res[j].y, res[i].z-res[j].z);
  for (let i = 0; i + 4 < n; i++) {
    const d3 = d(i, i+3), d4 = d(i, i+4);
    if (d3 > 4.5 && d3 < 5.7 && d4 > 5.6 && d4 < 6.9) for (let k = i; k <= i+4; k++) ss[k] = 'H';
  }
  for (let i = 1; i + 1 < n; i++) if (ss[i] === 'C' && d(i-1, i+1) > 6.4) ss[i] = 'E';
  const clean = (ch, minLen) => {
    let i = 0;
    while (i < n) { if (ss[i] !== ch) { i++; continue; }
      let j = i; while (j < n && ss[j] === ch) j++;
      if (j - i < minLen) for (let k = i; k < j; k++) ss[k] = 'C';
      i = j; }
  };
  clean('H', 4); clean('E', 3);
  return ss;
}

function parseFasta(text){
  const lines = text.trim().split(/\r?\n/);
  let label = 'sequence';
  if (lines[0].startsWith('>')) label = lines.shift().slice(1).trim().split(/\s+/)[0];
  const seq = lines.join('').toUpperCase().replace(/[^A-Z]/g, '').split('').filter(a => a in KD);
  if (seq.length < 8) throw new Error('Sequence too short or contains no standard amino acids.');
  return {label, title: 'sequence only (no structure)',
    chains: [{id: '-', seq, ss: seq.map(() => 'C'), ssSource: 'none (sequence only)', b: null, ca: null}]};
}

// Centered moving average; window shrinks at the edges
function smooth(arr, win){
  const h = Math.floor(win / 2), n = arr.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = Math.max(0, i-h); k <= Math.min(n-1, i+h); k++) { s += arr[k]; c++; }
    out[i] = s / c;
  }
  return out;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function computeFeatures(chain, win){
  const kd = chain.seq.map(a => KD[a]);
  const chg = chain.seq.map(a => CHARGE[a] || 0);
  const kdS = smooth(kd, win);
  const F = {
    win, kd, kdS,
    zK: null,                                    // smoothed + normalised per protein, -1 hydrophilic .. +1 hydrophobic
    zKraw: kd.map(v => v / 4.5),                 // raw per residue
    chgAbsS: smooth(chg.map(Math.abs), win),
    bN: null,
  };
  const mk = kdS.reduce((a, v) => a + v, 0) / kdS.length;
  const sk = Math.sqrt(kdS.reduce((a, v) => a + (v - mk) ** 2, 0) / kdS.length) || 1;
  F.zK = kdS.map(v => clamp((v - mk) / (1.8 * sk), -1, 1));
  if (chain.b && chain.b.some(v => v !== chain.b[0])) {
    const m = chain.b.reduce((a, v) => a + v, 0) / chain.b.length;
    const sd = Math.sqrt(chain.b.reduce((a, v) => a + (v-m)**2, 0) / chain.b.length) || 1;
    F.bN = smooth(chain.b.map(v => (v-m)/sd), win).map(z => 1 / (1 + Math.exp(-1.5*z)));
  }
  return F;
}

if (typeof module !== 'undefined') module.exports = {parseCif, parseFasta, computeFeatures, smooth, KD, CHARGE};
