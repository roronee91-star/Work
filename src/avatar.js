// 캐릭터: 자유로운 회사원 차림 (남자 / 여자), 이름표 · 말풍선 · 걷기 동작
// 굳은 부분끼리 색을 꼭짓점에 구워 합쳐서, 캐릭터 하나를 그리기 5번(몸·팔 2·다리 2)으로 그림
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function labelTexture(text, { bg = 'rgba(10,12,18,0.72)', fg = '#fff', font = 600, size = 44, maxW = 560 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const setFont = () => { ctx.font = `${font} ${size}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif`; };
  setFont();
  const lines = [];
  let line = '';
  for (const ch of [...text]) {
    if (ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; } else line += ch;
    if (lines.length >= 3) break;
  }
  if (lines.length < 3 && line) lines.push(line);
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width))) + 44;
  const lh = size * 1.3;
  c.width = Math.ceil(w); c.height = Math.ceil(lines.length * lh + 26);
  setFont();
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 22); ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, c.width / 2, 13 + lh * (i + 0.5)));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: c.width / c.height };
}
function makeSprite(text, opt, height) {
  const { tex, aspect } = labelTexture(text, opt);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(height * aspect, height, 1);
  s.renderOrder = 10;
  s.layers.set(1); // 이름표·말풍선은 빛 번짐 효과 뒤에 따로 그림 (밤에 빛나지 않게)
  return s;
}

// ---------- 조각을 색과 함께 모으기 ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
class Part {
  constructor() { this.list = []; }
  add(geo, color, x, y, z, { sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0 } = {}) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    if (g.attributes.uv) g.deleteAttribute('uv');
    _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(_m);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.list.push(g);
    return this;
  }
  mesh(mat) { const m = new THREE.Mesh(mergeGeometries(this.list), mat); m.castShadow = false; return m; }
}
const G = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  sphereLo: new THREE.SphereGeometry(1, 10, 8),
  halfSphere: new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cone: new THREE.CylinderGeometry(0.62, 1, 1, 18, 1, true),
  capsule: new THREE.CapsuleGeometry(1, 1, 4, 12),
};
const cap = (r, len) => { const g = new THREE.CapsuleGeometry(r, len, 4, 12); return g; };

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, emissive: 0x1c140e });
const SKIN = 0xffe0c4, EYE = 0x241a16;
export const SCALE = 1.0; // 2등신 캐릭터 (약 1.05m, 교회 메타버스와 같은 크기)

// 👗 꾸미기: 머리 모양 · 머리 색 · 옷 종류 · 하의(바지/치마) · 하의 색. 숫자 5개짜리 글자로 주고받음 (예: '10021')
export const HAIR_STYLES = ['짧은 머리', '긴 생머리', '단발', '묶은 머리', '똥머리', '뽀글 파마'];
export const HAIR_COLORS = [0x3b2516, 0x17130f, 0x6b3f22, 0xa8743f, 0xe3c37c, 0xa9aab2, 0xe58fb0, 0x5a78d6];
export const OUTFITS = ['셔츠', '정장', '후드티', '니트', '반팔 티'];
export const BOTTOMS = ['바지', '치마'];
export const BOTTOM_COLORS = [null, 0x2c3446, 0x1e1e22, 0xc9b59a, 0x7b8089, 0x4a6fa8, 0x6a4a34]; // null = 상의에 맞춰 자동
export function parseLook(look, gender) {
  const f = gender === 'f', d = String(look || '');
  const n = (i, max, def) => { const v = parseInt(d[i], 10); return Number.isInteger(v) && v >= 0 && v < max ? v : def; };
  return { hs: n(0, HAIR_STYLES.length, f ? 1 : 0), hc: n(1, HAIR_COLORS.length, 0), ot: n(2, OUTFITS.length, 0), bt: n(3, BOTTOMS.length, f ? 1 : 0), bc: n(4, BOTTOM_COLORS.length, 0) };
}
export const lookKey = (L) => `${L.hs}${L.hc}${L.ot}${L.bt}${L.bc}`;

function shade(hex, k) { return new THREE.Color(hex).multiplyScalar(k); }
function isLight(hex) { const c = new THREE.Color(hex); return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.6; }
const bottomOf = (g, top) => g === 'f' ? (isLight(top) ? 0x39415a : 0xc9b59a) : (isLight(top) ? 0x353c4a : 0xb9a888);

