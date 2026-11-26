// 🛋 WORK HOME 가구점 (부티크 북쪽) · 가구 모양 · 가구점 창
// 가구를 사면 우리 집 현관 '배달 상자'로 → 집 안 🛋 꾸미기에서 꺼내 놓기 · 돌리기 · 치우기 (main.js '집 꾸미기')
// 가구는 집마다 한 덩어리로 합쳐 그림(drawFurn을 Kit 하나에) → 휴대폰 가볍게
import * as THREE from 'three';
import { Kit, MATERIALS as M, canvasTex, panel, BALL } from './building.js';
import { Avatar } from './avatar.js';

export const FURN_SHOP = { x0: 17.5, x1: 25.5, z0: -21, z1: -12, door: [-17.6, -15.4], counter: { x: 23.1, z: -16.5 }, clerk: { x: 24.75, z: -16.5 } };
export const inFurnShop = (f, x, z) => f === 0 && x > FURN_SHOP.x0 && x < FURN_SHOP.x1 && z > FURN_SHOP.z0 && z < FURN_SHOP.z1;

// 가구 목록: w · d = 바닥 크기(m, 앞 = +z), h = 위에 설 수 있는 높이(부딪힘), seats = 앉는 자리 [x, z, 높이, 보는 방향(0 = 앞)]
export const FURN = [
  { id: 'rug', name: '포근한 러그', icon: '🟫', cat: 'living', price: 30000, w: 2.4, d: 1.7, h: 0, flat: true },
  { id: 'plant', name: '큰 화분', icon: '🪴', cat: 'deco', price: 40000, w: 0.6, d: 0.6, h: 1.4 },
  { id: 'nightstand', name: '협탁 & 램프', icon: '🛏️', cat: 'bed', price: 40000, w: 0.5, d: 0.45, h: 0.55 },
  { id: 'lamp', name: '플로어 스탠드', icon: '💡', cat: 'living', price: 50000, w: 0.45, d: 0.45, h: 1.6 },
  { id: 'coffee', name: '원목 커피 테이블', icon: '☕', cat: 'living', price: 60000, w: 1.1, d: 0.6, h: 0.42 },
  { id: 'armchair', name: '1인 라운지 체어', icon: '🪑', cat: 'living', price: 80000, w: 0.9, d: 0.85, h: 0.47, seats: [[0, 0.05, 0.47, 0]] },
  { id: 'shelf', name: '책장', icon: '📚', cat: 'study', price: 90000, w: 1.2, d: 0.36, h: 1.8 },
  { id: 'desk', name: '책상 세트', icon: '🖥️', cat: 'study', price: 120000, w: 1.3, d: 1.1, h: 0.75, seats: [[0, 0.32, 0.47, 2]] },
  { id: 'sofa', name: '패브릭 3인 소파', icon: '🛋️', cat: 'living', price: 150000, w: 2.1, d: 0.9, h: 0.47, seats: [[-0.55, 0.05, 0.47, 0], [0.55, 0.05, 0.47, 0]] },
  { id: 'wardrobe', name: '원목 옷장', icon: '🚪', cat: 'bed', price: 180000, w: 1.4, d: 0.6, h: 2.0 },
  { id: 'bed', name: '퀸 침대', icon: '🛌', cat: 'bed', price: 220000, w: 1.7, d: 2.1, h: 0.55, seats: [[-0.4, 0.75, 0.52, 0], [0.4, 0.75, 0.52, 0]] },
  { id: 'dining', name: '4인 식탁 세트', icon: '🍽️', cat: 'kitchen', price: 220000, w: 1.6, d: 1.9, h: 0.75, seats: [[-0.35, 0.72, 0.47, 2], [0.35, 0.72, 0.47, 2], [-0.35, -0.72, 0.47, 0], [0.35, -0.72, 0.47, 0]] },
  { id: 'tv', name: 'TV & 거실장', icon: '📺', cat: 'living', price: 250000, w: 1.8, d: 0.45, h: 1.3 },
  { id: 'aquarium', name: '열대어 어항', icon: '🐠', cat: 'deco', price: 280000, w: 1.2, d: 0.45, h: 1.35 },
  { id: 'fireplace', name: '벽난로', icon: '🔥', cat: 'deco', price: 300000, w: 1.4, d: 0.45, h: 1.1 },
  { id: 'piano', name: '업라이트 피아노', icon: '🎹', cat: 'deco', price: 450000, w: 1.5, d: 1.0, h: 1.25, seats: [[0, 0.32, 0.47, 2]] },
];
export const furnById = (id) => FURN.find((f) => f.id === id);
export const FURN_CATS = { all: '전체', living: '🛋 거실', bed: '🛏 침실', kitchen: '🍽 주방', study: '📚 서재', deco: '✨ 소품' };
export const MAX_FURN = 40; // 한 집에 놓을 수 있는 가구 수

