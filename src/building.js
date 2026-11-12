// 강가의 5층 유리 사옥: 1F 로비·카페 / 2F 업무 공간 / 3F 회의실 / 4F 라운지 / 옥상 테라스
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';

export const FLOORS = [
  { label: '1F', name: '로비·카페', y: 0 },
  { label: '2F', name: '업무 공간', y: 4 },
  { label: '3F', name: '회의실', y: 8 },
  { label: '4F', name: '라운지', y: 12 },
  { label: 'RF', name: '옥상 테라스', y: 16 },
];
export const HX = 10, HZ = 6.5;         // 바깥 유리벽 위치 (한 층 20m × 13m)
export const LOT = 31;                  // 1층에서 걸어 나갈 수 있는 정원 범위
export const CEIL = 3.65;               // 바닥에서 천장까지
export const ROOF = 4;                  // 옥상 층 번호
export const ELEV = { x: -8.75, z: -0.9 }; // 엘리베이터 앞
export const NOTICE = { floor: 2, x: -5.85, z: -0.8 };
export const SPAWN = { floor: 0, x: -2.5, z: -3.2, yaw: Math.PI / 2 };

export const ZONES = {
  garden: '1F 정원', f1: '1F 로비·카페', f2: '2F 업무 공간', f3: '3F 회의실 홀', meetA: '3F 회의실 A', meetB: '3F 회의실 B', f4: '4F 라운지', roof: '옥상 테라스',
};
export function zoneAt(f, x, z) {
  if (f === 0 && (Math.abs(x) > HX || Math.abs(z) > HZ)) return 'garden';
  if (f === 2 && z < -2) return x < 1.5 ? 'meetA' : 'meetB';
  return ['f1', 'f2', 'f3', 'f4', 'roof'][f];
}

// ---------- 재질 ----------
const C = (r, g, b) => new THREE.Color(r, g, b);
const M = {
  stone: new THREE.MeshStandardMaterial({ color: 0x55575d, roughness: 0.3, metalness: 0.05 }),
  stoneLight: new THREE.MeshStandardMaterial({ color: 0xbdb7ad, roughness: 0.35 }),
  carpet: new THREE.MeshStandardMaterial({ color: 0x3a404c, roughness: 0.95 }),
  carpetWarm: new THREE.MeshStandardMaterial({ color: 0x4a3f38, roughness: 0.95 }),
  oak: new THREE.MeshStandardMaterial({ color: 0x9a7350, roughness: 0.55 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x6b4c34, roughness: 0.8 }),
  walnut: new THREE.MeshStandardMaterial({ color: 0x3a2a1f, roughness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe8e5df, roughness: 0.45 }),
  black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x9da2aa, roughness: 0.35, metalness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xb8975a, roughness: 0.3, metalness: 0.75 }),
  fabricBlue: new THREE.MeshStandardMaterial({ color: 0x2f4f6b, roughness: 0.9 }),
  fabricWarm: new THREE.MeshStandardMaterial({ color: 0x9a5f3d, roughness: 0.9 }),
  fabricGray: new THREE.MeshStandardMaterial({ color: 0x5a5d64, roughness: 0.9 }),
  fabricGreen: new THREE.MeshStandardMaterial({ color: 0x3f5f4a, roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.8, flatShading: true }),
  pot: new THREE.MeshStandardMaterial({ color: 0xd6d0c4, roughness: 0.6 }),
  core: new THREE.MeshStandardMaterial({ color: 0x5a524a, roughness: 0.7 }),
  slab: new THREE.MeshStandardMaterial({ color: 0x1c1e23, roughness: 0.7 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.4, metalness: 0.5 }),
  books: new THREE.MeshStandardMaterial({ vertexColors: false, color: 0x8a4a3a, roughness: 0.8 }),
  books2: new THREE.MeshStandardMaterial({ color: 0x3a5a7a, roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9ec3e6, roughness: 0.05, transparent: true, opacity: 0.1, depthWrite: false }),
  glassRoom: new THREE.MeshStandardMaterial({ color: 0xc8dcf0, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false }),
  light: new THREE.MeshBasicMaterial({ color: C(0.85, 0.8, 0.7) }),
  lightWarm: new THREE.MeshBasicMaterial({ color: C(1.35, 0.92, 0.5) }),
  led: new THREE.MeshBasicMaterial({ color: C(1.5, 1.7, 2.2) }),
  bulb: new THREE.MeshBasicMaterial({ color: C(1.25, 0.85, 0.42) }),
  screen: new THREE.MeshBasicMaterial({ color: C(0.32, 0.5, 0.85) }),
  green: new THREE.MeshStandardMaterial({ color: 0x1f5a3a, roughness: 0.7 }),
};

