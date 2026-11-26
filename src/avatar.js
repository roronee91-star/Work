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
export const HAIR_STYLES = ['짧은 머리', '긴 생머리', '단발', '묶은 머리', '똥머리', '뽀글 파마', '땋은 머리', '웨이브', '댄디컷', '가르마펌', '리젠트', '투블럭', '높은 포니테일', '양갈래', '허쉬컷']; // 8~14: 11-26 추가 (look 첫 글자는 36진수: 8 9 a b c d e)
export const HAIR_COLORS = [0x3b2516, 0x17130f, 0x6b3f22, 0xa8743f, 0xe3c37c, 0xa9aab2, 0xe58fb0, 0x5a78d6];
export const OUTFITS = ['셔츠', '정장', '후드티', '니트', '반팔 티'];
export const BOTTOMS = ['바지', '치마'];
export const BOTTOM_COLORS = [null, 0x2c3446, 0x1e1e22, 0xc9b59a, 0x7b8089, 0x4a6fa8, 0x6a4a34]; // null = 상의에 맞춰 자동
export function parseLook(look, gender) {
  const f = gender === 'f', d = String(look || '');
  const n = (i, max, def) => { const v = parseInt(d[i], 36); return Number.isInteger(v) && v >= 0 && v < max ? v : def; };
  return { hs: n(0, HAIR_STYLES.length, f ? 1 : 0), hc: n(1, HAIR_COLORS.length, 0), ot: n(2, OUTFITS.length, 0), bt: n(3, BOTTOMS.length, f ? 1 : 0), bc: n(4, BOTTOM_COLORS.length, 0) };
}
export const lookKey = (L) => `${L.hs.toString(36)}${L.hc}${L.ot}${L.bt}${L.bc}`;

function shade(hex, k) { return new THREE.Color(hex).multiplyScalar(k); }
function isLight(hex) { const c = new THREE.Color(hex); return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.6; }
const bottomOf = (g, top) => g === 'f' ? (isLight(top) ? 0x39415a : 0xc9b59a) : (isLight(top) ? 0x353c4a : 0xb9a888);

// 머리 모양
function hair(p, hs, HAIR, f, H) {
  const curly = hs === 5;
  const fade = new THREE.Color(HAIR).multiplyScalar(0.62).getHex(); // 투블럭 옆머리 (짧게 민 부분)
  p.add(new THREE.SphereGeometry(0.272, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), hs === 11 ? fade : HAIR, 0, H, -0.01, { rx: -0.42 });
  for (const sx of [-1, 1]) p.add(new THREE.SphereGeometry(0.09, 12, 10), hs === 11 ? fade : HAIR, sx * 0.21, H + 0.04, 0.05, { sx: 0.55, sy: hs >= 8 && hs <= 11 ? 0.9 : 1.15, sz: 0.9 });
  if (hs < 8 || hs >= 12 && hs !== 14) for (const [x, y, rz] of [[-0.1, 0.118, -0.35], [0, 0.128, 0], [0.1, 0.118, 0.35]]) p.add(new THREE.SphereGeometry(0.08, 14, 10), HAIR, x, H + y, 0.19, { sx: 0.95, sy: 0.42, sz: 0.5, rz });
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
  } else if (hs === 6) {
    // 땋은 머리: 양쪽 어깨로 내려오는 두 갈래, 마디마디 볼록 + 끝에 머리끈
    p.add(new THREE.SphereGeometry(0.265, 24, 18), HAIR, 0, H + 0.0, -0.06, { sx: 1.02, sy: 0.98, sz: 0.86 });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const y = H - 0.08 - i * 0.065, x = sx * (0.2 - i * 0.012), z = -0.02 + i * 0.03;
        p.add(new THREE.SphereGeometry(0.045 - i * 0.003, 10, 8), HAIR, x + sx * 0.012 * (i % 2 ? 1 : -1), y, z, { sy: 1.25, rz: sx * (i % 2 ? 0.5 : -0.5) });
      }
      p.add(new THREE.SphereGeometry(0.022, 8, 6), 0xf28bb0, sx * 0.145, H - 0.4, 0.13);
      p.add(new THREE.ConeGeometry(0.03, 0.06, 8), HAIR, sx * 0.14, H - 0.445, 0.14, { rx: Math.PI });
    }
  } else if (hs === 7) {
    // 웨이브: 긴 머리 끝이 S자로 부드럽게 굽이침
    p.add(new THREE.SphereGeometry(0.275, 24, 18), HAIR, 0, H - 0.07, -0.08, { sx: 1.05, sy: 1.2, sz: 0.82 });
    for (let i = 0; i < 3; i++) {
      const y = H - 0.2 - i * 0.085, sw = (i % 2 ? 1 : -1) * 0.025;
      p.add(new THREE.SphereGeometry(0.2 - i * 0.02, 18, 12), HAIR, sw, y, -0.12, { sx: 1.25, sy: 0.5, sz: 0.85 });
    }
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      p.add(new THREE.SphereGeometry(0.07, 12, 10), HAIR, sx * (0.215 + (i % 2 ? 0.03 : 0)), H - 0.1 - i * 0.09, 0.02 - i * 0.015, { sx: 0.75, sy: 1.25 });
    }
  } else if (hs === 8) {
    // 댄디컷 · 쉼표머리: 둥근 버섯 모양 + 이마를 덮는 앞머리 + 한쪽 끝을 쉼표처럼 말아 넘김
    p.add(new THREE.SphereGeometry(0.275, 24, 18), HAIR, 0, H + 0.05, -0.03, { sx: 1.04, sy: 0.92, sz: 0.95 });
    for (const [x, y] of [[-0.14, 0.1], [-0.05, 0.095], [0.04, 0.1]]) p.add(new THREE.SphereGeometry(0.075, 14, 10), HAIR, x, H + y, 0.2, { sx: 0.95, sy: 0.5, sz: 0.5, rz: x * 1.2 });
    p.add(new THREE.TorusGeometry(0.034, 0.017, 8, 14, Math.PI * 1.4), HAIR, 0.12, H + 0.075, 0.215, { rz: -0.6 });     // 쉼표
  } else if (hs === 9) {
    // 가르마펌 6:4: 왼쪽에서 가르마를 타고 오른쪽으로 크게 넘긴 볼륨 + 이마가 살짝 보임
    p.add(new THREE.SphereGeometry(0.278, 24, 18), HAIR, 0, H + 0.06, -0.03, { sx: 1.05, sy: 0.95, sz: 0.95 });
    p.add(new THREE.SphereGeometry(0.13, 16, 12), HAIR, 0.06, H + 0.17, 0.15, { sx: 1.45, sy: 0.6, sz: 0.75, rz: -0.28 });      // 넘긴 앞머리
    p.add(new THREE.SphereGeometry(0.08, 12, 10), HAIR, 0.19, H + 0.06, 0.15, { sx: 0.7, sy: 1.0, sz: 0.8 });                   // 오른쪽으로 흘러내린 끝
    p.add(new THREE.SphereGeometry(0.07, 12, 10), HAIR, -0.15, H + 0.2, 0.12, { sx: 0.9, sy: 0.55, sz: 0.7, rz: 0.5 });         // 가르마 왼쪽
  } else if (hs === 10) {
    // 리젠트 · 올백: 앞머리를 위로 세워 뒤로 넘김 (이마가 다 보임)
    p.add(new THREE.SphereGeometry(0.27, 24, 18), HAIR, 0, H + 0.04, -0.05, { sx: 1.02, sy: 0.95, sz: 0.92 });
    p.add(new THREE.SphereGeometry(0.14, 18, 12), HAIR, 0, H + 0.2, 0.13, { sx: 1.5, sy: 0.62, sz: 0.95, rx: -0.55 });           // 세운 앞머리 (이마 위로 둥글게)
    for (const sx of [-1, 1]) p.add(new THREE.SphereGeometry(0.06, 10, 8), HAIR, sx * 0.17, H + 0.16, 0.12, { sx: 0.8, sy: 0.5, sz: 1.2, ry: sx * 0.5 }); // 옆으로 넘긴 결
  } else if (hs === 11) {
    // 투블럭 · 버즈컷: 옆은 짧게 민 짙은 색, 위만 짧게 남김 + 짧은 앞머리 끝
    p.add(new THREE.SphereGeometry(0.262, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), HAIR, 0, H + 0.035, -0.015, { sx: 1.0, sy: 0.95, sz: 1.0, rx: -0.2 });
    for (const x of [-0.07, 0, 0.07]) p.add(new THREE.SphereGeometry(0.045, 10, 8), HAIR, x, H + 0.17, 0.19, { sx: 1.1, sy: 0.45, sz: 0.6, rx: -0.4 }); // 짧은 앞머리 끝
  } else if (hs === 12) {
    // 높은 포니테일: 정수리 뒤에서 높게 묶어 뒤로 흘러내림
    p.add(new THREE.SphereGeometry(0.26, 24, 18), HAIR, 0, H + 0.02, -0.05, { sx: 1.0, sy: 0.95, sz: 0.88 });
    p.add(new THREE.TorusGeometry(0.04, 0.015, 6, 14), 0xf28bb0, 0, H + 0.22, -0.2, { rx: 0.9 });                              // 머리끈
    for (let i = 0; i <= 12; i++) { const t = i / 12, y = 0.25 - t * 0.52, z = -0.25 - Math.sin(Math.min(1, t * 1.6) * Math.PI / 2) * 0.12 + t * t * 0.07; p.add(new THREE.SphereGeometry(0.078 - t * 0.035, 12, 10), HAIR, 0, H + y, z, { sx: 0.95, sy: 1.25, sz: 0.85 }); } // 이어진 꼬리
  } else if (hs === 13) {
    // 양갈래: 양쪽 귀 위에서 묶어 바깥으로 살짝 뻗친 두 갈래
    p.add(new THREE.SphereGeometry(0.262, 24, 18), HAIR, 0, H + 0.02, -0.05, { sx: 1.0, sy: 0.96, sz: 0.88 });
    for (const sx of [-1, 1]) {
      p.add(new THREE.TorusGeometry(0.032, 0.013, 6, 12), 0xf28bb0, sx * 0.25, H + 0.06, -0.08, { ry: Math.PI / 2, rx: sx * 0.6 });
      for (let i = 0; i <= 8; i++) { const t = i / 8; p.add(new THREE.SphereGeometry(0.068 - t * 0.03, 12, 10), HAIR, sx * (0.29 + Math.sin(t * Math.PI) * 0.045), H + 0.02 - t * 0.32, -0.08, { sx: 0.9, sy: 1.25 }); } // 이어진 갈래
    }
  } else if (hs === 14) {
    // 허쉬컷: 층을 많이 낸 어깨 길이 + 끝이 바깥으로 뻗침 + 가볍게 내린 시스루 앞머리
    p.add(new THREE.SphereGeometry(0.275, 24, 18), HAIR, 0, H - 0.04, -0.08, { sx: 1.06, sy: 1.08, sz: 0.84 });
    for (let i = 0; i < 5; i++) { const x = -0.14 + i * 0.07; p.add(new THREE.SphereGeometry(0.05, 10, 8), HAIR, x, H + 0.11 - Math.abs(x) * 0.25, 0.205, { sx: 0.8, sy: 0.7, sz: 0.45, rz: x * 2 }); }
    for (const sx of [-1, 1]) {
      p.add(new THREE.SphereGeometry(0.08, 12, 10), HAIR, sx * 0.22, H - 0.04, 0.05, { sx: 0.6, sy: 1.3, sz: 0.8 });          // 옆 1단
      p.add(new THREE.SphereGeometry(0.075, 12, 10), HAIR, sx * 0.25, H - 0.17, 0.0, { sx: 0.7, sy: 1.1, sz: 0.85 });         // 2단
      p.add(new THREE.SphereGeometry(0.06, 12, 10), HAIR, sx * 0.3, H - 0.27, -0.03, { sx: 0.95, sy: 0.6, sz: 0.85, rz: sx * 0.6 }); // 바깥으로 뻗친 끝
    }
    p.add(new THREE.SphereGeometry(0.2, 18, 12), HAIR, 0, H - 0.22, -0.12, { sx: 1.35, sy: 0.55, sz: 0.85 });                  // 뒷머리 끝 층
  }
}