const FM = {
  sage: new THREE.MeshStandardMaterial({ color: 0x9aa892, roughness: 0.95 }),
  sageL: new THREE.MeshStandardMaterial({ color: 0xaeb9a6, roughness: 0.95 }),
  oat: new THREE.MeshStandardMaterial({ color: 0xd9cfbd, roughness: 0.95 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xf1ebde, roughness: 0.9 }),
  woodL: new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.6 }),
  woodD: new THREE.MeshStandardMaterial({ color: 0x7a5a3e, roughness: 0.6 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.35, metalness: 0.2 }),
  gloss: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.12, metalness: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.7 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb9bdc3, roughness: 0.3, metalness: 0.8 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x7d97b5, roughness: 0.9 }),
  terra: new THREE.MeshStandardMaterial({ color: 0xc98b6b, roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.9, flatShading: true }),
  pot: new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.8 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 0.9 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.2, emissive: 0x0a1630 }),
  glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.35, 0.95) }),
  fire: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.0, 0.3) }),
  water: new THREE.MeshStandardMaterial({ color: 0x5fb3d9, roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false }),
  fish: new THREE.MeshStandardMaterial({ color: 0xff8a3a, roughness: 0.5, emissive: 0x3a1500 }),
  box: new THREE.MeshStandardMaterial({ color: 0xc89a60, roughness: 0.85 }),
  tape: new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.6 }),
};
const BOOKS = [0x8a3b2e, 0x2f4a6b, 0xc9a24a, 0x4b5d3a, 0xe8dcc4, 0x5a4636].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));

