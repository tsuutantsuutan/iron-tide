'use strict';
/* ================= ships in battle: physics, gunnery, shells, torpedoes, damage ================= */
const FLEET = [];       // all Ship instances in the battle
const SHELLS = [], TORPS = [];
const FIX = 1 / 60;
const TELE = [{ n: '後進', f: -.3 }, { n: '停止', f: 0 }, { n: '微速', f: .25 }, { n: '半速', f: .45 }, { n: '原速', f: .65 }, { n: '第一戦速', f: .85 }, { n: '最大戦速', f: 1 }];
const RUD = [{ n: '取舵一杯', v: -1 }, { n: '取舵', v: -.5 }, { n: '舵中央', v: 0 }, { n: '面舵', v: .5 }, { n: '面舵一杯', v: 1 }];
const RIB = { cit: '重要区画貫通', pen: '貫通', over: '過貫通', ric: '跳弾', non: '非貫通', he: '命中', fire: '火災発生', flood: '浸水発生', kill: '撃沈', torp: '魚雷命中', ground: '' };
const HOOK = { kill: null, hit: null, ribbon: null, feed: null };

class Ship {
  constructor(type, o = {}) {
    const S = this.S = SHIPS[type]; this.type = type;
    this.id = o.id || ('N' + Math.random().toString(36).slice(2, 7)); this.team = o.team || 0; this.ctrl = o.ctrl || 'ai';
    this.name = o.name || S.n; this.label = o.label || S.n;
    const M = buildShipModel(S); this.root = M.root; this.body = M.body; this.tur = M.tur; this.sec = M.sec; this.torp = M.torp; scene.add(this.root);
    this.x = o.x || 0; this.z = o.z || 0; this.h = o.h || 0; this.spd = o.spd != null ? o.spd : 0; this.tele = o.tele != null ? o.tele : 1; this.rudI = 2; this.rud = 0;
    this.maxHp = Math.round(S.hp * (o.hpMul || 1)); this.hp = this.maxHp;
    this.fires = []; this.floods = []; this.dc = 0; this.dcOn = 0; this.rudJam = 0; this.engDis = 0;
    this.alive = true; this.sinkT = 0; this.removed = false; this.mag = false;
    this.heave = 0; this.pitch = 0; this.roll = 0; this.list = 0; this.trim = 0; this.rk = 0; this.rkV = 0;
    this.ammo = 0; this.salvo = 0; this.aim = new V3(); this.aimOk = false; this.aimR = 0;
    this.dmgBy = {}; this.st = { dmg: 0, hits: 0, kills: 0, fired: 0, cit: 0 };
    this.wakeT = 0; this.smokeT = 0; this.reloadMul = o.reloadMul || 1; this.acc = o.acc || 1; this.dmgMul = o.dmgMul || 1;
    this.ai = o.ai || null; this.boss = !!o.boss; this.static = S.kn === 0; this.killer = null; this.events = [];
    if (S.cls === 'FT') this.root.position.y = o.y || 0;
    this.place(); FLEET.push(this);
  }
  get fx() { return Math.sin(this.h); } get fz() { return -Math.cos(this.h); }
  get maxV() { return this.S.kn * KN; }
  get sunk() { return !this.alive; }
  place() {
    this.root.position.set(this.x, this.static ? this.root.position.y : this.heave, this.z);
    this.root.rotation.set(this.pitch + this.trim, -this.h, this.roll + this.list, 'YXZ'); this.root.updateMatrixWorld(true);
  }
  // local (ship frame) → world
  toWorld(lx, ly, lz, out = new V3()) { const c = Math.cos(this.h), s = Math.sin(this.h); return out.set(this.x + lx * c - lz * s, ly + this.heave, this.z + lx * s + lz * c); }
  toLocal(x, y, z, out = new V3()) { const c = Math.cos(this.h), s = Math.sin(this.h), dx = x - this.x, dz = z - this.z; return out.set(dx * c + dz * s, y - this.heave, -dx * s + dz * c); }

