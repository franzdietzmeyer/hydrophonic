// Hydrophonic, protein-to-music synthesizer. Copyright (C) 2026 Franz Dietzmeyer
// SPDX-License-Identifier: AGPL-3.0-or-later  (see LICENSE; source: https://github.com/franzdietzmeyer/hydrophonic)
// ---------- Visualizer: MilkDrop-style feedback engine, the protein is the central "custom shape" ----------
// Pipeline per frame (as in MilkDrop): warp previous frame (zoom, rot, warp, dx/dy, kaleido) -> decay ->
// draw shapes/waves into it (protein trail, wave ring, beat rings) -> composite (echo, bloom, CRT) + crisp protein layer.
const VIZ_PRESETS = {
  kaleido: {name: 'Kaleido Helix',  zoom: 1.012, rot: 0.010, warp: 0.35, warpSpeed: 0.5, decay: 0.945, kaleido: 6, hue: 0.004, echo: 0.0,  trail: 0.45, crisp: 0.85, width: 2.4, ring: 0.6, waveAmp: 0.0,  spin: 0.22, points: 0.0, colorMode: 1},
  tunnel:  {name: 'Tunnel Fold',    zoom: 1.045, rot: 0.004, warp: 0.5,  warpSpeed: 0.7, decay: 0.95,  kaleido: 0, hue: 0.006, echo: 0.25, trail: 0.55, crisp: 0.8,  width: 2.0, ring: 0.9, waveAmp: 0.0,  spin: 0.35, points: 0.25, colorMode: 0},
  plasma:  {name: 'Plasma Drift',   zoom: 0.998, rot: -0.002, warp: 2.6, warpSpeed: 1.1, decay: 0.968, kaleido: 0, hue: 0.002, echo: 0.0,  trail: 0.4,  crisp: 0.9,  width: 2.6, ring: 0.3, waveAmp: 0.0,  spin: 0.12, points: 0.0, colorMode: 2},
  scope:   {name: 'Backbone Scope', zoom: 1.0,   rot: 0.0,   warp: 0.15, warpSpeed: 0.3, decay: 0.86,  kaleido: 0, hue: 0.01,  echo: 0.0,  trail: 0.7,  crisp: 1.0,  width: 1.8, ring: 0.0, waveAmp: 0.22, spin: 0.18, points: 0.0, colorMode: 1},
  hyper:   {name: 'Hyperspace',     zoom: 1.07,  rot: 0.0,   warp: 0.1,  warpSpeed: 0.2, decay: 0.92,  kaleido: 0, hue: 0.003, echo: 0.0,  trail: 0.2,  crisp: 0.6,  width: 1.2, ring: 0.4, waveAmp: 0.0,  spin: 0.5,  points: 1.0, colorMode: 0},
  mirror:  {name: 'Mirror Crystal', zoom: 0.985, rot: 0.02,  warp: 0.6,  warpSpeed: 0.5, decay: 0.95,  kaleido: 4, hue: 0.008, echo: 0.4,  trail: 0.45, crisp: 0.8,  width: 2.2, ring: 0.5, waveAmp: 0.08, spin: 0.25, points: 0.3, colorMode: 2},
};
const VIZ_AUTO = {H: 'kaleido', E: 'tunnel', C: 'plasma', intro: 'scope', outro: 'hyper'};
const VIZ_DISCRETE = ['kaleido', 'colorMode'];

