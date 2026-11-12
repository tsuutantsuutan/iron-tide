'use strict';
/* ================= effects: particles, wakes, foam decals, flashes, shake ================= */
const PU = { uSunV: { value: new V3() }, uSunC: { value: new V3() }, uAmbC: { value: new V3() }, uFogCol: U.uFogCol, uFogD: U.uFogD, uCamP: U.uCam };
class PSys {
  constructor(max, additive) {
    this.max = max; this.n = 0; this.add = additive;
    const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    this.aPos = new Float32Array(max * 3); this.aCol = new Float32Array(max * 4); this.aSR = new Float32Array(max * 3);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.aPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(this.aCol, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iSR', new THREE.InstancedBufferAttribute(this.aSR, 3).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0; this.g = g;
    // particle state
    const F = n => new Float32Array(max * n);
    this.p = F(3); this.v = F(3); this.life = F(1); this.max0 = F(1); this.s0 = F(1); this.s1 = F(1); this.c0 = F(3); this.c1 = F(3); this.a0 = F(1); this.drag = F(1); this.grav = F(1); this.rot = F(1); this.rv = F(1); this.seed = F(1); this.fin = F(1);
    this.order = new Uint32Array(max); this.dist = new Float32Array(max);
    const mat = new THREE.ShaderMaterial({
      uniforms: PU, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
      vertexShader: `attribute vec3 iPos; attribute vec4 iCol; attribute vec3 iSR; varying vec2 vUv; varying vec4 vCol; varying float vSeed; varying float vFog; varying vec2 vRot;
        uniform float uFogD; uniform vec3 uCamP;
        void main(){ vec3 cr = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); vec3 cu = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          float c = cos(iSR.y), s = sin(iSR.y); vec2 q = vec2(c*position.x - s*position.y, s*position.x + c*position.y) * iSR.x;
          vec3 wp = iPos + cr*q.x + cu*q.y; vUv = uv; vCol = iCol; vSeed = iSR.z; vRot = vec2(c, s);
          float d = length(iPos - uCamP); vFog = 1.0 - exp(-pow(uFogD*d, 2.0));
          gl_Position = projectionMatrix*viewMatrix*vec4(wp, 1.0); }`,
      fragmentShader: (additive ? '' : 'uniform vec3 uSunV; uniform vec3 uSunC; uniform vec3 uAmbC;') + `uniform vec3 uFogCol; varying vec2 vUv; varying vec4 vCol; varying float vSeed; varying float vFog; varying vec2 vRot;
        float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        float vn(vec2 x){ vec2 i=floor(x), f=fract(x); vec2 u=f*f*(3.-2.*f); return mix(mix(h1(i),h1(i+vec2(1,0)),u.x), mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),u.x), u.y); }
        void main(){ vec2 p = vUv*2.0-1.0; float r = length(p);
          float n = vn(vUv*2.6 + vSeed*13.0)*0.6 + vn(vUv*5.3 - vSeed*7.0)*0.4;
          float a = smoothstep(1.0, 0.15, r + (n-0.5)*0.55);
          ${additive ? `vec3 col = vCol.rgb * a * vCol.a * (1.0 - vFog*0.7); gl_FragColor = vec4(col, 1.0);` :
          `a *= vCol.a; if (a < 0.003) discard;
          vec2 rp = vec2(vRot.x*p.x + vRot.y*p.y, -vRot.y*p.x + vRot.x*p.y);
          vec3 nrm = normalize(vec3(rp, sqrt(max(0.0, 1.0 - dot(rp,rp))) + 0.25));
          float l = clamp(dot(nrm, uSunV)*0.55 + 0.5, 0.0, 1.0);
          vec3 col = vCol.rgb * (uAmbC + uSunC*l) * (0.85 + 0.3*n);
          col = mix(col, uFogCol, vFog); gl_FragColor = vec4(col, a);`}
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 20 : 10; scene.add(this.mesh);
  }
  // p: position, v: velocity, life, size start/end, colours start/end, alpha, drag, gravity (+ = falls, - = rises)
  emit(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, a0, drag = 0, grav = 0, fin = .08) {
    if (this.n >= this.max) { // recycle the oldest-ish slot
      let k = (Math.random() * this.n) | 0; this.kill(k);
    }
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = 0; this.max0[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0; this.drag[i] = drag; this.grav[i] = grav; this.fin[i] = fin;
    this.c0[i * 3] = c0[0]; this.c0[i * 3 + 1] = c0[1]; this.c0[i * 3 + 2] = c0[2]; this.c1[i * 3] = c1[0]; this.c1[i * 3 + 1] = c1[1]; this.c1[i * 3 + 2] = c1[2];
    this.rot[i] = Math.random() * 6.283; this.rv[i] = (Math.random() - .5) * .4; this.seed[i] = Math.random();
  }
  kill(i) {
    const j = --this.n; if (i === j) return;
    for (const [arr, n] of [[this.p, 3], [this.v, 3], [this.c0, 3], [this.c1, 3]]) for (let k = 0; k < n; k++) arr[i * n + k] = arr[j * n + k];
    for (const arr of [this.life, this.max0, this.s0, this.s1, this.a0, this.drag, this.grav, this.rot, this.rv, this.seed, this.fin]) arr[i] = arr[j];
  }
  update(dt) {
    const wx = U.uWind.value.x * 3, wz = U.uWind.value.y * 3;
    for (let i = 0; i < this.n; i++) {
      this.life[i] += dt; if (this.life[i] >= this.max0[i]) { this.kill(i); i--; continue; }
      const d = Math.exp(-this.drag[i] * dt), k = i * 3;
      this.v[k] = this.v[k] * d + wx * (1 - d) * .5; this.v[k + 1] = this.v[k + 1] * d - this.grav[i] * G * dt; this.v[k + 2] = this.v[k + 2] * d + wz * (1 - d) * .5;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      if (this.grav[i] > 0 && this.p[k + 1] < -2) { this.life[i] = this.max0[i]; } // spray re-enters the sea
      this.rot[i] += this.rv[i] * dt;
    }
    // sort back-to-front for normal blending
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, n = this.n;
    for (let i = 0; i < n; i++) { this.order[i] = i; const dx = this.p[i * 3] - cx, dy = this.p[i * 3 + 1] - cy, dz = this.p[i * 3 + 2] - cz; this.dist[i] = dx * dx + dy * dy + dz * dz; }
    const ord = this.order.subarray(0, n); if (!this.add) ord.sort((a, b) => this.dist[b] - this.dist[a]);
    for (let o = 0; o < n; o++) {
      const i = ord[o], t = this.life[i] / this.max0[i], k = i * 3;
      this.aPos[o * 3] = this.p[k]; this.aPos[o * 3 + 1] = this.p[k + 1]; this.aPos[o * 3 + 2] = this.p[k + 2];
      const e = 1 - Math.pow(1 - t, 2.2);
      this.aSR[o * 3] = lerp(this.s0[i], this.s1[i], e); this.aSR[o * 3 + 1] = this.rot[i]; this.aSR[o * 3 + 2] = this.seed[i];
      this.aCol[o * 4] = lerp(this.c0[k], this.c1[k], t); this.aCol[o * 4 + 1] = lerp(this.c0[k + 1], this.c1[k + 1], t); this.aCol[o * 4 + 2] = lerp(this.c0[k + 2], this.c1[k + 2], t);
      this.aCol[o * 4 + 3] = this.a0[i] * Math.min(1, t / this.fin[i]) * Math.pow(1 - t, 1.3);
    }
    this.g.instanceCount = n;
    for (const a of ['iPos', 'iCol', 'iSR']) this.g.attributes[a].needsUpdate = true;
  }
}
let SMOKE, GLOW;
function initFx() {
  const q = Q().parts; SMOKE = new PSys(Math.round(7000 * q), false); GLOW = new PSys(Math.round(3000 * q), true);
}
function fxUpdate(dt) {
  const sd = SUN.userData.dir || U.uSunDir.value; PU.uSunV.value.copy(sd).transformDirection(camera.matrixWorldInverse);
  const night = SKY.night ? .25 : 1; PU.uSunC.value.copy(U.uSunCol.value).multiplyScalar(.95 * night); PU.uAmbC.value.copy(U.uZenith.value).multiplyScalar(1.1).add(_v1.copy(U.uHorizon.value).multiplyScalar(.45));
  SMOKE.update(dt); GLOW.update(dt); WAKE.update(dt); flashUpdate(dt); shellMeshUpdate();
}

/* ---------- wakes & foam decals (follow the waves in the vertex shader) ---------- */
const WAKE = {
  max: 24000, trails: new Map(), decals: [],
  init() {
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(this.max * 2); this.uv = new Float32Array(this.max * 2); this.al = new Float32Array(this.max * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aUV', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(this.al, 2).setUsage(THREE.DynamicDrawUsage)); this.g = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: GLSL_COMMON + `attribute vec2 aUV; attribute vec2 aA; varying vec2 vUv; varying vec2 vA; varying vec3 vW; uniform vec3 uCam; uniform float uSpK;
        void main(){ vec2 p = position.xy; float sp = length(p - uCam.xz)*uSpK + 0.3; vec3 d = gerstnerD(p, sp);
          vW = vec3(p.x + d.x, d.y + 0.25, p.y + d.z); vUv = aUV; vA = aA; gl_Position = projectionMatrix*viewMatrix*vec4(vW,1.0); }`,
      fragmentShader: GLSL_COMMON + `uniform vec3 uCam; uniform vec3 uFogCol; uniform float uFogD; varying vec2 vUv; varying vec2 vA; varying vec3 vW;
        void main(){ float a;
          float n = vnoise(vec2(vUv.x*2.5, vUv.y*0.045)+vA.y*7.0)*0.55 + vnoise(vW.xz*0.09 + uT*0.05)*0.45;
          if (vA.y < 0.5) { float ac = abs(vUv.x); a = (1.0 - smoothstep(0.55, 1.0, ac)) * smoothstep(0.25, 0.75, n + 0.15 - ac*0.2); }
          else if (vA.y < 1.5) { float r = length(vUv); a = smoothstep(1.0, 0.75, r) * smoothstep(0.2, 0.6, n + r*0.3); }
          else { float r = length(vUv); a = smoothstep(1.0, 0.85, r) * smoothstep(0.55, 0.95, r) * 0.9; }
          a *= vA.x; if (a < 0.004) discard;
          vec3 col = uSunCol*max(uSunDir.y,0.08)*0.9 + uZenith*0.7 + uHorizon*0.3;
          if (vA.y > 1.5) col *= 0.35;
          float d = length(uCam - vW); col = mix(col, uFogCol, 1.0 - exp(-pow(uFogD*d, 2.0)));
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = -5; scene.add(this.mesh);
  },
  // trail sample from a ship each ~0.5 s
  addPoint(id, x, z, hx, hz, beam, spd, isBow) {
    let t = this.trails.get(id); if (!t) { t = []; this.trails.set(id, t); }
    t.push({ x, z, rx: -hz, rz: hx, beam, spd, age: 0 });
    if (t.length > 110) t.shift();
  },
  decal(x, z, r0, r1, life, alpha, kind = 1) { if (this.decals.length > 220) this.decals.shift(); this.decals.push({ x, z, r0, r1, life, age: 0, alpha, kind }); },
  update(dt) {
    let v = 0; const P = this.pos, UV = this.uv, A = this.al, max = this.max - 8;
    const quad = (ax, az, bx, bz, cx, cz, dx, dz, u0, u1, v0, v1, al0, al1, k) => { // a,b at row 0 ; c,d at row 1 (two triangles)
      if (v + 6 > max) return;
      const pts = [[ax, az, u0, v0, al0], [bx, bz, u1, v0, al0], [cx, cz, u0, v1, al1], [bx, bz, u1, v0, al0], [dx, dz, u1, v1, al1], [cx, cz, u0, v1, al1]];
      for (const p of pts) { P[v * 2] = p[0]; P[v * 2 + 1] = p[1]; UV[v * 2] = p[2]; UV[v * 2 + 1] = p[3]; A[v * 2] = p[4]; A[v * 2 + 1] = k; v++; }
    };
    for (const [id, t] of this.trails) {
      for (const p of t) p.age += dt;
      while (t.length && t[0].age > 60) t.shift();
      if (!t.length) { this.trails.delete(id); continue; }
      for (let i = 0; i < t.length - 1; i++) {
        const a = t[i], b = t[i + 1]; if (Math.hypot(a.x - b.x, a.z - b.z) > 120) continue;
        const wa = a.beam * (.55 + a.age * .045), wb = b.beam * (.55 + b.age * .045);
        const aa = clamp(a.spd / 9, 0, 1) * Math.pow(Math.max(0, 1 - a.age / 60), 1.5) * 1.3, ab = clamp(b.spd / 9, 0, 1) * Math.pow(Math.max(0, 1 - b.age / 60), 1.5) * 1.3;
        const va = i * 9.0, vb = (i + 1) * 9.0;
        quad(a.x - a.rx * wa, a.z - a.rz * wa, a.x + a.rx * wa, a.z + a.rz * wa, b.x - b.rx * wb, b.z - b.rz * wb, b.x + b.rx * wb, b.z + b.rz * wb, -1, 1, va, vb, aa, ab, 0);
        // Kelvin arms: drift outward at ~0.35 × speed
        for (const s of [-1, 1]) {
          const oa = a.beam * .5 + a.spd * .35 * a.age, ob = b.beam * .5 + b.spd * .35 * b.age, w = 2.5 + a.age * .25;
          const ka = aa * .55 * Math.max(0, 1 - a.age / 40), kb = ab * .55 * Math.max(0, 1 - b.age / 40);
          const ax = a.x + a.rx * oa * s, az = a.z + a.rz * oa * s, bx = b.x + b.rx * ob * s, bz = b.z + b.rz * ob * s;
          quad(ax - a.rx * w, az - a.rz * w, ax + a.rx * w, az + a.rz * w, bx - b.rx * w, bz - b.rz * w, bx + b.rx * w, bz + b.rz * w, -1, 1, va, vb, ka, kb, 0);
        }
      }
    }
    for (let i = 0; i < this.decals.length; i++) {
      const d = this.decals[i]; d.age += dt; if (d.age > d.life) { this.decals.splice(i--, 1); continue; }
      const t = d.age / d.life, r = lerp(d.r0, d.r1, 1 - Math.pow(1 - t, 3)), al = d.alpha * (1 - t) * Math.min(1, d.age * 4);
      quad(d.x - r, d.z - r, d.x + r, d.z - r, d.x - r, d.z + r, d.x + r, d.z + r, -1, 1, -1, 1, al, al, d.kind);
    }
    this.g.setDrawRange(0, v);
    for (const a of ['position', 'aUV', 'aA']) { this.g.attributes[a].needsUpdate = true; }
  },
  clear() { this.trails.clear(); this.decals.length = 0; }
};

/* ---------- flashes (pooled point lights) & screen shake ---------- */
const FLASHES = [new THREE.PointLight(0xffc080, 0, 2500, 2), new THREE.PointLight(0xffc080, 0, 2500, 2)];
for (const l of FLASHES) scene.add(l);
let flashIdx = 0;
function flashLight(p, power, dur = .25, col = 0xffb070) { const l = FLASHES[flashIdx++ % FLASHES.length]; l.position.copy(p); l.color.setHex(col); l.userData.p = power; l.userData.t = 0; l.userData.d = dur; l.intensity = power; }
function flashUpdate(dt) { for (const l of FLASHES) { if (!l.userData.p) continue; l.userData.t += dt; const k = 1 - l.userData.t / l.userData.d; l.intensity = k > 0 ? l.userData.p * k * k : 0; if (k <= 0) l.userData.p = 0; } }
const SHAKE = { a: 0 };
function shake(a) { SHAKE.a = Math.min(3, SHAKE.a + a); }
function screenFlash(a) { const el = $('#flash'); el.style.transition = 'none'; el.style.opacity = Math.min(.6, a); requestAnimationFrame(() => { el.style.transition = 'opacity .6s'; el.style.opacity = 0; }); }

/* ---------- shells as faint glowing streaks ---------- */
let shellMesh = null; const SHELL_MAX = 600;
function initShellMesh() {
  const g = new THREE.CylinderGeometry(.35, .35, 1, 5, 1); g.rotateX(Math.PI / 2);
  shellMesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.6, 1.1), toneMapped: false, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }), SHELL_MAX);
  shellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); shellMesh.frustumCulled = false; shellMesh.count = 0; scene.add(shellMesh);
}
const _sm = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _ss = new V3(), _sz = new V3(0, 0, 1);
function shellMeshUpdate() {
  if (!shellMesh) return; let n = 0;
  for (const s of SHELLS) { if (!s.alive || n >= SHELL_MAX) continue; if (!SET.tracer && !s.mine) continue; if (s.sec && !s.mine) continue;
    _v1.set(s.vx, s.vy, s.vz); const sp = _v1.length(); _v1.multiplyScalar(1 / sp); _sq.setFromUnitVectors(_sz, _v1);
    const d = camera.position.distanceTo(_v2.set(s.x, s.y, s.z)), w = Math.max(1, d / 900) * (s.cal / 300 + .4);
    _ss.set(w, w, Math.max(6, sp * .03) * (s.mine ? 1 : .7)); _sm.compose(_v2, _sq, _ss); shellMesh.setMatrixAt(n++, _sm); }
  shellMesh.count = n; shellMesh.instanceMatrix.needsUpdate = true;
}

