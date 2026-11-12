// 밤하늘 · 산 · 도시 · 강 · 다리
import * as THREE from 'three';
import { HASH, FOG, RIVER_GLSL, RIVER_HALF, riverCenter } from './shaders.js';

export const GROUND_Y = -0.3; // 건물 1층 바닥(0) 바로 아래가 땅
export const FOG_COLOR = new THREE.Color(0.035, 0.038, 0.058);

export function sharedUniforms() {
  return {
    uTime: { value: 0 },
    uFogColor: { value: FOG_COLOR },
    uFogDensity: { value: 1 / 3600 },
  };
}

const WORLD_VERT = /* glsl */`
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vSeed;
void main(){
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
    vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
  #else
    vSeed = 0.5;
  #endif
  vec4 wp = m * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// ---------- 하늘 ----------
export function createSky(uniforms) {
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = position; vec4 wp = modelMatrix * vec4(position,1.0); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vDir;
      ${HASH}
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 top = vec3(0.004, 0.007, 0.022);
        vec3 hor = vec3(0.024, 0.028, 0.046);
        vec3 glow = vec3(0.037, 0.033, 0.04);
        vec3 col = mix(hor, top, smoothstep(0.0, 0.45, h));
        col += glow * 0.3 * exp(-max(h, 0.0) * 14.0);
        // 별
        vec3 c = floor(d * 380.0);
        float s = hash13(c);
        float tw = 0.6 + 0.4 * sin(uTime * 1.7 + s * 80.0);
        col += vec3(0.9, 0.92, 1.0) * step(0.9982, s) * smoothstep(0.08, 0.35, h) * tw * 0.9;
        // 달
        vec3 md = normalize(vec3(-0.55, 0.32, 0.78));
        float m = dot(d, md);
        col += vec3(1.0, 0.96, 0.86) * smoothstep(0.99955, 0.9998, m) * 1.4;
        col += vec3(0.12, 0.13, 0.17) * pow(max(m, 0.0), 400.0) * 0.4;
        if (h < 0.0) col = hor + glow * 0.3;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

// ---------- 산 능선 ----------
export function createMountains(uniforms) {
  const seg = 360;
  const positions = [];
  const R = 5200;
  const ridge = (a) =>
    120 + 160 * (0.5 + 0.5 * Math.sin(a * 3 + 1)) + 110 * Math.abs(Math.sin(a * 7.3 + 2)) + 60 * Math.sin(a * 19 + 0.4) + 25 * Math.sin(a * 53);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const p = (a, h) => [Math.cos(a) * R, GROUND_Y + h, Math.sin(a) * R];
    const b0 = p(a0, -20), b1 = p(a1, -20), t0 = p(a0, ridge(a0)), t1 = p(a1, ridge(a1));
    positions.push(...b0, ...t0, ...b1, ...b1, ...t0, ...t1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */`
      varying vec3 vWorld; varying vec3 vNormalW; varying float vSeed;
      ${FOG}
      void main(){
        vec3 col = vec3(0.012, 0.014, 0.022);
        col = applyFog(col, vWorld);
        col = mix(col, vec3(0.008, 0.01, 0.018), 0.6); // 산은 하늘보다 조금 어둡게
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(g, mat);
}

