'use strict';
/* ================= ship data (real dimensions) + procedural 3D models + ballistics ================= */
// mounts: [z (m from midships, − = bow), x (m, + = starboard), extra height above deck, faces aft?]
const SHIPS = {
  yamato: { n: '大和', en: 'YAMATO', cls: 'BB', nat: 'jp', natN: '日本', year: 1941, dsp: '72,800 t',
    desc: '史上最大の戦艦。46cm（18.1インチ）砲9門は1発1.46トンの砲弾を40km先まで届かせる。410mmの装甲帯は同世代の戦艦砲をほぼ受け止める。速力は控えめだが、正面から殴り合えばまず負けない。',
    L: 263, B: 38.9, T: 10.4, fb: [11.2, 8.6, 6.6], sternW: .55, kn: 27, accT: 60, turnD: 640, rudT: 13, hp: 98000,
    armor: { belt: 410, deck: 200, ext: 30, sup: 25 },
    main: { cal: 460, Lc: 45, n: 3, mv: 780, m: 1460, rl: 30, trav: 3.2, ev: 45, maxR: 26000, sig: .85, mounts: [[-63, 0, 0], [-45, 0, 3.5], [52, 0, 0, 1]] },
    sec: [{ cal: 155, n: 3, mv: 920, m: 55.9, rl: 7, rng: 7000, mounts: [[-28, 0, 7.2], [37, 0, 3.2, 1]] }, { cal: 127, n: 2, mv: 720, m: 23, rl: 4.5, rng: 5500, mounts: [[-6, 11, 4.2], [-6, -11, 4.2], [5, 11.5, 4.2], [5, -11.5, 4.2], [16, 11, 4.2], [16, -11, 4.2]] }],
    sty: { tower: 'pagoda', tz: -17, th: 27, tw: 10.5, rf: 15, house: [-36, 34], funnels: [[5, 3.4, 24, 15]], masts: [26], hull: 0x5d6268, deck: 'wood', cat: 1 } },
  shinano: { n: '超大和型', en: 'SUPER YAMATO', cls: 'BB', nat: 'jp', natN: '日本（計画艦）', year: '計画', dsp: '約 85,000 t（推定）',
    desc: '大和の後継として計画された幻の戦艦（A-150）。51cm連装砲3基を搭載。実在しない計画艦なので、性能の一部は推定値。圧倒的な一撃と引き換えに、装填はさらに遅い。',
    L: 280, B: 40, T: 11, fb: [11.6, 8.8, 6.8], sternW: .55, kn: 28, accT: 62, turnD: 680, rudT: 14, hp: 106000,
    armor: { belt: 460, deck: 230, ext: 32, sup: 25 },
    main: { cal: 510, Lc: 45, n: 2, mv: 790, m: 1950, rl: 36, trav: 3, ev: 45, maxR: 26000, sig: .9, mounts: [[-66, 0, 0], [-48, 0, 3.8], [56, 0, 0, 1]] },
    sec: [{ cal: 100, n: 2, mv: 1000, m: 13, rl: 3, rng: 7000, mounts: [[-8, 12, 4.5], [-8, -12, 4.5], [4, 12.5, 4.5], [4, -12.5, 4.5], [16, 12, 4.5], [16, -12, 4.5], [28, 11, 4], [28, -11, 4]] }],
    sty: { tower: 'pagoda', tz: -18, th: 28, tw: 11, rf: 15, house: [-38, 36], funnels: [[6, 3.5, 24, 15]], masts: [28], hull: 0x5a5f65, deck: 'wood', cat: 1 } },
  nagato: { n: '長門', en: 'NAGATO', cls: 'BB', nat: 'jp', natN: '日本', year: 1920, dsp: '39,130 t',
    desc: '世界初の16インチ（41cm）砲戦艦。高くそびえる檣楼（パゴダマスト）が特徴。大和より小柄で速く、装填も早い。バランスの良い主力戦艦。',
    L: 224.9, B: 34.6, T: 9.5, fb: [9.8, 7.6, 6], sternW: .5, kn: 25, accT: 50, turnD: 600, rudT: 12, hp: 76000,
    armor: { belt: 305, deck: 120, ext: 25, sup: 20 },
    main: { cal: 410, Lc: 45, n: 2, mv: 790, m: 1020, rl: 27, trav: 3.5, ev: 43, maxR: 24000, sig: 1, mounts: [[-67, 0, 0], [-52, 0, 3.2], [38, 0, 3.2, 1], [53, 0, 0, 1]] },
    sec: [{ cal: 140, n: 1, mv: 850, m: 38, rl: 6, rng: 7500, mounts: [[-34, 9.6, 1.2], [-34, -9.6, 1.2], [-24, 10.4, 1.2], [-24, -10.4, 1.2], [-14, 10.8, 1.2], [-14, -10.8, 1.2]] }],
    sty: { tower: 'pagoda', tz: -33, th: 34, tw: 6.5, rf: 10, house: [-42, 26], funnels: [[-12, 1.9, 14, 12]], masts: [16], hull: 0x6a6f75, deck: 'wood' } },
  kongo: { n: '金剛', en: 'KONGO', cls: 'BB', nat: 'jp', natN: '日本', year: 1913, dsp: '32,200 t',
    desc: '英国で建造された巡洋戦艦を改装した高速戦艦。30ノットの快速で戦場を駆け回れる。装甲は薄いので、遠距離から撃って回避するのが基本。',
    L: 222, B: 31, T: 9.7, fb: [9.2, 7, 5.6], sternW: .48, kn: 30, accT: 42, turnD: 620, rudT: 11, hp: 62000,
    armor: { belt: 203, deck: 70, ext: 25, sup: 19 },
    main: { cal: 356, Lc: 45, n: 2, mv: 775, m: 673, rl: 22, trav: 4.5, ev: 43, maxR: 22000, sig: 1.05, mounts: [[-70, 0, 0], [-56, 0, 3], [22, 0, 0, 1], [56, 0, 0, 1]] },
    sec: [{ cal: 152, n: 1, mv: 850, m: 45, rl: 6, rng: 7500, mounts: [[-38, 9, 1.2], [-38, -9, 1.2], [-28, 9.6, 1.2], [-28, -9.6, 1.2], [-16, 9.8, 1.2], [-16, -9.8, 1.2]] }],
    sty: { tower: 'pagoda', tz: -40, th: 28, tw: 6, rf: 8, house: [-48, 14], funnels: [[-20, 1.7, 14, 6], [4, 1.7, 14, 4]], masts: [12], hull: 0x6c7177, deck: 'wood' } },
  iowa: { n: 'アイオワ', en: 'IOWA', cls: 'BB', nat: 'us', natN: 'アメリカ', year: 1943, dsp: '57,540 t',
    desc: '米海軍最後の戦艦級。33ノットという戦艦離れした速力と、高初速の16インチ（406mm）砲、そして優秀なレーダー射撃管制を持つ。速さで有利な距離を選べる。',
    L: 270.4, B: 33, T: 11, fb: [11.4, 7.4, 6], sternW: .5, kn: 33, accT: 48, turnD: 740, rudT: 12, hp: 90000,
    armor: { belt: 307, deck: 153, ext: 27, sup: 25 },
    main: { cal: 406, Lc: 50, n: 3, mv: 762, m: 1225, rl: 30, trav: 4, ev: 45, maxR: 25000, sig: .9, mounts: [[-73, 0, 0], [-55, 0, 3.4], [58, 0, 0, 1]] },
    sec: [{ cal: 127, n: 2, mv: 792, m: 25, rl: 3.5, rng: 5500, mounts: [[-32, 10.2, 4], [-32, -10.2, 4], [-21, 11, 4], [-21, -11, 4], [-10, 11, 4], [-10, -11, 4], [1, 11, 4], [1, -11, 4], [12, 10.4, 4], [12, -10.4, 4]] }],
    sty: { tower: 'us', tz: -32, th: 26, tw: 9, rf: 8, house: [-42, 30], funnels: [[-8, 2.9, 0, 16], [14, 2.8, 0, 15]], masts: [-2], hull: 0x5d6670, deck: 'navy' } },
  bismarck: { n: 'ビスマルク', en: 'BISMARCK', cls: 'BB', nat: 'de', natN: 'ドイツ', year: 1940, dsp: '50,300 t',
    desc: '欧州最強とうたわれた戦艦。38cm砲8門は初速が速く、近〜中距離での命中率と貫通力に優れる。分厚い装甲と浸水に強い構造で、とにかく沈みにくい。バルト海迷彩付き。',
    L: 251, B: 36, T: 9.3, fb: [10.6, 8, 6.4], sternW: .5, kn: 30, accT: 48, turnD: 620, rudT: 11, hp: 88000,
    armor: { belt: 320, deck: 120, ext: 60, sup: 25 },
    main: { cal: 380, Lc: 47, n: 2, mv: 820, m: 800, rl: 26, trav: 5, ev: 30, maxR: 24000, sig: .95, mounts: [[-74, 0, 0], [-59, 0, 3.2], [45, 0, 3.2, 1], [61, 0, 0, 1]] },
    sec: [{ cal: 150, n: 2, mv: 875, m: 45.3, rl: 6.5, rng: 6500, mounts: [[-22, 10.4, 3.4], [-22, -10.4, 3.4], [-8, 11, 3.4], [-8, -11, 3.4], [14, 10.6, 3.4], [14, -10.6, 3.4]] }],
    sty: { tower: 'de', tz: -34, th: 24, tw: 8, rf: 10.5, house: [-44, 34], funnels: [[-8, 3.4, 0, 13.5]], masts: [24], hull: 0x7a8088, deck: 'wood', camo: 1 } },
  takao: { n: '高雄', en: 'TAKAO', cls: 'CA', nat: 'jp', natN: '日本', year: 1932, dsp: '15,875 t',
    desc: '巨大な艦橋をもつ重巡洋艦。20.3cm砲10門の手数と、酸素魚雷「九三式」を16射線積む。戦艦と真正面から撃ち合うのは厳しいが、魚雷の一撃で大物を沈められる。',
    L: 203.8, B: 20.7, T: 6.1, fb: [8.2, 5.8, 4.8], sternW: .42, kn: 35, accT: 30, turnD: 700, rudT: 8, hp: 44000,
    armor: { belt: 102, deck: 35, ext: 25, sup: 16 },
    main: { cal: 203, Lc: 50, n: 2, mv: 835, m: 125, rl: 11, trav: 7, ev: 55, maxR: 19000, sig: 1, mounts: [[-63, 0, 0], [-53, 0, 2.6], [-43, 0, 5.2], [40, 0, 2.6, 1], [51, 0, 0, 1]] },
    sec: [{ cal: 120, n: 1, mv: 825, m: 20, rl: 4, rng: 6000, mounts: [[-6, 7.4, 3], [-6, -7.4, 3], [4, 7.4, 3], [4, -7.4, 3]] }],
    torp: { spd: 48, rng: 12000, dmg: 20000, n: 4, rl: 75, wake: .25, mounts: [[16, 8.4, 0], [16, -8.4, 0], [26, 8.4, 0], [26, -8.4, 0]] },
    sty: { tower: 'cruiser', tz: -27, th: 21, tw: 9, rf: 6, house: [-33, 30], funnels: [[-7, 1.9, 20, 11], [9, 1.4, 12, 9]], masts: [-14, 30], hull: 0x6a7076, deck: 'steel' } },
  shimakaze: { n: '島風', en: 'SHIMAKAZE', cls: 'DD', nat: 'jp', natN: '日本', year: 1943, dsp: '3,048 t',
    desc: '40ノット近い最高速を誇る試作駆逐艦。五連装魚雷発射管3基・15射線は世界最多。煙と島陰に隠れて近づき、酸素魚雷で戦艦を仕留める艦。被弾には弱い。',
    L: 129.5, B: 11.2, T: 4.1, fb: [6.6, 4.4, 3.8], sternW: .4, kn: 39, accT: 18, turnD: 420, rudT: 5, hp: 18000,
    armor: { belt: 19, deck: 16, ext: 16, sup: 10 },
    main: { cal: 127, Lc: 50, n: 2, mv: 910, m: 23, rl: 4.2, trav: 12, ev: 55, maxR: 13000, sig: 1, mounts: [[-38, 0, 0], [33, 0, 2.4, 1], [45, 0, 0, 1]] },
    torp: { spd: 48, rng: 12000, dmg: 20000, n: 5, rl: 60, wake: .25, beam: 1, mounts: [[-2, 0, .3], [9, 0, .3], [20, 0, .3]] },
    sty: { tower: 'dd', tz: -27, th: 9, tw: 6, rf: 3, house: [-31, -18], funnels: [[-12, 1.5, 12, 7], [-1, 1.4, 10, 6.5]], masts: [-21], hull: 0x6d7278, deck: 'steel' } },
  fletcher: { n: 'フレッチャー', en: 'FLETCHER', cls: 'DD', nat: 'us', natN: 'アメリカ', year: 1942, dsp: '2,500 t',
    desc: '175隻も造られた米海軍の万能駆逐艦。5インチ単装砲5基の手数は駆逐艦トップクラス。魚雷射程は短いが、砲撃で敵駆逐艦を追い払うのが得意。',
    L: 114.8, B: 12, T: 4.2, fb: [6.2, 4.2, 3.6], sternW: .45, kn: 36.5, accT: 18, turnD: 400, rudT: 5, hp: 16500,
    armor: { belt: 19, deck: 13, ext: 13, sup: 10 },
    main: { cal: 127, Lc: 38, n: 1, mv: 792, m: 25, rl: 3, trav: 15, ev: 85, maxR: 13000, sig: 1, mounts: [[-40, 0, 0], [-32, 0, 2.2], [18, 0, 2.2, 1], [29, 0, 2.2, 1], [40, 0, 0, 1]] },
    torp: { spd: 45, rng: 7000, dmg: 15000, n: 5, rl: 50, wake: .9, beam: 1, mounts: [[-2, 0, .3], [8, 0, .3]] },
    sty: { tower: 'dd', tz: -24, th: 10, tw: 7, rf: 3, house: [-28, -16], funnels: [[-10, 1.4, 0, 7], [2, 1.4, 0, 6.5]], masts: [-18], hull: 0x58616b, deck: 'navy' } },
  // ---------- NPC only ----------
  montana: { n: 'モンタナ', en: 'MONTANA', cls: 'BB', nat: 'us', natN: '計画艦', year: '計画', dsp: '約 70,000 t', npc: 1,
    desc: '未成に終わった米国の最終戦艦案。406mm三連装砲4基12門。', L: 281, B: 36.9, T: 11, fb: [11.6, 7.6, 6.2], sternW: .52, kn: 28, accT: 55, turnD: 760, rudT: 13, hp: 140000,
    armor: { belt: 409, deck: 180, ext: 30, sup: 25 },
    main: { cal: 406, Lc: 50, n: 3, mv: 762, m: 1225, rl: 30, trav: 4, ev: 45, maxR: 25000, sig: .9, mounts: [[-80, 0, 0], [-62, 0, 3.4], [48, 0, 3.4, 1], [65, 0, 0, 1]] },
    sec: [{ cal: 127, n: 2, mv: 808, m: 25, rl: 3.5, rng: 7500, mounts: [[-34, 11.6, 4], [-34, -11.6, 4], [-22, 12.2, 4], [-22, -12.2, 4], [-10, 12.2, 4], [-10, -12.2, 4], [2, 12.2, 4], [2, -12.2, 4], [14, 11.6, 4], [14, -11.6, 4]] }],
    sty: { tower: 'us', tz: -37, th: 27, tw: 9.5, rf: 8, house: [-46, 34], funnels: [[-12, 3, 0, 16], [12, 2.9, 0, 15]], masts: [-4], hull: 0x3f4a58, deck: 'navy' } },
  h44: { n: 'H-44', en: 'H-44', cls: 'BB', nat: 'de', natN: '計画艦', year: '計画', dsp: '約 140,000 t', npc: 1,
    desc: '机上の超巨大戦艦案。50.8cm砲8門。', L: 345, B: 51.5, T: 12.7, fb: [12.6, 9.4, 7.6], sternW: .55, kn: 30, accT: 70, turnD: 900, rudT: 15, hp: 210000,
    armor: { belt: 420, deck: 200, ext: 60, sup: 30 },
    main: { cal: 508, Lc: 48, n: 2, mv: 810, m: 1900, rl: 33, trav: 3.5, ev: 40, maxR: 26000, sig: .85, mounts: [[-112, 0, 0], [-92, 0, 4], [72, 0, 4, 1], [92, 0, 0, 1]] },
    sec: [{ cal: 150, n: 2, mv: 875, m: 45.3, rl: 6, rng: 7000, mounts: [[-40, 15, 3.8], [-40, -15, 3.8], [-22, 16, 3.8], [-22, -16, 3.8], [-4, 16, 3.8], [-4, -16, 3.8], [16, 16, 3.8], [16, -16, 3.8], [34, 15, 3.8], [34, -15, 3.8]] }],
    sty: { tower: 'de', tz: -58, th: 30, tw: 10, rf: 12, house: [-70, 52], funnels: [[-18, 3.8, 0, 15], [8, 3.8, 0, 15]], masts: [40], hull: 0x7c828a, deck: 'wood', camo: 1 } },
  cargo: { n: '輸送船', en: 'TRANSPORT', cls: 'AP', nat: 'jp', natN: '民間', year: 1938, dsp: '7,000 t', npc: 1, desc: '', L: 132, B: 18, T: 7.5, fb: [7, 5.2, 5.4], sternW: .55, kn: 13, accT: 40, turnD: 600, rudT: 10, hp: 24000,
    armor: { belt: 10, deck: 10, ext: 10, sup: 8 }, sty: { tower: 'cargo', tz: 8, hull: 0x3a3634, deck: 'wood' } },
  fort: { n: '沿岸砲台', en: 'COASTAL BATTERY', cls: 'FT', nat: 'xx', natN: '', year: '', dsp: '', npc: 1, desc: '', L: 30, B: 22, T: 0, fb: [6, 6, 6], kn: 0, accT: 1, turnD: 1, rudT: 1, hp: 30000,
    armor: { belt: 250, deck: 120, ext: 250, sup: 250 }, main: { cal: 305, Lc: 45, n: 2, mv: 760, m: 400, rl: 20, trav: 6, ev: 40, maxR: 18000, sig: 1.1, mounts: [[0, 0, 0]] }, sty: { tower: 'fort' } }
};
const PLAYABLE = ['yamato', 'shinano', 'nagato', 'kongo', 'iowa', 'bismarck', 'takao', 'shimakaze', 'fletcher'];
const CLS_N = { BB: '戦艦', CA: '重巡洋艦', DD: '駆逐艦', AP: '輸送船', FT: '砲台' };
for (const id in SHIPS) { const S = SHIPS[id]; S.id = id; }

