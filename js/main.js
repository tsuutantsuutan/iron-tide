'use strict';
/* ================= UI, camera, HUD, main loop ================= */
const CAM = { yaw: 0, pitch: -.03, dist: 1, scope: false, zoomI: 1, ZOOMS: [2, 4, 8, 16], shell: null, shellHold: 0, spec: null, target: null, torpMode: false, fov: 55 };
let lastLaunch = null;
function show(id) { for (const el of $$('.screen')) el.classList.add('hidden'); if (id) $('#' + id).classList.remove('hidden'); }
function seg(el, opts, cur, onPick, dis) {
  el.textContent = ''; for (const k in opts) { const b = document.createElement('button'); b.type = 'button'; b.textContent = opts[k]; if (String(k) === String(cur)) b.classList.add('on'); if (dis) b.disabled = true;
    b.addEventListener('click', () => { sfxUI(); onPick(k); }); el.append(b); }
}

function lockPointer() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
/* ---------- title / menus ---------- */
let SHOW = null; // display ship on menus
function titleScene(type) {
  clearFleet(); PLAYER = null; GAME = null; setMap('bokou', 'dawn');
  SHOW = new Ship(type || SET.ship || 'yamato', { id: 'SHOW', ctrl: 'show', x: -2600, z: -2200, h: 125 * DEG, spd: 2.5, tele: 2 });
  new Ship('shimakaze', { id: 'SHOW2', ctrl: 'show', x: -1900, z: -3100, h: 125 * DEG, spd: 3, tele: 2 });
  new Ship('nagato', { id: 'SHOW3', ctrl: 'show', x: -3900, z: -2600, h: 125 * DEG, spd: 2.5, tele: 2 });
}
function setShowShip(type) { if (!SHOW || SHOW.type === type) return; const x = SHOW.x, z = SHOW.z, h = SHOW.h; SHOW.remove(); FLEET.splice(FLEET.indexOf(SHOW), 1); SHOW = new Ship(type, { id: 'SHOW', ctrl: 'show', x, z, h, spd: 2.5, tele: 2 }); }
function goTitle() {
  STATE.mode = 'title'; $('#hud').classList.add('hidden'); if (document.pointerLockElement) document.exitPointerLock();
  if (!SHOW || SHOW.removed || GAME) titleScene(); show('title'); $('#curship').textContent = '現在の艦：' + SHIPS[SET.ship].n;
}
$('#mainmenu').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; audioInit(); sfxUI(); const go = b.dataset.go;
  if (go === 'story') openStory(); else if (go === 'tutorial') { lastLaunch = startTutorial; startTutorial(); } else if (go === 'free') openFree(); else if (go === 'multi') openMulti(); else if (go === 'dock') openShipSel('title'); else if (go === 'settings') openSettings('title'); });
for (const b of $$('[data-back]')) b.addEventListener('click', () => { sfxUI(); const scr = b.closest('.screen').id; if (scr === 'shipsel') closeShipSel(); else if (scr === 'settings' && STATE.setRet === 'pause') { show('pause'); } else if (scr === 'brief') openStory(); else goTitle(); });

/* ship select */
const SS = { ret: 'title', sel: 'yamato' };
function openShipSel(ret) { SS.ret = ret; SS.sel = ret === 'multi' ? LOBBY.ship : SET.ship; STATE.mode = 'shipsel'; show('shipsel'); setShowShip(SS.sel); renderShipSel(); }
function closeShipSel() { if (SS.ret === 'free') openFree(); else if (SS.ret === 'multi') openMulti(true); else goTitle(); }
function renderShipSel() {
  const S = SHIPS[SS.sel]; $('#ssName').innerHTML = esc(S.n) + '<small>' + esc(S.en) + ' · ' + esc(CLS_N[S.cls]) + ' · ' + esc(S.natN) + '</small>'; $('#ssDesc').textContent = S.desc;
  const W = S.main, sec = (S.sec || []).map(w => (w.cal / 10) + 'cm×' + w.n * w.mounts.length).join(' / ');
  const rows = [['全長 × 全幅', S.L + ' m × ' + S.B + ' m'], ['基準排水量', S.dsp], ['最大速力', S.kn + ' ノット（' + Math.round(S.kn * 1.852) + ' km/h）'], ['主砲', (W.cal / 10) + 'cm ' + W.n + '連装 × ' + W.mounts.length + '基（' + W.n * W.mounts.length + '門）'], ['砲弾重量／初速', W.m + ' kg ／ ' + W.mv + ' m/s'], ['装填時間', W.rl + ' 秒'], ['最大射程（ゲーム内）', (ballTable(W).maxR / 1000).toFixed(1) + ' km'], ['副砲', sec || 'なし'], ['魚雷', S.torp ? S.torp.n + '連装 × ' + S.torp.mounts.length + '基（' + S.torp.spd + 'kt / ' + S.torp.rng / 1000 + 'km）' : 'なし'], ['装甲（舷側／甲板）', S.armor.belt + ' mm ／ ' + S.armor.deck + ' mm'], ['耐久', S.hp.toLocaleString()]];
  $('#ssSpec').innerHTML = rows.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('');
  const bars = [['火力', alphaAP(W) * W.n * W.mounts.length / W.rl / 4200], ['装甲', S.armor.belt / 460], ['耐久', S.hp / 106000], ['速力', (S.kn - 20) / 20], ['射程', ballTable(W).maxR / 26000]];
  $('#ssBars').innerHTML = bars.map(b => '<div class="bar"><span>' + b[0] + '</span><i><b style="width:' + Math.round(clamp(b[1], .05, 1) * 100) + '%"></b></i></div>').join('');
  const list = $('#ssList'); list.textContent = '';
  for (const id of PLAYABLE) { const s = SHIPS[id], b = document.createElement('button'); b.type = 'button'; b.innerHTML = esc(s.n) + '<small>' + esc(CLS_N[s.cls]) + ' · ' + esc(s.en) + '</small>'; if (id === SS.sel) b.classList.add('on');
    b.addEventListener('click', () => { sfxUI(); SS.sel = id; setShowShip(id); renderShipSel(); }); list.append(b); }
  $('#ssOk').textContent = SS.ret === 'title' ? 'この艦に決定' : 'この艦で出撃';
  $('#ssNote').textContent = SS.ret === 'title' ? 'ストーリーは大和で固定' : '';
}
$('#ssOk').addEventListener('click', () => { sfxUI(1100); if (SS.ret === 'multi') { LOBBY.ship = SS.sel; } SET.ship = SS.sel; saveSet(); closeShipSel(); });

