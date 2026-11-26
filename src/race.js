// 🏁 킥보드 레이스: 회사 블록을 둘러싼 도로(동서남북 네 길) 한 바퀴 코스, 1바퀴(11-25 사용자 요청: 2바퀴는 너무 길다).
// 정문 옆 '🏁 레이스 출발대'에서 참가 → 15초 모집 → 출발선으로 이동 → 3·2·1 → 출발.
// 알림은 참가 · 나가기 · 결승 때만({t:'race'}). 달리는 위치는 평소 상태 메시지 그대로(+ 진행 거리 rp).
// 자기 킥보드가 없으면 레이스 동안 기본 킥보드를 빌려 줌. 레이스 중엔 둘레 도로의 자동차를 통제(world.js).
import * as THREE from 'three';
import { canvasTex } from './building.js';

export const RACE = { A: 60, R: 14, half: 7.2, laps: 1, lobby: 15, count: 3, limit: 240,
  // 11-26 사용자: '물 위에 떠 있어 애매, 물 건너가서 모이게 + 네모 칸에 들어가면 참가' → 정문 개울 건너 앞 광장(부지 밖)에 참가 칸
  plaza: { x0: -8, x1: 8, z1: 42 },              // 1층에서 걸어 나갈 수 있는 정문 앞 광장 (부지 남쪽 끝 ~ z 42)
  zone: { x0: -3, x1: 3, z0: 35, z1: 40 },       // 🏁 참가 칸: 들어가면 참가, 출발 전에 나가면 취소
  kiosk: { x: 0, z: 40.9 } };                    // 안내판 (칸 뒤)
export const inRaceZone = (f, x, z) => f === 0 && x > RACE.zone.x0 && x < RACE.zone.x1 && z > RACE.zone.z0 && z < RACE.zone.z1;
const VMAX = 15, VBOOST = 30, ACC = 13, BOOST_T = 1.6, ITEM_T = 3, ITEM_BACK = 5; // 11-25 '너무 느리다' → 기본 15m/s, 아이템 · 부스터는 2배(30m/s)
const PAY = [50000, 30000, 10000], PAY_FINISH = 5000, PAY_PB = 10000, PAY_DAY = 100000;
const GY = -0.3; // 도로 높이 (world.js GROUND_Y)

// ---- 코스 가운데 선 (모서리가 둥근 네모, 0.5m 간격 점) ----
const LINE = (() => {
  const { A, R } = RACE, a = A - R, pts = [];
  const push = (x, z) => { const p = pts[pts.length - 1]; if (p && Math.hypot(x - p.x, z - p.z) < 1e-6) return; pts.push({ x, z }); };
  const straight = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5); for (let i = 0; i <= n; i++) push(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n); };
  const arc = (cx, cz, a0, a1) => { const n = Math.ceil((Math.abs(a1 - a0) * R) / 0.5); for (let i = 0; i <= n; i++) { const t = a0 + ((a1 - a0) * i) / n; push(cx + Math.cos(t) * R, cz + Math.sin(t) * R); } };
  // 출발(0, +A) → 동쪽 → 북쪽(−z) → 서쪽 → 남쪽 → 출발 (위에서 보면 반시계)
  straight(0, A, a, A); arc(a, a, Math.PI / 2, 0);
  straight(A, a, A, -a); arc(a, -a, 0, -Math.PI / 2);
  straight(a, -A, -a, -A); arc(-a, -a, -Math.PI / 2, -Math.PI);
  straight(-A, -a, -A, a); arc(-a, a, Math.PI, Math.PI / 2);
  straight(-a, A, 0, A);
  pts.pop(); // 마지막 점 = 첫 점
  let s = 0;
  pts.forEach((p, i) => { if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); p.s = s; });
  const L = s + Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].z - pts[pts.length - 1].z);
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; const d = Math.hypot(q.x - p.x, q.z - p.z) || 1; p.tx = (q.x - p.x) / d; p.tz = (q.z - p.z) / d; });
  return { pts, L };
})();
export const TRACK_LEN = LINE.L;
// 가장 가까운 가운데 선 점: s(코스 거리) · lat(옆으로 벗어난 거리, +는 진행 방향 오른쪽 = 안쪽)
function project(x, z, hint = -1) {
  const P = LINE.pts, n = P.length;
  let best = 1e9, bi = 0;
  const scan = (i0, i1) => { for (let k = i0; k <= i1; k++) { const i = ((k % n) + n) % n, p = P[i], d = (x - p.x) ** 2 + (z - p.z) ** 2; if (d < best) { best = d; bi = i; } } };
  if (hint >= 0) scan(hint - 60, hint + 60); else scan(0, n - 1);
  const p = P[bi], lat = (x - p.x) * p.tz - (z - p.z) * p.tx; // 오른쪽 법선 (tz, -tx)
  return { i: bi, s: p.s, lat, p };
}
const at = (s) => { const P = LINE.pts, n = P.length; s = ((s % LINE.L) + LINE.L) % LINE.L; let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (P[m].s <= s) lo = m; else hi = m - 1; } return P[lo]; };
const PADS = [140, 254, 368, 30].map((s) => at(s)); // ⚡ 부스터 발판 (곧은 길 가운데쯤)
// 🎁 아이템 상자: 곧은 길마다 한 줄에 3개 (먹으면 3초 동안 2배 속도, 5초 뒤 다시 생김 — 각자 화면 기준)
const ITEMS = [];
for (const s0 of [100, 214, 328, 432]) for (const lat of [-4.2, 0, 4.2]) { const p = at(s0); ITEMS.push({ x: p.x + p.tz * lat, z: p.z - p.tx * lat, back: 0 }); }