/* ---------- hull geometry helpers ---------- */
function fbAt(S, s) { const [b, m, st] = S.fb; return s < .5 ? m + (b - m) * Math.pow(1 - s / .5, 2) : m + (st - m) * Math.pow((s - .5) / .5, 2); }
function deckY(S, z) { return fbAt(S, clamp((z + S.L / 2) / S.L, 0, 1)); }
function halfBeam(S, s) {
  const B = S.B / 2, bl = S.cls === 'DD' ? .34 : .3, sl = .24;
  if (s < bl) { const t = s / bl; return B * Math.pow(1 - Math.pow(1 - t, 2.1), .85); }
  if (s > 1 - sl) { const t = (s - (1 - sl)) / sl; return B * lerp(1, S.sternW || .5, t * t); }
  return B;
}
function hullGeometry(S) {
  const NS = 64, NP = 12, L = S.L, T = S.T, pos = [], idx = [];
  const sec = []; // per station list of [x,y,z] (starboard)
  for (let i = 0; i <= NS; i++) {
    const s = i / NS, hw = Math.max(.02, halfBeam(S, s)), fb = fbAt(S, s), z0 = -L / 2 + s * L;
    const yb = -T * lerp(.25, 1, smooth(0, .09, s)) * lerp(1, .45, smooth(.9, 1, s));
    const n = lerp(2.0, 6.0, smooth(0, .32, s) * smooth(1, .82, s));
    const flare = s < .35 ? .18 * (1 - s / .35) : 0, pts = [];
    for (let j = 0; j <= NP; j++) {
      const ph = j / NP * Math.PI / 2, sx = Math.pow(Math.sin(ph), 2 / n), cy = 1 - Math.pow(Math.cos(ph), 2 / n);
      const y = yb + (fb - yb) * cy; let x = hw * sx * (1 + flare * clamp(y / fb, 0, 1)) / (1 + flare);
      const rake = s < .12 ? -(y - yb) / (fb - yb) * L * .028 * (1 - s / .12) : 0;
      const sternOver = s > .94 ? (y - yb) / (fb - yb) * L * .012 * (s - .94) / .06 : 0;
      pts.push([x, y, z0 + rake + sternOver]);
    }
    sec.push(pts);
  }
  const vid = (i, j, side) => (i * (NP + 1) + j) * 2 + side;
  for (let i = 0; i <= NS; i++) for (let j = 0; j <= NP; j++) { const [x, y, z] = sec[i][j]; pos.push(x, y, z, -x, y, z); }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NP; j++) {
    const a = vid(i, j, 0), b = vid(i + 1, j, 0), c = vid(i, j + 1, 0), d = vid(i + 1, j + 1, 0); idx.push(a, b, c, b, d, c);
    const a2 = vid(i, j, 1), b2 = vid(i + 1, j, 1), c2 = vid(i, j + 1, 1), d2 = vid(i + 1, j + 1, 1); idx.push(a2, c2, b2, b2, c2, d2);
  }
  // transom
  const base = pos.length / 3, last = sec[NS]; let cy = 0; for (const p of last) cy += p[1]; cy /= last.length;
  pos.push(0, cy, last[NP][2]);
  for (let j = 0; j < NP; j++) { idx.push(base, vid(NS, j, 0), vid(NS, j + 1, 0)); idx.push(base, vid(NS, j + 1, 1), vid(NS, j, 1)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // deck (slight camber)
  const dp = [], di = [];
  for (let i = 0; i <= NS; i++) { const e = sec[i][NP]; dp.push(e[0] - .05, e[1] + .02, e[2], 0, e[1] + .28, e[2], -e[0] + .05, e[1] + .02, e[2]); }
  for (let i = 0; i < NS; i++) { const a = i * 3; idx; di.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); dg.setIndex(di); dg.computeVertexNormals();
  return { hull: g, deck: dg, edge: sec.map(p => p[NP]) };
}
/* ---------- weathered procedural surfaces (plates, seams, rust streaks, planks) ---------- */
const WGLSL = `
float wRough = 0.0;
float wHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float wNoise(vec2 x){ vec2 i=floor(x); vec2 f=x-i; vec2 u=f*f*(3.-2.*f); return mix(mix(wHash(i),wHash(i+vec2(1.,0.)),u.x), mix(wHash(i+vec2(0.,1.)),wHash(i+vec2(1.,1.)),u.x), u.y); }
float wLine(float x, float period, float width){ float fw = fwidth(x) + 1e-4; float d = abs(fract(x/period + .5) - .5) * period; return (1.0 - smoothstep(width, width + fw*1.5, d)) * clamp(1.5 - fw/period*6.0, 0.0, 1.0); }
`;
const WK = {
  hull: `{ float y = vLoc.y, z = vLoc.z; vec3 c = diffuseColor.rgb;
    c *= 0.9 + 0.18*wNoise(vec2(z*0.03, y*0.22));
    float row = floor(y/2.4); float sh = wHash(vec2(row, 3.1))*9.0;
    float plate = wHash(vec2(row, floor((z + sh)/9.0))); c *= 0.95 + 0.1*plate;
    c *= 1.0 - 0.13*uSeam*max(wLine(y, 2.4, 0.025), wLine(z + sh, 9.0, 0.025));
    float st = wNoise(vec2(z*1.4, y*0.05 + 7.0)) * wNoise(vec2(z*0.31, 2.0));
    float streak = smoothstep(0.32, 0.62, st) * smoothstep(0.8, 3.0, y);
    c = mix(c, c*vec3(0.74,0.56,0.42), streak*0.55);
    float gr = smoothstep(2.4, 0.6, y) * (0.55 + 0.45*wNoise(vec2(z*0.25, y*1.5)));
    c = mix(c, c*vec3(0.62,0.66,0.6), gr*0.75);
    wRough = 0.1*streak + 0.12*gr - 0.06*plate;
    if (uCamo > 0.5) { float ends = max(smoothstep(-uLen*0.26, -uLen*0.32, z), smoothstep(uLen*0.3, uLen*0.36, z));
      float sp = step(0.5, fract((z + y*0.35)/13.0)); c = mix(c, mix(vec3(0.05), vec3(0.72), sp)*(0.9+0.15*wNoise(vec2(z*0.2,y*0.3))), ends);
      float fbw = smoothstep(-uLen*0.5, -uLen*0.38, z) * (1.0 - smoothstep(-uLen*0.38, -uLen*0.3, z)); c = mix(c, vec3(0.7), step(abs(y - 1.0 - (z+uLen*0.5)*0.03), 0.6)*fbw); }
    if (y < 0.55) { c = vec3(0.03,0.032,0.035)*(0.85+0.3*wNoise(vec2(z*0.2,y*2.0))); wRough = -0.12; }
    if (y < -0.45) { c = vec3(0.24,0.065,0.05)*(0.8+0.35*wNoise(vec2(z*0.08, y*0.6))); c = mix(c, vec3(0.05,0.07,0.045), smoothstep(-0.6,-3.0,y)*0.45*wNoise(vec2(z*0.12,y*0.4))); }
    diffuseColor.rgb = c; }`,
  deck: `{ vec3 c = diffuseColor.rgb; float pw = 0.3; float idx = floor(vLoc.x/pw); float off = wHash(vec2(idx, 1.7))*7.0; float seg = floor((vLoc.z + off)/7.0);
    float tone = wHash(vec2(idx, seg)); c *= 0.8 + 0.34*tone;
    c *= 0.93 + 0.1*wNoise(vec2(vLoc.x*9.0, vLoc.z*0.35));
    c *= 0.84 + 0.22*wNoise(vec2(vLoc.x*0.06 + 3.0, vLoc.z*0.02));
    c = mix(c, c*0.32, uSeam*max(wLine(vLoc.x, pw, 0.012), wLine(vLoc.z + off, 7.0, 0.015)));
    wRough = 0.05*tone; diffuseColor.rgb = c; }`,
  sdeck: `{ vec3 c = diffuseColor.rgb; float idx = floor(vLoc.x/1.8); float off = wHash(vec2(idx, 2.0))*5.0;
    c *= 0.92 + 0.12*wHash(vec2(idx, floor((vLoc.z + off)/5.0)));
    c *= 1.0 - 0.2*max(wLine(vLoc.x, 1.8, 0.02), wLine(vLoc.z + off, 5.0, 0.02));
    c *= 0.86 + 0.22*wNoise(vec2(vLoc.x*0.08, vLoc.z*0.03)); diffuseColor.rgb = c; }`,
  steel: `{ vec3 c = diffuseColor.rgb; vec3 n = abs(vNo); float top = step(0.7, n.y);
    float h = mix(n.x > n.z ? vLoc.z : vLoc.x, vLoc.x, top); float v = mix(vLoc.y, vLoc.z, top);
    c *= 1.0 - 0.1*uSeam*max(wLine(v, 2.3, 0.02), wLine(h, 3.1, 0.02));
    c *= 0.92 + 0.14*wNoise(vec2(h*0.12, v*0.2));
    float st = wNoise(vec2(h*1.6, vLoc.y*0.07 + 5.0)) * wNoise(vec2(h*0.4, 9.0));
    float streak = smoothstep(0.3, 0.6, st) * (1.0 - n.y);
    c = mix(c, c*vec3(0.72,0.56,0.44), streak*0.45);
    c *= 1.0 - 0.12*top; wRough = 0.1*streak; diffuseColor.rgb = c; }`
};
function wMat(kind, color, o = {}) {
  const { camo = 0, len = 100, seam = 1, ...mo } = o;
  const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .72, metalness: .12, envMapIntensity: .14 }, mo));
  m.extensions = { derivatives: true };
  const u = { uCamo: { value: camo }, uLen: { value: len }, uSeam: { value: seam } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vLoc; varying vec3 vNo;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLoc = position; vNo = normal;');
    sh.fragmentShader = 'varying vec3 vLoc; varying vec3 vNo; uniform float uCamo; uniform float uLen; uniform float uSeam;\n' + WGLSL + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + WK[kind])
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor + wRough, 0.05, 1.0);'); };
  m.customProgramCacheKey = () => 'w_' + kind;
  return m;
}

