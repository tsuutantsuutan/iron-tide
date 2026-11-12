'use strict';
/* ================= online: MQTT relay rooms (+ BroadcastChannel mock on localhost) ================= */
const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
const MAXP = 8;
const NET = { api: null, room: null, me: null, code: '', via: '', broker: '', client: false, peers: [], evSeq: 0, evRing: [], seen: {}, mt: null, sendT: 0, life: 0, lastPeers: [] };
async function getRoomApi() {
  if (NET.api) return NET.api;
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /mock/.test(location.search) && 'BroadcastChannel' in window) { NET.via = 'mock'; return (NET.api = { join: async n => mockRoom(n) }); }
  if (window.mqtt) { NET.via = 'relay'; return (NET.api = mqttRoomApi()); }
  return null;
}
function mqttRoomApi() {
  let client = null, connecting = null;
  async function getClient() {
    if (client) return client; if (connecting) return connecting;
    connecting = (async () => {
      for (const url of BROKERS) {
        lobbyStatus('リレーサーバーに接続中…（' + url.split('/')[2].split(':')[0] + '）');
        const c = await new Promise(res => { let cl; try { cl = mqtt.connect(url, { clientId: 'it_' + Math.random().toString(36).slice(2, 12), keepalive: 30, clean: true, reconnectPeriod: 2000, connectTimeout: 6000 }); } catch (e) { res(null); return; }
          const to = setTimeout(() => { try { cl.end(true); } catch (e) {} res(null); }, 7000); cl.once('connect', () => { clearTimeout(to); res(cl); }); cl.on('error', () => {}); });
        if (c) { client = c; NET.broker = url.split('/')[2].split(':')[0]; return c; }
      }
      throw { code: 'net' };
    })();
    try { return await connecting; } finally { connecting = null; }
  }
  return { join: async name => mqttRoom(await getClient(), name) };
}
function mqttRoom(cl, name) {
  const base = 'irontide-nhs/v1/' + name + '/p/', myId = 'm' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
  let mine = {}, closed = false, snap = []; const table = new Map();
  const rebuild = () => { const arr = [{ peer: myId, isMe: true, presence: mine, at: Date.now() }]; for (const [id, o] of table) arr.push({ peer: id, isMe: false, presence: o.presence, at: o.at }); snap = arr; };
  const onMsg = (topic, payload) => {
    if (closed || !topic.startsWith(base)) return; const id = topic.slice(base.length); if (!id || id === myId || id.length > 24) return;
    if (!payload || payload.length === 0) { table.delete(id); rebuild(); return; }
    if (payload.length > 24000) return; let pr; try { pr = JSON.parse(payload.toString()); } catch (e) { return; }
    if (!pr || typeof pr !== 'object' || Array.isArray(pr)) return; table.set(id, { presence: pr, at: Date.now() }); rebuild();
  };
  cl.on('message', onMsg); cl.subscribe(base + '+', { qos: 0 });
  const loop = setInterval(() => { if (closed) return; if (cl.connected) try { cl.publish(base + myId, JSON.stringify(mine), { qos: 0, retain: false }); } catch (e) {}
    const now = Date.now(); let ch = false; for (const [id, o] of table) if (now - o.at > 6000) { table.delete(id); ch = true; } if (ch) rebuild(); }, 90);
  rebuild();
  return { me: myId, set: p => { mine = p; rebuild(); }, peers: () => snap, connected: () => cl.connected,
    leave: () => { if (closed) return; closed = true; clearInterval(loop); try { cl.publish(base + myId, '', { qos: 0 }); cl.unsubscribe(base + '+'); } catch (e) {} cl.removeListener('message', onMsg); } };
}
function mockRoom(name) {
  const ch = new BroadcastChannel('irontide-' + name), myId = 'm' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7); let mine = {}, snap = [], closed = false; const table = new Map();
  const rebuild = () => { const arr = [{ peer: myId, isMe: true, presence: mine, at: Date.now() }]; for (const [id, o] of table) arr.push({ peer: id, isMe: false, presence: o.presence, at: o.at }); snap = arr; };
  ch.onmessage = e => { const { id, p } = e.data || {}; if (!id || id === myId) return; if (!p) table.delete(id); else table.set(id, { presence: p, at: Date.now() }); rebuild(); };
  const loop = setInterval(() => { if (closed) return; ch.postMessage({ id: myId, p: mine }); const now = Date.now(); for (const [id, o] of table) if (now - o.at > 4000) table.delete(id); rebuild(); }, 90);
  rebuild();
  return { me: myId, set: p => { mine = p; rebuild(); }, peers: () => snap, connected: () => true, leave: () => { closed = true; clearInterval(loop); ch.postMessage({ id: myId, p: null }); ch.close(); } };
}
function lobbyStatus(t) { const el = $('#mpStat'); if (el) el.textContent = t; }

