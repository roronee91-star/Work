// 강가의 5층 유리 사옥: 1F 로비·카페 / 2F 업무 공간 / 3F 회의실 / 4F 라운지 / 옥상 테라스
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONFIG } from './config.js';

export const FLOORS = [
  { label: '1F', name: '로비·카페', y: 0 },
  { label: '2F', name: '업무 공간', y: 4 },
  { label: '3F', name: '회의실', y: 8 },
  { label: '4F', name: '라운지·오락존', y: 12 },
  { label: 'RF', name: '옥상 테라스', y: 16 },
];
export const HX = 10, HZ = 6.5;         // 바깥 유리벽 위치 (한 층 20m × 13m)
export const LOT = 31;                  // 1층에서 걸어 나갈 수 있는 정원 범위
export const CEIL = 3.65;               // 바닥에서 천장까지
export const ROOF = 4;                  // 옥상 층 번호
export const ELEV = { x: -8.75, z: -0.9 }; // 엘리베이터 앞
export const NOTICE = { floor: 2, x: -5.85, z: -0.8 };
// 4층 오락존: 동쪽 창가 투명 부스 5칸, 칸마다 샌드백
export const BOOTHS = Array.from({ length: 5 }, (_, i) => {
  const z1 = -6.4 + i * 1.7, z2 = z1 + 1.7, zc = (z1 + z2) / 2;
  return { i, z1, z2, zc, bagX: 9.35, spot: { x: 8.72, z: zc } };
});
export const SPAWN = { floor: 0, x: 0, z: 9.4, yaw: 0 }; // 회사 정문 바로 앞(바깥)에서 문을 바라봄

export const ZONES = {
  garden: '1F 정원', f1: '1F 로비·카페', f2: '2F 업무 공간', f3: '3F 회의실 홀', meetA: '3F 회의실 A', meetB: '3F 회의실 B', f4: '4F 라운지', arcade: '4F 오락존', roof: '옥상 테라스',
};
export function zoneAt(f, x, z) {
  if (f === 0 && (Math.abs(x) > HX || Math.abs(z) > HZ)) return 'garden';
  if (f === 2 && z < -2) return x < 1.5 ? 'meetA' : 'meetB';
  if (f === 3 && x > 7.6 && z < 2.6) return 'arcade';
  return ['f1', 'f2', 'f3', 'f4', 'roof'][f];
}

// ---------- 재질 ----------
const C = (r, g, b) => new THREE.Color(r, g, b);
const M = {
  stone: new THREE.MeshStandardMaterial({ color: 0xebe6dc, roughness: 0.5 }),       // 아이보리 바닥
  stoneLight: new THREE.MeshStandardMaterial({ color: 0xbdb7ad, roughness: 0.35 }),
  carpet: new THREE.MeshStandardMaterial({ color: 0xa4a25c, roughness: 0.95 }),     // 올리브 카펫
  carpetWarm: new THREE.MeshStandardMaterial({ color: 0xb3ae6a, roughness: 0.95 }),
  oak: new THREE.MeshStandardMaterial({ color: 0xdcc4a2, roughness: 0.55 }),        // 밝은 원목
  deck: new THREE.MeshStandardMaterial({ color: 0x6b4c34, roughness: 0.8 }),
  walnut: new THREE.MeshStandardMaterial({ color: 0xd0b08a, roughness: 0.5 }),      // 조금 진한 원목
  white: new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.45 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.9, emissive: 0x7a756c }), // 아래를 보는 면이라 스스로 조금 밝게
  chairGray: new THREE.MeshStandardMaterial({ color: 0xf1ece3, roughness: 0.5 }),   // 하얀 셸 의자
  lime: new THREE.MeshStandardMaterial({ color: 0xd3df8f, roughness: 0.95 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.95 }),
  pastelYellow: new THREE.MeshStandardMaterial({ color: 0xf2e28c, roughness: 0.95 }),
  pastelBlue: new THREE.MeshStandardMaterial({ color: 0xcbd8e4, roughness: 0.95 }),
  pebble: new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.8, emissive: 0x5a564e }),
  rim: new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.3, metalness: 0.5 }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x86ad55, roughness: 0.8, flatShading: true }),
  orb: new THREE.MeshBasicMaterial({ color: C(1.25, 1.18, 1.02) }),
  chairFrame: new THREE.MeshStandardMaterial({ color: 0xeae4d8, roughness: 0.35, metalness: 0.1 }),   // 아이보리 프레임
  chairMesh: new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.85 }),                    // 하얀 메시
  caster: new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 0.5 }),
  slat: new THREE.MeshStandardMaterial({ color: 0xd2a874, roughness: 0.6 }),
  black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x9da2aa, roughness: 0.35, metalness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xb8975a, roughness: 0.3, metalness: 0.75 }),
  fabricBlue: new THREE.MeshStandardMaterial({ color: 0xcbd8e4, roughness: 0.9 }),
  fabricWarm: new THREE.MeshStandardMaterial({ color: 0xeee7da, roughness: 0.9 }),
  fabricGray: new THREE.MeshStandardMaterial({ color: 0xe7e1d5, roughness: 0.9 }),
  fabricGreen: new THREE.MeshStandardMaterial({ color: 0xd3df8f, roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.8, flatShading: true }),
  pot: new THREE.MeshStandardMaterial({ color: 0xd6d0c4, roughness: 0.6 }),
  core: new THREE.MeshStandardMaterial({ color: 0xf0eadf, roughness: 0.75 }),
  slab: new THREE.MeshStandardMaterial({ color: 0x1c1e23, roughness: 0.7 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.4, metalness: 0.5 }),
  books: new THREE.MeshStandardMaterial({ vertexColors: false, color: 0x8a4a3a, roughness: 0.8 }),
  books2: new THREE.MeshStandardMaterial({ color: 0x3a5a7a, roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9ec3e6, roughness: 0.05, transparent: true, opacity: 0.1, depthWrite: false }),
  glassRoom: new THREE.MeshStandardMaterial({ color: 0xc8dcf0, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false }),
  light: new THREE.MeshBasicMaterial({ color: C(1.15, 1.12, 1.05) }),
  lightWarm: new THREE.MeshBasicMaterial({ color: C(1.35, 0.92, 0.5) }),
  led: new THREE.MeshBasicMaterial({ color: C(1.5, 1.7, 2.2) }),
  bulb: new THREE.MeshBasicMaterial({ color: C(1.25, 0.85, 0.42) }),
  screen: new THREE.MeshBasicMaterial({ color: C(0.95, 0.95, 0.95) }),
  lamp: new THREE.MeshBasicMaterial({ color: C(1.6, 1.2, 0.7) }),
  paper: new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.9 }),
  mugRed: new THREE.MeshStandardMaterial({ color: 0xc8483c, roughness: 0.5 }),
  mugYellow: new THREE.MeshStandardMaterial({ color: 0xe0b04a, roughness: 0.5 }),
  coffee: new THREE.MeshStandardMaterial({ color: 0x4a2c1c, roughness: 0.6 }),
  pastry: new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.7 }),
  pastryPink: new THREE.MeshStandardMaterial({ color: 0xf2a7b8, roughness: 0.7 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xc9c6bf, roughness: 0.25, metalness: 0.6 }),
  green: new THREE.MeshStandardMaterial({ color: 0x1f5a3a, roughness: 0.7 }),
};