/* ---------- geometry bag (merged by material) ---------- */
class Bag {
  constructor() { this.m = {}; this.lines = []; }
  add(k, g) { (this.m[k] = this.m[k] || []).push(g); return g; }
  box(k, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { const g = new THREE.BoxGeometry(w, h, d); if (rx || ry || rz) g.applyMatrix4(_m1.makeRotationFromEuler(new THREE.Euler(rx, ry, rz))); g.translate(x, y, z); return this.add(k, g); }
  cyl(k, rt, rb, h, x, y, z, seg = 12, rx = 0, rz = 0, sx = 1) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); if (sx !== 1) g.scale(1, 1, sx); if (rx || rz) g.applyMatrix4(_m1.makeRotationFromEuler(new THREE.Euler(rx, 0, rz))); g.translate(x, y, z); return this.add(k, g); }
  // octagonal block (ship towers are faceted, not boxes)
  oct(k, w, h, d, x, y, z, taper = 1) { const g = new THREE.CylinderGeometry(taper, 1, h, 8); g.rotateY(Math.PI / 8); const c = Math.cos(Math.PI / 8); g.scale(w / 2 / c, 1, d / 2 / c); g.translate(x, y, z); return this.add(k, g); }
  line(a, b) { this.lines.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
  build(mats, parent, shadow = true) {
    for (const k in this.m) { const geo = THREE.BufferGeometryUtils.mergeBufferGeometries(this.m[k].map(g => g.index ? g.toNonIndexed() : g)); const mesh = new THREE.Mesh(geo, mats[k]); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); }
    if (this.lines.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.lines, 3)); parent.add(new THREE.LineSegments(g, RIG_MAT)); }
  }
}
const RIG_MAT = new THREE.LineBasicMaterial({ color: 0x22262a, transparent: true, opacity: .85 });
const SHIPMAT = {};
function shipMats(S) {
  const key = S.id; if (SHIPMAT[key]) return SHIPMAT[key];
  const hull = S.sty.hull || 0x6a6f75, sup = new THREE.Color(hull).offsetHSL(0, -.02, -.01), wood = S.sty.deck === 'wood';
  const deckCol = wood ? 0x5f4a30 : S.sty.deck === 'navy' ? 0x3f4854 : 0x55595c;
  return (SHIPMAT[key] = {
    hull: wMat('hull', hull, { side: THREE.DoubleSide, camo: S.sty.camo || 0, len: S.L, roughness: .7 }),
    deck: wMat(wood ? 'deck' : 'sdeck', deckCol, { side: THREE.DoubleSide, roughness: .88, metalness: .02, envMapIntensity: .08 }),
    sup: wMat('steel', sup), gun: wMat('steel', new THREE.Color(hull).multiplyScalar(.84), { seam: .5, roughness: .58, metalness: .28, envMapIntensity: .18 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1e21, roughness: .55, metalness: .45, envMapIntensity: .2 }),
    win: new THREE.MeshStandardMaterial({ color: 0x0a0f13, roughness: .12, metalness: .9, envMapIntensity: .6 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x6b3b2a, roughness: .8 }), conc: portMats.conc,
    white: new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: .7 }),
    canvas: new THREE.MeshStandardMaterial({ color: 0x9c968a, roughness: .95 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd6a93c, roughness: .3, metalness: .95, envMapIntensity: .9 }),
    boat: new THREE.MeshStandardMaterial({ color: 0xbfbdb4, roughness: .6, envMapIntensity: .2 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x8090a0, roughness: .1, metalness: .6, emissive: 0x111418 }),
    plane: new THREE.MeshStandardMaterial({ color: S.nat === 'jp' ? 0x4e5b46 : S.nat === 'de' ? 0x667078 : 0x59677a, roughness: .6 })
  });
}