// ---- 코스 꾸미기: 출발 아치 · 체크무늬 선 · 부스터 발판 · 모서리 고깔 · 정문 옆 출발대 ----
export function createRaceTrack(colliders) {
  const group = new THREE.Group(), { A, R } = RACE, y = GY + 0.02;
  const checker = (w, h, n) => canvasTex(w, h, (ctx) => { const c = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < Math.ceil(h / c); j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(i * c, j * c, c, c); } });
  // 출발/결승선
  const line = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 18), new THREE.MeshBasicMaterial({ map: checker(64, 720, 2) }));
  line.rotation.x = -Math.PI / 2; line.position.set(0, y, A); group.add(line);
  // 아치
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 0.4, metalness: 0.6 });
  for (const e of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), steel); p.position.set(0, GY + 2.6, A + e * 9.8); group.add(p); }
  const bannerTex = canvasTex(1024, 160, (ctx, w, h) => {
    const c = 20; for (let i = 0; i < w / c; i++) for (let j = 0; j < h / c; j++) { ctx.fillStyle = (i + j) % 2 ? '#15161a' : '#f4f4f4'; ctx.fillRect(i * c, j * c, c, c); }
    ctx.fillStyle = '#e8352f'; ctx.fillRect(160, 22, w - 320, h - 44);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 76px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    ctx.fillText('🏁 WORK KICK RACE', w / 2, h / 2 + 4);
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 20), [steel, steel, steel, steel, new THREE.MeshBasicMaterial({ map: bannerTex }), new THREE.MeshBasicMaterial({ map: bannerTex })]);
  banner.position.set(0, GY + 5.0, A); banner.rotation.y = Math.PI / 2; banner.scale.set(1, 1, 1); group.add(banner);
  // 바퀴 수 · 방향 안내 (출발 직후 길 위 화살표)
  const arrowTex = canvasTex(256, 256, (ctx, w, h) => { ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#5ff2ff'; for (let k = 0; k < 3; k++) { const yy = 40 + k * 70; ctx.beginPath(); ctx.moveTo(40, yy + 50); ctx.lineTo(128, yy); ctx.lineTo(216, yy + 50); ctx.lineTo(216, yy + 80); ctx.lineTo(128, yy + 30); ctx.lineTo(40, yy + 80); ctx.closePath(); ctx.fill(); } });
  const padMat = new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: false });
  const padBase = new THREE.MeshBasicMaterial({ color: 0x0b3a4a, transparent: true, opacity: 0.75, depthWrite: false });
  const pads = PADS.map((p) => {
    const g = new THREE.Group(); g.position.set(p.x, y + 0.01, p.z); g.rotation.y = Math.atan2(p.tx, p.tz);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 6), padBase); b.rotation.x = -Math.PI / 2; g.add(b);
    const a = new THREE.Mesh(new THREE.PlaneGeometry(4, 5.6), padMat); a.rotation.x = -Math.PI / 2; a.rotation.z = Math.PI; a.position.y = 0.01; g.add(a);
    group.add(g); return g;
  });
  // 🎁 아이템 상자 (빙글빙글 도는 무지개 상자 + ⚡)
  const boxTex = canvasTex(128, 128, (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ff5fa2'); g.addColorStop(0.5, '#ffd84a'); g.addColorStop(1, '#5fd2ff'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10); ctx.font = '900 78px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚡', w / 2, h / 2 + 4); });
  const boxMat = new THREE.MeshStandardMaterial({ map: boxTex, emissive: 0xffffff, emissiveMap: boxTex, emissiveIntensity: 0.55, roughness: 0.3, transparent: true, opacity: 0.95 });
  const boxes = ITEMS.map((it) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), boxMat); b.position.set(it.x, GY + 0.9, it.z); group.add(b); it.mesh = b; return b; });
  // 모서리 고깔 (바깥 줄 + 안쪽 꼭짓점)
  const cones = [];
  for (const [cx, cz, a0] of [[A - R, A - R, 0], [A - R, -(A - R), -Math.PI / 2], [-(A - R), -(A - R), -Math.PI], [-(A - R), A - R, Math.PI / 2]]) {
    for (let t = 0; t <= 1.001; t += 1 / 11) { const ang = a0 + t * Math.PI / 2; cones.push([cx + Math.cos(ang) * (R + 8.4), cz + Math.sin(ang) * (R + 8.4)]); }
    for (let t = 0.15; t <= 0.86; t += 0.35) { const ang = a0 + t * Math.PI / 2; cones.push([cx + Math.cos(ang) * (R - 8.2), cz + Math.sin(ang) * (R - 8.2)]); }
  }
  const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 0.75, 12), new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.6 }), cones.length);
  const band = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.2, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), cones.length);
  const m = new THREE.Matrix4();
  cones.forEach(([x, z], i) => { cone.setMatrixAt(i, m.makeTranslation(x, GY + 0.375, z)); band.setMatrixAt(i, m.makeTranslation(x, GY + 0.42, z)); });
  group.add(cone, band);
  // 🏁 참가 칸 (정문 앞 광장 바닥, 체크무늬 테두리 + 글씨)
  {
    const Z = RACE.zone, w = Z.x1 - Z.x0, d = Z.z1 - Z.z0;
    const floorTex = canvasTex(600, 500, (ctx, W, H) => {
      ctx.fillStyle = 'rgba(232,53,47,0.22)'; ctx.fillRect(0, 0, W, H);
      const c = 25; for (let i = 0; i < W / c; i++) for (const yy of [0, H - c]) { ctx.fillStyle = i % 2 ? '#111' : '#fff'; ctx.fillRect(i * c, yy, c, c); }
      for (let j = 1; j < H / c - 1; j++) for (const xx of [0, W - c]) { ctx.fillStyle = j % 2 ? '#111' : '#fff'; ctx.fillRect(xx, j * c, c, c); }
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 64px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif'; ctx.fillText('🏁 RACE', W / 2, H / 2 - 40);
      ctx.font = '800 40px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif'; ctx.fillText('이 칸에 들어오면 참가!', W / 2, H / 2 + 40);
    });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2; pad.rotation.z = Math.PI; pad.position.set((Z.x0 + Z.x1) / 2, GY + 0.015, (Z.z0 + Z.z1) / 2); group.add(pad);
    for (const [x, z] of [[Z.x0, Z.z0], [Z.x1, Z.z0], [Z.x0, Z.z1], [Z.x1, Z.z1]]) { // 모서리 고깔
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.6 })); c.position.set(x, GY + 0.3, z); group.add(c);
    }
  }
  // 안내판 (참가 칸 뒤, 부지 쪽을 봄)
  const K = RACE.kiosk, wood = new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 0.5, metalness: 0.5 });
  for (const e of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.1), wood); p.position.set(K.x + e * 0.7, GY + 1.0, K.z); group.add(p); }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ map: canvasTex(512, 288, (ctx, w, h) => {
    const c = 16; for (let i = 0; i < w / c; i++) { ctx.fillStyle = i % 2 ? '#111' : '#fff'; ctx.fillRect(i * c, 0, c, c); ctx.fillStyle = i % 2 ? '#fff' : '#111'; ctx.fillRect(i * c, c, c, c); }
    ctx.fillStyle = '#e8352f'; ctx.fillRect(0, 32, w, h - 32);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 58px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif'; ctx.fillText('🏁 킥보드 레이스', w / 2, 110);
    ctx.font = '700 30px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif'; ctx.fillText('회사 밖 도로 1바퀴 · 1등 5만 원', w / 2, 180);
    ctx.fillText('앞의 네모 칸에 들어오면 참가!', w / 2, 232);
  }) }));
  board.position.set(K.x, GY + 1.75, K.z); board.rotation.y = Math.PI; group.add(board);
  const back = board.clone(); back.rotation.y = 0; back.position.z += 0.01; group.add(back);
  colliders.push({ x1: K.x - 0.8, z1: K.z - 0.1, x2: K.x + 0.8, z2: K.z + 0.1, tall: true });
  return { group, update(t) { for (const p of pads) p.children[1].material.color.setScalar(1.3 + Math.sin(t * 6) * 0.4); boxes.forEach((b, i) => { const it = ITEMS[i]; b.visible = Date.now() >= it.back; b.rotation.set(0.5, t * 2 + i, 0.3); b.position.y = GY + 0.9 + Math.sin(t * 3 + i) * 0.12; }); } };
}