// ---------- 조각 모아 그리기 (재질별로 합쳐 그리기 횟수 줄임) ----------
const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const BALL = new THREE.IcosahedronGeometry(1, 1);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
// 모서리를 둥글린 상자 (같은 크기는 한 번만 만들어 재사용)
const RBOX = new Map();
function roundedBox(w, h, d) {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  let g = RBOX.get(key);
  if (!g) {
    const m = Math.min(w, h, d);
    g = new RoundedBoxGeometry(w, h, d, m > 0.3 ? 3 : 2, Math.min(0.07, m * 0.3)).toNonIndexed();
    RBOX.set(key, g);
  }
  return g;
}
const SHARP = new Set(); // 둥글리지 않을 재질 (유리 · 조명 줄 · 화면)
class Kit {
  constructor(round = true) { this.parts = new Map(); this.round = round; }
  add(geo, mat, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_up, ry), _s.set(sx, sy, sz));
    g.applyMatrix4(_m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
  }
  // y는 바닥 높이
  box(w, h, d, x, y, z, mat, ry = 0) {
    // 가구는 모서리를 둥글게, 얇은 판·유리·조명은 그대로
    if (this.round && Math.min(w, h, d) >= 0.05 && Math.max(w, h, d) < 12 && !SHARP.has(mat)) this.add(roundedBox(w, h, d), mat, x, y + h / 2, z, ry);
    else this.add(BOX, mat, x, y + h / 2, z, ry, w, h, d);
  }
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
// 지금 만드는 층의 앉을 자리 목록 (의자 · 스툴 · 소파가 스스로 등록)
let SEATS = null, DESK = false, TASK = false; // DESK: 컴퓨터 책상 의자 (일하기 가능), TASK: 사무용 메시 의자로 그림
// 사무용 메시 의자 (하얀·아이보리): 메시 등받이 · 메시 좌판 · L자 팔걸이 · 가스 실린더 · 바퀴 5개
function taskChair(k, x, y, z, ry) {
  const s = Math.sin(ry), c = Math.cos(ry);
  const at = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz]; // 의자 기준 좌표 → 바닥 좌표
  for (let i = 0; i < 5; i++) {
    const a = ry + (i / 5) * Math.PI * 2;
    const ex = x + Math.sin(a) * 0.28, ez = z + Math.cos(a) * 0.28;
    k.box(0.3, 0.035, 0.05, x + Math.sin(a) * 0.14, y + 0.06, z + Math.cos(a) * 0.14, M.chairFrame, a + Math.PI / 2);
    k.ball(0.032, ex, y + 0.035, ez, M.caster);
  }
  k.cyl(0.025, 0.3, x, y + 0.08, z, M.metal, 8);                                   // 가스 실린더
  k.box(0.2, 0.05, 0.22, x, y + 0.36, z, M.chairFrame, ry);                         // 좌판 받침
  { const [sx, sz] = at(0, 0.02); k.box(0.48, 0.06, 0.46, sx, y + 0.41, sz, M.chairMesh, ry); }   // 메시 좌판
  { const [fx, fz] = at(0, -0.24); k.box(0.07, 0.36, 0.04, fx, y + 0.42, fz, M.chairFrame, ry); }  // 등받이 기둥
  { const [bx, bz] = at(0, -0.26); k.box(0.36, 0.2, 0.035, bx, y + 0.58, bz, M.chairMesh, ry); }   // 허리 부분 (좁게)
  { const [bx, bz] = at(0, -0.28); k.box(0.46, 0.3, 0.035, bx, y + 0.76, bz, M.chairMesh, ry); }   // 등 위쪽 (넓게)
  { const [bx, bz] = at(0, -0.285); k.box(0.48, 0.03, 0.045, bx, y + 1.05, bz, M.chairFrame, ry); } // 위쪽 테두리
  for (const sd of [-1, 1]) {
    const [ax, az] = at(sd * 0.27, -0.05); k.box(0.035, 0.24, 0.05, ax, y + 0.44, az, M.chairFrame, ry);   // 팔걸이 기둥
    const [px, pz] = at(sd * 0.27, 0.03); k.box(0.07, 0.03, 0.26, px, y + 0.68, pz, M.chairFrame, ry);    // 팔걸이 패드
  }
  SEATS?.push({ x, z, ry, h: 0.48, desk: DESK });
}
function chair(k, x, y, z, ry, mat = M.chairGray) {
  if (TASK) { taskChair(k, x, y, z, ry); return; }
  const s = Math.sin(ry), c = Math.cos(ry);
  SEATS?.push({ x, z, ry, h: 0.48, desk: DESK });
  k.box(0.5, 0.08, 0.5, x, y + 0.44, z, mat, ry);
  k.box(0.5, 0.55, 0.07, x - s * 0.24, y + 0.52, z - c * 0.24, mat, ry);
  k.cyl(0.03, 0.42, x, y + 0.02, z, M.metal, 6);
  k.cyl(0.27, 0.04, x, y, z, M.metal, 10);
}
function stool(k, x, y, z, ry = 0) {
  SEATS?.push({ x, z, ry, h: 0.78 });
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
  const n = Math.max(1, Math.round(len / 1.0));
  for (let i = 0; i < n; i++) { const t = (i - (n - 1) / 2) * ((len - 0.5) / n); SEATS?.push({ x: x + c * t + s * 0.05, z: z - s * t + c * 0.05, ry, h: 0.42 }); }
}
// ---- 부드러운 곡선 모양 (콩 · 물방울) ----
const SHAPES = new Map();
function beanShape(len, wid, bend = 0.3) {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const x = Math.cos(t) * len / 2;
    const z = Math.sin(t) * wid / 2 * (1 - bend * Math.cos(t) * Math.cos(t)) + bend * wid * 0.5 * (Math.cos(t) * Math.cos(t) - 0.5);
    pts.push(new THREE.Vector2(x, z));
  }
  return new THREE.Shape(pts);
}
// 바닥에 까는 곡선 카펫 (올리브)
function carpetBlob(k, cx, cz, len, wid, ry = 0, bend = 0.25, mat = M.carpet) {
  const key = `c${len}|${wid}|${bend}`;
  let g = SHAPES.get(key);
  if (!g) { g = new THREE.ShapeGeometry(beanShape(len, wid, bend), 24); g.rotateX(-Math.PI / 2); SHAPES.set(key, g); }
  k.add(g, mat, cx, 0.028, cz, ry);
}
// 콩 모양 소파 (등받이 없는 둥근 패브릭 소파)
function blobSofa(k, col, cx, cz, ry, mat = M.lime, len = 2.4, wid = 1.0) {
  const key = `s${len}|${wid}`;
  let g = SHAPES.get(key);
  if (!g) {
    g = new THREE.ExtrudeGeometry(beanShape(len, wid, 0.35), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, curveSegments: 24 });
    g.rotateX(-Math.PI / 2); g.translate(0, 0.08, 0);
    SHAPES.set(key, g);
  }
  k.add(g, mat, cx, 0, cz, ry);
  const s = Math.sin(ry), c = Math.cos(ry);
  const hw = Math.abs(c) * len / 2 + Math.abs(s) * wid / 2, hd = Math.abs(s) * len / 2 + Math.abs(c) * wid / 2;
  col(cx - hw * 0.9, cz - hd * 0.9, cx + hw * 0.9, cz + hd * 0.9);
  for (const t of [-0.6, 0.6]) SEATS?.push({ x: cx + c * t * len / 2, z: cz - s * t * len / 2, ry: ry + Math.PI / 2, h: 0.46 });
}
function beanBag(k, col, x, z, mat = M.pastelYellow) {
  k.ball(0.42, x, 0.26, z, mat, 0.62);
  k.ball(0.3, x, 0.5, z - 0.15, mat, 0.9);
  col(x - 0.38, z - 0.38, x + 0.38, z + 0.38);
  SEATS?.push({ x, z: z + 0.05, ry: 0, h: 0.36 });
}
function steelTable(k, col, x, z, r = 0.28, h = 0.45) {
  k.cyl(r, h, x, 0, z, M.steel, 24);
  k.cyl(r * 0.98, 0.01, x, h, z, M.white, 24);
  col(x - r, z - r, x + r, z + r);
}
// 가는 실내 나무
function slimTree(k, x, z, h = 2.4) {
  k.cyl(0.03, h * 0.75, x, 0.2, z, M.walnut, 6, 0.015);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, rr = 0.2 + (i % 3) * 0.12, y = 0.2 + h * (0.45 + (i % 4) * 0.12);
    k.ball(0.11 + (i % 2) * 0.04, x + Math.cos(a) * rr, y, z + Math.sin(a) * rr, M.leafLight, 0.75);
  }
}
// 하얀 자갈 화단 (곡선) + 고사리 · 가는 나무 · 동그란 바닥 조명
function slatArc(k, col, cx, cz, r, a0, a1) {
  const n = Math.max(3, Math.round(((a1 - a0) * r) / 0.7));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    k.cyl(0.42, 0.14, x, 0, z, M.pebble, 16);
    k.cyl(0.43, 0.02, x, 0.13, z, M.rim, 16, 0.43);
    if (i % 2 === 0) { k.add(new THREE.ConeGeometry(0.12, 0.55, 5), M.leafLight, x + 0.1, 0.42, z - 0.05, a); k.add(new THREE.ConeGeometry(0.1, 0.45, 5), M.leaf, x - 0.12, 0.37, z + 0.08, a + 1); }
    if (i % 3 === 1) k.ball(0.12, x, 0.24, z, M.orb);
    if (i % 4 === 2) slimTree(k, x, z, 2.3);
    col(x - 0.35, z - 0.35, x + 0.35, z + 0.35);
  }
}
// 라운지 한 묶음: 곡선 카펫 + 콩 소파 2개 + 빈백 + 스테인리스 원탁
function loungeSet(k, col, cx, cz, n = 3, face = 0) {
  carpetBlob(k, cx, cz, 4.2, 3.2, face, 0.2);
  steelTable(k, col, cx, cz, 0.3, 0.42);
  const s = Math.sin(face), c = Math.cos(face);
  blobSofa(k, col, cx - s * 1.1, cz - c * 1.1, face, M.lime, 2.2, 0.85);
  if (n > 2) blobSofa(k, col, cx + c * 1.3 + s * 0.2, cz - s * 1.3 + c * 0.2, face + Math.PI / 2, M.cream, 1.8, 0.8);
  beanBag(k, col, cx - c * 1.25 + s * 0.6, cz + s * 1.25 + c * 0.6, M.pastelYellow);
}
// 조약돌 모양 하얀 펜던트 조명
function pendant(k, x, z, y = 2.35) {
  k.cyl(0.004, CEIL - y - 0.1, x, y + 0.1, z, M.black, 4);
  k.ball(0.14, x, y, z, M.orb, 0.75);
}
// 머그잔 (받침 포함)
function mug(k, x, y, z, mat = M.white) {
  k.cyl(0.07, 0.01, x, y, z, M.white, 12);
  k.cyl(0.04, 0.09, x, y + 0.01, z, mat, 10);
  k.cyl(0.033, 0.005, x, y + 0.095, z, M.coffee, 10);
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
  const sk = new Kit(false);
  for (const m of [M.glass, M.glassRoom, M.light, M.lightWarm, M.led, M.screen, M.lamp, M.slab, M.orb]) SHARP.add(m);
  const floors = FLOORS.map((f, i) => {
    const group = new THREE.Group();
    group.position.y = f.y;
    const colliders = [];
    return { ...f, index: i, group, colliders, seats: [], kit: new Kit(), col: (x1, z1, x2, z2, tall = false) => colliders.push({ x1, z1, x2, z2, tall }) };
  });
  const W = HX * 2, D = HZ * 2;
  // 모니터 화면 (문서 · 표 · 코드가 섞인 업무 화면 한 장)
  M.screen.map = canvasTex(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#1d2433'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2b3550'; ctx.fillRect(0, 0, w, 14); ctx.fillRect(0, 14, 48, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(56, 22, w - 64, h - 30);
    ctx.fillStyle = '#4f8cff'; ctx.fillRect(64, 30, 90, 8);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 3 ? '#c9cfdb' : '#8aa4d8'; ctx.fillRect(64, 46 + i * 12, 40 + ((i * 37) % 110), 5); }
    ctx.fillStyle = '#3ecf8e'; ctx.fillRect(200, 90, 10, 30); ctx.fillStyle = '#ffb547'; ctx.fillRect(214, 76, 10, 44); ctx.fillStyle = '#4f8cff'; ctx.fillRect(228, 60, 10, 60);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#5d6b8c'; ctx.fillRect(8, 24 + i * 16, 32, 6); }
  });

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
    if (!top) {
      // 하얀 천장 + 사각 매립등 + 둥근 환기구
      k.box(W - 0.1, 0.03, D - 0.1, 0, CEIL - 0.03, 0, M.ceiling);
      // 작고 둥근 매립 다운라이트를 고르게
      for (let x = -6.6; x <= 9.2; x += 1.8) for (let z = -5.4; z <= 5.8; z += 1.8) {
        if (x < CE + 0.4 && z < CS + 0.4) continue;
        k.cyl(0.075, 0.012, x, CEIL - 0.045, z, M.light, 12);
      }
    }
  });

  // ---------- 1F 로비 · 카페 ----------
  {
    const F = floors[0], { kit: k, col, group } = F;
    SEATS = F.seats;
    k.box(W - 0.2, 0.02, D - 0.2, 0, 0, 0, M.stone);
    k.box(10, 0.03, D - 0.2, 5, 0, 0, M.oak);
    k.box(2.4, 0.02, 1.6, 0, 0.03, HZ - 1, M.carpetWarm); // 입구 매트
    // 1층 유리벽은 걷기를 막음 (입구만 열림)
    col(-HX, HZ - 0.1, -1.1, HZ + 0.1, true); col(1.1, HZ - 0.1, HX, HZ + 0.1, true);
    col(-HX, -HZ - 0.1, HX, -HZ + 0.1, true);
    col(-HX - 0.1, -HZ, -HX + 0.1, HZ, true); col(HX - 0.1, -HZ, HX + 0.1, HZ, true);
    // 로고 벽 (코어 동쪽 면)
    const logo = canvasTex(1024, 384, (ctx, w, h) => {
      // 아이보리 벽에 붙인 하얀 입체 글자 느낌 (배경 투명 + 그림자)
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(90,70,40,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#ffffff'; ctx.font = `800 140px ${FONT}`; ctx.fillText(CONFIG.companyName, w / 2, h / 2 - 20);
      ctx.shadowBlur = 6; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
      ctx.font = `600 40px ${FONT}`; ctx.fillStyle = '#b9a27e'; ctx.fillText('WELCOME', w / 2, h / 2 + 95);
    });
    panel(group, logo, 3.6, 1.35, CE + 0.03, 1.95, CZ, Math.PI / 2).material.transparent = true;
    k.box(0.04, 0.04, 3.8, CE + 0.04, 2.75, CZ, M.lightWarm);
    // 안내 데스크
    k.box(0.8, 1.05, 2.6, -5.4, 0, -4.3, M.white); col(-5.8, -5.6, -5.0, -3.0);
    k.box(0.9, 0.04, 2.7, -5.4, 1.05, -4.3, M.walnut);
    k.box(0.03, 0.03, 2.4, -4.98, 0.9, -4.3, M.lightWarm);
    chair(k, -6.4, 0, -4.3, Math.PI / 2);
    // 로비 소파 (창을 바라봄)
    // 로비 라운지: 둥근 러그 + 달걀 의자 + 원목 루버 칸막이
    loungeSet(k, col, -5.4, 3.5, 3, 0);
    slatArc(k, col, -5.4, 3.5, 2.3, Math.PI * 1.12, Math.PI * 1.88);
    for (const [dx, dz, y] of [[-0.6, -0.3, 2.5], [0.3, -0.6, 2.25], [0.7, 0.3, 2.6], [-0.2, 0.5, 2.35], [-0.9, 0.6, 2.7], [0.1, 0.0, 2.8]]) pendant(k, -5.4 + dx, 3.5 + dz, y);
    // ===== 사내 카페 =====
    k.box(5.2, 0.015, 3.6, 4.2, 0.03, 0.4, M.carpetWarm);                        // 테이블 구역 러그
    // 뒷카운터 (에스프레소 머신 · 그라인더 · 싱크)
    k.box(3.8, 0.95, 0.6, 7.8, 0, -5.95, M.walnut); col(5.9, -6.3, 9.7, -5.6);
    k.box(3.9, 0.04, 0.66, 7.8, 0.95, -5.95, M.white);
    k.box(0.75, 0.45, 0.45, 6.6, 0.99, -5.98, M.steel);                          // 에스프레소 머신
    k.box(0.75, 0.06, 0.45, 6.6, 1.44, -5.98, M.black);
    for (const dx of [-0.18, 0.18]) { k.cyl(0.045, 0.08, 6.6 + dx, 1.12, -5.72, M.black, 8); k.cyl(0.03, 0.02, 6.6 + dx, 1.0, -5.7, M.metal, 8); }
    k.cyl(0.012, 0.18, 6.95, 1.06, -5.72, M.metal, 6);                            // 스팀 노즐
    for (const dx of [-0.25, -0.08, 0.08, 0.25]) k.cyl(0.035, 0.06, 6.6 + dx, 1.5, -6.0, M.white, 8); // 위에 데워 둔 잔
    k.cyl(0.09, 0.32, 7.35, 0.99, -6.0, M.black, 12);                             // 그라인더
    k.cyl(0.12, 0.2, 7.35, 1.31, -6.0, M.glassRoom, 12, 0.07);
    k.box(0.5, 0.03, 0.36, 8.3, 0.98, -5.95, M.steel);                           // 싱크
    k.cyl(0.015, 0.25, 8.3, 0.99, -6.12, M.metal, 6);
    for (let i = 0; i < 3; i++) k.cyl(0.05, 0.13, 9.0 + i * 0.13, 0.99, -6.02, i % 2 ? M.mugRed : M.white, 10); // 우유 · 시럽 병
    // 벽 선반 + 원두 병 · 컵
    for (const y of [1.6, 2.0]) {
      k.box(3.6, 0.03, 0.22, 7.8, y, -6.35, M.walnut);
      for (let i = 0; i < 8; i++) {
        const x = 6.2 + i * 0.45;
        if (y < 1.8) k.cyl(0.06, 0.18, x, y + 0.03, -6.35, i % 3 === 0 ? M.coffee : (i % 3 === 1 ? M.glassRoom : M.mugYellow), 10);
        else { k.cyl(0.045, 0.08, x, y + 0.03, -6.35, M.white, 8); k.cyl(0.045, 0.08, x, y + 0.11, -6.35, M.white, 8); }
      }
    }
    const menu = canvasTex(768, 384, (ctx, w, h) => {
      ctx.fillStyle = '#1b1d18'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f0e2c0'; ctx.font = `700 50px ${FONT}`; ctx.fillText('MENU', 40, 66);
      ctx.font = `400 32px ${FONT}`; ctx.fillStyle = '#d8d2c6';
      [['아메리카노', '2.0'], ['카페라테', '2.5'], ['바닐라라테', '3.0'], ['자몽 에이드', '3.0'], ['오늘의 차', '2.0']].forEach(([a, b], i) => {
        ctx.fillText(a, 40, 124 + i * 50); ctx.textAlign = 'right'; ctx.fillText(b, w - 40, 124 + i * 50); ctx.textAlign = 'left';
      });
      ctx.fillStyle = '#9fcf8f'; ctx.font = `500 26px ${FONT}`; ctx.fillText('직원 할인 50% ☕', w - 260, 66);
    });
    panel(group, menu, 2.0, 1.0, 7.8, 2.85, -6.42, 0, false);
    // 앞카운터 (주문대 · 진열장 · 계산대)
    k.box(3.4, 1.05, 0.6, 7.6, 0, -3.9, M.walnut); col(5.9, -4.2, 9.3, -3.6);
    k.box(3.6, 0.05, 0.75, 7.6, 1.05, -3.9, M.white);
    k.box(3.2, 0.03, 0.03, 7.6, 0.95, -3.58, M.lightWarm);
    k.box(1.1, 0.5, 0.55, 8.65, 1.1, -3.9, M.glassRoom);                         // 빵 진열장
    k.box(1.1, 0.03, 0.55, 8.65, 1.1, -3.9, M.walnut); k.box(1.04, 0.02, 0.5, 8.65, 1.33, -3.9, M.glassRoom);
    for (let i = 0; i < 5; i++) {
      k.ball(0.07, 8.25 + i * 0.2, 1.18, -3.95, i % 2 ? M.pastry : M.pastryPink, 0.6);
      k.ball(0.06, 8.25 + i * 0.2, 1.4, -3.9, i % 2 ? M.pastryPink : M.pastry, 0.7);
    }
    k.box(0.32, 0.08, 0.26, 6.55, 1.1, -3.95, M.black);                          // 계산대
    k.box(0.3, 0.2, 0.02, 6.55, 1.18, -4.03, M.screen);
    for (let i = 0; i < 4; i++) k.cyl(0.045, 0.1, 7.15, 1.1 + i * 0.09, -4.0, M.white, 10, 0.05); // 테이크아웃 컵
    k.cyl(0.05, 0.14, 7.55, 1.1, -3.8, M.glassRoom, 10);                         // 팁 병 · 꽃
    k.ball(0.07, 7.55, 1.3, -3.8, M.pastryPink);
    for (const x of [6.6, 7.6, 8.6]) { k.cyl(0.01, 1.1, x, 2.55, -3.9, M.black, 4); k.cyl(0.16, 0.14, x, 2.42, -3.9, M.black, 12, 0.05); k.ball(0.08, x, 2.42, -3.9, M.bulb); }
    const cafeSign = canvasTex(768, 192, (ctx, w, h) => {
      ctx.fillStyle = '#14120f'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e8d3a0'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#f3dfae'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 84px ${FONT}`; ctx.fillText(`${CONFIG.companyName} CAFE`, w / 2, h / 2 + 4);
    });
    panel(group, cafeSign, 2.4, 0.6, 7.6, 3.2, -3.88, 0);
    // 입간판
    const board = canvasTex(256, 320, (ctx, w, h) => {
      ctx.fillStyle = '#23271f'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f4f1e6'; ctx.font = `700 34px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('오늘의 커피', w / 2, 60);
      ctx.font = `400 26px ${FONT}`; ctx.fillText('에티오피아', w / 2, 120); ctx.fillText('예가체프', w / 2, 156);
      ctx.fillStyle = '#ffb547'; ctx.fillText('★ 디카페인 가능', w / 2, 230);
    });
    k.box(0.6, 0.85, 0.05, 4.2, 0, -3.0, M.walnut, -0.2); col(3.85, -3.2, 4.55, -2.8);
    panel(group, board, 0.5, 0.62, 4.2 + Math.sin(-0.2) * 0.03, 0.5, -3.0 + Math.cos(-0.2) * 0.03, -0.2, false);
    // 카페 테이블 (머그잔과 작은 꽃병)
    for (const [x, z] of [[2.6, -1.0], [5.6, -1.0], [2.6, 2.0], [5.6, 2.0]]) {
      roundTable(k, col, x, 0, z, 0.45, 0.74, M.oak);
      chair(k, x - 0.8, 0, z, Math.PI / 2, M.fabricWarm);
      chair(k, x + 0.8, 0, z, -Math.PI / 2, M.fabricWarm);
      mug(k, x - 0.18, 0.74, z + 0.05, (x + z) % 2 ? M.white : M.mugYellow);
      mug(k, x + 0.18, 0.74, z - 0.05);
      k.cyl(0.03, 0.12, x, 0.74, z - 0.15, M.glassRoom, 8); k.ball(0.04, x, 0.9, z - 0.15, M.pastryPink);
    }
    // 동쪽 벽 긴 소파 + 사각 테이블
    sofa(k, col, 9.35, 0, 1.2, -Math.PI / 2, 3.6, M.fabricGreen);
    for (const z of [0.3, 2.1]) {
      k.box(0.7, 0.04, 0.7, 8.35, 0.7, z, M.oak); k.cyl(0.04, 0.7, 8.35, 0, z, M.metal, 6); col(8.0, z - 0.35, 8.7, z + 0.35);
      chair(k, 7.5, 0, z, Math.PI / 2, M.fabricWarm);
      mug(k, 8.35, 0.74, z, M.mugRed);
    }
    // 창가 바 (입구 오른쪽, 창을 바라봄)
    k.box(7.4, 0.05, 0.45, 5.9, 1.05, HZ - 0.55, M.walnut); col(2.2, HZ - 0.8, 9.6, HZ - 0.3);
    for (let x = 2.8; x <= 9.2; x += 1.1) { stool(k, x, 0, HZ - 1.2, 0); if (Math.round(x * 10) % 3 === 0) mug(k, x, 1.07, HZ - 0.5, M.white); }
    for (const [x, z, s] of [[-9.3, 5.8, 1], [-9.3, 1.2, 0.9], [-2, 5.7, 0.8], [2, -5.8, 0.8]]) plant(k, col, x, 0, z, s);
  }

  // ---------- 2F 업무 공간 (16자리) ----------
  {
    const F = floors[1], { kit: k, col, group } = F;
    SEATS = F.seats;
    TASK = true; // 2층 · 3층은 사무용 메시 의자
    k.box(W - 0.2, 0.02, D - 0.2, 0, 0, 0, M.stone);
    carpetBlob(k, 0, -1.3, 12.5, 8.6, 0, 0.12);                                    // 책상 구역 곡선 카펫
    carpetBlob(k, 6.5, 3.6, 4.0, 3.2, 0.3, 0.2, M.carpetWarm);
    DESK = true;
    for (const zc of [-3.8, 1.2]) {
      for (const xc of [-2.5, 2.5]) {
        k.box(3.2, 0.04, 1.6, xc, 0.72, zc, M.oak);
        k.box(3.2, 0.36, 0.03, xc, 0.76, zc, M.white);
        k.box(0.05, 0.72, 1.5, xc - 1.55, 0, zc, M.metal); k.box(0.05, 0.72, 1.5, xc + 1.55, 0, zc, M.metal);
        col(xc - 1.6, zc - 0.8, xc + 1.6, zc + 0.8);
        // 스탠드 조명 (밤에 켜짐)
        k.cyl(0.012, 0.42, xc, 0.76, zc, M.black, 6); k.box(0.22, 0.05, 0.1, xc, 1.18, zc, M.lamp);
        for (const dx of [-0.8, 0.8]) for (const s of [-1, 1]) {
          const x = xc + dx;
          k.box(0.6, 0.36, 0.03, x, 0.92, zc + s * 0.45, M.black);
          k.box(0.56, 0.32, 0.005, x, 0.94, zc + s * 0.47, M.screen);
          k.box(0.42, 0.02, 0.14, x, 0.76, zc + s * 0.6, M.black);              // 키보드
          k.cyl(0.03, 0.12, x, 0.76, zc + s * 0.47, M.metal, 6);                 // 모니터 받침
          k.box(0.06, 0.02, 0.1, x + 0.3, 0.76, zc + s * 0.6, M.white);          // 마우스
          const seed = Math.round((x + 10) * 3 + zc * 7 + s * 5);
          mug(k, x - 0.33, 0.76, zc + s * 0.62, [M.white, M.mugRed, M.mugYellow][Math.abs(seed) % 3]);
          if (seed % 2) k.box(0.22, 0.03, 0.3, x + 0.1, 0.76, zc + s * 0.3, M.paper, 0.15 * s); // 서류
          if (seed % 3 === 0) { k.cyl(0.05, 0.08, x - 0.6, 0.76, zc + s * 0.3, M.pot, 8); k.ball(0.08, x - 0.6, 0.9, zc + s * 0.3, M.leaf); } // 작은 화분
          k.box(0.38, 0.55, 0.45, x + 0.45, 0.02, zc + s * 0.4, M.metal);        // 서랍장
          chair(k, x, 0, zc + s * 1.15, s > 0 ? Math.PI : 0);
        }
      }
    }
    // 팀장 자리
    k.box(0.85, 0.05, 1.8, 8.4, 0.74, -3.8, M.walnut); k.box(0.05, 0.72, 1.7, 8.8, 0.02, -3.8, M.walnut);
    col(7.95, -4.7, 8.85, -2.9);
    k.box(0.03, 0.38, 0.6, 8.6, 0.94, -3.8, M.black);
    chair(k, 7.5, 0, -3.8, Math.PI / 2);
    DESK = false;
    // 서류장 (북쪽 창가) + 바인더
    for (let i = 0; i < 3; i++) {
      const x = 4.9 + i * 0.85;
      k.box(0.8, 1.0, 0.45, x, 0, -6.15, M.white); k.box(0.7, 0.02, 0.02, x, 0.5, -5.92, M.metal);
      for (let j = 0; j < 5; j++) k.box(0.06, 0.28, 0.22, x - 0.25 + j * 0.12, 1.0, -6.15, [M.mugRed, M.books2, M.mugYellow, M.books, M.fabricGreen][j]);
    }
    col(4.45, -6.4, 7.05, -5.9);
    // 벽시계 · 팀 보드 (코어 동쪽 면)
    const clock = canvasTex(256, 256, (ctx) => {
      ctx.fillStyle = '#f7f5ef'; ctx.beginPath(); ctx.arc(128, 128, 120, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 8; ctx.stroke();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; ctx.fillStyle = '#333'; ctx.fillRect(128 + Math.sin(a) * 96 - 3, 128 - Math.cos(a) * 96 - 3, 6, 6); }
      ctx.lineCap = 'round'; ctx.strokeStyle = '#222'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + 50, 128 - 30); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128, 40); ctx.stroke();
    });
    const clockMesh = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), new THREE.MeshStandardMaterial({ map: clock, roughness: 0.5 }));
    clockMesh.position.set(CE + 0.03, 2.8, -3.0); clockMesh.rotation.y = Math.PI / 2; group.add(clockMesh);
    const team = canvasTex(512, 320, (ctx, w, h) => {
      ctx.fillStyle = '#c9a77c'; ctx.fillRect(0, 0, w, h);
      const notes = [['#fff59a', '기획안 마감 금요일'], ['#ffc4d6', '점심 메뉴 투표!'], ['#b9f0c9', '새 팀원 환영해요'], ['#bfe0ff', '회의실 예약 확인']];
      notes.forEach(([c, t], i) => {
        const x = 24 + (i % 2) * 248, y = 24 + Math.floor(i / 2) * 148;
        ctx.fillStyle = c; ctx.fillRect(x, y, 216, 124);
        ctx.fillStyle = '#d23'; ctx.beginPath(); ctx.arc(x + 108, y + 10, 7, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#333'; ctx.font = `500 24px ${FONT}`; ctx.fillText(t, x + 14, y + 70);
      });
    });
    panel(group, team, 1.8, 1.12, CE + 0.03, 1.6, -4.9, Math.PI / 2, false);
    // 옷걸이 · 휴지통
    k.cyl(0.025, 1.7, -9.4, 0, 0.3, M.walnut, 6); k.cyl(0.22, 0.03, -9.4, 0, 0.3, M.walnut, 10);
    for (let a = 0; a < 4; a++) k.box(0.18, 0.02, 0.02, -9.4 + Math.cos(a * 1.57) * 0.09, 1.62, 0.3 + Math.sin(a * 1.57) * 0.09, M.walnut, a * 1.57);
    k.cyl(0.18, 0.2, -9.42, 1.35, 0.3, M.fabricBlue, 8, 0.12);                   // 걸린 겉옷
    col(-9.65, 0.05, -9.15, 0.55);
    for (const [x, z] of [[-4.4, -1.25], [4.4, -1.25], [0, -1.25]]) k.cyl(0.13, 0.32, x, 0, z, M.metal, 10, 0.15);
    // 책장 (서쪽 창가)
    k.box(0.5, 2.1, 4.4, -9.5, 0, 3.2, M.walnut); col(-9.8, 1.0, -9.2, 5.4, true);
    for (let i = 0; i < 4; i++) k.box(0.36, 0.38, 4.0, -9.35, 0.15 + i * 0.5, 3.2, i % 2 ? M.books : M.books2);
    // 화이트보드 (책상 쪽을 바라봄)
    k.box(2.6, 1.3, 0.05, -1, 0.9, 4.6, M.white); k.box(0.06, 0.9, 0.06, -2.2, 0, 4.6, M.metal); k.box(0.06, 0.9, 0.06, 0.2, 0, 4.6, M.metal);
    col(-2.3, 4.5, 0.3, 4.7, true);
    const wb = canvasTex(512, 256, (ctx) => {
      ctx.fillStyle = '#f4f4f2'; ctx.fillRect(0, 0, 512, 256);
      ctx.font = `600 30px ${FONT}`; ctx.fillStyle = '#2a62c9'; ctx.fillText('이번 주 할 일', 24, 44);
      ctx.fillStyle = '#333'; ctx.font = `400 24px ${FONT}`;
      ['☐ 메타버스 사옥 오픈', '☐ 주간 회의 준비', '☑ 커피 머신 청소'].forEach((t, i) => ctx.fillText(t, 30, 96 + i * 44));
      ctx.strokeStyle = '#d23'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(420, 160, 50, 0, 6.28); ctx.stroke();
    });
    panel(group, wb, 2.5, 1.2, -1, 1.55, 4.57, Math.PI, false);
    // 창가 작은 회의 테이블
    roundTable(k, col, 6.5, 0, 3.6, 0.65, 0.74, M.oak);
    slatArc(k, col, 6.5, 3.6, 1.95, Math.PI * 1.12, Math.PI * 1.88);
    pendant(k, 6.5, 3.6);
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
    SEATS = F.seats;
    k.box(W - 0.2, 0.02, D - 0.2, 0, 0, 0, M.stone);
    k.box(17.4, 0.03, 4.4, 1.25, 0, -4.25, M.oak);                                // 회의실은 원목 바닥
    // 복도 천장의 곡선 LED 라인
    { const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new THREE.Vector3(-7 + 16 * t, CEIL - 0.06, -1.3 + 0.9 * Math.pow(t, 6))); }
      for (let a = 0; a <= 12; a++) { const q = (a / 12) * Math.PI / 2; pts.push(new THREE.Vector3(9 + Math.sin(q) * 0.6, CEIL - 0.06, -0.4 + (1 - Math.cos(q)) * 0.6 + a * 0.15)); }
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.025, 4), M.light)); }
    carpetBlob(k, 2.5, 3.6, 9, 4.6, 0.1, 0.3);
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
    meeting(5.9, 4.4, 3, M.fabricWarm);
    pendant(k, -3.6, -4.3, 2.2); pendant(k, -2.2, -4.3, 2.2); pendant(k, 5.1, -4.3, 2.2); pendant(k, 6.7, -4.3, 2.2);
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
    loungeSet(k, col, 3.0, 3.9, 3, Math.PI);
    slatArc(k, col, 3.0, 3.9, 2.2, Math.PI * 0.55, Math.PI * 1.35);
    pendant(k, 3.0, 3.9);
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
    SEATS = F.seats;
    TASK = false;
    k.box(W - 0.2, 0.02, D - 0.2, 0, 0, 0, M.oak);
    // 곡선 올리브 카펫 위에 라임 · 크림 콩 소파, 파스텔 빈백, 스테인리스 원탁
    carpetBlob(k, 0.5, 2.6, 8.5, 4.8, -0.08, 0.3);
    blobSofa(k, col, -0.6, 1.6, 0.15, M.lime, 2.6, 1.0);
    blobSofa(k, col, 2.6, 3.3, -0.4, M.cream, 2.4, 1.0);
    blobSofa(k, col, 0.4, 4.4, 0.05, M.lime, 2.0, 0.85);
    steelTable(k, col, 1.0, 2.6, 0.3, 0.45); steelTable(k, col, -2.0, 3.4, 0.24, 0.4);
    beanBag(k, col, -3.4, 2.2, M.pastelYellow); beanBag(k, col, -4.5, 3.4, M.pastelBlue);
    // 창가 바
    k.box(14, 0.05, 0.45, 2.3, 1.05, HZ - 0.55, M.walnut); col(-4.7, HZ - 0.8, 9.3, HZ - 0.3);
    for (let x = -4.1; x <= 9; x += 1.2) stool(k, x, 0, HZ - 1.2);
    // 탕비실 (북쪽)
    k.box(5.6, 0.92, 0.6, -3.9, 0, -6.1, M.white); col(-6.7, -6.45, -1.1, -5.8);
    k.box(5.6, 0.04, 0.65, -3.9, 0.92, -6.1, M.walnut);
    k.box(0.85, 2, 0.7, -0.5, 0, -6.05, M.metal); col(-0.95, -6.45, -0.05, -5.7);
    k.box(0.5, 0.35, 0.4, -5.8, 0.94, -6.1, M.black);
    for (const x of [-5.8, -3.9, -2]) k.box(1.5, 0.65, 0.33, x, 1.9, -6.3, M.white);
    slatArc(k, col, -4.0, 2.8, 1.9, Math.PI * 0.55, Math.PI * 1.45);
    pendant(k, -4.6, -3.8); pendant(k, -3.2, -3.8);
    // 아일랜드 테이블
    k.box(3, 0.06, 1.0, -3.9, 0.98, -3.8, M.walnut); k.box(2.7, 0.95, 0.75, -3.9, 0, -3.8, M.white); col(-5.4, -4.3, -2.4, -3.3);
    for (const x of [-5, -3.9, -2.8]) stool(k, x, 0, -2.85, Math.PI);
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
    for (const [x, z, s] of [[-9.3, 5.8, 1.1], [-6.6, -1.2, 0.8], [7.2, 2.9, 0.8]]) plant(k, col, x, 0, z, s);
    // ===== 오락존: 투명 부스 5칸 + 샌드백 =====
    const FX = 8.4; // 부스 앞 유리 위치
    k.box(10 - FX, 0.03, 8.5, (FX + 10) / 2, 0.02, -2.15, M.black);              // 고무 바닥
    for (let i = 0; i <= 5; i++) {                                                // 칸막이 유리
      const z = -6.4 + i * 1.7;
      k.box(10 - FX, 2.3, 0.04, (FX + 10) / 2, 0, z, M.glassRoom);
      k.box(10 - FX, 0.06, 0.08, (FX + 10) / 2, 2.3, z, M.metal);
      k.box(0.08, 2.36, 0.08, FX, 0, z, M.metal);
      col(FX, z - 0.06, 10, z + 0.06);
    }
    for (const b of BOOTHS) {
      // 앞 유리 (가운데 0.8m는 열린 입구)
      for (const [a, c] of [[b.z1, b.zc - 0.4], [b.zc + 0.4, b.z2]]) {
        k.box(0.04, 2.3, c - a, FX, 0, (a + c) / 2, M.glassRoom); col(FX - 0.06, a, FX + 0.06, c);
      }
      k.box(0.08, 0.06, 1.7, FX, 2.3, b.zc, M.metal);
      k.box(0.03, 0.03, 1.6, FX - 0.05, 2.22, b.zc, M.lamp);                      // 부스 위 조명 띠
      k.box(1.2, 0.06, 0.06, b.bagX, 2.3, b.zc, M.metal);                          // 샌드백 거는 봉
      k.box(1.0, 0.02, 0.8, 8.95, 0.05, b.zc, [M.mugRed, M.books2, M.mugYellow, M.fabricGreen, M.pastryPink][b.i]); // 칸 색 매트
      col(b.bagX - 0.24, b.zc - 0.24, b.bagX + 0.24, b.zc + 0.24);
      panel(group, signTex(`${b.i + 1}`, '', { w: 128, h: 128, size: 90, bg: '#101218', fg: ['#ff6b6b', '#4f8cff', '#ffb547', '#3ecf8e', '#ff7ac6'][b.i] }), 0.32, 0.32, FX - 0.07, 2.55, b.zc, -Math.PI / 2);
    }
    const arcadeSign = canvasTex(768, 160, (ctx, w, h) => {
      ctx.fillStyle = '#0d0f16'; ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 78px ${FONT}`;
      ctx.fillStyle = '#ff6b9a'; ctx.fillText('🥊 PUNCH ZONE', w / 2, h / 2 + 4);
    });
    panel(group, arcadeSign, 2.4, 0.5, FX - 0.07, 3.1, -2.15, -Math.PI / 2);
  }

  // ---------- 옥상 테라스 ----------
  const roofLights = [];
  {
    const F = floors[4], { kit: k, col } = F;
    SEATS = F.seats;
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

  SEATS = null;
  floors.forEach((F) => { F.kit.flush(F.group); delete F.kit; });

  // 샌드백 (위 봉에 매달려 흔들림)
  const bagMat = new THREE.MeshStandardMaterial({ color: 0xb8332e, roughness: 0.55 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.6 });
  const bags = BOOTHS.map((b) => {
    const pivot = new THREE.Group();
    pivot.position.set(b.bagX, 2.3, b.zc);
    const bk = new Kit();
    bk.cyl(0.008, 1.25, 0, -1.25, 0, M.metal, 4);                                  // 줄
    bk.cyl(0.19, 0.8, 0, -2.05, 0, bagMat, 18);                                    // 샌드백 (바닥에서 0.25~1.05m)
    bk.cyl(0.195, 0.07, 0, -1.3, 0, capMat, 18); bk.cyl(0.195, 0.07, 0, -2.08, 0, capMat, 18);
    bk.cyl(0.196, 0.05, 0, -1.7, 0, capMat, 18);
    bk.flush(pivot);
    floors[3].group.add(pivot);
    return { pivot, ang: 0, vel: 0, wob: Math.random() * 6 };
  });

  const group = new THREE.Group();
  group.add(shell, ...floors.map((f) => f.group));

  // 층마다 옮겨 다니는 조명 3개 (조명 개수가 바뀌지 않아 셰이더를 다시 만들지 않음)
  const hemi = new THREE.HemisphereLight(0x9aa6d0, 0x3a2c20, 1.1);
  const amb = new THREE.AmbientLight(0xffffff, 0.08);
  const rig = [new THREE.PointLight(0xffd8b0, 10, 16, 2), new THREE.PointLight(0xe8eeff, 10, 16, 2), new THREE.PointLight(0xffc890, 10, 16, 2)];
  group.add(hemi, amb, ...rig);
  const LED = M.led.color.clone(), BULB = M.bulb.color.clone();
  const LIGHT_N = M.light.color.clone(), LIGHT_D = new THREE.Color(0.62, 0.64, 0.66);
  const WARM_N = M.lightWarm.color.clone(), WARM_D = new THREE.Color(0.75, 0.6, 0.45);
  const LAMP_N = M.lamp.color.clone(), LAMP_D = new THREE.Color(0.55, 0.52, 0.48);
  const RIG_N = new THREE.Color(0xffcf9a), RIG_D = new THREE.Color(0xf2f5ff);
  let dayK = 0, curFloor = 0;
  // 낮: 햇빛이 들어오니 실내등은 약하고 하얀빛 / 밤: 실내등이 밝고 따뜻한 빛
  const applyRig = () => {
    const f = curFloor, roof = f === ROOF;
    LIGHTS[f].forEach(([x, z], i) => {
      rig[i].position.set(x, FLOORS[f].y + (roof ? 3.2 : 3.3), z);
      rig[i].intensity = roof ? 10 * (1 - dayK) : 18 - 10 * dayK;
      rig[i].color.copy(RIG_N).lerp(RIG_D, dayK);
    });
  };
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
    bags,
    hitBag(i, power) { const b = bags[i]; if (b) b.vel += power; },
    // 걷는 층만 보이기 (all=true면 모든 층)
    setFloor(f, all = false) {
      floors.forEach((F) => { F.group.visible = all || F.index === f; });
      curFloor = f;
      applyRig();
    },
    setDay(d) {
      hemi.intensity = 1.1 + 0.9 * d;
      hemi.color.setRGB(0.6 + 0.3 * d, 0.65 + 0.3 * d, 0.82 + 0.15 * d);
      M.led.color.copy(LED).multiplyScalar(1 - 0.85 * d);
      M.bulb.color.copy(BULB).multiplyScalar(1 - 0.75 * d);
      M.light.color.copy(LIGHT_N).lerp(LIGHT_D, d);
      M.lightWarm.color.copy(WARM_N).lerp(WARM_D, d);
      M.lamp.color.copy(LAMP_N).lerp(LAMP_D, d);
      dayK = d;
      applyRig();
    },
    update(dt, player) {
      // 샌드백 흔들림 (스프링처럼 돌아옴)
      for (const b of bags) {
        b.vel += (-14 * b.ang - 1.6 * b.vel) * dt;
        b.ang += b.vel * dt;
        b.ang = Math.max(-0.7, Math.min(0.7, b.ang));
        b.wob += dt * 3;
        b.pivot.rotation.z = b.ang;
        b.pivot.rotation.x = Math.sin(b.wob) * Math.min(Math.abs(b.ang), 0.15) * 0.4;
      }
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