/* ---------- turrets ---------- */
function makeTurret(W, mats, isTorp) {
  const root = new THREE.Group(), pivot = new THREE.Group(), bag = new Bag(), pb = new Bag(), muzzles = [];
  if (isTorp) {
    const n = W.n, sp = .9, w = n * sp + .6;
    bag.cyl('sup', w * .45, w * .5, .6, 0, .3, 0, 14); bag.box('gun', w, 1.6, 2.6, 0, 1.3, 1.9); bag.box('dark', w * .4, .5, .8, 0, 2.3, 2.2);
    for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * sp; pb.cyl('gun', .34, .34, 8.6, x, 0, -1.6, 10, Math.PI / 2); pb.cyl('dark', .36, .36, .3, x, 0, -5.9, 10, Math.PI / 2); muzzles.push(new V3(x, 0, -6.3)); }
    pivot.position.set(0, 1.2, 0); bag.build(mats, root); pb.build(mats, pivot); root.add(pivot);
    return { root, pivot, muzzles, h: 2 };
  }
  const c = W.cal / 1000, n = W.n, big = W.cal >= 280, mid = W.cal >= 140;
  const sp = big ? c * 6.6 + .3 : c * 7 + .4, w = big ? n * sp + c * 8 + 1 : n * sp + 1.6, len = big ? w * 1.18 + c * 7 : w * 1.35 + 1.2, h = big ? c * 7.6 + 1.7 : (mid ? 2.8 : 2.3);
  const g = new THREE.BoxGeometry(w, h, len, 1, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y > 0) { p.setX(i, x * .84); if (z < 0) p.setZ(i, z * .5 - len * .02); else p.setZ(i, z * .97); } else if (z < 0) p.setZ(i, z * .94); }
  g.computeVertexNormals(); g.translate(0, h / 2, len * .08); bag.add('gun', g);
  if (big) {
    bag.cyl('sup', w * .5, w * .52, 2.6, 0, -1.2, 0, 28);
    // turret rangefinder with armoured hoods on both sides
    bag.cyl('dark', c * 1.1, c * 1.1, w * 1.3, 0, h * .72, len * .3, 12, 0, Math.PI / 2);
    for (const s of [-1, 1]) { bag.box('gun', 1.5, 1.7, 2.2, s * w * .66, h * .72, len * .3); bag.box('gun', .8, .6, 1.1, s * w * .3, h + .25, -len * .12); }
    bag.box('gun', w * .5, .5, 1.6, 0, h + .2, len * .38); bag.box('dark', 1.2, .35, 1.2, w * .18, h + .55, len * .38); bag.box('dark', 1.2, .35, 1.2, -w * .18, h + .55, len * .38);
    bag.box('gun', w * .96, h * .5, 1.5, 0, h * .32, len * .64);
  } else { bag.cyl('sup', w * .45, w * .5, 1.4, 0, -.5, 0, 16); if (mid && n > 1) { bag.cyl('dark', .32, .32, w * 1.15, 0, h * .75, len * .3, 8, 0, Math.PI / 2); for (const s of [-1, 1]) bag.box('gun', .7, .8, 1, s * w * .58, h * .75, len * .3); } bag.box('dark', .7, .3, .7, w * .25, h + .15, 0); }
  const bl = c * (W.Lc || 45), py = h * .42, pz = -len * .3;
  for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * sp;
    pb.cyl('gun', c * .34, c * .5, bl * .55, x, 0, -bl * .725, 14, Math.PI / 2); pb.cyl('gun', c * .5, c * .62, bl * .45, x, 0, -bl * .225, 14, Math.PI / 2);
    pb.cyl('gun', c * .43, c * .38, c * 1.6, x, 0, -bl + c * .8, 14, Math.PI / 2); pb.cyl('dark', c * .3, c * .3, .05, x, 0, -bl - .02, 10, Math.PI / 2);
    pb.cyl('canvas', c * .85, c * .75, c * 2.4, x, 0, -c * .7, 12, Math.PI / 2); muzzles.push(new V3(x, 0, -bl)); }
  pivot.position.set(0, py, pz); bag.build(mats, root); pb.build(mats, pivot); root.add(pivot);
  return { root, pivot, muzzles, h, w, len };
}

