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
export const HX = 15, HZ = 10;          // 바깥 유리벽 위치
export const CEIL = 3.65;               // 바닥에서 천장까지
export const ROOF = 4;                  // 옥상 층 번호
export const ELEV = { x: -13, z: -1.8 }; // 엘리베이터 앞
export const NOTICE = { floor: 2, x: -8, z: -1.6 };
export const SPAWN = { floor: 0, x: -3.5, z: -4.5, yaw: Math.PI / 2 };

export const ZONES = {
  f1: '1F 로비·카페', f2: '2F 업무 공간', f3: '3F 회의실 홀', meetA: '3F 회의실 A', meetB: '3F 회의실 B', f4: '4F 라운지', roof: '옥상 테라스',
};
export function zoneAt(f, x, z) {
  if (f === 2 && z < -3) return x < 2 ? 'meetA' : 'meetB';
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
export function createBuilding() {
  const shell = new THREE.Group();
  const sk = new Kit();
  const floors = FLOORS.map((f, i) => {
    const group = new THREE.Group();
    group.position.y = f.y;
    const colliders = [];
    return { ...f, index: i, group, colliders, kit: new Kit(), col: (x1, z1, x2, z2, tall = false) => colliders.push({ x1, z1, x2, z2, tall }) };
  });

  // 외피: 슬래브 · 유리 · 멀리언 · 코어
  sk.box(31, 0.3, 21, 0, -0.3, 0, M.slab);
  for (const y of [4, 8, 12, 16]) {
    sk.box(30.4, 0.35, 20.4, 0, y - 0.35, 0, M.slab);
    sk.box(30.5, 0.05, 0.05, 0, y - 0.2, 10.23, M.led); sk.box(30.5, 0.05, 0.05, 0, y - 0.2, -10.23, M.led);
    sk.box(0.05, 0.05, 20.5, 15.23, y - 0.2, 0, M.led); sk.box(0.05, 0.05, 20.5, -15.23, y - 0.2, 0, M.led);
  }
  for (const [w, d, x, z] of [[30, 0.03, 0, HZ], [30, 0.03, 0, -HZ], [0.03, 20, HX, 0], [0.03, 20, -HX, 0]]) sk.box(w, 16, d, x, 0, z, M.glass);
  for (let x = -HX; x <= HX + 0.01; x += 2.5) { sk.box(0.07, 16, 0.12, x, 0, HZ, M.frame); sk.box(0.07, 16, 0.12, x, 0, -HZ, M.frame); }
  for (let z = -HZ; z <= HZ + 0.01; z += 2.5) { sk.box(0.12, 16, 0.07, HX, 0, z, M.frame); sk.box(0.12, 16, 0.07, -HX, 0, z, M.frame); }
  // 코어 (엘리베이터) — 옥상 위로 펜트하우스
  sk.box(4, 19.2, 7, -13, 0, -6.5, M.core);
  sk.box(4.3, 0.2, 7.3, -13, 19.2, -6.5, M.slab);
  // 1층 입구
  sk.box(2.6, 2.7, 0.14, 0, 0, HZ + 0.02, M.frame);
  sk.box(2.3, 2.5, 0.05, 0, 0, HZ + 0.04, M.glassRoom);
  sk.box(3.6, 0.12, 1.4, 0, 2.8, HZ + 0.7, M.slab);
  sk.box(3.2, 0.03, 0.03, 0, 2.78, HZ + 1.38, M.lightWarm);
  sk.box(4, 0.3, 2, 0, -0.3, HZ + 1, M.stoneLight);
  // 옥상 유리 난간
  for (const [w, d, x, z] of [[30, 0.03, 0, HZ - 0.1], [30, 0.03, 0, -HZ + 0.1], [0.03, 20, HX - 0.1, 0], [0.03, 20, -HX + 0.1, 0]]) {
    sk.box(w, 1.1, d, x, 16, z, M.glassRoom);
    sk.box(w + (d > 1 ? 0.06 : 0), 0.05, d + (w > 1 ? 0.06 : 0), x, 17.1, z, M.metal);
  }
  sk.flush(shell);

  // 회사 간판 (펜트하우스 북쪽 · 동쪽, 옥상 남쪽 가장자리)
  const logoBig = signTex(CONFIG.companyName, '', { w: 1024, h: 256, bg: '#07080b', fg: '#f3dfae', size: 150 });
  panel(shell, logoBig, 3.8, 0.95, -13, 18.1, -10.03, Math.PI);
  panel(shell, logoBig, 3.8, 0.95, -10.98, 18.1, -6.5, Math.PI / 2);
  const sideSign = panel(shell, logoBig, 4.8, 1.2, 0, 17.8, HZ - 0.3, 0);
  const sideSignBack = panel(shell, logoBig, 4.8, 1.2, 0, 17.8, HZ - 0.32, Math.PI);
  void sideSign; void sideSignBack;
  {
    const k = new Kit();
    k.box(5, 0.08, 0.08, 0, 17.15, HZ - 0.31, M.frame);
    k.cyl(0.04, 1.2, -2.3, 16, HZ - 0.31, M.metal, 6); k.cyl(0.04, 1.2, 2.3, 16, HZ - 0.31, M.metal, 6);
    k.flush(shell);
  }

  // ---------- 층마다 공통: 바닥 · 천장 조명 · 엘리베이터 문 ----------
  const doors = [];
  floors.forEach((F) => {
    const { kit: k, col, group } = F;
    const top = F.index === ROOF;
    // 코어 걷기 막힘
    col(-HX, -HZ, -11, -3, true);
    // 엘리베이터 문틀 + 표지
    k.box(1.7, 2.55, 0.1, -13, 0, -2.97, M.frame);
    k.box(0.4, 0.06, 0.04, -12.1, 1.2, -2.9, M.metal);
    const tex = signTex(`${F.label}  ${F.name}`, '', { w: 512, h: 96, size: 44 });
    panel(group, tex, 2.2, 0.41, -13, 2.95, -2.94, 0);
    const doorMat = M.gold;
    const L = new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.4, 0.05), doorMat);
    const R = new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.4, 0.05), doorMat);
    L.position.set(-13.36, 1.2, -2.9); R.position.set(-12.64, 1.2, -2.9);
    group.add(L, R);
    doors.push({ floor: F.index, L, R, open: 0 });
    if (!top) {
      // 천장 아래 조명 줄
      for (const x of [-8, -3, 2, 7, 12]) k.box(0.12, 0.03, 15, x, CEIL - 0.04, 1.5, M.light);
    }
  });

  // ---------- 1F 로비 · 카페 ----------
  {
    const F = floors[0], { kit: k, col, group } = F;
    k.box(29.8, 0.02, 19.8, 0, 0, 0, M.stone);
    k.box(15, 0.03, 19.8, 7.4, 0, 0, M.oak); // 카페 쪽 원목 바닥
    // 로고 벽 (코어 동쪽 면)
    const logo = canvasTex(1024, 384, (ctx, w, h) => {
      ctx.fillStyle = '#0b0c10'; ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#c9a35f'); g.addColorStop(0.5, '#f3dfae'); g.addColorStop(1, '#c9a35f');
      ctx.fillStyle = g; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 130px ${FONT}`; ctx.fillText(CONFIG.companyName, w / 2, h / 2 - 20);
      ctx.font = `400 38px ${FONT}`; ctx.fillStyle = '#9aa0ab'; ctx.fillText('WELCOME', w / 2, h / 2 + 90);
    });
    panel(group, logo, 5.4, 2.0, -10.97, 1.95, -6.6, Math.PI / 2);
    k.box(0.04, 0.04, 5.6, -10.96, 3.05, -6.6, M.lightWarm);
    // 안내 데스크
    k.box(0.9, 1.05, 4, -8.2, 0, -6.4, M.white); col(-8.65, -8.4, -7.75, -4.4);
    k.box(1.0, 0.04, 4.1, -8.2, 1.05, -6.4, M.walnut);
    k.box(0.03, 0.03, 3.8, -7.73, 0.9, -6.4, M.lightWarm);
    chair(k, -9.4, 0, -6.4, Math.PI / 2);
    // 로비 소파
    sofa(k, col, -7, 0, 4.2, 0, 2.6, M.fabricGray);
    sofa(k, col, -7, 0, 7.4, Math.PI, 2.6, M.fabricGray);
    k.box(1.4, 0.38, 0.8, -7, 0, 5.8, M.walnut); col(-7.7, 5.4, -6.3, 6.2);
    // 카페 카운터
    k.box(5.2, 0.95, 0.6, 12, 0, -9.3, M.walnut); col(9.4, -9.6, 14.6, -9.0);
    k.box(5.2, 0.04, 0.65, 12, 0.95, -9.3, M.white);
    k.box(0.6, 0.55, 0.45, 10.2, 0.97, -9.3, M.metal); k.box(0.6, 0.55, 0.45, 11.0, 0.97, -9.3, M.black);
    k.box(5, 1.05, 0.7, 11.7, 0, -6.6, M.walnut); col(9.2, -6.95, 14.2, -6.25);
    k.box(5.2, 0.05, 0.8, 11.7, 1.05, -6.6, M.white);
    k.box(4.8, 0.03, 0.03, 11.7, 0.95, -6.23, M.lightWarm);
    for (const x of [10, 11.7, 13.4]) { k.cyl(0.01, 1.1, x, 2.55, -6.6, M.black, 4); k.ball(0.16, x, 2.45, -6.6, M.bulb); }
    const menu = canvasTex(768, 384, (ctx, w, h) => {
      ctx.fillStyle = '#121310'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f0e2c0'; ctx.font = `700 54px ${FONT}`; ctx.fillText('CAFE', 40, 70);
      ctx.font = `400 34px ${FONT}`; ctx.fillStyle = '#d8d2c6';
      [['아메리카노', '3.0'], ['카페라테', '3.5'], ['바닐라라테', '4.0'], ['오늘의 차', '3.0']].forEach(([a, b], i) => {
        ctx.fillText(a, 40, 140 + i * 58); ctx.textAlign = 'right'; ctx.fillText(b, w - 40, 140 + i * 58); ctx.textAlign = 'left';
      });
    });
    panel(group, menu, 2.4, 1.2, 12, 2.6, -9.55, 0, false);
    // 카페 테이블
    for (const [x, z] of [[4.5, -2], [8.5, -2], [4.5, 2.5], [8.5, 2.5], [12.5, 0.5]]) {
      roundTable(k, col, x, 0, z);
      chair(k, x - 0.85, 0, z, Math.PI / 2, M.fabricWarm);
      chair(k, x + 0.85, 0, z, -Math.PI / 2, M.fabricWarm);
    }
    // 창가 바
    k.box(10, 0.05, 0.5, 8.5, 1.05, 9.3, M.walnut); col(3.5, 9.05, 13.5, 9.55);
    for (let x = 4.2; x <= 13; x += 1.25) stool(k, x, 0, 8.6);
    for (const [x, z, s] of [[-14, 9, 1.2], [14, 9, 1.2], [-2.6, 9, 1], [2.6, 9, 1], [-10.3, -2.2, 0.9], [14, -4.5, 1]]) plant(k, col, x, 0, z, s);
  }

  // ---------- 2F 업무 공간 ----------
  {
    const F = floors[1], { kit: k, col, group } = F;
    k.box(29.8, 0.02, 19.8, 0, 0, 0, M.stone);
    k.box(22, 0.03, 12, 3.5, 0, -3.5, M.carpet);
    for (const zc of [-6, 0.5]) {
      for (const xc of [-7.5, -3, 1.5, 6, 10.5]) {
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
    // 팀장 자리 + 책장
    k.box(1.8, 0.05, 0.85, -7, 0.74, 6.6, M.walnut); k.box(1.7, 0.72, 0.05, -7, 0.02, 6.98, M.walnut);
    col(-7.9, 6.2, -6.1, 7.0);
    k.box(0.6, 0.38, 0.03, -7, 0.94, 6.75, M.black);
    chair(k, -7, 0, 7.7, Math.PI);
    k.box(0.5, 2.1, 6, -14.4, 0, 4.6, M.walnut); col(-14.7, 1.6, -14.1, 7.6, true);
    for (let i = 0; i < 4; i++) {
      k.box(0.36, 0.38, 5.6, -14.25, 0.15 + i * 0.5, 4.6, i % 2 ? M.books : M.books2);
    }
    // 화이트보드
    k.box(2.8, 1.4, 0.05, 2, 0.9, 5.2, M.white); k.box(0.06, 0.9, 0.06, 0.7, 0, 5.2, M.metal); k.box(0.06, 0.9, 0.06, 3.3, 0, 5.2, M.metal);
    col(0.6, 5.1, 3.4, 5.3);
    const wb = canvasTex(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f4f4f2'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2a62c9'; ctx.lineWidth = 4; ctx.font = `600 30px ${FONT}`; ctx.fillStyle = '#2a62c9';
      ctx.fillText('이번 주 할 일', 24, 44);
      ctx.fillStyle = '#333'; ctx.font = `400 24px ${FONT}`;
      ['☐ 메타버스 사무실 오픈', '☐ 주간 회의 준비', '☑ 커피 머신 청소'].forEach((t, i) => ctx.fillText(t, 30, 96 + i * 44));
      ctx.strokeStyle = '#d23'; ctx.beginPath(); ctx.arc(420, 160, 50, 0, 6.28); ctx.stroke();
    });
    panel(group, wb, 2.7, 1.3, 2, 1.6, 5.23, 0, false);
    // 창가 작은 회의 테이블
    roundTable(k, col, 10, 0, 6.5, 0.7);
    for (let a = 0; a < 4; a++) { const t = (a / 4) * Math.PI * 2 + 0.4; chair(k, 10 + Math.sin(t) * 1.15, 0, 6.5 + Math.cos(t) * 1.15, t + Math.PI, M.fabricGreen); }
    // 프린터 · 정수기
    k.box(0.7, 0.9, 0.6, 13.8, 0, -9, M.white); k.box(0.6, 0.1, 0.5, 13.8, 0.9, -9, M.black); col(13.4, -9.4, 14.2, -8.6);
    k.box(0.4, 1.2, 0.4, 13.9, 0, -7.7, M.white); k.cyl(0.15, 0.4, 13.9, 1.2, -7.7, M.glassRoom); col(13.6, -7.95, 14.2, -7.45);
    for (const [x, z, s] of [[-10.3, -2.4, 0.9], [14, 9, 1.1], [-3, 9, 1], [5.5, 9, 1]]) plant(k, col, x, 0, z, s);
  }

  // ---------- 3F 회의실 + 공지판 ----------
  let noticeCanvas, noticeTex;
  {
    const F = floors[2], { kit: k, col, group } = F;
    k.box(29.8, 0.02, 19.8, 0, 0, 0, M.stone);
    k.box(25.8, 0.03, 6.8, 2, 0, -6.5, M.carpetWarm);
    // 남쪽 칸막이: 나무벽(공지판) | 문A | 유리 | 벽 | 유리 | 문B | 유리
    k.box(6.2, CEIL, 0.2, -7.9, 0, -3, M.walnut); col(-11, -3.1, -4.8, -2.9, true);
    for (const [a, b] of [[-3.2, 2], [2, 7.7], [9.3, 15]]) {
      k.box(b - a, CEIL, 0.03, (a + b) / 2, 0, -3, M.glassRoom); col(a, -3.1, b, -2.9, true);
      k.box(b - a, 0.05, 0.08, (a + b) / 2, 0, -3, M.frame); k.box(b - a, 0.05, 0.08, (a + b) / 2, CEIL - 0.05, -3, M.frame);
      k.box(b - a, 0.25, 0.035, (a + b) / 2, 1.1, -3, M.white);
    }
    for (const x of [-4, 8.5]) {
      k.box(0.08, CEIL, 0.12, x - 0.82, 0, -3, M.frame); k.box(0.08, CEIL, 0.12, x + 0.82, 0, -3, M.frame);
      k.box(1.72, CEIL - 2.4, 0.12, x, 2.4, -3, M.frame);
    }
    k.box(0.2, CEIL, 7, 2, 0, -6.5, M.walnut); col(1.9, -10, 2.1, -3, true);
    panel(group, signTex('회의실 A'), 1.3, 0.32, -4, 2.95, -2.93, 0);
    panel(group, signTex('회의실 B'), 1.3, 0.32, 8.5, 2.95, -2.93, 0);
    // 회의 테이블
    const meeting = (cx, len, n, mat) => {
      k.box(len, 0.06, 1.5, cx, 0.72, -6.6, M.walnut); col(cx - len / 2, -7.35, cx + len / 2, -5.85);
      k.box(0.3, 0.72, 0.3, cx - len / 2 + 0.6, 0, -6.6, M.black); k.box(0.3, 0.72, 0.3, cx + len / 2 - 0.6, 0, -6.6, M.black);
      for (let i = 0; i < n; i++) {
        const x = cx - len / 2 + 0.6 + (i * (len - 1.2)) / (n - 1);
        chair(k, x, 0, -5.45, Math.PI, mat); chair(k, x, 0, -7.75, 0, mat);
      }
    };
    meeting(-4.5, 5, 4, M.fabricWarm);
    meeting(8.5, 6, 4, M.fabricBlue);
    const tvTex = (label) => canvasTex(640, 360, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#16223f'); g.addColorStop(1, '#2d5a8a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff'; ctx.font = `700 50px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(label, w / 2, h / 2 - 6);
      ctx.font = `400 26px ${FONT}`; ctx.fillStyle = '#b8c8e8'; ctx.fillText('화면 공유 대기 중', w / 2, h / 2 + 44);
    });
    k.box(0.06, 1.5, 2.6, -10.95, 1.15, -6.6, M.black);
    panel(group, tvTex('회의실 A'), 2.5, 1.4, -10.91, 1.9, -6.6, Math.PI / 2);
    k.box(0.06, 1.5, 2.6, 2.13, 1.15, -6.6, M.black);
    panel(group, tvTex('회의실 B'), 2.5, 1.4, 2.17, 1.9, -6.6, Math.PI / 2);
    // 공지판 (나무벽 남쪽 면)
    noticeCanvas = document.createElement('canvas');
    noticeCanvas.width = 1024; noticeCanvas.height = 576;
    noticeTex = new THREE.CanvasTexture(noticeCanvas);
    noticeTex.colorSpace = THREE.SRGBColorSpace;
    k.box(4.5, 2.7, 0.06, -7.9, 0.6, -2.87, M.frame);
    panel(group, noticeTex, 4.3, 2.42, -7.9, 1.95, -2.83, 0);
    // 홀: 대기 소파 · 폰부스 · 화분
    sofa(k, col, 4, 0, 6.8, Math.PI, 2.8, M.fabricGreen);
    k.box(1.4, 0.38, 0.7, 4, 0, 5.4, M.walnut); col(3.3, 5.05, 4.7, 5.75);
    for (const x of [11.3, 13.4]) {
      k.box(1.5, 2.3, 1.5, x, 0, 7.6, M.glassRoom); k.box(1.5, 0.08, 1.5, x, 2.3, 7.6, M.frame);
      k.box(0.6, 0.45, 0.5, x, 0, 8.0, M.fabricWarm);
      col(x - 0.75, 6.85, x + 0.75, 8.35, true);
    }
    k.box(4, 0.45, 0.6, -6, 0, 9.2, M.oak); col(-8, 8.9, -4, 9.5);
    for (const [x, z, s] of [[-14, 9, 1.1], [0, 9, 1], [14.2, -1.5, 1], [-10.3, -2.2, 0.8]]) plant(k, col, x, 0, z, s);
  }

  // ---------- 4F 라운지 ----------
  {
    const F = floors[3], { kit: k, col, group } = F;
    k.box(29.8, 0.02, 19.8, 0, 0, 0, M.oak);
    k.box(10, 0.03, 7, 1, 0, 4, M.carpetWarm);
    sofa(k, col, 0.8, 0, 2.0, 0, 3.2, M.fabricBlue);
    sofa(k, col, 4, 0, 4, -Math.PI / 2, 2.6, M.fabricBlue);
    k.box(1.8, 0.36, 1, 0.8, 0, 3.8, M.walnut); col(-0.1, 3.3, 1.7, 4.3);
    for (const x of [-5.5, -3.8]) { k.ball(0.55, x, 0.32, 3.2, M.fabricWarm, 0.6); col(x - 0.45, 2.75, x + 0.45, 3.65); }
    // 창가 바
    k.box(22, 0.05, 0.5, 2.5, 1.05, 9.3, M.walnut); col(-8.5, 9.05, 13.5, 9.55);
    for (let x = -7.8; x <= 13; x += 1.3) stool(k, x, 0, 8.6);
    // 탕비실
    k.box(9, 0.92, 0.65, -4.5, 0, -9.3, M.white); col(-9, -9.65, 0, -8.95);
    k.box(9, 0.04, 0.7, -4.5, 0.92, -9.3, M.walnut);
    k.box(0.9, 2, 0.75, 0.6, 0, -9.25, M.metal); col(0.15, -9.65, 1.05, -8.85);
    k.box(0.5, 0.35, 0.4, -7.5, 0.94, -9.3, M.black);
    for (const x of [-8, -5.5, -3]) k.box(1.6, 0.7, 0.35, x, 1.9, -9.5, M.white);
    // 아일랜드 테이블
    k.box(4, 0.06, 1.2, -4.5, 0.98, -5.8, M.walnut); k.box(3.6, 0.95, 0.9, -4.5, 0, -5.8, M.white); col(-6.5, -6.4, -2.5, -5.2);
    for (const x of [-6, -4.5, -3]) { stool(k, x, 0, -4.7); }
    // 탁구대
    k.box(2.74, 0.05, 1.52, 8.5, 0.74, -5.5, M.green); k.box(0.02, 0.15, 1.6, 8.5, 0.79, -5.5, M.white);
    k.box(2.5, 0.72, 1.3, 8.5, 0.02, -5.5, M.black); col(7.13, -6.26, 9.87, -4.74);
    // 대형 TV (코어 동쪽 면)
    k.box(0.06, 1.7, 3, -10.95, 1, -6.5, M.black);
    const tv = canvasTex(640, 360, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0e1a33'); g.addColorStop(1, '#3a2a55');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffd99a'; ctx.font = `700 54px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('LOUNGE', w / 2, h / 2);
      ctx.font = `400 26px ${FONT}`; ctx.fillStyle = '#c8c0dd'; ctx.fillText('오늘도 수고했어요 :)', w / 2, h / 2 + 50);
    });
    panel(group, tv, 2.9, 1.6, -10.91, 1.85, -6.5, Math.PI / 2);
    for (const [x, z, s] of [[-14, 9, 1.2], [14, 9, 1.2], [14, -9, 1.1], [-10.3, -2.2, 0.9], [-9.4, 4, 1]]) plant(k, col, x, 0, z, s);
  }

  // ---------- 옥상 테라스 ----------
  const roofLights = [];
  {
    const F = floors[4], { kit: k, col } = F;
    k.box(29.8, 0.05, 19.8, 0, 0, 0, M.deck);
    for (let x = -14.5; x <= 14.5; x += 0.5) k.box(0.02, 0.01, 19.8, x, 0.05, 0, M.walnut);
    // 바깥 소파 세트
    sofa(k, col, 0, 0, 2.2, 0, 3.2, M.fabricGray);
    sofa(k, col, -3.4, 0, 4.2, Math.PI / 2, 2.4, M.fabricGray);
    sofa(k, col, 3.4, 0, 4.2, -Math.PI / 2, 2.4, M.fabricGray);
    k.box(1.8, 0.36, 1, 0, 0, 4, M.walnut); col(-0.9, 3.5, 0.9, 4.5);
    // 불멍 화로
    k.cyl(0.5, 0.35, 0, 0.36, 4, M.black, 16); k.ball(0.28, 0, 0.78, 4, M.bulb, 0.6);
    // 파라솔 테이블
    for (const [x, z] of [[7, -5], [10.5, -1.5], [3, -6.5]]) {
      roundTable(k, col, x, 0, z, 0.5);
      k.cyl(0.03, 2.4, x, 0.74, z, M.metal, 6);
      k.cyl(1.4, 0.35, x, 2.9, z, M.white, 16, 0.02);
      chair(k, x - 0.85, 0, z, Math.PI / 2, M.white); chair(k, x + 0.85, 0, z, -Math.PI / 2, M.white);
    }
    // 화단 + 나무
    for (const [x, z] of [[-8, 8.6], [8, 8.6], [13.6, 8.6], [13.6, -8.6], [-6, -8.6]]) {
      k.box(1.6, 0.6, 1.2, x, 0, z, M.stoneLight); col(x - 0.8, z - 0.6, x + 0.8, z + 0.6);
      k.cyl(0.08, 1.2, x, 0.6, z, M.walnut, 6);
      k.ball(0.85, x, 2.1, z, M.leaf, 1.1); k.ball(0.55, x + 0.4, 2.6, z - 0.2, M.leaf);
    }
    // 북쪽 벤치
    k.box(8, 0.45, 0.6, 3, 0, -9.2, M.oak); col(-1, -9.5, 7, -8.9);
    // 망원경
    k.cyl(0.05, 1.1, -10, 0, 8.9, M.metal, 6); k.box(0.2, 0.2, 0.6, -10, 1.15, 8.9, M.black); col(-10.25, 8.65, -9.75, 9.15);
    // 줄 전구 기둥
    const poles = [[-10, -2], [14.5, -2], [14.5, 9.5], [-10, 9.5]];
    for (const [x, z] of poles) k.cyl(0.05, 2.9, x, 0, z, M.black, 6);
    for (let i = 0; i < poles.length; i++) {
      const [x0, z0] = poles[i], [x1, z1] = poles[(i + 1) % poles.length];
      const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.9);
      for (let j = 0; j <= n; j++) {
        const t = j / n;
        roofLights.push([x0 + (x1 - x0) * t, 2.85 - Math.sin(t * Math.PI) * 0.55, z0 + (z1 - z0) * t]);
      }
    }
    // 대각선 줄 하나 더
    for (let j = 0; j <= 28; j++) { const t = j / 28; roofLights.push([-10 + 24.5 * t, 2.85 - Math.sin(t * Math.PI) * 0.7, -2 + 11.5 * t]); }
    for (const [x, y, z] of roofLights) k.ball(0.045, x, y, z, M.bulb);
  }

  floors.forEach((F) => { F.kit.flush(F.group); delete F.kit; });

  const group = new THREE.Group();
  group.add(shell, ...floors.map((f) => f.group));

  // 층마다 옮겨 다니는 조명 3개 (조명 개수가 바뀌지 않아 셰이더를 다시 만들지 않음)
  const hemi = new THREE.HemisphereLight(0x9aa6d0, 0x3a2c20, 1.1);
  const amb = new THREE.AmbientLight(0xffffff, 0.08);
  const rig = [new THREE.PointLight(0xffd8b0, 10, 20, 2), new THREE.PointLight(0xe8eeff, 10, 20, 2), new THREE.PointLight(0xffc890, 10, 20, 2)];
  group.add(hemi, amb, ...rig);
  const LIGHTS = [
    [[-6, 0], [5, -3], [10, 4]],
    [[-5, -3], [5, -3], [3, 6]],
    [[-4.5, -6.5], [8.5, -6.5], [2, 4]],
    [[-4, -5], [2, 4], [9, -4]],
    [[0, 4], [8, -3], [-6, 3]],
  ];

  return {
    group,
    floors,
    notice: { canvas: noticeCanvas, texture: noticeTex },
    // 걷는 층만 보이기 (all=true면 모든 층)
    setFloor(f, all = false) {
      floors.forEach((F) => { F.group.visible = all || F.index === f; });
      LIGHTS[f].forEach(([x, z], i) => { rig[i].position.set(x, FLOORS[f].y + (f === ROOF ? 3.2 : 3.3), z); rig[i].intensity = f === ROOF ? 10 : 24; });
    },
    update(dt, player) {
      for (const d of doors) {
        const near = player && player.floor === d.floor && Math.hypot(player.x - ELEV.x, player.z - ELEV.z) < 2.4;
        d.open += ((near ? 1 : 0) - d.open) * Math.min(1, dt * 5);
        d.L.position.x = -13.36 - d.open * 0.62;
        d.R.position.x = -12.64 + d.open * 0.62;
      }
    },
  };
}
