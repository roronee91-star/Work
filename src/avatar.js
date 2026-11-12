// 캐릭터 (몸 · 이름표 · 말풍선 · 걷기 동작)
import * as THREE from 'three';

function labelTexture(text, { bg = 'rgba(10,12,18,0.72)', fg = '#fff', font = 600, size = 44, maxW = 560 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${font} ${size}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
  // 줄바꿈
  const words = [...text];
  const lines = [];
  let line = '';
  for (const ch of words) {
    if (ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; } else line += ch;
    if (lines.length >= 3) break;
  }
  if (lines.length < 3 && line) lines.push(line);
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width))) + 44;
  const lh = size * 1.3;
  const h = lines.length * lh + 26;
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  ctx.font = `${font} ${size}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
  ctx.fillStyle = bg;
  const r = 22;
  ctx.beginPath();
  ctx.roundRect(0, 0, c.width, c.height, r);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, c.width / 2, 13 + lh * (i + 0.5)));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: c.width / c.height, h: c.height };
}

function makeSprite(text, opt, height) {
  const { tex, aspect } = labelTexture(text, opt);
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(mat);
  s.scale.set(height * aspect, height, 1);
  s.renderOrder = 10;
  return s;
}

export class Avatar {
  constructor(name, color) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf0c8a8, roughness: 0.7 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.8 });
    this.shirtMat = shirt;

    const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
    // 다리 (엉덩이 높이에서 회전)
    const legGeo = new THREE.CapsuleGeometry(0.085, 0.62, 4, 8);
    legGeo.translate(0, -0.39, 0);
    this.legL = mk(legGeo, pants, -0.1, 0.86, 0);
    this.legR = mk(legGeo, pants, 0.1, 0.86, 0);
    // 몸통
    const torso = mk(new THREE.CapsuleGeometry(0.2, 0.42, 4, 12), shirt, 0, 1.15, 0);
    torso.scale.set(1, 1, 0.72);
    // 팔
    const armGeo = new THREE.CapsuleGeometry(0.06, 0.5, 4, 8);
    armGeo.translate(0, -0.3, 0);
    this.armL = mk(armGeo, shirt, -0.27, 1.38, 0);
    this.armR = mk(armGeo, shirt, 0.27, 1.38, 0);
    // 머리
    const head = mk(new THREE.SphereGeometry(0.135, 16, 12), skin, 0, 1.6, 0);
    const hairM = mk(new THREE.SphereGeometry(0.145, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.62, -0.01);
    // 눈 (앞쪽 = +z)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeGeo = new THREE.SphereGeometry(0.016, 6, 6);
    const eL = mk(eyeGeo, eyeMat, -0.045, 1.61, 0.125);
    const eR = mk(eyeGeo, eyeMat, 0.045, 1.61, 0.125);
    this.body.add(this.legL, this.legR, torso, this.armL, this.armR, head, hairM, eL, eR);

    // 바닥 그림자
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
    );
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
  }

  setColor(color) { this.shirtMat.color.set(color); }

  say(text, now) {
    if (this.bubble) { this.root.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); }
    this.bubble = makeSprite(text, { bg: 'rgba(255,255,255,0.94)', fg: '#111', font: 500, size: 40, maxW: 520 }, 0.3);
    const lines = Math.max(1, Math.round(this.bubble.scale.y / 0.3));
    this.bubble.position.y = 2.25 + this.bubble.scale.y / 2 - 0.1 * lines;
    this.root.add(this.bubble);
    this.bubbleUntil = now + 6 + Math.min(text.length / 15, 6);
  }

  // speed: m/s 실제 이동 속도
  animate(dt, speed, now) {
    this.speed += (speed - this.speed) * Math.min(1, dt * 10);
    const s = Math.min(this.speed / 4, 1.6);
    this.phase += dt * (4 + this.speed * 2.2);
    const swing = Math.sin(this.phase) * 0.65 * Math.min(s, 1.2);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.04 * Math.min(s, 1);
    if (this.bubble && now > this.bubbleUntil) {
      this.root.remove(this.bubble);
      this.bubble.material.map.dispose(); this.bubble.material.dispose();
      this.bubble = null;
    }
  }

  dispose() {
    this.root.traverse((o) => { if (o.material?.map) o.material.map.dispose(); });
  }
}