// 머리 + 몸통 (굳은 부분) — 교회 메타버스 캐릭터와 같은 비율, 옷만 회사원 차림
function buildBody(gender, top, L, happy = false) {
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
  // 얼굴: 큰 눈 + 반짝임, 눈썹, 볼터치, 웃는 입 (happy = 💃 춤출 때: ^ ^ 감은 눈 + 활짝 벌린 입)
  for (const sx of [-1, 1]) {
    if (happy) p.add(new THREE.TorusGeometry(0.026, 0.0065, 6, 14, Math.PI), EYE, sx * 0.09, H - 0.01, 0.236, { sx: 1.15 });
    else {
      p.add(new THREE.SphereGeometry(0.04, 16, 12), EYE, sx * 0.09, H, 0.225, { sx: 0.85, sy: 1.2, sz: 0.35 });
      p.add(new THREE.SphereGeometry(0.013, 8, 8), 0xffffff, sx * 0.09 + 0.012, H + 0.02, 0.238);
      p.add(new THREE.SphereGeometry(0.006, 6, 6), 0xffffff, sx * 0.09 - 0.012, H - 0.015, 0.238);
    }
    const arc = Math.PI * 0.62;
    p.add(new THREE.TorusGeometry(0.02, 0.0035, 4, 12, arc), HAIR, sx * 0.09, H + 0.058, 0.233, { sx: 1.15, sy: 0.7, rz: (Math.PI - arc) / 2 - sx * 0.1 });
    p.add(new THREE.SphereGeometry(0.03, 14, 10), 0xf9b4c2, sx * 0.15, H - 0.06, 0.2, { sz: 0.25, ry: sx * 0.55 });
  }
  if (happy) {
    p.add(new THREE.SphereGeometry(0.046, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x7a1f30, 0, H - 0.06, 0.226, { sx: 1.05, sy: 0.95, sz: 0.4, rx: -0.25 });
    p.add(new THREE.BoxGeometry(0.074, 0.013, 0.012), 0xffffff, 0, H - 0.064, 0.243, { rx: -0.25 });
    p.add(new THREE.SphereGeometry(0.022, 12, 8), 0xff8c9a, 0, H - 0.088, 0.24, { sx: 1.25, sy: 0.6, sz: 0.45 });
  } else p.add(new THREE.TorusGeometry(0.022, 0.006, 6, 16, Math.PI), 0x8a3b3b, 0, H - 0.075, 0.236, { rz: Math.PI });
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

// ---------- 👜 꾸미기 아이템 (상점에서 사서 착용) ----------
// 몸(body) 기준 좌표: 머리 가운데 (0, 0.78, 0), 반지름 약 0.25, 얼굴은 +z 쪽
const AM = {
  black: new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.35, metalness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xe3b43f, roughness: 0.25, metalness: 0.85, emissive: 0x3a2600 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fd4ff, roughness: 0.05, transparent: true, opacity: 0.35 }),
  shade: new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.15, metalness: 0.4 }),
  pink: new THREE.MeshStandardMaterial({ color: 0xff8fb8, roughness: 0.5 }),
  pinkIn: new THREE.MeshStandardMaterial({ color: 0xffc7da, roughness: 0.6 }),
  red: new THREE.MeshStandardMaterial({ color: 0xd11f2d, roughness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.7 }),
  ruby: new THREE.MeshStandardMaterial({ color: 0xe0103a, roughness: 0.1, metalness: 0.3, emissive: 0x400010 }),
  sapphire: new THREE.MeshStandardMaterial({ color: 0x2a5cff, roughness: 0.1, metalness: 0.3, emissive: 0x081a50 }),
  diamond: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.2) }),
  halo: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 0.9) }),
  feather: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }),
  bfly: new THREE.MeshStandardMaterial({ color: 0x8fd3ff, roughness: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: 0x1a3a66 }),
  bfly2: new THREE.MeshStandardMaterial({ color: 0xff9ad5, roughness: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: 0x4a1a3a }),
  bat: new THREE.MeshStandardMaterial({ color: 0x3a1f4a, roughness: 0.6, side: THREE.DoubleSide }),
  fur: new THREE.MeshStandardMaterial({ color: 0xf1e6d6, roughness: 1, flatShading: true }),
  furBrown: new THREE.MeshStandardMaterial({ color: 0x8a6046, roughness: 1, flatShading: true }),
  tweed: new THREE.MeshStandardMaterial({ color: 0xf2c6d0, roughness: 0.95 }),
  tweedTrim: new THREE.MeshStandardMaterial({ color: 0x2a2230, roughness: 0.8 }),
  velvet: new THREE.MeshStandardMaterial({ color: 0x9e1530, roughness: 0.85, side: THREE.DoubleSide }),
  dress: new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.3, metalness: 0.35, emissive: 0x2a1a08 }),
  cashmere: new THREE.MeshStandardMaterial({ color: 0xc9a07a, roughness: 0.95 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.5 }),
  leatherBlack: new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.35, metalness: 0.1 }),
  tan: new THREE.MeshStandardMaterial({ color: 0xd8b48a, roughness: 0.55 }),
  champagne: new THREE.MeshStandardMaterial({ color: 0xf0d9a8, roughness: 0.2, metalness: 0.7, emissive: 0x2a1e08 }),
  // 👜 부티크 2차 (11-25)
  nylon: new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.28, metalness: 0.25 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.2, metalness: 0.9 }),
  knitOat: new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 1 }),
  knitNavy: new THREE.MeshStandardMaterial({ color: 0x1f2a4a, roughness: 0.95 }),
  silk: new THREE.MeshStandardMaterial({ color: 0xb3122e, roughness: 0.22, metalness: 0.15, side: THREE.DoubleSide }),
  lbd: new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.6, side: THREE.DoubleSide }),
  pearl: new THREE.MeshStandardMaterial({ color: 0xfbf6ee, roughness: 0.15, metalness: 0.1, emissive: 0x1a1814 }),
  navy: new THREE.MeshStandardMaterial({ color: 0x1c2747, roughness: 0.7 }),
  tux: new THREE.MeshStandardMaterial({ color: 0x121216, roughness: 0.6 }),
  satin: new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.15, metalness: 0.3 }),
  shirtW: new THREE.MeshStandardMaterial({ color: 0xf7f7f4, roughness: 0.7 }),
  tieRed: new THREE.MeshStandardMaterial({ color: 0x8e1b2c, roughness: 0.5 }),
  // 🎄 크리스마스 출석 한정판
  antler: new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 }),
  felt: new THREE.MeshStandardMaterial({ color: 0xa8713f, roughness: 1 }),
  earPink: new THREE.MeshStandardMaterial({ color: 0xf2b3b8, roughness: 0.9 }),
  holly: new THREE.MeshStandardMaterial({ color: 0x1f7a3e, roughness: 0.5 }),
  berry: new THREE.MeshStandardMaterial({ color: 0xe0142a, roughness: 0.25, emissive: 0x300006 }),
  knitR: new THREE.MeshStandardMaterial({ color: 0xc41e2e, roughness: 0.95 }),
  knitG: new THREE.MeshStandardMaterial({ color: 0x1d6b3c, roughness: 0.95 }),
  knitW: new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: 0.95 }),
  santa: new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.75, side: THREE.DoubleSide }),
  snowFur: new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 1, flatShading: true }),
  gloss: new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.18, metalness: 0.35 }),
  giftG: new THREE.MeshStandardMaterial({ color: 0x1f8a4c, roughness: 0.4 }),
  giftB: new THREE.MeshStandardMaterial({ color: 0x2f6fd8, roughness: 0.4 }),
  ice: new THREE.MeshStandardMaterial({ color: 0xd8f1ff, roughness: 0.08, metalness: 0.35, emissive: 0x2f78c8, emissiveIntensity: 0.55, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
  star: new THREE.MeshStandardMaterial({ color: 0xffd447, roughness: 0.22, metalness: 0.65, emissive: 0xc88a00, emissiveIntensity: 0.8 }),
  // ----- 🕴 남성 옷 (11-26 '남자 옷이 별로 없다') -----
  camel: new THREE.MeshStandardMaterial({ color: 0xc19a6b, roughness: 0.85 }),
  camelDk: new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 }),
  charcoal: new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.9 }),
  rider: new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.32, metalness: 0.15 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xd8dbe0, roughness: 0.25, metalness: 0.9 }),
  varsity: new THREE.MeshStandardMaterial({ color: 0x1d2a52, roughness: 0.8 }),
  varsityW: new THREE.MeshStandardMaterial({ color: 0xf1e9d6, roughness: 0.7 }),
  varsityR: new THREE.MeshStandardMaterial({ color: 0xc23a3a, roughness: 0.7 }),
  denim: new THREE.MeshStandardMaterial({ color: 0x5f86b5, roughness: 0.95 }),
  denimDk: new THREE.MeshStandardMaterial({ color: 0x3f5f8a, roughness: 0.95 }),
  puffer: new THREE.MeshStandardMaterial({ color: 0x1e1f24, roughness: 0.45, metalness: 0.05 }),
  capBlack: new THREE.MeshStandardMaterial({ color: 0x202024, roughness: 0.8 }),
  beanie: new THREE.MeshStandardMaterial({ color: 0x9a9ca3, roughness: 1 }),
  tieNavy: new THREE.MeshStandardMaterial({ color: 0x1c2b5a, roughness: 0.45 }),
  tieStripe: new THREE.MeshStandardMaterial({ color: 0xd7b35a, roughness: 0.4 }),
  brief: new THREE.MeshStandardMaterial({ color: 0x5a3520, roughness: 0.45 }),
};
// 🛴 킥보드 (부티크에서 삼, 발밑에 붙음). 색: 기본 블랙 · 민트 · 크롬 골드
export const KICKS = {
  kickblack: { deck: 0x1d1f24, stem: 0x2b2e35, trim: 0x8b929c, grip: 0x111111 },
  kickmint: { deck: 0x7fd8c4, stem: 0xf4f6f8, trim: 0xf4f6f8, grip: 0x2a6b5e },
  kickgold: { deck: 0x1a1a1e, stem: 0xe9c46a, trim: 0xe9c46a, grip: 0x3a2a12, gold: true },
};
export function makeKick(id) {
  const c = KICKS[id] || KICKS.kickblack, g = new THREE.Group(), wheels = [];
  const mat = (color, metal = 0.3, rough = 0.4) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
  const deck = mat(c.deck, 0.2, 0.5), stem = mat(c.stem, c.gold ? 0.9 : 0.6, c.gold ? 0.2 : 0.35), trim = mat(c.trim, 0.7, 0.3), grip = mat(c.grip, 0, 0.8), tire = mat(0x15151a, 0, 0.8);
  const box = (w, h, d, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  box(0.13, 0.03, 0.56, deck, 0, 0.085, 0.0);                     // 발판
  box(0.135, 0.008, 0.5, grip, 0, 0.102, -0.01);                  // 미끄럼 방지 테이프
  box(0.006, 0.026, 0.56, trim, 0.068, 0.085, 0); box(0.006, 0.026, 0.56, trim, -0.068, 0.085, 0);
  box(0.05, 0.02, 0.12, deck, 0, 0.1, -0.31, -0.25);              // 뒤 브레이크 덮개
  for (const z of [0.31, -0.29]) {                                // 바퀴
    const w = new THREE.Group(); w.position.set(0, 0.06, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.045, 18), tire); t.rotation.z = Math.PI / 2; w.add(t);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), trim); h.rotation.z = Math.PI / 2; w.add(h);
    g.add(w); wheels.push(w);
  }
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 10), stem); st.position.set(0, 0.3, 0.27); st.rotation.x = -0.15; g.add(st); // 손잡이 기둥
  box(0.03, 0.12, 0.05, stem, 0, 0.11, 0.31);                      // 앞바퀴 포크
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 10), stem); bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.5, 0.24); g.add(bar);
  for (const e of [-1, 1]) { const gp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 10), grip); gp.rotation.z = Math.PI / 2; gp.position.set(e * 0.16, 0.5, 0.24); g.add(gp); }
  if (c.gold) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c0 })); l.position.set(0, 0.42, 0.29); g.add(l); } // 골드는 앞 라이트
  g.userData.wheels = wheels;
  return g;
}

