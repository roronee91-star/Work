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
const APT = { x: 84, z: -33, w: 16, d: 12, tw: 10, td: 8, ph: 4.2, fh: 3.4 }; // 아래 2층 높이 기단(w×d) + 위 5층 유리 타워(tw×td)
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
// 🏡 단독주택 모양 3가지 (참고 사진 분위기): 금속 박공지붕 목조 · 화이트 단층(낮은 담장) · 모던 큐브. 집터마다 정해짐
const STYLES = ['cabin', 'stucco', 'cube'];
export const styleOf = (u) => STYLES[(u.n + Math.floor((u.n - 1) / 5)) % 3];
const DIMS = { cabin: { 30: [7.5, 6.5], 50: [9, 7.5] }, stucco: { 30: [9, 6.5], 50: [11, 7] }, cube: { 30: [7, 6], 50: [9, 7] } };
const dims = (u, size) => (DIMS[styleOf(u)] || DIMS.cabin)[size >= 50 ? 50 : 30];
// 집 안 크기 (반 폭 · 반 깊이, m)
export function roomSize(u, size) {
  if (u.kind === 'apt') return size >= 45 ? { hx: 6.2, hz: 4.6 } : { hx: 5.2, hz: 4.0 };
  return size >= 50 ? { hx: 6.2, hz: 4.6 } : { hx: 4.6, hz: 3.6 };
}
// 문 앞 (밖) 서는 자리
export function doorSpot(u, size = 30) {
  if (u.kind === 'apt') return { x: APT.x, z: APT.z + APT.d / 2 + 1.0, ry: 0 };
  const [, d] = dims(u, size);
  return { x: u.x, z: u.z + u.face * (-1 + d / 2 + 1.0), ry: u.face > 0 ? 0 : Math.PI };
}
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
  // 집 재질 (참고 사진 분위기)
  silverWood: new THREE.MeshStandardMaterial({ color: 0xbcb8ae, roughness: 0.85 }),
  silverDk: new THREE.MeshStandardMaterial({ color: 0x9e9a90, roughness: 0.85 }),
  cedar: new THREE.MeshStandardMaterial({ color: 0xb08258, roughness: 0.8 }),
  cedarDk: new THREE.MeshStandardMaterial({ color: 0x8c6440, roughness: 0.8 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xa3aab2, roughness: 0.35, metalness: 0.6 }),
  metalDk: new THREE.MeshStandardMaterial({ color: 0x4c5158, roughness: 0.4, metalness: 0.5 }),
  frameBlue: new THREE.MeshStandardMaterial({ color: 0x34465c, roughness: 0.4 }),
  frameBlack: new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.4 }),
  glassW: new THREE.MeshStandardMaterial({ color: 0x8fb4cf, roughness: 0.05, metalness: 0.4, emissive: 0x2a3540 }),
  deck: new THREE.MeshStandardMaterial({ color: 0xa48a6c, roughness: 0.8 }),
  stucco: new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: 0.9 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xefe5d2, roughness: 0.9 }),
  roofDk: new THREE.MeshStandardMaterial({ color: 0x3b3e44, roughness: 0.7 }),
  roofBr: new THREE.MeshStandardMaterial({ color: 0x5c4b40, roughness: 0.7 }),
  doorSage: new THREE.MeshStandardMaterial({ color: 0x66726c, roughness: 0.5 }),
  panelW: new THREE.MeshStandardMaterial({ color: 0xf1f1ee, roughness: 0.6 }),
  panelG: new THREE.MeshStandardMaterial({ color: 0xd9d9d4, roughness: 0.6 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x5a5d63, roughness: 0.5 }),
  gravel: new THREE.MeshStandardMaterial({ color: 0x9c9a94, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xd8d4cb, roughness: 0.9 }),
  shrub: new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.9, flatShading: true }),
  lavender: new THREE.MeshStandardMaterial({ color: 0x8f7cc4, roughness: 0.9, flatShading: true }),
  flowerW: new THREE.MeshStandardMaterial({ color: 0xf4f1e6, roughness: 0.9, flatShading: true }),
  birch: new THREE.MeshStandardMaterial({ color: 0xece8de, roughness: 0.8 }),
  leafL: new THREE.MeshStandardMaterial({ color: 0x86b15a, roughness: 0.9, flatShading: true }),
  pot: new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 0.8 }),
  lampOn: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 0.8) }),
  slat: new THREE.MeshStandardMaterial({ color: 0x9a6a44, roughness: 0.8 }),
  // 아파트
  aGlass: new THREE.MeshStandardMaterial({ color: 0x6f95b5, roughness: 0.08, metalness: 0.55, emissive: 0x16222e }),
  bronze: new THREE.MeshStandardMaterial({ color: 0x9a7a55, roughness: 0.35, metalness: 0.6 }),
  slabL: new THREE.MeshStandardMaterial({ color: 0xd9cfbd, roughness: 0.6 }),
  podium: new THREE.MeshStandardMaterial({ color: 0x8a6e52, roughness: 0.5, metalness: 0.2 }),
};
// 박공(삼각) 기둥: 앞뒤로 기운 지붕 아래 벽 (x 방향으로 길게)
function gablePrism(w, d, rh) { const sh = new THREE.Shape(); sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(0, rh); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(-w / 2, 0, 0); return g; }