  /* ---------- movement ---------- */
  physics(dt) {
    const S = this.S; if (this.static) { this.place(); return; }
    if (this.alive) {
      const tgt = (this.engDis > 0 ? 0 : TELE[this.tele].f * this.maxV) * (1 - .13 * Math.abs(this.rud)) * (this.floods.length ? .9 : 1);
      const acc = this.maxV / S.accT; this.spd = this.spd < tgt ? Math.min(tgt, this.spd + acc * dt) : Math.max(tgt, this.spd - acc * .75 * dt);
      const cmd = this.rudJam > 0 ? this.rud : RUD[this.rudI].v; this.rud += clamp(cmd - this.rud, -2 / S.rudT * dt, 2 / S.rudT * dt);
    } else { this.spd *= Math.exp(-dt * .08); }
    const R = S.turnD / 2, eff = clamp(Math.abs(this.spd) / (this.maxV * .35 + .1), 0, 1);
    const om = Math.sign(this.spd || 1) * (Math.abs(this.spd) / R) * this.rud * Math.max(eff, .25) + (Math.abs(this.spd) < .5 ? this.rud * .004 : 0);
    this.h = wrapPi(this.h + om * dt); this.om = om;
    const nx = this.x + this.fx * this.spd * dt, nz = this.z + this.fz * this.spd * dt;
    // grounding
    const bowX = nx + this.fx * S.L * .48 * Math.sign(this.spd || 1), bowZ = nz + this.fz * S.L * .48 * Math.sign(this.spd || 1);
    const tb = terrainH(bowX, bowZ), tc = terrainH(nx, nz);
    if (tb > -S.T * .6 || tc > -S.T * .6) { if (Math.abs(this.spd) > 3 && this.alive && !this.grounded) { this.applyDamage(this.maxHp * .01 * Math.abs(this.spd) / 5, null, 'ground'); } this.grounded = 1; this.spd *= -.15; }
    else { this.grounded = 0; this.x = nx; this.z = nz; }
    const lim = MAP_HALF - 150; if (Math.abs(this.x) > lim || Math.abs(this.z) > lim) { this.x = clamp(this.x, -lim, lim); this.z = clamp(this.z, -lim, lim); this.spd *= .97; this.atEdge = 1; } else this.atEdge = 0;
    this.seakeep(dt);
  }
  seakeep(dt) {
    const S = this.S, L = S.L, B = S.B, c = this.fx, s = this.fz, rx = -s, rz = c;
    const hb = waveH(this.x + c * L * .4, this.z + s * L * .4), hs = waveH(this.x - c * L * .4, this.z - s * L * .4);
    const hp = waveH(this.x - rx * B * .5, this.z - rz * B * .5), hst = waveH(this.x + rx * B * .5, this.z + rz * B * .5), h0 = waveH(this.x, this.z);
    const tau = .9 + L / 110, k = 1 - Math.exp(-dt / tau);
    const sinkY = this.alive ? 0 : -Math.pow(this.sinkT / 75, 2.2) * (S.fb[1] + S.T + 40);
    this.heave += ((hb + hs + hp + hst + h0 * 2) / 6 * .85 + sinkY - this.heave) * (this.alive ? k : 1);
    this.pitch += (Math.atan2(hb - hs, L * .8) - this.pitch) * k;
    const heel = -this.rud * clamp(Math.abs(this.spd) / this.maxV, 0, 1) * (S.cls === 'DD' ? 6 : 3.2) * DEG;
    this.rkV += (-this.rk * 1.4 - this.rkV * .9) * dt; this.rk += this.rkV * dt;
    this.roll += (Math.atan2(hst - hp, B * 1.3) + heel - this.roll) * k * .8;
    if (!this.alive) { this.list += (this.sinkList - this.list) * dt * .05; this.trim += (this.sinkTrim - this.trim) * dt * .04; }
    else { const fl = this.floods.length * 2.2 * DEG * (this.floodSide || 1); this.list += (fl - this.list) * dt * .2; }
    this.root.position.set(this.x, this.heave, this.z);
    this.root.rotation.set(this.pitch + this.trim, -this.h, this.roll + this.list + this.rk, 'YXZ'); this.root.updateMatrixWorld(true);
  }