// 가구 하나를 kit에 그림. r = 돌린 횟수(0~3, 90도씩). y = 바닥 높이
export function drawFurn(k, id, x, y, z, r = 0) {
  const th = (r % 4) * Math.PI / 2, c = Math.round(Math.cos(th)), s = Math.round(Math.sin(th));
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const bx = (w, h, d, lx, ly, lz, m) => { const [wx, wz] = at(lx, lz); k.box(w, h, d, wx, y + ly, wz, m, th); };
  const cy = (rt, rb, h, lx, ly, lz, m, seg = 16) => { const [wx, wz] = at(lx, lz); k.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, wx, y + ly + h / 2, wz); };
  const bl = (rad, lx, ly, lz, m, sy = 1) => { const [wx, wz] = at(lx, lz); k.add(BALL, m, wx, y + ly, wz, 0, rad, rad * sy, rad); };
  const legs = (w, d, h, m, t = 0.05) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(t, h, t, sx * (w / 2 - t), 0, sz * (d / 2 - t), m); };
  switch (id) {
    case 'rug': bx(2.4, 0.015, 1.7, 0, 0.005, 0, FM.oat); bx(2.2, 0.017, 1.5, 0, 0.006, 0, FM.cream); for (const sz of [-1, 1]) bx(2.0, 0.019, 0.06, 0, 0.007, sz * 0.55, FM.terra); break;
    case 'plant': cy(0.24, 0.18, 0.45, 0, 0, 0, FM.pot); bl(0.32, 0, 0.75, 0, FM.leaf, 1.2); bl(0.24, 0.12, 1.05, 0.05, FM.leaf); bl(0.2, -0.12, 1.2, -0.05, FM.leaf); break;
    case 'nightstand': bx(0.5, 0.5, 0.45, 0, 0, 0, FM.woodL); bx(0.42, 0.02, 0.02, 0, 0.32, 0.23, FM.woodD); cy(0.06, 0.08, 0.12, 0.1, 0.5, 0, FM.cream); cy(0.12, 0.15, 0.14, 0.1, 0.62, 0, FM.glow); break;
    case 'lamp': cy(0.16, 0.18, 0.03, 0, 0, 0, FM.black); cy(0.015, 0.015, 1.35, 0, 0.03, 0, FM.black); cy(0.14, 0.2, 0.26, 0, 1.35, 0, FM.cream); cy(0.12, 0.17, 0.02, 0, 1.36, 0, FM.glow); break;
    case 'coffee': bx(1.1, 0.05, 0.6, 0, 0.36, 0, FM.woodL); bx(0.96, 0.03, 0.48, 0, 0.12, 0, FM.woodL); legs(1.06, 0.56, 0.36, FM.woodD); bx(0.25, 0.04, 0.18, 0.2, 0.41, 0, FM.blue); break;
    case 'armchair': bx(0.86, 0.22, 0.8, 0, 0.1, 0, FM.oat); bx(0.62, 0.14, 0.58, 0, 0.32, 0.06, FM.cream); bx(0.86, 0.42, 0.2, 0, 0.32, -0.3, FM.oat); for (const sx of [-1, 1]) bx(0.14, 0.3, 0.8, sx * 0.36, 0.2, 0, FM.oat); legs(0.8, 0.74, 0.1, FM.woodD, 0.04); break;
    case 'shelf': for (const sx of [-1, 1]) bx(0.04, 1.8, 0.36, sx * 0.58, 0, 0, FM.woodL); bx(1.2, 1.8, 0.03, 0, 0, -0.165, FM.woodL);
      for (let i = 0; i < 5; i++) bx(1.16, 0.03, 0.34, 0, i * 0.44, 0, FM.woodL);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 9; j++) { const bh = 0.24 + ((i * 7 + j * 3) % 5) * 0.025; bx(0.08, bh, 0.24, -0.5 + j * 0.105 + (j > 5 ? 0.08 : 0), i * 0.44 + 0.03, 0.02, BOOKS[(i + j) % BOOKS.length]); }
      break;
    case 'desk': bx(1.3, 0.04, 0.6, 0, 0.72, -0.25, FM.woodL); legs(1.26, 0.56, 0.72, FM.black, 0.04); bx(0.55, 0.32, 0.03, 0, 0.9, -0.45, FM.black); bx(0.5, 0.27, 0.01, 0, 0.92, -0.43, FM.screen); bx(0.06, 0.16, 0.06, 0, 0.76, -0.47, FM.black); bx(0.36, 0.02, 0.12, 0, 0.76, -0.12, FM.white);
      bx(0.46, 0.06, 0.44, 0, 0.42, 0.3, FM.black); bx(0.44, 0.5, 0.06, 0, 0.48, 0.52, FM.black); cy(0.03, 0.03, 0.4, 0, 0.02, 0.3, FM.metal, 8); cy(0.22, 0.22, 0.03, 0, 0, 0.3, FM.metal, 10); break;
    case 'sofa': bx(2.1, 0.26, 0.86, 0, 0.08, 0, FM.sage); for (const sx of [-1, 1]) bx(0.96, 0.14, 0.62, sx * 0.5, 0.33, 0.07, FM.sageL); bx(2.1, 0.46, 0.22, 0, 0.33, -0.32, FM.sage);
      for (const sx of [-1, 1]) { bx(0.2, 0.34, 0.86, sx * 0.95, 0.2, 0, FM.sage); bx(0.36, 0.3, 0.12, sx * 0.62, 0.48, -0.17, sx > 0 ? FM.terra : FM.cream); } legs(2.0, 0.78, 0.08, FM.woodD, 0.04); break;
    case 'wardrobe': bx(1.4, 2.0, 0.6, 0, 0, 0, FM.woodL); bx(0.01, 1.9, 0.02, 0, 0.05, 0.305, FM.woodD); for (const sx of [-1, 1]) bx(0.02, 0.3, 0.03, sx * 0.08, 0.95, 0.31, FM.metal); bx(1.44, 0.05, 0.64, 0, 2.0, 0, FM.woodD); break;
    case 'bed': bx(1.7, 0.3, 2.1, 0, 0.05, 0, FM.woodL); bx(1.6, 0.2, 2.0, 0, 0.3, 0.02, FM.white); bx(1.64, 0.06, 1.3, 0, 0.5, 0.38, FM.blue); bx(1.64, 0.03, 0.3, 0, 0.53, -0.25, FM.cream);
      for (const sx of [-1, 1]) bx(0.62, 0.14, 0.38, sx * 0.4, 0.5, -0.72, FM.cream); bx(1.76, 1.0, 0.1, 0, 0.05, -1.03, FM.oat); legs(1.66, 2.04, 0.06, FM.woodD, 0.05); break;
    case 'dining': bx(1.4, 0.05, 0.85, 0, 0.72, 0, FM.woodL); legs(1.32, 0.78, 0.72, FM.woodD, 0.05); cy(0.08, 0.06, 0.16, 0, 0.77, 0, FM.cream); bl(0.12, 0, 0.98, 0, FM.leaf);
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) { bx(0.42, 0.04, 0.42, sx * 0.35, 0.45, sz * 0.72, FM.oat); bx(0.42, 0.45, 0.04, sx * 0.35, 0.48, sz * 0.92, FM.woodD); legs(0.38, 0.38, 0.45, FM.woodD, 0.03); } break;
    case 'tv': bx(1.8, 0.45, 0.45, 0, 0.05, 0, FM.woodD); bx(1.76, 0.02, 0.02, 0, 0.27, 0.23, FM.woodL); legs(1.7, 0.4, 0.05, FM.black, 0.04); bx(1.4, 0.8, 0.05, 0, 0.55, -0.08, FM.gloss); bx(1.34, 0.74, 0.01, 0, 0.58, -0.05, FM.screen); bl(0.1, 0.72, 0.6, 0.05, FM.leaf); break;
    case 'aquarium': bx(1.2, 0.6, 0.45, 0, 0, 0, FM.woodD); bx(1.2, 0.7, 0.45, 0, 0.62, 0, FM.water); bx(1.16, 0.06, 0.41, 0, 0.62, 0, FM.oat); bx(1.24, 0.04, 0.49, 0, 1.32, 0, FM.black);
      for (let i = 0; i < 6; i++) bl(0.04, -0.4 + i * 0.16, 0.85 + (i % 3) * 0.12, (i % 2 ? 0.05 : -0.05), FM.fish, 0.6); bl(0.1, 0.4, 0.75, -0.1, FM.leaf, 1.6); break;
    case 'fireplace': bx(1.4, 1.0, 0.45, 0, 0, 0, FM.stone); bx(0.8, 0.55, 0.05, 0, 0.12, 0.21, FM.black); bx(1.56, 0.07, 0.55, 0, 1.0, 0.02, FM.woodD);
      for (let i = 0; i < 3; i++) cy(0, 0.07, 0.22 + (i % 2) * 0.08, -0.15 + i * 0.15, 0.14, 0.18, FM.fire, 6); bx(0.6, 0.05, 0.1, 0, 0.13, 0.18, FM.woodD); break;
    case 'piano': bx(1.5, 1.2, 0.55, 0, 0, -0.22, FM.gloss); bx(1.44, 0.04, 0.22, 0, 0.7, 0.12, FM.white); for (let i = 0; i < 12; i++) bx(0.04, 0.02, 0.12, -0.62 + i * 0.12, 0.735, 0.08, FM.black); bx(1.5, 0.08, 0.25, 0, 0.62, 0.12, FM.gloss);
      bx(0.8, 0.06, 0.34, 0, 0.42, 0.36, FM.gloss); legs(0.74, 0.28, 0.42, FM.gloss, 0.04); break;
  }
}
// 바닥 크기 (돌리면 가로 · 세로가 바뀜)
export const footprint = (id, r = 0) => { const f = furnById(id); return f ? (r % 2 ? [f.d, f.w] : [f.w, f.d]) : [0.5, 0.5]; };
// 배달 상자 (현관): 상자 몇 개 쌓기
export function drawBoxes(k, n, x, y, z) {
  for (let i = 0; i < Math.min(n, 4); i++) { const px = x + (i % 2) * 0.55 - 0.27, py = y + Math.floor(i / 2) * 0.42; k.box(0.5, 0.4, 0.45, px, py, z, FM.box); k.box(0.51, 0.06, 0.12, px, py + 0.34, z, FM.tape); }
}