const GLSL_HSV = `vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1., 2./3., 1./3.)) * 6. - 3.); return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y); }`;
const VS_QUAD = `#version 300 es
in vec2 aPos; out vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0., 1.); }`;
const FS_FEEDBACK = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uPrev;
uniform float uTime, uZoom, uRot, uWarp, uWarpSpeed, uDecay, uKaleido, uHueShift, uBass, uTreb, uAspect, uStep;
vec3 hueRot(vec3 c, float a){
  const mat3 toY = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toR = mat3(1., 1., 1., 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 y = toY * c; float h = atan(y.z, y.y) + a, ch = length(y.yz);
  return toR * vec3(y.x, ch * cos(h), ch * sin(h));
}
void main(){
  vec2 p = vUv - 0.5; p.x *= uAspect;
  if (uKaleido > 0.5) {
    float a = atan(p.y, p.x), r = length(p), seg = 6.2831853 / uKaleido;
    a = mod(a, seg); a = abs(a - seg * 0.5); p = r * vec2(cos(a), sin(a));
  }
  float r = length(p);
  float z = pow(max(0.5, uZoom + 0.015 * (uBass - 1.0)), uStep);   // frame-rate independent (tuned for 60 fps)
  p /= mix(1.0, z, 0.6 + 0.8 * r);                       // zoomexp-like: stronger at the edges
  float c = cos(uRot * uStep), s = sin(uRot * uStep); p = mat2(c, -s, s, c) * p;
  float t = uTime * uWarpSpeed;
  p += uWarp * 0.006 * uStep * vec2(sin(p.y * 7.0 + t * 1.3 + r * 4.0), cos(p.x * 6.0 - t * 1.1 + r * 3.0));
  p.x /= uAspect;
  vec2 uv = p + 0.5;
  vec2 ca = (uv - 0.5) * 0.004 * uTreb;
  vec3 col = vec3(texture(uPrev, uv + ca).r, texture(uPrev, uv).g, texture(uPrev, uv - ca).b);
  col = hueRot(col, uHueShift * uStep);
  col = col * pow(uDecay, uStep) - 0.004 * uStep;
  o = vec4(max(col, 0.0), 1.0);
}`;
const FS_COMP = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex, uTop; uniform vec2 uRes; uniform float uFlash, uEcho, uScan, uTime;
void main(){
  vec2 cc = vUv - 0.5; float d = dot(cc, cc);
  vec2 uv = 0.5 + cc * (1.0 + 0.07 * d);                 // slight CRT barrel
  vec3 col = texture(uTex, uv).rgb;
  vec3 e = texture(uTex, vec2(1.0 - uv.x, uv.y) * 0.9 + 0.05).rgb;
  col = mix(col, max(col, e), uEcho);                    // MilkDrop "echo" layer, x-flipped
  vec3 b = vec3(0.);
  for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; vec2 dv = vec2(cos(a), sin(a)) / uRes;
    b += texture(uTex, uv + dv * 4.0).rgb + texture(uTop, uv + dv * 3.0).rgb + 0.6 * texture(uTop, uv + dv * 9.0).rgb; }
  vec3 top = texture(uTop, uv).rgb;
  col += top + b / 8.0 * 0.45 + uFlash * 0.18;
  col *= 1.0 - uScan * 0.16 * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
  col *= smoothstep(0.95, 0.25, length(cc));
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) col = vec3(0.);
  o = vec4(col / (1.0 + 0.25 * col), 1.0);              // soft tone-map
}`;
const VS_RIB = `#version 300 es
in vec3 aPos, aPrev, aNext; in float aSide, aRes, aSS, aProp;
uniform mat4 uMVP; uniform vec2 uRes; uniform float uWidth, uCur, uBass, uWaveAmp, uNRes, uTime, uBreath;
uniform sampler2D uWave;
out float vSide, vRes, vSS, vProp, vDepth;
vec3 disp(vec3 p){
  float w = texture(uWave, vec2(fract(aRes / uNRes * 2.0 + uTime * 0.05), 0.5)).r * 2.0 - 1.0;
  return p * (1.0 + uBreath) + normalize(p + 1e-4) * w * uWaveAmp;
}
void main(){
  vec4 c = uMVP * vec4(disp(aPos), 1.), p0 = uMVP * vec4(disp(aPrev), 1.), n0 = uMVP * vec4(disp(aNext), 1.);
  vec2 dir = (n0.xy / n0.w - p0.xy / p0.w) * uRes;
  dir = length(dir) > 1e-5 ? normalize(dir) : vec2(1., 0.);
  vec2 nrm = vec2(-dir.y, dir.x);
  float near = exp(-abs(aRes - uCur) * 0.35);
  float ssW = aSS < 0.5 ? 1.15 : aSS < 1.5 ? 1.7 : 0.75;
  float wpx = uWidth * ssW * (1.0 + 0.5 * max(uBass - 1.0, 0.0) + 2.0 * near);
  c.xy += nrm * wpx * aSide * 2.0 / uRes * c.w;
  gl_Position = c; vSide = aSide; vRes = aRes; vSS = aSS; vProp = aProp; vDepth = c.w;
}`;
const FS_RIB = `#version 300 es
precision highp float;
in float vSide, vRes, vSS, vProp, vDepth; out vec4 o;
uniform float uCur, uHue, uNRes, uColorMode, uGain, uPlaying;
${GLSL_HSV}
void main(){
  float edge = 1.0 - abs(vSide), a = edge * edge;
  float hue;
  if (uColorMode < 0.5) hue = vRes / uNRes * 0.85 + uHue;
  else if (uColorMode < 1.5) hue = (vSS < 0.5 ? 0.97 : vSS < 1.5 ? 0.58 : 0.36) + uHue * 0.3;
  else hue = mix(0.55, 0.06, vProp * 0.5 + 0.5) + uHue * 0.2;
  vec3 col = hsv2rgb(vec3(fract(hue), 0.8, 1.0));
  float played = uPlaying > 0.5 ? (vRes <= uCur ? 1.0 : 0.3) : 0.8;
  float near = exp(-abs(vRes - uCur) * 0.5) * uPlaying;
  col = col * (0.3 + 0.7 * played) + vec3(near * 1.6);
  col *= clamp(1.6 - (vDepth - 2.6) * 0.6, 0.35, 1.3);
  o = vec4(col * a * uGain + vec3(pow(edge, 8.0) * 0.25 * uGain), 1.0);
}`;
const VS_PTS = `#version 300 es
in vec3 aPos; in float aRes, aSS, aProp;
uniform mat4 uMVP; uniform float uSize, uCur, uResY, uFlare, uBreath;
out float vRes, vSS, vProp;
void main(){
  vec4 c = uMVP * vec4(aPos * (1.0 + uBreath), 1.);
  float near = exp(-abs(aRes - uCur) * 0.5);
  gl_Position = c;
  gl_PointSize = uFlare > 0.5 ? uSize * uResY / 600.0 / c.w : uSize * (1.0 + 2.5 * near) * uResY / 900.0 / c.w;
  vRes = aRes; vSS = aSS; vProp = aProp;
}`;
const FS_PTS = `#version 300 es
precision highp float;
in float vRes, vSS, vProp; out vec4 o;
uniform float uHue, uNRes, uGain, uFlare;
${GLSL_HSV}
void main(){
  vec2 q = gl_PointCoord - 0.5; float d = length(q);
  float a = uFlare > 0.5 ? exp(-d * 9.0) + 0.6 * exp(-abs(q.x) * 60.0) * exp(-abs(q.y) * 3.0) + 0.6 * exp(-abs(q.y) * 60.0) * exp(-abs(q.x) * 3.0)
                         : smoothstep(0.5, 0.0, d);
  vec3 col = uFlare > 0.5 ? vec3(1.0, 0.95, 0.85) : hsv2rgb(vec3(fract(vRes / uNRes * 0.85 + uHue + 0.5), 0.6, 1.0));
  o = vec4(col * a * uGain, 1.0);
}`;
const VS_L2D = `#version 300 es
in vec3 aPos; out float vSide; void main(){ vSide = aPos.z; gl_Position = vec4(aPos.xy, 0., 1.); }`;
const FS_L2D = `#version 300 es
precision highp float; in float vSide; out vec4 o; uniform vec4 uColor;
void main(){ float e = 1.0 - abs(vSide); o = vec4(uColor.rgb * e * e * uColor.a, 1.0); }`;

function hsv(h, s, v){ const f = n => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; }
const M4 = {
  mul(a, b){ const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  persp(fov, asp, n, f){ const t = 1 / Math.tan(fov / 2), o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
  rotY(a){ const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); },
  rotX(a){ const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); },
  trans(x, y, z){ return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]); },
};