/* story */
function openStory() { STATE.mode = 'menu'; show('story'); const el = $('#chapList'); el.textContent = '';
  CHAPTERS.forEach((C, i) => { const b = document.createElement('button'); b.type = 'button'; const lock = i > PROG.story; if (lock) b.classList.add('lock');
    b.innerHTML = '<span class="n">' + (i + 1) + '</span><span><span class="t">' + esc(C.n + '「' + C.t + '」') + '</span><br><span class="s">' + esc(C.s) + '</span></span>' + (PROG.cleared[i] ? '<span class="clr">CLEAR</span>' : '');
    b.addEventListener('click', () => { sfxUI(); openBrief(i); }); el.append(b); });
  const d = document.createElement('div'); d.className = 'field'; d.style.marginTop = '12px'; d.innerHTML = '<div class="lab">難易度</div><div class="seg" id="stDiff"></div>'; el.append(d);
  seg($('#stDiff'), { easy: 'イージー', normal: 'ノーマル', hard: 'ハード' }, SET.storyDiff || 'normal', k => { SET.storyDiff = k; saveSet(); openStory(); });
}
function openBrief(i) { const C = CHAPTERS[i]; show('brief'); $('#brT').innerHTML = '<small>' + esc(C.n) + ' · ' + esc(C.s) + '</small>' + esc(C.t); $('#brText').textContent = C.brief; $('#brObj').innerHTML = '<b>作戦目標</b><br>' + C.objs.map(o => '・' + esc(o)).join('<br>');
  $('#brGo').onclick = () => { sfxUI(1100); lastLaunch = () => launch(storyGame(i)); lastLaunch(); }; }

/* free */
function openFree() { STATE.mode = 'menu'; show('free'); $('#frShip').textContent = SHIPS[SET.ship].n + '（' + CLS_N[SHIPS[SET.ship].cls] + '）';
  const re = () => openFree();
  seg($('#frMap'), Object.fromEntries(Object.keys(MAPS).map(k => [k, MAPS[k].n])), FREE.map, k => { FREE.map = k; re(); });
  seg($('#frSky'), FREE_OPT.sky, FREE.sky, k => { FREE.sky = k; re(); }); seg($('#frSea'), FREE_OPT.sea, FREE.sea, k => { FREE.sea = k; re(); });
  seg($('#frEnemy'), FREE_OPT.enemy, FREE.enemy, k => { FREE.enemy = k; re(); }); seg($('#frAlly'), FREE_OPT.ally, FREE.ally, k => { FREE.ally = k; re(); });
  seg($('#frDiff'), FREE_OPT.diff, FREE.diff, k => { FREE.diff = k; re(); }); seg($('#frDist'), FREE_OPT.dist, FREE.dist, k => { FREE.dist = k; re(); }); }
$('#frShipBtn').addEventListener('click', () => openShipSel('free'));
$('#frGo').addEventListener('click', () => { sfxUI(1100); lastLaunch = startFree; startFree(); });

/* settings */
function openSettings(ret) { STATE.setRet = ret; show('settings');
  seg($('#stQ'), { high: QUAL.high.label, mid: QUAL.mid.label, low: QUAL.low.label }, SET.quality, k => { SET.quality = k; saveSet(); applyQuality(); buildOcean(); openSettings(ret); });
  seg($('#stTr'), { 1: '表示する', 0: '表示しない（よりリアル）' }, SET.tracer, k => { SET.tracer = +k; saveSet(); openSettings(ret); });
  seg($('#stAssist'), { 0: 'オフ', 1: 'オン' }, SET.assist, k => { SET.assist = +k; saveSet(); openSettings(ret); });
  $('#stVol').value = SET.vol; $('#stSens').value = SET.sens; }
$('#stVol').addEventListener('input', e => { SET.vol = +e.target.value; saveSet(); audioVolume(); });
$('#stSens').addEventListener('input', e => { SET.sens = +e.target.value; saveSet(); });

/* ---------- multiplayer lobby ---------- */
function genCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += a[Math.random() * a.length | 0]; return s; }
function openMulti(back) { STATE.mode = 'menu'; show('multi'); $('#mpName').value = SET.name || ''; if (NET.room) { $('#mpJoin').classList.add('hidden'); $('#mpRoom').classList.remove('hidden'); renderLobby(); } else { $('#mpJoin').classList.remove('hidden'); $('#mpRoom').classList.add('hidden'); } }
async function joinRoom(code) {
  SET.name = ($('#mpName').value || '').trim().slice(0, 12) || '艦長' + (Math.random() * 90 + 10 | 0); saveSet();
  code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || genCode();
  lobbyStatus('接続中…'); $('#mpGo').disabled = true;
  try { const api = await getRoomApi(); if (!api) throw 0; NET.room = await api.join(code); NET.me = NET.room.me; NET.code = code; LOBBY.ready = false; LOBBY.team = 0;
    history.replaceState(null, '', location.pathname + '?room=' + code + (/mock/.test(location.search) ? '&mock' : ''));
    $('#mpJoin').classList.add('hidden'); $('#mpRoom').classList.remove('hidden'); renderLobby(); lobbyStatus('');
  } catch (e) { lobbyStatus('接続できなかった。ネットワークを確認して、もう一度試してね。'); }
  $('#mpGo').disabled = false;
}
function leaveRoom() { if (NET.room) NET.room.leave(); NET.room = null; NET.mt = null; history.replaceState(null, '', location.pathname); openMulti(); }
$('#mpGo').addEventListener('click', () => { audioInit(); sfxUI(1100); joinRoom($('#mpCode').value); });
$('#mpLeave').addEventListener('click', () => { sfxUI(); leaveRoom(); });
$('#mpCopy').addEventListener('click', async () => { const url = location.origin + location.pathname + '?room=' + NET.code; try { await navigator.clipboard.writeText(url); toast('招待リンクをコピーした：' + url, 3.5); } catch (e) { toast(url, 6); } });
$('#mpShipBtn').addEventListener('click', () => openShipSel('multi'));
$('#mpReady').addEventListener('click', () => { sfxUI(LOBBY.ready ? 600 : 1100); LOBBY.ready = !LOBBY.ready; renderLobby(); });
const TEAM_COL = ['#6fb6ff', '#ff7a6a'];
function lobbyCfg() { const lead = leaderId(); if (lead === NET.me) return LOBBY.cfg; const pr = peerPres(lead); return (pr && pr.cfg) || LOBBY.cfg; }
function renderLobby() {
  if (!NET.room || $('#mpRoom').classList.contains('hidden')) return;
  const lead = isLeader(), cfg = lobbyCfg(); $('#mpRoomCode').textContent = NET.code;
  const ps = roomPeers().slice().sort((a, b) => a.peer < b.peer ? -1 : 1);
  $('#mpRoster').innerHTML = ps.map((p, i) => { const pr = p.isMe ? buildPresence() : p.presence || {}; const col = cfg.mode === 'team' ? TEAM_COL[pr.tm | 0] : cfg.mode === 'coop' ? '#7fd49a' : 'hsl(' + (i * 47) + ',60%,62%)';
    return '<li><span class="sw" style="background:' + col + '"></span><b>' + esc(pr.n || '艦長') + '</b>' + (i === 0 ? ' <small style="color:var(--acc)">ホスト</small>' : '') + (p.isMe ? ' <small style="color:var(--mute)">（自分）</small>' : '') + '<span style="color:var(--dim);font-size:12px">' + esc(SHIPS[pr.sh] ? SHIPS[pr.sh].n : '') + '</span><span class="st ' + (pr.rdy ? 'ok' : '') + '">' + (pr.st === 'b' ? '戦闘中' : pr.rdy ? '準備OK' : '待機中') + '</span></li>'; }).join('');
  $('#mpInfo').textContent = '接続: ' + (NET.via === 'mock' ? 'テスト' : 'リレー（' + NET.broker + '）') + '　·　' + ps.length + ' / ' + MAXP + ' 人' + (ps.length < 2 ? '　·　「招待リンクをコピー」して友達に送ろう' : '') + (lead ? '　·　全員が準備OKで出撃（1人でもOK）' : (peerPres(leaderId()) || {}).st === 'b' ? '　·　ホストが戦闘中。終わったら次の戦闘に参加できる' : '');
  $('#mpLeadNote').textContent = lead ? '（ホストが決める）' : '（ホストが決める）';
  const setCfg = (k, v) => { if (!lead) return; LOBBY.cfg[k] = v; ls('irontide-mpcfg', LOBBY.cfg); renderLobby(); };
  seg($('#mpMode'), MODE_N, cfg.mode, k => setCfg('mode', k), !lead);
  seg($('#mpMap'), Object.fromEntries(Object.keys(MAPS).map(k => [k, MAPS[k].n])), cfg.map, k => setCfg('map', k), !lead);
  $('#mpDiffF').classList.toggle('hidden', cfg.mode !== 'coop'); seg($('#mpDiff'), Object.fromEntries(Object.keys(COOP_DIFF).map(k => [k, COOP_DIFF[k].n + '（' + SHIPS[COOP_DIFF[k].boss].n + '）'])), cfg.diff, k => setCfg('diff', k), !lead);
  $('#mpBotF').classList.toggle('hidden', cfg.mode === 'coop'); seg($('#mpBots'), { 1: 'NPCで埋める', 0: 'プレイヤーのみ' }, cfg.bots ? 1 : 0, k => setCfg('bots', +k), !lead);
  $('#mpTeamF').classList.toggle('hidden', cfg.mode !== 'team'); seg($('#mpTeam'), { 0: '蒼チーム', 1: '紅チーム' }, LOBBY.team, k => { LOBBY.team = +k; renderLobby(); });
  $('#mpShip').textContent = SHIPS[LOBBY.ship].n + '（' + CLS_N[SHIPS[LOBBY.ship].cls] + '）';
  $('#mpReady').textContent = LOBBY.ready ? '準備OK（取り消す）' : '準備OK'; $('#mpReady').classList.toggle('pri', !LOBBY.ready);
}
let lobbyT = 0, startT = 0;
function lobbyTick(dt) {
  if (!NET.room) return; lobbyT -= dt; if (lobbyT <= 0) { lobbyT = .5; renderLobby(); }
  if (STATE.mode === 'battle') return;
  const lead = leaderId();
  if (lead === NET.me) {
    const ps = roomPeers(), allReady = ps.length && ps.every(p => p.isMe ? LOBBY.ready : p.presence && p.presence.rdy && p.presence.st !== 'b');
    if (allReady && !NET.mt) { startT += dt; if (startT > 1.5) { startT = 0; netStartMatch(); LOBBY.ready = false; NET.lastMt = NET.mt.id; startNetMatch(NET.mt); } } else startT = 0;
  } else { const pr = peerPres(lead); if (pr && pr.mt && pr.mt.id !== NET.lastMt && Array.isArray(pr.mt.ids) && pr.mt.ids.includes(NET.me)) { NET.lastMt = pr.mt.id; LOBBY.ready = false; startNetMatch(pr.mt); } }
}

