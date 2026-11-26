// 🏘 WORK 빌리지: 레이스 도로 동쪽 새 땅에 아파트 1동(5층, 층마다 1집) + 단독주택 15채
// 분양은 3층 💹 투자 상담실 '🏠 부동산' 탭에서 계약 → 산 사람만 자기 집에 들어감
// 집 안은 건물 층처럼 '층 번호'를 하나씩 가짐(HOME_BASE + 순서) → 같은 집에 있는 사람끼리만 보이고, 들어간 사람에게만 그림
import * as THREE from 'three';
import { Kit, MATERIALS as M, canvasTex, panel, BALL } from './building.js';

export const VILLAGE = { x0: 72, x1: 168, z0: -48, z1: 48 };          // 마을 땅 (회사 블록 동쪽, 레이스 도로 건너)
export const WALK = { x0: 30, x1: 72.5, z0: 15.4, z1: 18.6 };          // 회사 정원 동쪽 출입구(분수 옆, 산울타리 틈) → 마을 건널목 길
export const HOME_BASE = 5;                                           // 집 안 '층 번호' 시작 (0~4는 사옥)
export const HOME_Y = 60;                                             // 집 안은 하늘 높이에 따로 그림 (사옥 · 마을과 겹치지 않게)
export const inVillage = (f, x, z) => f === 0 && ((x > VILLAGE.x0 && x < VILLAGE.x1 && z > VILLAGE.z0 && z < VILLAGE.z1) || (x > WALK.x0 && x < WALK.x1 && z > WALK.z0 && z < WALK.z1));

// 분양 물건: 아파트 5집(층마다 1집) + 단독주택 15채(30평 / 50평 고름)
const APT = { x: 84, z: -33, w: 12, d: 10, fh: 3.2 };
export const UNITS = [];
for (let f = 1; f <= 5; f++) {
  const pent = f === 5;
  UNITS.push({ id: `A${f}`, kind: 'apt', floor: f, label: pent ? '아파트 5층 펜트하우스' : `아파트 ${f}층`, sizes: { [pent ? 45 : 34]: pent ? 2200000 : f === 1 ? 1300000 : f === 4 ? 1600000 : 1500000 } });
}
const ROWS = [[-36, 1], [-14, 1], [18, -1]]; // [집 가운데 z, 문 방향(+1 남쪽 / -1 북쪽)]
ROWS.forEach(([z, face], r) => [100, 114, 128, 142, 156].forEach((x, i) => {
  const n = r * 5 + i + 1;
  UNITS.push({ id: `H${n}`, kind: 'house', n, x, z, face, label: `단독주택 ${n}번지`, sizes: { 30: 2000000, 50: 3500000 } });
}));
export const unitById = (id) => UNITS.find((u) => u.id === id);
export const homeFloor = (id) => HOME_BASE + UNITS.findIndex((u) => u.id === id);
export const unitOfFloor = (f) => UNITS[f - HOME_BASE] || null;
export const priceOf = (id, size) => unitById(id)?.sizes?.[size] || 0;
const HOUSE = { 30: { w: 8, d: 7, h: 3.2 }, 50: { w: 10, d: 8, h: 6.0 } };
// 집 안 크기 (반 폭 · 반 깊이, m)
export function roomSize(u, size) {
  if (u.kind === 'apt') return size >= 45 ? { hx: 6.2, hz: 4.6 } : { hx: 5.2, hz: 4.0 };
  return size >= 50 ? { hx: 6.2, hz: 4.6 } : { hx: 4.6, hz: 3.6 };
}
// 문 앞 (밖) 서는 자리
export function doorSpot(u, size = 30) {
  if (u.kind === 'apt') return { x: APT.x, z: APT.z + APT.d / 2 + 1.0, ry: 0 };
  const H = HOUSE[size] || HOUSE[30], bz = u.z - u.face * 1.0;
  return { x: u.x, z: bz + u.face * (H.d / 2 + 1.0), ry: u.face > 0 ? 0 : Math.PI };
}
const ROOFS = [0x8a3b2e, 0x2f4a6b, 0x4b5d3a, 0x5a4636, 0x6b6f76, 0x9a6a2e, 0x3b3f52];
const roofColor = (name) => { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return ROOFS[h % ROOFS.length]; };
const FONT = '"Pretendard","Noto Sans KR",sans-serif';