// ---------- 조각 모아 그리기 (재질별로 합쳐 그리기 횟수 줄임) ----------
const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const BALL = new THREE.IcosahedronGeometry(1, 1);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
class Kit {
  constructor() { this.parts = new Map(); }
  add(geo, mat, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_up, ry), _s.set(sx, sy, sz));
    g.applyMatrix4(_m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
  }
  // y는 바닥 높이
  box(w, h, d, x, y, z, mat, ry = 0) { this.add(BOX, mat, x, y + h / 2, z, ry, w, h, d); }
  cyl(r, h, x, y, z, mat, seg = 14, rTop = r) { this.add(new THREE.CylinderGeometry(rTop, r, h, seg), mat, x, y + h / 2, z); }
  ball(r, x, y, z, mat, sy = 1) { this.add(BALL, mat, x, y, z, 0, r, r * sy, r); }
  flush(parent) {
    for (const [mat, list] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(list), mat);
      if (mat.transparent) mesh.renderOrder = 2;
      parent.add(mesh);
    }
    this.parts.clear();
  }
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const FONT = '"Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
function signTex(text, sub = '', { w = 512, h = 128, bg = '#0b0c10', fg = '#f0e2c0', size = 60 } = {}) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = fg; ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillText(text, w / 2, sub ? h * 0.4 : h / 2);
    if (sub) { ctx.font = `400 ${size * 0.45}px ${FONT}`; ctx.fillStyle = '#9aa0ab'; ctx.fillText(sub, w / 2, h * 0.75); }
  });
}
// 벽에 붙이는 그림판: ry는 바라보는 방향 (0 = +z)
function panel(parent, tex, w, h, x, y, z, ry, basic = true) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  parent.add(mesh);
  return mesh;
}

// ---------- 가구 ----------
function chair(k, x, y, z, ry, mat = M.black) {
  const s = Math.sin(ry), c = Math.cos(ry);
  k.box(0.5, 0.08, 0.5, x, y + 0.44, z, mat, ry);
  k.box(0.5, 0.55, 0.07, x - s * 0.24, y + 0.52, z - c * 0.24, mat, ry);
  k.cyl(0.03, 0.42, x, y + 0.02, z, M.metal, 6);
  k.cyl(0.27, 0.04, x, y, z, M.metal, 10);
}
function stool(k, x, y, z) {
  k.cyl(0.2, 0.06, x, y + 0.72, z, M.walnut, 12);
  k.cyl(0.025, 0.72, x, y, z, M.metal, 6);
  k.cyl(0.18, 0.03, x, y, z, M.metal, 10);
}
function plant(k, col, x, y, z, s = 1) {
  k.cyl(0.32 * s, 0.6 * s, x, y, z, M.pot, 14, 0.38 * s);
  k.ball(0.55 * s, x, y + 1.15 * s, z, M.leaf, 1.35);
  k.ball(0.35 * s, x + 0.2 * s, y + 1.7 * s, z - 0.1 * s, M.leaf);
  col(x - 0.4 * s, z - 0.4 * s, x + 0.4 * s, z + 0.4 * s);
}
// 등받이가 -z 쪽인 소파를 ry만큼 돌려 놓기
function sofa(k, col, x, y, z, ry, len = 2.4, mat = M.fabricGray) {
  const s = Math.sin(ry), c = Math.cos(ry);
  k.box(len, 0.42, 0.9, x, y, z, mat, ry);
  k.box(len, 0.85, 0.22, x - s * 0.4, y, z - c * 0.4, mat, ry);
  k.box(0.2, 0.62, 0.9, x + c * (len / 2 - 0.1), y, z - s * (len / 2 - 0.1), mat, ry);
  k.box(0.2, 0.62, 0.9, x - c * (len / 2 - 0.1), y, z + s * (len / 2 - 0.1), mat, ry);
  const hw = Math.abs(c) * len / 2 + Math.abs(s) * 0.45, hd = Math.abs(s) * len / 2 + Math.abs(c) * 0.45;
  col(x - hw, z - hd, x + hw, z + hd);
}
function roundTable(k, col, x, y, z, r = 0.45, h = 0.74, top = M.white) {
  k.cyl(r, 0.04, x, y + h - 0.04, z, top, 18);
  k.cyl(0.04, h - 0.04, x, y, z, M.metal, 6);
  k.cyl(0.25, 0.03, x, y, z, M.metal, 10);
  col(x - r, z - r, x + r, z + r);
}

// ---------- 건물 ----------
// 코어(엘리베이터): x -10 ~ -7.5, z -6.5 ~ -2, 문은 남쪽 면(z = -2) 가운데 x = -8.75
const CX = -8.75, CZ = -4.25, CW = 2.5, CD = 4.5, CE = -7.5, CS = -2;