// 머리 모양
function hair(p, hs, HAIR, f, H) {
  const curly = hs === 5;
  p.add(new THREE.SphereGeometry(0.272, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), HAIR, 0, H, -0.01, { rx: -0.42 });
  for (const sx of [-1, 1]) p.add(new THREE.SphereGeometry(0.09, 12, 10), HAIR, sx * 0.21, H + 0.04, 0.05, { sx: 0.55, sy: 1.15, sz: 0.9 });
  for (const [x, y, rz] of [[-0.1, 0.118, -0.35], [0, 0.128, 0], [0.1, 0.118, 0.35]]) p.add(new THREE.SphereGeometry(0.08, 14, 10), HAIR, x, H + y, 0.19, { sx: 0.95, sy: 0.42, sz: 0.5, rz });
  if (hs === 0) {
    p.add(new THREE.ConeGeometry(0.022, 0.08, 8), HAIR, 0.03, H + 0.275, 0.02, { rx: -0.5, rz: -0.4 });            // 삐침 머리
  } else if (hs === 1) {
    p.add(new THREE.SphereGeometry(0.27, 24, 18), HAIR, 0, H - 0.1, -0.08, { sx: 1.02, sy: 1.32, sz: 0.82 });    // 긴 뒷머리
    for (const sx of [-1, 1]) {
      p.add(new THREE.SphereGeometry(0.085, 12, 12), HAIR, sx * 0.215, H - 0.13, 0.03, { sx: 0.55, sy: 1.9, sz: 0.75 });
      p.add(new THREE.SphereGeometry(0.07, 12, 10), HAIR, sx * 0.2, H - 0.3, 0, { sx: 0.7, sy: 0.8, sz: 0.8 });
    }
    if (f) {
      for (const sx of [-1, 1]) p.add(new THREE.ConeGeometry(0.05, 0.09, 4), 0xf28bb0, 0.16 + sx * 0.045, H + 0.2, 0.06, { rz: sx * Math.PI / 2 }); // 리본
      p.add(new THREE.SphereGeometry(0.022, 10, 8), 0xf28bb0, 0.16, H + 0.2, 0.065);
    }
  } else if (hs === 2) {
    p.add(new THREE.SphereGeometry(0.275, 24, 18), HAIR, 0, H - 0.03, -0.07, { sx: 1.05, sy: 1.0, sz: 0.85 });   // 단발 뒷머리
    for (const sx of [-1, 1]) p.add(new THREE.SphereGeometry(0.085, 12, 12), HAIR, sx * 0.22, H - 0.08, 0.04, { sx: 0.55, sy: 1.35, sz: 0.8 });
  } else if (hs === 3) {
    p.add(new THREE.SphereGeometry(0.26, 24, 18), HAIR, 0, H + 0.02, -0.05, { sx: 1.0, sy: 0.95, sz: 0.88 });
    p.add(new THREE.TorusGeometry(0.035, 0.013, 6, 12), 0x2b5dc9, 0, H + 0.05, -0.265, { rx: 0.4 });            // 머리끈
    p.add(new THREE.SphereGeometry(0.075, 12, 12), HAIR, 0, H - 0.05, -0.3, { sy: 1.5, sz: 0.8 });                // 묶은 꼬리
    p.add(new THREE.SphereGeometry(0.06, 12, 10), HAIR, 0, H - 0.19, -0.28, { sy: 1.4, sz: 0.8 });
  } else if (hs === 4) {
    p.add(new THREE.SphereGeometry(0.26, 24, 18), HAIR, 0, H + 0.02, -0.05, { sx: 1.0, sy: 0.95, sz: 0.88 });
    p.add(new THREE.SphereGeometry(0.11, 16, 12), HAIR, 0, H + 0.26, -0.08);                                       // 똥머리
    p.add(new THREE.TorusGeometry(0.075, 0.014, 6, 16), 0xf28bb0, 0, H + 0.19, -0.07, { rx: Math.PI / 2 + 0.2 });
  } else if (curly) {
    for (let i = 0; i < 16; i++) {                                                                                  // 뽀글뽀글
      const a = (i / 16) * Math.PI * 2, back = Math.cos(a) < 0.3;
      if (!back && Math.abs(Math.sin(a)) < 0.5) continue; // 얼굴 앞은 비움
      p.add(new THREE.SphereGeometry(0.075, 10, 8), HAIR, Math.sin(a) * 0.24, H + 0.08 + (back ? 0 : 0.04), Math.cos(a) * 0.22 - 0.02);
    }
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; p.add(new THREE.SphereGeometry(0.08, 10, 8), HAIR, Math.sin(a) * 0.12, H + 0.22, Math.cos(a) * 0.1 - 0.04); }
    for (const sx of [-1, 1]) p.add(new THREE.SphereGeometry(0.07, 10, 8), HAIR, sx * 0.2, H - 0.09, -0.08);
  }
}