const VM = {
  lawn: new THREE.MeshStandardMaterial({ color: 0x6f9a4a, roughness: 1 }),
  path: new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.9 }),
  road: new THREE.MeshStandardMaterial({ color: 0x5c5f66, roughness: 0.9 }),
  stripe: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.8 }),
  wallW: new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.8 }),
  wallB: new THREE.MeshStandardMaterial({ color: 0xc9a27e, roughness: 0.85 }),
  aptWall: new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.7 }),
  aptBand: new THREE.MeshStandardMaterial({ color: 0x3c4150, roughness: 0.5 }),
  win: new THREE.MeshStandardMaterial({ color: 0x9cc4e4, roughness: 0.1, metalness: 0.3, emissive: 0x1a2a3a }),
  door: new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 0.6 }),
  curb: new THREE.MeshStandardMaterial({ color: 0xbdb6a8, roughness: 0.8 }),
  post: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9ad48, roughness: 0.3, metalness: 0.7 }),
  model: new THREE.MeshStandardMaterial({ color: 0xf7f7f4, roughness: 0.9 }),     // 견본 주택
  modelRoof: new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.8 }),
};

// ---------- 마을 (밖) ----------
export function createVillage(colliders) {
  const group = new THREE.Group();
  const k = new Kit(false);
  const { x0, x1, z0, z1 } = VILLAGE;
  // 잔디 · 큰길 · 건널목
  k.box(x1 - x0, 0.02, z1 - z0, (x0 + x1) / 2, -0.3, (z0 + z1) / 2, VM.lawn);
  k.box(WALK.x1 - WALK.x0, 0.03, WALK.z1 - WALK.z0, (WALK.x0 + WALK.x1) / 2, -0.29, (WALK.z0 + WALK.z1) / 2, VM.path);
  for (let x = 54; x <= 66; x += 1.2) k.box(0.6, 0.035, WALK.z1 - WALK.z0 - 0.4, x, -0.285, (WALK.z0 + WALK.z1) / 2, VM.stripe); // 레이스 도로 위 횡단보도
  k.box(x1 - x0 - 4, 0.03, 4, (x0 + x1) / 2 + 2, -0.29, 2, VM.path);                     // 가운데 큰길 (동서)
  for (const z of [-25, 30]) k.box(70, 0.03, 2.6, 128, -0.29, z, VM.path);                  // 집 앞 골목
  k.box(2.6, 0.03, 70, 93, -0.29, -6, VM.path);                                            // 남북 골목
  // 마을 입구 아치 + 간판
  const GZ = (WALK.z0 + WALK.z1) / 2; // 입구 아치 z
  k.box(21, 0.03, 3.2, 82.5, -0.29, GZ, VM.path);                                          // 입구 → 남북 골목
  for (const z of [GZ - 2.2, GZ + 2.2]) { k.box(0.5, 4.2, 0.5, 73.5, -0.3, z, VM.wallB); colliders.push({ x1: 73.2, z1: z - 0.3, x2: 73.8, z2: z + 0.3, tall: true }); }
  k.box(0.6, 0.5, 5.2, 73.5, 3.9, GZ, VM.wallB);
  const sign = canvasTex(1024, 220, (ctx, w, h) => {
    ctx.fillStyle = '#2b3a2c'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#d9ad48'; ctx.lineWidth = 8; ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = '#f4e3b2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 96px ${FONT}`; ctx.fillText('🏘 WORK 빌리지', w / 2, h / 2 + 4);
  });
  panel(group, sign, 4.6, 1.0, 73.18, 3.4, GZ, -Math.PI / 2);
  panel(group, sign, 4.6, 1.0, 73.82, 3.4, GZ, Math.PI / 2);
  // 가로등 · 나무 (길가)
  for (let x = 80; x <= 164; x += 12) for (const z of [-0.6, 4.6]) { k.box(0.12, 3.6, 0.12, x, -0.3, z, VM.aptBand); k.add(BALL, M.lamp || VM.win, x, 3.4, z, 0, 0.22, 0.22, 0.22); }
  for (const [x, z] of [[80, 12], [80, 26], [86, 40], [166, -44], [166, 44], [76, -44]]) { k.box(0.3, 1.6, 0.3, x, -0.3, z, M.oak); k.add(BALL, M.leaf, x, 2.2, z, 0, 1.3, 1.5, 1.3); colliders.push({ x1: x - 0.35, z1: z - 0.35, x2: x + 0.35, z2: z + 0.35, tall: true }); }
  // 🏢 아파트 (5층): 층마다 1집, 1층 현관
  {
    const { x, z, w, d, fh } = APT, H = fh * 5;
    k.box(w, H, d, x, -0.3, z, VM.aptWall);
    for (let f = 1; f <= 5; f++) {
      const y = -0.3 + (f - 1) * fh;
      k.box(w + 0.3, 0.25, d + 0.3, x, y + fh - 0.12, z, VM.aptBand);
      for (const s of [-1, 1]) for (let i = -2; i <= 2; i++) k.box(1.4, 1.5, 0.06, x + i * 2.2, y + 0.9, z + s * (d / 2 + 0.02), VM.win);
      for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) k.box(0.06, 1.5, 1.6, x + s * (w / 2 + 0.02), y + 0.9, z + i * 3, VM.win);
      if (f > 1) { k.box(w * 0.6, 0.12, 1.2, x, y, z + d / 2 + 0.6, VM.aptBand); k.box(w * 0.6, 0.9, 0.05, x, y + 0.1, z + d / 2 + 1.18, M.glass); } // 발코니
    }
    k.box(w + 0.6, 0.4, d + 0.6, x, -0.3 + H, z, VM.aptBand);
    k.box(3.2, 0.2, 2.2, x, 2.5, z + d / 2 + 1.0, VM.aptBand);                    // 현관 차양
    k.box(1.6, 2.3, 0.08, x, -0.3, z + d / 2 + 0.03, VM.door);
    colliders.push({ x1: x - w / 2 - 0.1, z1: z - d / 2 - 0.1, x2: x + w / 2 + 0.1, z2: z + d / 2 + 0.1, tall: true });
    const s = canvasTex(1024, 200, (ctx, cw, ch) => { ctx.fillStyle = '#20242c'; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = '#f4e3b2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 88px ${FONT}`; ctx.fillText('WORK 빌리지 아파트', cw / 2, ch / 2); });
    panel(group, s, 6, 1.2, x, H - 1.2, z + d / 2 + 0.33, 0);
  }
  // 🌳 작은 공원 (마을 남서쪽): 벤치 · 안내판
  k.box(10, 0.04, 8, 84, -0.29, 36, VM.path);
  for (const [bx, bz] of [[81, 34], [87, 34]]) { k.box(1.8, 0.45, 0.6, bx, -0.3, bz, M.oak); colliders.push({ x1: bx - 0.9, z1: bz - 0.3, x2: bx + 0.9, z2: bz + 0.3, tall: false, top: 0.15 }); }
  k.flush(group);

  // 집터 15곳: 팔렸으면 집, 아니면 '분양 중' 팻말 (주인이 바뀌면 그 집만 다시 그림)
  const lots = new Map();
  const nameplate = canvasTex(1024, 256, () => {}); // 아파트 현관 우편함 표 (아래 update에서 다시 그림)
  const aptBoard = panel(group, nameplate, 1.6, 0.4, APT.x + 1.6, 1.2, APT.z + APT.d / 2 + 0.06, 0, true);
  function drawAptBoard(owners) {
    const c = nameplate.image, ctx = c.getContext('2d');
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#3a2c1c'; ctx.font = `700 34px ${FONT}`; ctx.textBaseline = 'middle';
    for (let f = 5; f >= 1; f--) { const o = owners.get(`A${f}`); ctx.fillText(`${f}층 · ${o ? o.name : '분양 중'}`, 20 + (f % 2 ? 0 : 500), 40 + Math.floor((5 - f) / 2) * 80); }
    nameplate.needsUpdate = true;
  }
  function buildLot(u, o) {
    const old = lots.get(u.id);
    if (old) { group.remove(old.g); old.g.traverse((m) => m.geometry?.dispose?.()); for (const c of old.cols) { const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); } }
    const g = new THREE.Group(), hk = new Kit(false), cols = [];
    const { x, z, face } = u;
    hk.box(12, 0.06, 0.2, x, -0.3, z - 6, VM.curb); hk.box(12, 0.06, 0.2, x, -0.3, z + 6, VM.curb);
    hk.box(0.2, 0.06, 12, x - 6, -0.3, z, VM.curb); hk.box(0.2, 0.06, 12, x + 6, -0.3, z, VM.curb);
    if (o) {
      const H = HOUSE[o.size] || HOUSE[30], bz = z - face * 1.0, roof = new THREE.MeshStandardMaterial({ color: roofColor(o.name), roughness: 0.7 });
      hk.box(H.w, H.h, H.d, x, -0.3, bz, o.size >= 50 ? VM.wallB : VM.wallW);
      const rg = new THREE.CylinderGeometry(H.d * 0.72, H.d * 0.72, H.w + 0.6, 3, 1); rg.rotateZ(Math.PI / 2); rg.scale(1, 0.55, 1);
      hk.add(rg, roof, x, -0.3 + H.h + H.d * 0.2, bz);                                                       // 박공지붕
      const fz = bz + face * (H.d / 2 + 0.03);
      hk.box(1.1, 2.1, 0.08, x, -0.3, fz, VM.door); hk.box(1.5, 0.12, 0.9, x, 1.95, fz + face * 0.4, roof);  // 문 · 작은 차양
      for (const s of [-1, 1]) for (let fl = 0; fl < (o.size >= 50 ? 2 : 1); fl++) hk.box(1.4, 1.1, 0.06, x + s * (H.w / 4 + 0.4), 0.7 + fl * 2.9, fz, VM.win);
      hk.box(0.8, 0.06, 0.5, x, -0.28, fz + face * 0.5, VM.curb);
      cols.push({ x1: x - H.w / 2 - 0.1, z1: bz - H.d / 2 - 0.1, x2: x + H.w / 2 + 0.1, z2: bz + H.d / 2 + 0.1, tall: true });
      const np = canvasTex(512, 160, (ctx, w, h) => { ctx.fillStyle = '#2d2a26'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#d9ad48'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12); ctx.fillStyle = '#f4e3b2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 56px ${FONT}`; ctx.fillText(`${o.name}`, w / 2, h / 2 - 14); ctx.font = `400 30px ${FONT}`; ctx.fillStyle = '#c9bfa8'; ctx.fillText(`${u.n}번지 · ${o.size}평`, w / 2, h / 2 + 40); });
      panel(g, np, 0.9, 0.28, x + 1.0, 1.5, fz + face * 0.05, face > 0 ? 0 : Math.PI);
    } else {
      // 분양 중: 하얀 견본 주택 + '분양 중' 현수막 (빈 땅만 있으면 마을이 허전해서)
      const H = HOUSE[30], bz = z - face * 1.0, fz = bz + face * (H.d / 2 + 0.03);
      hk.box(H.w, H.h, H.d, x, -0.3, bz, VM.model);
      const rg = new THREE.CylinderGeometry(H.d * 0.72, H.d * 0.72, H.w + 0.6, 3, 1); rg.rotateZ(Math.PI / 2); rg.scale(1, 0.55, 1);
      hk.add(rg, VM.modelRoof, x, -0.3 + H.h + H.d * 0.2, bz);
      hk.box(1.1, 2.1, 0.08, x, -0.3, fz, VM.modelRoof);
      for (const s2 of [-1, 1]) hk.box(1.4, 1.1, 0.06, x + s2 * (H.w / 4 + 0.4), 0.7, fz, VM.win);
      cols.push({ x1: x - H.w / 2 - 0.1, z1: bz - H.d / 2 - 0.1, x2: x + H.w / 2 + 0.1, z2: bz + H.d / 2 + 0.1, tall: true });
      const bn = canvasTex(1024, 200, (ctx, w, h) => { ctx.fillStyle = '#c23a3a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 92px ${FONT}`; ctx.fillText(`${u.n}번지 분양 중`, w / 2, h / 2 + 4); });
      panel(g, bn, 3.6, 0.7, x, 2.55, fz + face * 0.05, face > 0 ? 0 : Math.PI);
      // 길가 팻말
      const sz = z + face * 4.5;
      hk.box(0.1, 1.2, 0.1, x, -0.3, sz, VM.post);
      const sg = canvasTex(512, 256, (ctx, w, h) => { ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#c23a3a'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, w - 16, h - 16); ctx.fillStyle = '#c23a3a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 70px ${FONT}`; ctx.fillText('분양 중', w / 2, 90); ctx.fillStyle = '#333'; ctx.font = `600 38px ${FONT}`; ctx.fillText(`${u.n}번지 · 3층 투자 상담실`, w / 2, 180); });
      for (const s of [1, -1]) panel(g, sg, 1.2, 0.6, x, 1.05, sz + s * 0.06, s > 0 ? 0 : Math.PI);
      cols.push({ x1: x - 0.15, z1: sz - 0.15, x2: x + 0.15, z2: sz + 0.15, tall: true });
    }
    hk.flush(g);
    group.add(g); colliders.push(...cols);
    lots.set(u.id, { g, cols, key: o ? `${o.name}|${o.size}` : '' });
  }
  for (const u of UNITS) if (u.kind === 'house') buildLot(u, null);
  drawAptBoard(new Map());
  return {
    group,
    // 주인이 바뀐 집만 다시 그림 → 바뀌었으면 true (길찾기 격자를 다시 만들어야 함)
    update(owners) {
      let changed = false;
      for (const u of UNITS) if (u.kind === 'house') { const o = owners.get(u.id), key = o ? `${o.name}|${o.size}` : ''; if (lots.get(u.id)?.key !== key) { buildLot(u, o); changed = true; } }
      drawAptBoard(owners);
      return changed;
    },
    // 문 앞에 서 있으면 그 물건 (아파트는 현관 하나)
    doorNear(x, z, owners) {
      if (Math.hypot(x - APT.x, z - (APT.z + APT.d / 2 + 0.8)) < 1.6) return { apt: true };
      for (const u of UNITS) if (u.kind === 'house') { const o = owners.get(u.id), s = doorSpot(u, o?.size); if (Math.hypot(x - s.x, z - s.z) < 1.4 || (!o && Math.hypot(x - u.x, z - (u.z + u.face * 4.5)) < 1.6)) return { unit: u, owner: o }; }
      return null;
    },
  };
}

// ---------- 집 안 ----------
const IM = {
  floor: new THREE.MeshStandardMaterial({ color: 0xd8bf9a, roughness: 0.6 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.9 }),
  base: new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.7 }),
  ceil: new THREE.MeshStandardMaterial({ color: 0xfbf8f2, roughness: 0.9, emissive: 0x6a665e }),
  lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.45, 1.2) }),
  door: new THREE.MeshStandardMaterial({ color: 0x7a5a40, roughness: 0.55 }),
  mat: new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 }),
  rug: new THREE.MeshStandardMaterial({ color: 0xc9b8a0, roughness: 1 }),
  box: new THREE.MeshStandardMaterial({ color: 0xc89a60, roughness: 0.8 }),
};
const viewTex = (night) => canvasTex(1024, 384, (ctx, w, h) => { // 창밖 풍경 (하늘 · 먼 도시)
  const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, night ? '#0d1530' : '#7fb6e8'); gr.addColorStop(1, night ? '#2a2f55' : '#d9ecf8'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) { const bw = 20 + r() * 50, bh = 60 + r() * 220, x = r() * w; ctx.fillStyle = night ? '#1b2038' : '#9fb0c4'; ctx.fillRect(x, h - bh, bw, bh); if (night) { ctx.fillStyle = '#ffd98a'; for (let j = 0; j < 8; j++) ctx.fillRect(x + 4 + r() * (bw - 8), h - bh + r() * bh, 3, 4); } }
});
export function createHomeInterior(u, size, owner) {
  const group = new THREE.Group(), colliders = [], k = new Kit(false);
  const { hx, hz } = roomSize(u, size), Hh = 2.9;
  k.box(hx * 2, 0.05, hz * 2, 0, -0.05, 0, IM.floor);
  k.box(hx * 2, 0.05, hz * 2, 0, Hh, 0, IM.ceil);
  const wall = (w, d, x, z) => { k.box(w, Hh, d, x, 0, z, IM.wall); k.box(w + 0.02, 0.1, d + 0.02, x, 0, z, IM.base); };
  wall(hx * 2, 0.2, 0, -hz - 0.1); wall(hx * 2, 0.2, 0, hz + 0.1); wall(0.2, hz * 2, -hx - 0.1, 0); wall(0.2, hz * 2, hx + 0.1, 0);
  colliders.push({ x1: -hx - 1, z1: -hz - 1, x2: hx + 1, z2: -hz, tall: true }, { x1: -hx - 1, z1: hz, x2: hx + 1, z2: hz + 1, tall: true }, { x1: -hx - 1, z1: -hz, x2: -hx, z2: hz, tall: true }, { x1: hx, z1: -hz, x2: hx + 1, z2: hz, tall: true });
  // 현관문 (남쪽 벽 가운데) + 매트 + 배달 상자 놓는 자리
  k.box(1.1, 2.2, 0.06, 0, 0, hz - 0.02, IM.door); k.box(0.08, 0.08, 0.06, 0.4, 1.0, hz - 0.08, M.gold || IM.door);
  k.box(1.4, 0.02, 0.8, 0, 0, hz - 0.6, IM.mat);
  // 창 (북쪽 벽): 아파트는 통창, 주택은 창 두 개
  const night = false, vt = viewTex(night);
  if (u.kind === 'apt') panel(group, vt, hx * 1.6, 1.7, 0, 1.45, -hz + 0.01, 0);
  else for (const s of [-1, 1]) panel(group, vt, 1.8, 1.3, s * hx * 0.45, 1.5, -hz + 0.01, 0);
  // 천장 등 · 러그
  for (const [x, z] of [[-hx / 2, 0], [hx / 2, 0]]) k.add(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20), IM.lamp, x, Hh - 0.03, z);
  k.box(hx * 0.9, 0.015, hz * 0.8, 0, 0, -0.3, IM.rug);
  k.flush(group);
  // 벽에 붙은 이름 액자
  const tag = canvasTex(512, 200, (ctx, w, h) => { ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#b08a4a'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10); ctx.fillStyle = '#3a2c1c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 58px ${FONT}`; ctx.fillText(`🏠 ${owner}님의 집`, w / 2, 80); ctx.font = `500 32px ${FONT}`; ctx.fillStyle = '#7a6a55'; ctx.fillText(`${u.label} · ${size}평`, w / 2, 150); });
  panel(group, tag, 1.3, 0.5, -hx + 0.02, 1.7, 0, Math.PI / 2);
  return { group, colliders, hx, hz, ceil: Hh, door: { x: 0, z: hz - 0.9 }, spawn: { x: 0, z: hz - 2.3 }, box: { x: hx - 1.0, z: hz - 1.0 } };
}

// ---------- 분양 · 계약 (3층 투자 상담실 '🏠 부동산' 탭) ----------
// 서버(Supabase)에 docs/estate.sql을 실행하면 서버가 주인 · 돈을 확인. 서버 없는 로컬 데모에선 이 브라우저에만 저장
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const man = (n) => `${Math.round(n / 10000).toLocaleString('ko-KR')}만 원`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function createEstate(api) {
  const { $, supa, money, me } = api;
  const owners = new Map();
  let mode = supa ? 'wait' : 'local', sel = null, selSize = 0, busy = false;
  const LS = 'work-estate';
  const localAll = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  const saveLocal = () => { const o = {}; for (const [k, v] of owners) o[k] = v; try { localStorage.setItem(LS, JSON.stringify(o)); } catch {} };
  function set(rows) {
    owners.clear();
    for (const r of rows) if (r && r.unit && unitById(r.unit)) owners.set(r.unit, { name: r.name, size: +r.size, price: +r.price });
    api.changed();
    if (!$('investModal').hidden && api.tab() === 'estate') render($('invBody'));
  }
  async function load() {
    if (supa) {
      const { data, error } = await supa.rpc('estate_list');
      if (!error) { mode = 'server'; set(data || []); return; }
      mode = /PGRST202|function|404/i.test(error.message + (error.code || '')) ? 'off' : mode; // 서버에 아직 estate.sql을 안 돌렸으면 분양 중지
      if (mode === 'off') { owners.clear(); api.changed(); }
      return;
    }
    set(Object.entries(localAll()).map(([unit, v]) => ({ unit, ...v })));
  }
  const mine = () => { for (const [id, o] of owners) if (o.name === me.name) return { unit: unitById(id), ...o }; return null; };
  setInterval(load, 120000);

  function render(el) {
    const my = mine();
    const apt = UNITS.filter((u) => u.kind === 'apt').reverse(), houses = UNITS.filter((u) => u.kind === 'house');
    if (sel && owners.has(sel.id)) sel = null;
    const row = (u) => {
      const o = owners.get(u.id), [sz, pr] = Object.entries(u.sizes)[0];
      return `<div class="est-row${o ? ' sold' : ''}${sel?.id === u.id ? ' on' : ''}" data-u="${u.id}"><b>${u.floor}층${u.floor === 5 ? ' 🌇' : ''}</b><span>${sz}평 · ${man(pr)}</span><em>${o ? `🔑 ${esc(o.name)}` : '분양 중'}</em></div>`;
    };
    el.innerHTML = `<li class="est">
      <div class="est-head">🏘 <b>WORK 빌리지</b> 분양 <small>회사 동쪽 · 레이스 도로 건너 · 한 사람에 한 채</small></div>
      ${mode === 'off' ? '<p class="est-note">🚧 서버 준비 중이에요. 관리자가 Supabase에 분양 SQL을 실행하면 열려요.</p>' : ''}
      ${my ? `<div class="est-mine">🔑 내 집: <b>${my.unit.label}</b> · ${my.size}평<div><button type="button" id="estGo">🏠 우리 집 가기</button><button type="button" id="estSell" class="link">되팔기 (${man(my.price * 0.9)} 돌려받기)</button></div></div>` : ''}
      <h4>🏢 아파트 <small>5층 · 층마다 한 집</small></h4>
      <div class="est-apt">${apt.map(row).join('')}</div>
      <h4>🏡 단독주택 <small>15채 · 30평 / 50평 골라요</small></h4>
      <div class="est-lots">${houses.map((u) => { const o = owners.get(u.id); return `<button type="button" class="${o ? 'sold' : ''}${sel?.id === u.id ? ' on' : ''}" data-u="${u.id}" ${o ? `title="${esc(o.name)}"` : ''}><b>${u.n}</b><small>${o ? esc(o.name) : '분양'}</small></button>`; }).join('')}</div>
      <div id="estSel">${sel ? pick() : '<p class="est-note">원하는 집을 골라 주세요.</p>'}</div>
    </li>`;
    el.querySelectorAll('[data-u]').forEach((b) => (b.onclick = () => { const u = unitById(b.dataset.u); if (owners.has(u.id)) return; sel = u; selSize = +Object.keys(u.sizes)[0]; render(el); }));
    el.querySelectorAll('[data-sz]').forEach((b) => (b.onclick = () => { selSize = +b.dataset.sz; render(el); }));
    if ($('estDeal')) $('estDeal').onclick = () => openContract(sel, selSize);
    if ($('estGo')) $('estGo').onclick = () => { api.closeModals(); api.goHome(); };
    if ($('estSell')) $('estSell').onclick = sell;
  }
  function pick() {
    const sizes = Object.entries(sel.sizes), my = mine(), pr = sel.sizes[selSize], cash = money.cash();
    return `<div class="est-pick"><b>${sel.label}</b>
      <div class="est-sizes">${sizes.map(([s, p]) => `<button type="button" data-sz="${s}" class="${+s === selSize ? 'on' : ''}">${s}평<small>${man(p)}</small></button>`).join('')}</div>
      <p class="est-note">${sel.kind === 'apt' ? (sel.floor === 5 ? '🌇 꼭대기 층 펜트하우스 · 가장 넓어요' : '창밖으로 도시가 보이는 아파트') : selSize >= 50 ? '2층짜리 넓은 집 · 큰 방' : '아담한 1층 집'} · 내 지갑 ${won(cash)}</p>
      <button type="button" id="estDeal" class="primary" ${my || cash < pr || mode === 'off' ? 'disabled' : ''}>${my ? '이미 집이 있어요 (되팔고 옮길 수 있어요)' : cash < pr ? `돈이 모자라요 (${man(pr - cash)} 더 필요)` : `📝 ${man(pr)}에 계약하기`}</button></div>`;
  }
  // 📝 계약서
  function openContract(u, size) {
    const pr = u.sizes[size], d = new Date();
    $('contractBody').innerHTML = `<div class="ct-paper">
      <h3>부동산 분양 계약서</h3>
      <table>
        <tr><th>물건</th><td>WORK 빌리지 ${esc(u.label)}</td></tr>
        <tr><th>면적</th><td>${size}평</td></tr>
        <tr><th>분양 금액</th><td><b>${won(pr)}</b> (일시불)</td></tr>
        <tr><th>매수인</th><td>${esc(me.name)}</td></tr>
        <tr><th>매도인</th><td>WORK 빌리지 분양사무소</td></tr>
        <tr><th>계약일</th><td>${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일</td></tr>
      </table>
      <p class="ct-terms">1. 한 사람은 한 채만 가질 수 있어요.<br>2. 되팔면 분양 금액의 90%를 돌려받아요.<br>3. 게임 속 가상 집이에요. 실제 재산과 관계없어요.</p>
      <label class="ct-ok"><input type="checkbox" id="ctOk"> 위 내용을 확인했어요</label>
      <div class="ct-sign"><span>매수인 서명</span><i id="ctName"></i></div>
      <div id="ctSeal" hidden>계약<br>완료</div>
    </div>
    <div class="g-btns"><button type="button" id="ctGo" class="primary" disabled>✍️ 서명하고 계약하기</button></div>`;
    $('ctOk').onchange = () => { $('ctGo').disabled = !$('ctOk').checked; };
    $('ctGo').onclick = () => buy(u, size);
    api.openModal('contractModal');
  }
  async function buy(u, size) {
    if (busy) return; busy = true; $('ctGo').disabled = true;
    const pr = u.sizes[size];
    let ok = false, why = '';
    if (mode === 'server') {
      try { await money.call('estate_buy', { p_unit: u.id, p_size: size }); ok = true; } catch (e) { why = /sold/.test(e.message) ? '앗, 방금 다른 분이 계약했어요.' : /has_home/.test(e.message) ? '이미 집이 있어요.' : /no_cash/.test(e.message) ? '지갑에 돈이 모자라요.' : '계약하지 못했어요: ' + e.message; }
      await load();
    } else if (mode === 'local') {
      if (owners.has(u.id)) why = '앗, 방금 다른 분이 계약했어요.'; else if (mine()) why = '이미 집이 있어요.'; else if (!money.spend(pr)) why = '지갑에 돈이 모자라요.';
      else { owners.set(u.id, { name: me.name, size, price: pr }); saveLocal(); ok = true; api.changed(); }
    } else why = '서버 준비 중이에요.';
    busy = false;
    if (!ok) { alert(`📝 ${why}`); $('ctGo').disabled = false; return; }
    $('ctName').textContent = me.name; $('ctSeal').hidden = false; api.beep();
    api.send({ t: 'estate' });
    api.sys(`🏠 ${u.label}(${size}평) 계약 완료! 위쪽 🏠 버튼으로 언제든 집에 갈 수 있어요.`);
    $('contractBody').querySelector('.g-btns').innerHTML = '<button type="button" id="ctHome" class="primary">🏠 집 구경 가기</button>';
    $('ctHome').onclick = () => { api.closeModals(); api.goHome(); };
    sel = null;
  }
  async function sell() {
    const my = mine(); if (!my) return;
    if (!confirm(`정말 ${my.unit.label}을(를) 되팔까요?\n${won(my.price * 0.9)}을 돌려받아요. (산 값의 90%)`)) return;
    if (api.atHome()) api.leaveHome();
    if (mode === 'server') { try { await money.call('estate_sell', {}); } catch (e) { alert('되팔지 못했어요: ' + e.message); } await load(); }
    else { owners.delete(my.unit.id); saveLocal(); money.earn(my.price * 0.9); api.changed(); }
    api.send({ t: 'estate' });
    api.sys(`🏷 ${my.unit.label}을(를) 되팔았어요. ${won(my.price * 0.9)}을 돌려받았어요.`);
    render($('invBody'));
  }
  return { owners, load, render, mine, onEvent: (e) => { if (e?.t === 'estate') load(); }, get mode() { return mode; } };
}
