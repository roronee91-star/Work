// ⛄ 눈사람 마당 (눈싸움장 서쪽): 눈덩이를 굴리면 커지고 · 작은 덩이를 큰 덩이에 부딪히면 눈사람 · 얼굴은 펜으로 그림
// '○○의 눈사람' 이름표, 부수기는 만든 사람만. 눈사람은 서버(snowmen 표)에 남음, 굴리는 눈덩이는 실시간으로만 보임
import * as THREE from 'three';
import { Kit, MATERIALS as M, canvasTex, panel, BALL } from './building.js';
import { makeSprite } from './avatar.js';

export const YARD = { x0: -23, x1: -11.5, z0: -25, z1: -11.5 };           // 마당 (울타리 안)
export const inYard = (f, x, z) => f === 0 && x > YARD.x0 && x < YARD.x1 && z > YARD.z0 && z < YARD.z1;
const GATE = { x: -17.25, w: 1.6 };                                         // 남쪽 문
export const SM_LIMIT = { mine: 3, all: 30 };
const R0 = 0.1, RMAX = 0.45, GROW = 0.03;                                   // 처음 크기 · 최대(지름 90cm, 캐릭터 키에 맞춤) · 1m 굴릴 때마다 커지는 양

const YM = {
  snow: new THREE.MeshStandardMaterial({ color: 0xfbfbfd, roughness: 0.9, emissive: 0x1c2030 }),
  snowB: new THREE.MeshStandardMaterial({ color: 0xf4f6fb, roughness: 1, flatShading: true }),
  fence: new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.8 }),
  coal: new THREE.MeshStandardMaterial({ color: 0x1e1e22, roughness: 0.6 }),
  twig: new THREE.MeshStandardMaterial({ color: 0x5a3e2a, roughness: 0.9 }),
  scarf: [0xc8102e, 0x2b5dc9, 0x2f8a4c, 0xe0a030, 0x9a4fd0].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })),
};
YM.snow.polygonOffset = true; YM.snow.polygonOffsetFactor = -2; YM.snow.polygonOffsetUnits = -2;

