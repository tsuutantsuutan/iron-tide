'use strict';
/* ================= core: utils, renderer, input, settings ================= */
const V3 = THREE.Vector3, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180, KN = 0.514444, G = 9.81;
const wrapPi = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
function mkRng(seed) { let s = (seed >>> 0) || 0x9e3779b9; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function gauss(r) { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const fmtKm = m => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function ls(k, v) { try { if (v === undefined) { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

const SET = Object.assign({ quality: 'high', vol: .8, sens: 1, tracer: 1, assist: 0, name: '', ship: 'yamato' }, ls('irontide-set') || {});
const saveSet = () => ls('irontide-set', SET);
const PROG = Object.assign({ story: 0, cleared: {} }, ls('irontide-prog') || {});
const saveProg = () => ls('irontide-prog', PROG);
const QUAL = {
  high: { pr: Math.min(devicePixelRatio || 1, 2), shadow: 2048, oceanSeg: 320, oceanRings: 240, parts: 1, label: 'グラフィック重視' },
  mid: { pr: Math.min(devicePixelRatio || 1, 1.4), shadow: 1024, oceanSeg: 256, oceanRings: 200, parts: .75, label: 'バランス' },
  low: { pr: 1, shadow: 0, oceanSeg: 192, oceanRings: 150, parts: .5, label: 'FPS重視' }
};
const Q = () => QUAL[SET.quality] || QUAL.high;

/* ---------- renderer ---------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .6;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 1.5, 90000);
camera.rotation.order = 'YXZ';
function applyQuality() {
  const q = Q(); renderer.setPixelRatio(q.pr); renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = q.shadow > 0;
  if (window.SUN) { SUN.castShadow = q.shadow > 0; if (q.shadow) { SUN.shadow.mapSize.set(q.shadow, q.shadow); if (SUN.shadow.map) { SUN.shadow.map.dispose(); SUN.shadow.map = null; } } }
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); });

/* ---------- input ---------- */
const KEYS = {}; const MOUSE = { dx: 0, dy: 0, l: false, r: false, lPress: false, wheel: 0 };
const keyHandlers = [];
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (!KEYS[e.code]) for (const h of keyHandlers) h(e.code, e);
  KEYS[e.code] = true;
  if (['Tab', 'Space'].includes(e.code) && STATE.mode === 'battle') e.preventDefault();
});
addEventListener('keyup', e => { KEYS[e.code] = false; });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; MOUSE.l = MOUSE.r = false; });
canvas.addEventListener('mousedown', e => {
  if (STATE.mode !== 'battle') return;
  if (document.pointerLockElement !== canvas) { try { const pr = canvas.requestPointerLock(); if (pr && pr.catch) pr.catch(() => {}); } catch (er) {} }
  if (e.button === 0) { MOUSE.l = true; MOUSE.lPress = true; } if (e.button === 2) MOUSE.r = true;
});
addEventListener('mouseup', e => { if (e.button === 0) MOUSE.l = false; if (e.button === 2) MOUSE.r = false; });
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas || (STATE.mode === 'battle' && MOUSE.r)) { MOUSE.dx += e.movementX; MOUSE.dy += e.movementY; } });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { MOUSE.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && STATE.mode === 'battle' && !STATE.ended && !STATE.noAutoPause) setTimeout(() => { if (document.pointerLockElement !== canvas && STATE.mode === 'battle' && !STATE.ended && !window.__itNoPause) pauseGame(true); }, 150); });

const STATE = { mode: 'boot', paused: false, ended: false, t: 0 };
function toast(msg, t = 2.4) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), t * 1000); }

/* ---------- shared temp vectors ---------- */
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3(), _q1 = new THREE.Quaternion(), _m1 = new THREE.Matrix4();