// ---- 레이스 진행 ----
export function createRace(api) {
  const { $, me, peers } = api;
  const st = { lobby: new Map(), startAt: 0, racers: [], fin: [], running: false, mine: false, phase: 'idle', prog: 0, hint: -1, lastS: 0, v: 0, boost: 0, kick: null, endAt: 0, resultShown: false, gave: false };
  const now = () => Date.now();
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmt = (ms) => `${Math.floor(ms / 60000)}:${pad2(Math.floor((ms % 60000) / 1000))}.${Math.floor((ms % 1000) / 100)}`;
  const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => new Date().toLocaleDateString('ko-KR');
  let pay = { day: '', won: 0 };
  try { pay = { ...pay, ...JSON.parse(localStorage.getItem('work-race') || '{}') }; } catch {}
  function reward(n) {
    if (pay.day !== today()) pay = { day: today(), won: 0 };
    const g = Math.max(0, Math.min(n, PAY_DAY - pay.won));
    if (g) { pay.won += g; api.earn(g); try { localStorage.setItem('work-race', JSON.stringify(pay)); } catch {} }
    return g;
  }
  const inLobby = () => st.lobby.has(me.id);
  // 11-26 '상대가 안 움직여서 같이 하는 것 같지 않다': 나중에 사이트를 연 사람은 먼저 참가한 사람의 '참가' 신호를 못 받아
  // 각자 따로 15초를 세고 혼자 달렸음 → 누가 참가하면, 이미 칸에 있던 사람이 자기 참가를 한 번 더 알려서 출발 시각을 맞춤
  const answered = new Set();
  function announce() { const m = st.lobby.get(me.id); if (m) api.send({ t: 'race', k: 'join', id: me.id, name: me.name, ts: m.ts, at: st.startAt }); }

  function join() {
    if (st.running) { api.toast('🏁 지금 레이스가 진행 중이에요. 끝나면 참가할 수 있어요!'); return; }
    if (inLobby()) { leave(); return; }
    const ts = now(), SLOT = RACE.lobby * 1000, at = st.startAt || Math.ceil((ts + 6000) / SLOT) * SLOT; // 시계 기준 15초 칸(최소 6초 대기): 모두 같은 시각에 출발
    const e = { t: 'race', k: 'join', id: me.id, name: me.name, ts, at };
    api.send(e); onEvent(e);
  }
  function leave() {
    const e = { t: 'race', k: 'leave', id: me.id, name: me.name };
    api.send(e); onEvent(e);
  }
  function onEvent(e) {
    if (!e || e.t !== 'race') return;
    if (e.k === 'join' && !st.running) {
      if (e.id !== me.id && inLobby() && !answered.has(e.id)) { answered.add(e.id); announce(); } // 먼저 와 있던 나도 알려 줌
      if (st.lobby.has(e.id)) st.startAt = Math.min(st.startAt || e.at, e.at); // 출발 시각은 더 이른 쪽으로 맞춤
      if (!st.lobby.has(e.id)) {
        st.lobby.set(e.id, { name: e.name, ts: e.ts });
        st.startAt = st.startAt ? Math.min(st.startAt, e.at) : e.at;
        if (e.id === me.id) api.sys(`🏁 레이스에 참가했어요! ${Math.ceil((st.startAt - now()) / 1000)}초 뒤 출발선으로 이동해요. (칸 밖으로 나가면 취소)`);
        else api.sys(`🏁 ${e.name}님이 킥보드 레이스에 참가했어요! 정문 앞 광장의 🏁 네모 칸에 들어오면 같이 달려요 (${st.lobby.size}명)`);
      }
    } else if (e.k === 'leave') {
      if (st.lobby.delete(e.id) && !st.lobby.size) st.startAt = 0;
      const r = st.racers.find((x) => x.id === e.id); if (r) r.left = true;
      if (e.id === me.id && st.mine) quit(true);
    } else if (e.k === 'fin' && st.running) {
      if (!st.fin.find((f) => f.id === e.id)) {
        st.fin.push({ id: e.id, name: e.name, ms: e.ms });
        const place = st.fin.length;
        api.sys(`🏁 ${e.name}님 ${place}등 골인! ${fmt(e.ms)}`);
      }
    }
  }

  function begin() {
    for (const [id, q] of peers) if (!st.lobby.has(id) && q.floor === 0 && q.x > RACE.zone.x0 && q.x < RACE.zone.x1 && q.z > RACE.zone.z0 && q.z < RACE.zone.z1) st.lobby.set(id, { name: q.name, ts: st.startAt }); // 신호를 놓쳐도 칸 안에 서 있던 사람은 같이
    st.racers = [...st.lobby.entries()].sort((a, b) => a[1].ts - b[1].ts || (a[0] < b[0] ? -1 : 1)).map(([id, v]) => ({ id, name: v.name }));
    st.lobby.clear(); answered.clear(); st.running = true; st.fin = []; st.endAt = st.startAt + (RACE.count + RACE.limit) * 1000; st.resultShown = false;
    const idx = st.racers.findIndex((r) => r.id === me.id);
    api.sys(`🏁 킥보드 레이스 출발! ${st.racers.map((r) => r.name).join(' · ')}`);
    if (idx < 0) return;
    st.go = st.startAt + RACE.count * 1000;
    st.mine = true; st.phase = 'count'; st.prog = 0; st.v = 0; st.boost = 0; st.gave = false;
    st.kick = api.ownKick() || 'kickblack';
    const p = api.player();
    p.floor !== 0 && api.toFloor0();
    p.x = -2.5 - Math.floor(idx / 3) * 2.8; p.z = RACE.A + ((idx % 3) - 1) * 3.2; p.ry = Math.PI / 2;
    const pr = project(p.x, p.z); st.hint = pr.i; st.lastS = pr.s; st.prog = pr.s - LINE.L; // 출발선 뒤에서 시작
    api.cam.yaw = p.ry + Math.PI; api.cam.pitch = 0.2; api.cam.dist = 4.6;
    api.changed();
  }
  function finish() {
    const ms = now() - st.go;
    const e = { t: 'race', k: 'fin', id: me.id, name: me.name, ms };
    api.send(e); onEvent(e);
    st.phase = 'done';
    const place = st.fin.findIndex((f) => f.id === me.id) + 1, many = st.racers.length > 1;
    let best = 0; try { best = +localStorage.getItem('work-race-best') || 0; } catch {}
    const pb = !best || ms < best; if (pb) try { localStorage.setItem('work-race-best', String(ms)); } catch {}
    const prize = (many ? PAY[place - 1] || PAY_FINISH : PAY_FINISH) + (pb ? PAY_PB : 0);
    const g = reward(prize);
    api.ding();
    st.myResult = { place, ms, pb, g, many };
    showResult();
  }
  function quit(silent = false) {
    if (!st.mine) return;
    st.mine = false; st.phase = 'idle';
    const p = api.player(); p.x = 0; p.z = 33; p.ry = 0; api.cam.yaw = Math.PI; api.cam.dist = 3.4; api.cam.pitch = 0.28; // 참가 칸 앞(광장)으로
    $('raceHud').hidden = true; $('raceCount').hidden = true; $('raceQuit').hidden = true; $('raceSpeed').hidden = true;
    if (!silent) { const e = { t: 'race', k: 'leave', id: me.id, name: me.name }; api.send(e); }
    api.changed();
  }
  function showResult() {
    const r = st.myResult; if (!r) return;
    const rows = st.racers.map((x) => ({ ...x, f: st.fin.find((f) => f.id === x.id) })).sort((a, b) => (a.f ? a.f.ms : 1e12) - (b.f ? b.f.ms : 1e12));
    $('raceResult').innerHTML = `<b>${r.many ? `${r.place}등!` : '완주!'} ${fmt(r.ms)}</b>${r.pb ? '<span>🎉 내 최고 기록!</span>' : ''}<em>${r.g ? `+${won(r.g)}` : '오늘 상금 한도에 닿았어요'}</em>`
      + `<ol>${rows.map((x) => `<li class="${x.id === me.id ? 'me' : ''}">${esc(x.name)}<small>${x.f ? fmt(x.f.ms) : x.left ? '나감' : '달리는 중…'}</small></li>`).join('')}</ol><button type="button" id="raceBack">회사로 돌아가기</button>`;
    $('raceResult').hidden = false;
    $('raceBack').onclick = () => { $('raceResult').hidden = true; quit(true); };
  }

  // 매 프레임 (모든 화면): 모집 → 출발 · 끝 판단
  function tick() {
    const t = now();
    if (!st.running && st.startAt && t >= st.startAt) { if (st.lobby.size) begin(); else st.startAt = 0; }
    if (st.running) {
      const active = st.racers.filter((r) => !r.left && !st.fin.find((f) => f.id === r.id));
      if (!active.length || t > st.endAt) {
        st.running = false; st.startAt = 0;
        if (st.fin.length) api.sys(`🏁 레이스 끝! ${st.fin.map((f, i) => `${i + 1}등 ${f.name} ${fmt(f.ms)}`).join(' · ')}`);
        if (st.mine && st.phase !== 'done') { api.toast('🏁 시간이 다 됐어요. 다음에 다시 도전해요!'); quit(true); }
        if (st.mine && st.phase === 'done') setTimeout(() => { if (st.mine && st.phase === 'done') quit(true); $('raceResult').hidden = true; }, 6000);
      }
      if (st.mine && st.phase === 'done' && !$('raceResult').hidden) showResult();
    }
    // 모집 중 안내
    if (inLobby() && !st.running) { $('raceHud').hidden = false; $('raceHud').textContent = `🏁 출발선 이동까지 ${Math.max(0, Math.ceil((st.startAt - t) / 1000))}초 · ${st.lobby.size}명 참가`; }
    else if (!st.mine) $('raceHud').hidden = true;
  }

  // 내 킥보드 몰기 (레이스 중일 때 main의 updatePlayer 대신)
  function drive(dt, f, s) {
    const p = api.player(), t = now(), go = st.go;
    $('raceQuit').hidden = st.phase === 'done';
    if (st.phase === 'count') {
      const left = Math.ceil((go - t) / 1000);
      $('raceCount').hidden = false; $('raceCount').textContent = left > 0 ? String(left) : 'GO!';
      if (left !== st.lastBeep) { st.lastBeep = left; left > 0 ? api.beep(660, 0.12) : api.beep(1320, 0.25); }
      if (t >= go) { st.phase = 'run'; setTimeout(() => ($('raceCount').hidden = true), 700); }
      hud(t); return 0;
    }
    if (st.phase !== 'run') { hud(t); return 0; }
    const mag = Math.min(1, Math.hypot(f, s));
    const cam = api.cam;
    if (mag > 0.05) {
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      const mx = fx * f + rx * s, mz = fz * f + rz * s;
      const target = Math.atan2(mx, mz);
      let d = target - p.ry; d = Math.atan2(Math.sin(d), Math.cos(d));
      p.ry += Math.max(-1, Math.min(1, d)) * Math.min(1, dt * 4.5);
    }
    st.boost = Math.max(0, st.boost - dt);
    const vmax = (st.boost > 0 ? VBOOST : VMAX) * (mag > 0.05 ? Math.max(0.35, mag) : 0);
    st.v += Math.max(-ACC * 1.4 * dt, Math.min(ACC * dt * (st.boost > 0 ? 2 : 1), vmax - st.v));
    const ox = p.x, oz = p.z;
    p.x += Math.sin(p.ry) * st.v * dt; p.z += Math.cos(p.ry) * st.v * dt;
    // 도로 밖으로 못 나가게 (벽에 닿으면 속도가 줄어듦)
    let pr = project(p.x, p.z, st.hint);
    if (Math.abs(pr.lat) > RACE.half) {
      const over = pr.lat - Math.sign(pr.lat) * RACE.half; // 벽 밖으로 나간 만큼만 옆으로 되돌림 (앞뒤로는 그대로 미끄러짐)
      p.x -= pr.p.tz * over; p.z += pr.p.tx * over;
      st.v *= Math.pow(0.15, dt); pr = project(p.x, p.z, pr.i);
    }
    st.hint = pr.i;
    let ds = pr.s - st.lastS; if (ds > LINE.L / 2) ds -= LINE.L; if (ds < -LINE.L / 2) ds += LINE.L;
    st.prog += ds; st.lastS = pr.s;
    // 🎁 아이템 상자 먹기 → 3초 동안 2배
    for (const it of ITEMS) if (t >= it.back && Math.hypot(p.x - it.x, p.z - it.z) < 1.3) { it.back = t + ITEM_BACK * 1000; st.boost = Math.max(st.boost, ITEM_T); api.beep(1760, 0.18); st.flash = t; break; }
    // 부스터 발판
    if (st.boost <= 0) for (const q of PADS) if (Math.hypot(p.x - q.x, p.z - q.z) < 2.6) { st.boost = BOOST_T; api.beep(1500, 0.15); break; }
    // 카메라는 뒤에서 따라옴
    let dy = p.ry + Math.PI - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    cam.yaw += dy * Math.min(1, dt * 3);
    if (st.prog >= RACE.laps * LINE.L) finish();
    hud(t);
    return Math.hypot(p.x - ox, p.z - oz);
  }
  function rank() {
    const fin = st.fin.findIndex((f) => f.id === me.id);
    if (fin >= 0) return fin + 1;
    let r = st.fin.length + 1;
    for (const x of st.racers) { if (x.id === me.id || x.left || st.fin.find((f) => f.id === x.id)) continue; const q = peers.get(x.id); if (q && (q.rp ?? -1e9) > st.prog) r++; }
    return r;
  }
  function hud(t) {
    const el = $('raceHud'); el.hidden = false;
    $('raceSpeed').hidden = !(st.boost > 0 && st.phase === 'run'); // ⚡ 2배 속도일 때 화면 가장자리 속도선
    const lap = Math.min(RACE.laps, Math.max(1, Math.floor(st.prog / LINE.L) + 1));
    const ms = st.phase === 'done' && st.myResult ? st.myResult.ms : Math.max(0, t - st.go);
    el.innerHTML = `🏁 <b>${lap}/${RACE.laps}</b>바퀴 · <b>${rank()}</b>/${st.racers.length}위 · ${fmt(ms)}${st.boost > 0 ? ' · <b class="boost">⚡ 2배 속도!</b>' : ''}`;
  }
  $('raceQuit').onclick = () => { if (confirm('레이스를 그만두고 회사로 돌아갈까요?')) quit(); };
  return {
    join, leave, onEvent, tick, drive, quit, announce,
    get driving() { return st.mine; },
    get kick() { return st.mine ? st.kick : null; },
    get progress() { return st.mine ? +st.prog.toFixed(1) : undefined; },
    get running() { return st.running; },
    get lobbyText() { return st.running ? '🏁 레이스 진행 중 · 끝나면 칸에 다시 들어와요' : `🏁 ${Math.max(0, Math.ceil((st.startAt - now()) / 1000))}초 뒤 출발 · ${st.lobby.size}명 참가 · 칸 밖으로 나가면 취소`; },
    get joined() { return inLobby(); },
    get state() { return st; },
  };
}