// ---------- 지면 (도로 · 자동차 불빛 · 강) ----------
export function createGround(uniforms) {
  const g = new THREE.PlaneGeometry(14000, 14000, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, GROUND_Y, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWorld; varying vec3 vNormalW; varying float vSeed;
      ${HASH}
      ${FOG}
      ${RIVER_GLSL}
      float carLane(float along, float laneId, float speed, float len){
        float f = (along + uTime * speed) / len;
        float id = floor(f);
        return step(0.62, hash12(vec2(id, laneId))) * step(fract(f), 0.22);
      }
      void main(){
        vec2 p = vWorld.xz;
        float dist = length(vWorld - cameraPosition);
        float detail = 1.0 - smoothstep(900.0, 3200.0, dist);
        vec3 col = vec3(0.010, 0.011, 0.015);
        vec3 lamp = vec3(1.0, 0.55, 0.22);
        float rc = riverC(p.x);
        float dz = abs(p.y - rc);
        float side = sign(p.y - rc);
        if (dz < ${RIVER_HALF.toFixed(1)}) {
          col = vec3(0.004, 0.009, 0.018);
          float colId = floor(p.x / 5.0);
          float streak = pow(hash12(vec2(colId, 3.0)), 10.0);
          float wave = 0.5 + 0.5 * sin(p.y * 0.3 + uTime * 1.3 + hash12(vec2(colId, 7.0)) * 6.28);
          float nearBank = smoothstep(${RIVER_HALF.toFixed(1)} - 120.0, ${RIVER_HALF.toFixed(1)}, dz);
          col += mix(vec3(1.0, 0.7, 0.4), vec3(0.5, 0.7, 1.0), step(0.5, hash12(vec2(colId, 9.0)))) * streak * wave * (0.25 + 0.6 * nearBank) * mix(0.15, 1.0, detail);
          col += vec3(0.02, 0.03, 0.05) * (1.0 - nearBank);
        } else if (dz < ${(RIVER_HALF + 26).toFixed(1)}) {
          // 강변 도로
          float lane = dz - ${RIVER_HALF.toFixed(1)};
          col = vec3(0.022, 0.022, 0.026);
          float laneId = floor(lane / 6.5) + side * 10.0;
          float dir = mod(floor(lane / 13.0), 2.0) < 0.5 ? 1.0 : -1.0;
          float car = carLane(p.x, laneId, 24.0 * dir, 16.0);
          vec3 carCol = dir > 0.0 ? vec3(2.2, 1.9, 1.5) : vec3(2.0, 0.15, 0.1);
          float inLane = smoothstep(2.0, 3.0, mod(lane, 6.5)) * (1.0 - smoothstep(4.0, 5.0, mod(lane, 6.5)));
          col += carCol * car * inLane * detail;
          col += lamp * 0.5 * exp(-pow(lane - 25.0, 2.0) * 0.4);
          col += lamp * 0.25 * exp(-pow(lane - 0.6, 2.0) * 0.6);
        } else {
          vec2 q = p - 60.0;
          vec2 g = abs(fract(q / 120.0 + 0.5) - 0.5) * 120.0; // 가장 가까운 도로 중심선까지 거리
          float onX = step(g.y, 9.0); // x 방향 도로
          float onZ = step(g.x, 9.0);
          if (onX + onZ > 0.0) {
            col = vec3(0.02, 0.02, 0.024);
            float gg = onX > 0.5 ? g.y : g.x;
            float along = onX > 0.5 ? p.x : p.y;
            float roadId = onX > 0.5 ? floor(q.y / 120.0 + 0.5) : floor(q.x / 120.0 + 0.5) + 500.0;
            float signedOff = onX > 0.5 ? (q.y - floor(q.y / 120.0 + 0.5) * 120.0) : (q.x - floor(q.x / 120.0 + 0.5) * 120.0);
            float dir = signedOff > 0.0 ? 1.0 : -1.0;
            float car = carLane(along, roadId * 2.0 + dir, 13.0 * dir, 22.0 + 10.0 * hash12(vec2(roadId, 1.0)));
            float inLane = smoothstep(1.5, 2.5, gg) * (1.0 - smoothstep(5.0, 6.0, gg));
            vec3 carCol = dir > 0.0 ? vec3(2.0, 1.8, 1.4) : vec3(1.9, 0.12, 0.08);
            col += carCol * car * inLane * detail;
            col += lamp * 0.45 * exp(-pow(gg - 8.3, 2.0) * 0.5) * mix(0.4, 1.0, detail);
          } else {
            float e = min(g.x, g.y) - 9.0;
            col += lamp * 0.05 * exp(-e * 0.25);
          }
          col = mix(vec3(0.05, 0.035, 0.022), col, detail);
        }
        // 우리 회사 부지 (보도 + 정원)
        if (max(abs(p.x), abs(p.y)) < 51.0) {
          vec2 t = fract(p / 1.2);
          col = vec3(0.06, 0.058, 0.056) * (0.85 + 0.15 * step(0.06, min(t.x, t.y)));
          float lawn = step(abs(p.x), 40.0) * step(abs(p.y + 25.0), 12.0);
          col = mix(col, vec3(0.012, 0.03, 0.014), lawn);
          col += vec3(1.0, 0.75, 0.45) * 0.06 * exp(-length(p) * 0.05);
        }
        gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
      }`,
  });
  return new THREE.Mesh(g, mat);
}

// ---------- 건물 숲 ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createCity(uniforms) {
  const rand = rng(20261112);
  const lots = [];
  const clusters = [
    { x: -400, z: 950, s: 450, h: 190 },  // 강 건너 업무지구
    { x: 900, z: 1150, s: 420, h: 160 },
    { x: -1500, z: 1300, s: 500, h: 140 },
    { x: -900, z: -900, s: 500, h: 110 },
    { x: 1300, z: -700, s: 450, h: 100 },
  ];
  const B = 120, N = 27;
  for (let bx = -N; bx <= N; bx++) {
    for (let bz = -N; bz <= N; bz++) {
      if (bx === 0 && bz === 0) continue; // 우리 건물 블록
      const cx = bx * B, cz = bz * B;
      for (let q = 0; q < 4; q++) {
        if (rand() < 0.1) continue;
        const lx = cx + (q % 2 ? 25 : -25), lz = cz + (q < 2 ? 25 : -25);
        const w = 14 + rand() * 30, d = 14 + rand() * 30;
        const x = lx + (rand() - 0.5) * (48 - w) * 0.8;
        const z = lz + (rand() - 0.5) * (48 - d) * 0.8;
        const dist = Math.hypot(x, z);
        if (Math.abs(z - riverCenter(x)) < RIVER_HALF + 35 + Math.max(w, d) / 2) continue;
        if (dist > 3300) continue;
        // 가까운 곳은 낮은 건물, 멀수록 가끔 높은 건물
        let h = 7 + rand() * 14 + (rand() < 0.15 ? rand() * 30 : 0);
        h += Math.pow(rand(), 2.5) * 110 * THREE.MathUtils.smoothstep(dist, 300, 1400);
        for (const c of clusters) {
          const k = Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / (2 * c.s * c.s));
          h += k * Math.pow(rand(), 1.4) * c.h;
        }
        lots.push([x, z, w, d, h]);
      }
    }
  }

  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWorld; varying vec3 vNormalW; varying float vSeed;
      ${HASH}
      ${FOG}
      void main(){
        vec3 n = normalize(vNormalW);
        float dist = length(vWorld - cameraPosition);
        vec3 col;
        if (n.y > 0.5) {
          col = vec3(0.018, 0.02, 0.028);
          // 옥상 항공장애등
          col += vec3(1.5, 0.05, 0.03) * step(0.985, vSeed) * step(0.5, fract(uTime * 0.5 + vSeed * 7.0));
        } else if (n.y < -0.5) {
          col = vec3(0.0);
        } else {
          float along = abs(n.x) > 0.5 ? vWorld.z : vWorld.x;
          float fy = (vWorld.y - (${GROUND_Y.toFixed(1)})) / 3.6;
          float bay = 2.8 + vSeed * 1.4;
          vec2 cell = vec2(floor(along / bay), floor(fy));
          vec2 f = vec2(fract(along / bay), fract(fy));
          float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.82);
          float h = hash12(cell + vec2(vSeed * 91.7, n.x * 13.0 + n.z * 29.0));
          float litRatio = 0.2 + 0.4 * vSeed;
          float lit = step(1.0 - litRatio, h);
          // 층 전체가 켜진 사무실 층
          lit = max(lit, step(0.93, hash12(vec2(cell.y, vSeed * 17.0))) * step(0.3, h));
          vec3 warm = vec3(1.0, 0.74, 0.42);
          vec3 cool = vec3(0.62, 0.78, 1.0);
          vec3 wc = mix(warm, cool, step(0.62, hash12(vec2(cell.y + vSeed * 5.0, 2.0))));
          float bright = 0.35 + 0.6 * h;
          vec3 near = vec3(0.022, 0.026, 0.036) + win * lit * wc * bright;
          vec3 far = vec3(0.022, 0.026, 0.036) + wc * litRatio * 0.22;
          float detail = 1.0 - smoothstep(700.0, 2200.0, dist);
          col = mix(far, near, detail);
          // 저층 상가 불빛
          col += vec3(1.0, 0.6, 0.3) * 0.18 * exp(-(vWorld.y - (${GROUND_Y.toFixed(1)})) * 0.25);
        }
        gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, lots.length);
  const m = new THREE.Matrix4();
  lots.forEach(([x, z, w, d, h], i) => {
    m.makeScale(w, h, d);
    m.setPosition(x, GROUND_Y, z);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

// ---------- 다리 ----------
export function createBridges(uniforms) {
  const group = new THREE.Group();
  const deckMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WORLD_VERT,
    fragmentShader: `varying vec3 vWorld; varying vec3 vNormalW; varying float vSeed; ${FOG}
      void main(){ gl_FragColor = vec4(applyFog(vec3(0.03, 0.032, 0.04), vWorld), 1.0); }`,
  });
  const lampMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WORLD_VERT,
    fragmentShader: `uniform float uTime; varying vec3 vWorld; varying vec3 vNormalW; varying float vSeed; ${FOG}
      void main(){
        vec3 c = mix(vec3(2.6, 2.2, 1.6), vec3(0.8, 1.6, 3.0), step(0.5, fract(vSeed * 3.0)));
        gl_FragColor = vec4(applyFog(c, vWorld), 1.0);
      }`,
  });
  const xs = [-2900, -1800, -700, 600, 1700, 2800];
  const lamps = [];
  for (const x of xs) {
    const rc = riverCenter(x);
    const len = (RIVER_HALF + 30) * 2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(26, 4, len), deckMat);
    deck.position.set(x, GROUND_Y + 14, rc);
    group.add(deck);
    // 교각
    for (let k = -3; k <= 3; k++) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 14, 6), deckMat);
      pier.position.set(x, GROUND_Y + 6, rc + k * 70);
      group.add(pier);
    }
    for (let t = -len / 2; t <= len / 2; t += 14) {
      lamps.push([x - 12.5, GROUND_Y + 17.5, rc + t], [x + 12.5, GROUND_Y + 17.5, rc + t]);
    }
  }
  // 강변 가로등 줄
  for (let x = -3300; x <= 3300; x += 26) {
    const rc = riverCenter(x);
    lamps.push([x, GROUND_Y + 7, rc - RIVER_HALF - 25.5], [x, GROUND_Y + 7, rc + RIVER_HALF + 25.5]);
  }
  const lg = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const im = new THREE.InstancedMesh(lg, lampMat, lamps.length);
  const m = new THREE.Matrix4();
  lamps.forEach((p, i) => { m.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m); });
  im.frustumCulled = false;
  group.add(im);
  return group;
}

// ---------- 우리 건물 주변 거리 (가로등 · 가로수) ----------
export function createSite() {
  const group = new THREE.Group();
  const lamps = [], trees = [];
  for (let t = -170; t <= 170; t += 24) {
    for (const r of [-60, 60]) for (const side of [-10.5, 10.5]) {
      lamps.push([t, r + side]); lamps.push([r + side, t]);
      trees.push([t + 12, r + side]); trees.push([r + side, t + 12]);
    }
  }
  // 정원 나무
  for (let x = -36; x <= 36; x += 8) trees.push([x, -30], [x, -20]);
  const m = new THREE.Matrix4();
  const inst = (geo, mat, list, y, s = 1) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, z], i) => { m.makeScale(s, s, s); m.setPosition(x, GROUND_Y + y, z); im.setMatrixAt(i, m); });
    group.add(im);
  };
  inst(new THREE.CylinderGeometry(0.08, 0.12, 6, 6), new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.6 }), lamps, 3);
  inst(new THREE.BoxGeometry(0.5, 0.15, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.7) }), lamps, 6);
  inst(new THREE.CylinderGeometry(0.12, 0.18, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a1c }), trees, 1.2);
  inst(new THREE.IcosahedronGeometry(1.8, 1), new THREE.MeshStandardMaterial({ color: 0x2f5a36, emissive: 0x0c1a0e, roughness: 0.9, flatShading: true }), trees, 3.6);
  return group;
}
