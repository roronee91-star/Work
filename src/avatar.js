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

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
const SKIN = 0xf1c9a5, HAIR_M = 0x2a211b, HAIR_F = 0x3a281d;

function shade(hex, k) { return new THREE.Color(hex).multiplyScalar(k); }
function isLight(hex) { const c = new THREE.Color(hex); return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.6; }

function buildBody(gender, top) {
  const f = gender === 'f';
  const p = new Part();
  const shoulder = f ? 0.9 : 1.0;
  // 몸통 (상의)
  p.add(cap(0.19, 0.36), top, 0, 1.16, 0, { sx: shoulder, sz: 0.7 });
  // 목 · 머리
  p.add(G.cyl, SKIN, 0, 1.44, 0, { sx: 0.055, sy: 0.12, sz: 0.055 });
  p.add(G.sphere, SKIN, 0, 1.6, 0, { sx: 0.13, sy: 0.14, sz: 0.13 });
  p.add(G.sphereLo, SKIN, -0.13, 1.6, 0, { sx: 0.025, sy: 0.04, sz: 0.03 });
  p.add(G.sphereLo, SKIN, 0.13, 1.6, 0, { sx: 0.025, sy: 0.04, sz: 0.03 });
  // 얼굴
  for (const s of [-1, 1]) {
    p.add(G.sphereLo, 0x1a1512, s * 0.045, 1.612, 0.118, { sx: 0.017, sy: 0.022, sz: 0.012 });
    p.add(G.box, f ? HAIR_F : HAIR_M, s * 0.047, 1.655, 0.12, { sx: 0.04, sy: 0.009, sz: 0.01, rz: s * (f ? -0.12 : -0.05) });
    if (f) p.add(G.sphereLo, 0xf2a0a0, s * 0.075, 1.575, 0.105, { sx: 0.02, sy: 0.012, sz: 0.008 });
  }
  p.add(G.box, f ? 0xc9605f : 0xb0705f, 0, 1.545, 0.127, { sx: 0.035, sy: 0.009, sz: 0.008 });
  // 머리카락
  if (f) {
    p.add(G.halfSphere, HAIR_F, 0, 1.615, -0.005, { sx: 0.148, sy: 0.15, sz: 0.148 });
    p.add(cap(0.13, 0.2), HAIR_F, 0, 1.5, -0.045, { sx: 1.1, sz: 0.7 });           // 어깨까지 오는 긴 머리
    p.add(G.box, HAIR_F, -0.05, 1.7, 0.1, { sx: 0.13, sy: 0.05, sz: 0.04, rz: 0.25 }); // 앞머리
    p.add(G.box, HAIR_F, 0.06, 1.71, 0.1, { sx: 0.1, sy: 0.04, sz: 0.04, rz: -0.2 });
    for (const s of [-1, 1]) p.add(cap(0.04, 0.16), HAIR_F, s * 0.125, 1.53, 0.02);  // 옆머리
  } else {
    p.add(G.halfSphere, HAIR_M, 0, 1.625, -0.01, { sx: 0.145, sy: 0.13, sz: 0.145 });
    p.add(G.box, HAIR_M, 0.02, 1.71, 0.085, { sx: 0.2, sy: 0.05, sz: 0.06, rx: 0.4, rz: -0.12 }); // 옆으로 넘긴 앞머리
    for (const s of [-1, 1]) p.add(G.box, HAIR_M, s * 0.128, 1.63, -0.01, { sx: 0.025, sy: 0.08, sz: 0.16 });
  }
  // 옷깃 · 단추선
  const collar = isLight(top) ? 0x5b6b86 : 0xf4f2ee;
  if (f) {
    p.add(G.box, collar, 0, 1.4, 0.07, { sx: 0.16, sy: 0.025, sz: 0.04 });            // 블라우스 라운드 깃
  } else {
    for (const s of [-1, 1]) p.add(G.box, collar, s * 0.05, 1.41, 0.075, { sx: 0.07, sy: 0.03, sz: 0.045, rz: s * 0.6 }); // 셔츠 깃
    p.add(G.box, shade(top, 0.75), 0, 1.18, 0.133, { sx: 0.012, sy: 0.32, sz: 0.006 }); // 단추선
  }
  // 사원증 목걸이
  for (const s of [-1, 1]) p.add(G.box, 0x2b5dc9, s * 0.045, 1.3, 0.125, { sx: 0.012, sy: 0.2, sz: 0.008, rz: s * -0.22 });
  p.add(G.box, 0xffffff, 0, 1.15, 0.138, { sx: 0.075, sy: 0.1, sz: 0.008 });
  p.add(G.box, 0x2b5dc9, 0, 1.185, 0.143, { sx: 0.075, sy: 0.022, sz: 0.004 });
  // 하의 (몸에 붙는 부분)
  if (f) {
    const skirt = isLight(top) ? 0x3b4256 : 0xcbb79c;
    p.add(G.cone, skirt, 0, 0.72, 0, { sx: 0.25, sy: 0.4, sz: 0.2 });               // 플레어 스커트
    p.add(G.cyl, skirt, 0, 0.93, 0, { sx: 0.155, sy: 0.06, sz: 0.125 });
  } else {
    const pants = isLight(top) ? 0x2f3644 : 0xbba98b;
    p.add(cap(0.16, 0.06), pants, 0, 0.9, 0, { sx: 1.05, sy: 0.9, sz: 0.75 });
    p.add(G.box, 0x3a2a20, 0, 0.97, 0, { sx: 0.33, sy: 0.035, sz: 0.24 });            // 벨트
  }
  return p.mesh(MAT);
}
function buildLeg(gender, top) {
  const f = gender === 'f';
  const p = new Part();
  if (f) {
    p.add(cap(0.06, 0.56), 0xe8c2a0, 0, -0.38, 0);                                   // 다리
    p.add(G.box, 0x1b1b1f, 0, -0.81, 0.04, { sx: 0.1, sy: 0.06, sz: 0.2 });          // 단화
  } else {
    const pants = isLight(top) ? 0x2f3644 : 0xbba98b;
    p.add(cap(0.085, 0.58), pants, 0, -0.38, 0);
    p.add(G.box, 0xf3f3f3, 0, -0.8, 0.045, { sx: 0.12, sy: 0.08, sz: 0.24 });         // 운동화
    p.add(G.box, 0x2b5dc9, 0, -0.775, 0.045, { sx: 0.122, sy: 0.015, sz: 0.2 });
  }
  const m = p.mesh(MAT);
  return m;
}
function buildArm(gender, top) {
  const f = gender === 'f';
  const p = new Part();
  p.add(cap(f ? 0.055 : 0.062, 0.2), top, 0, -0.13, 0);                             // 소매
  p.add(G.cyl, isLight(top) ? shade(top, 0.85) : shade(top, 1.25), 0, -0.26, 0, { sx: f ? 0.058 : 0.065, sy: 0.04, sz: f ? 0.058 : 0.065 }); // 걷어 올린 소매 끝
  p.add(cap(f ? 0.043 : 0.048, 0.2), SKIN, 0, -0.39, 0);                            // 팔뚝
  p.add(G.sphereLo, SKIN, 0, -0.55, 0.005, { sx: 0.05, sy: 0.06, sz: 0.04 });        // 손
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

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025;
    this.root.add(shadow);

    this.name = name;
    this.label = makeSprite(name, { size: 40 }, 0.22);
    this.label.position.y = 1.98;
    this.root.add(this.label);
    this.bubble = null;
    this.bubbleUntil = 0;
    this.phase = 0;
    this.speed = 0;
    this.idle = Math.random() * 10;
  }

  build() {
    this.body.clear();
    const g = this.gender, top = this.color;
    const f = g === 'f';
    this.torso = buildBody(g, top);
    this.legL = buildLeg(g, top); this.legR = buildLeg(g, top);
    this.legL.position.set(-0.09, 0.86, 0); this.legR.position.set(0.09, 0.86, 0);
    this.armL = buildArm(g, top); this.armR = buildArm(g, top);
    const sx = f ? 0.235 : 0.26;
    this.armL.position.set(-sx, 1.37, 0); this.armR.position.set(sx, 1.37, 0);
    this.armL.rotation.z = -0.08; this.armR.rotation.z = 0.08;
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
    this.bubble.position.y = 2.25 + this.bubble.scale.y / 2 - 0.1 * lines;
    this.root.add(this.bubble);
    this.bubbleUntil = now + 6 + Math.min(text.length / 15, 6);
  }

  animate(dt, speed, now) {
    this.speed += (speed - this.speed) * Math.min(1, dt * 10);
    const s = Math.min(this.speed / 4, 1.2);
    this.phase += dt * (4 + this.speed * 2.2);
    const swing = Math.sin(this.phase) * 0.6 * s;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
    // 서 있을 때 숨쉬기
    this.idle += dt;
    const breathe = Math.sin(this.idle * 1.8) * 0.006 * (1 - Math.min(s * 3, 1));
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.035 * Math.min(s, 1) + breathe;
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
