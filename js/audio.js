'use strict';
/* ================= audio: synthesized, with speed-of-sound delay ================= */
const AU = { ctx: null, master: null, rev: null, noise: null, amb: null, eng: null, ready: false };
const SOUND_SPEED = 343;
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const ctx = AU.ctx = new AC();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .3;
  AU.master = ctx.createGain(); AU.master.gain.value = SET.vol; AU.master.connect(comp); comp.connect(ctx.destination);
  // noise buffer
  const len = ctx.sampleRate * 3, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = w * .6 + last * 3.2; }
  AU.noise = b;
  // reverb: long decaying stereo impulse (open sea + distance)
  const rl = ctx.sampleRate * 4.5, ib = ctx.createBuffer(2, rl, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = ib.getChannelData(c); for (let i = 0; i < rl; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.2); }
  AU.rev = ctx.createConvolver(); AU.rev.buffer = ib; AU.revG = ctx.createGain(); AU.revG.gain.value = .55; AU.rev.connect(AU.revG); AU.revG.connect(AU.master);
  // ambience: sea wash + wind
  const mkLoop = (f, q, g, type = 'lowpass') => { const s = ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const gg = ctx.createGain(); gg.gain.value = g; s.connect(fl); fl.connect(gg); gg.connect(AU.master); s.start(); return { s, fl, g: gg }; };
  AU.amb = mkLoop(420, .4, .12); AU.wind = mkLoop(900, 1.2, .03, 'bandpass'); AU.engN = mkLoop(90, 1, 0);
  AU.eng = ctx.createOscillator(); AU.eng.type = 'sawtooth'; AU.eng.frequency.value = 38; const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 120; AU.engG = ctx.createGain(); AU.engG.gain.value = 0; AU.eng.connect(ef); ef.connect(AU.engG); AU.engG.connect(AU.master); AU.eng.start();
  AU.ready = true;
}
function audioVolume() { if (AU.master) AU.master.gain.value = SET.vol; }
function audioAmbient(dt, spdFrac, camH, sea) {
  if (!AU.ready) return; const t = AU.ctx.currentTime;
  AU.amb.g.gain.setTargetAtTime(.08 + .1 * sea + (camH < 40 ? .06 : 0), t, .5); AU.amb.fl.frequency.setTargetAtTime(300 + 260 * Math.sin(t * .23) + 200 * sea, t, .8);
  AU.wind.g.gain.setTargetAtTime(.02 + .04 * sea + Math.min(.05, camH / 4000), t, .8);
  AU.engG.gain.setTargetAtTime(.025 * spdFrac + .01, t, .5); AU.eng.frequency.setTargetAtTime(30 + spdFrac * 22, t, .6); AU.engN.g.gain.setTargetAtTime(.05 * spdFrac, t, .5);
}
function nSrc(dur, t0) { const s = AU.ctx.createBufferSource(); s.buffer = AU.noise; s.loopStart = 0; s.loop = true; s.start(t0, Math.random() * 2); s.stop(t0 + dur); return s; }
// distance → delay, gain and muffling
function spatial(pos) {
  const d = pos ? camera.position.distanceTo(pos) : 0, listenDist = Math.max(0, d - 30);
  return { d, delay: listenDist / SOUND_SPEED, g: 1 / (1 + listenDist / 350), lp: 200 + 14000 / (1 + listenDist / 400) };
}
function out(node, g, rev = .35) { const gg = AU.ctx.createGain(); gg.gain.value = g; node.connect(gg); gg.connect(AU.master); if (AU.rev) { const r = AU.ctx.createGain(); r.gain.value = rev * g; node.connect(r); r.connect(AU.rev); } }
// heavy gun report: supersonic crack (close only), deep boom, rolling rumble
function sfxGun(pos, cal, own) {
  if (!AU.ready) return; const S = spatial(pos), ctx = AU.ctx, t0 = ctx.currentTime + S.delay + .01, s = clamp(cal / 460, .15, 1.2);
  if (S.d > 40000) return; const g = S.g * (own ? 1.2 : 1) * (.35 + .9 * s);
  // boom
  const n = nSrc(3.5, t0), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(S.lp, 2600 * s + 500), t0); lp.frequency.exponentialRampToValueAtTime(90, t0 + 2.4);
  const e = ctx.createGain(); e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(1.6 * g, t0 + .006); e.gain.exponentialRampToValueAtTime(.25 * g, t0 + .5); e.gain.exponentialRampToValueAtTime(.0005, t0 + 3.4);
  n.connect(lp); lp.connect(e); out(e, 1, .55);
  // sub thump
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70 - 30 * s, t0); o.frequency.exponentialRampToValueAtTime(22, t0 + .9);
  const og = ctx.createGain(); og.gain.setValueAtTime(0, t0); og.gain.linearRampToValueAtTime(1.8 * g * s, t0 + .01); og.gain.exponentialRampToValueAtTime(.0005, t0 + 1.4); o.connect(og); out(og, 1, .2); o.start(t0); o.stop(t0 + 1.5);
  if (S.d < 1500) { const c = nSrc(.2, t0), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800; const cg = ctx.createGain(); cg.gain.setValueAtTime(.9 * g, t0); cg.gain.exponentialRampToValueAtTime(.001, t0 + .18); c.connect(hp); hp.connect(cg); out(cg, 1, .3); }
}
function sfxSplash(pos, cal) {
  if (!AU.ready) return; const S = spatial(pos); if (S.d > 16000) return; const ctx = AU.ctx, t0 = ctx.currentTime + S.delay, s = clamp(cal / 460, .1, 1);
  const n = nSrc(2.5, t0), bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.setValueAtTime(Math.min(S.lp, 1800), t0); bp.frequency.exponentialRampToValueAtTime(200, t0 + 2);
  const e = ctx.createGain(); e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(.9 * S.g * (.3 + s), t0 + .02); e.gain.exponentialRampToValueAtTime(.001, t0 + 2.2); n.connect(bp); bp.connect(e); out(e, 1, .4);
  const o = ctx.createOscillator(); o.frequency.setValueAtTime(60, t0); o.frequency.exponentialRampToValueAtTime(25, t0 + .5); const og = ctx.createGain(); og.gain.setValueAtTime(.8 * S.g * s, t0); og.gain.exponentialRampToValueAtTime(.001, t0 + .6); o.connect(og); out(og, 1, .1); o.start(t0); o.stop(t0 + .7);
}
function sfxHit(pos, cal, big) {
  if (!AU.ready) return; const S = spatial(pos); if (S.d > 20000) return; const ctx = AU.ctx, t0 = ctx.currentTime + S.delay, s = clamp(cal / 460, .15, 1.2);
  // metallic clang
  for (const f of [310, 467, 733, 1190]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f * rand(.9, 1.1) * (1.2 - s * .4); const g = ctx.createGain(); g.gain.setValueAtTime(.12 * S.g, t0); g.gain.exponentialRampToValueAtTime(.0005, t0 + .7); o.connect(g); out(g, 1, .5); o.start(t0); o.stop(t0 + .8); }
  const n = nSrc(2.8, t0), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(S.lp, 3000), t0); lp.frequency.exponentialRampToValueAtTime(80, t0 + 2.4);
  const e = ctx.createGain(); e.gain.setValueAtTime(1.3 * S.g * (.4 + s) * (big ? 1.6 : 1), t0); e.gain.exponentialRampToValueAtTime(.0005, t0 + 2.6); n.connect(lp); lp.connect(e); out(e, 1, .6);
}
// incoming shell: tearing "freight train" that rises as it approaches
function sfxIncoming(eta, cal) {
  if (!AU.ready) return; const ctx = AU.ctx, t0 = ctx.currentTime, dur = clamp(eta, .4, 3), s = clamp(cal / 460, .2, 1);
  const n = nSrc(dur + .1, t0), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.setValueAtTime(380 + 300 * (1 - s), t0); bp.frequency.linearRampToValueAtTime(900 + 500 * (1 - s), t0 + dur);
  const e = ctx.createGain(); e.gain.setValueAtTime(.001, t0); e.gain.exponentialRampToValueAtTime(.35 * s + .1, t0 + dur); e.gain.linearRampToValueAtTime(0, t0 + dur + .08); n.connect(bp); bp.connect(e); out(e, 1, .2);
}
function sfxTorpLaunch(pos) { if (!AU.ready) return; const S = spatial(pos), ctx = AU.ctx, t0 = ctx.currentTime + S.delay; const n = nSrc(.6, t0), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; const e = ctx.createGain(); e.gain.setValueAtTime(.4 * S.g, t0); e.gain.exponentialRampToValueAtTime(.001, t0 + .5); n.connect(bp); bp.connect(e); out(e, 1, .3); }
function sfxUI(f = 880, d = .06, v = .05) { if (!AU.ready) return; const ctx = AU.ctx, t0 = ctx.currentTime, o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.0005, t0 + d); o.connect(g); g.connect(AU.master); o.start(t0); o.stop(t0 + d + .02); }
function sfxBell() { if (!AU.ready) return; for (const [f, dl] of [[1320, 0], [1320, .22]]) { const ctx = AU.ctx, t0 = ctx.currentTime + dl, o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(.08, t0); g.gain.exponentialRampToValueAtTime(.0005, t0 + .9); o.connect(g); out(g, 1, .4); o.start(t0); o.stop(t0 + 1); } }
function sfxAlarm() { if (!AU.ready) return; const ctx = AU.ctx, t0 = ctx.currentTime; for (let i = 0; i < 3; i++) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 640; const g = ctx.createGain(); g.gain.setValueAtTime(0, t0 + i * .32); g.gain.linearRampToValueAtTime(.03, t0 + i * .32 + .02); g.gain.linearRampToValueAtTime(0, t0 + i * .32 + .2); const f = ctx.createBiquadFilter(); f.frequency.value = 1500; o.connect(f); f.connect(g); g.connect(AU.master); o.start(t0 + i * .32); o.stop(t0 + i * .32 + .22); } }