// ---------- 마을 (밖) ----------
export function createVillage(colliders, myName = () => '') {
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
  // 🏢 아파트: 아래는 청동빛 기단(로비), 위는 세로 청동 줄이 있는 유리 타워 5층(층마다 1집), 꼭대기 둥근 왕관
  {
    const { x, z, w, d, tw, td, ph, fh } = APT, top = -0.3 + ph + fh * 5;
    k.box(w, ph, d, x, -0.3, z, VM.podium);
    for (let i = 0; i <= 10; i++) { const px = x - w / 2 + (w * i) / 10; for (const s2 of [-1, 1]) k.box(0.18, ph, 0.25, px, -0.3, z + s2 * (d / 2 + 0.05), VM.bronze); }
    for (const y of [1.8, ph - 0.4]) for (const s2 of [-1, 1]) k.box(w + 0.1, 0.18, 0.3, x, -0.3 + y, z + s2 * (d / 2 + 0.06), VM.bronze);
    for (let i = 0; i < 10; i++) for (const s2 of [-1, 1]) if (Math.abs(x - w / 2 + (w * (i + 0.5)) / 10 - x) > 1.2) k.box(w / 10 - 0.25, ph - 0.7, 0.05, x - w / 2 + (w * (i + 0.5)) / 10, 0.1, z + s2 * (d / 2 + 0.02), VM.aGlass);
    k.box(w + 0.6, 0.35, d + 0.6, x, -0.3 + ph - 0.1, z, VM.slabL);
    // 타워
    const ty = -0.3 + ph + 0.25, H = fh * 5 - 0.25, tz = z - 0.6;
    k.box(tw, H, td, x, ty, tz, VM.aGlass);
    for (let f = 1; f <= 5; f++) k.box(tw + 0.12, 0.22, td + 0.12, x, ty + f * fh - 0.36, tz, VM.slabL);
    for (let i = 0; i <= 10; i++) for (const s2 of [-1, 1]) k.box(0.12, H, 0.3, x - tw / 2 + i, ty, tz + s2 * (td / 2 + 0.08), VM.bronze);
    for (let i = 0; i <= 8; i++) for (const s2 of [-1, 1]) k.box(0.3, H, 0.12, x + s2 * (tw / 2 + 0.08), ty, tz - td / 2 + i, VM.bronze);
    // 꼭대기 왕관: 가운데 기둥 + 큰 고리 + 살
    k.add(new THREE.CylinderGeometry(2.2, 2.6, 1.6, 24), VM.bronze, x, top + 0.8, tz);
    const ring = new THREE.TorusGeometry(4.4, 0.16, 8, 48); ring.rotateX(Math.PI / 2);
    k.add(ring, VM.bronze, x, top + 2.4, tz);
    for (let i = 0; i < 12; i++) { const sp = new THREE.BoxGeometry(2.2, 0.1, 0.1); sp.translate(3.3, 0, 0); sp.rotateY((i / 12) * Math.PI * 2); k.add(sp, VM.bronze, x, top + 2.4, tz); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.box(0.1, 2.4, 0.1, x + Math.cos(a) * 4.4, top, tz + Math.sin(a) * 4.4, VM.bronze); }
    // 현관: 차양 + 유리문
    k.box(4.4, 0.25, 2.6, x, 2.7, z + d / 2 + 1.2, VM.bronze);
    for (const s2 of [-1, 1]) k.box(0.15, 3.0, 0.15, x + s2 * 2.0, -0.3, z + d / 2 + 2.3, VM.bronze);
    k.box(2.0, 2.4, 0.06, x, -0.3, z + d / 2 + 0.04, VM.aGlass);
    k.box(0.05, 2.4, 0.08, x, -0.3, z + d / 2 + 0.06, VM.bronze);
    colliders.push({ x1: x - w / 2 - 0.15, z1: z - d / 2 - 0.15, x2: x + w / 2 + 0.15, z2: z + d / 2 + 0.15, tall: true });
    for (const s2 of [-1, 1]) colliders.push({ x1: x + s2 * 2.0 - 0.15, z1: z + d / 2 + 2.15, x2: x + s2 * 2.0 + 0.15, z2: z + d / 2 + 2.45, tall: true });
    const sg = canvasTex(1024, 200, (ctx, cw, ch) => { ctx.fillStyle = '#2a2219'; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = '#e8cf9a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 84px ${FONT}`; ctx.fillText('WORK 빌리지 레지던스', cw / 2, ch / 2); });
    panel(group, sg, 5.6, 1.1, x, 3.45, z + d / 2 + 0.22, 0);
    // 앞마당 나무 · 화단
    for (const s2 of [-1, 1]) { k.box(3.2, 0.5, 1.4, x + s2 * 5.5, -0.3, z + d / 2 + 1.6, VM.stone); k.add(BALL, VM.shrub, x + s2 * 5.5, 0.45, z + d / 2 + 1.6, 0, 1.4, 0.5, 0.6); colliders.push({ x1: x + s2 * 5.5 - 1.6, z1: z + d / 2 + 0.9, x2: x + s2 * 5.5 + 1.6, z2: z + d / 2 + 2.3, tall: false, top: 0.6 }); }
  }
  // 🌳 작은 공원 (마을 남서쪽): 벤치 · 안내판
  k.box(10, 0.04, 8, 84, -0.29, 36, VM.path);
  for (const [bx, bz] of [[81, 34], [87, 34]]) { k.box(1.8, 0.45, 0.6, bx, -0.3, bz, M.oak); colliders.push({ x1: bx - 0.9, z1: bz - 0.3, x2: bx + 0.9, z2: bz + 0.3, tall: false, top: 0.15 }); }
  k.flush(group);

  // 집터 15곳: 팔렸으면 집, 아니면 '분양 중' 팻말 (주인이 바뀌면 그 집만 다시 그림)
  const lots = new Map();
  const nameplate = canvasTex(1024, 256, () => {}); // 아파트 현관 우편함 표 (아래 update에서 다시 그림)
  const aptBoard = panel(group, nameplate, 1.6, 0.4, APT.x + 4.2, 1.4, APT.z + APT.d / 2 + 0.3, 0, true); // 우편함 표
  function drawAptBoard(owners) {
    const c = nameplate.image, ctx = c.getContext('2d');
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#3a2c1c'; ctx.font = `700 34px ${FONT}`; ctx.textBaseline = 'middle';
    for (let f = 5; f >= 1; f--) { const o = owners.get(`A${f}`); ctx.fillText(`${f}층 · ${o ? o.name : '분양 중'}`, 20 + (f % 2 ? 0 : 500), 40 + Math.floor((5 - f) / 2) * 80); }
    nameplate.needsUpdate = true;
  }
  // 🏡 집 한 채 (앞 = +z 기준으로 만들고, 북쪽을 보는 집은 위치만 뒤집음)
  function house(hk, cols, u, size, x, z, face, gateClosed) {
    const st = styleOf(u), big = size >= 50, alt = u.n % 2 === 0, [W, D] = dims(u, size), bz = -1, fz = bz + D / 2;
    const P = (lx, lz) => [x + face * lx, z + face * lz];
    const B = (w, h, d, lx, y, lz, m) => { const [wx, wz] = P(lx, lz); hk.box(w, h, d, wx, y, wz, m); };
    const A = (geo, m, lx, y, lz, ry = 0) => { const [wx, wz] = P(lx, lz); hk.add(geo, m, wx, y, wz, ry + (face > 0 ? 0 : Math.PI)); };
    const ball = (m, lx, y, lz, sx, sy = sx, sz = sx) => { const [wx, wz] = P(lx, lz); hk.add(BALL, m, wx, y, wz, 0, sx, sy, sz); };
    const win = (lx, y, w, h, frame, lzz = fz) => { B(w + 0.14, h + 0.14, 0.08, lx, y - 0.07, lzz + 0.02, frame); B(w, h, 0.1, lx, y, lzz + 0.03, VM.glassW); B(0.05, h, 0.12, lx, y, lzz + 0.04, frame); };
    const col = (lx1, lz1, lx2, lz2, tall = true, top = 1) => { const [a, b] = P(lx1, lz1), [c, d] = P(lx2, lz2); cols.push({ x1: Math.min(a, c), z1: Math.min(b, d), x2: Math.max(a, c), z2: Math.max(b, d), tall, top }); };
    const tree = (lx, lz, s2 = 1) => { B(0.14 * s2, 2.6 * s2, 0.14 * s2, lx, -0.3, lz, VM.birch); ball(VM.leafL, lx, 2.6 * s2, lz, 1.0 * s2, 1.2 * s2); ball(VM.leafL, lx + 0.4, 2.1 * s2, lz + 0.2, 0.7 * s2); col(lx - 0.15, lz - 0.15, lx + 0.15, lz + 0.15); };
    if (st === 'cabin') {
      // 금속 박공지붕 목조 주택: 은빛(또는 삼나무) 세로 나무 외벽 · 큰 통유리 · 나무 데크 · 굴뚝
      const wm = alt ? VM.cedar : VM.silverWood, wd = alt ? VM.cedarDk : VM.silverDk, rm = alt ? VM.metalDk : VM.metal;
      const wh = big ? 4.6 : 2.9, rh = big ? 3.4 : 2.7, slope = Math.atan(rh / (D / 2)), L = Math.hypot(rh, D / 2);
      B(W, wh + 0.3, D, 0, -0.3, bz, wm);
      A(gablePrism(W, D, rh), wm, 0, wh, bz);
      for (let i = 0; i <= Math.floor(W / 0.42); i++) B(0.05, wh, 0.04, -W / 2 + 0.1 + i * 0.42, 0, fz + 0.01, wd);                 // 세로 널
      for (let i = 0; i <= Math.floor(D / 0.42); i++) for (const s2 of [-1, 1]) B(0.04, wh, 0.05, s2 * (W / 2 + 0.01), 0, bz - D / 2 + 0.1 + i * 0.42, wd);
      for (const s2 of [-1, 1]) { const g = new THREE.BoxGeometry(W + 0.6, 0.12, L + 0.35); g.rotateX(s2 * slope); A(g, rm, 0, wh + rh / 2 + 0.06, bz + s2 * D / 4);
        for (let i = 0; i < Math.floor((W + 0.6) / 0.45); i++) { const r = new THREE.BoxGeometry(0.04, 0.06, L + 0.35); r.rotateX(s2 * slope); A(r, VM.metalDk, -W / 2 - 0.3 + 0.2 + i * 0.45, wh + rh / 2 + 0.14, bz + s2 * D / 4); } }
      A(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 10), VM.metalDk, W * 0.25, wh + rh * 0.6, bz - D / 4);                               // 굴뚝
      win(-W / 4 - 0.4, 0.15, W * 0.36, 2.2, VM.frameBlue); win(W / 4 + 0.4, 0.15, W * 0.3, 2.2, VM.frameBlue);
      B(1.0, 2.2, 0.08, 0, 0, fz + 0.03, VM.frameBlue); B(0.85, 2.05, 0.1, 0, 0.05, fz + 0.04, VM.glassW);                              // 유리 현관문
      if (big) { win(-W / 4, 2.9, 1.2, 1.1, VM.frameBlue); win(W / 4, 2.9, 1.2, 1.1, VM.frameBlue); }
      for (const s2 of [-1, 1]) { const [wx, wz] = P(s2 * (W / 2 + 0.03), bz); hk.box(0.1, 1.0, 1.0, wx, 0.9 + (big ? 2.6 : 0), wz, VM.frameBlue); hk.box(0.12, 0.85, 0.85, wx, 0.97 + (big ? 2.6 : 0), wz, VM.glassW); } // 옆 창
      B(W + 1.2, 0.18, 2.4, 0.4, -0.3, fz + 1.2, VM.deck);                                                                               // 데크
      for (let i = 0; i < 10; i++) B(W + 1.2, 0.01, 0.02, 0.4, -0.12, fz + 0.15 + i * 0.23, VM.cedarDk);
      for (const cx of [W / 2 - 1.4, W / 2 - 0.5]) { B(0.5, 0.42, 0.5, cx, -0.12, fz + 1.4, VM.cedar); B(0.5, 0.45, 0.06, cx, 0.3, fz + 1.17, VM.cedar); }
      B(0.6, 0.55, 0.6, W / 2 + 0.3, -0.12, fz + 1.9, VM.pot); ball(VM.shrub, W / 2 + 0.3, 0.75, fz + 1.9, 0.5);
      for (const [lx, lz] of [[-5, 3.5], [-4.6, 4.4], [4.8, 4.6], [-5.2, -4.8]]) ball(VM.shrub, lx, -0.05, lz, 0.6, 0.45);
      for (let i = 0; i < 18; i++) ball(VM.flowerW, -5 + ((i * 37) % 100) / 10, -0.2, 4.5 + ((i * 13) % 12) / 10, 0.12);
      tree(-W / 2 - 0.9, fz - 0.3, 1.1);
      col(-W / 2 - 0.1, bz - D / 2 - 0.1, W / 2 + 0.1, fz + 0.1);
    } else if (st === 'stucco') {
      // 화이트 단층 주택: 짙은 모임지붕 · 검은 창틀 · 벽등 · 디딤돌 · 낮은 흰 담장 + 검은 철제 울타리 · 라벤더 화단
      const wm = alt ? VM.cream : VM.stucco, rm = alt ? VM.roofBr : VM.roofDk, h = 3.0, rh = 1.5;
      const hip = (w, d, lx, lz, y) => { const g = new THREE.ConeGeometry(1, rh, 4, 1); g.rotateY(Math.PI / 4); g.scale((w + 0.9) / 1.414, 1, (d + 0.9) / 1.414); A(g, rm, lx, y + rh / 2, lz); B(w + 0.5, 0.22, d + 0.5, lx, y - 0.12, lz, VM.stucco); };
      B(W, h + 0.3, D, 0, -0.3, bz, wm); B(W + 0.04, 0.35, D + 0.04, 0, -0.3, bz, VM.trim);
      hip(W, D, 0, bz, h);
      if (big) { B(4.4, h + 0.3, 3, W / 2 - 2.2, -0.3, fz + 1.4, wm); hip(4.4, 3, W / 2 - 2.2, fz + 1.4, h - 0.2); win(W / 2 - 2.2, 0.35, 2.6, 2.1, VM.frameBlack, fz + 2.9); col(W / 2 - 4.5, fz, W / 2 + 0.1, fz + 3.0); }
      win(-W / 4 - 0.5, 0.7, 2.0, 1.6, VM.frameBlack); win(-W / 2 + 0.9, 0.7, 0.7, 1.6, VM.frameBlack);
      if (!big) win(W / 4 + 0.6, 0.15, 2.4, 2.2, VM.frameBlack);
      B(1.0, 2.3, 0.1, 0, 0, fz + 0.03, VM.doorSage); B(0.3, 2.3, 0.1, 0.7, 0, fz + 0.03, VM.glassW); B(0.03, 0.5, 0.06, -0.35, 0.9, fz + 0.1, VM.frameBlack);
      for (const s2 of [-1, 1]) { B(0.14, 0.3, 0.14, s2 * 1.1, 1.9, fz + 0.08, VM.frameBlack); B(0.06, 0.06, 0.02, s2 * 1.1, 2.0, fz + 0.16, VM.lampOn); } // 벽등
      for (let i = 0; i < 3; i++) B(1.8 - i * 0.2, 0.12, 0.4, 0, -0.3 + i * 0.1, fz + 0.9 - i * 0.35, VM.stone);                         // 계단
      for (let i = 0; i < 5; i++) B(0.9, 0.04, 0.5, (i % 2 ? 0.15 : -0.1), -0.28, fz + 1.5 + i * 0.75, VM.stone);                     // 디딤돌
      for (const s2 of [-1, 1]) {                                                                                                           // 낮은 담장 + 철제 울타리 (가운데 열림)
        const cx = s2 * 3.6;
        for (let i = 0; i < 7; i++) { ball(VM.lavender, cx - 2 + i * 0.66, 0.0, 4.9, 0.28, 0.4); ball(VM.flowerW, cx - 1.7 + i * 0.66, -0.05, 4.5, 0.2, 0.25); }
        ball(VM.shrub, s2 * (W / 2 - 0.3), 0.1, fz + 0.7, 0.7, 0.55);
      }
      B(0.6, 0.6, 0.6, -0.9, -0.3, fz + 0.7, VM.pot); ball(VM.shrub, -0.9, 0.7, fz + 0.7, 0.35, 0.6);
      tree(-5, 2.8, 1.2);
      col(-W / 2 - 0.1, bz - D / 2 - 0.1, W / 2 + 0.1, fz + 0.1);
    } else {
      // 모던 큐브 주택: 평지붕 · 얇은 짙은 테두리 · 큰 검은 창 · 짙은 현관 · 자갈 마당 · 나무 울타리
      const wm = alt ? VM.panelG : VM.panelW, h = 3.2;
      B(W, h + 0.3, D, 0, -0.3, bz, wm); B(W + 0.04, 0.35, D + 0.04, 0, -0.3, bz, VM.trim);
      B(W + 0.12, 0.28, D + 0.12, 0, h - 0.05, bz, VM.trim);
      for (let i = 1; i < Math.floor(W / 1.2); i++) B(0.02, h, 0.03, -W / 2 + i * 1.2, 0, fz + 0.01, VM.panelG);
      if (big) { const uw = W * 0.62, ud = D * 0.7; B(uw, 3.0, ud, -W * 0.18, h, bz - 0.6, wm); B(uw + 0.12, 0.26, ud + 0.12, -W * 0.18, h + 2.95, bz - 0.6, VM.trim); win(-W * 0.18, h + 0.6, uw * 0.6, 1.6, VM.frameBlack, bz - 0.6 + ud / 2); }
      B(1.8, h - 0.4, 0.3, 0, 0, fz - 0.1, VM.trim); B(1.0, 2.3, 0.1, 0, 0, fz + 0.03, VM.metalDk); B(0.04, 0.6, 0.06, -0.3, 0.9, fz + 0.1, VM.panelW); // 들어간 현관
      win(W / 4 + 0.6, 0.35, W * 0.34, 2.0, VM.frameBlack); win(-W / 2 + 1.0, 0.5, 0.8, 1.8, VM.frameBlack);
      for (let i = 0; i < 3; i++) B(1.6, 0.12, 0.35, 0, -0.3 + i * 0.1, fz + 1.0 - i * 0.32, VM.stone);
      B(3.4, 0.03, 4.8, -3.6, -0.29, 3.0, VM.gravel); B(6.6, 0.03, 4.8, 2.4, -0.29, 3.0, VM.lawn);
      for (let i = 0; i < 4; i++) B(1.2, 0.04, 0.8, -0.2, -0.27, fz + 1.6 + i * 1.0, VM.stone);
      B(0.55, 0.6, 0.55, 1.2, -0.3, fz + 0.8, VM.pot); B(0.06, 0.8, 0.06, 1.2, 0.3, fz + 0.8, VM.cedarDk); ball(VM.leafL, 1.2, 1.25, fz + 0.8, 0.4, 0.5);
      for (const [lx, lz] of [[-4.6, 1.8], [-2.6, 4.6], [4.6, 2.4]]) ball(VM.shrub, lx, -0.05, lz, 0.55, 0.45);
      tree(-4.6, 4.4, 1.0);
      col(-W / 2 - 0.1, bz - D / 2 - 0.1, W / 2 + 0.1, fz + 0.1);
    }
    // 🚧 집터 둘레 울타리 (집 모양마다 다르게) · 앞 가운데 대문: 주인만 열림, 남의 집은 닫혀 있음
    const E = 5.85, GW = 0.95;
    const seg = (ax, az, bx, bz2) => {
      const len = Math.hypot(bx - ax, bz2 - az), mx = (ax + bx) / 2, mz = (az + bz2) / 2, alongX = Math.abs(bx - ax) > Math.abs(bz2 - az);
      const sb = (l, h, t, y, m) => B(alongX ? l : t, h, alongX ? t : l, mx, y, mz, m);
      const posts = (h, m, step, w = 0.12) => { const n = Math.max(1, Math.round(len / step)); for (let i = 0; i <= n; i++) { const t = i / n; B(w, h, w, ax + (bx - ax) * t, -0.3, az + (bz2 - az) * t, m); } };
      if (st === 'cabin') { posts(1.15, VM.cedarDk, 1.5); for (const y of [0.15, 0.55]) sb(len, 0.08, 0.06, y, VM.cedar); }
      else if (st === 'stucco') { sb(len, 0.55, 0.3, -0.3, VM.stucco); sb(len, 0.06, 0.08, 0.75, VM.frameBlack); posts(1.1, VM.frameBlack, 0.6, 0.05); }
      else { posts(1.45, VM.cedarDk, 1.8, 0.14); for (let i = 0; i < 5; i++) sb(len, 0.16, 0.05, -0.15 + i * 0.26, VM.slat); }
      col(Math.min(ax, bx) - 0.12, Math.min(az, bz2) - 0.12, Math.max(ax, bx) + 0.12, Math.max(az, bz2) + 0.12, true);
    };
    seg(-E, -E, E, -E); seg(-E, -E, -E, E); seg(E, -E, E, E); seg(-E, E, -GW, E); seg(GW, E, E, E);
    const gm = st === 'stucco' ? VM.frameBlack : st === 'cabin' ? VM.cedarDk : VM.trim;
    for (const s2 of [-1, 1]) B(0.22, 1.5, 0.22, s2 * GW, -0.3, E, gm);                                          // 대문 기둥
    const gate = (lx, lz, alongX) => { for (let i = 0; i < 7; i++) B(alongX ? 0.05 : 0.05, 0.9, alongX ? 0.05 : 0.05, alongX ? lx - 0.75 + i * 0.25 : lx, 0.05, alongX ? lz : lz - 0.75 + i * 0.25, gm); B(alongX ? 1.7 : 0.06, 0.07, alongX ? 0.06 : 1.7, lx, 0.9, lz, gm); B(alongX ? 1.7 : 0.06, 0.07, alongX ? 0.06 : 1.7, lx, 0.1, lz, gm); };
    if (gateClosed) { gate(0, E, true); col(-GW, E - 0.12, GW, E + 0.12, true); }
    else gate(GW - 0.05, E - 0.85, false);                                                                       // 열린 대문 (안쪽으로 젖혀짐)
    B(0.3, 0.35, 0.22, GW + 0.5, 0.75, E + 0.05, gm); B(0.06, 1.0, 0.06, GW + 0.5, -0.3, E + 0.05, gm);           // 우편함
    return { fz, P, B };
  }
  const lotKey = (o) => (o ? `${o.name}|${o.size}|${o.name === myName() ? 'mine' : 'other'}` : '');
  function buildLot(u, o) {
    const old = lots.get(u.id);
    if (old) { group.remove(old.g); old.g.traverse((m) => m.geometry?.dispose?.()); for (const c of old.cols) { const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); } }
    const g = new THREE.Group(), hk = new Kit(false), cols = [];
    const { x, z, face } = u, size = o?.size || 30;
    const { fz, P, B } = house(hk, cols, u, size, x, z, face, !!o && o.name !== myName());
    const ry = face > 0 ? 0 : Math.PI;
    if (o) {
      // 문패
      const np = canvasTex(512, 160, (ctx, w, h) => { ctx.fillStyle = '#2d2a26'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#d9ad48'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12); ctx.fillStyle = '#f4e3b2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 56px ${FONT}`; ctx.fillText(`${o.name}`, w / 2, h / 2 - 14); ctx.font = `400 30px ${FONT}`; ctx.fillStyle = '#c9bfa8'; ctx.fillText(`${u.n}번지 · ${o.size}평`, w / 2, h / 2 + 40); });
      const [nx, nz] = P(-0.95, fz + 0.07); panel(g, np, 0.8, 0.25, nx, 1.55, nz, ry);
    } else {
      // 분양 중: 빨간 현수막 + 길가 팻말
      const bn = canvasTex(1024, 200, (ctx, w, h) => { ctx.fillStyle = '#c23a3a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 92px ${FONT}`; ctx.fillText(`${u.n}번지 분양 중`, w / 2, h / 2 + 4); });
      const [bx, bz2] = P(0, fz + 0.12); panel(g, bn, 3.2, 0.62, bx, 2.45, bz2, ry);
      B(0.1, 1.2, 0.1, -4.2, -0.3, 4.6, VM.post);
      const sg = canvasTex(512, 256, (ctx, w, h) => { ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#c23a3a'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, w - 16, h - 16); ctx.fillStyle = '#c23a3a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 70px ${FONT}`; ctx.fillText('분양 중', w / 2, 90); ctx.fillStyle = '#333'; ctx.font = `600 38px ${FONT}`; ctx.fillText(`${u.n}번지 · 3층 투자 상담실`, w / 2, 180); });
      const [sx, sz] = P(-4.2, 4.6); for (const s2 of [1, -1]) panel(g, sg, 1.2, 0.6, sx, 1.05, sz + s2 * 0.06, s2 > 0 ? 0 : Math.PI);
      cols.push({ x1: sx - 0.15, z1: sz - 0.15, x2: sx + 0.15, z2: sz + 0.15, tall: true });
    }
    hk.flush(g);
    group.add(g); colliders.push(...cols);
    lots.set(u.id, { g, cols, key: lotKey(o) });
  }
  for (const u of UNITS) if (u.kind === 'house') buildLot(u, null);
  drawAptBoard(new Map());
  return {
    group,
    // 주인이 바뀐 집만 다시 그림 → 바뀌었으면 true (길찾기 격자를 다시 만들어야 함)
    update(owners) {
      let changed = false;
      for (const u of UNITS) if (u.kind === 'house') { const o = owners.get(u.id), key = lotKey(o); if (lots.get(u.id)?.key !== key) { buildLot(u, o); changed = true; } }
      drawAptBoard(owners);
      return changed;
    },
    // 문 앞에 서 있으면 그 물건 (아파트는 현관 하나)
    doorNear(x, z, owners) {
      if (Math.hypot(x - APT.x, z - (APT.z + APT.d / 2 + 1.0)) < 1.6) return { apt: true };
      for (const u of UNITS) if (u.kind === 'house') { const o = owners.get(u.id), s = doorSpot(u, o?.size); if (o && o.name !== myName()) { if (Math.hypot(x - u.x, z - (u.z + u.face * 6.6)) < 1.6) return { unit: u, owner: o }; continue; } if (Math.hypot(x - s.x, z - s.z) < 1.4 || (!o && Math.hypot(x - (u.x - u.face * 4.2), z - (u.z + u.face * 4.6)) < 1.6)) return { unit: u, owner: o }; }
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
