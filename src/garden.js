// 사옥 앞 정원: 잔디 · 산책길 · 분수 · 꽃밭 · 나무 · 산울타리 · 벤치 · 정원등
import * as THREE from 'three';
import { Kit, MATERIALS as M, canvasTex } from './building.js';
import { HX, HZ, LOT } from './building.js';
import { CONFIG } from './config.js';

const FOUNTAIN = { x: 0, z: 17 };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function createGarden() {
  const group = new THREE.Group();
  const colliders = [];
  const col = (x1, z1, x2, z2) => colliders.push({ x1, z1, x2, z2, tall: false });
  const k = new Kit();
  const rand = rng(77);

  const paver = new THREE.MeshStandardMaterial({ color: 0x8c877d, roughness: 0.85 });
  const path = new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 0.8 });
  const lawn = new THREE.MeshStandardMaterial({ color: 0x4f7f35, roughness: 0.95 });
  const lawnDark = new THREE.MeshStandardMaterial({ color: 0x3f6c2b, roughness: 0.95 });
  const hedge = new THREE.MeshStandardMaterial({ color: 0x2d5a2a, roughness: 0.9, flatShading: true });
  const shrub = new THREE.MeshStandardMaterial({ color: 0x365f2c, roughness: 0.9, flatShading: true });
  const stone = new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 0.6 });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
  const canopyA = new THREE.MeshStandardMaterial({ color: 0x3d7a3a, roughness: 0.85, flatShading: true });
  const canopyB = new THREE.MeshStandardMaterial({ color: 0x55893a, roughness: 0.85, flatShading: true });
  const blossom = new THREE.MeshStandardMaterial({ color: 0xe8a9bf, roughness: 0.8, flatShading: true });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.7 });
  const bollardTop = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.6) });
  const BOLLARD = bollardTop.color.clone();

  const L = LOT + 0.5;
  // 바닥: 단 높인 부지 · 건물 둘레 포장
  k.box(L * 2 + 1, 0.28, L * 2 + 1, 0, -0.3, 0, paver);
  // 잔디 (건물과 길을 피해서)
  const lawns = [
    [-L, -L, -HX - 1.6, L], [HX + 1.6, -L, L, L],
    [-HX - 1.6, -L, HX + 1.6, -HZ - 1.6],
    [-HX - 1.6, HZ + 2, -2.2, L], [2.2, HZ + 2, HX + 1.6, L],
  ];
  for (const [x1, z1, x2, z2] of lawns) k.box(x2 - x1, 0.04, z2 - z1, (x1 + x2) / 2, -0.03, (z1 + z2) / 2, lawn);
  // 잔디 줄무늬 (깎은 결)
  for (let x = -L + 1; x < L; x += 2) {
    if (Math.abs(x) < HX + 2) continue;
    k.box(1, 0.01, L * 2 - 0.4, x, 0.01, 0, lawnDark);
  }
  // 길: 입구 → 분수 → 남쪽 출입구, 동서 산책길, 건물 둘레
  k.box(4, 0.05, L - HZ, 0, -0.02, (L + HZ) / 2, path);
  k.box(L * 2, 0.05, 3, 0, -0.02, FOUNTAIN.z, path);
  // 분수 광장 (둥근 포장)
  k.cyl(9, 0.06, FOUNTAIN.x, -0.01, FOUNTAIN.z, path, 48);
  k.cyl(9.25, 0.04, FOUNTAIN.x, -0.02, FOUNTAIN.z, stone, 48);
  // 북쪽 정원 디딤돌
  for (let i = 0; i < 9; i++) {
    const x = -8 + i * 2;
    k.cyl(0.45, 0.05, x, 0.0, -HZ - 5 + Math.sin(i * 1.3) * 0.6, stone, 10);
  }

  // ---------- 분수 ----------
  const fx = FOUNTAIN.x, fz = FOUNTAIN.z;
  k.cyl(3.7, 0.55, fx, 0, fz, stone, 40);
  k.cyl(3.85, 0.08, fx, 0.55, fz, stone, 40);
  k.cyl(0.55, 1.25, fx, 0.4, fz, stone, 20, 0.4);
  k.cyl(1.25, 0.22, fx, 1.5, fz, stone, 28, 1.35);
  k.cyl(0.18, 0.5, fx, 1.7, fz, stone, 10, 0.12);
  col(fx - 3.8, fz - 3.8, fx + 3.8, fz + 3.8);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2d76a6, roughness: 0.08, metalness: 0.25, emissive: 0x0b3550, transparent: true, opacity: 0.92 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.45, 40), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(fx, 0.5, fz);
  group.add(water);
  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), waterMat);
  bowlWater.rotation.x = -Math.PI / 2; bowlWater.position.set(fx, 1.73, fz);
  group.add(bowlWater);
  // 물결 고리
  const ripples = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.5, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(fx, 0.51, fz);
    group.add(m); ripples.push({ m, t: i / 3 });
  }
  // 물방울
  const N = 320;
  const drops = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const spawn = (i, fresh) => {
    const top = i % 3 !== 0; // 2/3는 꼭대기 물줄기, 1/3은 그릇 가장자리에서 떨어짐
    const a = Math.random() * Math.PI * 2;
    if (top) {
      drops.set([fx, 2.15, fz], i * 3);
      const r = 0.35 + Math.random() * 0.45;
      vel.set([Math.cos(a) * r, 3.6 + Math.random() * 0.9, Math.sin(a) * r], i * 3);
    } else {
      drops.set([fx + Math.cos(a) * 1.3, 1.68, fz + Math.sin(a) * 1.3], i * 3);
      vel.set([Math.cos(a) * 0.45, 0.2, Math.sin(a) * 0.45], i * 3);
    }
    if (fresh) { // 처음엔 시간차를 두고 흩뿌림
      const t = Math.random() * 0.9;
      for (let c = 0; c < 3; c++) drops[i * 3 + c] += vel[i * 3 + c] * t;
      drops[i * 3 + 1] -= 4.9 * t * t;
      vel[i * 3 + 1] -= 9.8 * t;
      if (drops[i * 3 + 1] < 0.5) spawn(i, false);
    }
  };
  for (let i = 0; i < N; i++) spawn(i, true);
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(drops, 3));
  const dropMat = new THREE.PointsMaterial({ color: 0xd8efff, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false });
  const points = new THREE.Points(dropGeo, dropMat);
  points.frustumCulled = false;
  group.add(points);
  // 분수 조명 (밤에 물을 비춤) — 항상 같은 개수
  const fLight = new THREE.PointLight(0xffe2b8, 14, 22, 2);
  fLight.position.set(fx, 3.2, fz);
  group.add(fLight);

  // 분수 둘레 꽃 고리 + 벤치
  const flowers = [];
  const flowerColors = [0xff5f7e, 0xffd23f, 0xff9fd0, 0xffffff, 0xb784ff, 0xff8a3d];
  const ring = (r, step, gaps) => {
    for (let a = 0; a < Math.PI * 2; a += step) {
      const x = fx + Math.cos(a) * r, z = fz + Math.sin(a) * r;
      if (gaps(x, z)) continue;
      flowers.push([x, z, flowerColors[Math.floor(rand() * flowerColors.length)]]);
    }
  };
  const onPaths = (x, z) => Math.abs(x) < 2.4 || Math.abs(z - fz) < 1.9;
  ring(4.3, 0.09, onPaths); ring(4.7, 0.085, onPaths);
  for (const a of [0.8, 2.35, 3.95, 5.5]) {
    const r = 7, x = fx + Math.cos(a) * r, z = fz + Math.sin(a) * r;
    const ry = Math.atan2(fx - x, fz - z); // 분수를 바라봄
    const s = Math.sin(ry), c = Math.cos(ry);
    k.box(1.8, 0.08, 0.5, x, 0.42, z, wood, ry);
    k.box(1.8, 0.45, 0.06, x - s * 0.24, 0.5, z - c * 0.24, wood, ry);
    k.box(0.08, 0.42, 0.45, x + c * 0.8, 0, z - s * 0.8, M.black, ry);
    k.box(0.08, 0.42, 0.45, x - c * 0.8, 0, z + s * 0.8, M.black, ry);
    col(x - 0.9, z - 0.9, x + 0.9, z + 0.9);
  }

  // ---------- 건물 앞 화단 (입구 양옆) ----------
  for (const sx of [-1, 1]) {
    const cx = sx * 6, cz = HZ + 1.5;
    k.box(7, 0.45, 1.3, cx, 0, cz, stone);
    col(cx - 3.5, cz - 0.65, cx + 3.5, cz + 0.65);
    for (let i = 0; i < 6; i++) k.ball(0.38 + rand() * 0.15, cx - 2.8 + i * 1.1, 0.7, cz, shrub, 0.8);
    for (let i = 0; i < 40; i++) flowers.push([cx - 3.2 + rand() * 6.4, cz - 0.5 + rand() * 1.0, flowerColors[Math.floor(rand() * flowerColors.length)], 0.48]);
  }

  // ---------- 꽃밭 (동서 잔디 위 타원) ----------
  const bed = (cx, cz, rx, rz, n) => {
    k.cyl(1, 0.06, cx, -0.01, cz, new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), 24);
    // (위 원판은 아래에서 타원으로 늘림)
    const last = k.parts.get([...k.parts.keys()].pop());
    last[last.length - 1].scale(rx, 1, rz).translate(cx - cx * rx, 0, cz - cz * rz);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.92;
      flowers.push([cx + Math.cos(a) * rx * r, cz + Math.sin(a) * rz * r, flowerColors[Math.floor(rand() * flowerColors.length)]]);
    }
    col(cx - rx, cz - rz, cx + rx, cz + rz);
  };
  bed(-20, 6, 4.5, 2.2, 160);
  bed(20, 6, 4.5, 2.2, 160);
  bed(-20, -16, 3.2, 3.2, 120);
  bed(22, -16, 3.2, 3.2, 120);

  // ---------- 나무 ----------
  const treeSpots = [
    [-25, -25], [-16, -26], [-6, -24], [6, -25], [16, -24], [25, -26],
    [-26, -6], [-27, 13], [-25, 25], [-14, 27], [-8, 25],
    [26, -5], [27, 12], [25, 26], [14, 27], [8, 25],
    [-16, 22], [16, 22], [-15, -6], [15, -6],
  ];
  treeSpots.forEach(([x, z], i) => {
    const s = 0.85 + rand() * 0.4;
    const leaf = i % 5 === 2 ? blossom : (i % 2 ? canopyA : canopyB);
    k.cyl(0.18 * s, 2.4 * s, x, 0, z, trunk, 7, 0.12 * s);
    k.ball(1.6 * s, x, 3.2 * s, z, leaf, 0.9);
    k.ball(1.1 * s, x + 0.8 * s, 3.8 * s, z + 0.3 * s, leaf);
    k.ball(1.0 * s, x - 0.7 * s, 3.6 * s, z - 0.5 * s, leaf);
    col(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
  });
  // 덤불 (잔디 군데군데)
  for (let i = 0; i < 26; i++) {
    const x = (rand() < 0.5 ? -1 : 1) * (13 + rand() * 17), z = -28 + rand() * 56;
    if (Math.abs(z - fz) < 3 || Math.abs(z - 6) < 3 || Math.abs(z + 16) < 4.5) continue;
    k.ball(0.5 + rand() * 0.4, x, 0.35, z, shrub, 0.75);
  }

  // ---------- 산울타리 (부지 가장자리, 길 자리만 열림) ----------
  const hedgeLine = (x1, z1, x2, z2) => {
    const w = Math.abs(x2 - x1) || 0.8, d = Math.abs(z2 - z1) || 0.8;
    k.box(w, 0.9, d, (x1 + x2) / 2, 0, (z1 + z2) / 2, hedge);
    col(Math.min(x1, x2) - (w === 0.8 ? 0.4 : 0), Math.min(z1, z2) - (d === 0.8 ? 0.4 : 0), Math.max(x1, x2) + (w === 0.8 ? 0.4 : 0), Math.max(z1, z2) + (d === 0.8 ? 0.4 : 0));
  };
  hedgeLine(-L, L, -2.5, L); hedgeLine(2.5, L, L, L);
  hedgeLine(-L, -L, L, -L);
  hedgeLine(-L, -L, -L, fz - 2); hedgeLine(-L, fz + 2, -L, L);
  hedgeLine(L, -L, L, fz - 2); hedgeLine(L, fz + 2, L, L);

  // ---------- 퍼걸러 (서쪽 잔디) ----------
  {
    const px = -21, pz = -6;
    for (const [dx, dz] of [[-2, -1.4], [2, -1.4], [-2, 1.4], [2, 1.4]]) { k.box(0.18, 2.6, 0.18, px + dx, 0, pz + dz, wood); col(px + dx - 0.15, pz + dz - 0.15, px + dx + 0.15, pz + dz + 0.15); }
    k.box(4.6, 0.15, 0.15, px, 2.6, pz - 1.4, wood); k.box(4.6, 0.15, 0.15, px, 2.6, pz + 1.4, wood);
    for (let i = 0; i < 9; i++) k.box(0.1, 0.12, 3.4, px - 2 + i * 0.5, 2.75, pz, wood);
    k.box(3, 0.08, 0.55, px, 0.42, pz + 0.9, wood); k.box(3, 0.45, 0.06, px, 0.5, pz + 1.15, wood);
    k.box(3, 0.08, 0.55, px, 0.42, pz - 0.9, wood); k.box(3, 0.45, 0.06, px, 0.5, pz - 1.15, wood);
    col(px - 1.5, pz + 0.6, px + 1.5, pz + 1.2); col(px - 1.5, pz - 1.2, px + 1.5, pz - 0.6);
    k.cyl(0.45, 0.7, px, 0, pz, wood, 12); col(px - 0.45, pz - 0.45, px + 0.45, pz + 0.45);
    for (let i = 0; i < 14; i++) k.ball(0.25 + rand() * 0.2, px - 2.1 + rand() * 4.2, 2.85, pz - 1.5 + rand() * 3, i % 3 ? canopyA : blossom, 0.6);
  }

  // ---------- 정원등 (길 따라) ----------
  const bollards = [];
  for (let z = HZ + 3.5; z <= L - 1; z += 3.2) { if (Math.abs(z - fz) > 9.6) bollards.push([-2.5, z], [2.5, z]); }
  for (let x = -L + 2; x <= L - 2; x += 3.6) { if (Math.abs(x) > 9.6) bollards.push([x, fz - 1.9], [x, fz + 1.9]); }
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) bollards.push([fx + Math.cos(a + 0.26) * 9.4, fz + Math.sin(a + 0.26) * 9.4]);
  for (const [x, z] of bollards) {
    k.cyl(0.09, 0.75, x, 0, z, M.black, 8);
    k.cyl(0.1, 0.1, x, 0.75, z, bollardTop, 8);
  }

  // ---------- 표지석 ----------
  k.box(3.2, 1.1, 0.8, 5.2, 0, L - 2.2, stone); col(3.6, L - 2.6, 6.8, L - 1.8);
  const sign = canvasTex(768, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2d2b28'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e9d6a6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 120px "Pretendard","Noto Sans KR",sans-serif'; ctx.fillText(CONFIG.companyName, w / 2, h / 2 + 6);
  });
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.9), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.6 }));
  signMesh.position.set(5.2, 0.6, L - 1.79);
  group.add(signMesh);

  k.flush(group);

  // 꽃 (색마다 다른 꽃송이 하나의 인스턴스로)
  const fGeo = new THREE.IcosahedronGeometry(0.13, 0);
  const fMesh = new THREE.InstancedMesh(fGeo, new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }), flowers.length);
  const leafGeo = new THREE.IcosahedronGeometry(0.2, 0);
  const lMesh = new THREE.InstancedMesh(leafGeo, shrub, flowers.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  flowers.forEach(([x, z, color, y0 = 0], i) => {
    const s = 0.8 + rand() * 0.5;
    m.makeScale(s, s * 0.8, s); m.setPosition(x, y0 + 0.28 + rand() * 0.12, z);
    fMesh.setMatrixAt(i, m); fMesh.setColorAt(i, c.set(color));
    m.makeScale(s, 0.7 * s, s); m.setPosition(x + 0.05, y0 + 0.12, z - 0.04);
    lMesh.setMatrixAt(i, m);
  });
  group.add(fMesh, lMesh);

  return {
    group,
    colliders,
    setDay(d) {
      bollardTop.color.copy(BOLLARD).multiplyScalar(1 - 0.8 * d);
      fLight.intensity = 14 * (1 - d);
      waterMat.emissive.setRGB(0.045 * (1 - d), 0.2 * (1 - d), 0.31 * (1 - d));
    },
    update(dt) {
      const p = dropGeo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        vel[j + 1] -= 9.8 * dt;
        p[j] += vel[j] * dt; p[j + 1] += vel[j + 1] * dt; p[j + 2] += vel[j + 2] * dt;
        const inBowl = Math.hypot(p[j] - fx, p[j + 2] - fz) < 1.15 && p[j + 1] < 1.75 && vel[j + 1] < 0;
        if (p[j + 1] < 0.5 || inBowl) spawn(i, false);
      }
      dropGeo.attributes.position.needsUpdate = true;
      for (const r of ripples) {
        r.t = (r.t + dt * 0.35) % 1;
        const s = 1.4 + r.t * 2.0;
        r.m.scale.set(s, s, 1);
        r.m.material.opacity = 0.45 * (1 - r.t);
      }
    },
  };
}