/* ---------- compound effects ---------- */
const C = { white: [.92, .94, .96], mist: [.82, .86, .9], gunA: [.62, .57, .5], gunB: [.66, .64, .61], black: [.05, .05, .05], dark: [.16, .15, .14], gray: [.38, .38, .38], fire0: [9, 4.2, 1.3], fire1: [2.4, .5, .1], flash0: [14, 9, 4], flash1: [5, 1.6, .3], spark: [8, 4, 1.2], steam: [.75, .78, .8], funnel: [.3, .29, .28], dirt: [.33, .27, .2] };
function fxScale() { return Q().parts; }
// big naval gun muzzle blast (realistic: brief fireball, then a huge cloud of propellant smoke pushed forward)
function fxMuzzle(p, d, cal, big) {
  const s = cal / 460, q = fxScale();
  // blinding fireball pushed out of the muzzle
  for (let i = 0; i < 9; i++) { const sp = rand(40, 260) * s + 20, f = i / 8; GLOW.emit(p.x + d.x * f * 30 * s, p.y + d.y * f * 30 * s, p.z + d.z * f * 30 * s, d.x * sp, d.y * sp, d.z * sp, rand(.14, .32), (10 + f * 10) * s + 2, (34 + f * 30) * s + 5, C.flash0, C.flash1, 1, 4.5, 0); }
  GLOW.emit(p.x + d.x * 8 * s, p.y + d.y * 8 * s, p.z + d.z * 8 * s, 0, 0, 0, .1, 30 * s + 6, 60 * s + 10, [26, 18, 9], C.flash1, 1);
  // propellant smoke: a dense tan cloud that rolls forward, swells and drifts
  const n = Math.round((big ? 16 : 5) * q) + 2;
  for (let i = 0; i < n; i++) { const t = Math.random(), sp = lerp(20, 330, t * t) * s + 12, sx = rand(-1, 1) * 16 * s, sy = rand(-.2, 1) * 12 * s, sz = rand(-1, 1) * 16 * s;
    const c0 = i % 4 === 0 ? [.42, .38, .33] : C.gunA;
    SMOKE.emit(p.x + d.x * rand(4, 30) * s, p.y + d.y * rand(4, 30) * s, p.z + d.z * rand(4, 30) * s, d.x * sp + sx, d.y * sp + sy + 3, d.z * sp + sz, rand(12, 22) * (big ? 1 : .55), (12 + 10 * Math.random()) * s + 2, rand(80, 150) * s + 10, c0, C.gunB, rand(.6, .85), 1.9, -.015, .02); }
  if (big) flashLight(p, 60 * s * s + 10, .25);
}
function fxBlastWave(x, z, r, a = .5) { WAKE.decal(x, z, r * .2, r, .8, a, 2); }
// splash column sized by calibre (46 cm shells threw water ~100 m into the air)
function fxSplash(x, z, cal, dye) {
  const H = clamp(cal * .2, 6, 120), q = fxScale(), y = waveH(x, z), v0 = Math.sqrt(2 * G * H), col = dye || C.white;
  const n = Math.round((cal > 300 ? 26 : cal > 150 ? 14 : 7) * q) + 2;
  for (let i = 0; i < n; i++) { const t = Math.random(), r = H * .05 * Math.sqrt(Math.random()), a = Math.random() * 6.283, v = v0 * lerp(.45, 1.02, Math.pow(t, .6));
    SMOKE.emit(x + Math.cos(a) * r, y + 1, z + Math.sin(a) * r, Math.cos(a) * rand(1, 4) * H * .03, v, Math.sin(a) * rand(1, 4) * H * .03, 2 * v / G * 1.05, H * .1 + 1, H * .3 + 2, col, C.mist, rand(.55, .85), .05, 1, .02); }
  for (let i = 0; i < Math.round(8 * q) + 2; i++) { const a = Math.random() * 6.283, sp = rand(5, 18) * H * .04;
    SMOKE.emit(x, y + H * .1, z, Math.cos(a) * sp, rand(.5, 2) * H * .05, Math.sin(a) * sp, rand(5, 9), H * .2 + 2, H * .7 + 4, C.mist, C.steam, .3, .9, -.01, .1); }
  WAKE.decal(x, z, H * .12, H * .55, 22, .75, 1);
  WAKE.decal(x, z, H * .3, H * 1.4, 2.2, .35, 2);
}
// shell hitting a ship: flash, fireball, debris, smoke
function fxHit(p, cal, citadel) {
  const s = clamp(cal / 400, .25, 1.4), q = fxScale();
  GLOW.emit(p.x, p.y, p.z, 0, 0, 0, .18, 10 * s, 40 * s, [18, 12, 6], C.fire1, 1);
  for (let i = 0; i < Math.round(10 * q * s) + 3; i++) GLOW.emit(p.x, p.y, p.z, rand(-1, 1) * 18 * s, rand(-.2, 1) * 22 * s, rand(-1, 1) * 18 * s, rand(.4, 1), 5 * s, 16 * s, C.fire0, C.fire1, 1, 1.4, -.05);
  for (let i = 0; i < Math.round(14 * q * s) + 3; i++) GLOW.emit(p.x, p.y, p.z, rand(-1, 1) * 40, rand(5, 45), rand(-1, 1) * 40, rand(1, 2.4), .9, .4, C.spark, [2, .5, .1], 1, .3, 1, .01);
  for (let i = 0; i < Math.round(8 * q * s) + 2; i++) SMOKE.emit(p.x, p.y, p.z, rand(-1, 1) * 6, rand(3, 12), rand(-1, 1) * 6, rand(6, 12), 6 * s + 3, 40 * s + 10, C.dark, C.gray, .7, .7, -.04, .05);
  flashLight(p, (citadel ? 60 : 25) * s, .3, 0xff9050);
}
function fxGroundHit(p, cal) { const s = clamp(cal / 400, .25, 1.4);
  GLOW.emit(p.x, p.y, p.z, 0, 0, 0, .2, 10 * s, 30 * s, [14, 9, 4], C.fire1, 1);
  for (let i = 0; i < 12; i++) SMOKE.emit(p.x, p.y, p.z, rand(-1, 1) * 15 * s, rand(10, 40) * s, rand(-1, 1) * 15 * s, rand(4, 9), 6 * s, 35 * s + 6, C.dirt, C.gray, .75, .9, .4, .03); }