  /* ---------- gunnery ---------- */
  mountWorld(m, out) { return m.t.root.getWorldPosition(out); }
  aimMounts(list, P, dt, isMain) {
    let anyR = false;
    for (const m of list) {
      const W = m.W; this.mountWorld(m, _v1); const dx = P.x - _v1.x, dz = P.z - _v1.z, r = Math.hypot(dx, dz);
      const az = Math.atan2(dx, -dz); let ly = wrapPi(az - this.h - m.rest);
      m.blocked = Math.abs(ly) > m.lim; ly = clamp(ly, -m.lim, m.lim);
      if (m.beam) m.blocked = Math.abs(wrapPi(az - this.h)) < 28 * DEG || Math.abs(wrapPi(az - this.h)) > 152 * DEG;
      let cl = wrapPi(m.yaw - m.rest), d = ly - cl; const step = (W.trav || 8) * DEG * dt * (m.dis > 0 ? 0 : 1); cl += clamp(d, -step, step); m.yaw = m.rest + cl;
      m.err = Math.abs(ly - cl);
      if (!m.torpOnly) { const b = isMain !== null ? ballFor(W, Math.max(50, r)) : null; m.oor = !b; const te = b ? b.e : (W.ev || 45) * DEG * .9;
        m.el += clamp(te - m.el, -7 * DEG * dt, 7 * DEG * dt); m.elErr = Math.abs(te - m.el); m.r = r; m.b = b; if (b) anyR = true; }
      m.ready = m.rl <= 0 && m.dis <= 0 && !m.blocked && m.err < .5 * DEG && (m.elErr == null || m.elErr < .35 * DEG) && !m.oor;
      m.t.root.rotation.y = -m.yaw; if (m.t.pivot && !m.torpOnly) m.t.pivot.rotation.x = m.el;
    }
    return anyR;
  }
  reloadTick(dt) { for (const m of this.tur) { if (m.rl > 0) m.rl -= dt; if (m.dis > 0) m.dis -= dt; } for (const m of this.sec) { if (m.rl > 0) m.rl -= dt; if (m.dis > 0) m.dis -= dt; } for (const m of this.torp) { if (m.rl > 0) m.rl -= dt; } }
  // fire every ready main turret at the current aim point. returns turrets fired
  fireMain(only) {
    if (!this.alive || !this.aimOk) return 0; let n = 0; const ev = [];
    this.tur.forEach((m, ti) => { if (!m.ready || (only != null && only !== ti)) return; n++;
      this.fireMount(m, 'm', this.aim, this.ammo, ti * .14, ev); m.rl = m.W.rl * this.reloadMul; });
    if (n) { this.salvo++; this.st.fired += n; this.events.push(...ev); if (this.S.main.cal >= 300) this.rk += (this.aimSide() * .004 * n * this.S.main.cal / 460); }
    return n;
  }
  aimSide() { const a = wrapPi(Math.atan2(this.aim.x - this.x, -(this.aim.z - this.z)) - this.h); return a > 0 ? -1 : 1; }
  fireMount(m, key, P, ammo, delay, ev) {
    const W = m.W, rng = Math.random, r = m.r, sig = (W.sig || 1) * this.acc * (key === 'm' ? 1 : 2.2);
    m.t.pivot.updateMatrixWorld(true);
    const isSec = key !== 'm';
    m.t.muzzles.forEach((mz, k) => {
      const rr = clamp(r + gauss(rng) * (r * .011 + 22) * sig, 60, ballTable(W).maxR), b = ballFor(W, rr) || m.b;
      const az = this.h + m.yaw + gauss(rng) * .0021 * sig, el = b ? b.e : m.el;
      const p = m.t.pivot.localToWorld(_v2.copy(mz));
      const vx = Math.sin(az) * Math.cos(el) * W.mv, vy = Math.sin(el) * W.mv, vz = -Math.cos(az) * Math.cos(el) * W.mv;
      const dl = delay + k * .06 + rand(0, .03);
      const sh = spawnShell(this, W, key, ammo, p.x, p.y, p.z, vx, vy, vz, dl, isSec);
      ev.push([key, ammo, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.z * 10) / 10, Math.round(vx * 10) / 10, Math.round(vy * 10) / 10, Math.round(vz * 10) / 10, Math.round(dl * 100) / 100]);
      if (k === 0) sh.report = true;
    });
  }
  // secondary battery: auto-targets the nearest enemy in range
  secondaries(dt) {
    if (!this.sec.length || !this.alive) return;
    this.secT = (this.secT || 0) - dt;
    if (this.secT <= 0) { this.secT = 1.2; let best = null, bd = 1e9; for (const o of FLEET) { if (!o.alive || !isEnemy(this, o)) continue; const d = Math.hypot(o.x - this.x, o.z - this.z); if (d < bd) { bd = d; best = o; } } this.secTgt = best; this.secD = bd; }
    const T = this.secTgt; const P = _v3;
    if (T && T.alive) { const flight = this.secD / (this.sec[0].W.mv * .75); P.set(T.x + T.fx * T.spd * flight, 0, T.z + T.fz * T.spd * flight); }
    else P.set(this.x + this.fx * 3000, 0, this.z + this.fz * 3000);
    this.aimMounts(this.sec, P, dt, false);
    if (!T || !T.alive) return; const ev = [];
    this.sec.forEach((m, i) => { if (!m.ready || this.secD > m.W.rng) return; this.fireMount(m, 's' + this.secIdx(m), P, 1, rand(0, .3), ev); m.rl = m.W.rl * rand(.9, 1.15); });
    if (ev.length) this.events.push(...ev);
  }
  secIdx(m) { return (this.S.sec || []).indexOf(m.W); }
  fireTorps(P) {
    if (!this.alive || !this.torp.length) return 0; let n = 0; const W = this.S.torp, ev = [];
    for (const m of this.torp) { if (m.rl > 0 || m.blocked || m.err > 2 * DEG) continue; n++; m.rl = W.rl * this.reloadMul;
      const base = this.h + m.yaw, wp = m.t.root.getWorldPosition(_v2);
      for (let k = 0; k < W.n; k++) { const a = base + (k - (W.n - 1) / 2) * 1.6 * DEG; spawnTorp(this, wp.x, wp.z, a, k * .25); ev.push(['t', 0, Math.round(wp.x), 0, Math.round(wp.z), Math.round(a * 1000) / 1000, 0, 0, k * .25]); }
      sfxTorpLaunch(wp); }
    if (n) this.events.push(...ev);
    return n;
  }

  /* ---------- damage ---------- */
  applyDamage(d, attacker, kind) {
    if (!this.alive || d <= 0) return 0;
    d = Math.min(this.hp, d * this.dmgMul); this.hp -= d;
    if (attacker) { this.dmgBy[attacker] = (this.dmgBy[attacker] || 0) + d; const A = shipById(attacker); if (A) A.st.dmg += d; }
    if (this.hp <= 0.5) this.kill(attacker, kind === 'cit' && Math.random() < .14);
    return d;
  }
  kill(attacker, mag) {
    if (!this.alive) return; this.alive = false; this.hp = 0; this.killer = attacker; this.sinkT = 0;
    this.sinkList = (Math.random() < .5 ? -1 : 1) * rand(14, 34) * DEG; this.sinkTrim = rand(-7, 7) * DEG;
    if (mag || this.forceMag) { this.mag = true; fxMagazine(this.toWorld(0, 4, -this.S.L * .2)); sfxHit(this.toWorld(0, 0, 0), 900, true); sfxGun(this.toWorld(0, 0, 0), 1400, false); shake(1.2); }
    const A = shipById(attacker); if (A) A.st.kills++;
    HOOK.kill && HOOK.kill(this, A);
  }
  addFire(sec) {
    if (this.dcOn > 0 || this.fires.length >= 4 || this.fires.some(f => f.sec === sec) || !this.alive) return false;
    const S = this.S, lz = sec === 0 ? -S.L * .32 : sec === 1 ? 0 : sec === 2 ? S.L * .3 : S.sty.tz || 0, ly = deckY(S, lz) + (sec === 3 ? 8 : 1.5);
    this.fires.push({ sec, t: 40, p: new V3(rand(-2, 2), ly, lz) }); return true;
  }
  addFlood() { if (this.dcOn > 0 || this.floods.length >= 2 || !this.alive) return false; this.floods.push({ t: 40 }); this.floodSide = this.floodSide || (Math.random() < .5 ? -1 : 1); return true; }
  damageControl() {
    if (this.dc > 0 || !this.alive) return false; if (!this.fires.length && !this.floods.length && this.rudJam <= 0 && this.engDis <= 0 && !this.tur.some(t => t.dis > 0)) return false;
    this.fires = []; this.floods = []; this.rudJam = 0; this.engDis = 0; for (const t of this.tur) t.dis = 0; this.dcOn = 15; this.dc = this.S.cls === 'BB' ? 80 : this.S.cls === 'CA' ? 60 : 40; return true;
  }
  dot(dt) {
    if (this.dc > 0) this.dc -= dt; if (this.dcOn > 0) this.dcOn -= dt; if (this.rudJam > 0) this.rudJam -= dt; if (this.engDis > 0) this.engDis -= dt;
    for (let i = this.fires.length - 1; i >= 0; i--) { const f = this.fires[i]; f.t -= dt; if (f.t <= 0) this.fires.splice(i, 1); else if (this.auth()) this.applyDamage(this.maxHp * .0024 * dt, f.by, 'fire'); }
    for (let i = this.floods.length - 1; i >= 0; i--) { const f = this.floods[i]; f.t -= dt; if (f.t <= 0) this.floods.splice(i, 1); else if (this.auth()) this.applyDamage(this.maxHp * .0042 * dt, f.by, 'flood'); }
  }
  auth() { return this.ctrl === 'player' || ((this.ctrl === 'ai' || this.ctrl === 'static') && !NET.client); }

  /* ---------- visuals ---------- */
  visuals(dt) {
    const S = this.S;
    // wakes
    this.wakeT -= dt; if (this.wakeT <= 0 && !this.static) { this.wakeT = .45; const sp = Math.abs(this.spd); if (sp > .8 && this.sinkT < 20) WAKE.addPoint(this.id, this.x - this.fx * S.L * .44, this.z - this.fz * S.L * .44, this.fx, this.fz, S.B * .5, sp); }
    if (!this.static && Math.abs(this.spd) > 7 && this.alive && Math.random() < dt * 8 * Q().parts) { const p = this.toWorld(rand(-1, 1) * S.B * .2, 1, -S.L * .49); const sp = this.spd;
      for (const side of [-1, 1]) SMOKE.emit(p.x, waveH(p.x, p.z) + 1, p.z, -this.fz * side * sp * .3 + this.fx * sp * .6, rand(2, 5) * sp / 15, this.fx * side * sp * .3 + this.fz * sp * .6, rand(1.2, 2.2), S.B * .12 + 1, S.B * .35 + 3, C.white, C.mist, .45, 1.2, .8, .05); }
    // funnel smoke
    this.smokeT -= dt; if (this.smokeT <= 0 && this.alive && S.sty.funnels) { this.smokeT = .16 / Q().parts;
      for (const f of S.sty.funnels) { const [z, r, rake, hh] = f, y = deckY(S, z) + (S.cls === 'DD' ? 2.6 : 5.2) + hh + 1, zz = z + Math.sin(rake * DEG) * hh; const p = this.toWorld(0, y, zz, _v4);
        const sf = .25 + .75 * clamp(Math.abs(this.spd) / this.maxV, 0, 1); SMOKE.emit(p.x, p.y, p.z, this.fx * this.spd * .6 + rand(-.5, .5), rand(2, 4), this.fz * this.spd * .6 + rand(-.5, .5), rand(10, 16), r * 1.6, r * 9 + 10, C.funnel, C.gray, .22 * sf + .08, .35, -.02, .08); } }
    for (const f of this.fires) { this.body.localToWorld(_v4.copy(f.p)); fxFire(_v4, S.cls === 'DD' ? .6 : 1, dt); }
    if (!this.alive) { this.sinkT += dt; if (Math.random() < dt * 4) { const p = this.toWorld(rand(-.3, .3) * S.B, 4, rand(-.4, .4) * S.L); if (p.y > -5) { SMOKE.emit(p.x, Math.max(p.y, 1), p.z, rand(-2, 2), rand(5, 10), rand(-2, 2), rand(16, 30), 10, S.L * .3, C.black, C.dark, .6, .3, -.02, .05); GLOW.emit(p.x, Math.max(p.y, 1), p.z, 0, 5, 0, .8, 6, 14, C.fire0, C.fire1, .8, .5, -.1); } }
      if (this.sinkT > 6 && Math.random() < dt * 2) WAKE.decal(this.x + rand(-1, 1) * S.L * .3, this.z + rand(-1, 1) * S.L * .3, 10, S.L * .25, 40, .45, 1);
      if (this.sinkT > 85 && !this.removed) this.remove(); }
    else if (this.hp < this.maxHp * .5 && Math.random() < dt * 2) { const p = this.toWorld(rand(-3, 3), deckY(S, 0) + 6, rand(-.25, .25) * S.L); SMOKE.emit(p.x, p.y, p.z, 0, rand(3, 6), 0, rand(10, 18), 5, 35, C.dark, C.gray, .4, .3, -.02, .06); }
  }
  remove() { this.removed = true; scene.remove(this.root); this.root.traverse(o => { if (o.geometry && o.geometry !== undefined) o.geometry.dispose(); }); }
}
function shipById(id) { if (!id) return null; for (const s of FLEET) if (s.id === id) return s; return null; }
function isEnemy(a, b) { return a !== b && a.team !== b.team; }
function clearFleet() { for (const s of FLEET) if (!s.removed) s.remove(); FLEET.length = 0; SHELLS.length = 0; TORPS.length = 0; WAKE.clear(); }

