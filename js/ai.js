'use strict';
/* ================= NPC captains ================= */
const DIFF = {
  easy: { n: 'イージー', lead: [.55, .35], err: 230, rl: 1.35, dc: 9, react: 1.6, zig: .4 },
  normal: { n: 'ノーマル', lead: [.9, .13], err: 75, rl: 1.1, dc: 4, react: 1, zig: 1 },
  hard: { n: 'ハード', lead: [1, .05], err: 38, rl: 1, dc: 1.5, react: .6, zig: 1.4 },
  ace: { n: 'エース', lead: [1.02, .03], err: 30, rl: .92, dc: .8, react: .45, zig: 1.7 }
};
function mkAI(o = {}) { return Object.assign({ diff: 'normal', tgt: null, retT: 0, side: Math.random() < .5 ? -1 : 1, phase: Math.random() * 100, errX: 0, errZ: 0, errT: 0, dcT: 0 }, o); }
function clearPath(sh, hdg) {
  const S = sh.S, fx = Math.sin(hdg), fz = -Math.cos(hdg), lim = MAP_HALF - 700;
  for (const d of [S.L * .5 + 250, S.L * .5 + 650, S.L * .5 + 1200]) { const x = sh.x + fx * d, z = sh.z + fz * d; if (Math.abs(x) > lim || Math.abs(z) > lim) return false; if (ISL.length && terrainH(x, z) > -S.T - 3) return false; }
  return true;
}
function steerTo(sh, hdg) {
  if (!clearPath(sh, hdg)) { for (const off of [20, -20, 40, -40, 65, -65, 95, -95, 130, -130, 180]) { const h = hdg + off * DEG * sh.ai.side; if (clearPath(sh, h)) { hdg = h; break; } } }
  const d = wrapPi(hdg - sh.h); sh.rudI = d > .3 ? 4 : d > .05 ? 3 : d < -.3 ? 0 : d < -.05 ? 1 : 2; return hdg;
}
function aiUpdate(sh, dt) {
  const A = sh.ai, S = sh.S, D = DIFF[A.diff] || DIFF.normal; if (!sh.alive) return;
  A.t = (A.t || 0) + dt;
  // pick target
  A.retT -= dt;
  if (A.retT <= 0 || !A.tgt || !A.tgt.alive) { A.retT = 4 + Math.random() * 3; let best = null, bs = 1e12;
    for (const o of FLEET) { if (!o.alive || !isEnemy(sh, o) || o.removed) continue; const d = Math.hypot(o.x - sh.x, o.z - sh.z); let sc = d; if (A.prefer && o.S.cls === A.prefer) sc *= .6; if (o.ctrl === 'player' || o.ctrl === 'remote') sc *= .85; if (o.S.cls === 'AP') sc *= A.hunt ? .5 : 1.2; if (sc < bs) { bs = sc; best = o; } }
    A.tgt = best; }
  const T = A.tgt;
  // damage control
  if ((sh.fires.length >= 2 || sh.floods.length || (sh.fires.length && sh.hp < sh.maxHp * .4)) && sh.dc <= 0) { A.dcT += dt; if (A.dcT > D.dc) { sh.damageControl(); A.dcT = 0; } } else A.dcT = 0;
  // movement
  if (!sh.static) {
    let hdg = sh.h;
    if (A.path && A.path.length) { const wp = A.path[A.wp || 0]; const dx = wp[0] - sh.x, dz = wp[1] - sh.z; if (Math.hypot(dx, dz) < 500) A.wp = Math.min(A.path.length - 1, (A.wp || 0) + 1); hdg = Math.atan2(dx, -dz); sh.tele = A.tele || 4; }
    else if (A.follow && A.follow.alive) { const L = A.follow, ox = A.off[0], oz = A.off[1], c = Math.cos(L.h), s = Math.sin(L.h); const px = L.x + ox * c - oz * s + L.fx * 400, pz = L.z + ox * s + oz * c + L.fz * 400; const d = Math.hypot(px - sh.x, pz - sh.z); hdg = Math.atan2(px - sh.x, -(pz - sh.z)); sh.tele = d > 600 ? 6 : d > 250 ? 5 : 4; if (T && Math.hypot(T.x - sh.x, T.z - sh.z) < (A.engage || 9000)) A.follow = null; }
    else if (A.hold) { const dx = A.hold[0] - sh.x, dz = A.hold[1] - sh.z, d = Math.hypot(dx, dz); hdg = d > (A.hold[2] || 1500) ? Math.atan2(dx, -dz) : sh.h + Math.sin(A.t * .03 + A.phase) * .4; sh.tele = d > 3000 ? 6 : 3; if (T && Math.hypot(T.x - sh.x, T.z - sh.z) < (A.engage || 0)) A.hold = null; }
    else if (T) {
      const dx = T.x - sh.x, dz = T.z - sh.z, d = Math.hypot(dx, dz), b = Math.atan2(dx, -dz);
      let dr = A.range || (S.cls === 'BB' ? 12500 : S.cls === 'CA' ? 9500 : 8000);
      const torpReady = sh.torp.length && sh.torp.some(m => m.rl <= 0);
      if (S.cls === 'DD' && torpReady) dr = Math.min(dr, S.torp.rng * .55);
      if (S.cls === 'DD' && !torpReady) dr = 10000;
      if (sh.hp < sh.maxHp * .3 && S.cls !== 'BB') dr *= 1.3;
      if (Math.random() < dt / 40) A.side *= -1;
      let off;
      if (d > dr * 1.15) off = 28 * A.side; else if (d < dr * .8) off = (180 - 35) * A.side; else off = (S.cls === 'BB' ? 62 : 75) * A.side;
      off += Math.sin(A.t * .09 + A.phase) * 14 * D.zig;
      hdg = b + off * DEG; sh.tele = d > dr * 1.6 ? 6 : 6;
    }
    steerTo(sh, hdg);
  }
  // gunnery
  if (T && T.alive && sh.tur.length) {
    const W = S.main, d = Math.hypot(T.x - sh.x, T.z - sh.z), b = ballFor(W, d);
    A.errT -= dt; if (A.errT <= 0) { A.errT = W.rl * rand(.8, 1.2); const e = D.err * (d / 10000 + .3) * sh.acc; A.errX = gauss(Math.random) * e; A.errZ = gauss(Math.random) * e; A.lq = D.lead[0] + gauss(Math.random) * D.lead[1]; }
    const t = b ? b.t : d / 600, q = A.lq != null ? A.lq : 1;
    sh.aim.set(T.x + T.fx * T.spd * t * q + A.errX, 0, T.z + T.fz * T.spd * t * q + A.errZ); sh.aimOk = true;
    sh.aimMounts(sh.tur, sh.aim, dt, true);
    const ready = sh.tur.filter(m => m.ready).length, bear = sh.tur.filter(m => !m.blocked && m.dis <= 0).length;
    if (d < ballTable(W).maxR * .97 && ready && ready >= Math.max(1, Math.ceil(bear * .6))) { A.fireT = (A.fireT || 0) + dt; if (A.fireT > D.react) { sh.fireMain(); A.fireT = 0; } }
  } else if (sh.tur.length) { sh.aim.set(sh.x + sh.fx * 5000, 0, sh.z + sh.fz * 5000); sh.aimMounts(sh.tur, sh.aim, dt, true); }
  // torpedoes
  if (T && T.alive && sh.torp.length && !T.static) {
    const W = S.torp, sp = W.spd * KN; let px = T.x, pz = T.z;
    for (let i = 0; i < 3; i++) { const tt = Math.hypot(px - sh.x, pz - sh.z) / sp; px = T.x + T.fx * T.spd * tt; pz = T.z + T.fz * T.spd * tt; }
    const d = Math.hypot(px - sh.x, pz - sh.z); _v3.set(px, 0, pz); sh.aimMounts(sh.torp, _v3, dt, null);
    if (d < W.rng * .8 && d > 900) { A.torpT = (A.torpT || 0) + dt; if (A.torpT > 2 * D.react) { if (sh.fireTorps(_v3)) A.torpT = -rand(2, 8); } }
  }
}