// Fake 3D path when there is no structure (FASTA): helices, strands and a persistent random walk, seeded by sequence
function pseudoCA(chain){
  const rng = mulberry32(hashStr(chain.seq.join(''))), pts = [];
  let p = [0, 0, 0], d = [1, 0, 0], ang = 0;
  for (let i = 0; i < chain.seq.length; i++) {
    const ss = chain.ss[i];
    if (ss === 'H') { ang += 1.745; const u = [Math.cos(ang) * 2.3, Math.sin(ang) * 2.3, 0];
      p = [p[0] + d[0] * 1.5 + (u[0] - Math.cos(ang - 1.745) * 2.3), p[1] + d[1] * 1.5 + (u[1] - Math.sin(ang - 1.745) * 2.3), p[2] + d[2] * 1.5]; }
    else {
      const k = ss === 'E' ? 0.95 : 0.72;
      d = [d[0] * k + (rng() - 0.5) * (1 - k) * 3, d[1] * k + (rng() - 0.5) * (1 - k) * 3, d[2] * k + (rng() - 0.5) * (1 - k) * 3];
      const l = Math.hypot(...d) || 1; d = d.map(x => x / l);
      p = [p[0] + d[0] * 3.8, p[1] + d[1] * 3.8, p[2] + d[2] * 3.8];
    }
    pts.push(p.slice());
  }
  return pts;
}