/* ---------- battle UI ---------- */
function enterBattleUI() {
  STATE.mode = 'battle'; show(null); $('#hud').classList.remove('hidden'); $('#tut').classList.add('hidden'); $('#feed').textContent = ''; $('#rib').textContent = ''; $('#warn').textContent = ''; $('#spec').textContent = '';
  CAM.yaw = PLAYER.h; CAM.pitch = -.02; CAM.scope = false; CAM.shell = null; CAM.spec = null; CAM.torpMode = false; CAM.dist = 1;
  buildGunHud(); renderObjs(); buildCrosshair(); $('#mapbox').classList.remove('big');
  $('#help').innerHTML = 'マウス 照準 · 右クリック/Shift 照準器 · 左クリック 斉射<br>W/S 速力 · A/D 舵 · 1/2 弾種 · T 魚雷 · R 応急修理<br>M 地図 · Tab 戦況 · V 砲弾視点 · Esc 一時停止'; $('#help').classList.remove('hidden'); setTimeout(() => $('#help').classList.add('hidden'), 14000);
  lockPointer();
}
function buildGunHud() {
  const P = PLAYER; $('#hName').innerHTML = esc(P.S.n) + '<small>' + esc(P.S.en) + '</small>';
  $('#guns').innerHTML = P.tur.map((m, i) => '<div class="g" data-i="' + i + '"><i></i><span>' + '①②③④⑤'[i] + '</span></div>').join('') + (P.torp.length ? P.torp.map((m, i) => '<div class="g t" data-t="' + i + '"><i></i><span>魚' + (i + 1) + '</span></div>').join('') : '');
}
function buildCrosshair() {
  const x = $('#xh'); let h = '<div class="c"></div><div class="h" style="left:-160px;width:140px"></div><div class="h" style="left:20px;width:140px"></div>';
  for (let i = 1; i <= 8; i++) { const off = 20 + i * 17; h += '<div class="tk' + (i % 2 ? '' : ' l') + '" style="left:' + off + 'px"></div><div class="tk' + (i % 2 ? '' : ' l') + '" style="left:' + (-off) + 'px"></div>'; }
  x.innerHTML = h;
  let t = ''; for (let i = -9; i <= 9; i++) if (i) t += '<line x1="' + i * 9 + '" y1="0" x2="' + i * 9 + '" y2="' + (i % 3 ? 2 : 5) + '"/>'; for (let i = 1; i <= 6; i++) t += '<line x1="-2" y1="' + i * 12 + '" x2="2" y2="' + i * 12 + '"/>'; $('#scTicks').innerHTML = t;
}
function renderObjs() { if (!GAME) return; $('#objL').innerHTML = GAME.objs.map(o => '<div class="' + (o.st === 1 ? 'done' : o.st === -1 ? 'fail' : '') + '">' + (o.st === 1 ? '✓ ' : o.st === -1 ? '✗ ' : '・') + esc(o.t) + '</div>').join(''); }
function ribbon(type, dmg) { const el = document.createElement('div'); el.className = type === 'cit' ? 'cit' : type === 'kill' ? 'kill' : type === 'fire' || type === 'torp' ? 'fire' : type === 'ric' || type === 'non' ? 'ric' : type === 'over' ? 'over' : 'pen'; el.textContent = RIB[type] + (dmg > 1 ? '　' + Math.round(dmg).toLocaleString() : ''); const r = $('#rib'); r.prepend(el); while (r.children.length > 4) r.lastChild.remove(); setTimeout(() => el.remove(), 2500); }
function feed(html) { const el = document.createElement('div'); el.innerHTML = html; const f = $('#feed'); f.prepend(el); while (f.children.length > 6) f.lastChild.remove(); setTimeout(() => el.remove(), 7200); }
HOOK.ribbon = (t, d) => ribbon(t, d);
HOOK.hit = (sh, s, type, d) => { if (GAME && GAME.onHit) GAME.onHit(sh, s, type, d); };
HOOK.kill = (v, a) => {
  if (!GAME) return; const col = s => !s ? '#ccc' : PLAYER && s.team === PLAYER.team ? 'var(--blue)' : 'var(--red)';
  feed('<span style="color:' + col(a) + '">' + esc(a ? a.label : '—') + '</span> ✕ <span style="color:' + col(v) + '">' + esc(v.label) + '</span>' + (v.mag ? ' <small>（弾薬庫誘爆）</small>' : ''));
  if (a && a === PLAYER) { ribbon('kill'); sfxBell(); GAME.myKills = (GAME.myKills || 0) + 1; }
  if (v === PLAYER) { radio('副長', v.mag ? '弾薬庫誘爆……！総員退艦！' : '本艦、沈みます……総員退艦！', 0); }
};
function pauseGame(on) { if (STATE.mode !== 'battle' || STATE.ended) return; if (on) { STATE.paused = !GAME.net; show('pause'); if (document.pointerLockElement) document.exitPointerLock(); } else { STATE.paused = false; show(null); lockPointer(); } }
$('#psResume').addEventListener('click', () => pauseGame(false));
$('#psSettings').addEventListener('click', () => openSettings('pause'));
$('#psRetry').addEventListener('click', () => { if (GAME && GAME.net) { toast('マルチプレイ中はやり直せない'); return; } if (lastLaunch) lastLaunch(); });
$('#psQuit').addEventListener('click', () => { quitBattle(); });
function quitBattle() { STATE.paused = false; const net = GAME && GAME.net; GAME = null; clearFleet(); if (net && NET.room) { if (isLeader()) NET.mt = null; titleScene(); openMulti(); } else goTitle(); }
function endBattle(won, title, text) {
  if (STATE.ended) return; STATE.ended = true; const G = GAME;
  if (G.kind === 'story' && won) { PROG.cleared[G.ch] = 1; PROG.story = Math.max(PROG.story, G.ch + 1); saveProg(); }
  setTimeout(() => {
    if (GAME !== G) return; if (document.pointerLockElement) document.exitPointerLock();
    show('result'); $('#rsSub').textContent = G.title; $('#rsT').textContent = title; $('#rsT').className = 'big ' + (won ? 'win' : 'lose'); $('#rsText').textContent = text || '';
    const P = PLAYER, rows = [['撃沈', G.myKills || 0], ['与ダメージ', Math.round(P.st.dmg).toLocaleString()], ['命中弾', P.st.hits], ['重要区画貫通', P.st.cit], ['斉射した砲塔数', P.st.fired], ['残り耐久', Math.round(P.hp).toLocaleString() + ' / ' + P.maxHp.toLocaleString()]];
    let html = rows.map(r => '<tr><td>' + r[0] + '</td><td style="text-align:right">' + r[1] + '</td></tr>').join('');
    if (G.net) { html += '<tr><td colspan="2" style="color:var(--mute);padding-top:14px">参加者</td></tr>' + roomPeers().map(p => { const pr = p.isMe ? buildPresence() : p.presence || {}; return '<tr><td>' + esc(pr.n || '') + '（' + esc(SHIPS[pr.sh] ? SHIPS[pr.sh].n : '') + '）</td><td style="text-align:right">' + (pr.al ? '生存' : '撃沈') + '</td></tr>'; }).join(''); }
    $('#rsTbl').innerHTML = html;
    const hasNext = G.kind === 'story' && won && G.ch + 1 < CHAPTERS.length;
    $('#rsNext').classList.toggle('hidden', !hasNext && !G.net); $('#rsNext').textContent = G.net ? 'ロビーに戻る' : '次の話へ';
    $('#rsNext').onclick = () => { sfxUI(); if (G.net) quitBattle(); else { GAME = null; openBrief(G.ch + 1); } };
    $('#rsRetry').classList.toggle('hidden', !!G.net); $('#rsRetry').onclick = () => { sfxUI(); if (lastLaunch) lastLaunch(); };
    $('#rsMenu').onclick = () => { sfxUI(); quitBattle(); if (G.net) leaveRoom(); };
  }, won ? 3500 : 4500);
}