// 마당 바닥 · 낮은 울타리 · 문 · 간판
export function createSnowYard(colliders) {
  const group = new THREE.Group(), k = new Kit(true);
  const { x0, x1, z0, z1 } = YARD, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(g, YM.snow); ground.position.set(cx, 0.02, cz); group.add(ground);
  for (let i = 0; i < 26; i++) { const a = i * 2.39, rr = (i * 37) % 10 / 10; k.add(BALL, YM.snowB, cx + Math.cos(a) * (x1 - x0) * 0.46 * (0.6 + rr * 0.4), 0.02, cz + Math.sin(a) * (z1 - z0) * 0.46 * (0.6 + rr * 0.4), 0, 0.35 + rr * 0.3, 0.18, 0.35 + rr * 0.3); } // 쌓인 눈 더미
  const post = (x, z) => { k.box(0.14, 0.9, 0.14, x, 0, z, YM.fence); k.add(BALL, YM.snowB, x, 0.93, z, 0, 0.11, 0.07, 0.11); };
  const rail = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) post(ax + (bx - ax) * i / n, az + (bz - az) * i / n);
    for (const y of [0.35, 0.72]) k.box(Math.abs(bx - ax) || 0.06, 0.07, Math.abs(bz - az) || 0.06, (ax + bx) / 2, y, (az + bz) / 2, YM.fence);
    colliders.push({ x1: Math.min(ax, bx) - 0.1, z1: Math.min(az, bz) - 0.1, x2: Math.max(ax, bx) + 0.1, z2: Math.max(az, bz) + 0.1, tall: false, top: 0.95 });
  };
  rail(x0, z0, x1, z0); rail(x0, z0, x0, z1); rail(x1, z0, x1, z1);
  rail(x0, z1, GATE.x - GATE.w / 2, z1); rail(GATE.x + GATE.w / 2, z1, x1, z1);
  for (const s of [-1, 1]) { k.box(0.2, 1.6, 0.2, GATE.x + s * (GATE.w / 2 + 0.05), 0, z1, YM.fence); k.add(BALL, YM.snowB, GATE.x + s * (GATE.w / 2 + 0.05), 1.62, z1, 0, 0.16, 0.1, 0.16); }
  k.box(GATE.w + 0.5, 0.35, 0.12, GATE.x, 1.6, z1, YM.fence);
  const sign = canvasTex(1024, 200, (ctx, w, h) => { ctx.fillStyle = '#f7f9ff'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#7aa0d8'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, w - 16, h - 16); ctx.fillStyle = '#35507a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 92px "Pretendard","Noto Sans KR",sans-serif'; ctx.fillText('⛄ 눈사람 마당', w / 2, h / 2 + 4); });
  for (const s of [1, -1]) panel(group, sign, 2.2, 0.43, GATE.x, 1.77, z1 + s * 0.07, s > 0 ? 0 : Math.PI);
  k.flush(group);
  return { group };
}

// 눈사람 몸통 (두 덩이 · 돌단추 · 나뭇가지 팔 · 목도리) — 여럿을 kit 하나에 합쳐 그림
function drawBody(k, s) {
  const { x, z, r1, r2 } = s, y1 = r1 * 0.92, y2 = r1 * 1.8 + r2 * 0.92, ry = s.ry || 0;
  k.add(BALL, YM.snow, x, y1, z, 0, r1, r1 * 0.95, r1); k.add(BALL, YM.snow, x, y2, z, 0, r2, r2 * 0.95, r2);
  const fx = Math.sin(ry), fz = Math.cos(ry), rx = Math.cos(ry), rz = -Math.sin(ry);
  for (let i = 0; i < 3; i++) { const yy = y1 + r1 * (0.45 - i * 0.35), d = Math.sqrt(Math.max(0, r1 * r1 - (yy - y1) ** 2)); k.add(BALL, YM.coal, x + fx * d, yy, z + fz * d, 0, r1 * 0.07, r1 * 0.07, r1 * 0.07); }
  const tor = new THREE.TorusGeometry(r2 * 0.9, r2 * 0.16, 8, 20); tor.rotateX(Math.PI / 2);
  k.add(tor, YM.scarf[(s.id || 0) % YM.scarf.length], x, y2 - r2 * 0.62, z);
  for (const side of [-1, 1]) {
    const len = r1 * 1.4, g = new THREE.CylinderGeometry(0.018, 0.028, len, 5); g.rotateZ(side * (Math.PI / 2 - 0.55)); g.rotateY(ry);
    k.add(g, YM.twig, x + rx * side * (r1 * 0.95 + len * 0.35), y1 + r1 * 0.6, z + rz * side * (r1 * 0.95 + len * 0.35));
  }
}
// 기본 얼굴 (그리지 않았을 때): 숯 눈 · 당근 코 · 웃는 입
export function defaultFace() {
  const c = document.createElement('canvas'); c.width = c.height = 160; const ctx = c.getContext('2d');
  ctx.fillStyle = '#1e1e22'; for (const x of [56, 104]) { ctx.beginPath(); ctx.arc(x, 62, 9, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f08a24'; ctx.beginPath(); ctx.moveTo(80, 78); ctx.lineTo(118, 88); ctx.lineTo(80, 94); ctx.fill();
  ctx.strokeStyle = '#1e1e22'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(80, 100, 26, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  return c.toDataURL('image/png');
}

// ---------- 굴리기 · 쌓기 · 그리기 · 부수기 ----------
export function createSnowmen(api) {
  const { $, scene, me, supa } = api;
  const group = new THREE.Group(); scene.add(group);
  const ballGroup = new THREE.Group(); group.add(ballGroup);
  const men = new Map();         // id → { id, owner, x, z, r1, r2, ry, face, faceMesh, label }
  const balls = new Map();       // id → { id, pid, x, z, r, rolling, mesh, t }
  let bodies = null, menCols = [], mode = supa ? 'wait' : 'local', mine = null /* 내가 굴리는 눈덩이 id */, lastSend = 0, seq = 0;
  const LS = 'work-snowmen';
  const BALL_GEO = new THREE.SphereGeometry(1, 20, 14);
  // 얼굴: 머리 앞쪽을 감싸는 둥근 조각(구의 일부)에 그림을 붙임 — 평평한 판은 머리 속에 묻혀 안 보였음
  const FACE_GEO = new THREE.SphereGeometry(1.015, 24, 18, Math.PI / 2 - 0.85, 1.7, Math.PI / 2 - 0.85, 1.7);
  // 눈사람 다시 그리기: 몸통은 한 덩어리, 얼굴 · 이름표만 따로
  function rebuild() {
    if (bodies) { group.remove(bodies); bodies.traverse((m) => m.geometry?.dispose?.()); }
    for (const c of menCols) { const i = api.colliders.indexOf(c); if (i >= 0) api.colliders.splice(i, 1); }
    menCols = [];
    const k = new Kit(false);
    for (const s of men.values()) {
      drawBody(k, s);
      menCols.push({ circle: true, cx: s.x, cz: s.z, r: s.r1 + 0.05, x1: s.x - s.r1, z1: s.z - s.r1, x2: s.x + s.r1, z2: s.z + s.r1, tall: true });
      if (!s.faceMesh) {
        const tex = new THREE.TextureLoader().load(s.face || defaultFace()); tex.colorSpace = THREE.SRGBColorSpace;
        s.faceMesh = new THREE.Mesh(FACE_GEO, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
        s.label = makeSprite(`⛄ ${s.owner}의 눈사람`, { size: 40 }, 0.24);
        group.add(s.faceMesh, s.label);
      }
      const y2 = s.r1 * 1.8 + s.r2 * 0.92, fx = Math.sin(s.ry || 0), fz = Math.cos(s.ry || 0);
      void fx; void fz; s.faceMesh.scale.set(s.r2, s.r2 * 0.95, s.r2); s.faceMesh.position.set(s.x, y2, s.z); s.faceMesh.rotation.y = s.ry || 0;
      s.label.position.set(s.x, y2 + s.r2 + 0.32, s.z);
    }
    bodies = new THREE.Group(); k.flush(bodies); group.add(bodies);
    api.colliders.push(...menCols); api.changed?.();
  }
  function removeMan(id) { const s = men.get(id); if (!s) return; for (const o of [s.faceMesh, s.label]) if (o) { group.remove(o); o.material.map?.dispose(); o.material.dispose(); } men.delete(id); rebuild(); }
  function setMen(rows) {
    const keep = new Set(rows.map((r) => String(r.id)));
    for (const id of [...men.keys()]) if (!keep.has(id)) { const s = men.get(id); for (const o of [s.faceMesh, s.label]) if (o) { group.remove(o); o.material.map?.dispose(); o.material.dispose(); } men.delete(id); }
    for (const r of rows) { const id = String(r.id); if (!men.has(id)) men.set(id, { id, owner: r.owner, x: +r.x, z: +r.z, r1: +r.r1, r2: +r.r2, ry: +r.ry || 0, face: r.face }); }
    rebuild();
  }
  const localAll = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } };
  async function load() {
    if (supa) {
      const { data, error } = await supa.from('snowmen').select('*').order('id').limit(60);
      if (!error) { mode = 'server'; setMen(data || []); return; }
      mode = 'off'; return; // 서버에 snowman.sql을 아직 안 돌렸으면 만들기 중지 (보기만)
    }
    setMen(localAll());
  }
  setInterval(() => { if (api.near()) load(); }, 90000);

  // 눈덩이 (굴리는 중 · 놓아 둔 것)
  function ballMesh(b) { if (!b.mesh) { b.mesh = new THREE.Mesh(BALL_GEO, YM.snow); ballGroup.add(b.mesh); } b.mesh.scale.setScalar(b.r); b.mesh.position.set(b.x, b.r * 0.92, b.z); }
  function dropBall(id) { const b = balls.get(id); if (!b) return; ballGroup.remove(b.mesh); balls.delete(id); }
  const myCount = () => [...men.values()].filter((s) => s.owner === me.name).length;

  // ⛄ 버튼: 굴리기 시작 / 잡기 / 내려놓기
  function action() {
    const p = api.player();
    if (!inYard(p.floor, p.x, p.z)) return;
    if (mine) { // 내려놓기
      const b = balls.get(mine); mine = null;
      if (b) { b.rolling = false; b.t = Date.now(); api.send({ t: 'sm', k: 'drop', id: b.id, x: b.x, z: b.z, r: b.r }); }
      api.sys('⛄ 눈덩이를 내려놓았어요. 작은 눈덩이를 굴려 와서 부딪히면 눈사람이 돼요!'); return;
    }
    if (mode === 'off') { api.sys('⛄ 서버 준비 중이에요. 관리자가 Supabase에 눈사람 SQL을 실행하면 만들 수 있어요.'); return; }
    const near = nearBall(p.x, p.z);
    if (near) { near.rolling = true; near.pid = me.id; mine = near.id; api.send({ t: 'sm', k: 'grab', id: near.id }); api.sys('⛄ 눈덩이를 잡았어요. 걸으면 굴러가며 커져요!'); return; }
    const id = `${me.id}-${++seq}`, f = api.forward();
    const b = { id, pid: me.id, x: p.x + f[0] * (R0 + 0.35), z: p.z + f[1] * (R0 + 0.35), r: R0, rolling: true, t: Date.now() };
    balls.set(id, b); ballMesh(b); mine = id;
    api.send({ t: 'sm', k: 'roll', id, x: b.x, z: b.z, r: b.r });
    api.sys('⛄ 눈덩이를 만들었어요! 걸으면 굴러가며 점점 커져요. 다시 누르면 내려놓아요.');
  }
  function nearBall(x, z) { let best = null, bd = 1.2; for (const b of balls.values()) { if (b.rolling) continue; const d = Math.hypot(b.x - x, b.z - z) - b.r; if (d < bd) { bd = d; best = b; } } return best; }
  function nearMan(x, z, onlyMine = false) { let best = null, bd = 1.6; for (const s of men.values()) { if (onlyMine && s.owner !== me.name) continue; const d = Math.hypot(s.x - x, s.z - z) - s.r1; if (d < bd) { bd = d; best = s; } } return best; }

  // 쌓기: 굴리던 작은 덩이가 놓여 있는 더 큰 덩이에 닿으면 → 눈사람 (얼굴 그리기 창)
  let stacking = false;
  function tryStack(b) {
    for (const o of balls.values()) {
      if (o === b || o.rolling) continue;
      if (Math.hypot(o.x - b.x, o.z - b.z) > o.r + b.r + 0.05) continue;
      if (b.r < 0.16 || o.r < 0.26) { hint('⛄ 둘 다 조금 더 크게 굴려 주세요!'); return; }
      if (b.r > o.r * 0.92) { hint('⛄ 위에 올릴 눈덩이는 아래 것보다 작아야 해요!'); return; }
      if (myCount() >= SM_LIMIT.mine) { hint(`⛄ 눈사람은 한 사람에 ${SM_LIMIT.mine}개까지예요. 내 눈사람을 부수면 또 만들 수 있어요.`); return; }
      if (men.size >= SM_LIMIT.all) { hint(`⛄ 마당이 꽉 찼어요 (${SM_LIMIT.all}개).`); return; }
      stacking = true; mine = null;
      const p = api.player(), ry = Math.atan2(p.x - o.x, p.z - o.z); // 만든 사람 쪽을 바라봄
      const s = { x: +o.x.toFixed(2), z: +o.z.toFixed(2), r1: +o.r.toFixed(2), r2: +b.r.toFixed(2), ry: +ry.toFixed(2) };
      dropBall(b.id); dropBall(o.id); api.send({ t: 'sm', k: 'gone', ids: [b.id, o.id] });
      api.beep(); openDraw(s);
      return;
    }
  }
  let hintAt = 0; const hint = (t) => { if (Date.now() - hintAt > 4000) { hintAt = Date.now(); api.sys(t); } };

  // 🖊 얼굴 그리기 창
  let drawing = null;
  function openDraw(s) {
    drawing = s;
    const cv = $('smCanvas'), ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
    let pen = '#1e1e22', size = 7, erase = false, last = null;
    $('smPens').querySelectorAll('[data-pen]').forEach((b) => (b.onclick = () => { pen = b.dataset.pen; erase = false; $('smPens').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('smErase').onclick = () => { erase = true; $('smPens').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === $('smErase'))); };
    $('smSize').oninput = () => { size = +$('smSize').value; };
    $('smClear').onclick = () => ctx.clearRect(0, 0, cv.width, cv.height);
    $('smDefault').onclick = () => { const im = new Image(); im.onload = () => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(im, 0, 0, cv.width, cv.height); }; im.src = defaultFace(); };
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height]; };
    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); last = pos(e); dot(last); };
    cv.onpointermove = (e) => { if (!last) return; const q = pos(e); line(last, q); last = q; };
    cv.onpointerup = cv.onpointercancel = () => { last = null; };
    const style = () => { ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'; ctx.strokeStyle = ctx.fillStyle = pen; ctx.lineWidth = erase ? size * 2.5 : size; ctx.lineCap = ctx.lineJoin = 'round'; };
    const dot = ([x, y]) => { style(); ctx.beginPath(); ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); };
    const line = ([ax, ay], [bx, by]) => { style(); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); };
    $('smDone').onclick = () => finish(cv);
    $('smDefault').click();
    api.openModal('smModal');
  }
  async function finish(cv) {
    const s = drawing; if (!s) return; drawing = null;
    const small = document.createElement('canvas'); small.width = small.height = 160; small.getContext('2d').drawImage(cv, 0, 0, 160, 160);
    s.face = small.toDataURL('image/png'); s.owner = me.name; api.closeModals();
    if (mode === 'server') {
      const { data, error } = await supa.rpc('snowman_add', { p_name: me.name, p_key: api.walletKey(me.name), p_x: s.x, p_z: s.z, p_r1: s.r1, p_r2: s.r2, p_ry: s.ry, p_face: s.face });
      if (error) { alert(/too_many/.test(error.message) ? `눈사람은 한 사람에 ${SM_LIMIT.mine}개까지예요.` : /yard_full/.test(error.message) ? '마당이 꽉 찼어요.' : '눈사람을 세우지 못했어요: ' + error.message); stacking = false; return; }
      s.id = String(data.id);
    } else { s.id = String(Date.now()); const all = localAll(); all.push({ ...s, owner: me.name }); try { localStorage.setItem(LS, JSON.stringify(all)); } catch {} }
    men.set(s.id, s); rebuild(); stacking = false;
    api.send({ t: 'sm', k: 'man' });
    api.sys(`⛄ ${me.name}의 눈사람이 생겼어요! 내 눈사람 앞에서 💥 부수기를 할 수 있어요 (만든 사람만).`);
  }
  // 💥 부수기 (만든 사람만)
  async function smash() {
    const p = api.player(), s = nearMan(p.x, p.z, true); if (!s) return;
    if (!confirm('⛄ 내 눈사람을 부술까요?')) return;
    if (mode === 'server') { const { error } = await supa.rpc('snowman_smash', { p_name: me.name, p_key: api.walletKey(me.name), p_id: +s.id }); if (error) { alert('부수지 못했어요: ' + error.message); return; } }
    else { try { localStorage.setItem(LS, JSON.stringify(localAll().filter((r) => String(r.id) !== s.id))); } catch {} }
    api.puff?.(s.x, s.r1, s.z); removeMan(s.id); api.thump?.();
    api.send({ t: 'sm', k: 'smash', id: s.id });
    api.sys('💥 눈사람을 부쉈어요.');
  }

  // 실시간: 다른 사람이 굴리는 눈덩이 · 새 눈사람 · 부수기
  function onEvent(e) {
    if (!e || e.t !== 'sm') return;
    if (e.k === 'roll' || e.k === 'drop') { let b = balls.get(e.id); if (!b) { b = { id: e.id }; balls.set(e.id, b); } Object.assign(b, { x: e.x, z: e.z, r: e.r, rolling: e.k === 'roll', t: Date.now() }); ballMesh(b); }
    else if (e.k === 'grab') { const b = balls.get(e.id); if (b) { b.rolling = true; if (mine === e.id) mine = null; } }
    else if (e.k === 'gone') for (const id of e.ids || []) { if (mine === id) mine = null; dropBall(id); }
    else if (e.k === 'man') load();
    else if (e.k === 'smash') { const s = men.get(String(e.id)); if (s) { api.puff?.(s.x, s.r1, s.z); removeMan(s.id); } }
  }
  function update(dt) {
    const p = api.player();
    group.visible = api.near();
    if (mine) {
      const b = balls.get(mine);
      if (!b || !inYard(p.floor, p.x, p.z)) { if (b) { b.rolling = false; api.send({ t: 'sm', k: 'drop', id: b.id, x: b.x, z: b.z, r: b.r }); } mine = null; return; }
      const f = api.forward(), tx = p.x + f[0] * (b.r + 0.35), tz = p.z + f[1] * (b.r + 0.35);
      const cx = Math.max(YARD.x0 + b.r, Math.min(YARD.x1 - b.r, tx)), cz = Math.max(YARD.z0 + b.r, Math.min(YARD.z1 - b.r, tz));
      const d = Math.hypot(cx - b.x, cz - b.z);
      if (d > 0.001) {
        b.r = Math.min(RMAX, b.r + d * GROW); // 굴린 만큼 커짐
        const axis = new THREE.Vector3(cz - b.z, 0, -(cx - b.x)).normalize();
        b.x = cx; b.z = cz; ballMesh(b); b.mesh.rotateOnWorldAxis(axis, d / b.r);
        if (!stacking) tryStack(b);
        const now = performance.now(); if (now - lastSend > 250) { lastSend = now; api.send({ t: 'sm', k: 'roll', id: b.id, x: +b.x.toFixed(2), z: +b.z.toFixed(2), r: +b.r.toFixed(3) }); }
      }
    }
    // 놓아 둔 눈덩이는 10분 뒤 녹음
    for (const b of [...balls.values()]) if (!b.rolling && Date.now() - b.t > 600000) dropBall(b.id);
  }
  return {
    group, load, update, onEvent, action, smash,
    get rolling() { return !!mine; },
    prompt(x, z) { // 화면 아래 안내
      if (mine) { const b = balls.get(mine); return `⛄ 굴리는 중 (크기 ${Math.round((b?.r || 0) * 200)}cm) · 버튼을 누르면 내려놓아요`; }
      const s = nearMan(x, z, true); if (s) return 'mine';
      if (nearBall(x, z)) return '⛄ 버튼: 눈덩이 잡기';
      const o = nearMan(x, z); if (o) return `⛄ ${o.owner}의 눈사람`;
      return '⛄ 버튼: 눈덩이 만들기 · 굴리면 커져요 · 작은 덩이를 큰 덩이에 부딪히면 눈사람!';
    },
    nearMine(x, z) { return !!nearMan(x, z, true); },
    get mode() { return mode; },
  };
}
