// Hydrophonic, protein-to-music synthesizer. Copyright (C) 2026 Franz Dietzmeyer
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0  (see LICENSE; https://github.com/franzdietzmeyer/hydrophonic)
// ---------- Visualizer ----------
// Two families share one renderer:
//  STRUCTURE views: a lit cartoon (helix ribbons, strand arrows, coil tubes) with the residue being played shown as sticks,
//    a camera that orbits, follows the played residue, or flies along the backbone; a subtle audio-reactive aura behind it.
//  TRIP views: the MilkDrop-style feedback engine (warp, decay, kaleidoscope, echo, CRT) with the glowing backbone as main shape.
// Per frame: feedback pass -> glow shapes into feedback -> crisp glow layer -> MSAA lit scene -> composite.
const VIZ_BASE = {zoom: 1.0, rot: 0, warp: 0.2, warpSpeed: 0.3, decay: 0.9, kaleido: 0, hue: 0.002, echo: 0, trail: 0.3, crisp: 0,
  width: 1.6, ring: 0, waveAmp: 0, spin: 0.12, points: 0, colorMode: 1, cam: 'orbit', scene: 1, fb: 0.4, scan: 0.12, crt: 0, bg: 1, spec: 1, flare: 0.35};
const VIZ_PRESETS = {
  orbit:   {...VIZ_BASE, name: 'Cartoon Orbit', group: 'structure', cam: 'orbit', zoom: 1.006, rot: 0.002, fb: 0.45, spin: 0.12},
  follow:  {...VIZ_BASE, name: 'Follow Residue', group: 'structure', cam: 'follow', zoom: 1.004, fb: 0.35, spin: 0.1},
  fly:     {...VIZ_BASE, name: 'Fly-through', group: 'structure', cam: 'fly', zoom: 1.01, fb: 0.3, decay: 0.88, spin: 0.1},
  kaleido: {...VIZ_BASE, name: 'Kaleido Helix',  group: 'trip', cam: 'orbit', scene: 0, fb: 1, scan: 1, crt: 1, bg: 0, spec: 0, flare: 1, zoom: 1.012, rot: 0.010, warp: 0.35, warpSpeed: 0.5, decay: 0.945, kaleido: 6, hue: 0.004, echo: 0.0,  trail: 0.45, crisp: 0.85, width: 2.4, ring: 0.6, waveAmp: 0.0,  spin: 0.22, points: 0.0, colorMode: 1},
  tunnel:  {...VIZ_BASE, name: 'Tunnel Fold',    group: 'trip', cam: 'orbit', scene: 0, fb: 1, scan: 1, crt: 1, bg: 0, spec: 0, flare: 1, zoom: 1.045, rot: 0.004, warp: 0.5,  warpSpeed: 0.7, decay: 0.95,  kaleido: 0, hue: 0.006, echo: 0.25, trail: 0.55, crisp: 0.8,  width: 2.0, ring: 0.9, waveAmp: 0.0,  spin: 0.35, points: 0.25, colorMode: 0},
  plasma:  {...VIZ_BASE, name: 'Plasma Drift',   group: 'trip', cam: 'orbit', scene: 0, fb: 1, scan: 1, crt: 1, bg: 0, spec: 0, flare: 1, zoom: 0.998, rot: -0.002, warp: 2.6, warpSpeed: 1.1, decay: 0.968, kaleido: 0, hue: 0.002, echo: 0.0,  trail: 0.4,  crisp: 0.9,  width: 2.6, ring: 0.3, waveAmp: 0.0,  spin: 0.12, points: 0.0, colorMode: 2},
  scope:   {...VIZ_BASE, name: 'Backbone Scope', group: 'trip', cam: 'orbit', scene: 0, fb: 1, scan: 1, crt: 1, bg: 0, spec: 0, flare: 1, zoom: 1.0,   rot: 0.0,   warp: 0.15, warpSpeed: 0.3, decay: 0.86,  kaleido: 0, hue: 0.01,  echo: 0.0,  trail: 0.7,  crisp: 1.0,  width: 1.8, ring: 0.0, waveAmp: 0.22, spin: 0.18, points: 0.0, colorMode: 1},
  hyper:   {...VIZ_BASE, name: 'Hyperspace',     group: 'trip', cam: 'orbit', scene: 0, fb: 1, scan: 1, crt: 1, bg: 0, spec: 0, flare: 1, zoom: 1.07,  rot: 0.0,   warp: 0.1,  warpSpeed: 0.2, decay: 0.92,  kaleido: 0, hue: 0.003, echo: 0.0,  trail: 0.2,  crisp: 0.6,  width: 1.2, ring: 0.4, waveAmp: 0.0,  spin: 0.5,  points: 1.0, colorMode: 0},
  mirror:  {...VIZ_BASE, name: 'Mirror Crystal', group: 'trip', cam: 'orbit', scene: 0, fb: 1, scan: 1, crt: 1, bg: 0, spec: 0, flare: 1, zoom: 0.985, rot: 0.02,  warp: 0.6,  warpSpeed: 0.5, decay: 0.95,  kaleido: 4, hue: 0.008, echo: 0.4,  trail: 0.45, crisp: 0.8,  width: 2.2, ring: 0.5, waveAmp: 0.08, spin: 0.25, points: 0.3, colorMode: 2},
};
const VIZ_AUTO = {
  structure: {intro: 'orbit', H: 'follow', E: 'fly', C: 'follow', outro: 'orbit'},
  trip:      {H: 'kaleido', E: 'tunnel', C: 'plasma', intro: 'scope', outro: 'hyper'},
};
const VIZ_DISCRETE = ['kaleido', 'colorMode', 'cam', 'name', 'group'];
const CPK = {C: [0.80, 0.80, 0.78], N: [0.30, 0.45, 1.0], O: [1.0, 0.27, 0.22], S: [1.0, 0.84, 0.25]};

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
  gl_PointSize = uFlare > 0.5 ? min(uSize * uResY / 600.0 / c.w, uResY * 0.12) : min(uSize * (1.0 + 2.5 * near) * uResY / 900.0 / c.w, uResY * 0.05);
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

const FS_COMP = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex, uTop, uScene, uSpec;
uniform vec2 uRes; uniform float uFlash, uEcho, uScan, uCrt, uFb, uSceneAmt, uBg, uSpecAmt;
uniform vec3 uBgA, uBgB;
void main(){
  vec2 cc = vUv - 0.5; float d = dot(cc, cc);
  vec2 uv = 0.5 + cc * (1.0 + uCrt * 0.07 * d);                     // CRT barrel only in trip views
  vec3 fb = texture(uTex, uv).rgb;
  vec3 e = texture(uTex, vec2(1.0 - uv.x, uv.y) * 0.9 + 0.05).rgb;
  fb = mix(fb, max(fb, e), uEcho);                                    // MilkDrop "echo" layer
  vec3 bg = mix(uBgB, uBgA * 0.35 + uBgB, uv.y) + uBgA * exp(-d * 5.0);
  vec3 col = bg * uBg + fb * uFb;
  vec4 sc = texture(uScene, uv) * uSceneAmt;                          // premultiplied lit scene
  col = sc.rgb + col * (1.0 - sc.a);
  vec3 b = vec3(0.);
  for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; vec2 dv = vec2(cos(a), sin(a)) / uRes;
    b += texture(uTex, uv + dv * 4.0).rgb * uFb + texture(uTop, uv + dv * 3.0).rgb + 0.6 * texture(uTop, uv + dv * 9.0).rgb
       + max(texture(uScene, uv + dv * 7.0).rgb - 0.72, 0.0) * 1.6 * uSceneAmt; }
  col += texture(uTop, uv).rgb + b / 8.0 * 0.45 + uFlash * 0.18 * (1.0 - 0.7 * uSceneAmt);
  if (uSpecAmt > 0.01 && uv.y < 0.1) {                               // thin spectrum bars along the bottom edge
    float x = uv.x * 64.0, h = texture(uSpec, vec2((floor(x) + 0.5) / 64.0, 0.5)).r * 0.1;
    float bar = step(uv.y, h) * step(0.2, fract(x)) * step(fract(x), 0.8);
    col += vec3(1.0, 0.62, 0.22) * bar * 0.2 * uSpecAmt * (0.35 + 0.65 * uv.y / max(h, 1e-3));
  }
  col *= 1.0 - uScan * 0.16 * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
  col *= mix(1.0, smoothstep(0.95, 0.25, length(cc)), 0.55 + 0.45 * uCrt);
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) col = vec3(0.);
  o = vec4(col / (1.0 + 0.25 * col), 1.0);
}`;
const GLSL_LIGHT = `
uniform vec3 uCam, uKey, uFill, uRimCol; uniform float uRim, uFogNear, uFogFar, uCut;
void nearCut(vec3 pos){ float h = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  if (length(uCam - pos) < uCut) discard; }
vec4 shade(vec3 c, vec3 pos, vec3 nrm, vec3 emis){
  vec3 N = normalize(nrm), V = normalize(uCam - pos);
  if (dot(N, V) < 0.0) N = -N;
  float dif = max(dot(N, uKey), 0.0) * 0.8 + max(dot(N, uFill), 0.0) * 0.25 + 0.26;
  float sp = pow(max(dot(N, normalize(uKey + V)), 0.0), 48.0) * 0.4;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 col = c * dif + vec3(sp) + uRimCol * fr * uRim + emis;
  float f = smoothstep(uFogNear, uFogFar, length(uCam - pos)) * 0.92;
  return vec4(col * (1.0 - f), 1.0 - f);
}`;
const VS_MESH = `#version 300 es
in vec3 aPos, aNrm; in float aRes, aSS, aProp;
uniform mat4 uVP;
out vec3 vPos, vNrm; out float vRes, vSS, vProp;
void main(){ vPos = aPos; vNrm = aNrm; vRes = aRes; vSS = aSS; vProp = aProp; gl_Position = uVP * vec4(aPos, 1.0); }`;
const FS_MESH = `#version 300 es
precision highp float;
in vec3 vPos, vNrm; in float vRes, vSS, vProp; out vec4 o;
uniform float uCur, uNRes, uColorMode, uPlaying, uKick;
${GLSL_HSV}
${GLSL_LIGHT}
vec3 base(){
  if (uColorMode < 0.5) return hsv2rgb(vec3(0.66 * (1.0 - vRes / max(uNRes - 1.0, 1.0)), 0.62, 0.95));      // N -> C spectrum
  if (uColorMode < 1.5) return vSS < 0.5 ? vec3(0.88, 0.27, 0.48) : vSS < 1.5 ? vec3(0.96, 0.70, 0.24) : vec3(0.58, 0.66, 0.76);
  return vProp < 0.0 ? mix(vec3(0.86), vec3(0.17, 0.55, 0.90), -vProp) : mix(vec3(0.86), vec3(0.93, 0.50, 0.20), vProp);
}
void main(){
  vec3 c = base();
  nearCut(vPos);
  if (uPlaying > 0.5 && vRes > uCur + 0.5) { float l = dot(c, vec3(0.3, 0.59, 0.11)); c = mix(c, vec3(l), 0.55) * 0.72; }
  float near = exp(-abs(vRes - uCur) * 0.8) * uPlaying;
  o = shade(c, vPos, vNrm, (c * 0.6 + vec3(0.35, 0.28, 0.18)) * near * (0.35 + 0.5 * uKick));
}`;
const VS_STICK = `#version 300 es
in vec3 aPos, aNrm, aCol; in float aGlow;
uniform mat4 uVP;
out vec3 vPos, vNrm, vCol; out float vGlow;
void main(){ vPos = aPos; vNrm = aNrm; vCol = aCol; vGlow = aGlow; gl_Position = uVP * vec4(aPos, 1.0); }`;
const FS_STICK = `#version 300 es
precision highp float;
in vec3 vPos, vNrm, vCol; in float vGlow; out vec4 o;
uniform float uKick;
${GLSL_LIGHT}
void main(){ nearCut(vPos); o = shade(vCol * (0.55 + 0.45 * vGlow), vPos, vNrm, vCol * vGlow * (0.2 + 0.35 * uKick)); }`;

// ---------- small vector / matrix helpers ----------
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]), lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  norm(a, fb){ const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : (fb || [0, 1, 0]); },
};
const M4 = {
  mul(a, b){ const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  persp(fov, asp, n, f){ const t = 1 / Math.tan(fov / 2), o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
  lookAt(e, c, up){
    const z = V3.norm(V3.sub(e, c), [0, 0, 1]); let x = V3.cross(up, z);
    if (V3.len(x) < 1e-6) x = V3.cross([0, 0, 1], z); x = V3.norm(x); const y = V3.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V3.dot(x, e), -V3.dot(y, e), -V3.dot(z, e), 1]);
  },
  xform(m, p){ const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; return [x, y, w]; },
};
const catmull = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t;
  return [0, 1, 2].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)); };
const smoothstep01 = t => t * t * (3 - 2 * t);

// ---------- cartoon geometry from the CA trace ----------
// Guide vector per residue = direction to the midpoint of its neighbours (points to the helix axis; alternates in strands,
// so its sign is kept consistent). Ribbon width runs along cross(tangent, guide): helices face outward, strands lie in the sheet.
function buildCartoon(P, ssv, prop, segs, rad){
  const n = P.length, A = 1 / rad, SUB = 8, K = 14;
  const g = P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    return V3.sub(V3.mul(V3.add(a, b), 0.5), p); });
  const Q = P.map((p, i) => (ssv[i] === 1 && i > 0 && i < n - 1 && ssv[i - 1] === 1 && ssv[i + 1] === 1)
    ? V3.add(V3.mul(p, 0.5), V3.mul(V3.add(P[i - 1], P[i + 1]), 0.25)) : p);   // straighten strands
  const prof = s => s === 0 ? [1.3, 0.3, 4] : s === 1 ? [1.05, 0.28, 4] : [0.32, 0.32, 2];
  const verts = [], idx = [];
  for (const [a, b] of segs) {
    if (b - a < 2) continue;
    const G = [];
    for (let i = a; i < b; i++) { let v = V3.norm(g[i], null);
      if (!v) v = G.length ? G[G.length - 1] : [0, 1, 0];
      if (G.length && V3.dot(v, G[G.length - 1]) < 0) v = V3.mul(v, -1);
      G.push(v); }
    const S = [];
    for (let i = a; i < b; i++) {
      const steps = i === b - 1 ? 1 : SUB, s0 = ssv[i], s1 = i + 1 < b ? ssv[i + 1] : s0;
      for (let j = 0; j < steps; j++) {
        const t = j / SUB;
        const pos = catmull(Q[Math.max(a, i - 1)], Q[i], Q[Math.min(b - 1, i + 1)], Q[Math.min(b - 1, i + 2)], t);
        const gv = V3.norm(V3.lerp(G[i - a], G[Math.min(b - 1, i + 1) - a], t));
        let [hw, ht, ne] = prof(s0);
        if (s0 === 1 && s1 !== 1) { hw = 1.8 * (1 - t) + 0.32 * t; }                  // strand arrow head
        else if (s1 !== s0) { const q = prof(s1), u = smoothstep01(t);
          hw = hw + (q[0] - hw) * u; ht = ht + (q[1] - ht) * u; if (u > 0.5) ne = q[2]; }
        S.push({pos, gv, res: i + t, ss: s0, pr: prop[i] + ((prop[Math.min(b - 1, i + 1)] ?? prop[i]) - prop[i]) * t, hw: hw * A, ht: ht * A, ne});
      }
    }
    const base = verts.length / 9;
    S.forEach((s, k) => {
      const T = V3.norm(V3.sub(S[Math.min(S.length - 1, k + 1)].pos, S[Math.max(0, k - 1)].pos), [1, 0, 0]);
      let W = V3.cross(T, s.gv); if (V3.len(W) < 1e-6) W = V3.cross(T, [0, 1, 0]); W = V3.norm(W, [1, 0, 0]);
      const N = V3.norm(V3.cross(W, T));
      const e = 2 / s.ne, e2 = 2 * (s.ne - 1) / s.ne;
      for (let kk = 0; kk < K; kk++) {
        const th = 2 * Math.PI * kk / K, c = Math.cos(th), sn = Math.sin(th);
        const x = s.hw * Math.sign(c) * Math.pow(Math.abs(c), e), y = s.ht * Math.sign(sn) * Math.pow(Math.abs(sn), e);
        const nx = Math.sign(c) * Math.pow(Math.abs(c), e2) / s.hw, ny = Math.sign(sn) * Math.pow(Math.abs(sn), e2) / s.ht;
        const p = V3.add(s.pos, V3.add(V3.mul(W, x), V3.mul(N, y)));
        const nr = V3.norm(V3.add(V3.mul(W, nx), V3.mul(N, ny)), N);
        verts.push(p[0], p[1], p[2], nr[0], nr[1], nr[2], s.res, s.ss, s.pr);
      }
    });
    for (let k = 0; k < S.length - 1; k++) for (let kk = 0; kk < K; kk++) {
      const a0 = base + k * K + kk, a1 = base + k * K + (kk + 1) % K, b0 = a0 + K, b1 = a1 + K;
      idx.push(a0, b0, a1, a1, b0, b1);
    }
  }
  return {verts: new Float32Array(verts), idx: new Uint32Array(idx)};
}

// ---------- ball-and-stick geometry for a few residues ----------
const SPHERE = (() => { const v = [], ix = [], LAT = 6, LON = 10;
  for (let i = 0; i <= LAT; i++) for (let j = 0; j <= LON; j++) { const th = Math.PI * i / LAT, ph = 2 * Math.PI * j / LON;
    v.push([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]); }
  for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) { const a = i * (LON + 1) + j, b = a + LON + 1; ix.push(a, b, a + 1, a + 1, b, b + 1); }
  return {v, ix}; })();
function buildSticks(list, rad){
  const A = 1 / rad, verts = [], idx = [];
  const sphere = (c, r, col, gl) => { const base = verts.length / 10;
    for (const u of SPHERE.v) verts.push(c[0] + u[0] * r, c[1] + u[1] * r, c[2] + u[2] * r, u[0], u[1], u[2], col[0], col[1], col[2], gl);
    for (const k of SPHERE.ix) idx.push(base + k); };
  const cyl = (p, q, r, col, gl) => { const ax = V3.sub(q, p), d = V3.norm(ax), base = verts.length / 10, M = 8;
    let u = V3.cross(d, [0, 1, 0]); if (V3.len(u) < 0.1) u = V3.cross(d, [1, 0, 0]); u = V3.norm(u); const w = V3.cross(d, u);
    for (const end of [p, q]) for (let k = 0; k < M; k++) { const th = 2 * Math.PI * k / M, nrm = V3.add(V3.mul(u, Math.cos(th)), V3.mul(w, Math.sin(th)));
      const pt = V3.add(end, V3.mul(nrm, r)); verts.push(pt[0], pt[1], pt[2], nrm[0], nrm[1], nrm[2], col[0], col[1], col[2], gl); }
    for (let k = 0; k < M; k++) { const a0 = base + k, a1 = base + (k + 1) % M; idx.push(a0, a0 + M, a1, a1, a0 + M, a1 + M); } };
  for (const {atoms, glow} of list) {
    if (!atoms || !atoms.length) continue;
    atoms.forEach(at => sphere(at.p, 0.3 * A, CPK[at.e] || CPK.C, glow));
    for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) {
      const a = atoms[i], b = atoms[j], d = V3.len(V3.sub(a.p, b.p)) * rad;
      if (d > 0.6 && d < 1.95) { const m = V3.mul(V3.add(a.p, b.p), 0.5);
        cyl(a.p, m, 0.16 * A, CPK[a.e] || CPK.C, glow); cyl(m, b.p, 0.16 * A, CPK[b.e] || CPK.C, glow); }
    }
  }
  return {verts: new Float32Array(verts), idx: new Uint32Array(idx)};
}

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
  constructor(canvas, labelEl){
    this.cv = canvas; this.labelEl = labelEl || null;
    const gl = this.gl = canvas.getContext('webgl2', {antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false});
    if (!gl) { this.failed = true; return; }
    this.prog = {fb: this._prog(VS_QUAD, FS_FEEDBACK), comp: this._prog(VS_QUAD, FS_COMP), rib: this._prog(VS_RIB, FS_RIB),
      pts: this._prog(VS_PTS, FS_PTS), l2d: this._prog(VS_L2D, FS_L2D), mesh: this._prog(VS_MESH, FS_MESH), stick: this._prog(VS_STICK, FS_STICK)};
    this.quad = this._vao(this.prog.fb, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), [['aPos', 2]]);
    this.l2dBuf = gl.createBuffer(); this.l2dVao = gl.createVertexArray();
    gl.bindVertexArray(this.l2dVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.l2dBuf);
    const la = gl.getAttribLocation(this.prog.l2d, 'aPos'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 3, gl.FLOAT, false, 0, 0);
    const tex1d = (w, fill) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(w).fill(fill));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    this.waveTex = tex1d(512, 128); this.waveBytes = new Uint8Array(512);
    this.specTex = tex1d(64, 0); this.specBytes = new Uint8Array(64);
    this.presetKey = 'orbit'; this.P = {...VIZ_PRESETS.orbit}; this.T = VIZ_PRESETS.orbit; this.autoMode = 'structure'; this.colorOverride = -1;
    this.lv = {bass: 1, mid: 1, treb: 1, bass_att: 1, mid_att: 1, treb_att: 1}; this.avg = {bass: 1e-3, mid: 1e-3, treb: 1e-3};
    this.cur = -1; this.curF = 0; this.playing = false; this.hue = 0; this.hueT = 0; this.flash = 0; this.kick = 0; this.rings = [];
    this.angle = 0; this.time = 0; this.lastBeat = 0; this.scoreBeatT = -10; this.nres = 1; this.section = null; this.stickFor = -2;
    this.cam = {pos: [0, 0.4, 2.7], tgt: [0, 0, 0], fov: 0.75};
    this.onPreset = null;
    this.resize();
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas);
    this.last = performance.now();
    const loop = now => { const raw = Math.min(0.5, (now - this.last) / 1000); this.frame(Math.min(0.05, raw), raw); this.last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  get auto(){ return !!this.autoMode; }
  _prog(vs, fs){
    const gl = this.gl, mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; p.u[nm] = gl.getUniformLocation(p, nm); }
    return p;
  }
  _vao(prog, data, layout, idx){
    const gl = this.gl, vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, idx === 'dynamic' ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    const stride = layout.reduce((a, l) => a + l[1], 0) * 4; let off = 0;
    for (const [name, size] of layout) { const loc = gl.getAttribLocation(prog, name);
      if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off); } off += size * 4; }
    if (idx && idx !== 'dynamic') { vao.ibuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vao.ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); vao.count = idx.length; }
    gl.bindVertexArray(null); vao.buf = buf; return vao;
  }
  _free(v){ if (!v) return; const gl = this.gl; gl.deleteBuffer(v.buf); if (v.ibuf) gl.deleteBuffer(v.ibuf); gl.deleteVertexArray(v); }
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
  // scene target: multisampled color + depth, resolved into a texture
  _sceneTarget(w, h){
    const gl = this.gl, S = this.S;
    if (S) { gl.deleteTexture(S.tex); gl.deleteFramebuffer(S.rfb); [S.crb, S.drb].forEach(r => r && gl.deleteRenderbuffer(r)); if (S.msfb) gl.deleteFramebuffer(S.msfb); }
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const rfb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, rfb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
    const rb = (fmt, ms) => { const r = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, r);
      if (ms) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, fmt, w, h); else gl.renderbufferStorage(gl.RENDERBUFFER, fmt, w, h); return r; };
    let msfb = null, crb = null, drb;
    if (samples > 1) {
      msfb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, msfb);
      crb = rb(gl.RGBA8, true); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, crb);
      drb = rb(gl.DEPTH_COMPONENT24, true); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, drb);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.deleteFramebuffer(msfb); msfb = null; }
    }
    if (!msfb) { gl.bindFramebuffer(gl.FRAMEBUFFER, rfb); drb = rb(gl.DEPTH_COMPONENT24, false); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, drb); }
    this.S = {tex, rfb, msfb, crb, drb};
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
    this._sceneTarget(w, h);
  }

  setProtein(chain, F){
    if (this.failed) return;
    const raw = chain.ca || pseudoCA(chain);
    this.generated = !chain.ca;
    const n = raw.length; this.nres = n;
    const cen = [0, 1, 2].map(k => raw.reduce((a, p) => a + p[k], 0) / n);
    const rad = Math.max(...raw.map(p => Math.hypot(p[0] - cen[0], p[1] - cen[1], p[2] - cen[2]))) || 1;
    this.rad = rad;
    const nz = p => [(p[0] - cen[0]) / rad, (p[1] - cen[1]) / rad, (p[2] - cen[2]) / rad];
    const P = raw.map(nz);
    this.ca = P;
    this.atoms = chain.atoms && !this.generated ? chain.atoms.map(r => r.map(a => ({n: a[0], e: a[1], p: nz([a[2], a[3], a[4]])}))) : null;
    const ssv = chain.ss.map(s => s === 'H' ? 0 : s === 'E' ? 1 : 2);
    const prop = F ? F.zK : P.map(() => 0);
    const segs = []; let s0 = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || Math.hypot(raw[i][0] - raw[i-1][0], raw[i][1] - raw[i-1][1], raw[i][2] - raw[i-1][2]) > 4.4) { segs.push([s0, i]); s0 = i; }
    }
    // smoothed path (helix axis-like) for the fly-through camera
    this.path = P.map((p, i) => { let s = [0, 0, 0], c = 0; for (let k = Math.max(0, i - 3); k <= Math.min(n - 1, i + 3); k++) { s = V3.add(s, P[k]); c++; } return V3.mul(s, 1 / c); });
    // glow ribbon (trip views and aura)
    const SUB = 5, verts = []; this.ribSegs = [];
    for (const [a, b] of segs) {
      const pts = [];
      for (let i = a; i < b; i++) {
        const steps = i === b - 1 ? 1 : SUB;
        for (let j = 0; j < steps; j++) pts.push({q: catmull(P[Math.max(a, i - 1)], P[i], P[Math.min(b - 1, i + 1)], P[Math.min(b - 1, i + 2)], j / SUB), res: i + j / SUB, ss: ssv[i], pr: prop[i]});
      }
      if (pts.length < 2) continue;
      const first = verts.length / 13;
      pts.forEach((pt, i) => { const pv = pts[Math.max(0, i - 1)].q, nx = pts[Math.min(pts.length - 1, i + 1)].q;
        for (const side of [-1, 1]) verts.push(...pt.q, ...pv, ...nx, side, pt.res, pt.ss, pt.pr); });
      this.ribSegs.push([first, pts.length * 2]);
    }
    [this.ribVao, this.ptsVao, this.flareVao, this.meshVao, this.stickVao].forEach(v => this._free(v));
    this.ribVao = this._vao(this.prog.rib, new Float32Array(verts), [['aPos', 3], ['aPrev', 3], ['aNext', 3], ['aSide', 1], ['aRes', 1], ['aSS', 1], ['aProp', 1]]);
    const pv = []; P.forEach((p, i) => pv.push(...p, i, ssv[i], prop[i]));
    this.ptsVao = this._vao(this.prog.pts, new Float32Array(pv), [['aPos', 3], ['aRes', 1], ['aSS', 1], ['aProp', 1]]);
    this.flareBuf = new Float32Array(6);
    this.flareVao = this._vao(this.prog.pts, this.flareBuf, [['aPos', 3], ['aRes', 1], ['aSS', 1], ['aProp', 1]], 'dynamic');
    // lit cartoon
    const cart = buildCartoon(P, ssv, prop, segs, rad);
    this.meshVao = this._vao(this.prog.mesh, cart.verts, [['aPos', 3], ['aNrm', 3], ['aRes', 1], ['aSS', 1], ['aProp', 1]], cart.idx);
    this.stickVao = null; this.stickFor = -2;
  }
  _updateSticks(){
    const key = this.playing ? this.cur : -1;
    if (key === this.stickFor) return;
    this.stickFor = key; this._free(this.stickVao); this.stickVao = null;
    if (!this.atoms || key < 0) return;
    const list = [];
    for (let k = 3; k >= 0; k--) { const i = key - k; if (i >= 0 && this.atoms[i]) list.push({atoms: this.atoms[i], glow: k === 0 ? 1 : 0.35 - k * 0.08}); }
    const g = buildSticks(list, this.rad);
    if (g.idx.length) this.stickVao = this._vao(this.prog.stick, g.verts, [['aPos', 3], ['aNrm', 3], ['aCol', 3], ['aGlow', 1]], g.idx);
  }
  setAudio(fft, wave){ this.fft = fft; this.wave = wave; this.avgInit = false; }
  setPlaying(on){ this.playing = on; if (!on) { this.cur = -1; this.camRes = null; this.section = null; } }
  setPreset(key){
    if (key === 'auto' || key === 'trip') { this.autoMode = key === 'auto' ? 'structure' : 'trip';
      const sec = this.section || 'intro'; this._target(VIZ_AUTO[this.autoMode][sec] || VIZ_AUTO[this.autoMode].intro); return; }
    this.autoMode = null; this._target(key);
  }
  _target(key){
    if (!VIZ_PRESETS[key]) return;
    this.presetKey = key; this.T = VIZ_PRESETS[key];
    for (const k of VIZ_DISCRETE) this.P[k] = this.T[k];
    if (this.onPreset) this.onPreset(key);
  }
  next(){ const ks = Object.keys(VIZ_PRESETS); this.autoMode = null; this._target(ks[(ks.indexOf(this.presetKey) + 1) % ks.length]); }
  pulse(kind){
    if (kind === 'kick') { this.kick = 1; this.rings.push({t: 0, hue: this.hue}); if (this.rings.length > 6) this.rings.shift(); }
    else if (kind === 'snare') this.flash = Math.max(this.flash, 1);
  }
  // called from the transport (Tone.Draw), knows the score
  onStep(st, S){
    if (st.i >= 0) {
      // camera progress is monotonic: styles that loop a block move the camera through it once, spread over all passes
      this.camRes = Math.min(S.n - 1, st.b * BLOCK + (st.rep * BLOCK + st.s) / S.rep);
      if (this.cur < 0 || Math.abs(this.camRes - this.curF) > 24) this.curF = this.camRes;
      this.cur = st.i;
    }
    const ch = S.chords[st.b]; if (ch) this.hueT = ((S.rootPc + ch[0]) % 12) / 12;
    const ph = S.phrases[st.ph], sec = ph.role !== 'main' ? ph.role : ph.type;
    if (this.autoMode && sec !== this.section) this._target(VIZ_AUTO[this.autoMode][sec]);
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
      if (this.time - this.scoreBeatT > 2 && L.bass > 1.45 && this.time - this.lastBeat > 0.22) { this.lastBeat = this.time; this.pulse('kick'); }
      for (let b = 0; b < 64; b++) {                       // log-spaced bars 30 Hz .. 16 kHz
        const lo = 30 * Math.pow(16000 / 30, b / 64), hi = 30 * Math.pow(16000 / 30, (b + 1) / 64);
        let m = -140; for (let i = Math.max(1, Math.floor(lo / hz)); i <= Math.min(n - 1, Math.ceil(hi / hz)); i++) m = Math.max(m, db[i]);
        const v = clamp((m + 95) / 65, 0, 1) * 255; this.specBytes[b] = Math.max(v, this.specBytes[b] * Math.pow(0.02, dt));
      }
    } else {
      const t = this.time;
      L.bass = L.bass_att = 1 + 0.15 * Math.sin(t * 1.3); L.mid = L.mid_att = 1 + 0.1 * Math.sin(t * 0.7); L.treb = L.treb_att = 1;
      for (let b = 0; b < 64; b++) this.specBytes[b] *= Math.pow(0.02, dt);
    }
    if (this.wave) {
      const w = this.wave.getValue(), step = w.length / 512;
      for (let i = 0; i < 512; i++) this.waveBytes[i] = clamp(Math.round((w[Math.floor(i * step)] * 1.6 * 0.5 + 0.5) * 255), 0, 255);
    } else for (let i = 0; i < 512; i++) this.waveBytes[i] = 128 + Math.round(20 * Math.sin(i / 512 * 12.566 + this.time * 2) * Math.sin(this.time * 0.5));
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.waveTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 1, gl.RED, gl.UNSIGNED_BYTE, this.waveBytes);
    gl.bindTexture(gl.TEXTURE_2D, this.specTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 1, gl.RED, gl.UNSIGNED_BYTE, this.specBytes);
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
  _drawGlow(vp, gain, P){
    if (!this.ribVao || gain < 0.002) return;
    const gl = this.gl, L = this.lv, breath = 0.05 * (L.bass_att - 1) + 0.04 * this.kick;
    let pr = this.prog.rib; gl.useProgram(pr);
    gl.uniformMatrix4fv(pr.u.uMVP, false, vp); gl.uniform2f(pr.u.uRes, this.W, this.H);
    gl.uniform1f(pr.u.uWidth, P.width * this.H / 700); gl.uniform1f(pr.u.uCur, this.cur);
    gl.uniform1f(pr.u.uBass, L.bass); gl.uniform1f(pr.u.uWaveAmp, P.waveAmp); gl.uniform1f(pr.u.uNRes, this.nres);
    gl.uniform1f(pr.u.uTime, this.time); gl.uniform1f(pr.u.uBreath, breath * (1 - P.scene)); gl.uniform1f(pr.u.uHue, this.hue);
    gl.uniform1f(pr.u.uColorMode, this.colorOverride >= 0 ? this.colorOverride : P.colorMode);
    gl.uniform1f(pr.u.uGain, gain); gl.uniform1f(pr.u.uPlaying, this.playing && this.cur >= 0 ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.waveTex); gl.uniform1i(pr.u.uWave, 0);
    gl.bindVertexArray(this.ribVao);
    for (const [f, c] of this.ribSegs) gl.drawArrays(gl.TRIANGLE_STRIP, f, c);
    if (P.points > 0.02) {
      pr = this.prog.pts; gl.useProgram(pr);
      gl.uniformMatrix4fv(pr.u.uMVP, false, vp); gl.uniform1f(pr.u.uResY, this.H); gl.uniform1f(pr.u.uCur, this.cur);
      gl.uniform1f(pr.u.uHue, this.hue); gl.uniform1f(pr.u.uNRes, this.nres); gl.uniform1f(pr.u.uBreath, breath);
      gl.uniform1f(pr.u.uFlare, 0); gl.uniform1f(pr.u.uSize, 10 + 10 * L.treb_att); gl.uniform1f(pr.u.uGain, gain * P.points);
      gl.bindVertexArray(this.ptsVao); gl.drawArrays(gl.POINTS, 0, this.nres);
    }
  }
  _drawFlare(vp, gain){
    if (!this.playing || this.cur < 0 || !this.ca[this.cur] || gain < 0.01) return;
    const gl = this.gl, pr = this.prog.pts; gl.useProgram(pr);
    gl.uniformMatrix4fv(pr.u.uMVP, false, vp); gl.uniform1f(pr.u.uResY, this.H); gl.uniform1f(pr.u.uCur, this.cur);
    gl.uniform1f(pr.u.uHue, this.hue); gl.uniform1f(pr.u.uNRes, this.nres); gl.uniform1f(pr.u.uBreath, 0);
    this.flareBuf.set([...this.ca[this.cur], this.cur, 0, 0]);
    gl.bindVertexArray(this.flareVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.flareVao.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.flareBuf);
    gl.uniform1f(pr.u.uFlare, 1); gl.uniform1f(pr.u.uSize, (90 + 70 * this.kick) * (this.P.scene > 0.5 ? 0.6 : 1)); gl.uniform1f(pr.u.uGain, gain);
    gl.drawArrays(gl.POINTS, 0, 1);
  }
  _lightUniforms(pr, P){
    const gl = this.gl, L = this.lv, c = this.cam;
    const fwd = V3.norm(V3.sub(c.tgt, c.pos), [0, 0, -1]); let right = V3.norm(V3.cross(fwd, [0, 1, 0]), [1, 0, 0]); const up = V3.cross(right, fwd);
    const key = V3.norm(V3.add(V3.add(V3.mul(right, -0.45), V3.mul(up, 0.75)), V3.mul(fwd, -0.55)));
    const fill = V3.norm(V3.add(V3.add(V3.mul(right, 0.7), V3.mul(up, -0.2)), V3.mul(fwd, -0.4)));
    gl.uniform3fv(pr.u.uCam, c.pos); gl.uniform3fv(pr.u.uKey, key); gl.uniform3fv(pr.u.uFill, fill);
    gl.uniform3fv(pr.u.uRimCol, hsv((this.hue + 0.55) % 1, 0.55, 1));
    gl.uniform1f(pr.u.uRim, 0.35 + 0.55 * Math.max(0, L.bass_att - 0.8));
    const d = V3.len(V3.sub(c.pos, c.tgt));
    gl.uniform1f(pr.u.uFogNear, P.cam === 'orbit' ? d - 0.2 : d * 0.9 + 0.05); gl.uniform1f(pr.u.uFogFar, P.cam === 'orbit' ? d + 1.2 : d * 3.2 + 0.6);
    gl.uniform1f(pr.u.uKick, this.kick);
    gl.uniform1f(pr.u.uCut, P.cam === 'fly' ? d * 0.45 : P.cam === 'follow' ? d * 0.3 : 0);
  }
  _drawScene(vp, P){
    if (!this.meshVao) return;
    const gl = this.gl;
    this._updateSticks();
    let pr = this.prog.mesh; gl.useProgram(pr);
    gl.uniformMatrix4fv(pr.u.uVP, false, vp); this._lightUniforms(pr, P);
    gl.uniform1f(pr.u.uCur, this.cur); gl.uniform1f(pr.u.uNRes, this.nres);
    gl.uniform1f(pr.u.uColorMode, this.colorOverride >= 0 ? this.colorOverride : P.colorMode);
    gl.uniform1f(pr.u.uPlaying, this.playing && this.cur >= 0 ? 1 : 0);
    gl.bindVertexArray(this.meshVao); gl.drawElements(gl.TRIANGLES, this.meshVao.count, gl.UNSIGNED_INT, 0);
    if (this.stickVao) {
      pr = this.prog.stick; gl.useProgram(pr);
      gl.uniformMatrix4fv(pr.u.uVP, false, vp); this._lightUniforms(pr, P);
      gl.bindVertexArray(this.stickVao); gl.drawElements(gl.TRIANGLES, this.stickVao.count, gl.UNSIGNED_INT, 0);
    }
  }
  _posAt(arr, f){ const n = arr.length; f = clamp(f, 0, n - 1); const i = Math.floor(f), t = f - i; return V3.lerp(arr[i], arr[Math.min(n - 1, i + 1)], t); }
  _camera(dt, P){
    const c = this.cam, live = this.playing && this.cur >= 0 && this.ca, A = 1 / (this.rad || 30);
    this.curF += (Math.max(0, this.camRes ?? this.cur) - this.curF) * (1 - Math.exp(-dt * 10));
    let pos, tgt, fov, kp = 2.2, kt = 3.5;
    if (P.cam === 'orbit' || !live) {
      const tilt = 0.35 * Math.sin(this.time * 0.13), d = 2.7 - 0.5 * P.scene;
      pos = [Math.sin(this.angle) * d * Math.cos(tilt), Math.sin(tilt) * d, Math.cos(this.angle) * d * Math.cos(tilt)]; tgt = [0, 0, 0]; fov = 0.75;
      if (P.cam !== 'orbit') { kp = 1.5; kt = 2; }
    } else {
      // viewing direction: mostly keep the current one, drift slowly towards "outside the protein" (radial),
      // so the camera never swings through the fold when the residue passes the centre
      const p = this._posAt(this.ca, this.curF), sp = this._posAt(this.path, this.curF);
      const cur = V3.norm(V3.sub(c.pos, c.tgt), [0, 0.3, 1]);
      const radial = V3.norm(V3.add(sp, [0, 0.25, 0]), cur);
      this.outDir = V3.norm(V3.lerp(this.outDir || cur, V3.norm(V3.add(V3.mul(radial, 0.7), V3.mul(cur, 0.3))), 1 - Math.exp(-dt * 0.9)));
      if (P.cam === 'follow') {
        const sw = 0.5 * Math.sin(this.time * 0.17), o = this.outDir;
        const out = V3.norm([o[0] * Math.cos(sw) - o[2] * Math.sin(sw), o[1], o[0] * Math.sin(sw) + o[2] * Math.cos(sw)]);
        pos = V3.add(p, V3.mul(out, 26 * A)); tgt = p; fov = 0.85;
      } else {
        const back = this._posAt(this.path, this.curF - 8);
        pos = V3.add(back, V3.mul(this.outDir, 11 * A)); tgt = this._posAt(this.ca, this.curF + 1); fov = 1.0; kp = 3; kt = 5;
      }
    }
    const ep = 1 - Math.exp(-dt * kp), et = 1 - Math.exp(-dt * kt);
    c.pos = V3.lerp(c.pos, pos, ep); c.tgt = V3.lerp(c.tgt, tgt, et); c.fov += (fov - c.fov) * (1 - Math.exp(-dt * 2));
    const asp = this.W / this.H;
    return M4.mul(M4.persp(c.fov, asp, 0.004, 12), M4.lookAt(c.pos, c.tgt, [0, 1, 0]));
  }
  _label(vp, P){
    const el = this.labelEl; if (!el) return;
    if (!(this.playing && this.cur >= 0 && this.ca && P.scene > 0.5)) { el.style.opacity = 0; return; }
    const [x, y, w] = M4.xform(vp, this.ca[this.cur]);
    if (w <= 0.001) { el.style.opacity = 0; return; }
    const sx = (x / w * 0.5 + 0.5) * this.cv.clientWidth, sy = (1 - (y / w * 0.5 + 0.5)) * this.cv.clientHeight;
    const inside = sx > 0 && sx < this.cv.clientWidth && sy > 0 && sy < this.cv.clientHeight;
    el.style.opacity = inside ? 1 : 0; el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
  }
  frame(dt, rawDt){
    if (this.failed) return;
    const gl = this.gl; this.time += dt;
    this._audio(rawDt || dt);
    const P = this.P, T = this.T, L = this.lv, k = Math.min(1, dt * 1.2);
    for (const key in T) if (typeof T[key] === 'number' && !VIZ_DISCRETE.includes(key)) P[key] += (T[key] - P[key]) * k;
    this.hue += (((this.hueT - this.hue + 1.5) % 1) - 0.5) * Math.min(1, dt * 0.8);
    this.flash *= Math.pow(0.02, dt); this.kick *= Math.pow(0.005, dt);
    this.angle += dt * (P.spin + 0.35 * (1 - P.scene) * Math.max(0, L.bass_att - 1));
    const asp = this.W / this.H, step = clamp(dt * 60, 0.25, 3);
    const vp = this._camera(Math.min(0.1, rawDt || dt), P);

    // 1) warp + decay previous frame into B
    gl.viewport(0, 0, this.W, this.H); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.B.fb);
    let pr = this.prog.fb; gl.useProgram(pr);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.A.tex); gl.uniform1i(pr.u.uPrev, 0);
    gl.uniform1f(pr.u.uTime, this.time); gl.uniform1f(pr.u.uZoom, P.zoom + 0.03 * this.kick);
    gl.uniform1f(pr.u.uRot, P.rot + 0.01 * (L.mid_att - 1)); gl.uniform1f(pr.u.uWarp, P.warp * (0.7 + 0.5 * L.mid_att));
    gl.uniform1f(pr.u.uWarpSpeed, P.warpSpeed); gl.uniform1f(pr.u.uDecay, P.decay); gl.uniform1f(pr.u.uKaleido, P.kaleido);
    gl.uniform1f(pr.u.uHueShift, P.hue + 0.01 * Math.max(0, L.treb_att - 1)); gl.uniform1f(pr.u.uBass, L.bass_att);
    gl.uniform1f(pr.u.uTreb, L.treb_att); gl.uniform1f(pr.u.uAspect, asp); gl.uniform1f(pr.u.uStep, step);
    gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 2) glow shapes into the feedback buffer (they leave trails)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    this._drawGlow(vp, P.trail * 0.35 * step, P);
    if (P.ring > 0.02) {
      const pts = [], N = 256, wb = this.waveBytes;
      for (let i = 0; i < N; i++) { const a = i / N * 6.2832, r = 0.72 + 0.35 * (wb[i * 2] / 255 - 0.5) + 0.04 * this.kick;
        pts.push([Math.cos(a) * r / asp, Math.sin(a) * r]); }
      this._poly2d(pts, 2.2 * this.H / 700, [...hsv((this.hue + 0.5) % 1, 0.7, 1), 0.3 * P.ring * step], true);
    }
    this.rings = this.rings.filter(r => (r.t += dt) < 0.7);
    for (const r of this.rings) { const pts = [], rad = 0.12 + r.t * 1.5;
      for (let i = 0; i < 64; i++) { const a = i / 64 * 6.2832; pts.push([Math.cos(a) * rad / asp, Math.sin(a) * rad]); }
      this._poly2d(pts, 3 * this.H / 700, [...hsv(r.hue, 0.5, 1), 0.5 * step * (1 - r.t / 0.7) * (1 - 0.6 * P.scene)], true); }

    // 3) crisp glow layer (no feedback): backbone glow in trip views, flare on the played residue
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.C.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    this._drawGlow(vp, P.crisp, P);
    this._drawFlare(vp, P.flare);

    // 4) lit scene: cartoon + sticks, multisampled, depth tested
    const S = this.S;
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.msfb || S.rfb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (P.scene > 0.01) { gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); this._drawScene(vp, P); gl.disable(gl.DEPTH_TEST); }
    if (S.msfb) { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.msfb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S.rfb);
      gl.blitFramebuffer(0, 0, this.W, this.H, 0, 0, this.W, this.H, gl.COLOR_BUFFER_BIT, gl.NEAREST); }

    // 5) composite to screen
    gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    pr = this.prog.comp; gl.useProgram(pr);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.B.tex); gl.uniform1i(pr.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.C.tex); gl.uniform1i(pr.u.uTop, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, S.tex); gl.uniform1i(pr.u.uScene, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.specTex); gl.uniform1i(pr.u.uSpec, 3);
    gl.uniform2f(pr.u.uRes, this.W, this.H); gl.uniform1f(pr.u.uFlash, this.flash); gl.uniform1f(pr.u.uEcho, P.echo);
    gl.uniform1f(pr.u.uScan, P.scan); gl.uniform1f(pr.u.uCrt, P.crt); gl.uniform1f(pr.u.uFb, P.fb); gl.uniform1f(pr.u.uSceneAmt, P.scene);
    gl.uniform1f(pr.u.uBg, P.bg); gl.uniform1f(pr.u.uSpecAmt, P.spec * (this.fft ? 1 : 0.4));
    gl.uniform3fv(pr.u.uBgA, hsv(this.hue, 0.45, 0.1 + 0.05 * Math.max(0, L.bass_att - 0.8))); gl.uniform3fv(pr.u.uBgB, [0.018, 0.024, 0.036]);
    gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
    [this.A, this.B] = [this.B, this.A];
    this._label(vp, P);
  }
}