/* ---------- controls ---------- */
keyHandlers.push((code, e) => {
  if (STATE.mode !== 'battle') return; audioInit();
  if (code === 'Escape') return; if (STATE.paused) return;
  const P = PLAYER; if (!P) return;
  if (code === 'KeyW') { P.tele = Math.min(TELE.length - 1, P.tele + 1); sfxUI(700, .05, .03); }
  if (code === 'KeyS') { P.tele = Math.max(0, P.tele - 1); sfxUI(500, .05, .03); }
  if (code === 'KeyA') { P.rudI = Math.max(0, P.rudI - 1); sfxUI(620, .04, .025); }
  if (code === 'KeyD') { P.rudI = Math.min(RUD.length - 1, P.rudI + 1); sfxUI(620, .04, .025); }
  if (code === 'Digit1' || code === 'Digit2') { const a = code === 'Digit1' ? 0 : 1; if (P.ammo !== a) { P.ammo = a; for (const m of P.tur) m.rl = Math.max(m.rl, m.W.rl * .5 * P.reloadMul); toast(a ? '榴弾（HE）装填' : '徹甲弾（AP）装填', 1.2); sfxUI(900); } }
  if (code === 'KeyT' && P.torp.length) { CAM.torpMode = !CAM.torpMode; toast(CAM.torpMode ? '魚雷戦用意' : '砲撃戦に戻る', 1.2); }
  if (code === 'KeyR') { if (P.damageControl()) { toast('応急修理班、作業開始！', 1.5); sfxBell(); } else if (P.dc > 0) toast('応急修理 再使用まで ' + Math.ceil(P.dc) + ' 秒', 1.2); }
  if (code === 'KeyM') $('#mapbox').classList.toggle('big');
  if (code === 'KeyC') CAM.scope = !CAM.scope;
  if (code === 'KeyV') { let best = null; for (const s of SHELLS) if (s.mine && s.alive && s.fired && !s.sec && (!best || s.id > best.id)) best = s; CAM.shell = best; CAM.shellHold = 0; if (!best) toast('飛んでいる砲弾がない', 1); }
  if (code === 'Space' && !P.alive) CAM.specI = (CAM.specI || 0) + 1;
});
addEventListener('keydown', e => { if (e.code === 'Escape' && STATE.mode === 'battle' && !STATE.ended) { if ($('#pause').classList.contains('hidden')) pauseGame(true); else pauseGame(false); } });

