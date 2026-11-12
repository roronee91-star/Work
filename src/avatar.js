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
const SKIN = 0xffe0c4, HAIR = 0x3b2516, EYE = 0x241a16;
export const SCALE = 1.0; // 2등신 캐릭터 (약 1.05m, 교회 메타버스와 같은 크기)

function shade(hex, k) { return new THREE.Color(hex).multiplyScalar(k); }
function isLight(hex) { const c = new THREE.Color(hex); return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.6; }
const bottomOf = (g, top) => g === 'f' ? (isLight(top) ? 0x39415a : 0xc9b59a) : (isLight(top) ? 0x353c4a : 0xb9a888);

// 머리 + 몸통 (굳은 부분) — 교회 메타버스 캐릭터와 같은 비율, 옷만 회사원 차림
function buildBody(gender, top) {
  const f = gender === 'f';
  const p = new Part();
  const bottom = bottomOf(gender, top);
  // 상의 (셔츠 / 블라우스)
  p.add(new THREE.CylinderGeometry(0.15, 0.185, 0.26, 20), top, 0, 0.41, 0);
  p.add(new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), top, 0, 0.54, 0, { sy: 0.35 });
  const collar = isLight(top) ? 0x56667f : 0xffffff;
  if (f) {
    p.add(new THREE.TorusGeometry(0.075, 0.018, 8, 20), collar, 0, 0.555, 0.02, { rx: Math.PI / 2 - 0.25 });      // 둥근 깃
  } else {
    for (const sx of [-1, 1]) p.add(new THREE.ConeGeometry(0.035, 0.07, 3), collar, sx * 0.04, 0.545, 0.11, { rx: Math.PI / 2 + 0.5, rz: sx * 0.9 }); // 셔츠 깃
    p.add(new THREE.BoxGeometry(0.008, 0.2, 0.005), shade(top, 0.72), 0, 0.42, 0.18, { rx: -0.14 });             // 단추선
    for (const y of [0.48, 0.42, 0.36]) p.add(new THREE.SphereGeometry(0.007, 6, 4), 0xffffff, 0, y, 0.18 + (0.5 - y) * 0.14);
  }
  // 사원증 목걸이
  for (const sx of [-1, 1]) p.add(new THREE.BoxGeometry(0.01, 0.13, 0.006), 0x2b5dc9, sx * 0.032, 0.5, 0.15, { rx: -0.35, rz: sx * 0.25 });
  p.add(new THREE.BoxGeometry(0.065, 0.085, 0.008), 0xffffff, 0, 0.415, 0.183, { rx: -0.14 });
  p.add(new THREE.BoxGeometry(0.065, 0.02, 0.004), 0x2b5dc9, 0, 0.445, 0.188, { rx: -0.14 });
  // 하의
  if (f) {
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
  p.add(new THREE.SphereGeometry(0.272, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), HAIR, 0, H, -0.01, { rx: -0.42 });
  for (const sx of [-1, 1]) p.add(new THREE.SphereGeometry(0.09, 12, 10), HAIR, sx * 0.21, H + 0.04, 0.05, { sx: 0.55, sy: 1.15, sz: 0.9 });
  for (const [x, y, rz] of [[-0.1, 0.118, -0.35], [0, 0.128, 0], [0.1, 0.118, 0.35]]) p.add(new THREE.SphereGeometry(0.08, 14, 10), HAIR, x, H + y, 0.19, { sx: 0.95, sy: 0.42, sz: 0.5, rz });
  if (f) {
    p.add(new THREE.SphereGeometry(0.27, 24, 18), HAIR, 0, H - 0.1, -0.08, { sx: 1.02, sy: 1.32, sz: 0.82 });    // 긴 뒷머리
    for (const sx of [-1, 1]) {
      p.add(new THREE.SphereGeometry(0.085, 12, 12), HAIR, sx * 0.215, H - 0.13, 0.03, { sx: 0.55, sy: 1.9, sz: 0.75 });
      p.add(new THREE.SphereGeometry(0.07, 12, 10), HAIR, sx * 0.2, H - 0.3, 0, { sx: 0.7, sy: 0.8, sz: 0.8 });
    }
    for (const sx of [-1, 1]) p.add(new THREE.ConeGeometry(0.05, 0.09, 4), 0xf28bb0, 0.16 + sx * 0.045, H + 0.2, 0.06, { rz: sx * Math.PI / 2 }); // 리본
    p.add(new THREE.SphereGeometry(0.022, 10, 8), 0xf28bb0, 0.16, H + 0.2, 0.065);
  } else {
    p.add(new THREE.ConeGeometry(0.022, 0.08, 8), HAIR, 0.03, H + 0.275, 0.02, { rx: -0.5, rz: -0.4 });            // 삐침 머리
  }
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
function buildLeg(gender, top) {
  const f = gender === 'f';
  const p = new Part();
  const leg = f ? 0x2a2a31 : bottomOf(gender, top);
  p.add(new THREE.CylinderGeometry(0.065, 0.06, 0.13, 12), leg, 0, -0.065, 0);
  p.add(new THREE.CylinderGeometry(0.058, 0.055, 0.1, 12), leg, 0, -0.18, 0);
  p.add(new THREE.SphereGeometry(0.07, 14, 10), f ? 0x1d1d22 : 0xf5f5f2, 0, -0.235, 0.03, { sx: 0.9, sy: 0.55, sz: 1.35 });
  p.add(new THREE.CylinderGeometry(0.065, 0.065, 0.018, 14), f ? 0x111114 : 0x9aa0a8, 0, -0.26, 0.03, { sx: 0.95, sz: 1.4 });
  return p.mesh(MAT);
}
// 팔 (어깨 관절 기준)
function buildArm(gender, top) {
  const p = new Part();
  p.add(new THREE.SphereGeometry(0.05, 12, 10), top, 0, 0, 0);
  p.add(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 12), top, 0, -0.11, 0);
  p.add(new THREE.CylinderGeometry(0.049, 0.049, 0.03, 12), isLight(top) ? shade(top, 0.85) : 0xffffff, 0, -0.215, 0); // 소맷부리
  p.add(new THREE.SphereGeometry(0.048, 12, 10), SKIN, 0, -0.26, 0);
  return p.mesh(MAT);
}

