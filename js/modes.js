'use strict';
/* ================= game modes: tutorial, story, free mission, online ================= */
let GAME = null, PLAYER = null;
function safeSpot(x, z, clear = 600) {
  const ok = (a, b) => Math.abs(a) < MAP_HALF - 900 && Math.abs(b) < MAP_HALF - 900 && (!ISL.length || [0, 1, 2, 3, 4, 5, 6, 7].every(k => terrainH(a + Math.cos(k * .785) * clear, b + Math.sin(k * .785) * clear) < -22));
  if (ok(x, z)) return [x, z];
  for (let r = 300; r < 9000; r += 300) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (ok(px, pz)) return [px, pz]; }
  return [x, z];
}
function headTo(x, z, tx, tz) { return Math.atan2(tx - x, -(tz - z)); }
function npc(type, team, x, z, h, o = {}) {
  const D = DIFF[o.diff || (GAME && GAME.diff) || 'normal'] || DIFF.normal;
  const [sx, sz] = o.exact ? [x, z] : safeSpot(x, z, SHIPS[type].L * .8);
  const s = new Ship(type, Object.assign({ team, ctrl: SHIPS[type].kn === 0 ? 'static' : 'ai', x: sx, z: sz, h, spd: SHIPS[type].kn * KN * (o.spd != null ? o.spd : .55), tele: o.tele != null ? o.tele : 5, reloadMul: D.rl, acc: o.acc || 1, ai: mkAI(Object.assign({ diff: o.diff || (GAME && GAME.diff) || 'normal' }, o.ai || {})) }, o));
  return s;
}
function fortAt(team, x, z, label) { const y = Math.max(2, terrainH(x, z)); const s = new Ship('fort', { team, ctrl: 'static', x, z, h: 0, label: label || '沿岸砲台', y, ai: mkAI({ diff: GAME.diff }) }); s.root.position.y = y; s.heave = y; return s; }
function newGame(G) {
  G = Object.assign({ kind: 'free', diff: 'normal', objs: [], t: 0, net: false, radioQ: [], results: null }, G);
  G.obj = (i, st) => { if (G.objs[i] && G.objs[i].st === 0) { G.objs[i].st = st; renderObjs(); if (st === 1) sfxBell(); } };
  return G;
}
function launch(G) {
  clearFleet(); STATE.ended = false; STATE.paused = false;
  GAME = G; setMap(G.map, G.sky, G.sea);
  const pl = G.player; const [px, pz] = pl.exact ? [pl.x, pl.z] : safeSpot(pl.x, pl.z, SHIPS[pl.type].L * .8);
  PLAYER = new Ship(pl.type, { id: pl.id || 'P0', team: pl.team || 0, ctrl: 'player', name: SET.name || '艦長', label: SET.name || '艦長', x: px, z: pz, h: pl.h || 0, spd: SHIPS[pl.type].kn * KN * (pl.spd != null ? pl.spd : .5), tele: pl.tele != null ? pl.tele : 4 });
  G.setup && G.setup(G);
  enterBattleUI();
  if (G.intro) for (const r of G.intro) radio(r[0], r[1], r[2]);
}
function radio(who, text, delay = 0) { if (!GAME) return; GAME.radioQ.push({ who, text, at: GAME.t + delay }); }