function aimRay() {
  const P = PLAYER, origin = camera.position, dir = _v1.set(0, 0, -1).applyQuaternion(camera.quaternion);
  let best = null, bt = 1e9;
  for (const s of FLEET) { if (s === P || s.removed || s.sinkT > 20) continue; const S = s.S, lo = s.toLocal(origin.x, origin.y, origin.z, _v2), c = Math.cos(s.h), sn = Math.sin(s.h);
    const dx = dir.x * c + dir.z * sn, dz = -dir.x * sn + dir.z * c, dy = dir.y; const mn = [-S.B / 2 - 3, -1, -S.L / 2], mx = [S.B / 2 + 3, S.fb[0] + (S.sty.th || 6) + 6, S.L / 2]; let t0 = 0, t1 = bt; const o = [lo.x, lo.y, lo.z], d = [dx, dy, dz]; let ok = true;
    for (let k = 0; k < 3; k++) { if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) { ok = false; break; } continue; } let a = (mn[k] - o[k]) / d[k], b = (mx[k] - o[k]) / d[k]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; } }
    if (ok && t0 < bt) { bt = t0; best = s; } }
  CAM.target = best;
  let x, z;
  if (best) { x = origin.x + dir.x * bt; z = origin.z + dir.z * bt; }
  else if (dir.y < -1e-5) { const t = (origin.y - 0) / -dir.y; x = origin.x + dir.x * t; z = origin.z + dir.z * t; }
  else { const az = Math.atan2(dir.x, -dir.z); x = P.x + Math.sin(az) * 60000; z = P.z - Math.cos(az) * 60000; }
  const max = CAM.torpMode ? P.S.torp.rng : ballTable(P.S.main).maxR, r = Math.hypot(x - P.x, z - P.z);
  CAM.oor = r > max; CAM.r = r;
  if (r > max) { const k = max / r; x = P.x + (x - P.x) * k; z = P.z + (z - P.z) * k; }
  P.aim.set(x, 0, z); P.aimOk = true;
}
function playerUpdate(dt) {
  const P = PLAYER; if (!P.alive) return;
  aimRay();
  P.aimMounts(P.tur, P.aim, dt, true);
  if (P.torp.length) P.aimMounts(P.torp, P.aim, dt, null);
  if (MOUSE.lPress && !STATE.paused) { if (CAM.torpMode) { if (!P.fireTorps(P.aim)) toast(P.torp.some(m => m.rl > 0) ? '魚雷 装填中' : '発射管がその方向を向けない', 1); } else if (!P.fireMain()) { const any = P.tur.some(m => m.rl > 0); if (CAM.oor) toast('射程外', .8); else if (any && P.tur.every(m => m.rl > 0 || m.blocked)) toast('装填中', .6); } }
}
/* ---------- camera ---------- */
function cameraUpdate(dt) {
  const P = PLAYER, sens = SET.sens * (CAM.fov / 55);
  CAM.yaw = wrapPi(CAM.yaw + MOUSE.dx * .0021 * sens); CAM.pitch = clamp(CAM.pitch - MOUSE.dy * .0014 * sens, CAM.scope ? -.25 : -.55, CAM.scope ? .06 : .14);
  if (GAME) GAME.lookAcc = (GAME.lookAcc || 0) + Math.abs(MOUSE.dx) * .0021;
  MOUSE.dx = MOUSE.dy = 0;
  const scoping = !!(P.alive && (CAM.scope || MOUSE.r || KEYS.ShiftLeft || KEYS.ShiftRight) && !CAM.shell);
  if (MOUSE.wheel) { if (scoping) CAM.zoomI = clamp(CAM.zoomI - MOUSE.wheel, 0, CAM.ZOOMS.length - 1); else CAM.dist = clamp(CAM.dist * (1 + MOUSE.wheel * .12), .45, 3.2); MOUSE.wheel = 0; }
  const fovT = scoping ? 55 / CAM.ZOOMS[CAM.zoomI] : 55; CAM.fov = lerp(CAM.fov, fovT, 1 - Math.exp(-dt * 14)); camera.fov = CAM.fov; camera.updateProjectionMatrix();
  $('#scope').classList.toggle('on', scoping); $('#zoomv').textContent = '× ' + CAM.ZOOMS[CAM.zoomI];
  let focus = P;
  if (!P.alive) { const allies = FLEET.filter(s => s.alive && s.team === P.team && s !== P && s.ctrl !== 'show'); if (allies.length && P.sinkT > 6) { focus = allies[(CAM.specI || 0) % allies.length]; $('#spec').innerHTML = '観戦中：' + esc(focus.label) + '　<span class="kbd">Space</span> 切替'; } else $('#spec').textContent = P.sinkT > 6 ? '' : ''; }
  const f = _v3.set(Math.sin(CAM.yaw) * Math.cos(CAM.pitch), Math.sin(CAM.pitch), -Math.cos(CAM.yaw) * Math.cos(CAM.pitch));
  if (CAM.shell) { const s = CAM.shell; if (!s.alive) { CAM.shellHold += dt; if (CAM.shellHold > 1.8) CAM.shell = null; } else { _v4.set(s.vx, s.vy, s.vz).normalize(); camera.position.set(s.x - _v4.x * 45, s.y - _v4.y * 45 + 9, s.z - _v4.z * 45); CAM.shellPos = camera.position.clone(); camera.lookAt(s.x + _v4.x * 40, s.y + _v4.y * 40, s.z + _v4.z * 40); } if (CAM.shell && !s.alive && CAM.shellPos) { camera.position.copy(CAM.shellPos); } if (CAM.shell) { applyShake(dt); return; } }
  if (scoping) { const S = P.S, tz = S.sty.tz || 0, top = deckY(S, tz) + (S.cls === 'DD' ? 2.6 : 5.2) + (S.sty.th || 10) + 3; P.toWorld(0, top, tz, camera.position); camera.position.y = Math.max(camera.position.y, top * .9);
    camera.lookAt(camera.position.x + f.x, camera.position.y + f.y, camera.position.z + f.z); }
  else { const S = focus.S, d = (S.L * 1.05 + 120) * CAM.dist, piv = _v4.set(focus.x, Math.max(focus.heave, -30) + S.fb[1] + 18 + S.L * .04, focus.z);
    camera.position.set(piv.x - f.x * d, piv.y - f.y * d + d * .14, piv.z - f.z * d);
    const wy = waveH(camera.position.x, camera.position.z) + 3; if (camera.position.y < wy) camera.position.y = wy;
    camera.lookAt(camera.position.x + f.x, camera.position.y + f.y, camera.position.z + f.z); }
  applyShake(dt);
}
function applyShake(dt) { if (SHAKE.a > .001) { const a = SHAKE.a * .012; camera.rotation.x += rand(-a, a); camera.rotation.y += rand(-a, a); SHAKE.a *= Math.exp(-dt * 5); } camera.updateMatrixWorld(); }
function titleCamera(dt) {
  const s = SHOW; if (!s) return; STATE.tt = (STATE.tt || 0) + dt; const S = s.S;
  const near = STATE.mode === 'shipsel', a = STATE.tt * (near ? .07 : .035) + (near ? .8 : 2.2), d = near ? S.L * 1.15 + 40 : S.L * 2.2 + 200, hgt = near ? S.L * .18 + 10 : S.L * .32 + 30;
  const tx = s.x + (near ? s.fx * S.L * .1 : 0), tz = s.z;
  const cx = tx + Math.cos(a) * d, cz = tz + Math.sin(a) * d; camera.position.lerp(_v1.set(cx, hgt, cz), STATE.camSnap ? 1 : 1 - Math.exp(-dt * 2)); STATE.camSnap = 0;
  camera.fov = near ? 42 : 50; camera.updateProjectionMatrix(); camera.lookAt(tx - (near ? 0 : S.L * .8) * Math.cos(a) * .0, S.fb[1] + 8, tz);
  camera.updateMatrixWorld();
}

