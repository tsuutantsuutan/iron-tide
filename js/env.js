'use strict';
/* ================= environment: waves, sky, ocean, islands, port, maps ================= */
let simT = 0; // world time (s) used by waves
const MAP_HALF = 12000;

/* ---------- Gerstner waves (identical on CPU and GPU) ---------- */
// [direction offset (rad), wavelength (m), steepness]
const WAVE_DEF = [[0.25, 150, .075], [1.15, 91, .095], [-0.7, 57, .11], [1.9, 35, .1], [-1.5, 22, .085], [0.6, 13, .07]];
const WAVES = { list: [], sea: 1, dir: 0, amp: 1, u: WAVE_DEF.map(() => new THREE.Vector4()) };
function setSea(sea, dir) {
  WAVES.sea = sea; WAVES.dir = dir;
  WAVES.list = WAVE_DEF.map(([a, lam, st], i) => { const ang = dir + a, k = 2 * Math.PI / lam; const w = { dx: Math.sin(ang), dz: -Math.cos(ang), k, A: sea * st / k, w: Math.sqrt(G * k) }; WAVES.u[i].set(w.dx, w.dz, w.k, w.A); return w; });
  WAVES.amp = Math.max(.05, WAVES.list.reduce((s, w) => s + w.A, 0));
  U.uAmp.value = WAVES.amp; U.uWind.value.set(Math.sin(dir), -Math.cos(dir));
}
const _wd = { x: 0, y: 0, z: 0 };
function waveDisp(x, z, t) {
  let ox = 0, oy = 0, oz = 0;
  for (const w of WAVES.list) { const f = w.k * (w.dx * x + w.dz * z) - w.w * t, c = Math.cos(f), s = Math.sin(f); ox += w.dx * w.A * c; oz += w.dz * w.A * c; oy += w.A * s; }
  _wd.x = ox; _wd.y = oy; _wd.z = oz; return _wd;
}
function waveH(x, z, t = simT) { let px = x, pz = z; for (let i = 0; i < 2; i++) { const d = waveDisp(px, pz, t); px = x - d.x; pz = z - d.z; } return waveDisp(px, pz, t).y; }

/* ---------- shared uniforms ---------- */
const U = {
  uT: { value: 0 }, uSunDir: { value: new V3(0, 1, 0) }, uSunCol: { value: new V3(1, 1, 1) }, uZenith: { value: new V3() }, uHorizon: { value: new V3() },
  uHaze: { value: .3 }, uCloud: { value: .4 }, uWind: { value: new THREE.Vector2(0, -1) }, uW: { value: WAVES.u }, uAmp: { value: 1 },
  uCam: { value: new V3() }, uDeep: { value: new V3() }, uScat: { value: new V3() }, uShallow: { value: new V3() }, uFogCol: { value: new V3() }, uFogD: { value: 2e-5 },
  uFoam: { value: .5 }, uDetail: { value: 1 }, uDepth: { value: null }, uMap: { value: new V3(-MAP_HALF, -MAP_HALF, MAP_HALF * 2) }, uCenter: { value: new V3() }, uSpK: { value: .05 },
  uNight: { value: 0 }
};