/* ---------- tutorial ---------- */
const TUT_STEPS = [
  { t: 'ようこそ、艦長。まずは<kbd>マウス</kbd>を動かして周りを見渡してみよう。<br><small>（画面をクリックするとマウスが固定される。Esc で解除）</small>', chk: G => G.lookAcc > 2.5 },
  { t: '<kbd>W</kbd> を何回か押して速力を「原速」以上にしよう。<kbd>S</kbd> で減速。戦艦は急には加速しない。', chk: () => PLAYER.tele >= 4 },
  { t: '<kbd>A</kbd>（取舵＝左）か <kbd>D</kbd>（面舵＝右）で舵を切ろう。舵が効くまで少し時間がかかるのがリアルなところ。', chk: G => Math.abs(PLAYER.rud) > .45 },
  { t: '<b>右クリック</b> か <kbd>Shift</kbd> を押しっぱなしで「照準器」をのぞこう。<b>ホイール</b>で倍率を変えられる。', chk: G => G.scoped > 1.2 },
  { t: '前方の標的艦に照準を合わせて、<b>左クリック</b>で斉射！ 着弾まで何秒もかかる。画面の「着弾」秒数を見て待とう。', chk: G => G.tgtHit, spawn: G => { const s = npc('cargo', 1, PLAYER.x + PLAYER.fx * 5500 + 600, PLAYER.z + PLAYER.fz * 5500, PLAYER.h + 1.4, { tele: 1, spd: 0, label: '標的艦（停止）', hpMul: 6 }); s.ai = null; G.tgt = s; } },
  { t: '命中！ <kbd>1</kbd> は徹甲弾（AP・装甲を貫く）、<kbd>2</kbd> は榴弾（HE・火災を起こす）。<kbd>2</kbd> を押して榴弾に切り替えよう。', chk: () => PLAYER.ammo === 1 },
  { t: '今度は動く標的だ。砲弾が届くまでに船は進む。<b>進行方向の少し前</b>を狙って撃とう（未来位置射撃）。', chk: G => G.tgt2Hit, spawn: G => { const s = npc('cargo', 1, PLAYER.x + PLAYER.fx * 6500 - 2500, PLAYER.z + PLAYER.fz * 6500, PLAYER.h + Math.PI / 2, { tele: 6, spd: 1, label: '標的艦（航行中）', hpMul: 6 }); s.ai = mkAI({ path: [[s.x + Math.sin(s.h) * 9000, s.z - Math.cos(s.h) * 9000]], tele: 6 }); G.tgt2 = s; } },
  { t: '<span style="color:#ff9a5a">火災発生！</span> 火災は放っておくとじわじわHPが減る。<kbd>R</kbd> で応急修理（ダメコン）。使うとしばらく再使用できない。', chk: () => !PLAYER.fires.length, spawn: () => { PLAYER.addFire(1); PLAYER.addFire(0); } },
  { t: '<kbd>M</kbd> で大きな地図、<kbd>Tab</kbd> で戦況。駆逐艦・巡洋艦は <kbd>T</kbd> で魚雷モードになり、左クリックで魚雷を撃てる。<br>最後に、敵の駆逐艦1隻を撃沈しよう！', chk: G => G.dd && !G.dd.alive, spawn: G => { G.dd = npc('fletcher', 1, PLAYER.x + PLAYER.fx * 9000, PLAYER.z + PLAYER.fz * 9000, PLAYER.h + Math.PI, { diff: 'easy', label: '敵駆逐艦' }); G.dd.ai.range = 7000; G.dd.torp.forEach(m => m.rl = 9999); } },
  { t: 'チュートリアル完了！ これで艦長として十分戦える。ストーリーやマルチプレイに挑戦しよう。', chk: () => false }
];
function startTutorial() {
  const G = newGame({ kind: 'tutorial', title: 'チュートリアル', map: 'nanyo', sky: 'day', sea: .45, diff: 'easy', player: { type: 'yamato', x: -1500, z: 8200, h: 0, tele: 3, spd: .35 }, step: -1, lookAcc: 0, scoped: 0,
    objs: [{ t: '訓練課程を修了する', st: 0 }],
    tick(G, dt) {
      if (G.step < 0 || TUT_STEPS[G.step].chk(G)) { if (G.step >= 0) sfxBell(); G.step++; const S = TUT_STEPS[G.step]; if (S.spawn) S.spawn(G); $('#tut').innerHTML = S.t; $('#tut').classList.remove('hidden'); if (G.step === TUT_STEPS.length - 1) { G.obj(0, 1); setTimeout(() => endBattle(true, '訓練完了', '基本操作はばっちり。次は本番だ。'), 6000); } }
      if (MOUSE.r || KEYS.ShiftLeft || KEYS.ShiftRight) G.scoped += dt;
    } });
  G.onHit = (sh, s, type) => { if (!s.mine) return; if (sh === G.tgt) G.tgtHit = true; if (sh === G.tgt2) G.tgt2Hit = true; };
  launch(G);
}