function fxFire(p, s, dt) {
  if (Math.random() < dt * 22) GLOW.emit(p.x + rand(-2, 2) * s, p.y, p.z + rand(-2, 2) * s, rand(-1, 1), rand(4, 9) * s, rand(-1, 1), rand(.5, 1.1), 4 * s, 9 * s, C.fire0, C.fire1, .9, .6, -.1, .1);
  if (Math.random() < dt * 9) SMOKE.emit(p.x, p.y + 4 * s, p.z, rand(-1, 1), rand(6, 11), rand(-1, 1), rand(14, 24), 5 * s, 55 * s, C.black, C.dark, .65, .25, -.02, .06);
}
function fxMagazine(p) { // magazine detonation: blinding flash and a towering mushroom cloud
  GLOW.emit(p.x, p.y + 20, p.z, 0, 0, 0, .6, 80, 420, [30, 20, 10], [6, 2, .4], 1);
  for (let i = 0; i < 40; i++) GLOW.emit(p.x + rand(-30, 30), p.y + rand(0, 40), p.z + rand(-30, 30), rand(-1, 1) * 60, rand(30, 160), rand(-1, 1) * 60, rand(1, 3), 30, 90, C.fire0, C.fire1, 1, .8, .1);
  for (let i = 0; i < 70; i++) { const up = rand(40, 140); SMOKE.emit(p.x + rand(-40, 40), p.y + rand(0, 30), p.z + rand(-40, 40), rand(-1, 1) * 18, up, rand(-1, 1) * 18, rand(25, 45), 30, rand(160, 320), i % 3 ? C.dark : C.gray, C.gray, .8, .35, -.01, .02); }
  for (let i = 0; i < 40; i++) GLOW.emit(p.x, p.y + 10, p.z, rand(-1, 1) * 120, rand(40, 160), rand(-1, 1) * 120, rand(2, 5), 3, 1, C.spark, [2, .4, .1], 1, .2, 1, .01);
  flashLight(p, 400, 1.6, 0xffa060); WAKE.decal(p.x, p.z, 30, 500, 3, .5, 2);
}