export function createBuilding() {
  const shell = new THREE.Group();
  const sk = new Kit();
  const floors = FLOORS.map((f, i) => {
    const group = new THREE.Group();
    group.position.y = f.y;
    const colliders = [];
    return { ...f, index: i, group, colliders, kit: new Kit(), col: (x1, z1, x2, z2, tall = false) => colliders.push({ x1, z1, x2, z2, tall }) };
  });
  const W = HX * 2, D = HZ * 2;

  // 외피: 슬래브 · 유리 · 멀리언 · 코어
  sk.box(W + 1, 0.3, D + 1, 0, -0.3, 0, M.slab);
  for (const y of [4, 8, 12, 16]) {
    sk.box(W + 0.4, 0.35, D + 0.4, 0, y - 0.35, 0, M.slab);
    sk.box(W + 0.5, 0.05, 0.05, 0, y - 0.2, HZ + 0.23, M.led); sk.box(W + 0.5, 0.05, 0.05, 0, y - 0.2, -HZ - 0.23, M.led);
    sk.box(0.05, 0.05, D + 0.5, HX + 0.23, y - 0.2, 0, M.led); sk.box(0.05, 0.05, D + 0.5, -HX - 0.23, y - 0.2, 0, M.led);
  }
  // 유리벽 (1층 남쪽은 입구 자리를 비움)
  sk.box(W, 12, 0.03, 0, 4, HZ, M.glass);
  sk.box(HX - 1.15, 4, 0.03, -(HX + 1.15) / 2, 0, HZ, M.glass);
  sk.box(HX - 1.15, 4, 0.03, (HX + 1.15) / 2, 0, HZ, M.glass);
  sk.box(2.3, 1.3, 0.03, 0, 2.7, HZ, M.glass);
  for (const [w, d, x, z] of [[W, 0.03, 0, -HZ], [0.03, D, HX, 0], [0.03, D, -HX, 0]]) sk.box(w, 16, d, x, 0, z, M.glass);
  const nx = 8, nz = 5;
  for (let i = 0; i <= nx; i++) {
    const x = -HX + (W * i) / nx;
    if (Math.abs(x) > 1.3) sk.box(0.07, 16, 0.12, x, 0, HZ, M.frame); else sk.box(0.07, 12, 0.12, x, 4, HZ, M.frame);
    sk.box(0.07, 16, 0.12, x, 0, -HZ, M.frame);
  }
  for (let i = 0; i <= nz; i++) { const z = -HZ + (D * i) / nz; sk.box(0.12, 16, 0.07, HX, 0, z, M.frame); sk.box(0.12, 16, 0.07, -HX, 0, z, M.frame); }
  // 코어 (엘리베이터) — 옥상 위로 펜트하우스
  sk.box(CW, 19.2, CD, CX, 0, CZ, M.core);
  sk.box(CW + 0.3, 0.2, CD + 0.3, CX, 19.2, CZ, M.slab);
  // 1층 입구: 문틀 · 차양 · 계단
  sk.box(0.12, 2.7, 0.14, -1.15, 0, HZ, M.frame); sk.box(0.12, 2.7, 0.14, 1.15, 0, HZ, M.frame);
  sk.box(2.42, 0.12, 0.14, 0, 2.6, HZ, M.frame);
  sk.box(3.4, 0.12, 1.6, 0, 2.85, HZ + 0.8, M.slab);
  sk.box(3.0, 0.03, 0.03, 0, 2.83, HZ + 1.58, M.lightWarm);
  // 옥상 유리 난간
  for (const [w, d, x, z] of [[W, 0.03, 0, HZ - 0.1], [W, 0.03, 0, -HZ + 0.1], [0.03, D, HX - 0.1, 0], [0.03, D, -HX + 0.1, 0]]) {
    sk.box(w, 1.1, d, x, 16, z, M.glassRoom);
    sk.box(w + (d > 1 ? 0.06 : 0), 0.05, d + (w > 1 ? 0.06 : 0), x, 17.1, z, M.metal);
  }
  sk.flush(shell);

  // 회사 간판 (펜트하우스 북쪽 · 동쪽, 옥상 남쪽 가장자리)
  const logoBig = signTex(CONFIG.companyName, '', { w: 1024, h: 256, bg: '#07080b', fg: '#f3dfae', size: 150 });
  panel(shell, logoBig, 2.3, 0.58, CX, 18.4, -HZ - 0.03, Math.PI);
  panel(shell, logoBig, 3.2, 0.8, CE + 0.02, 18.2, CZ, Math.PI / 2);
  panel(shell, logoBig, 3.6, 0.9, 3, 17.75, HZ - 0.3, 0);
  panel(shell, logoBig, 3.6, 0.9, 3, 17.75, HZ - 0.32, Math.PI);
  {
    const k = new Kit();
    k.box(3.8, 0.08, 0.08, 3, 17.25, HZ - 0.31, M.frame);
    k.cyl(0.04, 1.3, 1.3, 16, HZ - 0.31, M.metal, 6); k.cyl(0.04, 1.3, 4.7, 16, HZ - 0.31, M.metal, 6);
    k.flush(shell);
  }

  // ---------- 층마다 공통: 코어 · 엘리베이터 문 · 천장 조명 ----------
  const doors = [];
  floors.forEach((F) => {
    const { kit: k, col, group } = F;
    const top = F.index === ROOF;
    col(-HX, -HZ, CE, CS, true);
    k.box(1.7, 2.55, 0.1, CX, 0, CS + 0.03, M.frame);
    k.box(0.3, 0.06, 0.04, CX + 1.0, 1.2, CS + 0.1, M.metal);
    panel(group, signTex(`${F.label}  ${F.name}`, '', { w: 512, h: 96, size: 44 }), 2.2, 0.41, CX, 2.95, CS + 0.06, 0);
    const L = new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.4, 0.05), M.gold);
    const R = new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.4, 0.05), M.gold);
    L.position.set(CX - 0.36, 1.2, CS + 0.1); R.position.set(CX + 0.36, 1.2, CS + 0.1);
    group.add(L, R);
    doors.push({ floor: F.index, L, R, open: 0 });
    if (!top) for (const x of [-5, -1, 3, 7]) k.box(0.12, 0.03, D - 2.5, x, CEIL - 0.04, 0.6, M.light);
  });

  // ---------- 1F 로비 · 카페 ----------
  {
    const F = floors[0], { kit: k, col, group } = F;
    k.box(W - 0.2, 0.02, D - 0.2, 0, 0, 0, M.stone);
    k.box(10, 0.03, D - 0.2, 5, 0, 0, M.oak);
    k.box(2.4, 0.02, 1.6, 0, 0.03, HZ - 1, M.carpetWarm); // 입구 매트
    // 1층 유리벽은 걷기를 막음 (입구만 열림)
    col(-HX, HZ - 0.1, -1.1, HZ + 0.1, true); col(1.1, HZ - 0.1, HX, HZ + 0.1, true);
    col(-HX, -HZ - 0.1, HX, -HZ + 0.1, true);
    col(-HX - 0.1, -HZ, -HX + 0.1, HZ, true); col(HX - 0.1, -HZ, HX + 0.1, HZ, true);
    // 로고 벽 (코어 동쪽 면)
    const logo = canvasTex(1024, 384, (ctx, w, h) => {
      ctx.fillStyle = '#0b0c10'; ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#c9a35f'); g.addColorStop(0.5, '#f3dfae'); g.addColorStop(1, '#c9a35f');
      ctx.fillStyle = g; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 130px ${FONT}`; ctx.fillText(CONFIG.companyName, w / 2, h / 2 - 20);
      ctx.font = `400 38px ${FONT}`; ctx.fillStyle = '#9aa0ab'; ctx.fillText('WELCOME', w / 2, h / 2 + 90);
    });
    panel(group, logo, 3.6, 1.35, CE + 0.03, 1.95, CZ, Math.PI / 2);
    k.box(0.04, 0.04, 3.8, CE + 0.04, 2.75, CZ, M.lightWarm);
    // 안내 데스크
    k.box(0.8, 1.05, 2.6, -5.4, 0, -4.3, M.white); col(-5.8, -5.6, -5.0, -3.0);
    k.box(0.9, 0.04, 2.7, -5.4, 1.05, -4.3, M.walnut);
    k.box(0.03, 0.03, 2.4, -4.98, 0.9, -4.3, M.lightWarm);
    chair(k, -6.4, 0, -4.3, Math.PI / 2);
    // 로비 소파 (창을 바라봄)
    sofa(k, col, -6.3, 0, 2.6, 0, 2.4, M.fabricGray);
    k.box(1.2, 0.38, 0.7, -6.3, 0, 4.1, M.walnut); col(-6.9, 3.75, -5.7, 4.45);
    // 카페 카운터
    k.box(3.6, 0.95, 0.6, 7.9, 0, -5.9, M.walnut); col(6.1, -6.3, 9.7, -5.6);
    k.box(3.6, 0.04, 0.65, 7.9, 0.95, -5.9, M.white);
    k.box(0.55, 0.5, 0.42, 6.8, 0.97, -5.9, M.metal); k.box(0.55, 0.5, 0.42, 7.5, 0.97, -5.9, M.black);
    k.box(3.4, 1.05, 0.6, 7.6, 0, -3.9, M.walnut); col(5.9, -4.2, 9.3, -3.6);
    k.box(3.6, 0.05, 0.75, 7.6, 1.05, -3.9, M.white);
    k.box(3.2, 0.03, 0.03, 7.6, 0.95, -3.58, M.lightWarm);
    for (const x of [6.6, 7.6, 8.6]) { k.cyl(0.01, 1.1, x, 2.55, -3.9, M.black, 4); k.ball(0.15, x, 2.45, -3.9, M.bulb); }
    const menu = canvasTex(768, 384, (ctx, w, h) => {
      ctx.fillStyle = '#121310'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f0e2c0'; ctx.font = `700 54px ${FONT}`; ctx.fillText('CAFE', 40, 70);
      ctx.font = `400 34px ${FONT}`; ctx.fillStyle = '#d8d2c6';
      [['아메리카노', '3.0'], ['카페라테', '3.5'], ['바닐라라테', '4.0'], ['오늘의 차', '3.0']].forEach(([a, b], i) => {
        ctx.fillText(a, 40, 140 + i * 58); ctx.textAlign = 'right'; ctx.fillText(b, w - 40, 140 + i * 58); ctx.textAlign = 'left';
      });
    });
    panel(group, menu, 2.0, 1.0, 7.9, 2.5, -6.4, 0, false);
    // 카페 테이블
    for (const [x, z] of [[2.6, -1.2], [5.6, -1.2], [2.6, 2.0], [5.6, 2.0], [8.6, 0.4]]) {
      roundTable(k, col, x, 0, z);
      chair(k, x - 0.8, 0, z, Math.PI / 2, M.fabricWarm);
      chair(k, x + 0.8, 0, z, -Math.PI / 2, M.fabricWarm);
    }
    // 창가 바 (입구 오른쪽)
    k.box(7.4, 0.05, 0.45, 5.9, 1.05, HZ - 0.55, M.walnut); col(2.2, HZ - 0.8, 9.6, HZ - 0.3);
    for (let x = 2.8; x <= 9.2; x += 1.1) stool(k, x, 0, HZ - 1.2);
    for (const [x, z, s] of [[-9.3, 5.8, 1], [-9.3, 1.2, 0.9], [-2, 5.7, 0.8], [2, -5.8, 0.8]]) plant(k, col, x, 0, z, s);
  }

  // ---------- 2F 업무 공간 (16자리) ----------
  {
    const F = floors[1], { kit: k, col, group } = F;
    k.box(W - 0.2, 0.02, D - 0.2, 0, 0, 0, M.stone);
    k.box(13, 0.03, 9.6, 1.2, 0, -1.4, M.carpet);
    for (const zc of [-3.8, 1.2]) {
      for (const xc of [-2.5, 2.5]) {
        k.box(3.2, 0.04, 1.6, xc, 0.72, zc, M.white);
        k.box(3.2, 0.36, 0.03, xc, 0.76, zc, M.fabricBlue);
        k.box(0.05, 0.72, 1.5, xc - 1.55, 0, zc, M.metal); k.box(0.05, 0.72, 1.5, xc + 1.55, 0, zc, M.metal);
        col(xc - 1.6, zc - 0.8, xc + 1.6, zc + 0.8);
        for (const dx of [-0.8, 0.8]) for (const s of [-1, 1]) {
          const x = xc + dx;
          k.box(0.6, 0.36, 0.03, x, 0.92, zc + s * 0.45, M.black);
          k.box(0.56, 0.32, 0.005, x, 0.94, zc + s * 0.47, M.screen);
          k.box(0.42, 0.02, 0.14, x, 0.76, zc + s * 0.6, M.black);
          chair(k, x, 0, zc + s * 1.15, s > 0 ? Math.PI : 0);
        }
      }
    }
    // 팀장 자리
    k.box(0.85, 0.05, 1.8, 8.4, 0.74, -3.8, M.walnut); k.box(0.05, 0.72, 1.7, 8.8, 0.02, -3.8, M.walnut);
    col(7.95, -4.7, 8.85, -2.9);
    k.box(0.03, 0.38, 0.6, 8.6, 0.94, -3.8, M.black);
    chair(k, 7.5, 0, -3.8, Math.PI / 2);
    // 책장 (서쪽 창가)
    k.box(0.5, 2.1, 4.4, -9.5, 0, 3.2, M.walnut); col(-9.8, 1.0, -9.2, 5.4, true);
    for (let i = 0; i < 4; i++) k.box(0.36, 0.38, 4.0, -9.35, 0.15 + i * 0.5, 3.2, i % 2 ? M.books : M.books2);
    // 화이트보드 (책상 쪽을 바라봄)
    k.box(2.6, 1.3, 0.05, -1, 0.9, 4.6, M.white); k.box(0.06, 0.9, 0.06, -2.2, 0, 4.6, M.metal); k.box(0.06, 0.9, 0.06, 0.2, 0, 4.6, M.metal);
    col(-2.3, 4.5, 0.3, 4.7);
    const wb = canvasTex(512, 256, (ctx) => {
      ctx.fillStyle = '#f4f4f2'; ctx.fillRect(0, 0, 512, 256);
      ctx.font = `600 30px ${FONT}`; ctx.fillStyle = '#2a62c9'; ctx.fillText('이번 주 할 일', 24, 44);
      ctx.fillStyle = '#333'; ctx.font = `400 24px ${FONT}`;
      ['☐ 메타버스 사옥 오픈', '☐ 주간 회의 준비', '☑ 커피 머신 청소'].forEach((t, i) => ctx.fillText(t, 30, 96 + i * 44));
      ctx.strokeStyle = '#d23'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(420, 160, 50, 0, 6.28); ctx.stroke();
    });
    panel(group, wb, 2.5, 1.2, -1, 1.55, 4.57, Math.PI, false);
    // 창가 작은 회의 테이블
    roundTable(k, col, 6.5, 0, 3.6, 0.65);
    for (let a = 0; a < 4; a++) { const t = (a / 4) * Math.PI * 2 + 0.4; chair(k, 6.5 + Math.sin(t) * 1.1, 0, 3.6 + Math.cos(t) * 1.1, t + Math.PI, M.fabricGreen); }
    // 프린터 · 정수기
    k.box(0.7, 0.9, 0.6, 9.4, 0, 0.6, M.white); k.box(0.6, 0.1, 0.5, 9.4, 0.9, 0.6, M.black); col(9.0, 0.25, 9.8, 0.95);
    k.box(0.4, 1.2, 0.4, 9.5, 0, -0.5, M.white); k.cyl(0.15, 0.4, 9.5, 1.2, -0.5, M.glassRoom); col(9.25, -0.75, 9.75, -0.25);
    for (const [x, z, s] of [[-6.5, 5.8, 0.9], [9.3, 5.8, 1], [-6.6, -1.2, 0.8]]) plant(k, col, x, 0, z, s);
  }

  // ---------- 3F 회의실 2개 + 공지판 ----------
  let noticeCanvas, noticeTex;
  {
    const F = floors[2], { kit: k, col, group } = F;
    k.box(W - 0.2, 0.02, D - 0.2, 0, 0, 0, M.stone);
    k.box(17.4, 0.03, 4.4, 1.25, 0, -4.25, M.carpetWarm);
    // 남쪽 칸막이 (z = -2): 나무벽(공지판) | 문A | 유리 | 벽 | 유리 | 문B | 유리
    k.box(3.3, CEIL, 0.2, -5.85, 0, -2, M.walnut); col(-7.5, -2.1, -4.2, -1.9, true);
    for (const [a, b] of [[-2.8, 1.5], [1.5, 4.8], [6.2, 10]]) {
      k.box(b - a, CEIL, 0.03, (a + b) / 2, 0, -2, M.glassRoom); col(a, -2.1, b, -1.9, true);
      k.box(b - a, 0.05, 0.08, (a + b) / 2, 0, -2, M.frame); k.box(b - a, 0.05, 0.08, (a + b) / 2, CEIL - 0.05, -2, M.frame);
      k.box(b - a, 0.25, 0.035, (a + b) / 2, 1.1, -2, M.white);
    }
    for (const x of [-3.5, 5.5]) {
      k.box(0.08, CEIL, 0.12, x - 0.72, 0, -2, M.frame); k.box(0.08, CEIL, 0.12, x + 0.72, 0, -2, M.frame);
      k.box(1.52, CEIL - 2.4, 0.12, x, 2.4, -2, M.frame);
    }
    k.box(0.2, CEIL, 4.5, 1.5, 0, -4.25, M.walnut); col(1.4, -HZ, 1.6, -2, true);
    panel(group, signTex('회의실 A'), 1.2, 0.3, -3.5, 2.95, -1.93, 0);
    panel(group, signTex('회의실 B'), 1.2, 0.3, 5.5, 2.95, -1.93, 0);
    const meeting = (cx, len, n, mat) => {
      k.box(len, 0.06, 1.4, cx, 0.72, -4.3, M.walnut); col(cx - len / 2, -5.0, cx + len / 2, -3.6);
      k.box(0.3, 0.72, 0.3, cx - len / 2 + 0.5, 0, -4.3, M.black); k.box(0.3, 0.72, 0.3, cx + len / 2 - 0.5, 0, -4.3, M.black);
      for (let i = 0; i < n; i++) {
        const x = cx - len / 2 + 0.55 + (i * (len - 1.1)) / (n - 1);
        chair(k, x, 0, -3.15, Math.PI, mat); chair(k, x, 0, -5.45, 0, mat);
      }
    };
    meeting(-2.9, 3.8, 3, M.fabricWarm);
    meeting(5.9, 4.4, 3, M.fabricBlue);
    const tvTex = (label) => canvasTex(640, 360, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#16223f'); g.addColorStop(1, '#2d5a8a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff'; ctx.font = `700 50px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(label, w / 2, h / 2 - 6);
      ctx.font = `400 26px ${FONT}`; ctx.fillStyle = '#b8c8e8'; ctx.fillText('화면 공유 대기 중', w / 2, h / 2 + 44);
    });
    k.box(0.06, 1.3, 2.2, CE + 0.03, 1.2, -4.3, M.black);
    panel(group, tvTex('회의실 A'), 2.1, 1.18, CE + 0.07, 1.85, -4.3, Math.PI / 2);
    k.box(0.06, 1.3, 2.2, 1.63, 1.2, -4.3, M.black);
    panel(group, tvTex('회의실 B'), 2.1, 1.18, 1.67, 1.85, -4.3, Math.PI / 2);
    // 공지판 (나무벽 남쪽 면)
    noticeCanvas = document.createElement('canvas');
    noticeCanvas.width = 1024; noticeCanvas.height = 576;
    noticeTex = new THREE.CanvasTexture(noticeCanvas);
    noticeTex.colorSpace = THREE.SRGBColorSpace;
    k.box(3.1, 1.85, 0.06, -5.85, 0.95, -1.87, M.frame);
    panel(group, noticeTex, 2.95, 1.66, -5.85, 1.88, -1.83, 0);
    // 홀: 대기 소파 · 폰부스 · 벤치
    sofa(k, col, 2.5, 0, 5.3, Math.PI, 2.6, M.fabricGreen);
    k.box(1.3, 0.38, 0.65, 2.5, 0, 4.0, M.walnut); col(1.85, 3.65, 3.15, 4.35);
    for (const x of [7.3, 8.9]) {
      k.box(1.4, 2.3, 1.4, x, 0, 5.6, M.glassRoom); k.box(1.4, 0.08, 1.4, x, 2.3, 5.6, M.frame);
      k.box(0.55, 0.45, 0.45, x, 0, 5.95, M.fabricWarm);
      col(x - 0.7, 4.9, x + 0.7, 6.3, true);
    }
    k.box(3, 0.45, 0.5, -5, 0, 6.0, M.oak); col(-6.5, 5.75, -3.5, 6.25);
    for (const [x, z, s] of [[-9.3, 5.8, 1], [-0.5, 5.8, 0.8], [9.3, 1.5, 0.9]]) plant(k, col, x, 0, z, s);
  }

  // ---------- 4F 라운지 ----------
  {
    const F = floors[3], { kit: k, col, group } = F;
    k.box(W - 0.2, 0.02, D - 0.2, 0, 0, 0, M.oak);
    k.box(7, 0.03, 4.6, 0.6, 0, 2.6, M.carpetWarm);
    sofa(k, col, 0.2, 0, 1.4, 0, 3.0, M.fabricBlue);
    sofa(k, col, 3.4, 0, 2.9, -Math.PI / 2, 2.2, M.fabricBlue);
    k.box(1.6, 0.36, 0.9, 0.4, 0, 2.95, M.walnut); col(-0.4, 2.5, 1.2, 3.4);
    for (const [x, z] of [[-3.4, 2.2], [-4.6, 3.3]]) { k.ball(0.5, x, 0.3, z, M.fabricWarm, 0.6); col(x - 0.4, z - 0.4, x + 0.4, z + 0.4); }
    // 창가 바
    k.box(14, 0.05, 0.45, 2.3, 1.05, HZ - 0.55, M.walnut); col(-4.7, HZ - 0.8, 9.3, HZ - 0.3);
    for (let x = -4.1; x <= 9; x += 1.2) stool(k, x, 0, HZ - 1.2);
    // 탕비실 (북쪽)
    k.box(5.6, 0.92, 0.6, -3.9, 0, -6.1, M.white); col(-6.7, -6.45, -1.1, -5.8);
    k.box(5.6, 0.04, 0.65, -3.9, 0.92, -6.1, M.walnut);
    k.box(0.85, 2, 0.7, -0.5, 0, -6.05, M.metal); col(-0.95, -6.45, -0.05, -5.7);
    k.box(0.5, 0.35, 0.4, -5.8, 0.94, -6.1, M.black);
    for (const x of [-5.8, -3.9, -2]) k.box(1.5, 0.65, 0.33, x, 1.9, -6.3, M.white);
    // 아일랜드 테이블
    k.box(3, 0.06, 1.0, -3.9, 0.98, -3.8, M.walnut); k.box(2.7, 0.95, 0.75, -3.9, 0, -3.8, M.white); col(-5.4, -4.3, -2.4, -3.3);
    for (const x of [-5, -3.9, -2.8]) stool(k, x, 0, -2.85);
    // 탁구대
    k.box(2.74, 0.05, 1.52, 5.6, 0.74, -3.8, M.green); k.box(0.02, 0.15, 1.6, 5.6, 0.79, -3.8, M.white);
    k.box(2.5, 0.72, 1.3, 5.6, 0.02, -3.8, M.black); col(4.23, -4.56, 6.97, -3.04);
    // 대형 TV (코어 동쪽 면)
    k.box(0.06, 1.4, 2.4, CE + 0.03, 1.1, CZ, M.black);
    const tv = canvasTex(640, 360, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0e1a33'); g.addColorStop(1, '#3a2a55');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffd99a'; ctx.font = `700 54px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('LOUNGE', w / 2, h / 2);
      ctx.font = `400 26px ${FONT}`; ctx.fillStyle = '#c8c0dd'; ctx.fillText('오늘도 수고했어요 :)', w / 2, h / 2 + 50);
    });
    panel(group, tv, 2.3, 1.3, CE + 0.07, 1.8, CZ, Math.PI / 2);
    for (const [x, z, s] of [[-9.3, 5.8, 1.1], [9.3, -5.8, 1], [9.4, 1, 0.9], [-6.6, -1.2, 0.8]]) plant(k, col, x, 0, z, s);
  }

  // ---------- 옥상 테라스 ----------
  const roofLights = [];
  {
    const F = floors[4], { kit: k, col } = F;
    k.box(W - 0.2, 0.05, D - 0.2, 0, 0, 0, M.deck);
    for (let x = -9.75; x <= 9.75; x += 0.5) k.box(0.02, 0.01, D - 0.2, x, 0.05, 0, M.walnut);
    sofa(k, col, 0, 0, 1.4, 0, 3.0, M.fabricGray);
    sofa(k, col, -2.6, 0, 2.9, Math.PI / 2, 2.0, M.fabricGray);
    sofa(k, col, 2.6, 0, 2.9, -Math.PI / 2, 2.0, M.fabricGray);
    k.cyl(0.55, 0.35, 0, 0, 3.0, M.black, 16); k.ball(0.3, 0, 0.42, 3.0, M.bulb, 0.6); col(-0.6, 2.4, 0.6, 3.6);
    for (const [x, z] of [[5.5, -3.6], [7.9, -0.6]]) {
      roundTable(k, col, x, 0, z, 0.5);
      k.cyl(0.03, 2.4, x, 0.74, z, M.metal, 6);
      k.cyl(1.3, 0.35, x, 2.9, z, M.white, 16, 0.02);
      chair(k, x - 0.8, 0, z, Math.PI / 2, M.white); chair(k, x + 0.8, 0, z, -Math.PI / 2, M.white);
    }
    for (const [x, z] of [[-6, 5.6], [7.5, 5.6], [-3.5, -5.6], [9, -5.6]]) {
      k.box(1.5, 0.6, 1.0, x, 0, z, M.stoneLight); col(x - 0.75, z - 0.5, x + 0.75, z + 0.5);
      k.cyl(0.08, 1.1, x, 0.6, z, M.walnut, 6);
      k.ball(0.8, x, 1.95, z, M.leaf, 1.1); k.ball(0.5, x + 0.35, 2.45, z - 0.2, M.leaf);
    }
    k.box(5, 0.45, 0.55, 3.2, 0, -6.0, M.oak); col(0.7, -6.3, 5.7, -5.7);
    k.cyl(0.05, 1.1, -8.5, 0, 5.8, M.metal, 6); k.box(0.2, 0.2, 0.6, -8.5, 1.15, 5.8, M.black); col(-8.75, 5.55, -8.25, 6.05);
    const poles = [[-6.5, -1.2], [9.5, -1.2], [9.5, 6.2], [-6.5, 6.2]];
    for (const [x, z] of poles) k.cyl(0.05, 2.9, x, 0, z, M.black, 6);
    const string = (x0, z0, x1, z1, sag) => {
      const n = Math.max(6, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.8));
      for (let j = 0; j <= n; j++) { const t = j / n; roofLights.push([x0 + (x1 - x0) * t, 2.85 - Math.sin(t * Math.PI) * sag, z0 + (z1 - z0) * t]); }
    };
    for (let i = 0; i < 4; i++) { const [a, b] = poles[i], [c, d] = poles[(i + 1) % 4]; string(a, b, c, d, 0.5); }
    string(-6.5, -1.2, 9.5, 6.2, 0.7);
    for (const [x, y, z] of roofLights) k.ball(0.045, x, y, z, M.bulb);
  }

  floors.forEach((F) => { F.kit.flush(F.group); delete F.kit; });

  const group = new THREE.Group();
  group.add(shell, ...floors.map((f) => f.group));

  // 층마다 옮겨 다니는 조명 3개 (조명 개수가 바뀌지 않아 셰이더를 다시 만들지 않음)
  const hemi = new THREE.HemisphereLight(0x9aa6d0, 0x3a2c20, 1.1);
  const amb = new THREE.AmbientLight(0xffffff, 0.08);
  const rig = [new THREE.PointLight(0xffd8b0, 10, 16, 2), new THREE.PointLight(0xe8eeff, 10, 16, 2), new THREE.PointLight(0xffc890, 10, 16, 2)];
  group.add(hemi, amb, ...rig);
  const LED = M.led.color.clone(), BULB = M.bulb.color.clone();
  const LIGHTS = [
    [[-4.5, -2], [5, -1], [3, 4]],
    [[-2.5, -1.3], [3.5, -1.3], [4, 4]],
    [[-2.9, -4.3], [5.9, -4.3], [1, 3.5]],
    [[-3.5, -3.5], [1, 3], [5.6, -3.5]],
    [[0, 3], [6, -2], [-5, 2]],
  ];

  return {
    group,
    floors,
    notice: { canvas: noticeCanvas, texture: noticeTex },
    // 걷는 층만 보이기 (all=true면 모든 층)
    setFloor(f, all = false) {
      floors.forEach((F) => { F.group.visible = all || F.index === f; });
      LIGHTS[f].forEach(([x, z], i) => { rig[i].position.set(x, FLOORS[f].y + (f === ROOF ? 3.2 : 3.3), z); rig[i].intensity = f === ROOF ? 10 : 20; });
    },
    setDay(d) {
      hemi.intensity = 1.1 + 0.9 * d;
      hemi.color.setRGB(0.6 + 0.3 * d, 0.65 + 0.3 * d, 0.82 + 0.15 * d);
      M.led.color.copy(LED).multiplyScalar(1 - 0.85 * d);
      M.bulb.color.copy(BULB).multiplyScalar(1 - 0.75 * d);
    },
    update(dt, player) {
      for (const d of doors) {
        const near = player && player.floor === d.floor && Math.hypot(player.x - ELEV.x, player.z - ELEV.z) < 2.2;
        d.open += ((near ? 1 : 0) - d.open) * Math.min(1, dt * 5);
        d.L.position.x = CX - 0.36 - d.open * 0.62;
        d.R.position.x = CX + 0.36 + d.open * 0.62;
      }
    },
  };
}

export { Kit, M as MATERIALS, chair, plant, canvasTex };