/* ---------- small fittings ---------- */
function aaMount(bag, x, y, z, n, tub, face = 0) { // 25mm / 40mm light AA: base, shield, elevated barrels
  const ry = face; if (tub) bag.cyl('sup', 1.7, 1.75, 1.1, x, y + .55, z, 14);
  bag.cyl('gun', .55, .7, .5, x, y + .25 + (tub ? .6 : 0), z, 8);
  const yy = y + (tub ? .6 : 0), cs = Math.cos(ry), sn = Math.sin(ry);
  bag.box('gun', 1.8, .85, .12, x - sn * .55, yy + .95, z - cs * .55, 0, -ry);
  for (let k = 0; k < n; k++) { const o = (k - (n - 1) / 2) * .3; bag.box('dark', .09, .09, 2.3, x + cs * o - sn * 1.1, yy + 1.35, z - sn * o * 0 - cs * 1.1, .45, -ry); }
}
function searchlight(bag, x, y, z, face = 0) { bag.cyl('dark', .15, .2, .8, x, y + .4, z, 6); const g = new THREE.CylinderGeometry(.75, .75, 1.3, 14); g.rotateX(Math.PI / 2); g.rotateY(-face); g.translate(x, y + 1.3, z); bag.add('sup', g); const l = new THREE.CircleGeometry(.68, 14); l.rotateY(Math.PI - face); l.translate(x - Math.sin(face) * .66, y + 1.3, z - Math.cos(face) * .66); bag.add('lens', l); }
function boat(bag, x, y, z, L) { const g = new THREE.SphereGeometry(1, 14, 7); g.scale(L * .11, L * .07, L * .5); g.translate(x, y + L * .05, z); bag.add('boat', g); bag.box('boat', L * .14, L * .07, L * .28, x, y + L * .1, z + L * .05); bag.box('dark', L * .03, L * .14, L * .03, x, y + L * .17, z - L * .05); }
function seaplane(bag, x, y, z) { bag.cyl('plane', .55, .4, 8.5, x, y + 2.2, z, 10, Math.PI / 2); bag.box('plane', 12, .16, 1.7, x, y + 2.6, z - .8); bag.box('plane', 4.2, .12, 1.1, x, y + 2.5, z + 3.6); bag.box('plane', .12, 1.4, 1.2, x, y + 3.1, z + 3.8);
  for (const s of [-1, 1]) { bag.box('plane', .5, .5, 5.5, x + s * 1.6, y + .5, z - .4); bag.box('dark', .08, 1.6, .08, x + s * 1.6, y + 1.3, z - 1.2); } bag.cyl('dark', .08, .08, 2.8, x, y + 2.2, z - 4.3, 6, 0, Math.PI / 2); }