/* ---------- HUD ---------- */
const TAGS = new Map(); let hudT = 0, mmT = 0;
function hudUpdate(dt) {
  const P = PLAYER, S = P.S;
  // status panel
  const hpF = P.hp / P.maxHp, hb = $('#hpbar b'); hb.style.width = (hpF * 100).toFixed(1) + '%'; hb.className = hpF < .3 ? 'low' : hpF < .6 ? 'mid' : '';
  hudT -= dt; if (hudT <= 0) { hudT = .1;
    $('#hpv').textContent = Math.round(P.hp).toLocaleString() + ' / ' + P.maxHp.toLocaleString(); $('#hpp').textContent = Math.round(hpF * 100) + '%';
    $('#hSpd').innerHTML = (P.spd / KN).toFixed(1) + '<small> kt</small>'; $('#hOrd').textContent = TELE[P.tele].n + (P.engDis > 0 ? '（機関停止）' : '');
    $('#rud b').style.left = (50 + P.rud * 48) + '%'; $('#rud i').style.left = (50 + RUD[P.rudI].v * 48) + '%'; $('#hRud').textContent = RUD[P.rudI].n + (P.rudJam > 0 ? '（舵故障）' : '');
    $$('#guns .g').forEach(el => { const m = el.dataset.t != null ? P.torp[+el.dataset.t] : P.tur[+el.dataset.i]; if (!m) return; const R = el.dataset.t != null ? P.S.torp.rl : m.W.rl * P.reloadMul; el.querySelector('i').style.height = (clamp(1 - m.rl / R, 0, 1) * 100) + '%';
      el.classList.toggle('rdy', m.rl <= 0 && !m.blocked && m.dis <= 0); el.classList.toggle('blk', !!m.blocked); el.classList.toggle('dmg', m.dis > 0); el.title = m.rl > 0 ? Math.ceil(m.rl) + 's' : ''; el.querySelector('span').textContent = m.dis > 0 ? '損傷' : m.rl > 0 ? Math.ceil(m.rl) : (el.dataset.t != null ? '魚' + (+el.dataset.t + 1) : '①②③④⑤'[+el.dataset.i]); });
    $('#ammo').innerHTML = '<span class="' + (P.ammo === 0 && !CAM.torpMode ? 'on' : '') + '">1 徹甲弾 AP</span><span class="' + (P.ammo === 1 && !CAM.torpMode ? 'on' : '') + '">2 榴弾 HE</span>' + (P.torp.length ? '<span class="' + (CAM.torpMode ? 'on' : '') + '">T 魚雷</span>' : '');
    $('#cons').innerHTML = '<span class="' + (P.dc > 0 ? 'cd' : '') + '">R 応急修理 ' + (P.dc > 0 ? Math.ceil(P.dc) + 's' : '準備よし') + '</span>' + (P.dcOn > 0 ? '<span style="color:var(--ok)">修理中 ' + Math.ceil(P.dcOn) + 's</span>' : '');
    $('#status').innerHTML = (P.fires.length ? '<span>火災 ×' + P.fires.length + '</span>' : '') + (P.floods.length ? '<span class="fl">浸水 ×' + P.floods.length + '</span>' : '') + (P.rudJam > 0 ? '<span>舵故障</span>' : '') + (P.engDis > 0 ? '<span>機関停止</span>' : '') + (P.tur.some(t => t.dis > 0) ? '<span>砲塔損傷</span>' : '');
    // range readout
    const W = S.main; let rt = '';
    if (P.alive) { if (CAM.torpMode) rt = '魚雷 <b>' + fmtKm(CAM.r || 0) + '</b>　射程 ' + fmtKm(S.torp.rng) + (CAM.oor ? ' <span class="oor">射程外</span>' : '');
      else { const b = ballFor(W, Math.min(CAM.r || 0, ballTable(W).maxR)); rt = '<b>' + fmtKm(Math.min(CAM.r || 0, ballTable(W).maxR)) + '</b>' + (b ? '　着弾 ' + b.t.toFixed(1) + ' s' : '') + (CAM.oor ? '　<span class="oor">射程外（最大 ' + fmtKm(ballTable(W).maxR) + '）</span>' : ''); } }
    $('#rng').innerHTML = rt;
    const T = CAM.target; const tg = $('#tgt');
    if (T && P.alive) { const d = Math.hypot(T.x - P.x, T.z - P.z); tg.className = isEnemy(P, T) ? 'enemy' : 'ally'; tg.innerHTML = '<div class="nm">' + esc(T.label) + '</div>' + esc(CLS_N[T.S.cls] || '') + ' · ' + fmtKm(d) + ' · ' + (T.spd / KN).toFixed(0) + ' kt · 耐久 ' + Math.round(T.hp / T.maxHp * 100) + '%'; } else tg.innerHTML = '';
    // torpedo warning
    let tw = false; for (const t of TORPS) { if (t.team === P.team || !t.alive || t.delay > 0) continue; const rx = P.x - t.x, rz = P.z - t.z, vx = Math.sin(t.h) * t.spd - P.fx * P.spd, vz = -Math.cos(t.h) * t.spd - P.fz * P.spd, vv = vx * vx + vz * vz, tt = clamp((rx * vx + rz * vz) / vv, 0, 40); const cx = rx - vx * tt, cz = rz - vz * tt; if (Math.hypot(cx, cz) < S.L * .6 && tt < 35 && Math.hypot(rx, rz) < 4000) { tw = true; break; } }
    const warn = tw ? '⚠ 魚雷接近！' : P.atEdge ? '⚠ 作戦海域の境界' : P.grounded ? '⚠ 座礁' : ''; if ($('#warn').textContent !== warn) { $('#warn').textContent = warn; if (tw) sfxAlarm(); }
    // score
    if (GAME.net && GAME.mt.mode === 'team') { const c0 = FLEET.filter(s => s.team === 0 && s.alive && s.ctrl !== 'show').length, c1 = FLEET.filter(s => s.team === 1 && s.alive).length; $('#score').innerHTML = '<span class="a">蒼 ' + c0 + '</span><span class="t">残存艦</span><span class="b">' + c1 + ' 紅</span>'; }
    else { const en = FLEET.filter(s => s.alive && isEnemy(P, s) && !s.removed).length; $('#score').innerHTML = '<span class="t">敵残存 ' + en + ' 隻　·　' + fmtT(GAME.t) + '</span>'; }
    // radio
    const q = GAME.radioQ; if (q.length && q[0].at <= GAME.t && (!GAME.radioOn || GAME.t - GAME.radioOn > 5)) { const r = q.shift(); GAME.radioOn = GAME.t; const el = $('#radio'); el.querySelector('.who').textContent = r.who; el.querySelector('.txt').textContent = r.text; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 4800); sfxUI(1500, .08, .02); }
    if (KEYS.Tab) renderTab(); else $('#tab').classList.add('hidden');
  }
  // tags
  const W2 = innerWidth, H2 = innerHeight; const used = new Set(), placed = [];
  for (const s of FLEET) { if (s === P || s.removed || s.ctrl === 'show' || (!s.alive && s.sinkT > 12)) continue;
    const top = s.S.fb[0] + (s.S.sty.th || 8) + 18; _v1.set(s.x, s.heave + top, s.z); const d = camera.position.distanceTo(_v1); if (d > 30000) continue; _v1.project(camera); if (_v1.z > 1 || Math.abs(_v1.x) > 1.1 || Math.abs(_v1.y) > 1.1) continue;
    let el = TAGS.get(s.id); if (!el) { el = document.createElement('div'); el.innerHTML = '<span></span><i><b></b></i>'; $('#tags').append(el); TAGS.set(s.id, el); }
    used.add(s.id); el.className = 'tag ' + (s.team === P.team ? 'a' : 'e'); placed.push({ el, x: (_v1.x + 1) / 2 * W2, y: (1 - _v1.y) / 2 * H2, w: s.label.length * 11 + 60 });
    const txt = (s.alive ? '' : '✝ ') + s.label + '　' + fmtKm(Math.hypot(s.x - P.x, s.z - P.z)); if (el.firstChild.textContent !== txt) el.firstChild.textContent = txt; el.querySelector('b').style.width = (s.hp / s.maxHp * 100) + '%'; el.style.opacity = CAM.scope || MOUSE.r ? .7 : 1; }
  placed.sort((a, b) => b.y - a.y); const done = [];
  for (const t of placed) { let y = t.y; for (let it = 0; it < 8; it++) { const hit = done.find(o => Math.abs(o.x - t.x) < (o.w + t.w) / 2 && Math.abs(o.y - y) < 26); if (!hit) break; y = hit.y - 27; } t.y = y; done.push(t); t.el.style.left = t.x + 'px'; t.el.style.top = y + 'px'; }
  for (const [id, el] of TAGS) if (!used.has(id)) { el.remove(); TAGS.delete(id); }
  // lead assist marker (NPC battles only)
  if (SET.assist && !GAME.net && P.alive && !CAM.torpMode) { let T = CAM.target; if (!T || !isEnemy(P, T)) { let bd = .25; for (const s of FLEET) { if (!s.alive || !isEnemy(P, s)) continue; _v1.set(s.x, 5, s.z).project(camera); if (_v1.z > 1) continue; const dd = Math.hypot(_v1.x, _v1.y); if (dd < bd) { bd = dd; T = s; } } }
    let mk = $('#leadmk'); if (!mk) { mk = document.createElement('div'); mk.id = 'leadmk'; mk.style.cssText = 'position:absolute;width:14px;height:14px;border:2px solid #ffd66a;transform:translate(-50%,-50%) rotate(45deg);pointer-events:none'; $('#hud').append(mk); }
    if (T) { const d = Math.hypot(T.x - P.x, T.z - P.z), b = ballFor(S.main, d); if (b) { _v1.set(T.x + T.fx * T.spd * b.t, 2, T.z + T.fz * T.spd * b.t).project(camera); mk.style.display = _v1.z < 1 ? '' : 'none'; mk.style.left = ((_v1.x + 1) / 2 * W2) + 'px'; mk.style.top = ((1 - _v1.y) / 2 * H2) + 'px'; } else mk.style.display = 'none'; } else mk.style.display = 'none'; }
  else { const mk = $('#leadmk'); if (mk) mk.style.display = 'none'; }
  mmT -= dt; if (mmT <= 0) { mmT = 1 / 15; drawMinimap(); }
}
const fmtT = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
function renderTab() { const el = $('#tab'); el.classList.remove('hidden'); const rows = FLEET.filter(s => s.ctrl !== 'show').sort((a, b) => a.team - b.team);
  el.innerHTML = '<table><tr><th>艦</th><th>艦種</th><th>耐久</th><th>撃沈</th><th>与ダメ</th></tr>' + rows.map(s => '<tr class="' + (s.alive ? '' : 'dead') + '"><td style="color:' + (s.team === PLAYER.team ? 'var(--blue)' : 'var(--red)') + '">' + esc(s.label) + (s === PLAYER ? '（自艦）' : '') + '</td><td>' + esc(CLS_N[s.S.cls]) + '</td><td>' + Math.round(s.hp / s.maxHp * 100) + '%</td><td>' + s.st.kills + '</td><td>' + Math.round(s.st.dmg).toLocaleString() + '</td></tr>').join('') + '</table>'; }