// 정장 앞: 흰 셔츠 V + 양쪽 라펠 (수트 · 턱시도)
function suitFront(add, lapel) {
  add(new THREE.BoxGeometry(0.1, 0.16, 0.01), AM.shirtW, 0, 0.475, 0.208, -0.12, 0, 0);
  for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.21, 0.014), lapel, e * 0.05, 0.455, 0.215, -0.12, 0, e * 0.42);
}
// 새 옷 몸통: 기본 상의(사원증 · 후드 주머니 등)가 비치지 않게 한 치수 크게 + 어깨 덮개. top = 위쪽 반지름, h = 높이(아래로)
function shell(add, mat, h = 0.3) { // 앞뒤로 조금 더 두껍게(납작한 주머니 · 무늬 모서리까지 덮음)
  add(new THREE.CylinderGeometry(0.178, 0.178 + h * 0.113, h, 24), mat, 0, 0.56 - h / 2, 0, 0, 0, 0, 1, 1, 1.1);
  add(new THREE.SphereGeometry(0.178, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat, 0, 0.555, 0, 0, 0, 0, 1, 0.3, 1.1);
}
// 두 점을 잇는 막대 (사슴뿔 · 눈꽃 가지)
function rod(g, a, b, r, mat, r2 = r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, d.length(), 8), mat);
  m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m); return m;
}
function starGeo(R, r, depth) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r : R; i ? sh.lineTo(Math.cos(a) * q, Math.sin(a) * q) : sh.moveTo(Math.cos(a) * q, Math.sin(a) * q); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.5, bevelSize: R * 0.08, bevelSegments: 2 });
  geo.center(); return geo;
}
// 눈꽃 (XY 평면, 가운데가 0,0)
function snowflake(g, cx, cy, R, mat, tip) {
  const f = new THREE.Group(); f.position.set(cx, cy, 0); g.add(f);
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3, dx = Math.cos(a), dy = Math.sin(a);
    rod(f, [0, 0, 0], [dx * R, dy * R, 0], R * 0.055, mat, R * 0.035);
    for (const t of [0.45, 0.72]) for (const e of [-1, 1]) { const b = a + e * 0.75, L = R * (t < 0.6 ? 0.34 : 0.22); rod(f, [dx * R * t, dy * R * t, 0], [dx * R * t + Math.cos(b) * L, dy * R * t + Math.sin(b) * L, 0], R * 0.035, mat, R * 0.025); }
    if (tip) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(R * 0.07, 0), tip); s.position.set(dx * R * 1.04, dy * R * 1.04, 0); f.add(s); }
  }
  const c = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.16, R * 0.16, R * 0.06, 6), mat); c.rotation.x = Math.PI / 2; f.add(c);
  return f;
}
const flower = [0xff6b8b, 0xffd23f, 0xffffff, 0xb784ff, 0xff9a3d].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
const H0 = 0.78;
function wingShape(w, h, round) { // 날개 한쪽 (x+ 쪽으로 펼침)
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  if (round) { sh.bezierCurveTo(w * 0.3, h * 0.9, w * 1.1, h * 1.1, w, h * 0.35); sh.bezierCurveTo(w * 1.05, -h * 0.4, w * 0.4, -h * 0.6, 0, -0.02); }
  else { sh.bezierCurveTo(w * 0.2, h * 0.7, w * 0.8, h, w, h * 0.55); for (let i = 0; i < 4; i++) sh.quadraticCurveTo(w * (0.9 - i * 0.22), h * (0.3 - i * 0.12), w * (0.78 - i * 0.22), h * (0.18 - i * 0.14)); sh.lineTo(0, -0.02); }
  return new THREE.ShapeGeometry(sh, 16);
}
export const ACC_SLOTS = { face: '얼굴', head: '머리', top: '머리 위', back: '등', body: '옷', neck: '목', bag: '가방', feet: '신발', ride: '탈것' };
export function makeAcc(id) {
  const g = new THREE.Group(); g.userData.id = id;
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); g.add(m); return m; };
  const band = (mat) => add(new THREE.TorusGeometry(0.262, 0.014, 6, 32, Math.PI), mat, 0, H0 + 0.02, 0.02, 0, Math.PI / 2, 0, 1, 1.08, 1);
  switch (id) {
    case 'glasses': // 동그란 금테 안경
      // 테가 얼굴 속에 반쯤 묻히던 것 → 얼굴 앞으로 꺼내고 바깥쪽을 얼굴 곡선 따라 살짝 뒤로
      for (const e of [-1, 1]) {
        add(new THREE.TorusGeometry(0.052, 0.008, 8, 24), AM.gold, e * 0.09, H0, 0.252, 0, e * 0.4, 0);
        add(new THREE.CircleGeometry(0.05, 20), AM.glass, e * 0.09, H0, 0.252, 0, e * 0.4, 0);
        add(new THREE.CylinderGeometry(0.005, 0.005, 0.22, 6), AM.gold, e * 0.215, H0 + 0.01, 0.11, Math.PI / 2, 0, 0);
      }
      add(new THREE.TorusGeometry(0.026, 0.006, 6, 12, Math.PI), AM.gold, 0, H0 + 0.005, 0.262);
      break;
    case 'sunglasses': // 까만 선글라스
      // 알이 얼굴 속에 묻혀 안 보이던 것 → 얼굴 앞으로 꺼내고, 얼굴 곡선을 따라 바깥쪽을 살짝 뒤로 돌림
      for (const e of [-1, 1]) {
        add(new THREE.SphereGeometry(0.062, 18, 12), AM.shade, e * 0.092, H0 + 0.003, 0.25, 0, e * 0.4, 0, 1.15, 0.9, 0.28);
        add(new THREE.TorusGeometry(0.062, 0.007, 6, 24), AM.black, e * 0.092, H0 + 0.003, 0.25, 0, e * 0.4, 0, 1.15, 0.9, 1);   // 테
        add(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), AM.black, e * 0.225, H0 + 0.015, 0.11, Math.PI / 2, 0, 0);             // 다리
      }
      add(new THREE.BoxGeometry(0.05, 0.012, 0.012), AM.black, 0, H0 + 0.03, 0.268);
      break;
    case 'ribbon': // 큰 리본 머리띠
      band(AM.pink);
      for (const e of [-1, 1]) add(new THREE.ConeGeometry(0.075, 0.13, 4), AM.pink, 0.12 + e * 0.07, H0 + 0.25, 0.04, 0, 0, e * Math.PI / 2);
      add(new THREE.SphereGeometry(0.03, 10, 8), AM.pink, 0.12, H0 + 0.25, 0.05);
      break;
    case 'catears': // 고양이 귀 머리띠
      band(AM.black);
      for (const e of [-1, 1]) { add(new THREE.ConeGeometry(0.075, 0.15, 4), AM.black, e * 0.15, H0 + 0.26, 0.0, 0, Math.PI / 4, e * -0.35); add(new THREE.ConeGeometry(0.045, 0.1, 4), AM.pinkIn, e * 0.15, H0 + 0.25, 0.03, 0, Math.PI / 4, e * -0.35); }
      break;
    case 'santa': { // 산타 모자
      // 빨간 둥근 몸통이 흰 테 안을 꽉 채워서 뒤에서 봐도 머리카락이 비치지 않게 (똥머리 · 뽀글 파마까지 덮음)
      const n = g.children.length;
      // 둥근 몸통과 뾰족한 끝을 한 덩어리로(이음새 없이): 아래는 둥글고 위로 갈수록 가늘어지며 뒤로 휘어짐
      const HH = 0.56, prof = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24; prof.push(new THREE.Vector2(0.29 * Math.pow(Math.max(0, 1 - Math.pow(t, 1.5)), 0.75), t * HH)); }
      const geo = new THREE.LatheGeometry(prof, 32), pos = geo.attributes.position;
      const bend = (y) => { const k = y / HH; return [-0.3 * k * k * k, y - 0.14 * k * k * k]; }; // [뒤로, 아래로]
      for (let i = 0; i < pos.count; i++) { const [dz, ny] = bend(pos.getY(i)); pos.setZ(i, pos.getZ(i) + dz); pos.setY(i, ny); }
      geo.computeVertexNormals();
      add(geo, AM.red, 0, H0 + 0.12, -0.02);
      add(new THREE.CircleGeometry(0.29, 28), AM.red, 0, H0 + 0.121, -0.02, Math.PI / 2, 0, 0);       // 밑면(아래에서 봐도 막힘)
      add(new THREE.TorusGeometry(0.275, 0.055, 10, 32), AM.white, 0, H0 + 0.13, -0.02, Math.PI / 2, 0, 0);
      const [tz, ty] = bend(HH);
      add(new THREE.SphereGeometry(0.062, 14, 10), AM.white, 0, H0 + 0.12 + ty, -0.02 + tz);             // 방울
      const tilt = new THREE.Group(); tilt.position.set(0, H0 + 0.13, 0); tilt.rotation.x = -0.14; // 앞이 살짝 올라가게
      for (const m of g.children.slice(n)) { m.position.y -= H0 + 0.13; tilt.add(m); }
      g.add(tilt);
      break;
    }
    case 'flower': // 꽃 화관
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; add(new THREE.IcosahedronGeometry(0.045, 0), flower[i % 5], Math.sin(a) * 0.25, H0 + 0.12 + Math.cos(a) * 0.04, Math.cos(a) * 0.24); }
      for (let i = 0; i < 14; i++) { const a = ((i + 0.5) / 14) * Math.PI * 2; add(new THREE.IcosahedronGeometry(0.03, 0), new THREE.MeshStandardMaterial({ color: 0x4f9b47 }), Math.sin(a) * 0.255, H0 + 0.11 + Math.cos(a) * 0.04, Math.cos(a) * 0.245); }
      break;
    case 'crown': { // 금 왕관
      add(new THREE.CylinderGeometry(0.15, 0.16, 0.09, 24, 1, true), AM.gold, 0, H0 + 0.27, -0.01);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(new THREE.ConeGeometry(0.03, 0.09, 6), AM.gold, Math.sin(a) * 0.15, H0 + 0.355, Math.cos(a) * 0.15 - 0.01); add(new THREE.SphereGeometry(0.014, 8, 6), AM.gold, Math.sin(a) * 0.15, H0 + 0.405, Math.cos(a) * 0.15 - 0.01); }
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; add(new THREE.SphereGeometry(0.022, 10, 8), i % 2 ? AM.sapphire : AM.ruby, Math.sin(a) * 0.158, H0 + 0.27, Math.cos(a) * 0.158 - 0.01); }
      break;
    }
    case 'diacrown': { // 다이아몬드 티아라
      add(new THREE.TorusGeometry(0.2, 0.014, 8, 32, Math.PI), AM.gold, 0, H0 + 0.1, 0.04, -0.2, 0, 0);
      for (let i = 0; i < 9; i++) { const t = (i / 8) * Math.PI, hgt = 0.06 + 0.07 * Math.sin(t); add(new THREE.OctahedronGeometry(0.025 + 0.012 * Math.sin(t), 0), AM.diamond, Math.cos(t) * 0.2, H0 + 0.11 + Math.sin(t) * 0.2 * 0.2 + hgt, 0.04 + Math.sin(t) * 0.06); }
      add(new THREE.OctahedronGeometry(0.045, 0), AM.sapphire, 0, H0 + 0.36, 0.1, 0, 0, 0, 0.8, 1.2, 0.8);
      break;
    }
    case 'halo': // 천사 고리 (머리 위에 둥실)
      add(new THREE.TorusGeometry(0.15, 0.018, 8, 32), AM.halo, 0, H0 + 0.42, -0.02, Math.PI / 2 - 0.15, 0, 0);
      g.userData.bob = true;
      break;
    case 'wings': case 'butterfly': case 'bat': { // 날개 (등)
      const round = id !== 'bat', mat = id === 'wings' ? AM.feather : id === 'bat' ? AM.bat : AM.bfly;
      const W = id === 'butterfly' ? 0.34 : 0.46, Hh = id === 'butterfly' ? 0.38 : 0.36;
      const wl = [];
      for (const e of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(e * 0.05, 0.5, -0.19); g.add(pivot);
        const m = new THREE.Mesh(wingShape(W, Hh, round), mat); m.scale.x = e; pivot.add(m);
        if (id === 'butterfly') { const m2 = new THREE.Mesh(wingShape(W * 0.7, Hh * 0.8, true), AM.bfly2); m2.scale.set(e, -1, 1); m2.position.y = -0.02; pivot.add(m2); }
        if (id === 'wings') for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(wingShape(W * (0.8 - i * 0.18), Hh * 0.5, true), AM.feather); f.scale.set(e, -0.7, 1); f.position.set(0, -0.04 - i * 0.05, 0.005 * (i + 1)); pivot.add(f); }
        wl.push(pivot);
      }
      g.userData.wings = wl;
      break;
    }
    // ----- 👗 옷 (몸통에 덧입음, 소매는 팔에 붙임) -----
    case 'furcoat': // 하얀 퍼 코트
      add(new THREE.CylinderGeometry(0.17, 0.215, 0.34, 20), AM.fur, 0, 0.39, 0);
      add(new THREE.TorusGeometry(0.13, 0.06, 8, 20), AM.fur, 0, 0.55, 0.0, Math.PI / 2, 0, 0);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; add(new THREE.IcosahedronGeometry(0.045, 0), AM.fur, Math.sin(a) * 0.21, 0.23, Math.cos(a) * 0.21); }
      g.userData.sleeve = { mat: AM.fur, r: 0.06, cuff: AM.fur };
      break;
    case 'tweed': // 핑크 트위드 재킷 + 금단추
      add(new THREE.CylinderGeometry(0.162, 0.19, 0.27, 20), AM.tweed, 0, 0.415, 0);
      add(new THREE.TorusGeometry(0.16, 0.012, 6, 24), AM.tweedTrim, 0, 0.29, 0, Math.PI / 2, 0, 0);
      add(new THREE.TorusGeometry(0.085, 0.013, 6, 20), AM.tweedTrim, 0, 0.55, 0.02, Math.PI / 2 - 0.25, 0, 0);
      add(new THREE.BoxGeometry(0.012, 0.26, 0.012), AM.tweedTrim, 0, 0.42, 0.183, -0.14, 0, 0);
      for (const y of [0.48, 0.41, 0.34]) for (const e of [-1, 1]) add(new THREE.SphereGeometry(0.011, 8, 6), AM.gold, e * 0.035, y, 0.18 + (0.5 - y) * 0.14);
      g.userData.sleeve = { mat: AM.tweed, r: 0.054, cuff: AM.tweedTrim };
      break;
    case 'cape': { // 레드 벨벳 망토
      const cape = new THREE.CylinderGeometry(0.2, 0.33, 0.5, 20, 1, true, Math.PI * 0.5, Math.PI);
      add(cape, AM.velvet, 0, 0.3, -0.02);
      add(new THREE.TorusGeometry(0.15, 0.03, 8, 24), AM.velvet, 0, 0.55, 0, Math.PI / 2, 0, 0);
      add(new THREE.SphereGeometry(0.03, 10, 8), AM.gold, 0, 0.53, 0.15);
      break;
    }
    case 'dress': // 반짝이 파티 드레스 (발목까지)
      add(new THREE.CylinderGeometry(0.158, 0.17, 0.2, 20), AM.dress, 0, 0.45, 0);
      add(new THREE.CylinderGeometry(0.17, 0.33, 0.32, 24, 1, true), AM.dress, 0, 0.19, 0);
      add(new THREE.TorusGeometry(0.17, 0.018, 6, 24), AM.gold, 0, 0.35, 0, Math.PI / 2, 0, 0);
      for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.012, 0.09, 0.012), AM.gold, e * 0.08, 0.57, 0.08, 0.3, 0, 0);
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, yy = 0.08 + (i % 3) * 0.08; add(new THREE.OctahedronGeometry(0.012, 0), AM.diamond, Math.sin(a) * (0.33 - (yy - 0.03) * 0.5), yy, Math.cos(a) * (0.33 - (yy - 0.03) * 0.5)); }
      break;
    case 'muffler': // 캐시미어 머플러 (목)
      add(new THREE.TorusGeometry(0.12, 0.045, 8, 20), AM.cashmere, 0, 0.555, 0.01, Math.PI / 2 - 0.15, 0, 0);
      add(new THREE.BoxGeometry(0.075, 0.2, 0.035), AM.cashmere, 0.07, 0.44, 0.17, -0.2, 0, 0.1);
      for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.075, 0.008, 0.036), AM.red, 0.07, 0.38 + i * 0.03, 0.18, -0.2, 0, 0.1);
      break;
    // ----- 👜 가방 -----
    case 'tote': // 미니 토트백 (손에 듦)
      g.userData.hand = true;
      add(new THREE.BoxGeometry(0.15, 0.12, 0.07), AM.tan, 0, -0.38, 0.02);
      add(new THREE.TorusGeometry(0.045, 0.008, 6, 16, Math.PI), AM.leather, 0, -0.32, 0.02);
      add(new THREE.BoxGeometry(0.03, 0.02, 0.072), AM.gold, 0, -0.35, 0.02);
      break;
    case 'clutch': // 반짝이 클러치 (손에 듦)
      g.userData.hand = true;
      add(new THREE.BoxGeometry(0.14, 0.075, 0.035), AM.champagne, 0, -0.29, 0.05, 0, 0, 0.1);
      add(new THREE.SphereGeometry(0.012, 8, 6), AM.diamond, 0.0, -0.255, 0.07);
      break;
    case 'chainbag': { // 퀼팅 체인백 (어깨에 멤)
      add(new THREE.BoxGeometry(0.15, 0.11, 0.055), AM.leatherBlack, 0.21, 0.3, 0.06, 0, 0, 0);
      for (const d of [-0.03, 0, 0.03]) { add(new THREE.BoxGeometry(0.15, 0.004, 0.058), AM.black, 0.21, 0.3 + d, 0.06); add(new THREE.BoxGeometry(0.004, 0.11, 0.058), AM.black, 0.21 + d * 1.4, 0.3, 0.06); }
      add(new THREE.BoxGeometry(0.03, 0.02, 0.06), AM.gold, 0.21, 0.335, 0.065);
      for (let i = 0; i < 12; i++) { const t = i / 11; add(new THREE.TorusGeometry(0.012, 0.004, 4, 8), AM.gold, 0.21 - t * 0.33, 0.36 + t * 0.2, 0.06 + Math.sin(t * Math.PI) * 0.1, 0, i * 0.8, 0); }
      break;
    }
    // ----- 👜 부티크 2차 (11-25) -----
    case 'pradybag': // 프라디 나일론 호보백: 반짝이는 검정 나일론 반달 가방 + 은색 명판 (어깨에 멤)
      add(new THREE.SphereGeometry(0.1, 20, 14), AM.nylon, 0.215, 0.3, 0.05, 0, 0, 0.15, 1.15, 0.7, 0.45);
      add(new THREE.BoxGeometry(0.05, 0.022, 0.01), AM.silver, 0.222, 0.29, 0.095, 0, 0, 0.15);
      add(new THREE.TorusGeometry(0.085, 0.012, 6, 20, Math.PI), AM.nylon, 0.205, 0.33, 0.05, 0, 0, 0.15, 1, 1.25, 1);
      { const P = (t) => [0.2 - t * 0.31, 0.37 + t * 0.19, 0.05 + Math.sin(t * Math.PI) * 0.13]; for (let i = 0; i < 8; i++) rod(g, P(i / 8), P((i + 1) / 8), 0.013, AM.nylon); } // 어깨끈 (이어진 나일론 끈)
      break;
    case 'gucicardi': // 구치 니트 가디건: 오트밀 니트 + 네이비 테두리 + 금단추
      shell(add, AM.knitOat);
      add(new THREE.TorusGeometry(0.212, 0.02, 6, 26), AM.knitNavy, 0, 0.27, 0, Math.PI / 2, 0, 0, 1, 1.1, 1);
      for (const e of [-1, 1]) {
        add(new THREE.BoxGeometry(0.022, 0.19, 0.012), AM.knitNavy, e * 0.026, 0.36, 0.214, -0.12, 0, 0);            // 앞 여밈 (세로)
        add(new THREE.BoxGeometry(0.022, 0.12, 0.012), AM.knitNavy, e * 0.05, 0.5, 0.2, -0.12, 0, e * 0.42);           // V넥
      }
      add(new THREE.BoxGeometry(0.06, 0.09, 0.01), AM.shirtW, 0, 0.5, 0.198, -0.12, 0, 0);
      for (const y of [0.45, 0.39, 0.33]) add(new THREE.SphereGeometry(0.012, 10, 8), AM.gold, 0, y, 0.21 + (0.56 - y) * 0.113 - 0.012);
      for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.055, 0.04, 0.012), AM.knitNavy, e * 0.1, 0.34, 0.208, -0.1, e * 0.5, 0);
      g.userData.sleeve = { mat: AM.knitOat, r: 0.058, cuff: AM.knitNavy };
      break;
    case 'reddress': // 레드 실크 롱 드레스 (발목까지 + 허리 리본)
      shell(add, AM.silk, 0.21);
      add(new THREE.CylinderGeometry(0.2, 0.32, 0.36, 28, 1, true), AM.silk, 0, 0.17, 0, 0, 0, 0, 1, 1, 1.1);
      add(new THREE.TorusGeometry(0.2, 0.012, 6, 26), AM.silk, 0, 0.35, 0, Math.PI / 2, 0, 0, 1, 1.1, 1);
      add(new THREE.SphereGeometry(0.035, 10, 8), AM.silk, 0.1, 0.35, 0.19, 0, 0.6, 0.6, 1.3, 0.7, 0.6);
      add(new THREE.SphereGeometry(0.035, 10, 8), AM.silk, 0.145, 0.35, 0.16, 0, 0.6, -0.6, 1.3, 0.7, 0.6);
      add(new THREE.BoxGeometry(0.02, 0.15, 0.012), AM.silk, 0.135, 0.27, 0.19, 0.1, 0.6, 0.2);
      break;
    case 'blackdress': // 블랙 미니 드레스 + 진주 목걸이
      shell(add, AM.lbd, 0.21);
      add(new THREE.CylinderGeometry(0.2, 0.26, 0.16, 26, 1, true), AM.lbd, 0, 0.27, 0, 0, 0, 0, 1, 1, 1.1);
      add(new THREE.TorusGeometry(0.2, 0.012, 6, 26), AM.satin, 0, 0.35, 0, Math.PI / 2, 0, 0, 1, 1.1, 1);
      for (let i = 0; i < 17; i++) { const a = Math.PI * (0.1 + (i / 16) * 0.8); add(new THREE.SphereGeometry(0.016, 10, 8), AM.pearl, Math.cos(a) * 0.13, 0.598 - Math.sin(a) * 0.012, Math.sin(a) * 0.145); } // 진주 목걸이 (어깨 위)
      add(new THREE.SphereGeometry(0.022, 12, 10), AM.pearl, 0, 0.565, 0.175);
      break;
    case 'navysuit': // 네이비 더블 수트: 라펠 + 금단추 4개 + 흰 행커치프 + 넥타이
      shell(add, AM.navy);
      suitFront(add, AM.navy);
      add(new THREE.BoxGeometry(0.026, 0.13, 0.01), AM.tieRed, 0, 0.47, 0.218, -0.12, 0, 0);
      add(new THREE.BoxGeometry(0.032, 0.022, 0.014), AM.tieRed, 0, 0.535, 0.21, -0.12, 0, 0);
      for (const y of [0.38, 0.32]) for (const e of [-1, 1]) add(new THREE.SphereGeometry(0.012, 10, 8), AM.gold, e * 0.045, y, 0.218 + (0.56 - y) * 0.113 - 0.012);
      add(new THREE.BoxGeometry(0.045, 0.026, 0.012), AM.shirtW, -0.105, 0.48, 0.196, -0.12, -0.5, 0.15);
      g.userData.sleeve = { mat: AM.navy, r: 0.058, cuff: AM.shirtW };
      break;
    case 'tuxedo': // 블랙 턱시도: 새틴 라펠 + 나비넥타이 + 흰 셔츠
      shell(add, AM.tux);
      suitFront(add, AM.satin);
      add(new THREE.SphereGeometry(0.013, 8, 6), AM.satin, 0, 0.535, 0.213);
      for (const e of [-1, 1]) add(new THREE.ConeGeometry(0.024, 0.05, 4), AM.satin, e * 0.026, 0.535, 0.211, 0, 0, e * Math.PI / 2);
      for (const y of [0.48, 0.44]) add(new THREE.SphereGeometry(0.007, 8, 6), AM.black, 0, y, 0.218);
      add(new THREE.SphereGeometry(0.013, 10, 8), AM.satin, 0, 0.35, 0.23);
      g.userData.sleeve = { mat: AM.tux, r: 0.058, cuff: AM.shirtW };
      break;
    // ----- 🕴 남성 옷 (11-26) -----
    case 'trench': case 'longcoat': { // 카멜 트렌치코트(허리끈 · 더블 단추) / 차콜 울 롱코트 — 무릎 위까지 내려오는 긴 코트
      const tr = id === 'trench', m = tr ? AM.camel : AM.charcoal;
      shell(add, m);
      add(new THREE.CylinderGeometry(0.212, 0.24, 0.16, 26, 1, true), m, 0, 0.18, 0, 0, 0, 0, 1, 1, 1.1);   // 아랫단
      suitFront(add, m);
      add(new THREE.BoxGeometry(0.012, 0.3, 0.012), tr ? AM.camelDk : AM.black, 0, 0.25, 0.236, -0.06, 0, 0); // 앞 여밈선
      if (tr) {
        add(new THREE.TorusGeometry(0.212, 0.014, 6, 28), AM.camelDk, 0, 0.3, 0, Math.PI / 2, 0, 0, 1, 1.1, 1); // 허리끈
        add(new THREE.BoxGeometry(0.04, 0.03, 0.012), AM.gold, 0.06, 0.3, 0.232);
        add(new THREE.BoxGeometry(0.02, 0.1, 0.01), AM.camelDk, 0.08, 0.24, 0.236, 0, 0, 0.15);                 // 늘어진 끈 끝
        for (const y of [0.43, 0.37]) for (const e of [-1, 1]) add(new THREE.SphereGeometry(0.011, 8, 6), AM.camelDk, e * 0.05, y, 0.218 + (0.56 - y) * 0.113 - 0.01);
        for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.012, 0.03), AM.camelDk, e * 0.13, 0.545, 0.05, 0, 0, e * -0.2); // 견장
      } else {
        for (const y of [0.42, 0.34]) add(new THREE.SphereGeometry(0.012, 8, 6), AM.black, 0.02, y, 0.218 + (0.56 - y) * 0.113 - 0.01);
        for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.07, 0.012, 0.012), AM.black, e * 0.1, 0.33, 0.226, -0.1, e * 0.4, 0); // 주머니 덮개
      }
      g.userData.sleeve = { mat: m, r: 0.058, cuff: tr ? AM.camelDk : m };
      break;
    }
    case 'rider': // 블랙 가죽 라이더 재킷: 비스듬한 은색 지퍼 + 큰 깃 + 허리 벨트
      shell(add, AM.rider);
      rod(g, [0.07, 0.54, 0.205], [-0.035, 0.29, 0.235], 0.006, AM.silver);
      for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.075, 0.14, 0.014), AM.rider, e * 0.07, 0.5, 0.215, -0.15, 0, e * 0.55); // 깃
      add(new THREE.TorusGeometry(0.212, 0.012, 6, 28), AM.rider, 0, 0.275, 0, Math.PI / 2, 0, 0, 1, 1.1, 1);
      add(new THREE.BoxGeometry(0.035, 0.025, 0.012), AM.silver, 0.1, 0.276, 0.222, 0, 0.45, 0);
      for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.006, 0.01), AM.silver, e * 0.1, 0.36, 0.226, -0.1, e * 0.4, -e * 0.3); // 주머니 지퍼
      g.userData.sleeve = { mat: AM.rider, r: 0.058, cuff: AM.silver };
      break;
    case 'varsity': // 네이비 야구 점퍼: 크림 소매 + 줄무늬 시보리 + W 와펜
      shell(add, AM.varsity);
      for (const [y, mt] of [[0.27, AM.varsityW], [0.285, AM.varsityR], [0.3, AM.varsityW]]) add(new THREE.TorusGeometry(0.211, 0.008, 6, 28), mt, 0, y, 0, Math.PI / 2, 0, 0, 1, 1.1, 1);
      add(new THREE.TorusGeometry(0.11, 0.016, 6, 22), AM.varsityW, 0, 0.555, 0.02, Math.PI / 2 - 0.2, 0, 0);  // 목 시보리
      for (const y of [0.5, 0.44, 0.38, 0.32]) add(new THREE.CylinderGeometry(0.011, 0.011, 0.006, 10), AM.varsityW, 0, y, 0.218 + (0.56 - y) * 0.113 - 0.006, Math.PI / 2, 0, 0);
      add(new THREE.BoxGeometry(0.075, 0.075, 0.008), AM.varsityW, -0.09, 0.45, 0.214, -0.12, -0.42, 0);        // 왼쪽 가슴 와펜
      { const W = [[-0.02, 0.02, 0.2], [0.02, -0.02, -0.2]]; for (const [ox, , r] of W) for (const sx of [-0.016, 0.016]) add(new THREE.BoxGeometry(0.008, 0.05, 0.006), AM.varsityR, -0.09 + sx + ox * 0.5, 0.45, 0.22, -0.12, -0.42, r); }
      g.userData.sleeve = { mat: AM.varsityW, r: 0.058, cuff: AM.varsityR };
      break;
    case 'denim': // 워싱 데님 재킷: 가슴 주머니 2 + 은단추 + 진한 박음질
      shell(add, AM.denim);
      for (const e of [-1, 1]) {
        add(new THREE.BoxGeometry(0.07, 0.06, 0.01), AM.denimDk, e * 0.075, 0.45, 0.214, -0.12, e * 0.4, 0);
        add(new THREE.SphereGeometry(0.008, 8, 6), AM.silver, e * 0.075, 0.47, 0.22);
        add(new THREE.BoxGeometry(0.07, 0.1, 0.014), AM.denim, e * 0.06, 0.52, 0.205, -0.25, 0, e * 0.6);      // 깃
        add(new THREE.BoxGeometry(0.006, 0.2, 0.006), AM.denimDk, e * 0.1, 0.36, 0.222, -0.1, e * 0.4, 0);       // 박음질
      }
      for (const y of [0.5, 0.43, 0.36, 0.29]) add(new THREE.SphereGeometry(0.009, 8, 6), AM.silver, 0, y, 0.218 + (0.56 - y) * 0.113 - 0.008);
      add(new THREE.TorusGeometry(0.212, 0.012, 6, 28), AM.denimDk, 0, 0.27, 0, Math.PI / 2, 0, 0, 1, 1.1, 1);
      g.userData.sleeve = { mat: AM.denim, r: 0.058, cuff: AM.denimDk };
      break;
    case 'puffer': // 블랙 숏패딩: 빵빵한 칸 + 높은 목 + 은색 지퍼
      shell(add, AM.puffer);
      for (const y of [0.29, 0.36, 0.43, 0.5]) add(new THREE.TorusGeometry(0.19 + (0.56 - y) * 0.113, 0.028, 8, 28), AM.puffer, 0, y, 0, Math.PI / 2, 0, 0, 1, 1.1, 1);
      add(new THREE.CylinderGeometry(0.125, 0.15, 0.08, 22, 1, true), AM.puffer, 0, 0.585, 0.01);           // 높은 목
      add(new THREE.SphereGeometry(0.13, 18, 12), AM.puffer, 0, 0.575, -0.13, 0, 0, 0, 1.35, 0.85, 0.95);    // 뒤 모자(후드티 모자가 비치지 않게)
      add(new THREE.BoxGeometry(0.008, 0.33, 0.008), AM.silver, 0, 0.43, 0.25, -0.1, 0, 0);
      g.userData.sleeve = { mat: AM.puffer, r: 0.066, cuff: AM.black };
      break;
    case 'cap': { // 블랙 볼캡 (챙이 앞으로)
      add(new THREE.SphereGeometry(0.288, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), AM.capBlack, 0, H0 + 0.07, -0.01, 0, 0, 0, 1, 0.92, 1.04);
      add(new THREE.CircleGeometry(0.288, 26), AM.capBlack, 0, H0 + 0.071, -0.01, Math.PI / 2, 0, 0);
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.016, 24, 1, false, -Math.PI / 2, Math.PI), AM.capBlack, 0, H0 + 0.085, 0.2, 0.12, 0, 0, 1, 1, 1.15); // 챙
      add(new THREE.SphereGeometry(0.02, 8, 6), AM.capBlack, 0, H0 + 0.335, -0.01);                            // 꼭지 단추
      add(new THREE.BoxGeometry(0.08, 0.04, 0.006), AM.white, 0, H0 + 0.2, 0.258, -0.5, 0, 0);                  // 앞 로고 자리(흰 패치)
      break;
    }
    case 'beanie': // 그레이 니트 비니 (접은 단)
      add(new THREE.SphereGeometry(0.292, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), AM.beanie, 0, H0 + 0.06, -0.01, 0, 0, 0, 1, 1.12, 1.04);
      add(new THREE.CircleGeometry(0.292, 26), AM.beanie, 0, H0 + 0.061, -0.01, Math.PI / 2, 0, 0);
      add(new THREE.CylinderGeometry(0.3, 0.302, 0.1, 30, 1, true), AM.beanie, 0, H0 + 0.1, -0.01, 0, 0, 0, 1, 1, 1.04);
      for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; add(new THREE.BoxGeometry(0.012, 0.1, 0.008), AM.charcoal, Math.sin(a) * 0.303, H0 + 0.1, Math.cos(a) * 0.315 - 0.01, 0, a, 0); }
      break;
    case 'tie': // 스트라이프 실크 넥타이 (목)
      add(new THREE.BoxGeometry(0.034, 0.026, 0.016), AM.tieNavy, 0, 0.535, 0.222, -0.12, 0, 0);
      add(new THREE.BoxGeometry(0.03, 0.17, 0.008), AM.tieNavy, 0, 0.44, 0.232, -0.12, 0, 0);
      add(new THREE.ConeGeometry(0.021, 0.025, 4), AM.tieNavy, 0, 0.346, 0.243, Math.PI - 0.12, Math.PI / 4, 0, 1, 1, 0.4);
      for (const y of [0.5, 0.46, 0.42, 0.38]) add(new THREE.BoxGeometry(0.034, 0.006, 0.004), AM.tieStripe, 0, y, 0.237 + (0.5 - y) * 0.12, -0.12, 0, 0.6);
      break;
    case 'briefcase': // 가죽 서류가방 (손에 듦)
      g.userData.hand = true;
      add(new THREE.BoxGeometry(0.2, 0.14, 0.055), AM.brief, 0, -0.39, 0.02);
      add(new THREE.BoxGeometry(0.202, 0.006, 0.057), AM.camelDk, 0, -0.355, 0.02);
      add(new THREE.TorusGeometry(0.035, 0.009, 6, 14, Math.PI), AM.brief, 0, -0.32, 0.02);
      for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.022, 0.018, 0.06), AM.gold, e * 0.06, -0.345, 0.02);
      break;
    // ----- 🎄 크리스마스 출석 한정판 (부티크에서 안 팖, advent.js) -----
    case 'rudolph': { // 루돌프 머리띠: 통통한 펠트 사슴뿔 + 작은 사슴 귀 + 방울 + 호랑가시
      add(new THREE.TorusGeometry(0.27, 0.014, 6, 32, Math.PI), AM.antler, 0, H0 + 0.0, 0.0, 0, 0, 0, 1.04, 1.12, 1); // 귀에서 귀로 넘어가는 띠
      for (const e of [-1, 1]) {
        const P = (x, y, z = 0) => [e * x, H0 + y, z];
        const joint = (p, r) => add(new THREE.SphereGeometry(r, 12, 10), AM.felt, ...p);
        // 큰 줄기 (살짝 바깥으로 휘며 위로)
        rod(g, P(0.12, 0.215), P(0.15, 0.33), 0.034, AM.felt, 0.031); joint(P(0.15, 0.33), 0.031);
        rod(g, P(0.15, 0.33), P(0.2, 0.45), 0.031, AM.felt, 0.027); joint(P(0.2, 0.45), 0.027);
        // 안쪽 가지 · 바깥 가지 (끝은 동글게)
        rod(g, P(0.15, 0.31), P(0.085, 0.4), 0.024, AM.felt, 0.022); joint(P(0.085, 0.4), 0.022);
        rod(g, P(0.18, 0.4), P(0.28, 0.44), 0.023, AM.felt, 0.021); joint(P(0.28, 0.44), 0.021);
        rod(g, P(0.2, 0.45), P(0.16, 0.53), 0.022, AM.felt, 0.02); joint(P(0.16, 0.53), 0.02);
        // 사슴 귀 (갈색 + 분홍 안쪽)
        add(new THREE.SphereGeometry(0.05, 14, 10), AM.felt, e * 0.245, H0 + 0.19, 0.0, 0, 0, e * -0.95, 0.75, 1.5, 0.45);
        add(new THREE.SphereGeometry(0.034, 12, 8), AM.earPink, e * 0.247, H0 + 0.19, 0.016, 0, 0, e * -0.95, 0.7, 1.4, 0.3);
        add(new THREE.SphereGeometry(0.024, 12, 10), AM.gold, e * 0.262, H0 + 0.1, 0.05); // 방울 (귀 아래)
      }
      for (const [x, rz] of [[0.1, 0.5], [0.055, -0.45]]) add(new THREE.SphereGeometry(0.04, 10, 6), AM.holly, x, H0 + 0.245, 0.11, 0.5, 0, rz, 1.6, 0.4, 0.8);
      for (const [x, y] of [[0.078, 0.262], [0.098, 0.24], [0.062, 0.236]]) add(new THREE.SphereGeometry(0.018, 8, 6), AM.berry, x, H0 + y, 0.14);
      break;
    }
    case 'xknit': // 홀리데이 니트 목도리 (빨강 · 초록 · 흰 줄 + 방울 술)
      add(new THREE.TorusGeometry(0.12, 0.05, 10, 22), AM.knitR, 0, 0.555, 0.01, Math.PI / 2 - 0.15, 0, 0);
      for (const d of [-0.028, 0.028]) add(new THREE.TorusGeometry(0.12 + Math.abs(d) * 0.3, 0.051, 10, 22, Math.PI * 2), AM.knitW, 0, 0.555 + d, 0.01, Math.PI / 2 - 0.15, 0, 0, 1, 1, 0.2);
      add(new THREE.BoxGeometry(0.085, 0.24, 0.04), AM.knitR, 0.075, 0.43, 0.17, -0.2, 0, 0.12);
      for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.086, 0.022, 0.042), i === 1 ? AM.knitG : AM.knitW, 0.075 - i * 0.004, 0.37 + i * 0.05, 0.18 - i * 0.006, -0.2, 0, 0.12);
      for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.018, 8, 6), AM.knitW, 0.055 + i * 0.021, 0.3, 0.19);
      break;
    case 'santasack': { // 산타 보따리: 등에 멘 커다란 빨간 자루 + 금 끈 + 삐죽 나온 선물
      add(new THREE.SphereGeometry(0.2, 22, 16), AM.santa, 0.05, 0.47, -0.3, 0.2, 0, -0.25, 1, 1.15, 0.85);
      add(new THREE.CylinderGeometry(0.075, 0.1, 0.07, 16), AM.santa, 0.11, 0.69, -0.33, 0.15, 0, -0.3);
      add(new THREE.TorusGeometry(0.075, 0.014, 6, 18), AM.gold, 0.115, 0.68, -0.33, Math.PI / 2 + 0.15, 0, -0.3);
      add(new THREE.BoxGeometry(0.11, 0.11, 0.11), AM.giftG, 0.13, 0.77, -0.34, 0.2, 0.5, -0.35);
      add(new THREE.BoxGeometry(0.115, 0.02, 0.115), AM.gold, 0.13, 0.77, -0.34, 0.2, 0.5, -0.35);
      add(new THREE.BoxGeometry(0.02, 0.115, 0.115), AM.gold, 0.13, 0.77, -0.34, 0.2, 0.5, -0.35);
      add(new THREE.BoxGeometry(0.08, 0.09, 0.08), AM.giftB, 0.05, 0.74, -0.29, -0.15, -0.3, 0.2);
      add(new THREE.BoxGeometry(0.082, 0.016, 0.082), AM.white, 0.05, 0.74, -0.29, -0.15, -0.3, 0.2);
      rod(g, [0.12, 0.66, -0.3], [-0.1, 0.56, 0.12], 0.016, AM.gold);  // 어깨 끈
      rod(g, [-0.1, 0.56, 0.12], [0.14, 0.32, 0.17], 0.016, AM.gold);
      break;
    }
    case 'santaboots': // 산타 부츠: 반짝이는 검정 + 흰 털 + 금 버클 (두 다리에 하나씩)
      g.userData.feet = true;
      add(new THREE.CylinderGeometry(0.071, 0.068, 0.15, 14), AM.gloss, 0, -0.165, 0);
      add(new THREE.SphereGeometry(0.078, 16, 10), AM.gloss, 0, -0.232, 0.035, 0, 0, 0, 0.95, 0.6, 1.42);
      add(new THREE.CylinderGeometry(0.074, 0.074, 0.02, 16), AM.leatherBlack, 0, -0.262, 0.035, 0, 0, 0, 1, 1, 1.45);
      add(new THREE.TorusGeometry(0.074, 0.03, 8, 18), AM.snowFur, 0, -0.088, 0, Math.PI / 2, 0, 0);
      add(new THREE.TorusGeometry(0.072, 0.009, 6, 20), AM.leatherBlack, 0, -0.175, 0, Math.PI / 2, 0, 0); // 발목 끈
      add(new THREE.BoxGeometry(0.045, 0.035, 0.012), AM.gold, 0, -0.175, 0.075);
      break;
    case 'santacoat': // 산타 코트: 빨강 벨벳 + 흰 털 장식 + 검정 벨트
      add(new THREE.CylinderGeometry(0.168, 0.205, 0.3, 22), AM.santa, 0, 0.41, 0);
      add(new THREE.TorusGeometry(0.2, 0.034, 8, 26), AM.snowFur, 0, 0.265, 0, Math.PI / 2, 0, 0);
      add(new THREE.TorusGeometry(0.115, 0.045, 8, 22), AM.snowFur, 0, 0.555, 0.0, Math.PI / 2 - 0.2, 0, 0);
      add(new THREE.BoxGeometry(0.05, 0.27, 0.03), AM.snowFur, 0, 0.42, 0.188, -0.14, 0, 0);
      add(new THREE.CylinderGeometry(0.186, 0.19, 0.045, 22), AM.leatherBlack, 0, 0.35, 0);
      add(new THREE.BoxGeometry(0.075, 0.06, 0.02), AM.gold, 0, 0.35, 0.192);
      add(new THREE.BoxGeometry(0.045, 0.03, 0.022), AM.leatherBlack, 0, 0.35, 0.194);
      g.userData.sleeve = { mat: AM.santa, r: 0.056, cuff: AM.snowFur };
      break;
    case 'snowwings': { // 눈꽃 날개: 빛나는 얼음 눈꽃 두 쌍 (날갯짓)
      const wl = [];
      for (const e of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(e * 0.05, 0.5, -0.2); g.add(pivot);
        const f1 = snowflake(pivot, e * 0.27, 0.1, 0.22, AM.ice, AM.diamond); f1.rotation.z = e * 0.3;
        const f2 = snowflake(pivot, e * 0.2, -0.16, 0.13, AM.ice, AM.diamond); f2.position.z = 0.01;
        wl.push(pivot);
      }
      g.userData.wings = wl;
      break;
    }
    case 'xstar': { // 크리스마스 스타: 머리 위에서 빙글빙글 도는 황금 별 + 반짝이 (12/25 당일 출석)
      const sg = new THREE.Group(); sg.position.set(0, H0 + 0.52, 0); g.add(sg);
      sg.add(new THREE.Mesh(starGeo(0.11, 0.048, 0.03), AM.star));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, s2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.016, 0), AM.diamond); s2.position.set(Math.cos(a) * 0.17, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.17); sg.add(s2); }
      g.userData.bob = true; g.userData.spin = sg;
      break;
    }
    case 'backpack': // 가죽 백팩 (등)
      add(new THREE.BoxGeometry(0.24, 0.26, 0.11), AM.leather, 0, 0.42, -0.24);
      add(new THREE.BoxGeometry(0.18, 0.1, 0.04), AM.leather, 0, 0.36, -0.31);
      for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.26, 0.02), AM.leatherBlack, e * 0.09, 0.43, 0.17, -0.14, 0, 0);
      add(new THREE.BoxGeometry(0.05, 0.03, 0.015), AM.gold, 0, 0.42, -0.33);
      break;
  }
  return g;
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
    this.torso = buildBody(g, top, L, !!this.danceId);
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
    this.accGroup = new THREE.Group(); this.body.add(this.accGroup);
    this.attachAcc();
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
  // 착용 아이템 (아이디 목록 또는 'a,b' 글자)
  setAcc(list) {
    const ids = (Array.isArray(list) ? list : String(list || '').split(',')).filter(Boolean).slice(0, 8);
    if (ids.join(',') === (this.acc || []).join(',')) return;
    this.acc = ids;
    if (!this.accGroup) return;
    this.attachAcc();
  }
  // 아이템 달기: 보통은 몸에, 손가방은 오른손에, 옷 소매는 두 팔에
  attachAcc() {
    for (const o of this.accExtra || []) { o.parent?.remove(o); o.traverse((m) => m.geometry?.dispose()); }
    this.accExtra = [];
    this.accGroup.traverse((o) => o.geometry?.dispose());
    this.accGroup.clear();
    for (const id of this.acc || []) {
      const a = makeAcc(id);
      if (a.userData.hand) { this.armR.add(a); this.accExtra.push(a); continue; }
      if (a.userData.feet) { this.legL.add(a); const b = makeAcc(id); this.legR.add(b); this.accExtra.push(a, b); continue; }
      this.accGroup.add(a);
      const sl = a.userData.sleeve;
      if (sl) for (const arm of [this.armL, this.armR]) {
        const sg = new THREE.Group();
        const m = new THREE.Mesh(new THREE.CylinderGeometry(sl.r * 0.95, sl.r, 0.25, 12), sl.mat); m.position.y = -0.095; /* 11-26: 어깨 윗부분(기본 옷 색)이 비치지 않게 조금 위까지 */ sg.add(m);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(sl.r + 0.006, sl.r + 0.006, 0.035, 12), sl.cuff); c.position.y = -0.21; sg.add(c);
        arm.add(sg); this.accExtra.push(sg);
      }
    }
  }
  dance(dt) {
    const t = (this.danceT += dt), b = t * 2.1 * Math.PI; // 약 126 BPM
    const L = this.legL, R = this.legR, aL = this.armL, aR = this.armR, B = this.body, sn = Math.sin, cs = Math.cos;
    B.rotation.set(0, 0, 0); B.position.x = 0;
    switch (this.danceId) {
      case 1: { // 🙌 신나는 점프: 팔을 번갈아 위로 찌르며 통통
        const up = Math.abs(sn(b / 2));
        B.position.y = up * 0.09; B.rotation.y = sn(b / 4) * 0.35;
        aL.rotation.x = -2.6 + sn(b) * 0.5; aR.rotation.x = -2.6 - sn(b) * 0.5; aL.rotation.z = -0.35; aR.rotation.z = 0.35;
        L.rotation.x = -up * 0.35; R.rotation.x = up * 0.2;
        break;
      }
      case 2: { // 🌊 웨이브: 팔을 옆으로 펴고 물결, 엉덩이 좌우
        aL.rotation.x = 0; aR.rotation.x = 0;
        aL.rotation.z = -1.45 + sn(b) * 0.35; aR.rotation.z = 1.45 + sn(b - 1.2) * 0.35;
        B.rotation.z = sn(b / 2) * 0.12; B.position.x = sn(b / 2) * 0.05; B.position.y = Math.abs(cs(b / 2)) * 0.03;
        L.rotation.x = sn(b / 2) * 0.25; R.rotation.x = -sn(b / 2) * 0.25;
        break;
      }
      case 3: { // 🤖 로봇: 뚝뚝 끊기는 동작
        const k = Math.floor(t * 4) % 4, q = [0, 0.45, 0, -0.45][k];
        B.rotation.y = q; B.position.y = k % 2 ? 0.015 : 0;
        aL.rotation.x = k % 2 ? -1.57 : -0.3; aR.rotation.x = k % 2 ? -0.3 : -1.57; aL.rotation.z = -0.2; aR.rotation.z = 0.2;
        L.rotation.x = k === 1 ? -0.3 : 0; R.rotation.x = k === 3 ? -0.3 : 0;
        break;
      }
      case 4: { // 🌀 빙글빙글: 팔을 머리 위로 모으고 돎
        B.rotation.y = t * 5; B.position.y = Math.abs(sn(b)) * 0.04;
        aL.rotation.x = aR.rotation.x = -2.9; aL.rotation.z = 0.25; aR.rotation.z = -0.25;
        L.rotation.x = sn(b) * 0.2; R.rotation.x = -sn(b) * 0.2;
        break;
      }
      default: { // 💃 셔플: 발을 번갈아 차며 손뼉
        const st = sn(b);
        L.rotation.x = Math.max(0, st) * -0.7; R.rotation.x = Math.max(0, -st) * -0.7;
        B.position.y = Math.abs(st) * 0.05; B.rotation.y = st * 0.2;
        const clap = Math.abs(sn(b));
        aL.rotation.x = aR.rotation.x = -1.35; aL.rotation.z = 0.05 + clap * 0.5; aR.rotation.z = -0.05 - clap * 0.5;
      }
    }
  }
  // 💃 춤 (0 = 안 춤). 춤추는 동안은 활짝 웃는 얼굴
  setDance(id) {
    id = +id || 0;
    if (id === (this.danceId || 0)) return;
    const face = !!id !== !!this.danceId;
    this.danceId = id; this.danceT = 0;
    if (face) this.build(); // 웃는 얼굴 ↔ 평소 얼굴
    if (!id) { this.body.rotation.set(0, 0, 0); this.body.position.x = 0; }
  }
  // 🛴 킥보드 타기 (id 없으면 내림)
  setKick(id) {
    id = id || null;
    if (id === (this.kickId || null)) return;
    if (this.kick) { this.root.remove(this.kick); this.kick.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); this.kick = null; }
    this.kickId = id;
    if (id) { this.kick = makeKick(id); this.root.add(this.kick); }
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
    if (this.accGroup?.children.length) { // 날개 파닥 · 고리 둥실
      this.accT = (this.accT || 0) + dt;
      for (const a of this.accGroup.children) {
        if (a.userData.wings) a.userData.wings.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.35 + Math.sin(this.accT * (a.userData.id === 'butterfly' ? 7 : 3.5)) * 0.25)));
        if (a.userData.bob) a.position.y = Math.sin(this.accT * 2) * 0.015;
        if (a.userData.spin) a.userData.spin.rotation.y = this.accT * 1.6;
      }
    }
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
    if (this.kick) { // 🛴 발판 위에 서서 손잡이를 잡고, 달릴 때 오른발로 땅을 참
      const moving = this.speed > 0.6;
      this.kickT = (this.kickT || 0) + dt * (moving ? 4.2 : 0);
      const push = moving ? Math.max(0, Math.sin(this.kickT)) : 0;
      this.legL.rotation.x = -0.08; this.legR.rotation.x = 0.05 + push * 0.85;
      if (!this.boxing) { this.armL.rotation.x = this.armR.rotation.x = -1.05; this.armL.rotation.z = 0.04; this.armR.rotation.z = -0.04; }
      this.body.position.y = 0.1 + breathe + push * 0.015;
      for (const w of this.kick.userData.wheels) w.rotation.x += dt * this.speed / 0.06;
    }
    if (this.danceId && !this.sitting) this.dance(dt);
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