/* ---------- superstructure styles ---------- */
function buildSuper(S, bag) {
  const st = S.sty, dy = z => deckY(S, z), B = S.B, L = S.L, hb = z => halfBeam(S, clamp((z + L / 2) / L, 0, 1)), dd = S.cls === 'DD';
  const HH = dd ? 2.6 : 5.2;
  const h0 = st.house; if (h0) { const z0 = h0[0], z1 = h0[1], zc = (z0 + z1) / 2, d = z1 - z0, hw = Math.min(hb(zc) * 2, B) * (dd ? .55 : .48);
    bag.box('sup', hw, HH, d, 0, dy(zc) + HH / 2, zc); if (!dd) { bag.box('sup', hw * .8, 2.8, d * .7, 0, dy(zc) + 6.6, zc + d * .05); bag.box('dark', hw + .3, .25, d + .3, 0, dy(zc) + HH + .1, zc); }
    // light AA along the deckhouse edges
    if (S.cls === 'BB' || S.cls === 'CA') { const step = S.cls === 'BB' ? 6.5 : 9, n = S.nat === 'us' ? 4 : S.nat === 'jp' ? 3 : 2;
      for (let z = z0 + 4; z < z1 - 3; z += step) { if (Math.abs(z - st.tz) < 7) continue; for (const s of [-1, 1]) aaMount(bag, s * (hw / 2 - 1.4), dy(z) + HH, z, n, S.nat === 'us', s * Math.PI / 2 * .0); } } }
  const tz = st.tz, ty = dy(tz) + HH;
  if (st.tower === 'pagoda' && (S.id === 'yamato' || S.id === 'shinano')) {
    // Yamato: faceted tower, compass bridge wings, 15 m rangefinder and Type 21 radar on top
    const lv = [[13, 4.2, 16], [11.2, 3.4, 13], [9.8, 3.2, 11], [8.6, 3.2, 9.5], [7.2, 3, 8], [6, 2.8, 6.5], [4.8, 2.4, 5]];
    let y = ty;
    lv.forEach(([w, h, d], i) => { const z = tz + i * .55;
      bag.oct('sup', w, h, d, 0, y + h / 2, z, .97);
      if (i === 2 || i === 3 || i === 5) bag.oct('win', w + .1, .5, d + .1, 0, y + h * .7, z);
      if (i === 1 || i === 3) { bag.box('sup', w + 7, .35, d * .55, 0, y + h + .17, z - d * .1); bag.box('sup', w + 7, .9, .08, 0, y + h + .8, z - d * .38); for (const s of [-1, 1]) { searchlight(bag, s * (w / 2 + 2.6), y + h + .35, z, s * .4); } }
      if (i === 0) for (const s of [-1, 1]) aaMount(bag, s * (w / 2 + 1.6), y + h, z + 3, 3, false);
      y += h; });
    bag.cyl('sup', 2.3, 2.6, 2.6, 0, y + 1.3, tz + 4); bag.cyl('dark', .5, .5, S.id === 'shinano' ? 15 : 15, 0, y + 2.1, tz + 4.4, 10, 0, Math.PI / 2);
    for (const s of [-1, 1]) bag.box('sup', 1.3, 1.6, 2, s * 7.6, y + 2.1, tz + 4.4);
    bag.box('dark', 4.2, 2.2, .25, 0, y + 4.2, tz + 3); for (let k = 0; k < 4; k++) bag.box('dark', 4.2, .06, .5, 0, y + 3.3 + k * .55, tz + 3.2);
    bag.cyl('dark', .22, .32, 10, 0, y + 7.6, tz + 5.5, 8); bag.box('dark', 8, .2, .2, 0, y + 10.5, tz + 5.5); bag.box('dark', 5, .15, .15, 0, y + 8.6, tz + 5.5);
    const mt = [0, y + 12.5, tz + 5.5]; bag.line(mt, [4, y + 10.5, tz + 5.5]); bag.line(mt, [-4, y + 10.5, tz + 5.5]);
    st._mastTop = mt;
    // rear of tower: secondary directors
    for (const s of [-1, 1]) { bag.box('sup', 2.6, 2.2, 3, s * 5, ty + 9, tz + 9); bag.cyl('dark', .3, .3, 4, s * 5, ty + 10.3, tz + 9, 8, 0, Math.PI / 2); }
  } else if (st.tower === 'pagoda') {
    const lv = 7, H = st.th, w0 = st.tw;
    for (let i = 0; i < lv; i++) { const t = i / lv, w = w0 * (1 - t * .55), d = 11 * (1 - t * .5), hh = H / lv, y = ty + hh * (i + .5), z = tz + t * 2.2;
      bag.oct('sup', w, hh, d, 0, y, z, .96);
      if (i % 2 === 1 || i === lv - 1) { bag.box('sup', w + 3.6 - t * 1.5, .3, d + 2.2, 0, y + hh * .5, z); bag.box('dark', w + 3.6 - t * 1.5, .7, .06, 0, y + hh * .5 + .45, z - (d + 2.2) / 2); }
      if (i >= lv - 3) bag.oct('win', w + .1, .7, d + .1, 0, y + hh * .1, z); }
    // characteristic pagoda clutter: platforms and struts on a tripod core
    for (let i = 0; i < 5; i++) { const y = ty + 4 + i * H / 6; bag.box('sup', w0 * .9 + 4 - i * .5, .25, 4, 0, y, tz + 6); for (const s of [-1, 1]) searchlight(bag, s * (w0 * .45 + 1.6 - i * .2), y, tz + 6, s * .5); }
    bag.cyl('dark', .4, .7, H, 2.4, ty + H / 2, tz + 5.5, 8, 0, -.05); bag.cyl('dark', .4, .7, H, -2.4, ty + H / 2, tz + 5.5, 8, 0, .05);
    const top = ty + H; bag.box('sup', w0 * .45, 2.4, 4.2, 0, top + 1.2, tz + 2.2); bag.cyl('dark', .55, .55, st.rf || 10, 0, top + 2.8, tz + 2.6, 10, 0, Math.PI / 2);
    bag.cyl('sup', 1.4, 1.4, 2.2, 0, top + 3.2, tz + 2.6, 14); bag.cyl('dark', .25, .3, 12, 0, top + 9, tz + 4, 6); bag.box('dark', 8, .2, .2, 0, top + 11, tz + 4);
    st._mastTop = [0, top + 15, tz + 4];
  } else if (st.tower === 'us') {
    const H = st.th; bag.cyl('sup', 4.4, 4.6, 9, 0, ty + 4.5, tz - 3, 18, 0, 0, 1.3);
    for (let i = 0; i < 4; i++) { const w = st.tw * (1 - i * .16), d = 15 * (1 - i * .17), y = ty + 9 + i * 3.4 + 1.7; bag.box('sup', w, 3.4, d, 0, y, tz + 4 + i * .8); bag.box('win', w + .1, .6, d * .4, 0, y + .6, tz + 4 + i * .8 - d * .3); bag.box('dark', w + 2, .2, d * .5, 0, y + 1.7, tz + 4 + i * .8); }
    const top = ty + 9 + 13.6;
    const dir = (x, y, z) => { bag.box('sup', 4, 2.6, 4.4, x, y + 1.3, z); bag.cyl('dark', .42, .42, 7.4, x, y + 1.8, z + 1.2, 10, 0, Math.PI / 2); for (const s of [-1, 1]) bag.box('sup', .8, 1, 1, x + s * 3.7, y + 1.8, z + 1.2); bag.box('dark', 3.4, 1.6, .2, x, y + 3.6, z - .5); for (let k = 0; k < 3; k++) bag.box('dark', 3.4, .05, .3, x, y + 3 + k * .5, z - .4); };
    dir(0, top, tz + 2); dir(0, ty + 6, tz - 10.5);
    for (const m of st.masts || []) { bag.cyl('dark', .4, .7, H + 6, 0, ty + (H + 6) / 2, m, 8); bag.box('dark', 9, .25, .25, 0, ty + H, m); bag.cyl('dark', .3, .5, H, 2.6, ty + H / 2, m + 3, 6, -.12, -.1); bag.cyl('dark', .3, .5, H, -2.6, ty + H / 2, m + 3, 6, -.12, .1);
      bag.box('dark', 5, 5, .3, 0, ty + H + 4, m); for (let k = 0; k < 5; k++) bag.box('dark', 5, .06, .4, 0, ty + H + 2 + k, m + .1); st._mastTop = [0, ty + H + 6, m]; }
    dir(0, dy(40) + 7.5, 40);
    for (const z of [tz + 14, 8]) for (const s of [-1, 1]) searchlight(bag, s * 4.5, ty + 9, z, s * .6);
  } else if (st.tower === 'de') {
    const H = st.th; bag.cyl('sup', 3.4, 3.6, 6, 0, ty + 3, tz - 6, 16, 0, 0, 1.4);
    for (let i = 0; i < 4; i++) { const w = st.tw * (1 - i * .14), d = 14 * (1 - i * .15), y = ty + 6 + i * 3.2 + 1.6; bag.oct('sup', w, 3.2, d, 0, y, tz + 3, .98); bag.oct('win', w + .1, .6, d + .1, 0, y + .5, tz + 3); if (i === 1) bag.box('dark', w + 4, .3, d + 3, 0, y + 1.6, tz + 3); }
    const dome = (x, y, z, r) => { bag.cyl('sup', r, r * 1.05, 2.6, x, y + 1.3, z, 20); const g = new THREE.SphereGeometry(r * .96, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(x, y + 2.6, z); bag.add('sup', g); bag.cyl('dark', .5, .5, st.rf || 10, x, y + 2.4, z, 10, 0, Math.PI / 2); for (const s of [-1, 1]) bag.box('sup', 1, 1.2, 1.2, x + s * (st.rf || 10) / 2, y + 2.4, z); bag.box('dark', 3, 1.8, .2, x, y + 4.4, z - .8); };
    const top = ty + 6 + 12.8; dome(0, top, tz + 3, 2.4); bag.cyl('dark', .35, .5, 10, 0, top + 9, tz + 5, 8); st._mastTop = [0, top + 14, tz + 5];
    dome(0, ty + 5.5, tz - 9, 2.1);
    for (const m of st.masts || []) { bag.cyl('dark', .45, .7, H + 12, 0, dy(m) + (H + 12) / 2, m, 8); bag.box('dark', 10, .25, .25, 0, dy(m) + H + 4, m);
      bag.box('sup', 7, 6, 12, 0, dy(m) + 8, m - 2); dome(0, dy(m) + 11, m - 2, 2.1); st._mast2 = [0, dy(m) + H + 12, m]; }
    // aircraft hangar and athwartships catapult
    const hz = (st.funnels[0][0] || 0) + 14; bag.box('sup', 11, 4, 12, 0, dy(hz) + HH + 2, hz); bag.box('dark', 30, .5, 1.2, 0, dy(hz) + HH + 4.4, hz + 9); seaplane(bag, 6, dy(hz) + HH + 4.4, hz + 9);
    for (const z of [tz + 10, hz - 6]) for (const s of [-1, 1]) searchlight(bag, s * 5.2, dy(z) + HH + 4, z, s * .5);
  } else if (st.tower === 'cruiser') {
    const H = st.th;
    for (let i = 0; i < 6; i++) { const t = i / 6, w = st.tw * (1 - t * .45), d = 13 * (1 - t * .4), hh = H / 6, y = ty + hh * (i + .5); bag.box('sup', w, hh, d, 0, y, tz + t * 2); if (i >= 2) bag.box('win', w + .1, .55, d * .5, 0, y + hh * .15, tz + t * 2 - d * .3); if (i % 2 === 0) bag.box('dark', w + 2.5, .25, d + 1.5, 0, y + hh * .5, tz + t * 2); }
    const top = ty + H; bag.cyl('dark', .4, .4, st.rf || 6, 0, top + 1.4, tz + 3, 8, 0, Math.PI / 2); bag.box('sup', 2.6, 1.8, 2.6, 0, top + .9, tz + 3);
    for (const s of [-1, 1]) { searchlight(bag, s * (st.tw * .5 + 1), ty + H * .5, tz - 2, s * .5); bag.box('sup', 3, .3, 3, s * (st.tw * .5 + 1), ty + H * .5, tz - 2); }
    for (const m of st.masts || []) { bag.cyl('dark', .35, .55, 22, 0, dy(m) + 11 + 4, m, 8); bag.cyl('dark', .25, .4, 20, 2, dy(m) + 10 + 4, m + 2.5, 6, -.12, -.1); bag.cyl('dark', .25, .4, 20, -2, dy(m) + 10 + 4, m + 2.5, 6, -.12, .1); bag.box('dark', 7, .2, .2, 0, dy(m) + 22, m); if (!st._mastTop) st._mastTop = [0, dy(m) + 26, m]; else st._mast2 = [0, dy(m) + 26, m]; }
  } else if (st.tower === 'dd') {
    const H = st.th; bag.box('sup', st.tw, 3, 7, 0, ty + 1.5, tz); bag.box('sup', st.tw * .8, 2.6, 5, 0, ty + 4.3, tz + .5); bag.box('win', st.tw * .8 + .1, .6, 2, 0, ty + 4.8, tz - 1.6); bag.box('dark', st.tw + 1.6, .2, 2.5, 0, ty + 3.1, tz - 1.5);
    bag.box('sup', 2, 1.4, 2, 0, ty + 6.3, tz + 1); bag.cyl('dark', .3, .3, st.rf || 3, 0, ty + 6.6, tz + 1, 8, 0, Math.PI / 2);
    for (const m of st.masts || []) { bag.cyl('dark', .22, .35, H + 8, 0, ty + (H + 8) / 2, m, 6); bag.box('dark', 5, .15, .15, 0, ty + H + 2, m); st._mastTop = [0, ty + H + 8, m]; searchlight(bag, 0, ty + 5.6, m + 1.5); }
    // stern: depth-charge rails, light AA
    for (const s of [-1, 1]) { bag.box('dark', .9, .7, 8, s * (hb(L / 2 - 6) - 1), dy(L / 2 - 6) + .35, L / 2 - 6); aaMount(bag, s * 2.5, dy(0) + HH, (st.funnels[0][0] + st.funnels[1][0]) / 2, 2, false); }
  } else if (st.tower === 'cargo') {
    const z = st.tz; bag.box('sup', B * .7, 6, 18, 0, dy(z) + 3, z); bag.box('white', B * .6, 3, 12, 0, dy(z) + 7.5, z - 1); bag.box('win', B * .6 + .1, .8, 3, 0, dy(z) + 8, z - 6.5);
    bag.cyl('dark', 1.8, 2, 9, 0, dy(z) + 12, z + 6, 12); for (const kz of [-40, -20, 30, 48]) { bag.cyl('rust', .5, .6, 14, 0, dy(kz) + 7, kz, 8); bag.cyl('rust', .25, .3, 14, 0, dy(kz) + 8, kz + 5, 6, .9); bag.box('rust', B * .55, 1.6, 14, 0, dy(kz) + .8, kz + (kz < 0 ? 8 : -8)); }
    boat(bag, 6, dy(z) + 6, z + 4, 7); boat(bag, -6, dy(z) + 6, z + 4, 7);
  } else if (st.tower === 'fort') {
    bag.box('conc', 28, 6, 24, 0, 3, 0); bag.box('conc', 34, 2, 30, 0, .5, 0); for (const s of [-1, 1]) bag.box('conc', 4, 4, 18, s * 15, 2, 0);
  }
  for (const f of st.funnels || []) { const [z, r, rake, hgt] = f, y = dy(z) + HH, fh = hgt, rk = rake * DEG, sx = 1.6 - (S.nat === 'us' ? .3 : 0);
    bag.cyl('sup', r * 1.3, r * 1.45, 2.2, 0, y + 1.1, z, 18, 0, 0, sx);
    bag.cyl('sup', r * 1.05, r * 1.25, fh, 0, y + fh / 2 - .5, z + Math.sin(rk) * fh / 2, 18, rk, 0, sx);
    bag.cyl('dark', r * 1.1, r * 1.1, 1.2, 0, y + fh - .6, z + Math.sin(rk) * fh, 18, rk, 0, sx);
    bag.cyl('dark', r * .95, r * .95, .3, 0, y + fh + .05, z + Math.sin(rk) * (fh + .6), 18, rk, 0, sx);
    for (const s of [-1, 1]) bag.cyl('sup', .2, .2, fh * .8, s * r * .5, y + fh * .4, z - r * sx * .95 + Math.sin(rk) * fh * .4, 6, rk);
    if (st._mastTop) { const tp = [0, y + fh, z + Math.sin(rk) * fh]; bag.line(st._mastTop, tp); }
    if (S.cls === 'BB') for (const s of [-1, 1]) { searchlight(bag, s * (r * 1.5 + 1.5), y + 4, z + 2, s * .8); aaMount(bag, s * (r * 1.4 + 1.2), y + 2.6, z - r * 2, 3, S.nat === 'us'); }
  }
  if (st._mastTop && st._mast2) bag.line(st._mastTop, st._mast2);
  // catapults, crane and floatplanes (Japanese battleships)
  if (st.cat) { const z = L / 2 - 26; for (const s of [-1, 1]) { const x = s * 9; bag.box('dark', .8, .8, 20, x, dy(z) + 1.2, z, 0, s * .3); for (let k = 0; k < 6; k++) bag.box('dark', .9, .08, .08, x - Math.sin(s * .3) * (k * 3 - 7.5), dy(z) + 1.65, z - Math.cos(s * .3) * (k * 3 - 7.5)); seaplane(bag, x, dy(z) + 1.6, z); }
    bag.cyl('dark', .4, .5, 10, 0, dy(z + 14) + 5, z + 14, 6, .5); bag.line([0, dy(z + 14) + 9.4, z + 16.4], [0, dy(z + 14) + 2, z + 21]); }
  // boats
  if ((S.cls === 'BB' || S.cls === 'CA') && st.house) { const z = (st.funnels && st.funnels.length ? st.funnels[st.funnels.length - 1][0] : st.house[1] - 10) + 10, w = hb(z) * .48;
    for (const s of [-1, 1]) { boat(bag, s * (w * .5 + 1.5), dy(z) + HH + .1, z, S.cls === 'BB' ? 11 : 8); boat(bag, s * (w * .5 + 1.5), dy(z) + HH + .1, z + 8, 8); } }
  // forecastle: anchors, hawse pipes, chains, capstans, breakwater, crest
  if (S.cls !== 'FT') {
    const za = -L / 2 + L * .055, ya = deckY(S, za), hw = hb(za);
    for (const s of [-1, 1]) { bag.cyl('dark', .7, .7, .4, s * (hw + .05), ya - 1.8, za, 12, 0, Math.PI / 2); bag.box('dark', .45, 2.2, 1.5, s * (hw + .15), ya - 3.2, za + .2);
      const cz = za + L * .05; bag.cyl('dark', .55, .7, .8, s * 1.8, deckY(S, cz) + .4, cz, 12); bag.box('dark', .35, .12, cz - za, s * (hw * .5 + .9), ya + .06, (za + cz) / 2, 0, -s * Math.atan2(hw - 1.8, cz - za) * .5); }
    if ((S.cls === 'BB' || S.cls === 'CA') && S.main) { const zb = S.main.mounts[0][0] - (S.main.cal / 1000) * 30 - 6, yb = deckY(S, zb), w = hb(zb) * .9;
      for (const s of [-1, 1]) bag.box('sup', w, 1.3, .25, s * w * .42, yb + .65, zb + w * .2, 0, s * .55); }
    if (S.nat === 'jp' && S.cls === 'BB') { const y = fbAt(S, 0) - 1.6, z = -L / 2 - L * .028 * ((y + S.T * .25) / (fbAt(S, 0) + S.T * .25)) + .1; const g = new THREE.CylinderGeometry(.8, .8, .3, 24); g.rotateX(Math.PI / 2); g.translate(0, y, z); bag.add('gold', g); }
  }
}

/* ---------- model ---------- */
function buildShipModel(S) {
  const mats = shipMats(S), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bag = new Bag();
  if (S.cls !== 'FT') { const hg = hullGeometry(S); const hm = new THREE.Mesh(hg.hull, mats.hull); hm.castShadow = hm.receiveShadow = true; body.add(hm); const dm = new THREE.Mesh(hg.deck, mats.deck); dm.receiveShadow = true; dm.castShadow = false; body.add(dm);
    // guard rails along the deck edge: two wires and stanchions
    const E = hg.edge; for (let i = 1; i < E.length - 1; i++) { const a = E[i], b = E[i + 1]; for (const s of [1, -1]) { for (const hh of [.55, 1.05]) bag.line([a[0] * s * .985, a[1] + hh, a[2]], [b[0] * s * .985, b[1] + hh, b[2]]); if (i % 2 === 0) bag.line([a[0] * s * .985, a[1], a[2]], [a[0] * s * .985, a[1] + 1.05, a[2]]); } } }
  buildSuper(S, bag); bag.build(mats, body);
  const mounts = (W, isTorp) => (W ? W.mounts.map(m => {
    const [z, x, ey, aft] = m, t = makeTurret(W, mats, isTorp), side = x > .5 ? 1 : x < -.5 ? -1 : 0;
    const rest = aft ? Math.PI : side ? side * Math.PI / 2 : 0;
    t.root.position.set(x, (S.cls === 'FT' ? 6 : deckY(S, z)) + (ey || 0), z); t.root.rotation.y = -rest; body.add(t.root);
    const lim = S.cls === 'FT' ? Math.PI : isTorp && W.beam ? Math.PI : side ? 82 * DEG : 150 * DEG;
    return { W, t, rest, lim, side, yaw: rest, el: 0, rl: rand(.3, 1) * (W.rl || 5), ok: true, dis: 0, beam: isTorp && W.beam, torpOnly: !!isTorp };
  }) : []);
  const tur = mounts(S.main), sec = [], torp = mounts(S.torp, true);
  for (const W of S.sec || []) sec.push(...mounts(W));
  // superfiring turrets stand on a barbette
  for (const m of [...tur, ...sec]) { const ey = m.t.root.position.y - deckY(S, m.t.root.position.z); if (ey > 1 && S.cls !== 'FT') { const r = (m.t.w || 4) * .5, g = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, ey, 24), mats.sup); g.position.set(m.t.root.position.x, deckY(S, m.t.root.position.z) + ey / 2, m.t.root.position.z); g.castShadow = g.receiveShadow = true; body.add(g); } }
  return { root, body, tur, sec, torp };
}