function drawMinimap() {
  const cv = $('#mm'), x = cv.getContext('2d'), N = cv.width, k = N / (MAP_HALF * 2), P = PLAYER, X = v => (v + MAP_HALF) * k;
  x.clearRect(0, 0, N, N); if (minimapImg) x.drawImage(minimapImg, 0, 0, N, N);
  x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1; for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(i * N / 6, 0); x.lineTo(i * N / 6, N); x.moveTo(0, i * N / 6); x.lineTo(N, i * N / 6); x.stroke(); }
  if (P.alive) { x.strokeStyle = 'rgba(217,180,90,.35)'; x.beginPath(); x.arc(X(P.x), X(P.z), ballTable(P.S.main).maxR * k, 0, Math.PI * 2); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.moveTo(X(P.x), X(P.z)); x.lineTo(X(P.aim.x), X(P.aim.z)); x.stroke(); }
  for (const t of TORPS) { if (!t.alive || t.delay > 0) continue; const d = Math.hypot(t.x - P.x, t.z - P.z); if (t.team !== P.team && d > 3000) continue; x.strokeStyle = t.team === P.team ? 'rgba(111,182,255,.8)' : 'rgba(255,120,100,.9)'; x.beginPath(); x.moveTo(X(t.x), X(t.z)); x.lineTo(X(t.x - Math.sin(t.h) * 300), X(t.z + Math.cos(t.h) * 300)); x.stroke(); }
  for (const s of FLEET) { if (s.removed || s.ctrl === 'show') continue; const sz = s.S.cls === 'BB' ? 7 : s.S.cls === 'CA' ? 6 : 5;
    x.save(); x.translate(X(s.x), X(s.z)); x.rotate(s.h); x.fillStyle = !s.alive ? 'rgba(160,160,160,.5)' : s === P ? '#fff' : s.team === P.team ? '#6fb6ff' : '#ff6a5a';
    if (s.S.cls === 'FT') x.fillRect(-4, -4, 8, 8); else { x.beginPath(); x.moveTo(0, -sz * 1.4); x.lineTo(sz * .7, sz); x.lineTo(-sz * .7, sz); x.closePath(); x.fill(); } x.restore(); }
  x.strokeStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.moveTo(X(P.x), X(P.z)); x.lineTo(X(P.x + Math.sin(CAM.yaw) * 2500), X(P.z - Math.cos(CAM.yaw) * 2500)); x.stroke();
}

/* ---------- main loop ---------- */
let lastT = performance.now();
function battleUpdate(dt) {
  const G = GAME; G.t += dt;
  if (PLAYER.alive) playerUpdate(dt);
  for (const s of FLEET) {
    if (s.removed) continue;
    if (s.ctrl === 'player' || s.ctrl === 'ai' || s.ctrl === 'static') { if (s.ctrl === 'ai' && s.ai) aiUpdate(s, dt); else if (s.ctrl === 'static' && s.ai && s.alive) aiUpdate(s, dt); s.physics(dt); s.reloadTick(dt); s.secondaries(dt); s.dot(dt); }
    else if (s.ctrl === 'remote' || s.ctrl === 'puppet') { s.seakeep(dt); s.reloadTick(dt); }
    s.visuals(dt);
  }
  combatUpdate(dt);
  if (G.tick && !STATE.ended) G.tick(G, dt);
  MOUSE.lPress = false;
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(.05, (now - lastT) / 1000); lastT = now; if (window.__itDt) dt = window.__itDt;
  step(dt, now);
}
let lastFrameAt = performance.now();
// when the tab is hidden the browser stops animation frames: keep the online simulation and sync alive anyway
setInterval(() => { const now = performance.now(); if (now - lastFrameAt < 300) return; const dt = .1;
  if (STATE.mode === 'battle' && GAME && PLAYER && GAME.net) { battleUpdate(dt); envUpdate(dt); }
  netTick(dt); lobbyTick(dt); }, 100);
