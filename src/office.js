// 88층 사무실 내부: 로비 · 업무 공간 · 회의실 3개 · 라운지
import * as THREE from 'three';
import { CONFIG } from './config.js';

export const S = 17.5;      // 실내 반폭 (유리벽 위치)
export const CEIL = 4.2;

export const ZONES = {
  lobby: '로비',
  work: '업무 공간',
  lounge: '라운지',
  meetA: '회의실 A',
  meetB: '대회의실',
  meetC: '회의실 C',
};

export function zoneAt(x, z) {
  if (z < -11) return x < -6 ? 'meetA' : x > 6 ? 'meetC' : 'meetB';
  if (x < -6) return 'work';
  if (x > 6) return 'lounge';
  return 'lobby';
}

export const SPAWN = { x: 0, z: 13, yaw: Math.PI };
export const NOTICE_SPOT = { x: 7.6, z: 0 };

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createOffice() {
  const group = new THREE.Group();
  const colliders = [];

  const M = {
    stone: new THREE.MeshStandardMaterial({ color: 0x24272e, roughness: 0.22, metalness: 0.15 }),
    carpet: new THREE.MeshStandardMaterial({ color: 0x343a46, roughness: 0.95 }),
    carpetRoom: new THREE.MeshStandardMaterial({ color: 0x3b3430, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a3d2b, roughness: 0.55 }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0x8a6646, roughness: 0.5 }),
    walnut: new THREE.MeshStandardMaterial({ color: 0x2e2119, roughness: 0.45 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe9e6e0, roughness: 0.4 }),
    black: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9a9fa8, roughness: 0.35, metalness: 0.6 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xb59457, roughness: 0.3, metalness: 0.8 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x2f4f6b, roughness: 0.9 }),
    fabricWarm: new THREE.MeshStandardMaterial({ color: 0x8c5a3c, roughness: 0.9 }),
    fabricGray: new THREE.MeshStandardMaterial({ color: 0x55585f, roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.8 }),
    pot: new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9ec3e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.07, depthWrite: false }),
    glassRoom: new THREE.MeshStandardMaterial({ color: 0xbfd8f0, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.4, metalness: 0.5 }),
    lightStrip: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 1.08, 0.95) }),
    lightWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.9, 0.5) }),
    screen: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.55, 0.9) }),
  };

  function box(w, h, d, x, y, z, mat, opt = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    if (opt.ry) mesh.rotation.y = opt.ry;
    (opt.parent || group).add(mesh);
    if (opt.collide) colliders.push({ x1: x - w / 2, z1: z - d / 2, x2: x + w / 2, z2: z + d / 2, tall: !!opt.tall });
    return mesh;
  }
  function cyl(rt, rb, h, x, y, z, mat, seg = 16) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    mesh.position.set(x, y + h / 2, z);
    group.add(mesh);
    return mesh;
  }
  function addCollider(x1, z1, x2, z2, tall = false) { colliders.push({ x1, z1, x2, z2, tall }); }

  // ---------- 바닥 · 천장 ----------
  box(S * 2, 0.02, S * 2, 0, 0, 0, M.stone);
  box(11.4, 0.03, 28.4, -11.8, 0, 3.2, M.carpet);           // 업무 공간 카펫
  box(11.4, 0.03, 28.4, 11.8, 0, 3.2, M.woodLight);         // 라운지 원목 바닥
  box(S * 2, 0.03, 6.4, 0, 0, -14.3, M.carpetRoom);         // 회의실
  box(S * 2, 0.08, S * 2, 0, CEIL, 0, M.ceiling);

  // 천장 조명 줄
  for (const x of [-15.5, -12.5, -9.5]) box(0.14, 0.03, 26, x, CEIL - 0.03, 3.5, M.lightStrip);
  for (const z of [-7, -1, 5, 11]) box(9, 0.03, 0.14, 12, CEIL - 0.03, z, M.lightWarm);
  for (const x of [-12, 0, 12]) box(6, 0.03, 0.14, x, CEIL - 0.03, -14.3, M.lightStrip);
  // 로비 사각 조명 고리
  for (const [w, d, x, z] of [[9, 0.14, 0, 7.5], [9, 0.14, 0, 16.5], [0.14, 9, -4.5, 12], [0.14, 9, 4.5, 12]]) box(w, 0.03, d, x, CEIL - 0.03, z, M.lightWarm);

  // ---------- 바깥 유리벽 + 멀리언 ----------
  const glassH = CEIL;
  for (const [w, d, x, z] of [[S * 2, 0.02, 0, -S], [S * 2, 0.02, 0, S], [0.02, S * 2, -S, 0], [0.02, S * 2, S, 0]]) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, glassH, d), M.glass);
    g.position.set(x, glassH / 2, z);
    g.renderOrder = 2;
    group.add(g);
  }
  for (let t = -S; t <= S + 0.01; t += 2.5) {
    box(0.08, glassH, 0.14, t, 0, -S, M.frame); box(0.08, glassH, 0.14, t, 0, S, M.frame);
    box(0.14, glassH, 0.08, -S, 0, t, M.frame); box(0.14, glassH, 0.08, S, 0, t, M.frame);
  }
  for (const [w, d, x, z] of [[S * 2, 0.2, 0, -S], [S * 2, 0.2, 0, S], [0.2, S * 2, -S, 0], [0.2, S * 2, S, 0]]) box(w, 0.12, d, x, 0, z, M.frame);

  // ---------- 코어 (엘리베이터 · 로고 · 공지판) ----------
  box(12, CEIL, 10, 0, 0, 0, M.walnut, { collide: true, tall: true });
  // 로고 벽
  const logoTex = canvasTexture(1024, 384, (ctx, w, h) => {
    ctx.fillStyle = '#0b0c10'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#c9a35f'); g.addColorStop(0.5, '#f3dfae'); g.addColorStop(1, '#c9a35f');
    ctx.fillStyle = g;
    ctx.font = '700 120px "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(CONFIG.companyName, w / 2, h / 2 - 20);
    ctx.font = '400 40px sans-serif';
    ctx.fillStyle = '#9aa0ab';
    ctx.fillText(CONFIG.floorLabel + '  ·  RECEPTION', w / 2, h / 2 + 80);
  });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.25), new THREE.MeshBasicMaterial({ map: logoTex }));
  logo.position.set(0, 2.3, 5.02);
  group.add(logo);
  box(6.3, 0.05, 0.05, 0, 3.45, 5.03, M.lightWarm);
  box(6.3, 0.05, 0.05, 0, 1.15, 5.03, M.lightWarm);

  // 엘리베이터 (서쪽 면)
  for (const z of [-2.2, 2.2]) {
    box(0.06, 2.9, 1.9, -6.03, 0, z, M.frame);
    box(0.06, 2.7, 0.78, -6.06, 0, z - 0.4, M.gold);
    box(0.06, 2.7, 0.78, -6.06, 0, z + 0.4, M.gold);
    box(0.04, 0.2, 0.5, -6.08, 3.05, z, M.lightWarm);
  }
  // 엘리베이터 홀 표지
  const evTex = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0b0c10'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8d3a0'; ctx.font = '600 56px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ELEVATOR  ' + CONFIG.floorLabel, w / 2, h / 2);
  });
  const ev = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: evTex }));
  ev.position.set(-6.04, 3.6, 0); ev.rotation.y = -Math.PI / 2;
  group.add(ev);

  // 공지판 (동쪽 면) — 캔버스는 main.js에서 다시 그림
  const noticeCanvas = document.createElement('canvas');
  noticeCanvas.width = 1024; noticeCanvas.height = 576;
  const noticeTex = new THREE.CanvasTexture(noticeCanvas);
  noticeTex.colorSpace = THREE.SRGBColorSpace;
  box(0.08, 2.7, 4.8, 6.04, 0.85, 0, M.frame);
  const notice = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.53), new THREE.MeshBasicMaterial({ map: noticeTex }));
  notice.position.set(6.09, 2.2, 0); notice.rotation.y = Math.PI / 2;
  group.add(notice);

  // 북쪽 면: 대형 아트월
  const artTex = canvasTexture(1024, 400, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#0c1830'); g.addColorStop(0.5, '#3b2a5c'); g.addColorStop(1, '#c76a3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w, bh = 40 + Math.random() * 220, bw = 14 + Math.random() * 40;
      ctx.fillStyle = `rgba(5,8,16,${0.6 + Math.random() * 0.4})`;
      ctx.fillRect(x, h - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,210,140,0.7)';
      for (let k = 0; k < 6; k++) ctx.fillRect(x + Math.random() * bw, h - Math.random() * bh, 2, 3);
    }
  });
  const art = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), new THREE.MeshBasicMaterial({ map: artTex, color: 0xbbbbbb }));
  art.position.set(0, 2.2, -5.02); art.rotation.y = Math.PI;
  group.add(art);

  // ---------- 로비 ----------
  // 안내 데스크 (곡선 느낌을 3토막으로)
  box(4.2, 1.05, 0.9, 0, 0, 7.6, M.white, { collide: true });
  box(1.6, 1.05, 0.9, -2.75, 0, 7.15, M.white, { ry: 0.5 });
  box(1.6, 1.05, 0.9, 2.75, 0, 7.15, M.white, { ry: -0.5 });
  addCollider(-3.5, 6.5, -2.0, 7.8); addCollider(2.0, 6.5, 3.5, 7.8);
  box(4.4, 0.04, 1.0, 0, 1.05, 7.6, M.walnut);
  box(4.0, 0.03, 0.03, 0, 0.9, 8.06, M.lightWarm);
  // 로비 소파
  for (const sx of [-1, 1]) {
    const x = sx * 4.2;
    box(1.0, 0.42, 2.2, x, 0, 13.2, M.fabricGray, { collide: true });
    box(0.25, 0.85, 2.2, x + sx * 0.4, 0, 13.2, M.fabricGray);
  }
  cyl(0.45, 0.45, 0.4, -2.9, 0, 13.2, M.walnut); cyl(0.45, 0.45, 0.4, 2.9, 0, 13.2, M.walnut);

  // ---------- 화분 ----------
  function plant(x, z, s = 1) {
    cyl(0.35 * s, 0.28 * s, 0.6 * s, x, 0, z, M.pot);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 * s, 1), M.leaf);
    leaves.position.set(x, 1.15 * s, z); leaves.scale.y = 1.4;
    group.add(leaves);
    addCollider(x - 0.38 * s, z - 0.38 * s, x + 0.38 * s, z + 0.38 * s);
  }
  plant(-5.3, 16.6, 1.2); plant(5.3, 16.6, 1.2); plant(-5.2, 6, 1); plant(5.2, 6, 1);
  plant(-16.6, -10.2); plant(16.6, 16.6); plant(-16.6, 16.6); plant(7, -10.2, 0.9);

  // ---------- 의자 ----------
  function chair(x, z, ry, mat = M.black) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), mat); seat.position.y = 0.48;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.07), mat); back.position.set(0, 0.8, -0.24);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6), M.metal); pole.position.y = 0.23;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 10), M.metal); base.position.y = 0.03;
    g.add(seat, back, pole, base);
    g.position.set(x, 0, z); g.rotation.y = ry;
    group.add(g);
  }

  // ---------- 업무 공간 ----------
  for (const zc of [-7.5, -3, 1.5, 6, 10.5]) {
    const x1 = -16, x2 = -9.6;
    box(x2 - x1, 0.04, 1.6, (x1 + x2) / 2, 0.74, zc, M.white, { collide: true });
    box(x2 - x1, 0.72, 0.04, (x1 + x2) / 2, 0.02, zc, M.metal); // 가운데 칸막이 받침
    box(x2 - x1, 0.35, 0.03, (x1 + x2) / 2, 0.78, zc, M.fabric); // 칸막이
    for (let i = 0; i < 4; i++) {
      const x = x1 + 0.8 + i * 1.6;
      for (const s of [-1, 1]) {
        const mon = box(0.62, 0.38, 0.03, x, 0.95, zc + s * 0.45, M.black);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.33), M.screen);
        scr.position.set(x, 1.14, zc + s * 0.43);
        // 모니터 화면이 자리 쪽을 바라보도록
        scr.rotation.y = s > 0 ? 0 : Math.PI;
        scr.position.z = zc + s * 0.47;
        group.add(scr);
        mon.position.y = 1.14;
        chair(x, zc + s * 1.15, s > 0 ? Math.PI : 0);
      }
    }
  }
  // 창가 바 테이블 (업무 공간 남쪽)
  box(9, 0.05, 0.6, -12, 1.05, 16.6, M.walnut, { collide: true });
  for (let x = -15.5; x <= -8.5; x += 1.4) cyl(0.2, 0.2, 0.75, x, 0, 15.9, M.black, 10);

  // ---------- 회의실 ----------
  // 남쪽 유리 칸막이 (문 3곳)
  const doors = [-12, 0, 12];
  const segs = [[-S, -12.8], [-11.2, -0.8], [0.8, 11.2], [12.8, S]];
  for (const [a, b] of segs) {
    const w = b - a, cx = (a + b) / 2;
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, CEIL, 0.03), M.glassRoom);
    g.position.set(cx, CEIL / 2, -11); g.renderOrder = 2;
    group.add(g);
    addCollider(a, -11.1, b, -10.9, true);
    box(w, 0.06, 0.08, cx, 0, -11, M.frame); box(w, 0.06, 0.08, cx, CEIL - 0.06, -11, M.frame);
    box(w, 0.04, 0.035, cx, 1.1, -11, M.frame); // 젖빛 띠
  }
  for (const x of doors) {
    box(0.08, CEIL, 0.12, x - 0.82, 0, -11, M.frame); box(0.08, CEIL, 0.12, x + 0.82, 0, -11, M.frame);
    box(1.72, CEIL - 2.4, 0.12, x, 2.4, -11, M.frame);
  }
  // 칸막이 벽
  box(0.2, CEIL, 6.5, -6, 0, -14.25, M.wood, { collide: true, tall: true });
  box(0.2, CEIL, 6.5, 6, 0, -14.25, M.wood, { collide: true, tall: true });
  // 회의실 표지
  const roomNames = [['회의실 A', -12], ['대회의실', 0], ['회의실 C', 12]];
  for (const [name, x] of roomNames) {
    const tex = canvasTexture(512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#0b0c10'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f0e2c0'; ctx.font = '600 64px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, w / 2, h / 2);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(x, 3.1, -10.92);
    group.add(sign);
  }
  // 테이블 + 의자 + TV
  function meetingTable(cx, len, seats) {
    box(len, 0.06, 1.5, cx, 0.74, -14.6, M.walnut, { collide: true });
    box(0.3, 0.72, 0.3, cx - len / 2 + 0.6, 0.02, -14.6, M.black);
    box(0.3, 0.72, 0.3, cx + len / 2 - 0.6, 0.02, -14.6, M.black);
    for (let i = 0; i < seats; i++) {
      const x = cx - len / 2 + 0.6 + (i * (len - 1.2)) / Math.max(seats - 1, 1);
      chair(x, -13.45, Math.PI, M.fabricWarm);
      chair(x, -15.75, 0, M.fabricWarm);
    }
  }
  meetingTable(-12, 5, 4);
  meetingTable(0, 7.5, 5);
  meetingTable(12, 5, 4);
  function tv(x, z, ry, label) {
    const tex = canvasTexture(640, 360, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#16223f'); g.addColorStop(1, '#2d5a8a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff'; ctx.font = '700 46px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label, w / 2, h / 2 - 10);
      ctx.font = '400 26px sans-serif'; ctx.fillStyle = '#b8c8e8';
      ctx.fillText(CONFIG.companyName + ' · 화면 공유 대기 중', w / 2, h / 2 + 40);
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 0.06), M.black);
    frame.position.set(x, 1.9, z); frame.rotation.y = ry; group.add(frame);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.4), new THREE.MeshBasicMaterial({ map: tex }));
    scr.position.set(x + Math.sin(ry) * 0.04, 1.9, z + Math.cos(ry) * 0.04); scr.rotation.y = ry; group.add(scr);
  }
  tv(-6.12, -14.6, -Math.PI / 2, '회의실 A');
  tv(-5.88, -14.6, Math.PI / 2, '대회의실');
  tv(6.12, -14.6, Math.PI / 2, '회의실 C');

  // ---------- 라운지 ----------
  // 커피 바
  box(7, 1.05, 0.7, 12.5, 0, -8.25, M.walnut, { collide: true });
  box(7.2, 0.05, 0.8, 12.5, 1.05, -8.25, M.white);
  box(6.8, 0.03, 0.03, 12.5, 0.95, -7.88, M.lightWarm);
  box(7, 0.95, 0.6, 12.5, 0, -10.55, M.walnut, { collide: true });
  box(0.6, 0.55, 0.45, 10.5, 0.95, -10.55, M.metal);   // 커피 머신
  box(0.6, 0.55, 0.45, 11.4, 0.95, -10.55, M.black);
  for (let x = 9.5; x <= 15.5; x += 1.2) cyl(0.2, 0.2, 0.75, x, 0, -7.4, M.black, 10);
  // 소파 세트
  function sofaSet(cx, cz) {
    box(3.2, 0.42, 0.95, cx, 0, cz - 1.6, M.fabric, { collide: true });
    box(3.2, 0.85, 0.22, cx, 0, cz - 2.0, M.fabric);
    box(0.95, 0.42, 2.4, cx + 2.1, 0, cz - 0.3, M.fabric, { collide: true });
    box(0.22, 0.85, 2.4, cx + 2.5, 0, cz - 0.3, M.fabric);
    box(1.6, 0.38, 1.0, cx, 0, cz, M.walnut, { collide: true });
    cyl(0.35, 0.35, 0.45, cx - 1.9, 0, cz + 0.9, M.fabricWarm);
  }
  sofaSet(12.5, -1.5);
  sofaSet(12.5, 6.5);
  // 창가 바
  box(8.5, 0.05, 0.6, 12.3, 1.05, 16.6, M.walnut, { collide: true });
  for (let x = 8.6; x <= 16; x += 1.4) cyl(0.2, 0.2, 0.75, x, 0, 15.9, M.black, 10);
  // 동쪽 창가 빈백
  for (const z of [11, 13.5]) {
    const bb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10), M.fabricWarm);
    bb.position.set(16.3, 0.35, z); bb.scale.set(1, 0.65, 1); group.add(bb);
  }

  // ---------- 조명 ----------
  group.add(new THREE.HemisphereLight(0x7d8cc0, 0x2a2018, 0.75));
  group.add(new THREE.AmbientLight(0xffffff, 0.08));
  const pl = (x, y, z, c, i) => { const l = new THREE.PointLight(c, i, 18, 2); l.position.set(x, y, z); group.add(l); };
  pl(0, 3.8, 11, 0xffd2a0, 12);
  pl(-12, 3.8, 2, 0xe8eeff, 12);
  pl(12, 3.8, 2, 0xffc890, 12);
  pl(0, 3.6, -14.3, 0xfff0d8, 10);

  return {
    group,
    colliders,
    notice: { canvas: noticeCanvas, texture: noticeTex },
  };
}