/* ---------- hit volume ---------- */
function supTop(S, lz, lx) {
  const dk = deckY(S, lz), st = S.sty, hw = halfBeam(S, clamp((lz + S.L / 2) / S.L, 0, 1));
  if (st.house && lz > st.house[0] && lz < st.house[1] && Math.abs(lx) < hw * .48) {
    const tower = Math.abs(lz - (st.tz + 3)) < (S.cls === 'DD' ? 5 : 8) && Math.abs(lx) < (st.tw || 6) * .6 ? (st.th || 10) + (S.cls === 'DD' ? 2.6 : 5.2) : (S.cls === 'DD' ? 2.6 : 8);
    return { top: dk + tower, dk };
  }
  if (S.cls === 'FT') return { top: 6.5, dk: 6.5 };
  return { top: dk, dk };
}
function inHull(S, l) {
  if (Math.abs(l.z) > S.L / 2) return null; const s = (l.z + S.L / 2) / S.L, hw = halfBeam(S, s) * (S.cls === 'FT' ? 1 : 1);
  if (Math.abs(l.x) > hw + .3 || l.y < -S.T) return null; const t = supTop(S, l.z, l.x); if (l.y > t.top) return null; return t;
}
/* ---------- shells ---------- */
let shellSeq = 0;
function spawnShell(owner, W, key, ammo, x, y, z, vx, vy, vz, delay, sec, remote) {
  const sh = { id: ++shellSeq, owner: owner.id, team: owner.team, oShip: owner, W, key, ammo, x, y, z, vx, vy, vz, k: dragK(W), cal: W.cal, delay, sec, alive: true, age: 0, mine: owner.ctrl === 'player', fired: false, whistle: false };
  SHELLS.push(sh); return sh;
}
function stepShells(dt) {
  const me = PLAYER;
  for (let i = 0; i < SHELLS.length; i++) {
    const s = SHELLS[i]; if (!s.alive) { SHELLS.splice(i--, 1); continue; }
    if (s.delay > 0) { s.delay -= dt; if (s.delay > 0) continue; }
    if (!s.fired) { s.fired = true; const d = _v1.set(s.vx, s.vy, s.vz).normalize(); _v2.set(s.x, s.y, s.z); fxMuzzle(_v2, d, s.cal, !s.sec); if (s.report || s.sec) sfxGun(_v2, s.cal * (s.sec ? .8 : 1), s.mine);
      if (!s.sec && s.cal >= 280 && s.report) { const rr = s.cal * .14; fxBlastWave(s.x + d.x * rr * .6, s.z + d.z * rr * .6, rr, .45); if (s.mine) shake(.18 * s.cal / 460); } }
    const ox = s.x, oy = s.y, oz = s.z, v = Math.hypot(s.vx, s.vy, s.vz);
    s.vx += -s.k * v * s.vx * dt; s.vy += (-G - s.k * v * s.vy) * dt; s.vz += -s.k * v * s.vz * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.age += dt;
    // incoming warning sound near my ship
    if (me && me.alive && !s.mine && !s.whistle && s.vy < 0 && s.team !== me.team) { const d = Math.hypot(s.x - me.x, s.z - me.z); if (d < 900 && d > 60) { s.whistle = true; sfxIncoming(Math.min(2.2, s.y / Math.max(30, -s.vy)), s.cal); } }
    // ship hits
    let hit = null;
    for (const sh of FLEET) {
      if (sh.removed || sh.id === s.owner || (sh.sinkT > 25)) continue;
      const S = sh.S, R = S.L * .5 + 30; if (Math.abs(s.x - sh.x) > R || Math.abs(s.z - sh.z) > R || s.y > 70 + S.fb[0] + (S.sty.th || 0)) continue;
      const n = Math.max(2, Math.ceil(v * dt / 2)); let prev = sh.toLocal(ox, oy, oz, _v3).clone();
      for (let k = 1; k <= n; k++) { const f = k / n, l = sh.toLocal(lerp(ox, s.x, f), lerp(oy, s.y, f), lerp(oz, s.z, f), _v4); const t = inHull(S, l);
        if (t) { hit = { sh, l: l.clone(), prev, t }; break; } prev.copy(l); }
      if (hit) break;
    }
    if (hit) { s.alive = false; shellHit(s, hit); continue; }
    if (s.y < 12) { const wy = waveH(s.x, s.z); const th = terrainH(s.x, s.z);
      if (th > s.y && th > wy) { s.alive = false; _v1.set(s.x, th, s.z); if (!s.sec || Math.random() < .5) fxGroundHit(_v1, s.cal); sfxHit(_v1, s.cal * .6); continue; }
      if (s.y < wy) { s.alive = false; fxSplash(s.x, s.z, s.cal * (s.sec ? .85 : 1)); if (!s.sec || Math.random() < .35) sfxSplash(_v1.set(s.x, 0, s.z), s.cal); continue; } }
    if (s.age > 160) s.alive = false;
  }
}
function shellHit(s, h) {
  const sh = h.sh, S = sh.S, A = S.armor, W = s.W, l = h.l, p = h.prev, v = Math.hypot(s.vx, s.vy, s.vz);
  // shell direction in ship frame
  const c = Math.cos(sh.h), sn = Math.sin(sh.h), dx = s.vx * c + s.vz * sn, dz = -s.vx * sn + s.vz * c, dy = s.vy, dl = Math.hypot(dx, dy, dz);
  const fromTop = p.y > h.t.top - .05 || (p.y > h.t.dk && Math.abs(p.x) < halfBeam(S, clamp((p.z + S.L / 2) / S.L, 0, 1)));
  const citSpan = Math.abs(l.z) < S.L * (S.cls === 'BB' ? .3 : .25) && S.cls !== 'DD' && S.cls !== 'AP';
  const onSup = l.y > h.t.dk + .4;
  let zone, arm, theta;
  if (onSup) { zone = 'sup'; arm = A.sup; theta = Math.acos(clamp(Math.abs(dx) / dl, 0, 1)); }
  else if (fromTop) { zone = 'deck'; arm = citSpan ? A.deck : A.ext * .8; theta = Math.acos(clamp(Math.abs(dy) / dl, 0, 1)); }
  else { zone = citSpan && l.y < 4 && l.y > -4.5 ? 'belt' : 'side'; arm = zone === 'belt' ? A.belt : A.ext; theta = Math.acos(clamp(Math.abs(dx) / dl, 0, 1)); if (zone === 'belt' && sh.S.nat === 'jp') theta = Math.max(0, theta - 0); }
  const rng = Math.random; let type = 'non', dmg = 0, fire = 0;
  if (s.ammo === 0) {
    const pen = penAt(W, v), td = theta / DEG, eff = arm / Math.max(.17, Math.cos(theta));
    const ricMin = 46, ricMax = 62;
    if (zone !== 'sup' && (td > ricMax || (td > ricMin && rng() < (td - ricMin) / (ricMax - ricMin)))) type = 'ric';
    else if (pen < eff) type = 'non';
    else { const arms = eff >= W.cal / 6;
      if (!arms) { type = 'over'; dmg = alphaAP(W) * .1; }
      else if ((zone === 'belt' || zone === 'deck') && citSpan) { type = 'cit'; dmg = alphaAP(W); }
      else { type = 'pen'; dmg = alphaAP(W) * .33; } }
  } else {
    const hp = W.cal / 6 * (W.cal >= 300 ? 1 : 1.25);
    if (hp >= arm || zone === 'sup') { type = 'he'; dmg = alphaHE(W) * (zone === 'sup' ? .8 : 1); fire = clamp(W.cal / 1300, .05, .38); }
    else { type = 'non'; dmg = alphaHE(W) * .06; fire = clamp(W.cal / 2600, .02, .18); }
  }
  if (s.sec) { dmg *= .9; fire *= .6; }
  const wp = sh.toWorld(l.x, l.y, l.z, _v1).clone();
  const auth = sh.auth();
  let real = 0;
  if (auth) {
    real = sh.applyDamage(dmg, s.owner, type);
    if (fire && rng() < fire) { const sec = onSup ? 3 : l.z < -S.L * .17 ? 0 : l.z > S.L * .17 ? 2 : 1; if (sh.addFire(sec)) { sh.fires[sh.fires.length - 1].by = s.owner; if (s.mine) HOOK.ribbon && HOOK.ribbon('fire'); } }
    if ((type === 'pen' || type === 'cit') && rng() < .22) { const tt = sh.tur.find(t => Math.abs(t.t.root.position.z - l.z) < 9); if (tt) tt.dis = 20; }
    if ((type === 'pen' || type === 'he') && l.z > S.L * .4 && rng() < .12) sh.rudJam = 12;
    if (type === 'cit' && rng() < .06) sh.engDis = 10;
  } else { real = dmg; if (s.mine && PLAYER) PLAYER.st.dmg += dmg; }
  if (type === 'ric') { fxSplash(wp.x, wp.z, s.cal * .25); GLOW.emit(wp.x, wp.y, wp.z, 0, 0, 0, .1, 4, 10, C.spark, C.fire1, 1); }
  else { fxHit(wp, s.cal * (type === 'non' ? .5 : type === 'over' ? .6 : 1), type === 'cit'); sfxHit(wp, s.cal, type === 'cit'); }
  if (s.mine) { HOOK.ribbon && HOOK.ribbon(type, real); if (dmg > 0 && sh.ctrl !== 'player') PLAYER.st.hits++; if (type === 'cit') PLAYER.st.cit++; }
  HOOK.hit && HOOK.hit(sh, s, type, real);
}
/* ---------- torpedoes ---------- */
function spawnTorp(owner, x, z, h, delay) {
  const W = owner.S.torp; TORPS.push({ owner: owner.id, team: owner.team, x, z, h, spd: W.spd * KN, rng: W.rng, dmg: W.dmg, wake: W.wake, d: 0, delay, alive: true, mine: owner.ctrl === 'player', bubT: 0 }); }