/* ---------- story ---------- */
const CHAPTERS = [
  { n: '第一話', t: '黎明の出撃', s: '母港・蒼浦湾／早朝', map: 'bokou', brief: '蒼海連邦の母港・蒼浦湾。夜明けの靄の中、鉄冠同盟の駆逐隊が湾口に機雷を撒こうと接近している。\n\n就役したばかりの戦艦「大和」はこれが初陣だ。護衛の駆逐艦「雪風」「磯風」と共に、湾口に迫る敵駆逐隊を撃退せよ。\n\n敵駆逐艦は小さく速い。榴弾（2キー）で手早く仕留めるのが定石だ。魚雷の航跡に注意。',
    objs: ['敵駆逐隊（4隻）を撃退する', '大和を沈めない'],
    setup(G) { const bx = -3700, bz = -3700, h = 135 * DEG;
      npc('shimakaze', 0, bx - 500, bz + 300, h, { label: '雪風', ai: { follow: PLAYER, off: [-500, 400] } }); npc('shimakaze', 0, bx + 400, bz - 500, h, { label: '磯風', ai: { follow: PLAYER, off: [500, 400] } });
      G.enemies = [0, 1, 2, 3].map(i => npc('fletcher', 1, 5200 + i * 700, 2500 + i * 900, -60 * DEG, { label: '敵駆逐艦', ai: { range: 7500 } }));
      G.player.x = bx; G.player.z = bz; },
    player: { type: 'yamato', x: -3700, z: -3700, h: 135 * DEG, tele: 4 },
    intro: [['司令部', '大和、出撃を許可する。湾口の敵駆逐隊を叩け。', 1], ['雪風', 'こちら雪風。大和の両翼を固めます！', 6], ['見張員', '敵駆逐艦、右舷前方に4隻！距離およそ1万！', 20]],
    tick(G) { if (G.enemies.every(e => !e.alive)) { G.obj(0, 1); G.obj(1, 1); win(G, '湾口の敵駆逐隊は壊滅した。大和の初陣は完勝だ。'); } } },
  { n: '第二話', t: '護衛の海', s: '外洋／曇天・荒天', map: 'gaiyou', brief: '物資を積んだ輸送船3隻が、荒れた外洋を北へ向かう。鉄冠同盟は巡洋艦部隊を差し向けてきた。\n\n大和は輸送船団の護衛につく。輸送船は足が遅く、反撃もできない。敵を輸送船に近づけるな。\n\nうねりが大きいと艦が揺れ、照準もぶれる。落ち着いて狙え。',
    objs: ['輸送船を2隻以上守り抜く', '敵の襲撃部隊をすべて撃沈する'],
    player: { type: 'yamato', x: 1200, z: 8600, h: 0, tele: 3 },
    setup(G) { G.convoy = [-600, 0, 600].map((dx, i) => { const s = npc('cargo', 0, dx, 9400 + i * 500, 0, { label: '輸送船' + '一二三'[i] + '号', spd: .8, tele: 4 }); s.ai = mkAI({ path: [[dx * 1.5, -11000]], tele: 4 }); return s; });
      G.enemies = [0, 1, 2].map(i => npc('fletcher', 1, 7000 + i * 600, -2000 - i * 600, 200 * DEG, { label: '敵駆逐艦', ai: { hunt: 1, range: 6000 } })); G.wave = 1; },
    intro: [['輸送船団', '大和の護衛、心強い。よろしく頼む！', 2], ['見張員', '北東より敵駆逐艦3！輸送船を狙っています！', 14]],
    tick(G) {
      if (G.wave === 1 && (G.t > 150 || G.enemies.every(e => !e.alive))) { G.wave = 2; radio('見張員', '北西に新たな敵影！重巡2、駆逐2！', 0);
        G.enemies.push(npc('takao', 1, -8000, -3000, 150 * DEG, { label: '敵重巡', ai: { hunt: 1 } }), npc('takao', 1, -8800, -2200, 150 * DEG, { label: '敵重巡', ai: { hunt: 1 } }), npc('fletcher', 1, -7200, -4000, 150 * DEG, { label: '敵駆逐艦', ai: { hunt: 1 } }), npc('fletcher', 1, -9400, -1500, 150 * DEG, { label: '敵駆逐艦', ai: { hunt: 1 } })); }
      const lost = G.convoy.filter(s => !s.alive).length;
      if (lost >= 2) { G.obj(0, -1); lose(G, '輸送船団は壊滅した……物資は届かなかった。'); return; }
      if (G.wave === 2 && G.enemies.every(e => !e.alive)) { G.obj(0, 1); G.obj(1, 1); win(G, '輸送船' + (3 - lost) + '隻が無事に港へ。前線の兵たちに物資が届く。'); }
    } },
  { n: '第三話', t: '海峡突破', s: '鉄冠海峡／夕暮れ', map: 'kaikyou', brief: '同盟艦隊の拠点へ通じる細い海峡。出口には戦艦「ビスマルク」を旗艦とする敵艦隊が待ち構えている。\n\n味方の戦艦「長門」と駆逐艦2隻が同行する。海峡は狭く、左右の山に囲まれている。座礁に注意しながら敵旗艦を撃沈せよ。\n\n夕日を背にした敵は見えにくい。照準器の倍率を上げて狙え。',
    objs: ['敵旗艦ビスマルクを撃沈する', '長門を失わない'],
    player: { type: 'yamato', x: 300, z: 9800, h: 0, tele: 4 },
    setup(G) { G.nagato = npc('nagato', 0, -500, 10600, 0, { label: '長門', ai: { follow: PLAYER, off: [-200, 900] } });
      npc('shimakaze', 0, 900, 9000, 0, { label: '天津風', ai: { follow: PLAYER, off: [700, -400] } }); npc('shimakaze', 0, -900, 9100, 0, { label: '時津風', ai: { follow: PLAYER, off: [-700, -400] } });
      G.boss = npc('bismarck', 1, 0, -6500, Math.PI, { label: '敵旗艦 ビスマルク', boss: true, hpMul: 1.15, ai: { hold: [0, -6000, 2500], engage: 16000 } });
      G.enemies = [G.boss, npc('kongo', 1, -900, -7600, Math.PI, { label: '敵戦艦', ai: { hold: [-800, -7000, 2500], engage: 15000 } }), npc('fletcher', 1, 900, -3500, Math.PI, { label: '敵駆逐艦' }), npc('fletcher', 1, -400, -3000, Math.PI, { label: '敵駆逐艦' }), npc('fletcher', 1, 400, -9000, Math.PI, { label: '敵駆逐艦' })]; },
    intro: [['長門', 'こちら長門。大和の後ろにつく。存分にやってくれ。', 2], ['司令部', '海峡出口に敵主力。旗艦ビスマルクを沈めれば、敵は総崩れになる。', 9]],
    tick(G) { if (!G.nagato.alive && G.objs[1].st === 0) { G.obj(1, -1); radio('天津風', '長門が……！くそっ！', 0); }
      if (!G.boss.alive) { G.obj(0, 1); if (G.nagato.alive) G.obj(1, 1); win(G, '旗艦を失った敵艦隊は海峡から撤退した。道は開かれた。'); } } },
  { n: '第四話', t: '南洋の嵐', s: '南洋群島／嵐', map: 'nanyo', sky: 'overcast', sea: 1.1, brief: '南洋の島に同盟軍が要塞砲台を築いた。30.5cm沿岸砲3基が周囲の海を制圧している。\n\n嵐の中、島影に潜む敵艦隊と砲台を同時に相手取る厳しい戦いになる。砲台は動かないが装甲が厚い。徹甲弾で叩き潰せ。\n\n島の陰に入れば砲台の射線から隠れられる。地形を味方につけろ。',
    objs: ['沿岸砲台3基を破壊する', '敵艦隊を撃滅する'],
    player: { type: 'yamato', x: -2000, z: 9200, h: 20 * DEG, tele: 4 },
    setup(G) { const I = ISL.find(i => i.x === 6300); const pts = []; for (let a = 0; a < Math.PI * 2 && pts.length < 3; a += .07) { const r = I.r * .78, x = I.x + Math.cos(a + 2.2) * r, z = I.z + Math.sin(a + 2.2) * r * (I.e || 1); const h = terrainH(x, z); if (h > 15 && h < 120 && (!pts.length || pts.every(p => Math.hypot(p[0] - x, p[1] - z) > 900))) pts.push([x, z]); }
      G.forts = pts.map((p, i) => fortAt(1, p[0], p[1], '沿岸砲台' + (i + 1)));
      G.enemies = [npc('iowa', 1, 3500, -6500, 200 * DEG, { label: '敵戦艦', ai: { engage: 14000, hold: [3000, -5000, 3000] } }), npc('takao', 1, 1000, -3500, 180 * DEG, { label: '敵重巡' }), npc('takao', 1, 7500, 1200, 250 * DEG, { label: '敵重巡' }), npc('fletcher', 1, -1000, -1800, 180 * DEG, { label: '敵駆逐艦' }), npc('fletcher', 1, 3000, 2500, 230 * DEG, { label: '敵駆逐艦' })];
      npc('takao', 0, -2800, 10000, 20 * DEG, { label: '愛宕', ai: { follow: PLAYER, off: [-600, 600] } }); npc('shimakaze', 0, -1300, 9900, 20 * DEG, { label: '野分', ai: { follow: PLAYER, off: [600, 500] } }); },
    intro: [['愛宕', 'ひどい嵐ね……大和、砲台の位置は東の大きな島よ。', 2], ['見張員', '島の稜線に発砲炎！砲台が撃ってきます！', 30]],
    tick(G) { if (G.forts.every(f => !f.alive)) G.obj(0, 1); if (G.enemies.every(e => !e.alive)) G.obj(1, 1); if (G.objs[0].st === 1 && G.objs[1].st === 1) win(G, '砲台は沈黙し、南洋の制海権は連邦の手に戻った。'); } },
  { n: '第五話', t: '蒼の残光', s: '外洋／夜明け', map: 'gaiyou', sky: 'dawn', sea: .8, brief: 'ついに鉄冠同盟の主力艦隊が姿を現した。旗艦は全長345m、50.8cm砲を積む超巨大戦艦「H-44」。\n\n連邦艦隊の全戦力——長門、金剛、高雄、駆逐艦隊——が大和と共に最後の決戦に挑む。\n\n敵旗艦を沈めれば、この戦争は終わる。大和、往け。',
    objs: ['敵超巨大戦艦 H-44 を撃沈する'],
    player: { type: 'yamato', x: 0, z: 8500, h: 0, tele: 4 },
    setup(G) { npc('nagato', 0, -1600, 9200, 0, { label: '長門', ai: { follow: PLAYER, off: [-1200, 800] } }); npc('kongo', 0, 1600, 9200, 0, { label: '金剛', ai: { follow: PLAYER, off: [1200, 800] } });
      npc('takao', 0, -3000, 7600, 0, { label: '高雄' }); [-2200, -800, 800, 2200].forEach((x, i) => npc(i % 2 ? 'shimakaze' : 'fletcher', 0, x, 7000, 0, { label: ['雪風', '天津風', '初月', '磯風'][i] }));
      G.boss = npc('h44', 1, 0, -8000, Math.PI, { label: '敵旗艦 H-44', boss: true, hpMul: 1.1, ai: { engage: 20000, range: 14000 } });
      G.enemies = [G.boss, npc('montana', 1, -2500, -7600, Math.PI, { label: '敵戦艦 モンタナ', hpMul: .75 }), npc('iowa', 1, 2500, -7400, Math.PI, { label: '敵戦艦' }), npc('takao', 1, -4500, -6000, Math.PI, { label: '敵重巡' }), ...[-1500, -500, 500, 1500].map(x => npc('fletcher', 1, x, -5000, Math.PI, { label: '敵駆逐艦' }))]; },
    intro: [['司令部', '全艦、大和に続け。これが最後の戦いだ。', 2], ['長門', '大和、背中は任せろ！', 7], ['見張員', '水平線に敵影多数……あの巨大な艦影は、H-44！', 18]],
    tick(G) { if (!G.boss.alive) { G.obj(0, 1); win(G, '超巨大戦艦H-44は、朝日の中に沈んでいった。\n\n鉄冠同盟は降伏を申し入れ、長い戦争は終わった。\n\n傷だらけの大和は、ゆっくりと蒼浦湾へ帰っていく。\n\n—— 完 ——'); } } }
];
function storyGame(i) {
  const C = CHAPTERS[i];
  const G = newGame({ kind: 'story', ch: i, title: C.n + '「' + C.t + '」', map: C.map, sky: C.sky, sea: C.sea, diff: SET.storyDiff || 'normal', player: Object.assign({}, C.player), objs: C.objs.map(t => ({ t, st: 0 })), intro: C.intro,
    setup: C.setup, tick: (G, dt) => C.tick(G, dt) });
  return G;
}
function win(G, text) { if (STATE.ended) return; endBattle(true, '作戦成功', text); }
function lose(G, text) { if (STATE.ended) return; endBattle(false, '作戦失敗', text); }