const GLSL_COMMON = `
uniform float uT; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uZenith; uniform vec3 uHorizon; uniform float uHaze; uniform float uCloud; uniform vec2 uWind; uniform float uNight;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 x){ vec2 i=floor(x); vec2 f=x-i; vec2 u=f*f*(3.-2.*f);
  float a=hash12(i), b=hash12(i+vec2(1.,0.)), c=hash12(i+vec2(0.,1.)), d=hash12(i+vec2(1.,1.)); return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }
vec3 noised(vec2 x){ vec2 i=floor(x); vec2 f=x-i; vec2 u=f*f*f*(f*(f*6.-15.)+10.); vec2 du=30.*f*f*(f*(f-2.)+1.);
  float a=hash12(i), b=hash12(i+vec2(1.,0.)), c=hash12(i+vec2(0.,1.)), d=hash12(i+vec2(1.,1.)); float k1=b-a, k2=c-a, k4=a-b-c+d;
  return vec3(a+k1*u.x+k2*u.y+k4*u.x*u.y, du*vec2(k1+k4*u.y, k2+k4*u.x)); }
float fbm5(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.3); a*=.5; } return s/0.97; }
vec3 skyBase(vec3 d){
  float y = max(d.y, 0.0);
  vec3 c = mix(uHorizon, uZenith, pow(y, 0.5));
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(sd, 5.0)*0.12*(0.4+uHaze) + pow(sd, 40.0)*0.22);
  c += uHorizon * pow(1.0 - y, 12.0) * 0.25 * uHaze;
  if (d.y < 0.0) c = mix(c, uHorizon*0.6, clamp(-d.y*5.0, 0.0, 1.0));
  return c;
}
vec4 cloudLayer(vec3 d){
  if (d.y <= 0.002) return vec4(0.);
  vec2 uv = d.xz / (d.y + 0.1) * 1.25 + uWind*uT*0.0015;
  float n = fbm5(uv);
  float th = 0.64 - uCloud*0.36;
  float den = smoothstep(th, th+0.2, n) * smoothstep(0.0, 0.07, d.y);
  float thick = smoothstep(th, th+0.45, n);
  float sd = max(dot(d, uSunDir), 0.);
  vec3 lit = uSunCol*0.5 + uZenith*0.55 + uHorizon*0.55;
  vec3 col = mix(lit, lit*0.42 + uHorizon*0.12, clamp(thick*(0.4+uCloud), 0., 1.));
  col += uSunCol * pow(sd, 9.0) * (1.0-thick) * 1.4;
  col = mix(col, uHorizon*1.05, smoothstep(0.22, 0.0, d.y)*0.65);
  return vec4(col, den*0.97);
}
uniform vec4 uW[6];
vec3 gerstnerD(vec2 p, float sp){ vec3 o=vec3(0.);
  for(int i=0;i<6;i++){ vec4 w=uW[i]; float lam=6.2831853/w.z; float fade=clamp((lam-5.0*sp)/(5.0*sp+0.001),0.,1.); float A=w.w*fade;
    float f=w.z*dot(w.xy,p)-sqrt(9.81*w.z)*uT; float c=cos(f), s=sin(f); o.x+=w.x*A*c; o.z+=w.y*A*c; o.y+=A*s; }
  return o; }
vec3 gerstnerN(vec2 p, float sp){ vec3 n=vec3(0.,1.,0.);
  for(int i=0;i<6;i++){ vec4 w=uW[i]; float lam=6.2831853/w.z; float fade=clamp((lam-4.0*sp)/(4.0*sp+0.001),0.,1.); float A=w.w*fade;
    float f=w.z*dot(w.xy,p)-sqrt(9.81*w.z)*uT; float c=cos(f), s=sin(f); float WA=w.z*A; n.x-=w.x*WA*c; n.z-=w.y*WA*c; n.y-=WA*s; }
  return normalize(n); }
`;

/* ---------- sky ---------- */
const SKY_PRESETS = {
  day: { n: '昼・快晴', el: 52, az: 150, sun: [1, .96, .9], sunI: 3.4, zen: [.07, .19, .5], hor: [.62, .72, .84], cloud: .36, haze: .3, fog: 1.9e-5, deep: [.006, .035, .07], scat: [.0, .11, .12], shal: [.12, .5, .48], amb: .55, exp: .6 },
  dawn: { n: '早朝', el: 7, az: 85, sun: [1, .66, .42], sunI: 2.4, zen: [.06, .1, .26], hor: [.8, .58, .46], cloud: .34, haze: .55, fog: 3e-5, deep: [.006, .022, .045], scat: [.03, .07, .07], shal: [.1, .3, .3], amb: .4, exp: .58 },
  dusk: { n: '夕暮れ', el: 4.5, az: 262, sun: [1, .5, .24], sunI: 2.2, zen: [.04, .06, .19], hor: [1.0, .5, .3], cloud: .42, haze: .75, fog: 3.4e-5, deep: [.005, .016, .035], scat: [.04, .05, .05], shal: [.09, .22, .22], amb: .35, exp: .78 },
  overcast: { n: '曇天・荒天', el: 34, az: 200, sun: [.78, .8, .84], sunI: .9, zen: [.3, .34, .38], hor: [.5, .53, .56], cloud: .92, haze: .9, fog: 5.2e-5, deep: [.012, .03, .04], scat: [.02, .07, .07], shal: [.08, .22, .22], amb: .9, exp: .75 },
  night: { n: '夜戦', el: -12, az: 300, sun: [.35, .42, .6], sunI: .25, zen: [.004, .007, .018], hor: [.025, .035, .06], cloud: .45, haze: .4, fog: 4.2e-5, deep: [.001, .004, .009], scat: [.0, .01, .015], shal: [.01, .03, .04], amb: .18, exp: 1.5, night: 1 }
};
const SUN = new THREE.DirectionalLight(0xffffff, 3); SUN.castShadow = true;
SUN.shadow.mapSize.set(2048, 2048); Object.assign(SUN.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 3000 }); SUN.shadow.bias = -.0004; SUN.shadow.normalBias = .6;
scene.add(SUN, SUN.target);
const HEMI = new THREE.HemisphereLight(0x9fb8d0, 0x2a3540, .6); scene.add(HEMI);
const MOON = new THREE.DirectionalLight(0x8899cc, 0); scene.add(MOON);