function step(dt, now) {
  lastFrameAt = performance.now();
  const run = STATE.mode === 'battle' ? !STATE.paused : true;
  const wdt = run ? dt : 0;
  if (STATE.mode === 'battle' && GAME && PLAYER) {
    if (run) battleUpdate(dt);
    cameraUpdate(dt); if (run) hudUpdate(dt);
    audioAmbient(dt, PLAYER.alive ? Math.abs(PLAYER.spd) / PLAYER.maxV : 0, camera.position.y, WAVES.sea);
  } else if (STATE.mode !== 'boot') {
    for (const s of FLEET) { if (s.removed) continue; if (s.ctrl === 'show') { s.physics(dt); if (Math.hypot(s.x + 2600, s.z + 2200) > 2500) { s.x -= s.fx * 2000; s.z -= s.fz * 2000; WAKE.trails.delete(s.id); } for (const m of s.tur) { m.yaw = m.rest + Math.sin(now / 9000 + m.rest) * .25; m.el = .05; m.t.root.rotation.y = -m.yaw; m.t.pivot.rotation.x = m.el; } } s.visuals(dt); }
    titleCamera(dt); audioAmbient(dt, .2, camera.position.y, WAVES.sea);
  }
  netTick(dt); lobbyTick(dt);
  // sun shadow follows the camera focus
  const fc = (STATE.mode === 'battle' && PLAYER) ? PLAYER : SHOW; if (fc) { const sd = SUN.userData.dir || U.uSunDir.value; SUN.target.position.set(fc.x, 0, fc.z); SUN.position.set(fc.x + sd.x * 1500, sd.y * 1500, fc.z + sd.z * 1500); SUN.target.updateMatrixWorld(); const ext = clamp(fc.S.L * .9, 160, 320); const sc = SUN.shadow.camera; if (sc.right !== ext) { sc.left = sc.bottom = -ext; sc.right = sc.top = ext; sc.updateProjectionMatrix(); } }
  envUpdate(wdt); fxUpdate(wdt);
  renderer.render(scene, camera);
}

/* ---------- boot ---------- */
(async function boot() {
  const step = (p, t) => { $('#ldb').style.width = p + '%'; $('#ldt').textContent = t; return new Promise(r => setTimeout(r, 30)); };
  try {
    await step(10, '海を生成中…'); applyQuality(); buildOcean(); initFx(); WAKE.init(); initShellMesh();
    await step(45, '島と港を生成中…'); titleScene();
    await step(80, '艦隊を準備中…'); STATE.camSnap = 1; STATE.mode = 'title'; titleCamera(.016); renderer.compile(scene, camera);
    await step(100, '出撃準備完了');
  } catch (e) { $('#ldt').textContent = '起動に失敗: ' + e.message; console.error(e); return; }
  requestAnimationFrame(frame);
  setTimeout(() => { $('#loading').style.transition = 'opacity .8s'; $('#loading').style.opacity = 0; setTimeout(() => $('#loading').remove(), 900); }, 200);
  goTitle();
  const room = new URLSearchParams(location.search).get('room');
  if (room) { openMulti(); $('#mpCode').value = room.toUpperCase().slice(0, 8); lobbyStatus('招待リンクから来たね！艦長名を入れて「ルームに入る」を押そう。'); if (SET.name) { $('#mpName').value = SET.name; } }
})();
addEventListener('pointerdown', () => audioInit(), { once: false });
// test hooks (localhost only)
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__it = { FLEET, SHELLS, TORPS, get P() { return PLAYER; }, get G() { return GAME; }, CAM, NET, startFree, startTutorial, launch, storyGame, setMap, sim: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { battleUpdate(dt); envUpdate(dt); if (i % 10 === 0) fxUpdate(dt * 10); } }, step: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) step(dt, performance.now()); } };
// screenshot scenarios for local testing: ?shot=ship:yamato | battle | fire | splash
(function () {
  const q = new URLSearchParams(location.search).get('shot'); if (!q || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  window.__itNoPause = true;
  const go = () => { if (STATE.mode !== 'title' || document.getElementById('loading')) return setTimeout(go, 200);
    const [k, a, b] = q.split(':');
    const run = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) step(dt, performance.now()); };
    if (k === 'ship') { FREE.map = 'nanyo'; FREE.enemy = 'bb'; FREE.dist = 'far'; FREE.sky = b || 'map'; SET.ship = a || 'yamato'; startFree(); run(30); const Q2 = new URLSearchParams(location.search); CAM.yaw = PLAYER.h + +(Q2.get('cy') || 2.1); CAM.pitch = +(Q2.get('cp') || -.18); CAM.dist = +(Q2.get('cd') || .42); PLAYER.tele = 1; PLAYER.spd = +(Q2.get('spd') || PLAYER.spd); run(10); $('#hud').classList.add('hidden'); }
    if (k === 'battle') { FREE.map = a || 'nanyo'; FREE.enemy = 'mixed'; FREE.dist = 'near'; FREE.sky = b || 'map'; SET.ship = 'yamato'; startFree(); run(60); CAM.yaw = PLAYER.h; CAM.pitch = -.02; run(5); }
    if (k === 'fire') { FREE.map = 'nanyo'; FREE.enemy = 'mixed'; FREE.dist = 'near'; FREE.sky = b || 'map'; SET.ship = a || 'yamato'; startFree(); for (const m of PLAYER.tur) m.rl = 0; CAM.yaw = PLAYER.h + 1.2; CAM.pitch = -.004; run(30); for (let i = 0; i < 20; i++) PLAYER.aimMounts(PLAYER.tur, PLAYER.aim, 3, true); MOUSE.lPress = true; run(1); run(+(new URLSearchParams(location.search).get('n') || 12)); CAM.yaw = PLAYER.h + 1.9; CAM.pitch = -.12; CAM.dist = .8; run(1); }
    if (k === 'splash') { FREE.map = 'nanyo'; FREE.enemy = 'bb'; FREE.dist = 'far'; FREE.sky = b || 'map'; startFree(); run(20); for (let i = 0; i < 4; i++) fxSplash(PLAYER.x + 400 + i * 60, PLAYER.z - 300, 460); CAM.yaw = PLAYER.h + .9; CAM.pitch = -.05; run(+(a || 40)); }
    if (k === 'port') { titleScene(); camera.position.set(-3400, 60, -2600); camera.lookAt(-4600, 10, -4600); STATE.mode = 'frozen'; run(5); }
    document.title = 'READY';
  }; setTimeout(go, 300);
})();