// ---------- 가구점 건물 ----------
const SM = {
  wall: new THREE.MeshStandardMaterial({ color: 0xf1e8d8, roughness: 0.85 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xb88a5e, roughness: 0.6 }),
  woodD: new THREE.MeshStandardMaterial({ color: 0x6f4f35, roughness: 0.6 }),
  floor: new THREE.MeshStandardMaterial({ color: 0xc9a77f, roughness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xdcebf5, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.25, depthWrite: false }),
  green: new THREE.MeshStandardMaterial({ color: 0x3f5a46, roughness: 0.7 }),
  spot: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.55, 1.1) }),
};
export function createFurnShop(colliders) {
  const group = new THREE.Group(), roof = new THREE.Group();
  const { x0, x1, z0, z1 } = FURN_SHOP, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0, Hh = 3.6;
  const col = (a, b, c, d, tall = true, top = 0.9) => colliders.push({ x1: a, z1: b, x2: c, z2: d, tall, top });
  const k = new Kit(true), kr = new Kit(false);
  k.box(W, 0.04, D, cx, 0, cz, SM.floor);
  k.box(4.4, 0.04, 2.2, x0 - 2.2, -0.01, (FURN_SHOP.door[0] + FURN_SHOP.door[1]) / 2, M.stoneLight || SM.wall); // 문 앞 돌길
  k.box(2.2, 0.04, 6.0, 14.6, -0.01, -11.5, M.stoneLight || SM.wall);                                          // 부티크 앞에서 이어지는 길
  // 벽 (북 · 남 · 동) + 원목 띠
  const wall = (w, d, x, z) => { k.box(w, Hh, d, x, 0, z, SM.wall); k.box(w + 0.02, 0.3, d + 0.02, x, 0, z, SM.woodD); };
  wall(W, 0.22, cx, z0); wall(W, 0.22, cx, z1); wall(0.22, D, x1, cz);
  col(x0 - 0.15, z0 - 0.15, x1 + 0.15, z0 + 0.15); col(x0 - 0.15, z1 - 0.15, x1 + 0.15, z1 + 0.15); col(x1 - 0.15, z0, x1 + 0.15, z1);
  // 앞(서쪽): 문 양옆 큰 진열창 + 초록 문틀
  const [d0, d1] = FURN_SHOP.door;
  for (const [a, b] of [[z0, d0], [d1, z1]]) {
    k.add(new THREE.BoxGeometry(0.04, Hh - 0.7, b - a), SM.glass, x0, (Hh - 0.7) / 2 + 0.35, (a + b) / 2);
    k.box(0.16, 0.35, b - a, x0, 0, (a + b) / 2, SM.green); k.box(0.16, 0.35, b - a, x0, Hh - 0.35, (a + b) / 2, SM.green);
    for (const zz of [a + 0.05, b - 0.05]) k.box(0.16, Hh, 0.1, x0, 0, zz, SM.green);
    col(x0 - 0.15, a, x0 + 0.15, b);
  }
  k.box(0.22, 0.25, d1 - d0 + 0.3, x0, Hh - 0.25, (d0 + d1) / 2, SM.green);
  for (const zz of [d0 - 0.08, d1 + 0.08]) k.box(0.22, Hh, 0.16, x0, 0, zz, SM.green);
  const sign = canvasTex(1024, 200, (ctx, w, h) => {
    ctx.fillStyle = '#2f4436'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#e8d3a0'; ctx.lineWidth = 6; ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#f4e8cc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 86px "Pretendard","Noto Sans KR",sans-serif'; ctx.fillText('🛋 WORK HOME 가구점', w / 2, h / 2 + 4);
  });
  panel(group, sign, 5.4, 1.05, x0 - 0.14, Hh + 0.55, cz, -Math.PI / 2, true);
  k.box(0.2, 1.25, 5.8, x0, Hh, cz, SM.green);
  // 지붕 (안에 들어가면 숨김) + 원목 처마 + 조명
  kr.box(W + 0.4, 0.2, D + 0.4, cx, Hh, cz, SM.wall); kr.box(W + 0.5, 0.08, D + 0.5, cx, Hh + 0.2, cz, SM.wood); kr.box(W - 0.3, 0.02, D - 0.3, cx, Hh - 0.03, cz, M.white || SM.wall);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) kr.add(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16), SM.spot, 19.4 + i * 2.2, Hh - 0.05, -18.6 + j * 4.2);
  // 진열: 거실 세트(러그 · 소파 · 커피 테이블 · 스탠드) / 침실(침대 · 협탁) / 식탁 / 책장
  const show = [['rug', 20.6, -19.2, 0], ['sofa', 20.6, -19.9, 0], ['coffee', 20.6, -18.9, 0], ['lamp', 22.0, -20.3, 0], ['plant', 19.1, -20.3, 0],
    ['bed', 20.4, -13.3, 2], ['nightstand', 19.2, -12.7, 2], ['dining', 22.9, -13.9, 1], ['shelf', 25.1, -19.6, 3], ['fireplace', 23.6, -20.5, 0]];
  for (const [id, x, z, r] of show) {
    drawFurn(k, id, x, 0.02, z, r);
    const f = furnById(id), [fw, fd] = footprint(id, r);
    if (!f.flat) col(x - fw / 2, z - fd / 2, x + fw / 2, z + fd / 2, false, f.h);
  }
  // 계산대 (낮은 원목) + 직원
  const { x: ccx, z: ccz } = FURN_SHOP.counter;
  k.box(0.7, 0.58, 2.2, ccx + 0.6, 0, ccz, SM.wood); k.box(0.74, 0.05, 2.24, ccx + 0.6, 0.58, ccz, SM.woodD);
  col(ccx + 0.25, ccz - 1.12, ccx + 0.95, ccz + 1.12, false, 0.63);
  k.flush(group); kr.flush(roof); group.add(roof);
  const clerk = new Avatar('가구점 매니저', '#3f5a46', 'm', '00100');
  clerk.root.position.set(FURN_SHOP.clerk.x, 0, FURN_SHOP.clerk.z); clerk.root.rotation.y = -Math.PI / 2;
  group.add(clerk.root);
  colliders.push({ x1: FURN_SHOP.clerk.x - 0.3, z1: FURN_SHOP.clerk.z - 0.3, x2: FURN_SHOP.clerk.x + 0.3, z2: FURN_SHOP.clerk.z + 0.3, tall: false, top: 1.3 });
  return {
    group, clerk,
    inside: (x, z) => x > x0 && x < x1 && z > z0 && z < z1,
    update(dt, now, px, pz, onGround) { roof.visible = !(onGround && px > x0 - 0.3 && px < x1 + 0.3 && pz > z0 - 0.3 && pz < z1 + 0.3); clerk.animate(dt, 0, now); },
  };
}