// 머리 + 몸통 (굳은 부분) — 교회 메타버스 캐릭터와 같은 비율, 옷만 회사원 차림
function buildBody(gender, top, L) {
  const f = gender === 'f';
  const p = new Part();
  const HAIR = HAIR_COLORS[L.hc];
  const bottom = BOTTOM_COLORS[L.bc] ?? bottomOf(L.bt ? 'f' : 'm', top);
  // 상의 (셔츠 / 블라우스)
  p.add(new THREE.CylinderGeometry(0.15, 0.185, 0.26, 20), top, 0, 0.41, 0);
  p.add(new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), top, 0, 0.54, 0, { sy: 0.35 });
  const collar = isLight(top) ? 0x56667f : 0xffffff;
  const lanyard = () => {
    for (const sx of [-1, 1]) p.add(new THREE.BoxGeometry(0.01, 0.13, 0.006), 0x2b5dc9, sx * 0.032, 0.5, 0.15, { rx: -0.35, rz: sx * 0.25 });
    p.add(new THREE.BoxGeometry(0.065, 0.085, 0.008), 0xffffff, 0, 0.415, 0.183, { rx: -0.14 });
    p.add(new THREE.BoxGeometry(0.065, 0.02, 0.004), 0x2b5dc9, 0, 0.445, 0.188, { rx: -0.14 });
  };
  if (L.ot === 1) {
    // 정장: 흰 셔츠 V + 넥타이 + 옷깃, 사원증은 가슴 주머니에
    p.add(new THREE.ConeGeometry(0.062, 0.17, 3), 0xf4f4f2, 0, 0.47, 0.152, { rx: Math.PI - 0.14, sz: 0.35 });
    p.add(new THREE.BoxGeometry(0.03, 0.15, 0.008), isLight(top) ? 0x2b3a6b : 0x9e2b3a, 0, 0.45, 0.176, { rx: -0.14 });
    p.add(new THREE.BoxGeometry(0.034, 0.025, 0.012), isLight(top) ? 0x2b3a6b : 0x9e2b3a, 0, 0.525, 0.166, { rx: -0.14 });
    for (const sx of [-1, 1]) {
      p.add(new THREE.BoxGeometry(0.035, 0.17, 0.01), shade(top, 0.8), sx * 0.055, 0.47, 0.168, { rx: -0.14, rz: sx * 0.32 });
      p.add(new THREE.ConeGeometry(0.03, 0.06, 3), 0xf4f4f2, sx * 0.035, 0.55, 0.1, { rx: Math.PI / 2 + 0.5, rz: sx * 0.9 });
    }
    for (const y of [0.38, 0.33]) p.add(new THREE.SphereGeometry(0.008, 6, 4), shade(top, 0.55), 0.02, y, 0.184);
    p.add(new THREE.BoxGeometry(0.05, 0.065, 0.006), 0xffffff, -0.09, 0.42, 0.168, { rx: -0.14, ry: -0.35 });
  } else if (L.ot === 2) {
    // 후드티: 어깨에 걸친 모자 + 끈 + 큰 앞주머니
    p.add(new THREE.TorusGeometry(0.115, 0.05, 8, 22), shade(top, 0.86), 0, 0.555, -0.02, { rx: Math.PI / 2 - 0.2, sx: 1.25 });
    p.add(new THREE.SphereGeometry(0.11, 14, 10), shade(top, 0.82), 0, 0.56, -0.15, { sx: 1.25, sy: 0.85, sz: 0.6 });
    for (const sx of [-1, 1]) {
      p.add(new THREE.BoxGeometry(0.01, 0.13, 0.01), 0xf2f2f2, sx * 0.04, 0.47, 0.17, { rx: -0.14 });
      p.add(new THREE.SphereGeometry(0.012, 6, 6), 0xf2f2f2, sx * 0.04, 0.4, 0.18);
    }
    p.add(new THREE.BoxGeometry(0.22, 0.09, 0.03), shade(top, 0.78), 0, 0.355, 0.168, { rx: -0.14 });
    p.add(new THREE.BoxGeometry(0.2, 0.012, 0.032), shade(top, 0.65), 0, 0.398, 0.172, { rx: -0.14 });
  } else if (L.ot === 3) {
    // 니트: 목 폴라 + 아래 고무단 + 세로 골
    p.add(new THREE.CylinderGeometry(0.085, 0.095, 0.07, 18), shade(top, 0.9), 0, 0.57, 0);
    p.add(new THREE.CylinderGeometry(0.19, 0.19, 0.035, 20), shade(top, 0.82), 0, 0.3, 0);
    for (const a of [-0.5, -0.25, 0, 0.25, 0.5]) p.add(new THREE.BoxGeometry(0.012, 0.2, 0.01), shade(top, 0.86), Math.sin(a) * 0.17, 0.42, Math.cos(a) * 0.17, { ry: a, rx: -0.14 });
  } else if (L.ot === 4) {
    // 반팔 티: 둥근 목 + 가슴 무늬
    p.add(new THREE.TorusGeometry(0.07, 0.014, 8, 20), shade(top, 0.8), 0, 0.555, 0.02, { rx: Math.PI / 2 - 0.25 });
    p.add(new THREE.SphereGeometry(0.035, 14, 10), isLight(top) ? 0x4f6fd0 : 0xffffff, 0.07, 0.46, 0.168, { sz: 0.2 });
    lanyard();
  } else if (f) {
    p.add(new THREE.TorusGeometry(0.075, 0.018, 8, 20), collar, 0, 0.555, 0.02, { rx: Math.PI / 2 - 0.25 });      // 둥근 깃
    lanyard();
  } else {
    for (const sx of [-1, 1]) p.add(new THREE.ConeGeometry(0.035, 0.07, 3), collar, sx * 0.04, 0.545, 0.11, { rx: Math.PI / 2 + 0.5, rz: sx * 0.9 }); // 셔츠 깃
    p.add(new THREE.BoxGeometry(0.008, 0.2, 0.005), shade(top, 0.72), 0, 0.42, 0.18, { rx: -0.14 });             // 단추선
    for (const y of [0.48, 0.42, 0.36]) p.add(new THREE.SphereGeometry(0.007, 6, 4), 0xffffff, 0, y, 0.18 + (0.5 - y) * 0.14);
    lanyard();
  }
  // 하의
  if (L.bt === 1) {
    p.add(new THREE.CylinderGeometry(0.18, 0.25, 0.15, 24), bottom, 0, 0.22, 0);                                   // 치마
    p.add(new THREE.CylinderGeometry(0.186, 0.186, 0.02, 24), shade(bottom, 0.8), 0, 0.29, 0);
  } else {
    p.add(new THREE.CylinderGeometry(0.19, 0.17, 0.07, 20), bottom, 0, 0.265, 0);                                  // 바지 골반
    p.add(new THREE.CylinderGeometry(0.188, 0.188, 0.022, 20), 0x3a2a20, 0, 0.3, 0);                               // 벨트
    p.add(new THREE.BoxGeometry(0.03, 0.02, 0.01), 0xc9a45c, 0, 0.3, 0.188);
  }
  // 머리
  const H = 0.78;
  p.add(new THREE.SphereGeometry(0.25, 28, 24), SKIN, 0, H, 0, { sx: 1.04, sy: 0.96 });
  for (const sx of [-1, 1]) p.add(new THREE.SphereGeometry(0.05, 12, 10), SKIN, sx * 0.255, H - 0.02, 0, { sx: 0.5, sz: 0.8 });
  hair(p, L.hs, HAIR, f, H);
  // 얼굴: 큰 눈 + 반짝임, 눈썹, 볼터치, 웃는 입
  for (const sx of [-1, 1]) {
    p.add(new THREE.SphereGeometry(0.04, 16, 12), EYE, sx * 0.09, H, 0.225, { sx: 0.85, sy: 1.2, sz: 0.35 });
    p.add(new THREE.SphereGeometry(0.013, 8, 8), 0xffffff, sx * 0.09 + 0.012, H + 0.02, 0.238);
    p.add(new THREE.SphereGeometry(0.006, 6, 6), 0xffffff, sx * 0.09 - 0.012, H - 0.015, 0.238);
    const arc = Math.PI * 0.62;
    p.add(new THREE.TorusGeometry(0.02, 0.0035, 4, 12, arc), HAIR, sx * 0.09, H + 0.058, 0.233, { sx: 1.15, sy: 0.7, rz: (Math.PI - arc) / 2 - sx * 0.1 });
    p.add(new THREE.SphereGeometry(0.03, 14, 10), 0xf9b4c2, sx * 0.15, H - 0.06, 0.2, { sz: 0.25, ry: sx * 0.55 });
  }
  p.add(new THREE.TorusGeometry(0.022, 0.006, 6, 16, Math.PI), 0x8a3b3b, 0, H - 0.075, 0.236, { rz: Math.PI });
  return p.mesh(MAT);
}
// 다리 (엉덩이 관절 기준)
function buildLeg(gender, top, L) {
  const f = L.bt === 1; // 치마면 검은 스타킹 + 구두
  const p = new Part();
  const leg = f ? 0x2a2a31 : (BOTTOM_COLORS[L.bc] ?? bottomOf('m', top));
  p.add(new THREE.CylinderGeometry(0.065, 0.06, 0.13, 12), leg, 0, -0.065, 0);
  p.add(new THREE.CylinderGeometry(0.058, 0.055, 0.1, 12), leg, 0, -0.18, 0);
  p.add(new THREE.SphereGeometry(0.07, 14, 10), f ? 0x1d1d22 : 0xf5f5f2, 0, -0.235, 0.03, { sx: 0.9, sy: 0.55, sz: 1.35 });
  p.add(new THREE.CylinderGeometry(0.065, 0.065, 0.018, 14), f ? 0x111114 : 0x9aa0a8, 0, -0.26, 0.03, { sx: 0.95, sz: 1.4 });
  return p.mesh(MAT);
}
// 팔 (어깨 관절 기준)
function buildArm(gender, top, L) {
  const p = new Part();
  p.add(new THREE.SphereGeometry(0.05, 12, 10), top, 0, 0, 0);
  if (L.ot === 4) { // 반팔: 소매는 짧고 팔은 맨살
    p.add(new THREE.CylinderGeometry(0.05, 0.054, 0.09, 12), top, 0, -0.045, 0);
    p.add(new THREE.CylinderGeometry(0.036, 0.04, 0.16, 12), SKIN, 0, -0.16, 0);
  } else {
    p.add(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 12), top, 0, -0.11, 0);
    const cuff = L.ot === 1 ? 0xf4f4f2 : L.ot === 2 || L.ot === 3 ? shade(top, 0.82) : isLight(top) ? shade(top, 0.85) : 0xffffff;
    p.add(new THREE.CylinderGeometry(0.049, 0.049, 0.03, 12), cuff, 0, -0.215, 0); // 소맷부리
  }
  p.add(new THREE.SphereGeometry(0.048, 12, 10), SKIN, 0, -0.26, 0);
  return p.mesh(MAT);
}