class ProteinViz {
  constructor(canvas){
    this.cv = canvas;
    const gl = this.gl = canvas.getContext('webgl2', {antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false});
    if (!gl) { this.failed = true; return; }
    this.prog = {fb: this._prog(VS_QUAD, FS_FEEDBACK), comp: this._prog(VS_QUAD, FS_COMP), rib: this._prog(VS_RIB, FS_RIB),
      pts: this._prog(VS_PTS, FS_PTS), l2d: this._prog(VS_L2D, FS_L2D)};
    this.quad = this._vao(this.prog.fb, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), [['aPos', 2]]);
    this.l2dBuf = gl.createBuffer(); this.l2dVao = gl.createVertexArray();
    gl.bindVertexArray(this.l2dVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.l2dBuf);
    const la = gl.getAttribLocation(this.prog.l2d, 'aPos'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 3, gl.FLOAT, false, 0, 0);
    this.waveTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.waveTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 512, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(512).fill(128));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    this.waveBytes = new Uint8Array(512);
    this.presetKey = 'kaleido'; this.P = {...VIZ_PRESETS.kaleido}; this.T = this.P; this.auto = true; this.colorOverride = -1;
    this.lv = {bass: 1, mid: 1, treb: 1, bass_att: 1, mid_att: 1, treb_att: 1}; this.avg = {bass: 1e-3, mid: 1e-3, treb: 1e-3};
    this.cur = -1; this.playing = false; this.hue = 0; this.hueT = 0; this.flash = 0; this.kick = 0; this.rings = [];
    this.angle = 0; this.time = 0; this.lastBeat = 0; this.scoreBeatT = -10; this.nres = 1; this.section = null;
    this.onPreset = null;
    this.resize();
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas);
    this.last = performance.now();
    const loop = now => { const raw = Math.min(0.5, (now - this.last) / 1000); this.frame(Math.min(0.05, raw), raw); this.last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  _prog(vs, fs){
    const gl = this.gl, mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; p.u[nm] = gl.getUniformLocation(p, nm); }
    return p;
  }
  _vao(prog, data, layout){
    const gl = this.gl, vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const stride = layout.reduce((a, l) => a + l[1], 0) * 4; let off = 0;
    for (const [name, size] of layout) { const loc = gl.getAttribLocation(prog, name);
      if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off); } off += size * 4; }
    gl.bindVertexArray(null); vao.buf = buf; return vao;
  }
  _fbo(w, h){
    const gl = this.gl, tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return {tex, fb};
  }
  resize(){
    if (this.failed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(64, Math.round(this.cv.clientWidth * dpr)), h = Math.max(64, Math.round(this.cv.clientHeight * dpr));
    if (w === this.W && h === this.H) return;
    this.W = this.cv.width = w; this.H = this.cv.height = h;
    const gl = this.gl;
    [this.A, this.B, this.C].forEach(f => { if (f) { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fb); } });
    this.A = this._fbo(w, h); this.B = this._fbo(w, h); this.C = this._fbo(w, h);
  }

  setProtein(chain, F){
    if (this.failed) return;
    const gl = this.gl;
    const raw = chain.ca || pseudoCA(chain);
    this.generated = !chain.ca;
    const n = raw.length; this.nres = n;
    const cen = [0, 1, 2].map(k => raw.reduce((a, p) => a + p[k], 0) / n);
    const rad = Math.max(...raw.map(p => Math.hypot(p[0] - cen[0], p[1] - cen[1], p[2] - cen[2]))) || 1;
    const P = raw.map(p => [(p[0] - cen[0]) / rad, (p[1] - cen[1]) / rad, (p[2] - cen[2]) / rad]);
    this.ca = P;
    const ssv = chain.ss.map(s => s === 'H' ? 0 : s === 'E' ? 1 : 2);
    const prop = F ? F.zK : P.map(() => 0);
    // split at chain breaks, Catmull-Rom subdivide
    const segs = []; let s0 = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || Math.hypot(raw[i][0] - raw[i-1][0], raw[i][1] - raw[i-1][1], raw[i][2] - raw[i-1][2]) > 4.4) { segs.push([s0, i]); s0 = i; }
    }
    const SUB = 5, verts = []; this.ribSegs = [];
    for (const [a, b] of segs) {
      const pts = [];
      for (let i = a; i < b; i++) {
        const p0 = P[Math.max(a, i - 1)], p1 = P[i], p2 = P[Math.min(b - 1, i + 1)], p3 = P[Math.min(b - 1, i + 2)];
        const steps = i === b - 1 ? 1 : SUB;
        for (let j = 0; j < steps; j++) {
          const t = j / SUB, t2 = t * t, t3 = t2 * t;
          const q = [0, 1, 2].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
          pts.push({q, res: i + t, ss: ssv[i], pr: prop[i]});
        }
      }
      if (pts.length < 2) continue;
      const first = verts.length / 13;
      pts.forEach((pt, i) => {
        const pv = pts[Math.max(0, i - 1)].q, nx = pts[Math.min(pts.length - 1, i + 1)].q;
        for (const side of [-1, 1]) verts.push(...pt.q, ...pv, ...nx, side, pt.res, pt.ss, pt.pr);
      });
      this.ribSegs.push([first, pts.length * 2]);
    }
    for (const v of [this.ribVao, this.ptsVao, this.flareVao]) if (v) { gl.deleteBuffer(v.buf); gl.deleteVertexArray(v); }
    this.ribVao = this._vao(this.prog.rib, new Float32Array(verts),
      [['aPos', 3], ['aPrev', 3], ['aNext', 3], ['aSide', 1], ['aRes', 1], ['aSS', 1], ['aProp', 1]]);
    const pv = []; P.forEach((p, i) => pv.push(...p, i, ssv[i], prop[i]));
    this.ptsVao = this._vao(this.prog.pts, new Float32Array(pv), [['aPos', 3], ['aRes', 1], ['aSS', 1], ['aProp', 1]]);
    this.flareBuf = new Float32Array(6);
    this.flareVao = this._vao(this.prog.pts, this.flareBuf, [['aPos', 3], ['aRes', 1], ['aSS', 1], ['aProp', 1]]);
    this.flareGlBuf = this.flareVao.buf;
  }
  setAudio(fft, wave){ this.fft = fft; this.wave = wave; this.avgInit = false; }
  setPlaying(on){ this.playing = on; if (!on) { this.cur = -1; this.section = null; } }
  setPreset(key){
    if (key === 'auto') { this.auto = true; return; }
    this.auto = false; this._target(key);
  }
  _target(key){
    if (!VIZ_PRESETS[key]) return;
    this.presetKey = key; this.T = VIZ_PRESETS[key];
    for (const k of VIZ_DISCRETE) this.P[k] = this.T[k];
    if (this.onPreset) this.onPreset(key);
  }
  next(){ const ks = Object.keys(VIZ_PRESETS); this.auto = false; this._target(ks[(ks.indexOf(this.presetKey) + 1) % ks.length]); }
  pulse(kind){
    if (kind === 'kick') { this.kick = 1; this.rings.push({t: 0, hue: this.hue}); if (this.rings.length > 6) this.rings.shift(); }
    else if (kind === 'snare') this.flash = Math.max(this.flash, 1);
  }
  // called from the transport (Tone.Draw), knows the score
  onStep(st, S){
    if (st.i >= 0) this.cur = st.i;
    const ch = S.chords[st.b]; if (ch) this.hueT = ((S.rootPc + ch[0]) % 12) / 12;
    const ph = S.phrases[st.ph], sec = ph.role !== 'main' ? ph.role : ph.type;
    if (this.auto && sec !== this.section) this._target(VIZ_AUTO[sec]);
    this.section = sec;
    const evs = S.score && S.score[st.k];
    if (evs) for (const ev of evs) {
      if (ev.p === 'kick') { this.pulse('kick'); this.scoreBeatT = this.time; }
      else if (ev.p === 'snare' || ev.p === 'clap' || ev.p === 'timp') this.pulse('snare');
    }
  }
  _audio(dt){
    const L = this.lv;
    if (this.fft) {
      const db = this.fft.getValue(), n = db.length, hz = Tone.getContext().sampleRate / 2 / n;
      const band = (lo, hi) => { let s = 0, c = 0; for (let i = Math.max(1, Math.floor(lo / hz)); i < Math.min(n, Math.ceil(hi / hz)); i++) { s += Math.pow(10, db[i] / 20); c++; } return c ? s / c : 0; };
      const imm = {bass: band(20, 250), mid: band(250, 2000), treb: band(2000, 11000)};
      for (const k of ['bass', 'mid', 'treb']) {
        if (!this.avgInit) this.avg[k] = imm[k];
        this.avg[k] += (imm[k] - this.avg[k]) * Math.min(1, dt / (imm[k] > this.avg[k] * 2 ? 0.6 : 3));
        const rel = this.avg[k] > 1e-6 ? clamp(imm[k] / this.avg[k], 0, 3) : 1;
        L[k] = rel; L[k + '_att'] += (rel - L[k + '_att']) * Math.min(1, dt / 0.3);
      }
      if (imm.bass > 1e-4) this.avgInit = true;
      // audio beat detection for styles without score events
      if (this.time - this.scoreBeatT > 2 && L.bass > 1.45 && this.time - this.lastBeat > 0.22) { this.lastBeat = this.time; this.pulse('kick'); }
    } else {
      const t = this.time;
      L.bass = L.bass_att = 1 + 0.15 * Math.sin(t * 1.3); L.mid = L.mid_att = 1 + 0.1 * Math.sin(t * 0.7); L.treb = L.treb_att = 1;
    }
    if (this.wave) {
      const w = this.wave.getValue(), step = w.length / 512;
      for (let i = 0; i < 512; i++) this.waveBytes[i] = clamp(Math.round((w[Math.floor(i * step)] * 1.6 * 0.5 + 0.5) * 255), 0, 255);
    } else for (let i = 0; i < 512; i++) this.waveBytes[i] = 128 + Math.round(20 * Math.sin(i / 512 * 12.566 + this.time * 2) * Math.sin(this.time * 0.5));
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.waveTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 1, gl.RED, gl.UNSIGNED_BYTE, this.waveBytes);
  }
  _poly2d(pts, widthPx, color, closed){
    const gl = this.gl, W = this.W, H = this.H, out = [];
    const N = pts.length, get = i => pts[closed ? (i + N) % N : clamp(i, 0, N - 1)];
    for (let i = 0; i <= (closed ? N : N - 1); i++) {
      const p = get(i), a = get(i - 1), b = get(i + 1);
      let dx = (b[0] - a[0]) * W, dy = (b[1] - a[1]) * H; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const nx = -dy * widthPx / W * 2, ny = dx * widthPx / H * 2;
      out.push(p[0] - nx, p[1] - ny, -1, p[0] + nx, p[1] + ny, 1);
    }
    gl.useProgram(this.prog.l2d); gl.uniform4fv(this.prog.l2d.u.uColor, color);
    gl.bindVertexArray(this.l2dVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.l2dBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, out.length / 3);
  }
  _drawProtein(mvp, gain, P){
    if (!this.ribVao) return;
    const gl = this.gl, L = this.lv, breath = 0.05 * (L.bass_att - 1) + 0.04 * this.kick;
    let pr = this.prog.rib; gl.useProgram(pr);
    gl.uniformMatrix4fv(pr.u.uMVP, false, mvp); gl.uniform2f(pr.u.uRes, this.W, this.H);
    gl.uniform1f(pr.u.uWidth, P.width * this.H / 700); gl.uniform1f(pr.u.uCur, this.cur);
    gl.uniform1f(pr.u.uBass, L.bass); gl.uniform1f(pr.u.uWaveAmp, P.waveAmp); gl.uniform1f(pr.u.uNRes, this.nres);
    gl.uniform1f(pr.u.uTime, this.time); gl.uniform1f(pr.u.uBreath, breath); gl.uniform1f(pr.u.uHue, this.hue);
    gl.uniform1f(pr.u.uColorMode, this.colorOverride >= 0 ? this.colorOverride : P.colorMode);
    gl.uniform1f(pr.u.uGain, gain); gl.uniform1f(pr.u.uPlaying, this.playing && this.cur >= 0 ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.waveTex); gl.uniform1i(pr.u.uWave, 0);
    gl.bindVertexArray(this.ribVao);
    for (const [f, c] of this.ribSegs) gl.drawArrays(gl.TRIANGLE_STRIP, f, c);
    pr = this.prog.pts; gl.useProgram(pr);
    gl.uniformMatrix4fv(pr.u.uMVP, false, mvp); gl.uniform1f(pr.u.uResY, this.H); gl.uniform1f(pr.u.uCur, this.cur);
    gl.uniform1f(pr.u.uHue, this.hue); gl.uniform1f(pr.u.uNRes, this.nres); gl.uniform1f(pr.u.uBreath, breath);
    if (P.points > 0.02) {
      gl.uniform1f(pr.u.uFlare, 0); gl.uniform1f(pr.u.uSize, 10 + 10 * L.treb_att); gl.uniform1f(pr.u.uGain, gain * P.points);
      gl.bindVertexArray(this.ptsVao); gl.drawArrays(gl.POINTS, 0, this.nres);
    }
    if (this.playing && this.cur >= 0 && this.ca[this.cur]) {
      this.flareBuf.set([...this.ca[this.cur], this.cur, 0, 0]);
      gl.bindVertexArray(this.flareVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.flareGlBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.flareBuf);
      gl.uniform1f(pr.u.uFlare, 1); gl.uniform1f(pr.u.uSize, 90 + 70 * this.kick); gl.uniform1f(pr.u.uGain, gain);
      gl.drawArrays(gl.POINTS, 0, 1);
    }
  }
  frame(dt, rawDt){
    if (this.failed) return;
    const gl = this.gl; this.time += dt;
    this._audio(rawDt || dt);
    const P = this.P, T = this.T, L = this.lv, k = Math.min(1, dt * 1.2);
    for (const key in T) if (typeof T[key] === 'number' && !VIZ_DISCRETE.includes(key)) P[key] += (T[key] - P[key]) * k;
    this.hue += (((this.hueT - this.hue + 1.5) % 1) - 0.5) * Math.min(1, dt * 0.8);
    this.flash *= Math.pow(0.02, dt); this.kick *= Math.pow(0.005, dt);
    this.angle += dt * (P.spin + 0.35 * Math.max(0, L.bass_att - 1));
    const asp = this.W / this.H, step = clamp(dt * 60, 0.25, 3);
    const mvp = M4.mul(M4.persp(0.75, asp, 0.1, 20), M4.mul(M4.trans(0, 0, -2.7), M4.mul(M4.rotX(0.35 * Math.sin(this.time * 0.13)), M4.rotY(this.angle))));

    // 1) warp + decay previous frame into B
    gl.viewport(0, 0, this.W, this.H); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.B.fb);
    let pr = this.prog.fb; gl.useProgram(pr);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.A.tex); gl.uniform1i(pr.u.uPrev, 0);
    gl.uniform1f(pr.u.uTime, this.time); gl.uniform1f(pr.u.uZoom, P.zoom + 0.03 * this.kick);
    gl.uniform1f(pr.u.uRot, P.rot + 0.01 * (L.mid_att - 1)); gl.uniform1f(pr.u.uWarp, P.warp * (0.7 + 0.5 * L.mid_att));
    gl.uniform1f(pr.u.uWarpSpeed, P.warpSpeed); gl.uniform1f(pr.u.uDecay, P.decay); gl.uniform1f(pr.u.uKaleido, P.kaleido);
    gl.uniform1f(pr.u.uHueShift, P.hue + 0.01 * Math.max(0, L.treb_att - 1)); gl.uniform1f(pr.u.uBass, L.bass_att);
    gl.uniform1f(pr.u.uTreb, L.treb_att); gl.uniform1f(pr.u.uAspect, asp); gl.uniform1f(pr.u.uStep, step);
    gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 2) shapes into the feedback buffer (they leave trails)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    this._drawProtein(mvp, P.trail * 0.35 * step, P);
    if (P.ring > 0.02) {
      const pts = [], N = 256, wb = this.waveBytes;
      for (let i = 0; i < N; i++) { const a = i / N * 6.2832, r = 0.72 + 0.35 * (wb[i * 2] / 255 - 0.5) + 0.04 * this.kick;
        pts.push([Math.cos(a) * r / asp, Math.sin(a) * r]); }
      this._poly2d(pts, 2.2 * this.H / 700, [...hsv((this.hue + 0.5) % 1, 0.7, 1), 0.3 * P.ring * step], true);
    }
    this.rings = this.rings.filter(r => (r.t += dt) < 0.7);
    for (const r of this.rings) { const pts = [], rad = 0.12 + r.t * 1.5;
      for (let i = 0; i < 64; i++) { const a = i / 64 * 6.2832; pts.push([Math.cos(a) * rad / asp, Math.sin(a) * rad]); }
      this._poly2d(pts, 3 * this.H / 700, [...hsv(r.hue, 0.5, 1), 0.5 * step * (1 - r.t / 0.7)], true); }

    // 3) crisp protein layer (no feedback)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.C.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    this._drawProtein(mvp, P.crisp, P);

    // 4) composite to screen
    gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    pr = this.prog.comp; gl.useProgram(pr);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.B.tex); gl.uniform1i(pr.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.C.tex); gl.uniform1i(pr.u.uTop, 1);
    gl.uniform2f(pr.u.uRes, this.W, this.H); gl.uniform1f(pr.u.uFlash, this.flash); gl.uniform1f(pr.u.uEcho, P.echo);
    gl.uniform1f(pr.u.uScan, 1); gl.uniform1f(pr.u.uTime, this.time);
    gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
    [this.A, this.B] = [this.B, this.A];
  }
}