/* ---------- roster helpers ---------- */
function roomPeers() { if (!NET.room) return []; return NET.room.peers().filter(p => p.isMe || (p.presence && p.presence.v === 1 && p.presence.rm === NET.code)).slice(0, MAXP); }
function leaderId() { const ids = roomPeers().map(p => p.peer).sort(); return ids[0] || NET.me; }
function isLeader() { return leaderId() === NET.me; }
function peerPres(id) { const p = roomPeers().find(q => q.peer === id); return p ? p.presence : null; }

/* ---------- event ring (shell / torpedo launches) ---------- */
function netPushEvents(shipId, evs) { for (const e of evs) { NET.evRing.push([++NET.evSeq, shipId, ...e]); } while (NET.evRing.length > 90) NET.evRing.shift(); NET.evRing.t = performance.now(); }
function netCollectEvents() {
  if (!NET.room) { for (const s of FLEET) s.events.length = 0; return; }
  for (const s of FLEET) { if (s.events.length && (s.ctrl === 'player' || (s.ctrl === 'ai' && !NET.client) || s.ctrl === 'static' && !NET.client)) netPushEvents(s.id, s.events); s.events.length = 0; }
  const now = performance.now(); NET.evRing = NET.evRing.filter(e => !e._t || now - e._t < 2500); for (const e of NET.evRing) if (!e._t) e._t = now;
}
function applyEvents(peer, list) {
  if (!Array.isArray(list)) return; const last = NET.seen[peer] || 0; let mx = last;
  for (const e of list) { if (!Array.isArray(e) || e.length < 11) continue; const seq = e[0]; if (seq <= last) continue; mx = Math.max(mx, seq);
    const sh = shipById(e[1]); if (!sh || sh.ctrl === 'player') continue; const key = e[2];
    if (key === 't') { if (sh.S.torp) spawnTorp(sh, +e[4], +e[6], +e[7], +e[10] || 0); continue; }
    const W = key === 'm' ? sh.S.main : (sh.S.sec || [])[+String(key).slice(1)]; if (!W) continue;
    const s = spawnShell(sh, W, key, e[3] | 0, +e[4], +e[5], +e[6], +e[7], +e[8], +e[9], Math.max(0, +e[10] || 0), key !== 'm'); s.report = true; }
  NET.seen[peer] = mx;
}