// "일하는 중..." 풍선 (점 1~3개, 그림 세 장을 미리 만들어 돌려 씀)
let WORK_TEX = null;
function workTextures() {
  if (!WORK_TEX) WORK_TEX = ['.', '..', '...'].map((d) => labelTexture(`💻 일하는 중${d}`, { bg: 'rgba(79,140,255,0.92)', fg: '#fff', font: 700, size: 38 }));
  return WORK_TEX;
}

export class Avatar {
  constructor(name, color, gender = 'm', look = '') {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.gender = gender === 'f' ? 'f' : 'm';
    this.color = color;
    this.look = lookKey(parseLook(look, this.gender));
    this.build();

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.26, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025;
    this.root.add(shadow);

    this.name = name;
    this.label = makeSprite(name, { size: 40 }, 0.22);
    this.label.position.y = 1.25;
    this.root.add(this.label);
    this.bubble = null;
    this.bubbleUntil = 0;
    this.phase = 0;
    this.speed = 0;
    this.idle = Math.random() * 10;
    this.jy = 0; this.vy = 0; this.ground = 0;
    this.sitting = false; this.sitH = 0;
    this.boxing = false; this.punchAt = -9; this.punchSide = false;
    this.working = false; this.workSprite = null;
  }

  build() {
    this.body.clear();
    const g = this.gender, top = this.color, L = parseLook(this.look, g);
    const f = g === 'f';
    this.torso = buildBody(g, top, L);
    this.legL = buildLeg(g, top, L); this.legR = buildLeg(g, top, L);
    this.legL.position.set(-0.085, 0.25, 0); this.legR.position.set(0.085, 0.25, 0);
    this.armL = buildArm(g, top, L); this.armR = buildArm(g, top, L);
    this.armL.position.set(-0.18, 0.52, 0); this.armR.position.set(0.18, 0.52, 0);
    this.armL.rotation.z = -0.12; this.armR.rotation.z = 0.12;
    void f;
    // 결투용 칼 (오른손에, 평소엔 숨김)
    this.sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.36, 0.012), new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.2, metalness: 0.8, emissive: 0x223040 }));
    blade.position.y = -0.49; // 캐릭터 키에 맞춘 짧은 칼
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.045), new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.7 }));
    guard.position.y = -0.3;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.8 }));
    grip.position.y = -0.25;
    this.sword.add(blade, guard, grip);
    this.sword.visible = !!this.swordOn;
    this.armR.add(this.sword);
    this.body.scale.setScalar(SCALE);
    this.body.add(this.torso, this.legL, this.legR, this.armL, this.armR);
  }
  setSword(on) { this.swordOn = on; if (this.sword) this.sword.visible = on; }
  // 결투에서 지면 뒤로 쓰러짐
  knockout(on) { this.ko = on; this.koStart = null; if (!on) { this.body.rotation.x = 0; this.body.position.z = 0; } }
  applyKO(now) {
    if (!this.ko) return;
    if (this.koStart == null) this.koStart = now;
    const k = Math.min(1, (now - this.koStart) / 0.45);
    const e = 1 - Math.pow(1 - k, 3);
    this.body.rotation.x = -1.5 * e;
    this.body.position.z = -0.25 * e;
    this.body.position.y = 0.12 * Math.sin(k * Math.PI) * (1 - k) + 0.05 * e;
    this.armL.rotation.x = this.armR.rotation.x = -2.6 * e;
  }
  hurt(now) { this.hurtAt = now; }

  setLook(color, gender, look = '') {
    const g = gender === 'f' ? 'f' : 'm', lk = lookKey(parseLook(look, g));
    if (color === this.color && g === this.gender && lk === this.look) return;
    this.dispose(true);
    this.color = color; this.gender = g; this.look = lk;
    this.build();
  }
  setColor(color) { this.setLook(color, this.gender, this.look); }
  setName(name) {
    this.name = name;
    this.root.remove(this.label);
    this.label.material.map.dispose(); this.label.material.dispose();
    this.label = makeSprite(name, { size: 40 }, 0.22);
    this.label.position.y = 1.25;
    this.root.add(this.label);
  }

  say(text, now) {
    if (this.bubble) { this.root.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); }
    this.bubble = makeSprite(text, { bg: 'rgba(255,255,255,0.94)', fg: '#111', font: 500, size: 40, maxW: 520 }, 0.3);
    const lines = Math.max(1, Math.round(this.bubble.scale.y / 0.3));
    this.bubbleBase = 1.55 + this.bubble.scale.y / 2 - 0.1 * lines;
    this.bubble.position.y = this.bubbleBase;
    this.root.add(this.bubble);
    this.bubbleUntil = now + 6 + Math.min(text.length / 15, 6);
  }

  setSit(on, h = 0.42) { this.sitting = on; this.sitH = h; }
  setBoxing(on) { this.boxing = on; }
  setWorking(on) {
    if (on === this.working) return;
    this.working = on;
    if (on) {
      const t = workTextures()[2];
      this.workSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, depthWrite: false, transparent: true }));
      this.workSprite.scale.set(0.26 * t.aspect, 0.26, 1);
      this.workSprite.position.y = 1.5;
      this.workSprite.renderOrder = 10;
      this.workSprite.layers.set(1);
      this.root.add(this.workSprite);
    } else if (this.workSprite) {
      this.root.remove(this.workSprite); this.workSprite.material.dispose(); this.workSprite = null;
    }
  }
  punch(now) { this.punchAt = now; this.punchSide = !this.punchSide; }

  // 앉으면 몸이 올라가므로 이름표·풍선도 같이 올림
  liftLabels() {
    const lift = this.sitting ? Math.max(0, this.body.position.y) + 0.06 : 0;
    this.label.position.y = 1.25 + lift;
    if (this.workSprite) this.workSprite.position.y = 1.52 + lift;
    if (this.bubble) this.bubble.position.y = this.bubbleBase + lift;
  }

  // 점프: 위로 튀어 올랐다가 중력으로 내려옴 (약 0.6m, 0.7초)
  // ground: 발밑 높이 (바닥 0, 책상 위면 0.76 …). jy: 지금 발 높이
  jump() {
    if (this.sitting || this.jy > this.ground + 0.001) return false;
    this.vy = 4.7; // 약 0.9m — 책상 · 카운터 위로 올라갈 수 있음
    this.jy = this.ground + 0.0011;
    return true;
  }
  get airborne() { return this.jy > this.ground + 0.001 || this.vy > 0; }
  stepJump(dt) {
    if (this.jy > this.ground || this.vy > 0) {
      this.vy -= 12 * dt;
      this.jy += this.vy * dt;
      if (this.jy <= this.ground) { this.jy = this.ground; this.vy = 0; }
    } else { this.jy = this.ground; this.vy = 0; }
  }

  animate(dt, speed, now) {
    this.stepJump(dt);
    if (this.sitting) {
      // 앉은 자세: 다리는 앞으로, 손은 무릎 위
      this.legL.rotation.x = this.legR.rotation.x = -1.45;
      this.armL.rotation.x = this.armR.rotation.x = -0.55;
      this.idle += dt;
      if (this.working) {
        // 타자 치는 손
        this.armL.rotation.x = -1.05 + Math.sin(this.idle * 17) * 0.07;
        this.armR.rotation.x = -1.05 + Math.sin(this.idle * 17 + 1.7) * 0.07;
        this.armL.rotation.z = 0.15; this.armR.rotation.z = -0.15;
        if (this.workSprite) {
          const ts = workTextures(), t = ts[Math.floor(this.idle * 2) % 3];
          if (this.workSprite.material.map !== t.tex) { this.workSprite.material.map = t.tex; this.workSprite.scale.set(0.26 * t.aspect, 0.26, 1); }
        }
      }
      if (this.bubble && this.workSprite) this.workSprite.visible = false; else if (this.workSprite) this.workSprite.visible = true;
      this.liftLabels();
      this.body.position.y = this.sitH + 0.03 - 0.25 * SCALE + Math.sin(this.idle * 1.8) * 0.004;
      this.speed = 0;
      if (this.bubble && now > this.bubbleUntil) { this.root.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); this.bubble = null; }
      return;
    }
    this.speed += (speed - this.speed) * Math.min(1, dt * 10);
    const s = Math.min(this.speed / 4, 1.2);
    this.phase += dt * (4 + this.speed * 2.2);
    const swing = Math.sin(this.phase) * 0.75 * s;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
    this.armL.rotation.z = -0.12; this.armR.rotation.z = 0.12;
    if (this.jy > this.ground + 0.001) { // 공중에서는 다리를 살짝 굽히고 팔을 벌림
      const k = Math.min(1, (this.jy - this.ground) * 3);
      this.legL.rotation.x = -0.5 * k; this.legR.rotation.x = 0.25 * k;
      this.armL.rotation.z = -0.12 - 0.7 * k; this.armR.rotation.z = 0.12 + 0.7 * k;
    }
    if (this.boxing && this.swordOn) {
      // 칼싸움: 칼을 든 오른팔을 위에서 아래로 내려 벰
      const p = Math.max(0, 1 - (now - this.punchAt) / 0.18);
      this.armL.rotation.x = -0.9; this.armL.rotation.z = 0.35;
      this.armR.rotation.x = -1.0 - 1.4 * Math.sin(p * Math.PI) * (this.punchSide ? 1 : 0.8);
      this.armR.rotation.z = -0.15;
      this.body.rotation.y = -0.25 * p;
    } else if (this.boxing) {
      // 가드 자세, 펀치할 때 한쪽 팔을 쭉 뻗음
      const p = Math.max(0, 1 - (now - this.punchAt) / 0.16);
      this.armL.rotation.x = this.armR.rotation.x = -1.2;
      this.armL.rotation.z = 0.32; this.armR.rotation.z = -0.32;
      const arm = this.punchSide ? this.armR : this.armL;
      arm.rotation.x = -1.2 - 0.45 * p;
      arm.rotation.z *= 1 - p;
      this.body.rotation.y = (this.punchSide ? -1 : 1) * 0.18 * p;
    } else this.body.rotation.y = 0;
    // 맞으면 뒤로 휘청
    const hk = Math.max(0, 1 - (now - (this.hurtAt ?? -9)) / 0.22);
    this.body.rotation.x = -0.3 * hk;
    // 결투: 벨 때 앞으로 쑥 들어가고, 맞으면 뒤로 밀림
    const lp = this.boxing && this.swordOn ? Math.max(0, 1 - (now - this.punchAt) / 0.18) : 0;
    this.body.position.z = 0.2 * Math.sin(lp * Math.PI) - 0.14 * hk;
    // 서 있을 때 숨쉬기
    this.idle += dt;
    const breathe = Math.sin(this.idle * 1.8) * 0.006 * (1 - Math.min(s * 3, 1));
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.04 * Math.min(s, 1) + breathe;
    this.torso.scale.y = 1 + breathe * 0.5;
    this.applyKO(now);
    if (this.bubble && now > this.bubbleUntil) {
      this.root.remove(this.bubble);
      this.bubble.material.map.dispose(); this.bubble.material.dispose();
      this.bubble = null;
    }
    this.liftLabels();
  }

  dispose(bodyOnly = false) {
    for (const m of [this.torso, this.legL, this.legR, this.armL, this.armR]) m?.geometry.dispose();
    if (bodyOnly) return;
    this.root.traverse((o) => { if (o.material?.map) o.material.map.dispose(); });
  }
}