/* ---------- free mission ---------- */
const FREE = Object.assign({ map: 'nanyo', sky: 'map', sea: 'map', enemy: 'mixed', ally: 'none', diff: 'normal', dist: 'mid' }, ls('irontide-free') || {});
const FREE_OPT = {
  sky: { map: '海域標準', day: '昼', dawn: '早朝', dusk: '夕暮れ', overcast: '曇天', night: '夜戦' },
  sea: { map: '海域標準', '.2': 'べた凪', '.6': 'やや波', '1.0': '時化', '1.5': '大時化' },
  enemy: { dd: '駆逐隊（駆逐艦4）', cruiser: '巡洋艦隊（重巡2＋駆逐2）', bb: '戦艦1対1', mixed: '混成艦隊（戦艦2＋重巡1＋駆逐3）', armada: '大艦隊（戦艦3＋重巡2＋駆逐4）' },
  ally: { none: 'なし（単艦）', small: '駆逐艦2', fleet: '艦隊（戦艦1＋重巡1＋駆逐2）' },
  diff: { easy: 'イージー', normal: 'ノーマル', hard: 'ハード', ace: 'エース' },
  dist: { near: '近距離 8km', mid: '中距離 14km', far: '遠距離 20km' }
};
function startFree() {
  ls('irontide-free', FREE);
  const D = { near: 8000, mid: 14000, far: 20000 }[FREE.dist], half = D / 2;
  const G = newGame({ kind: 'free', title: 'フリーミッション', map: FREE.map, sky: FREE.sky === 'map' ? null : FREE.sky, sea: FREE.sea === 'map' ? null : +FREE.sea, diff: FREE.diff,
    player: { type: SET.ship, x: 0, z: half, h: 0, tele: 4 }, objs: [{ t: '敵艦隊を全滅させる', st: 0 }],
    setup(G) {
      const comp = { dd: ['fletcher', 'fletcher', 'fletcher', 'fletcher'], cruiser: ['takao', 'takao', 'fletcher', 'fletcher'], bb: [pick(['iowa', 'bismarck', 'nagato', 'montana'])], mixed: ['iowa', 'bismarck', 'takao', 'fletcher', 'fletcher', 'fletcher'], armada: ['montana', 'iowa', 'bismarck', 'takao', 'takao', 'fletcher', 'fletcher', 'fletcher', 'fletcher'] }[FREE.enemy];
      G.enemies = comp.map((t, i) => npc(t, 1, (i - (comp.length - 1) / 2) * 900, -half - (SHIPS[t].cls === 'BB' ? 1200 : 0), Math.PI, { label: '敵' + CLS_N[SHIPS[t].cls] + '（' + SHIPS[t].n + '）' }));
      const al = { none: [], small: ['shimakaze', 'fletcher'], fleet: ['nagato', 'takao', 'shimakaze', 'fletcher'] }[FREE.ally];
      al.forEach((t, i) => npc(t, 0, (i % 2 ? 1 : -1) * (700 + i * 300), half + 600 + i * 200, 0, { label: SHIPS[t].n, ai: { follow: PLAYER, off: [(i % 2 ? 1 : -1) * (700 + i * 200), 500 + i * 300] } }));
    },
    tick(G) { if (G.enemies.every(e => !e.alive)) { G.obj(0, 1); win(G, '敵艦隊を全滅させた。'); } } });
  launch(G);
}

