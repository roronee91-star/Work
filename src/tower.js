// 위로 갈수록 가늘어지는 유리 마천루 + 빛나는 왕관
import * as THREE from 'three';
import { HASH, FOG } from './shaders.js';
import { GROUND_Y } from './world.js';

export const TOWER_H = 460;          // 지상에서 유리 몸체 꼭대기까지
export const OFFICE_H = -GROUND_Y;   // 지상에서 사무실 층 높이 (380m)
const SE_N = 5;                      // 둥근 사각형(슈퍼타원) 지수

export function halfWidthAt(h) {
  const t = Math.min(Math.max(h / TOWER_H, 0), 1);
  return 38 - 26 * Math.pow(t, 2.2);
}

export function superellipse(theta, hw) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const e = 2 / SE_N;
  return [hw * Math.sign(c) * Math.pow(Math.abs(c), e), hw * Math.sign(s) * Math.pow(Math.abs(s), e)];
}

export function slabShape(hw) {
  const shape = new THREE.Shape();
  const seg = 96;
  for (let i = 0; i <= seg; i++) {
    const [x, z] = superellipse((i / seg) * Math.PI * 2, hw);
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
  }
  return shape;
}

export function createTower(uniforms) {
  const group = new THREE.Group();
  const seg = 96;
  const step = 2;
  const rings = TOWER_H / step;
  const pos = [], uv = [], idx = [];
  for (let r = 0; r <= rings; r++) {
    const h = r * step;
    const hw = halfWidthAt(h);
    for (let i = 0; i <= seg; i++) {
      const [x, z] = superellipse((i / seg) * Math.PI * 2, hw);
      pos.push(x, GROUND_Y + h, z);
      uv.push(i / seg, h);
    }
  }
  const W = seg + 1;
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * W + i, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const shellMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vWorld; varying vec3 vNormalW; varying vec2 vUv;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWorld; varying vec3 vNormalW; varying vec2 vUv;
      ${HASH}
      ${FOG}
      void main(){
        // 사무실 층(88F)은 실제 내부가 보이도록 뚫어 둡니다
        if (vWorld.y > 0.0 && vWorld.y < 4.2) discard;
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(cameraPosition - vWorld);
        float h = vUv.y;
        float fy = h / 4.0;
        float bays = 180.0;
        vec2 cell = vec2(floor(vUv.x * bays), floor(fy));
        vec2 f = vec2(fract(vUv.x * bays), fract(fy));
        // 유리: 하늘 반사
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 col = vec3(0.012, 0.022, 0.04) + vec3(0.06, 0.07, 0.11) * fres;
        // 실내 불빛
        float hh = hash12(cell);
        float floorLit = step(0.55, hash12(vec2(cell.y, 4.0)));
        float lit = step(0.5, hh) * (0.35 + 0.65 * floorLit);
        vec3 wc = mix(vec3(1.0, 0.82, 0.55), vec3(0.75, 0.88, 1.0), step(0.7, hash12(vec2(cell.y, 8.0))));
        col += wc * lit * 0.55 * step(0.12, f.y) * step(f.y, 0.86);
        // 층 슬래브 띠와 멀리언
        col = mix(col, vec3(0.05, 0.055, 0.07), step(f.y, 0.1));
        col += vec3(0.05, 0.06, 0.08) * step(0.93, f.x);
        // 네 면 가운데의 LED 세로선
        float seam = abs(fract(vUv.x * 4.0 + 0.5) - 0.5);
        col += vec3(1.6, 1.7, 2.0) * smoothstep(0.004, 0.0015, seam);
        // 위쪽 층일수록 더 밝게 (전망층)
        col += vec3(0.25, 0.3, 0.45) * smoothstep(400.0, 460.0, h) * 0.6;
        // 사무실 층 바로 위아래 슬래브 조명
        col += vec3(1.2, 1.0, 0.8) * (smoothstep(0.6, 0.0, abs(vWorld.y + 0.2)) + smoothstep(0.6, 0.0, abs(vWorld.y - 4.4)));
        // 아래쪽 투광 조명
        col += vec3(0.5, 0.65, 1.0) * 0.35 * exp(-h * 0.02);
        gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
      }`,
  });
  const shell = new THREE.Mesh(geo, shellMat);
  shell.frustumCulled = false;
  group.add(shell);

  // 옥상 덮개
  const topHw = halfWidthAt(TOWER_H);
  const cap = new THREE.Mesh(new THREE.ShapeGeometry(slabShape(topHw)), new THREE.MeshBasicMaterial({ color: 0x05070c, side: THREE.DoubleSide }));
  cap.rotation.x = Math.PI / 2;
  cap.position.y = GROUND_Y + TOWER_H;
  group.add(cap);

  // 왕관: 위로 모이는 빛나는 지느러미
  const finMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.7, 2.1) });
  const finCount = 32;
  const yBase = GROUND_Y + TOWER_H - 6;
  const yTop = GROUND_Y + TOWER_H + 70;
  const topHwCrown = 3.2;
  const finGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
  finGeo.translate(0, 0.5, 0);
  const fins = new THREE.InstancedMesh(finGeo, finMat, finCount);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < finCount; i++) {
    const th = (i / finCount) * Math.PI * 2;
    const [x0, z0] = superellipse(th, topHw + 0.3);
    const [x1, z1] = superellipse(th, topHwCrown);
    const a = new THREE.Vector3(x0, yBase, z0), b = new THREE.Vector3(x1, yTop, z1);
    const dir = b.clone().sub(a);
    const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    m.compose(a, q, new THREE.Vector3(1, len, 1));
    fins.setMatrixAt(i, m);
  }
  group.add(fins);
  // 왕관 가로 링
  for (const t of [0.15, 0.4, 0.65, 0.88]) {
    const hw = topHw + 0.3 + (topHwCrown - topHw - 0.3) * t;
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const [x, z] = superellipse((i / 64) * Math.PI * 2, hw);
      pts.push(new THREE.Vector3(x, yBase + (yTop - yBase) * t, z));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, 0.18, 4, true), finMat);
    group.add(tube);
  }
  // 첨탑 + 항공장애등
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.8, 30, 8), finMat);
  spire.position.y = yTop + 15;
  group.add(spire);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.15, 0.1) }));
  beacon.position.y = yTop + 31;
  group.add(beacon);

  // 사무실 층 바깥 슬래브(유리 바깥 테두리)
  const hwOffice = halfWidthAt(OFFICE_H);
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.6, metalness: 0.3 });
  const slabGeo = new THREE.ExtrudeGeometry(slabShape(hwOffice + 0.05), { depth: 0.4, bevelEnabled: false });
  slabGeo.rotateX(Math.PI / 2);
  const floorSlab = new THREE.Mesh(slabGeo, slabMat);
  floorSlab.position.y = 0; // 0 ~ -0.4
  group.add(floorSlab);
  const ceilSlab = new THREE.Mesh(slabGeo, slabMat);
  ceilSlab.position.y = 4.6; // 4.6 ~ 4.2
  group.add(ceilSlab);

  return {
    group,
    update(t) {
      const on = Math.sin(t * 2.2) > 0.2;
      beacon.visible = on;
    },
  };
}