// ---------- 가구점 창 ----------
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
export function createFurnUI(api) {
  const { $, money } = api;
  let cat = 'all', pending = [], pendT = 0;
  function render() {
    const owned = money.furnOwned(), home = api.myHome();
    $('furnCash').innerHTML = `지갑 현금 <b>${won(money.cash())}</b>${home ? ` · 🏠 배달지 <b>${home}</b>` : ''}`;
    $('furnNote').innerHTML = !home ? '🏠 집이 있어야 배달할 수 있어요. 3층 💹 투자 상담실 → 🏠 부동산에서 먼저 분양받아요.' : !api.atStore() ? '사는 건 가구점 안 계산대에서 할 수 있어요.' : '사면 우리 집 현관 <b>📦 배달 상자</b>로 가요. 집 안에서 🛋 꾸미기를 눌러 꺼내 놓아요.';
    $('furnCats').innerHTML = Object.entries(FURN_CATS).map(([k2, v]) => `<button type="button" data-c="${k2}" class="${k2 === cat ? 'on' : ''}">${v}</button>`).join('');
    $('furnCats').querySelectorAll('button').forEach((b) => (b.onclick = () => { cat = b.dataset.c; render(); }));
    const list = FURN.filter((f) => cat === 'all' || f.cat === cat);
    $('furnGrid').innerHTML = list.map((f) => `<li><i>${f.icon}</i><b>${f.name}</b><small>${f.w}×${f.d}m${owned[f.id] ? ` · ${owned[f.id]}개 있음` : ''}</small><button data-buy="${f.id}" ${!home || money.cash() < f.price || !api.atStore() ? 'class="poor"' : ''}>🚚 ${won(f.price)}</button></li>`).join('');
    $('furnGrid').querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => buy(b.dataset.buy)));
  }
  async function buy(id) {
    const f = furnById(id); if (!f) return;
    if (!api.myHome()) { alert('🏠 집이 있어야 배달할 수 있어요.\n3층 💹 투자 상담실 → 🏠 부동산에서 먼저 분양받아요.'); return; }
    if (!api.atStore()) { alert('가구점 안 계산대에서 살 수 있어요 (부티크 북쪽 🛋 WORK HOME).'); return; }
    if (money.cash() < f.price) { alert(`현금이 ${won(f.price - money.cash())} 모자라요.`); return; }
    if (!confirm(`${f.icon} ${f.name}을(를) ${won(f.price)}에 사서 우리 집으로 배달할까요?`)) return;
    const ok = await money.furnBuy(id);
    if (!ok) return;
    api.sys(`🚚 ${f.name}을(를) 우리 집으로 배달하고 있어요…`); api.beep(); render();
    // 여러 개를 연달아 사면 알림은 마지막에 한 번만 묶어서
    pending.push(f.name); clearTimeout(pendT);
    pendT = setTimeout(() => { const n = pending.length, first = pending[0]; pending = []; api.toast(`📦 배달 완료! ${n > 1 ? `${first} 외 ${n - 1}개` : first}이(가) 우리 집 현관 상자에 있어요. 집에서 🛋 꾸미기로 꺼내 놓아요.`); api.delivered(); }, 4000);
  }
  return { open() { render(); api.openModal('furnModal'); }, render };
}