function stepTorps(dt) {
  for (let i = 0; i < TORPS.length; i++) {
    const t = TORPS[i]; if (!t.alive) { TORPS.splice(i--, 1); continue; }
    if (t.delay > 0) { t.delay -= dt; if (t.delay <= 0) { WAKE.decal(t.x, t.z, 3, 10, 4, .6, 1); } continue; }
    const st = t.spd * dt; t.x += Math.sin(t.h) * st; t.z -= Math.cos(t.h) * st; t.d += st;
    if (t.d > t.rng) { t.alive = false; continue; }
    t.bubT -= dt; if (t.bubT <= 0) { t.bubT = .1; const y = waveH(t.x, t.z); SMOKE.emit(t.x, y + .4, t.z, 0, .2, 0, rand(5, 9) * (.4 + t.wake), 1.2, 3.5, C.white, C.mist, .25 + .45 * t.wake, .5, 0, .1); }
    if (terrainH(t.x, t.z) > -2.5) { t.alive = false; fxSplash(t.x, t.z, 300); continue; }
    if (t.d < 150) continue;
    for (const sh of FLEET) { if (sh.removed || sh.id === t.owner || sh.sinkT > 15 || sh.static) continue; if (Math.abs(t.x - sh.x) > sh.S.L * .55 || Math.abs(t.z - sh.z) > sh.S.L * .55) continue;
      const l = sh.toLocal(t.x, -2, t.z, _v3); if (Math.abs(l.z) > sh.S.L / 2) continue; const hw = halfBeam(sh.S, (l.z + sh.S.L / 2) / sh.S.L); if (Math.abs(l.x) > hw + .5) continue;
      t.alive = false; torpHit(t, sh, l); break; }
  }
}
function torpHit(t, sh, l) {
  const prot = sh.S.cls === 'BB' ? .62 : sh.S.cls === 'CA' ? .85 : 1, wp = sh.toWorld(l.x, 0, l.z, _v1).clone();
  fxSplash(wp.x, wp.z, 560); fxHit(_v2.set(wp.x, 2, wp.z), 420, false); sfxHit(wp, 700, true);
  let real = t.dmg * prot;
  if (sh.auth()) { real = sh.applyDamage(t.dmg * prot, t.owner, 'torp'); if (Math.random() < .6 && sh.addFlood()) { sh.floods[sh.floods.length - 1].by = t.owner; sh.floodSide = Math.sign(l.x) || 1; } }
  if (t.mine) { HOOK.ribbon && HOOK.ribbon('torp', real); PLAYER.st.hits++; }
  if (sh.ctrl === 'player') shake(.9);
}
/* ---------- ship-ship collisions ---------- */
function collide(dt) {
  for (let i = 0; i < FLEET.length; i++) for (let j = i + 1; j < FLEET.length; j++) {
    const a = FLEET[i], b = FLEET[j]; if (a.removed || b.removed || a.static || b.static || a.sinkT > 10 || b.sinkT > 10) continue;
    const R = (a.S.L + b.S.L) / 2; if (Math.abs(a.x - b.x) > R || Math.abs(a.z - b.z) > R) continue;
    // closest points of the two centre-line segments (sampled)
    let best = 1e9, bx = 0, bz = 0;
    for (let u = -1; u <= 1; u += .25) { const ax = a.x + a.fx * a.S.L * .45 * u, az = a.z + a.fz * a.S.L * .45 * u; for (let w = -1; w <= 1; w += .25) { const cx = b.x + b.fx * b.S.L * .45 * w, cz = b.z + b.fz * b.S.L * .45 * w, d = Math.hypot(ax - cx, az - cz); if (d < best) { best = d; bx = ax - cx; bz = az - cz; } } }
    const min = (a.S.B + b.S.B) * .5; if (best >= min) continue;
    const n = Math.hypot(bx, bz) || 1, push = (min - best) * .5; a.x += bx / n * push; a.z += bz / n * push; b.x -= bx / n * push; b.z -= bz / n * push;
    const rel = Math.hypot(a.fx * a.spd - b.fx * b.spd, a.fz * a.spd - b.fz * b.spd);
    if (rel > 2 && (!a.ramT || simT - a.ramT > 1.5)) { a.ramT = b.ramT = simT; const ma = a.S.hp, mb = b.S.hp, k = rel * 6000 / 10;
      a.auth() && a.applyDamage(k * mb / (ma + mb) * 2, b.id, 'ram'); b.auth() && b.applyDamage(k * ma / (ma + mb) * 2, a.id, 'ram'); fxHit(_v1.set(a.x - bx / 2, 3, a.z - bz / 2), 300); sfxHit(_v1, 600, true); }
    a.spd *= .985; b.spd *= .985;
  }
}
let fixAcc = 0;
function combatUpdate(dt) {
  fixAcc += dt; let n = 0; while (fixAcc >= FIX && n < 8) { stepShells(FIX); stepTorps(FIX); fixAcc -= FIX; n++; } if (n >= 8) fixAcc = 0;
  collide(dt);
}