/* ---------- per-frame presence ---------- */
function buildPresence(extra) {
  const P = PLAYER, base = { v: 1, rm: NET.code, n: SET.name || '艦長', sh: LOBBY.ship, tm: LOBBY.team, rdy: LOBBY.ready ? 1 : 0, st: STATE.mode === 'battle' && GAME && GAME.net ? 'b' : 'l' };
  if (isLeader()) base.cfg = LOBBY.cfg;
  if (NET.mt && isLeader()) base.mt = NET.mt;
  if (GAME && GAME.net && P) {
    base.mid = GAME.mid; base.life = NET.life; base.id = P.id;
    base.s = [Math.round(P.x * 10) / 10, Math.round(P.z * 10) / 10, Math.round(P.h * 1000) / 1000, Math.round(P.spd * 10) / 10, Math.round(P.rud * 100) / 100];
    base.ty = P.tur.map(m => [Math.round(m.yaw * 100) / 100, Math.round(m.el * 1000) / 1000]);
    base.hp = Math.round(P.hp); base.mh = P.maxHp; base.al = P.alive ? 1 : 0; base.kb = P.killer || null; base.mag = P.mag ? 1 : 0;
    base.fi = P.fires.reduce((a, f) => a | (1 << f.sec), 0); base.fd = P.floods.length;
    base.db = {}; for (const k in P.dmgBy) base.db[k] = Math.round(P.dmgBy[k]);
    base.ev = NET.evRing.slice(-60).map(e => e.slice(0, 11));
    if (!NET.client) { base.en = FLEET.filter(s => (s.ctrl === 'ai' || s.ctrl === 'static') && !s.removed).slice(0, 24).map(s => [s.id, s.type, s.team, Math.round(s.x), Math.round(s.z), Math.round(s.h * 1000) / 1000, Math.round(s.spd * 10) / 10, Math.round(s.hp), s.maxHp, s.alive ? 1 : 0, s.killer || 0, s.fires.reduce((a, f) => a | (1 << f.sec), 0), s.tur.map(m => Math.round(m.yaw * 100) / 100), s.mag ? 1 : 0, s.label, s.boss ? 1 : 0, s.static ? Math.round(s.root.position.y) : 0]);
      base.gs = GAME.netState ? GAME.netState() : null; }
  }
  return Object.assign(base, extra || {});
}
function netTick(dt) {
  if (!NET.room) return;
  NET.sendT -= dt; if (NET.sendT <= 0) { NET.sendT = .09; netCollectEvents(); try { NET.room.set(buildPresence()); } catch (e) {} }
  if (!(GAME && GAME.net)) return;
  const lead = leaderId(); NET.client = lead !== NET.me;
  const seen = new Set();
  for (const p of roomPeers()) {
    if (p.isMe) continue; const pr = p.presence; if (!pr || pr.st !== 'b' || pr.mid !== GAME.mid || !Array.isArray(pr.s)) continue;
    // remote player ship
    const rid = 'P' + p.peer + '_' + (pr.life | 0); seen.add(rid);
    let rs = shipById(rid);
    if (!rs && SHIPS[pr.sh] && pr.al) { rs = new Ship(pr.sh, { id: rid, team: pr.tm, ctrl: 'remote', name: String(pr.n || '艦長').slice(0, 12), label: String(pr.n || '艦長').slice(0, 12) + '（' + SHIPS[pr.sh].n + '）', x: pr.s[0], z: pr.s[1], h: pr.s[2] }); rs.peer = p.peer; rs.maxHp = pr.mh || rs.maxHp; GAME.onRemoteJoin && GAME.onRemoteJoin(rs); }
    if (rs) remoteApply(rs, pr, p.at, dt);
    // NPCs simulated by the leader
    if (p.peer === lead && Array.isArray(pr.en)) for (const e of pr.en) puppetApply(e, dt, seen);
    if (p.peer === lead && pr.gs && GAME.applyNetState) GAME.applyNetState(pr.gs);
    applyEvents(p.peer, pr.ev);
  }
  for (const s of FLEET) if ((s.ctrl === 'remote' || s.ctrl === 'puppet') && !seen.has(s.id) && !s.removed) { if (s.ctrl === 'puppet' && !NET.client) { s.ctrl = 'ai'; s.ai = mkAI({ diff: GAME.diff || 'normal' }); continue; } if (s.alive) { s.alive = false; s.sinkT = 80; } s.remove(); }
}
function remoteApply(rs, pr, at, dt) {
  const age = Math.min(.6, (Date.now() - at) / 1000), [x, z, h, spd, rud] = pr.s;
  const px = x + Math.sin(h) * spd * age, pz = z - Math.cos(h) * spd * age;
  if (Math.hypot(px - rs.x, pz - rs.z) > 200) { rs.x = px; rs.z = pz; } else { const k = 1 - Math.exp(-dt * 5); rs.x += (px - rs.x) * k; rs.z += (pz - rs.z) * k; }
  rs.h = wrapPi(rs.h + wrapPi(h - rs.h) * (1 - Math.exp(-dt * 6))); rs.spd = spd; rs.rud = rud;
  if (Array.isArray(pr.ty)) pr.ty.forEach((t, i) => { const m = rs.tur[i]; if (!m || !Array.isArray(t)) return; m.yaw += wrapPi(t[0] - m.yaw) * .3; m.el += (t[1] - m.el) * .3; m.t.root.rotation.y = -m.yaw; m.t.pivot.rotation.x = m.el; });
  rs.maxHp = pr.mh || rs.maxHp; rs.hp = clamp(+pr.hp || 0, 0, rs.maxHp); rs.dmgBy = pr.db || {};
  syncFires(rs, pr.fi | 0); rs.floods.length = pr.fd | 0;
  if (!pr.al && rs.alive) { rs.forceMag = !!pr.mag; rs.kill(pr.kb || null, !!pr.mag); }
}
function syncFires(s, bits) { for (let sec = 0; sec < 4; sec++) { const has = s.fires.some(f => f.sec === sec); if ((bits >> sec & 1) && !has) { s.dcOn = 0; s.addFire(sec); } else if (!(bits >> sec & 1) && has) s.fires = s.fires.filter(f => f.sec !== sec); } for (const f of s.fires) f.t = 99; }
function puppetApply(e, dt, seen) {
  if (!Array.isArray(e) || e.length < 13) return; const [id, type, team, x, z, h, spd, hp, mh, al, kb, fi, ty, mag, label, boss, fy] = e; if (!SHIPS[type]) return; seen.add(id);
  let s = shipById(id);
  if (!s) { if (!al) return; s = new Ship(type, { id, team, ctrl: 'puppet', x, z, h, label: label || SHIPS[type].n, y: fy }); s.boss = !!boss; GAME.onRemoteJoin && GAME.onRemoteJoin(s); }
  if (s.ctrl !== 'puppet') return;
  const k = 1 - Math.exp(-dt * 4), px = x + Math.sin(h) * spd * .1, pz = z - Math.cos(h) * spd * .1;
  if (Math.hypot(px - s.x, pz - s.z) > 300) { s.x = px; s.z = pz; } else { s.x += (px - s.x) * k; s.z += (pz - s.z) * k; }
  s.h = wrapPi(s.h + wrapPi(h - s.h) * k); s.spd = spd; s.maxHp = mh; s.hp = hp;
  if (Array.isArray(ty)) ty.forEach((t, i) => { const m = s.tur[i]; if (!m) return; m.yaw += wrapPi(t - m.yaw) * .25; m.t.root.rotation.y = -m.yaw; });
  syncFires(s, fi | 0);
  if (!al && s.alive) { s.forceMag = !!mag; s.kill(kb || null, !!mag); }
}