const skyMat = new THREE.ShaderMaterial({
  uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
  fragmentShader: GLSL_COMMON + `varying vec3 vDir;
  void main(){ vec3 d = normalize(vDir); vec3 c = skyBase(d); float sd = dot(d, uSunDir);
    #ifndef ENVPASS
    c += uSunCol * smoothstep(0.99962, 0.99988, sd) * 28.0 * (1.0 - uNight*0.9);
    #endif
    if (uNight > 0.0 && d.y > 0.0) { vec2 g = floor(d.xz/(d.y+0.3)*420.); float st = step(0.9975, hash12(g)); c += vec3(st)*0.35*uNight*smoothstep(0.0,0.2,d.y); }
    vec4 cl = cloudLayer(d); c = mix(c, cl.rgb, cl.a);
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(60000, 48, 24), skyMat); sky.renderOrder = -1000; sky.frustumCulled = false; scene.add(sky);
scene.fog = new THREE.FogExp2(0x9fb0c0, 2e-5);
const pmrem = new THREE.PMREMGenerator(renderer);
let envTex = null;
const envMat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false, defines: { ENVPASS: 1 }, vertexShader: skyMat.vertexShader, fragmentShader: skyMat.fragmentShader });
const envScene = new THREE.Scene(); const envSky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), envMat); envScene.add(envSky);
let SKY = SKY_PRESETS.day;
function setSky(id) {
  const P = SKY = SKY_PRESETS[id] || SKY_PRESETS.day; SKY.id = id;
  const el = P.el * DEG, az = P.az * DEG;
  U.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  const lightDir = U.uSunDir.value.clone(); if (P.night) lightDir.set(Math.sin(az) * .6, .5, -Math.cos(az) * .6).normalize();
  U.uSunCol.value.set(...P.sun).multiplyScalar(P.sunI / 3.4 * 1.0);
  U.uZenith.value.set(...P.zen); U.uHorizon.value.set(...P.hor); U.uHaze.value = P.haze; U.uCloud.value = P.cloud;
  U.uDeep.value.set(...P.deep); U.uScat.value.set(...P.scat); U.uShallow.value.set(...P.shal); U.uNight.value = P.night || 0;
  U.uFogD.value = P.fog; U.uFogCol.value.copy(U.uHorizon.value);
  scene.fog.color.setRGB(P.hor[0], P.hor[1], P.hor[2]); scene.fog.density = P.fog;
  SUN.color.setRGB(...P.sun); SUN.intensity = P.night ? .0 : P.sunI * .48 * (P.el < 10 ? .85 : 1);
  MOON.intensity = P.night ? .35 : 0; MOON.position.copy(lightDir).multiplyScalar(1000);
  SUN.userData.dir = lightDir;
  HEMI.color.setRGB(P.zen[0] * 2 + .1, P.zen[1] * 2 + .1, P.zen[2] * 2 + .1).multiplyScalar(P.night ? .25 : 1); HEMI.groundColor.setRGB(P.hor[0] * .3, P.hor[1] * .32, P.hor[2] * .35); HEMI.intensity = P.amb * .75;
  renderer.toneMappingExposure = P.exp;
  U.uT.value = simT;
  if (envTex) envTex.dispose();
  envTex = pmrem.fromScene(envScene, 0, .1, 1000).texture; scene.environment = envTex;
}

/* ---------- ocean ---------- */
const oceanMat = new THREE.ShaderMaterial({
  uniforms: U, side: THREE.DoubleSide, fog: false,
  vertexShader: GLSL_COMMON + `uniform vec3 uCenter; uniform float uSpK; varying vec3 vW; varying vec2 vP; varying float vH;
  void main(){ vec2 p = position.xz + uCenter.xz; float sp = length(position.xz)*uSpK + 0.3; vec3 d = gerstnerD(p, sp);
    vW = vec3(p.x + d.x, d.y, p.y + d.z); vP = p; vH = d.y; gl_Position = projectionMatrix*viewMatrix*vec4(vW,1.0); }`,
  fragmentShader: GLSL_COMMON + `uniform vec3 uCam; uniform vec3 uDeep; uniform vec3 uScat; uniform vec3 uShallow; uniform vec3 uFogCol; uniform float uFogD; uniform float uAmp; uniform float uFoam; uniform float uDetail; uniform sampler2D uDepth; uniform vec3 uMap;
  varying vec3 vW; varying vec2 vP; varying float vH;
  void main(){
    vec3 V = uCam - vW; float dist = length(V); V /= dist;
    float graze = 1.0/max(V.y, 0.05);
    float sp = dist*0.0012*graze;
    vec3 N = gerstnerN(vP, sp);
    vec2 g = vec2(0.); float sc = 0.085; float a = 0.42;
    for (int i=0;i<4;i++){ float fade = clamp(1.0/(sc*0.0045*dist*graze+1e-4) - 1.0, 0.0, 1.0);
      vec3 n = noised(vP*sc + uWind*uT*sc*(1.6+float(i)*0.7) + vec2(float(i)*31.7));
      g += n.yz*(a*sc*fade); sc *= 2.13; a *= 0.6; }
    N = normalize(N + vec3(-g.x, 0.0, -g.y)*uDetail*(0.6+uAmp*0.25));
    N = normalize(mix(N, vec3(0.,1.,0.), smoothstep(4000., 40000., dist)*0.5));
    float NdV = max(dot(N,V), 0.0);
    float fres = 0.02 + 0.98*pow(1.0-NdV, 5.0);
    vec3 R = reflect(-V, N); R.y = abs(R.y) + 0.002;
    vec3 refl = skyBase(R); vec4 cl = cloudLayer(R); refl = mix(refl, cl.rgb, cl.a*0.85);
    vec2 muv = (vW.xz - uMap.xy)/uMap.z; float depth = 300.0;
    if (muv.x>0.0 && muv.x<1.0 && muv.y>0.0 && muv.y<1.0) depth = texture2D(uDepth, muv).r*80.0;
    float crest = clamp(vH/uAmp*0.6+0.5, 0.0, 1.0);
    float sunL = max(dot(N, uSunDir), 0.0);
    vec3 body = uDeep*(0.8+0.4*sunL) + uScat*crest*crest*(0.35+0.65*sunL);
    float back = pow(max(dot(-V, uSunDir)*0.5+0.5, 0.0), 3.0);
    body += uScat*uSunCol*back*crest*0.6;
    body = mix(uShallow*(0.6+0.5*sunL), body, smoothstep(0.5, 26.0, depth));
    vec3 col = mix(body, refl, fres);
    float sdot = max(dot(R, uSunDir), 0.0);
    col += uSunCol * (pow(sdot, 1200.0)*26.0 + pow(sdot, 120.0)*0.7 + pow(sdot,12.0)*0.04) * (1.0-uCloud*0.75);
    float fn = vnoise(vP*0.021 + uWind*uT*0.018)*0.6 + vnoise(vP*0.061 - uWind*uT*0.025)*0.4;
    float cap = smoothstep(0.7, 0.98, crest) * smoothstep(0.42, 0.78, fn) * uFoam;
    float shore = smoothstep(8.0, 0.8, depth) * (0.5 + 0.5*sin(depth*1.2 - uT*1.05 + fn*5.0)) + smoothstep(1.6,0.2,depth);
    float foam = clamp(cap*0.85 + shore*0.8, 0.0, 1.0);
    vec3 foamC = uSunCol*max(uSunDir.y,0.08)*0.95 + uZenith*0.7 + uHorizon*0.35;
    col = mix(col, foamC*(0.55+0.45*sunL), foam);
    float fog = 1.0 - exp(-pow(uFogD*dist, 2.0));
    col = mix(col, uFogCol, fog);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }`
});
let ocean = null;
function buildOcean() {
  const q = Q(), seg = q.oceanSeg, rings = q.oceanRings, r0 = 1.2, r1 = 50000;
  const pos = [0, 0, 0], idx = [];
  for (let i = 0; i < rings; i++) { const r = r0 * Math.pow(r1 / r0, i / (rings - 1)); for (let j = 0; j < seg; j++) { const a = j / seg * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); } }
  for (let j = 0; j < seg; j++) idx.push(0, 1 + (j + 1) % seg, 1 + j);
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < seg; j++) { const a = 1 + i * seg + j, b = 1 + i * seg + (j + 1) % seg, c = a + seg, d = b + seg; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  U.uSpK.value = Math.max(Math.pow(r1 / r0, 1 / (rings - 1)) - 1, 2 * Math.PI / seg);
  if (ocean) { scene.remove(ocean); ocean.geometry.dispose(); }
  ocean = new THREE.Mesh(g, oceanMat); ocean.frustumCulled = false; ocean.renderOrder = -10; scene.add(ocean);
}

/* ---------- terrain noise ---------- */
function h2(ix, iz, s) { let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vn(x, z, s) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = h2(ix, iz, s), b = h2(ix + 1, iz, s), c = h2(ix, iz + 1, s), d = h2(ix + 1, iz + 1, s); return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz; }
function fbm(x, z, s, o) { let t = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { t += a * vn(x * f, z * f, s + i * 17); n += a; a *= .5; f *= 2.03; } return t / n; }

let ISL = [], PORTS = [];
function islandH(I, x, z) {
  const dx = x - I.x, dz = z - I.z, ex = I.r * 1.7, ez = I.r * 1.7 * (I.e || 1);
  if (Math.abs(dx) > ex || Math.abs(dz) > ez) return -1e9;
  const ux = dx / I.r, uz = dz / I.r / (I.e || 1);
  const warp = fbm(ux * 1.05 + 3.1, uz * 1.05 - 2.3, I.seed, 4) - .5;
  const rr = Math.hypot(ux, uz) * (1 - warp * .75);
  const m = fbm(ux * 2.1, uz * 2.1, I.seed + 50, 5);
  const bump = rr < 1 ? Math.pow(1 - rr * rr, 1.25) : 0;
  let h = I.h * bump * (.3 + 1.45 * m * m) + lerp(3.2, -48, smooth(.8, 1.55, rr));
  if (I.port) {
    const P = I.port, rp = Math.hypot(dx, dz) / I.r, da = Math.abs(wrapPi(Math.atan2(dz, dx) - P.ang));
    const mask = smooth(P.w, P.w * .7, da) * smooth(P.q - .55, P.q - .35, rp);
    if (mask > 0) h = lerp(h, rp < P.q ? 2.6 : -17, mask * (rp < P.q ? 1 : smooth(P.q + .45, P.q + .25, rp)));
    // breakwater ridge (for collisions, shallow colour and shore foam)
    const bd = Math.abs(rp - P.bw) * I.r, gap = Math.abs(wrapPi(Math.atan2(dz, dx) - P.ang));
    if (bd < 14 && gap < P.w * .95 && gap > P.gap) h = Math.max(h, 3.5);
  }
  return h;
}
function terrainH(x, z) { let h = -60; for (const I of ISL) { const v = islandH(I, x, z); if (v > h) h = v; } return h; }

const islandGroup = new THREE.Group(); scene.add(islandGroup);
const PAL = {
  trop: { sand: [.86, .8, .64], grass: [.33, .48, .18], forest: [.11, .26, .09], rock: [.45, .42, .37], peak: [.5, .48, .44] },
  temp: { sand: [.6, .57, .48], grass: [.28, .36, .18], forest: [.12, .2, .1], rock: [.37, .36, .34], peak: [.55, .54, .52] }
};
const lin = c => c.map(v => Math.pow(v, 2.2));
function buildIsland(I, palId) {
  const pal = PAL[palId] || PAL.temp, P = {}; for (const k in pal) P[k] = lin(pal[k]);
  const ex = I.r * 1.7, ez = I.r * 1.7 * (I.e || 1);
  const nx = clamp(Math.round(ex * 2 / 20), 50, 220), nz = clamp(Math.round(ez * 2 / 20), 50, 260);
  const g = new THREE.PlaneGeometry(ex * 2, ez * 2, nx, nz); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + I.x, z = p.getZ(i) + I.z; p.setY(i, Math.max(-40, terrainH(x, z))); }
  g.computeVertexNormals();
  const n = g.attributes.normal, col = new Float32Array(p.count * 3), c = [0, 0, 0];
  const mix3 = (a, b, t) => { c[0] = lerp(a[0], b[0], t); c[1] = lerp(a[1], b[1], t); c[2] = lerp(a[2], b[2], t); };
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i) + I.x, z = p.getZ(i) + I.z, slope = 1 - n.getY(i), nn = fbm(x / 260, z / 260, I.seed + 9, 3);
    mix3(P.sand, P.grass, smooth(1.2, 5 + nn * 4, y));
    const g2 = [c[0], c[1], c[2]]; mix3(g2, P.forest, smooth(8, 30, y) * smooth(.25, .6, nn + .15) * .9); const g3 = [c[0], c[1], c[2]];
    mix3(g3, P.rock, Math.max(smooth(.28, .5, slope), smooth(I.h * .75, I.h * 1.05, y) * .8)); const g4 = [c[0], c[1], c[2]];
    if (y < 1) mix3(g4, [P.sand[0] * .6, P.sand[1] * .6, P.sand[2] * .55], smooth(1, -6, y));
    if (I.port) { const rp = Math.hypot(x - I.x, z - I.z) / I.r, da = Math.abs(wrapPi(Math.atan2(z - I.z, x - I.x) - I.port.ang)); const m = smooth(I.port.w, I.port.w * .75, da) * smooth(I.port.q - .45, I.port.q - .3, rp) * smooth(4, 2.8, y); if (m > 0) { const g5 = [c[0], c[1], c[2]]; mix3(g5, lin([.42, .41, .39]), m); } }
    // gentle baked light/occlusion so slopes read from distance
    const ao = clamp(.72 + .28 * n.getY(i), 0, 1);
    col[i * 3] = c[0] * ao; col[i * 3 + 1] = c[1] * ao; col[i * 3 + 2] = c[2] * ao;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: 0, envMapIntensity: .12 }));
  m.position.set(I.x, 0, I.z); m.receiveShadow = true; m.castShadow = true; islandGroup.add(m);
}

/* ---------- harbour ---------- */
const portMats = {
  conc: new THREE.MeshStandardMaterial({ color: 0x8c8a84, roughness: .95 }), wall: new THREE.MeshStandardMaterial({ color: 0x6f6d68, roughness: .95 }),
  ware: new THREE.MeshStandardMaterial({ color: 0x9a8e7a, roughness: .9 }), roof: new THREE.MeshStandardMaterial({ color: 0x3e4447, roughness: .7, metalness: .3 }),
  brick: new THREE.MeshStandardMaterial({ color: 0x8a4a36, roughness: .9 }), crane: new THREE.MeshStandardMaterial({ color: 0x9a3d22, roughness: .7, metalness: .4 }),
  tank: new THREE.MeshStandardMaterial({ color: 0xc9c6bd, roughness: .5, metalness: .3 }), white: new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: .7 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb02a20, roughness: .6 }), glass: new THREE.MeshStandardMaterial({ color: 0x1b2730, roughness: .2, metalness: .8 }),
  lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5, 3), toneMapped: false })
};
function buildPort(I) {
  const P = I.port, grp = new THREE.Group(), byMat = {};
  const add = (geo, mat, x, y, z, ry = 0) => { geo.rotateY(ry); geo.translate(x, y, z); (byMat[mat] = byMat[mat] || []).push(geo); };
  const at = (rp, a) => [I.x + Math.cos(a) * rp * I.r, I.z + Math.sin(a) * rp * I.r];
  // quay wall along the edge
  const n = Math.ceil(P.w * 2 * P.q * I.r / 40);
  for (let i = 0; i <= n; i++) { const a = P.ang - P.w * .92 + i / n * P.w * 1.84, [x, z] = at(P.q, a); add(new THREE.BoxGeometry(44, 10, 6), 'wall', x, -2.4, z, -a + Math.PI / 2); add(new THREE.BoxGeometry(44, .6, 8), 'conc', x, 2.75, z, -a + Math.PI / 2); }
  // cranes on the quay
  for (let i = 0; i < 5; i++) { const a = P.ang - P.w * .7 + i / 4 * P.w * 1.4, [x, z] = at(P.q - .012, a), ry = -a + Math.PI / 2;
    const cg = []; const B = (w, h, d, px, py, pz) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(px, py, pz); cg.push(b); };
    B(1.4, 30, 1.4, -7, 17, -5); B(1.4, 30, 1.4, 7, 17, -5); B(1.4, 30, 1.4, -7, 17, 5); B(1.4, 30, 1.4, 7, 17, 5); B(16, 1.6, 12, 0, 32, 0); B(6, 5, 6, 0, 35, 2); B(1.2, 1.2, 46, 0, 33, -20);
    const m = THREE.BufferGeometryUtils.mergeBufferGeometries(cg); add(m, 'crane', x, 0, z, ry); }
  // warehouses
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) { const a = P.ang - P.w * .75 + (i + .5) / 6 * P.w * 1.5, [x, z] = at(P.q - .07 - row * .07, a), ry = -a + Math.PI / 2, L = 60 + (i * 13 % 25);
    add(new THREE.BoxGeometry(L, 11, 24), row === 1 && i % 3 === 0 ? 'brick' : 'ware', x, 8.1, z, ry);
    const roof = new THREE.CylinderGeometry(13.5, 13.5, L + 1, 3, 1); roof.rotateZ(Math.PI / 2); roof.scale(1, .32, 1); add(roof, 'roof', x, 13.6, z, ry); }
  // oil tanks
  for (let i = 0; i < 6; i++) { const a = P.ang + P.w * (.55 + (i % 3) * .1) * (i < 3 ? 1 : -1), [x, z] = at(P.q - .3 - (i % 2) * .06, a); add(new THREE.CylinderGeometry(16, 16, 15, 28), 'tank', x, 10, z); add(new THREE.CylinderGeometry(16.3, 16.3, .6, 28), 'roof', x, 17.8, z); }
  // admin building + chimney
  { const [x, z] = at(P.q - .32, P.ang - .05); add(new THREE.BoxGeometry(70, 20, 26), 'brick', x, 12.6, z, -P.ang + Math.PI / 2); add(new THREE.BoxGeometry(71, 1.5, 27), 'white', x, 23, z, -P.ang + Math.PI / 2);
    const [cx, cz] = at(P.q - .4, P.ang + .1); add(new THREE.CylinderGeometry(2.6, 3.8, 48, 16), 'brick', cx, 26, cz); }
  // breakwaters and lighthouses
  for (const side of [-1, 1]) { const a0 = P.ang + side * P.gap, a1 = P.ang + side * P.w * .95, m = Math.ceil(Math.abs(a1 - a0) * P.bw * I.r / 30);
    for (let i = 0; i <= m; i++) { const a = lerp(a0, a1, i / m), [x, z] = at(P.bw, a); add(new THREE.BoxGeometry(32, 9, 14), 'conc', x, -1.2, z, -a + Math.PI / 2); }
    const [lx, lz] = at(P.bw, a0); add(new THREE.CylinderGeometry(2.4, 3.4, 22, 16), side > 0 ? 'white' : 'red', lx, 14, lz); add(new THREE.CylinderGeometry(2.8, 2.8, 3.2, 16), 'glass', lx, 26.6, lz); add(new THREE.ConeGeometry(3.2, 3, 16), 'red', lx, 29.6, lz);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: side > 0 ? 0xfff0c8 : 0xff6655, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.position.set(lx, 26.6, lz); glow.scale.setScalar(18); glow.userData.light = true; grp.add(glow); }
  for (const k in byMat) { const mm = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(byMat[k]), portMats[k]); mm.castShadow = mm.receiveShadow = true; grp.add(mm); }
  islandGroup.add(grp);
  PORTS.push({ I, grp });
}
let _glowTex = null;
function glowTex() { if (_glowTex) return _glowTex; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); _glowTex = new THREE.CanvasTexture(c); return _glowTex; }

/* ---------- maps ---------- */
const MAPS = {
  nanyo: { n: '南洋群島', d: 'エメラルドの浅瀬が広がる熱帯の島々。島影を使った待ち伏せが有効。', sky: 'day', sea: .55, wind: .7, pal: 'trop',
    islands: [{ x: -3600, z: -1300, r: 1050, h: 190 }, { x: 2700, z: 700, r: 650, h: 85 }, { x: 600, z: -4700, r: 480, h: 55 }, { x: -6600, z: 3600, r: 900, h: 150 }, { x: 6300, z: -3900, r: 1300, h: 270, e: 1.3 }, { x: 4300, z: 5300, r: 380, h: 38 }, { x: -1200, z: 4300, r: 330, h: 26 }, { x: -7600, z: -6200, r: 700, h: 120 }, { x: 8200, z: 2600, r: 520, h: 70 }] },
  bokou: { n: '母港・蒼浦湾', d: '要塞化された軍港を抱く湾。早朝の靄の中で戦う。', sky: 'dawn', sea: .35, wind: 2.2, pal: 'temp',
    islands: [{ x: -7600, z: -7600, r: 4300, h: 540, port: { ang: Math.PI / 4, w: .42, q: .93, bw: 1.07, gap: .07 } }, { x: 7600, z: -7200, r: 2600, h: 400 }, { x: 3100, z: 2300, r: 620, h: 120 }, { x: -2700, z: 4600, r: 820, h: 160 }, { x: 8400, z: 5600, r: 1300, h: 230 }] },
  gaiyou: { n: '外洋', d: '島ひとつない大洋。うねりが大きく、砲戦は純粋な腕比べになる。', sky: 'overcast', sea: 1.3, wind: 4, pal: 'temp', islands: [{ x: 2500, z: -1800, r: 160, h: 46 }] },
  kaikyou: { n: '鉄冠海峡', d: '左右を高い山に挟まれた細い海峡。夕日を背にした敵は見えにくい。', sky: 'dusk', sea: .7, wind: 1.3, pal: 'temp',
    islands: [{ x: -5600, z: 0, r: 2900, e: 2.8, h: 430 }, { x: 5600, z: 400, r: 2900, e: 2.7, h: 390 }, { x: 300, z: -1700, r: 240, h: 36 }, { x: -600, z: 3600, r: 200, h: 28 }] }
};
let MAP = null, depthTex = null, minimapImg = null;
function setMap(id, skyId, sea) {
  const M = MAP = Object.assign({ id }, MAPS[id] || MAPS.nanyo);
  while (islandGroup.children.length) { const c = islandGroup.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  ISL = M.islands.map((I, i) => Object.assign({ seed: hashStr(id) % 997 + i * 31 }, I)); PORTS = [];
  for (const I of ISL) { buildIsland(I, M.pal); if (I.port) buildPort(I); }
  // bake depth texture for shallows, shore foam and minimap
  const N = 512, data = new Uint8Array(N * N * 4), mc = document.createElement('canvas'); mc.width = mc.height = N; const mx = mc.getContext('2d'), img = mx.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -MAP_HALF + (i + .5) / N * MAP_HALF * 2, z = -MAP_HALF + (j + .5) / N * MAP_HALF * 2, h = ISL.length ? terrainH(x, z) : -60, d = clamp(-h / 80, 0, 1), k = (j * N + i) * 4;
    data[k] = Math.round(d * 255); data[k + 3] = 255;
    const land = h > 0; img.data[k] = land ? 120 + Math.min(80, h * .4) : lerp(30, 12, d); img.data[k + 1] = land ? 118 + Math.min(70, h * .3) : lerp(70, 28, d); img.data[k + 2] = land ? 96 + Math.min(60, h * .3) : lerp(86, 48, d); img.data[k + 3] = 255;
  }
  mx.putImageData(img, 0, 0); minimapImg = mc;
  if (depthTex) depthTex.dispose();
  depthTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter; depthTex.needsUpdate = true; U.uDepth.value = depthTex;
  setSky(skyId || M.sky);
  setSea(sea != null ? sea : M.sea, M.wind);
  U.uFoam.value = clamp(WAVES.sea * .55, .1, 1);
  for (const p of PORTS) p.grp.traverse(o => { if (o.userData.light) o.visible = SKY.el < 12; });
}
function envUpdate(dt) {
  simT += dt; U.uT.value = simT;
  U.uCam.value.copy(camera.position); U.uCenter.value.set(camera.position.x, 0, camera.position.z);
  sky.position.copy(camera.position);
}