/* ---------- online lobby & match ---------- */
const LOBBY = { ship: SET.ship || 'yamato', team: 0, ready: false, cfg: Object.assign({ mode: 'team', map: 'nanyo', diff: 'normal', bots: 1 }, ls('irontide-mpcfg') || {}) };
const MODE_N = { ffa: '対戦（個人戦）', team: 'チーム戦', coop: '協力ボス戦' };
const COOP_DIFF = { easy: { n: 'イージー', boss: 'montana', lives: -1, hp: .8, esc: ['fletcher', 'fletcher', 'takao'] }, normal: { n: 'ノーマル', boss: 'montana', lives: 2, hp: 1, esc: ['iowa', 'takao', 'fletcher', 'fletcher'] }, hard: { n: 'ハード', boss: 'h44', lives: 1, hp: 1, esc: ['montana', 'bismarck', 'takao', 'fletcher', 'fletcher'] }, ace: { n: '地獄', boss: 'h44', lives: 0, hp: 1.25, esc: ['montana', 'iowa', 'bismarck', 'takao', 'takao', 'fletcher', 'fletcher', 'fletcher'] } };
function netStartMatch() { // leader only
  const ps = roomPeers(), ids = ps.map(p => p.peer).sort(), c = LOBBY.cfg;
  const teams = {}, ships = {}, names = {};
  for (const p of ps) { const pr = p.isMe ? buildPresence() : p.presence; teams[p.peer] = c.mode === 'team' ? (pr.tm | 0) : c.mode === 'coop' ? 0 : 0; ships[p.peer] = SHIPS[pr.sh] && PLAYABLE.includes(pr.sh) ? pr.sh : 'yamato'; names[p.peer] = String(pr.n || '艦長').slice(0, 12); }
  if (c.mode === 'ffa') ids.forEach((id, i) => teams[id] = 100 + i);
  NET.mt = { id: Math.random().toString(36).slice(2, 8), mode: c.mode, map: c.map, diff: c.diff, bots: c.bots, ids, teams, ships, names, seed: (Math.random() * 1e9) | 0 };
}
function netMatchSpawn(mt, peer) {
  const i = mt.ids.indexOf(peer), n = mt.ids.length;
  if (mt.mode === 'ffa') { const a = i / n * Math.PI * 2 + .4, r = 8200; const x = Math.cos(a) * r, z = Math.sin(a) * r; return [x, z, headTo(x, z, 0, 0)]; }
  if (mt.mode === 'coop') { const x = (i - (n - 1) / 2) * 1300; return [x, 8600, 0]; }
  const tm = mt.teams[peer], mates = mt.ids.filter(id => mt.teams[id] === tm), k = mates.indexOf(peer); const x = (k - (mates.length - 1) / 2) * 1500;
  return tm === 0 ? [x, 9300, 0] : [-x, -9300, Math.PI];
}
function startNetMatch(mt) {
  const peer = NET.me, [x, z, h] = netMatchSpawn(mt, peer), myTeam = mt.teams[peer] != null ? mt.teams[peer] : 0;
  NET.life = 0; NET.seen = {}; NET.evRing = [];
  const cd = COOP_DIFF[mt.diff] || COOP_DIFF.normal;
  const G = newGame({ kind: 'net', net: true, mid: mt.id, mt, title: MODE_N[mt.mode], map: mt.map, diff: mt.mode === 'coop' ? (mt.diff === 'ace' ? 'ace' : mt.diff) : 'normal',
    player: { type: mt.ships[peer] || LOBBY.ship, x, z, h, team: myTeam, id: 'P' + peer + '_0', tele: 4 }, lives: mt.mode === 'coop' ? cd.lives : 0, respawnT: 0,
    objs: mt.mode === 'coop' ? [{ t: '敵旗艦（' + SHIPS[cd.boss].n + '）を撃沈する', st: 0 }, { t: '護衛艦隊を撃滅する', st: 0 }] : mt.mode === 'team' ? [{ t: '敵チームを全滅させる', st: 0 }] : [{ t: '最後まで生き残る', st: 0 }],
    setup(G) {
      if (isLeader()) {
        if (mt.mode === 'coop') { const n = mt.ids.length; G.boss = npc(cd.boss, 1, 0, -6500, Math.PI, { label: '敵旗艦 ' + SHIPS[cd.boss].n, boss: true, hpMul: cd.hp * (.6 + .4 * n), diff: mt.diff, ai: { range: 13000, engage: 22000 } });
          cd.esc.forEach((t, i) => npc(t, 1, (i - (cd.esc.length - 1) / 2) * 1100, -5200 - (SHIPS[t].cls === 'BB' ? 1500 : 0), Math.PI, { label: '敵' + CLS_N[SHIPS[t].cls], diff: mt.diff, hpMul: .8 + .15 * n }));
          G.reinf = false; }
        if (mt.mode === 'team' && mt.bots) { for (const tm of [0, 1]) { const have = mt.ids.filter(id => mt.teams[id] === tm).length; for (let k = have; k < 4; k++) { const t = ['iowa', 'bismarck', 'takao', 'fletcher', 'nagato', 'shimakaze'][(k + tm * 2) % 6]; const xx = (k - 1.5) * 1500 + 400; npc(t, tm, tm ? -xx : xx, tm ? -10200 : 10200, tm ? Math.PI : 0, { label: 'NPC ' + SHIPS[t].n, diff: 'normal' }); } } }
        if (mt.mode === 'ffa' && mt.bots && mt.ids.length < 4) { for (let k = mt.ids.length; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 2.1, t = ['iowa', 'bismarck', 'nagato', 'takao'][k]; npc(t, 200 + k, Math.cos(a) * 8000, Math.sin(a) * 8000, headTo(Math.cos(a), Math.sin(a), 0, 0), { label: 'NPC ' + SHIPS[t].n }); } }
      }
    },
    netState() { return GAME.res ? { res: GAME.res } : null; },
    applyNetState(gs) { if (gs && gs.res && !STATE.ended) finishNet(gs.res); },
    tick(G, dt) {
      // respawn in co-op
      if (!PLAYER.alive && mt.mode === 'coop' && (G.lives < 0 || NET.life < G.lives)) { G.respawnT += dt; if (G.respawnT > 12) { G.respawnT = 0; NET.life++; const [rx, rz, rh] = netMatchSpawn(mt, peer); const [sx, sz] = safeSpot(rx, rz + 1500, 500);
        PLAYER = new Ship(mt.ships[peer] || LOBBY.ship, { id: 'P' + peer + '_' + NET.life, team: 0, ctrl: 'player', name: SET.name, label: SET.name, x: sx, z: sz, h: rh, spd: 6, tele: 4 }); buildGunHud(); toast('再出撃！ 残り ' + (G.lives < 0 ? '∞' : (G.lives - NET.life))); } }
      if (!isLeader() || G.res) return;
      const players = FLEET.filter(s => s.ctrl === 'player' || s.ctrl === 'remote'), all = FLEET.filter(s => !s.removed && s.S.cls !== 'AP');
      if (mt.mode === 'coop') {
        const en = FLEET.filter(s => s.team === 1 && (s.ctrl === 'ai' || s.ctrl === 'static'));
        if (G.boss && !G.reinf && G.boss.hp < G.boss.maxHp * .5) { G.reinf = true; ['fletcher', 'fletcher', cd.boss === 'h44' ? 'iowa' : 'takao'].forEach((t, i) => npc(t, 1, -7000 + i * 7000, -9500, Math.PI, { label: '敵増援', diff: mt.diff })); }
        if (G.t > 5 && en.length && en.every(s => !s.alive)) G.res = { win: 'coop', t: Date.now() };
        const outOfLives = G.lives >= 0 && NET.life >= G.lives;
        const anyAlive = players.some(s => s.alive) || (mt.mode === 'coop' && (!outOfLives && !PLAYER.alive));
        if (G.t > 5 && !anyAlive && remotesOutOfLives(G)) G.res = { win: 'enemy', t: Date.now() };
      } else if (mt.mode === 'team') {
        const a0 = all.some(s => s.team === 0 && s.alive), a1 = all.some(s => s.team === 1 && s.alive);
        if (G.t > 5 && (!a0 || !a1)) G.res = { win: a0 ? 0 : a1 ? 1 : -1, t: Date.now() };
      } else {
        const alive = all.filter(s => s.alive); if (G.t > 5 && alive.length <= 1 && all.length > 1) G.res = { win: alive[0] ? alive[0].id : null, t: Date.now() };
      }
      if (G.res) finishNet(G.res);
    } });
  G.onRemoteJoin = s => {};
  launch(G);
}
function remotesOutOfLives(G) { // remote players publish their life counter; treat a dead remote as out only after their last life
  for (const p of roomPeers()) { if (p.isMe) continue; const pr = p.presence; if (!pr || pr.mid !== G.mid) continue; if (pr.al) return false; if (G.lives < 0 || (pr.life | 0) < G.lives) return false; }
  return true;
}
function finishNet(res) {
  if (STATE.ended) return; GAME.res = res; const mt = GAME.mt; let won = false, title, text;
  if (mt.mode === 'coop') { won = res.win === 'coop'; title = won ? '撃滅成功' : '艦隊全滅'; text = won ? '協力して敵旗艦を沈めた！' : '全艦が沈んだ……。難易度を下げて再挑戦しよう。'; }
  else if (mt.mode === 'team') { won = res.win === PLAYER.team; title = res.win === -1 ? '引き分け' : won ? '勝利' : '敗北'; text = res.win === -1 ? '両軍とも全滅した。' : (res.win === 0 ? '蒼チーム' : '紅チーム') + 'の勝利。'; }
  else { const w = shipById(res.win); won = res.win === PLAYER.id; title = won ? '勝利' : '敗北'; text = w ? (w.label || w.name) + ' が最後まで生き残った。' : '全艦沈没。'; }
  if (GAME.objs[0]) GAME.objs[0].st = won ? 1 : -1; renderObjs();
  endBattle(won, title, text);
}