export class Avatar {
  constructor(name, color, gender = 'm') {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.gender = gender === 'f' ? 'f' : 'm';
    this.color = color;
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
    this.sitting = false; this.sitH = 0;
    this.boxing = false; this.punchAt = -9; this.punchSide = false;
  }

  build() {
    this.body.clear();
    const g = this.gender, top = this.color;
    const f = g === 'f';
    this.torso = buildBody(g, top);
    this.legL = buildLeg(g, top); this.legR = buildLeg(g, top);
    this.legL.position.set(-0.085, 0.25, 0); this.legR.position.set(0.085, 0.25, 0);
    this.armL = buildArm(g, top); this.armR = buildArm(g, top);
    this.armL.position.set(-0.18, 0.52, 0); this.armR.position.set(0.18, 0.52, 0);
    this.armL.rotation.z = -0.12; this.armR.rotation.z = 0.12;
    void f;
    this.body.scale.setScalar(SCALE);
    this.body.add(this.torso, this.legL, this.legR, this.armL, this.armR);
  }

  setLook(color, gender) {
    const g = gender === 'f' ? 'f' : 'm';
    if (color === this.color && g === this.gender) return;
    this.dispose(true);
    this.color = color; this.gender = g;
    this.build();
  }
  setColor(color) { this.setLook(color, this.gender); }

  say(text, now) {
    if (this.bubble) { this.root.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); }
    this.bubble = makeSprite(text, { bg: 'rgba(255,255,255,0.94)', fg: '#111', font: 500, size: 40, maxW: 520 }, 0.3);
    const lines = Math.max(1, Math.round(this.bubble.scale.y / 0.3));
    this.bubble.position.y = 1.5 + this.bubble.scale.y / 2 - 0.1 * lines;
    this.root.add(this.bubble);
    this.bubbleUntil = now + 6 + Math.min(text.length / 15, 6);
  }

  setSit(on, h = 0.42) { this.sitting = on; this.sitH = h; }
  setBoxing(on) { this.boxing = on; }
  punch(now) { this.punchAt = now; this.punchSide = !this.punchSide; }

  animate(dt, speed, now) {
    if (this.sitting) {
      // 앉은 자세: 다리는 앞으로, 손은 무릎 위
      this.legL.rotation.x = this.legR.rotation.x = -1.45;
      this.armL.rotation.x = this.armR.rotation.x = -0.55;
      this.idle += dt;
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
    if (this.boxing) {
      // 가드 자세, 펀치할 때 한쪽 팔을 쭉 뻗음
      const p = Math.max(0, 1 - (now - this.punchAt) / 0.16);
      this.armL.rotation.x = this.armR.rotation.x = -1.2;
      this.armL.rotation.z = 0.32; this.armR.rotation.z = -0.32;
      const arm = this.punchSide ? this.armR : this.armL;
      arm.rotation.x = -1.2 - 0.45 * p;
      arm.rotation.z *= 1 - p;
      this.body.rotation.y = (this.punchSide ? -1 : 1) * 0.18 * p;
    } else this.body.rotation.y = 0;
    // 서 있을 때 숨쉬기
    this.idle += dt;
    const breathe = Math.sin(this.idle * 1.8) * 0.006 * (1 - Math.min(s * 3, 1));
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.04 * Math.min(s, 1) + breathe;
    this.torso.scale.y = 1 + breathe * 0.5;
    if (this.bubble && now > this.bubbleUntil) {
      this.root.remove(this.bubble);
      this.bubble.material.map.dispose(); this.bubble.material.dispose();
      this.bubble = null;
    }
  }

  dispose(bodyOnly = false) {
    for (const m of [this.torso, this.legL, this.legR, this.armL, this.armR]) m?.geometry.dispose();
    if (bodyOnly) return;
    this.root.traverse((o) => { if (o.material?.map) o.material.map.dispose(); });
  }
}