/* ---------- ballistics ---------- */
const BAL = {};
function dragK(W) { const r = W.cal / 2000; return .5 * 1.225 * .29 * Math.PI * r * r / W.m * .62; }
function ballTable(W) {
  const key = W.cal + '_' + W.mv + '_' + W.m; if (BAL[key]) return BAL[key];
  const k = dragK(W), rows = [], dt = 1 / 60, h0 = 16;
  for (let e = -1; e <= (W.ev || 45) + 1e-6; e += .2) { const a = e * DEG; let x = 0, y = h0, vx = W.mv * Math.cos(a), vy = W.mv * Math.sin(a), t = 0;
    while (y > 0 && t < 160) { const v = Math.hypot(vx, vy); vx += -k * v * vx * dt; vy += (-G - k * v * vy) * dt; x += vx * dt; y += vy * dt; t += dt; }
    rows.push({ e: a, r: x, t, vi: Math.hypot(vx, vy), fall: Math.atan2(-vy, vx) }); if (rows.length > 2 && x < rows[rows.length - 2].r) break; }
  let maxR = 0; for (const r of rows) maxR = Math.max(maxR, r.r);
  return (BAL[key] = { rows, maxR: Math.min(maxR, W.maxR || maxR), k });
}
function ballFor(W, r) {
  const B = ballTable(W), R = B.rows; if (r > B.maxR) return null;
  if (r <= R[0].r) return R[0];
  for (let i = 0; i < R.length - 1; i++) { const a = R[i], b = R[i + 1]; if (r >= a.r && r <= b.r) { const f = (r - a.r) / Math.max(1e-6, b.r - a.r); return { e: lerp(a.e, b.e, f), t: lerp(a.t, b.t, f), vi: lerp(a.vi, b.vi, f), fall: lerp(a.fall, b.fall, f), r }; } }
  return null;
}
// armour penetration (mm) at impact velocity, rough fit to WWII AP data
const penAt = (W, v) => (W.cal >= 280 ? 1.55 : 1.25) * W.cal * Math.pow(v / W.mv, 1.45);
const alphaAP = W => 2.8 * Math.pow(W.cal, 1.4);
const alphaHE = W => 1.35 * Math.pow(W.cal, 1.4);