// 👾 업무 괴물: 서류 더미를 머리에 인 초록 덩어리 괴물 (결투 연습 상대). Avatar와 같은 방식으로 움직임
export class WorkMonster {
  constructor(name) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
    const skin = mat(0x6f8f4e), dark = mat(0x3d5229), paper = mat(0xf4f1e8), red = mat(0xd23a2a), yellow = mat(0xf2d04a), black = new THREE.MeshBasicMaterial({ color: 0x141414 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const m = (geo, mt, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o; };
    const S = new THREE.SphereGeometry(1, 20, 14);
    // 몸통 (울퉁불퉁한 덩어리)
    this.body.add(m(S, skin, 0, 0.55, 0, 0.42, 0.48, 0.36), m(S, skin, 0.1, 0.82, 0.02, 0.3, 0.26, 0.26), m(S, dark, 0, 0.42, 0.25, 0.22, 0.18, 0.1));
    // 화난 눈 (흰자 + 빨간 눈동자) · 찌푸린 눈썹
    for (const s of [-1, 1]) {
      this.body.add(m(S, white, s * 0.12, 0.78, 0.29, 0.085, 0.07, 0.04), m(S, mat(0xe0201a, { emissive: 0x600000 }), s * 0.12, 0.775, 0.32, 0.04, 0.04, 0.02));
      const brow = m(new THREE.BoxGeometry(0.16, 0.035, 0.03), black, s * 0.12, 0.865, 0.31); brow.rotation.z = s * 0.45; this.body.add(brow);
    }
    // 이빨 드러낸 입
    this.body.add(m(new THREE.BoxGeometry(0.26, 0.08, 0.04), black, 0, 0.6, 0.33));
    for (let i = 0; i < 4; i++) { const t = m(new THREE.ConeGeometry(0.025, 0.05, 4), white, -0.09 + i * 0.06, 0.625, 0.35); t.rotation.z = Math.PI; this.body.add(t); }
    // 머리 위 서류 더미 · 포스트잇
    for (let i = 0; i < 6; i++) { const p = m(new THREE.BoxGeometry(0.32, 0.025, 0.24), paper, (i % 2 ? 0.02 : -0.02), 1.04 + i * 0.03, 0); p.rotation.y = (i - 3) * 0.08; this.body.add(p); }
    for (const [x, z, c] of [[0.17, 0.05, yellow], [-0.16, -0.03, mat(0xf29ac0)]]) { const n = m(new THREE.BoxGeometry(0.08, 0.005, 0.08), c, x, 1.12, z); n.rotation.z = x > 0 ? -0.5 : 0.5; this.body.add(n); }
    // 짧은 다리
    for (const s of [-1, 1]) this.body.add(m(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 10), dark, s * 0.15, 0.1, 0));
    // 팔: 오른손에 커다란 '결재' 도장, 왼손에 서류
    const arm = (s) => { const g = new THREE.Group(); g.position.set(s * 0.42, 0.7, 0); g.add(m(new THREE.CapsuleGeometry(0.06, 0.28, 4, 8), skin, 0, -0.18, 0)); this.body.add(g); return g; };
    this.armL = arm(-1); this.armR = arm(1);
    this.armR.add(m(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), dark, 0, -0.42, 0), m(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 16), red, 0, -0.52, 0));
    this.armL.add(m(new THREE.BoxGeometry(0.2, 0.26, 0.02), paper, 0, -0.42, 0.04));
    this.root.add(m(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }), 0, 0.02, 0, 1, 1, 1));
    this.root.children[this.root.children.length - 1].rotation.x = -Math.PI / 2;
    this.name = name;
    this.label = makeSprite(name, { size: 40, bg: 'rgba(60,90,30,0.85)' }, 0.22);
    this.label.position.y = 1.42;
    this.root.add(this.label);
    this.punchAt = -9; this.hurtAt = -9; this.t = 0; this.jy = 0; this.ground = 0;
  }
  punch(now) { this.punchAt = now; }
  hurt(now) { this.hurtAt = now; }
  setBoxing() {} setSword() {} setName() {} say() {}
  animate(dt, speed, now) {
    this.t += dt;
    const p = Math.max(0, 1 - (now - this.punchAt) / 0.2), hk = Math.max(0, 1 - (now - this.hurtAt) / 0.22);
    this.armR.rotation.x = -0.6 - 1.6 * Math.sin(p * Math.PI);  // 도장 쾅!
    this.armL.rotation.x = -0.4 + Math.sin(this.t * 6) * 0.15;
    this.armL.rotation.z = -0.3; this.armR.rotation.z = 0.3;
    this.body.position.y = Math.abs(Math.sin(this.t * 5)) * 0.04;  // 씩씩대며 들썩
    this.body.rotation.x = -0.3 * hk;
    this.body.position.z = 0.22 * Math.sin(p * Math.PI) - 0.16 * hk; // 내리찍을 때 앞으로, 맞으면 뒤로
    this.body.scale.setScalar(1 + 0.03 * Math.sin(this.t * 10));
    if (this.ko) { // 쓰러짐: 뒤로 벌러덩
      if (this.koStart == null) this.koStart = now;
      const k = Math.min(1, (now - this.koStart) / 0.5), e = 1 - Math.pow(1 - k, 3);
      this.body.rotation.x = -1.5 * e; this.body.position.z = -0.3 * e; this.body.position.y = 0.04 * e;
      this.body.scale.setScalar(1);
      this.armR.rotation.x = this.armL.rotation.x = -2.8 * e;
    }
  }
  knockout(on) { this.ko = on; this.koStart = null; if (!on) { this.body.rotation.x = 0; this.body.position.z = 0; } }
}
