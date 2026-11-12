import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG, AVATAR_COLORS } from './config.js';
import { sharedUniforms, createSky, createMountains, createGround, createCity, createBridges, createSite, FOG_NIGHT, FOG_DAY } from './world.js';
import { createBuilding, FLOORS, ZONES, zoneAt, HX, HZ, LOT, CEIL, ROOF, ELEV, NOTICE, SPAWN, BOOTHS } from './building.js';
import { createGarden, STREAM } from './garden.js';
import { startAudio, setWaterVolume, setMuted, isMuted, playThump, playBeep } from './audio.js';
import { Avatar } from './avatar.js';
import { connect, makeId, supa } from './net.js';
import { listNotices, addNotice, drawNoticeBoard } from './notices.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;

// ---------- 앱 안 브라우저 안내 ----------
{
  const ua = navigator.userAgent || '';
  const IN_APP = /KAKAOTALK|NAVER\(inapp|BAND\/|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|; wv\)/i.test(ua);
  const outsideUrl = () => {
    const url = location.href;
    if (/KAKAOTALK/i.test(ua)) return 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    if (/Line\//i.test(ua)) return url + (url.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
    if (/Android/i.test(ua)) return 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
    return '';
  };
  if (IN_APP) {
    $('inApp').hidden = false;
    $('inAppOpen').onclick = () => {
      const to = outsideUrl();
      if (to) location.href = to;
      else alert('화면 아래(또는 위) ⋯ 메뉴에서 "Safari로 열기" 또는 "다른 브라우저로 열기"를 눌러 주세요.');
    };
    $('inAppClose').onclick = () => { $('inApp').hidden = true; };
  }
}

// ---------- 렌더러 ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020309);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 12000);

const uniforms = sharedUniforms();
const sky = createSky(uniforms);
scene.add(sky, createMountains(uniforms), createGround(uniforms), createCity(uniforms), createBridges(uniforms), createSite());
const bld = createBuilding();
scene.add(bld.group);
bld.setFloor(0, true);
const garden = createGarden(uniforms);
scene.add(garden.group);
bld.floors[0].colliders.push(...garden.colliders);
const sun = new THREE.DirectionalLight(0xfff1dc, 0);
sun.position.set(45, 54, 72);
scene.add(sun);

const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: isTouch ? 0 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.4, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w / 2, h / 2);
  camera.aspect = w / h;
  camera.fov = w < h ? 70 : 60;
  if (mode === 'intro' && w > 760) camera.setViewOffset(w, h, -w * 0.2, 0, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- 상태 ----------
document.title = CONFIG.companyName;
$('brandName').textContent = CONFIG.companyName;
$('brandTagline').textContent = CONFIG.companyTagline;

const me = { id: makeId(), name: '', color: AVATAR_COLORS[0], gender: 'm' };
const player = { floor: SPAWN.floor, x: SPAWN.x, z: SPAWN.z, ry: SPAWN.yaw + Math.PI, speed: 0, zone: 'f1' };
const cam = { yaw: SPAWN.yaw, pitch: 0.28, dist: 3.4, cur: 3.4 };
const orbit = { angle: 0.35, elev: 0.2, radius: 85, target: new THREE.Vector3(0, 8, 0) };
let mode = 'intro'; // intro | office | exterior | fly
let fly = null;
let myAvatar = null;
let net = null;
const peers = new Map();
let chatTab = 'all';
resize();

// 저장된 이름/색 (이 기기에서 한 번 정하면 다음부터는 바로 출근)
let returning = false;
try {
  const saved = JSON.parse(localStorage.getItem('work-tower-me') || 'null');
  if (saved?.name) { $('nameInput').value = saved.name; returning = true; }
  if (saved?.color) me.color = saved.color;
  if (saved?.gender) me.gender = saved.gender === 'f' ? 'f' : 'm';
} catch {}

// ---------- 시작 화면 ----------
const colorPick = $('colorPick');
AVATAR_COLORS.forEach((c) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.background = c;
  b.title = c;
  if (c === me.color) b.classList.add('on');
  b.onclick = () => { me.color = c; colorPick.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); updatePreview(); };
  colorPick.appendChild(b);
});
document.querySelectorAll('#genderPick button').forEach((b) => {
  b.classList.toggle('on', b.dataset.g === me.gender);
  b.onclick = () => { me.gender = b.dataset.g; document.querySelectorAll('#genderPick button').forEach((x) => x.classList.toggle('on', x === b)); updatePreview(); };
});

// 시작 화면 캐릭터 미리보기 (작은 화면, 시작 화면에서만 그림)
const pv = { renderer: null, scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(28, 0.75, 0.1, 20), av: null };
{
  const c = $('preview');
  pv.renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
  pv.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  pv.renderer.setSize(c.clientWidth || 120, c.clientHeight || 160, false);
  pv.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  pv.cam.position.set(0, 0.65, 2.7); pv.cam.lookAt(0, 0.55, 0);
  pv.scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x3a3028, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(2, 3, 4); pv.scene.add(key);
}
function updatePreview() {
  if (pv.av) { pv.av.setLook(me.color, me.gender); return; }
  pv.av = new Avatar('', me.color, me.gender);
  pv.av.label.visible = false;
  pv.scene.add(pv.av.root);
}
updatePreview();

$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('enterBtn').click(); });
$('enterBtn').onclick = () => (editing ? saveProfile() : enter());

// 👤 내 캐릭터 바꾸기: 시작 화면 카드를 다시 열어 고침
let editing = false;
let before = null;
function openProfile() {
  editing = true;
  before = { name: me.name, color: me.color, gender: me.gender };
  $('nameInput').value = me.name;
  $('enterBtn').textContent = '저장하기';
  $('introCancel').hidden = false;
  $('intro').classList.add('editing');
  $('intro').hidden = false;
}
function closeProfile() {
  editing = false;
  $('enterBtn').textContent = '출근하기';
  $('introCancel').hidden = true;
  $('intro').classList.remove('editing');
  $('intro').hidden = true;
}
function saveProfile() {
  const name = ($('nameInput').value.trim() || me.name).slice(0, 16);
  const renamed = name !== me.name;
  me.name = name;
  try { localStorage.setItem('work-tower-me', JSON.stringify({ name: me.name, color: me.color, gender: me.gender })); } catch {}
  myAvatar.setLook(me.color, me.gender);
  if (renamed) myAvatar.setName(me.name);
  closeProfile();
  sysMessage('캐릭터를 바꿨어요.');
  sendState(true);
}
$('btnMe').onclick = () => { if (mode === 'office' || mode === 'exterior') openProfile(); };
$('introCancel').onclick = () => {
  // 바꾸지 않고 닫으면 고르던 것을 원래대로
  Object.assign(me, before);
  colorPick.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.title === me.color));
  document.querySelectorAll('#genderPick button').forEach((x) => x.classList.toggle('on', x.dataset.g === me.gender));
  updatePreview();
  closeProfile();
};

// 소리는 화면을 처음 누를 때 켜짐 (브라우저 규칙)
['pointerdown', 'keydown', 'touchend'].forEach((t) => addEventListener(t, () => { if (myAvatar) startAudio(); }, { capture: true, passive: true }));

function enter() {
  me.name = ($('nameInput').value.trim() || '게스트' + Math.floor(Math.random() * 900 + 100)).slice(0, 16);
  try { localStorage.setItem('work-tower-me', JSON.stringify({ name: me.name, color: me.color, gender: me.gender })); } catch {}
  $('intro').hidden = true;
  camera.clearViewOffset(); camera.updateProjectionMatrix();
  $('hud').hidden = false;
  $('joy').hidden = !isTouch;
  if (isTouch) setChatOpen(false);
  startAudio();
  myAvatar = new Avatar(me.name, me.color, me.gender);
  scene.add(myAvatar.root);
  placeAvatar(myAvatar, player);
  net = connect(me, {
    onState, onChat: receiveChat, onLeave: removePeer,
    onStatus(text, online) { $('netText').textContent = text; $('netDot').classList.toggle('on', online); },
  });
  sysMessage(returning
    ? `다시 오셨네요, ${me.name}님! 캐릭터를 바꾸려면 위쪽 👤 버튼을 누르세요.`
    : `${CONFIG.companyName}에 오신 걸 환영해요, ${me.name}님! 엘리베이터를 타고 옥상 테라스에서 야경을 보세요.`);
  showFloorHud();
  if (!supa) sysMessage('지금은 로컬 데모 모드예요. 같은 브라우저에서 탭을 하나 더 열면 다른 사람처럼 보여요.');
  startFly('office', 3.2);
  sendState(true);
}

// ---------- 입력 ----------
const keys = new Set();
const isTyping = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
addEventListener('keydown', (e) => {
  if (isTyping()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
  if (mode === 'intro') return;
  if (game.on) {
    if (['Space', 'KeyE', 'KeyJ', 'KeyF'].includes(e.code)) { e.preventDefault(); if (!e.repeat) punch(); }
    if (e.code === 'Escape') quitGame();
    return;
  }
  keys.add(e.code);
  if (e.code === 'Enter') { e.preventDefault(); setChatOpen(true); $('chatInput').focus(); }
  if (e.code === 'KeyE') interact();
  if (e.code === 'Escape') closeModals();
  if (/^Digit[1-5]$/.test(e.code) && !$('floorModal').hidden) goFloor(+e.code.slice(5) - 1);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const pointers = new Map();
let pinchDist = 0;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), multi: pointers.size > 0 });
  if (pointers.size === 2) { pinchDist = pinchLen(); for (const q of pointers.values()) q.multi = true; }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2) {
    const d = pinchLen();
    zoom((pinchDist - d) * 0.01);
    pinchDist = d;
    return;
  }
  const k = isTouch ? 0.006 : 0.005;
  if (mode === 'office') {
    cam.yaw -= dx * k;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * k, -0.25, 1.15);
  } else if (mode === 'exterior' || mode === 'intro') {
    orbit.angle -= dx * k;
    orbit.elev = THREE.MathUtils.clamp(orbit.elev + dy * k, -0.02, 1.3);
    idleTime = 0;
  }
});
const endPointer = (e) => { pointers.delete(e.pointerId); };
canvas.addEventListener('pointerup', (e) => {
  const p = pointers.get(e.pointerId);
  // 짧게 누르고 거의 안 움직였으면 "핑": 그 자리로 걸어감
  if (p && !p.multi && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 8 && performance.now() - p.t < 400) tapMove(e.clientX, e.clientY);
  endPointer(e);
});
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY * 0.002); }, { passive: false });
function pinchLen() { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
function zoom(d) {
  if (mode === 'office') cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + d), 1.2, 9);
  else orbit.radius = THREE.MathUtils.clamp(orbit.radius * (1 + d), 30, 700);
}

// 가상 조이스틱
const joy = { x: 0, y: 0, id: null };
{
  const el = $('joy'), knob = $('joyKnob');
  const R = 50;
  const set = (e) => {
    const r = el.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    joy.x = dx / R; joy.y = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  el.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; el.setPointerCapture(e.pointerId); set(e); });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) set(e); });
  const end = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// ---------- 이동 · 충돌 ----------
const R = 0.26;
function collide(x, z) {
  for (let it = 0; it < 3; it++) {
    for (const c of bld.floors[player.floor].colliders) {
      const cx = Math.max(c.x1, Math.min(x, c.x2));
      const cz = Math.max(c.z1, Math.min(z, c.z2));
      let dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * R; z = cz + (dz / d) * R;
      } else {
        // 중심이 상자 안: 가장 가까운 면으로 밀어냄
        const pen = [x - c.x1, c.x2 - x, z - c.z1, c.z2 - z];
        const m = Math.min(...pen);
        if (m === pen[0]) x = c.x1 - R; else if (m === pen[1]) x = c.x2 + R; else if (m === pen[2]) z = c.z1 - R; else z = c.z2 + R;
      }
    }
  }
  const out = player.floor === 0;
  const lx = out ? LOT - 0.4 : HX - 0.5, lz = out ? LOT - 0.4 : HZ - 0.5;
  return [Math.max(-lx, Math.min(lx, x)), Math.max(-lz, Math.min(lz, z))];
}

function updatePlayer(dt) {
  let f = 0, s = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
  f -= joy.y; s += joy.x;
  if ((Math.abs(f) > 0.05 || Math.abs(s) > 0.05) && moveTarget) clearTarget();
  const mag = Math.min(Math.hypot(f, s), 1);
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joy.x, joy.y) > 0.95;
  let moved = 0;
  if (game.on) { f = 0; s = 0; }
  if (player.sit && mag > 0.05 && !game.on) standUp();
  if (!player.sit && !game.on && mag > 0.05) {
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let mx = fx * f + rx * s, mz = fz * f + rz * s;
    const l = Math.hypot(mx, mz) || 1;
    mx /= l; mz /= l;
    const speed = (run ? 6.2 : 3.4) * mag;
    const [nx, nz] = collide(player.x + mx * speed * dt, player.z + mz * speed * dt);
    moved = Math.hypot(nx - player.x, nz - player.z);
    player.x = nx; player.z = nz;
    const target = Math.atan2(mx, mz);
    player.ry = lerpAngle(player.ry, target, Math.min(1, dt * 12));
  }
  // 핑 찍은 곳으로 걸어가기
  if (moveTarget && !game.on && !player.sit && mag <= 0.05) {
    const dx = moveTarget.x - player.x, dz = moveTarget.z - player.z, d = Math.hypot(dx, dz);
    if (d < 0.12) clearTarget();
    else {
      const step = Math.min(d, 3.4 * dt);
      const [nx, nz] = collide(player.x + (dx / d) * step, player.z + (dz / d) * step);
      moved = Math.hypot(nx - player.x, nz - player.z);
      player.x = nx; player.z = nz;
      player.ry = lerpAngle(player.ry, Math.atan2(dx, dz), Math.min(1, dt * 12));
      // 막혀서 못 가면 멈춤
      moveTarget.stuck = moved < step * 0.3 ? (moveTarget.stuck || 0) + dt : 0;
      if (moveTarget.stuck > 0.5) clearTarget();
    }
  }
  player.speed = dt > 0 ? moved / dt : 0;
  placeAvatar(myAvatar, player);
  myAvatar.animate(dt, player.speed, now);

  const z = zoneAt(player.floor, player.x, player.z);
  if (z !== player.zone) {
    player.zone = z;
    showFloorHud();
    sendState(true);
  }
  const pr = $('prompt');
  const what = nearWhat();
  if (game.on) pr.hidden = true;
  else if (what && what.booth) { pr.textContent = isTouch ? `🥊 ${what.booth.i + 1}번 샌드백 치기 (누르기)` : `E  🥊 ${what.booth.i + 1}번 샌드백 치기`; pr.hidden = false; }
  else if (player.sit && player.working) { pr.textContent = isTouch ? '일 그만하기 (누르기)' : '일 그만하기: E 또는 이동 키'; pr.hidden = false; }
  else if (player.sit) { pr.textContent = isTouch ? '일어나기 (누르기)' : '이동 키를 누르면 일어나요'; pr.hidden = false; }
  else if (what && what.seat && what.seat.desk) { pr.textContent = isTouch ? '💻 일하기 (누르기)' : 'E  💻 일하기'; pr.hidden = false; }
  else if (what && what.seat) { pr.textContent = isTouch ? '앉기 (누르기)' : 'E  앉기'; pr.hidden = false; }
  else if (what === 'notice') { pr.textContent = isTouch ? '공지판 보기 (누르기)' : 'E  공지판 보기'; pr.hidden = false; }
  else if (what === 'elev') { pr.textContent = isTouch ? '엘리베이터 타기 (누르기)' : 'E  엘리베이터 타기'; pr.hidden = false; }
  else pr.hidden = true;
}

function nearWhat() {
  if (player.floor === NOTICE.floor && Math.hypot(player.x - NOTICE.x, player.z - NOTICE.z) < 2.4) return 'notice';
  if (Math.hypot(player.x - ELEV.x, player.z - ELEV.z) < 1.9) return 'elev';
  if (player.floor === 3) for (const b of BOOTHS) if (Math.hypot(player.x - b.spot.x, player.z - b.spot.z) < 0.85) return { booth: b };
  {
    const list = player.floor === 0 ? null : bld.floors[player.floor].seats;
    let best = null, bd = 1.2;
    if (list) for (const s of list) { const d = Math.hypot(player.x - s.x, player.z - s.z); if (d < bd) { bd = d; best = s; } }
    if (player.floor === 0)
    for (const s of [...bld.floors[0].seats, ...garden.seats]) { const d = Math.hypot(player.x - s.x, player.z - s.z); if (d < bd) { bd = d; best = s; } }
    if (best) return { seat: best };
  }
  return null;
}
// ---------- 핑 찍어 이동 ----------
let moveTarget = null;
const raycaster = new THREE.Raycaster();
const pingMark = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 28), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, depthWrite: false }));
pingMark.rotation.x = -Math.PI / 2; pingMark.visible = false; pingMark.renderOrder = 5;
scene.add(pingMark);
function clearTarget() { moveTarget = null; pingMark.visible = false; }
function tapMove(cx, cy) {
  if (mode !== 'office' || game.on || !myAvatar) return;
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
  const fy = FLOORS[player.floor].y;
  const hit = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -fy), new THREE.Vector3());
  if (!hit) return;
  const lx = player.floor === 0 ? LOT - 0.4 : HX - 0.5, lz = player.floor === 0 ? LOT - 0.4 : HZ - 0.5;
  const x = THREE.MathUtils.clamp(hit.x, -lx, lx), z = THREE.MathUtils.clamp(hit.z, -lz, lz);
  if (Math.hypot(x - player.x, z - player.z) > 40) return;
  if (player.sit) standUp();
  moveTarget = { x, z, stuck: 0 };
  pingMark.position.set(x, fy + 0.04, z);
  pingMark.visible = true; pingMark.scale.setScalar(1.6);
}

// ---------- 앉기 ----------
function sitDown(seat) {
  player.sit = seat;
  player.x = seat.x; player.z = seat.z; player.ry = seat.ry;
  myAvatar.setSit(true, seat.h);
  player.working = !!seat.desk;
  myAvatar.setWorking(player.working);
  if (player.working) sysMessage('💻 일하는 중이에요. 다른 사람 화면에 "일하는 중..." 풍선이 보여요.');
  cam.yaw = seat.ry + Math.PI; cam.pitch = 0.3;
  sendState(true);
}
function standUp() {
  const s = player.sit;
  player.sit = null;
  // 앉았던 자리 뒤쪽으로 일어남 (책상·물 쪽이 아니라)
  const [bx, bz] = collide(s.x - Math.sin(s.ry) * 0.7, s.z - Math.cos(s.ry) * 0.7);
  player.x = bx; player.z = bz;
  myAvatar.setSit(false);
  player.working = false;
  myAvatar.setWorking(false);
  sendState(true);
}
// 물소리: 개울·분수에 가까울수록 크게, 앉아 있으면 조금 더
function updateWaterSound() {
  let v = 0;
  if (player.floor === 0 && (mode === 'office' || mode === 'fly')) {
    const ds = Math.max(0, Math.abs(player.z - STREAM.z) - STREAM.half);
    const vs = Math.pow(Math.max(0, 1 - ds / 14), 2) * 0.55;
    const df = Math.max(0, Math.hypot(player.x, player.z - 17) - 3.7);
    const vf = Math.pow(Math.max(0, 1 - df / 11), 2) * 0.4;
    v = Math.max(vs, vf) * (player.sit ? 1.35 : 1);
  }
  setWaterVolume(v);
}
function showFloorHud() {
  $('floorLabel').textContent = FLOORS[player.floor].label;
  const name = ZONES[player.zone].replace(/^\dF /, '');
  $('zoneLabel').textContent = name;
  $('zoneTab').textContent = name;
}
function placeAvatar(av, p) {
  av.root.position.set(p.x, FLOORS[p.floor || 0].y, p.z);
  av.root.rotation.y = p.ry;
}
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

// ---------- 카메라 ----------
const tmpV = new THREE.Vector3();
function insideTall(x, z) {
  for (const c of bld.floors[player.floor].colliders) if (c.tall && x > c.x1 - 0.15 && x < c.x2 + 0.15 && z > c.z1 - 0.15 && z < c.z2 + 0.15) return true;
  return false;
}
function officeCamPose(dt, out) {
  const outside = player.floor === 0 && (Math.abs(player.x) > HX || Math.abs(player.z) > HZ);
  const fy = FLOORS[player.floor].y, top = player.floor === ROOF || outside ? 7 : CEIL - 0.15;
  const bx = player.floor === 0 ? LOT : HX, bz = player.floor === 0 ? LOT : HZ;
  const tx = player.x, ty = fy + 0.85, tz = player.z;
  const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  let allowed = cam.dist;
  for (let t = 0.3; t <= cam.dist; t += 0.12) {
    const x = tx + dir.x * t, y = ty + dir.y * t, z = tz + dir.z * t;
    const inBld = Math.abs(x) < HX && Math.abs(z) < HZ;
    if (Math.abs(x) > bx - 0.15 || Math.abs(z) > bz - 0.15 || y > fy + (inBld && !outside ? top : 7) || (outside && inBld && y > CEIL - 0.1 && y < 4.1) || y < fy + 0.15 || insideTall(x, z)) { allowed = Math.max(0.3, t - 0.12); break; }
  }
  if (dt === null) cam.cur = allowed;
  else cam.cur = allowed < cam.cur ? allowed : cam.cur + (allowed - cam.cur) * Math.min(1, dt * 3);
  out.pos.set(tx + dir.x * cam.cur, ty + dir.y * cam.cur, tz + dir.z * cam.cur);
  out.look.set(tx, ty, tz);
  return out;
}
function orbitPose(out) {
  const { angle, elev, radius, target } = orbit;
  out.pos.set(target.x + Math.sin(angle) * Math.cos(elev) * radius, target.y + Math.sin(elev) * radius, target.z + Math.cos(angle) * Math.cos(elev) * radius);
  out.look.copy(target);
  return out;
}
const pose = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
const curLook = new THREE.Vector3(0, -110, 0);

function startFly(to, dur) {
  fly = { to, t: 0, dur, fromPos: camera.position.clone(), fromLook: curLook.clone() };
  mode = 'fly';
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function updateCamera(dt) {
  if (mode === 'fly') {
    fly.t += dt / fly.dur;
    const k = ease(Math.min(fly.t, 1));
    if (fly.to === 'office') officeCamPose(null, pose); else orbitPose(pose);
    // 위로 솟구쳤다가 내려오는 곡선
    const p = fly.fromPos.clone().lerp(pose.pos, k);
    p.y += Math.sin(k * Math.PI) * (fly.to === 'office' ? 25 : 15);
    camera.position.copy(p);
    curLook.copy(fly.fromLook).lerp(pose.look, Math.min(1, k * 1.15));
    camera.lookAt(curLook);
    if (fly.t >= 1) { mode = fly.to; fly = null; bld.setFloor(player.floor, mode !== 'office'); }
  } else if (mode === 'office') {
    officeCamPose(dt, pose);
    camera.position.copy(pose.pos);
    curLook.copy(pose.look);
    camera.lookAt(curLook);
  } else {
    if (idleTime > 4) orbit.angle += dt * 0.04;
    orbitPose(pose);
    camera.position.copy(pose.pos);
    curLook.copy(pose.look);
    camera.lookAt(curLook);
  }
  // 거리 따라 near 조절 (먼 경치 깊이 정밀도)
  const inside = Math.abs(camera.position.x) < HX + 1 && Math.abs(camera.position.z) < HZ + 1 && camera.position.y < 25;
  const near = inside ? 0.1 : THREE.MathUtils.clamp(camera.position.distanceTo(curLook) * 0.004, 0.1, 1);
  if (Math.abs(camera.near - near) > 0.01) { camera.near = near; camera.updateProjectionMatrix(); }
  if (myAvatar) myAvatar.root.visible = !(mode === 'office' && cam.cur < 0.7);
}

// ---------- 네트워크 ----------
let lastSend = 0, lastSent = { x: 0, z: 0, ry: 0 };
function sendState(force = false) {
  if (!net) return;
  const t = performance.now();
  const movedEnough = Math.abs(player.x - lastSent.x) + Math.abs(player.z - lastSent.z) > 0.02 || Math.abs(player.ry - lastSent.ry) > 0.05;
  // 무료 사용량을 아끼려고: 움직일 때 초당 4번, 가만히 있을 땐 8초에 한 번만 보냄
  if (!force && !(movedEnough && t - lastSend > 250) && t - lastSend < 8000) return;
  lastSend = t;
  lastSent = { x: player.x, z: player.z, ry: player.ry };
  net.sendState({ id: me.id, name: me.name, color: me.color, g: me.gender, floor: player.floor, x: +player.x.toFixed(2), z: +player.z.toFixed(2), ry: +player.ry.toFixed(2), sp: +player.speed.toFixed(1), zone: player.zone, st: player.sit ? player.sit.h : 0, bx: game.on ? game.booth.i : -1, pc: game.pc, wk: player.working ? 1 : 0 });
}

function onState(p) {
  if (!p?.id || p.id === me.id) return;
  let peer = peers.get(p.id);
  if (!peer || peer.name !== p.name) {
    if (peer) { scene.remove(peer.av.root); peer.av.dispose(); }
    const fresh = !peer;
    peer = { av: new Avatar(p.name, p.color, p.g), x: p.x, z: p.z, ry: p.ry, floor: p.floor || 0, name: p.name, color: p.color };
    scene.add(peer.av.root);
    peers.set(p.id, peer);
    if (fresh) { sysMessage(`${p.name}님이 들어왔어요.`); sendState(true); }
    updateOnline();
  }
  if (peer.color !== p.color || peer.av.gender !== (p.g === 'f' ? 'f' : 'm')) { peer.av.setLook(p.color, p.g); peer.color = p.color; }
  if ((p.floor || 0) !== peer.floor) { peer.x = p.x; peer.z = p.z; }
  Object.assign(peer, { tx: p.x, tz: p.z, tr: p.ry, sp: p.sp || 0, zone: p.zone, floor: p.floor || 0 });
  peer.av.setSit(!!p.st, +p.st || 0);
  peer.av.setWorking(!!p.wk && !!p.st);
  const bx = Number.isInteger(p.bx) ? p.bx : -1;
  peer.av.setBoxing(bx >= 0);
  if (bx >= 0 && (p.pc || 0) > (peer.pc || 0)) { peer.av.punch(now); if (peer.floor === player.floor) bld.hitBag(bx, 2); }
  peer.pc = p.pc || 0;
}
function removePeer(id) {
  const peer = peers.get(id);
  if (!peer) return;
  scene.remove(peer.av.root);
  peer.av.dispose();
  peers.delete(id);
  sysMessage(`${peer.name}님이 나갔어요.`);
  updateOnline();
}
function updatePeers(dt) {
  for (const p of peers.values()) {
    if (p.tx === undefined) continue;
    const k = Math.min(1, dt * 6);
    p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k;
    p.ry = lerpAngle(p.ry, p.tr, k);
    placeAvatar(p.av, p);
    p.av.root.visible = mode !== 'office' || p.floor === player.floor;
    p.av.animate(dt, p.sp, now);
  }
}
function updateOnline() {
  $('onlineCount').textContent = peers.size + 1;
}

// ---------- 채팅 ----------
const chatLog = $('chatLog');
function addLine(html) {
  const li = document.createElement('li');
  li.innerHTML = html;
  chatLog.appendChild(li);
  while (chatLog.children.length > 80) chatLog.firstChild.remove();
  chatLog.scrollTop = chatLog.scrollHeight;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function sysMessage(text) { addLine(`<span class="sys">${esc(text)}</span>`); }
function showChat(m) {
  const tag = m.scope !== 'all' ? `<span class="tag">[${esc(ZONES[m.scope] || m.scope)}]</span>` : '';
  const color = /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#fff';
  addLine(`${tag}<span class="who" style="color:${color}">${esc(m.name)}</span>${esc(m.text)}`);
}
function receiveChat(m) {
  if (!m?.text) return;
  if (m.scope !== 'all' && m.scope !== player.zone) return;
  showChat(m);
  peers.get(m.id)?.av.say(m.text, now);
  if (isTouch && $('chat').hidden) $('chatOpen').textContent = '💬•';
}
$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('chatInput').value.trim().slice(0, 200);
  if (!text) { $('chatInput').blur(); return; }
  const m = { id: me.id, name: me.name, color: me.color, text, scope: chatTab === 'all' ? 'all' : player.zone, ts: Date.now() };
  net?.sendChat(m);
  showChat(m);
  myAvatar?.say(text, now);
  $('chatInput').value = '';
  if (!isTouch) $('chatInput').blur();
});
document.querySelectorAll('.chat-tabs [data-tab]').forEach((b) => {
  b.onclick = () => {
    chatTab = b.dataset.tab;
    document.querySelectorAll('.chat-tabs [data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    $('chatInput').placeholder = chatTab === 'all' ? '전체에게 말하기' : `${ZONES[player.zone]}에 있는 사람에게만`;
  };
});
function setChatOpen(open) {
  $('chat').hidden = !open;
  $('chatOpen').hidden = open;
  if (open) $('chatOpen').textContent = '💬';
}
$('chatToggle').onclick = () => setChatOpen(false);
$('chatOpen').onclick = () => setChatOpen(true);

// ---------- 공지 · 접속자 ----------
let notices = [];
async function refreshNotices() {
  notices = await listNotices();
  drawNoticeBoard(bld.notice.canvas, notices);
  bld.notice.texture.needsUpdate = true;
  $('noticeList').innerHTML = notices.map((n) => {
    const d = n.created_at ? new Date(n.created_at).toLocaleDateString('ko-KR') : '';
    return `<li><h3>${esc(n.title)}</h3><p>${esc(n.body || '')}</p><small>${esc(n.author || '')} · ${d}</small></li>`;
  }).join('');
  $('noticeMode').textContent = supa ? '모든 직원에게 바로 보여요.' : '로컬 데모 모드: 이 브라우저에만 저장돼요. Supabase를 연결하면 모두에게 보여요.';
}
refreshNotices();
setInterval(refreshNotices, 60000);

function openModal(id) { closeModals(); $(id).hidden = false; }
function closeModals() { document.querySelectorAll('.modal').forEach((m) => (m.hidden = true)); }
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m || e.target.hasAttribute('data-close')) closeModals(); }));
$('btnNotice').onclick = () => { refreshNotices(); openModal('noticeModal'); };
$('prompt').onclick = () => interact();
function interact() {
  if (mode !== 'office') return;
  const what = nearWhat();
  if (player.sit) { standUp(); return; }
  if (what && what.booth) startGame(what.booth);
  else if (what && what.seat) sitDown(what.seat);
  else if (what === 'notice') { refreshNotices(); openModal('noticeModal'); }
  else if (what === 'elev') openFloorMenu();
}
$('btnSound').onclick = () => { setMuted(!isMuted()); $('btnSound').textContent = isMuted() ? '🔇' : '🔊'; startAudio(); try { localStorage.setItem('work-mute', isMuted() ? '1' : '0'); } catch {} };
try { if (localStorage.getItem('work-mute') === '1') { setMuted(true); $('btnSound').textContent = '🔇'; } } catch {}

// ---------- 엘리베이터 · 층 이동 ----------
function openFloorMenu() {
  $('floorList').innerHTML = FLOORS.map((f, i) => `<button data-f="${i}" class="${i === player.floor ? 'here' : ''}"><b>${f.label}</b>${f.name}</button>`).join('');
  $('floorList').querySelectorAll('button').forEach((b) => (b.onclick = () => goFloor(+b.dataset.f)));
  openModal('floorModal');
}
function goFloor(f) {
  closeModals();
  clearTarget();
  if (player.sit) standUp();
  if (game.on) quitGame();
  if (mode === 'exterior') { player.floor = f; arrive(); startFly('office', 2.6); $('btnView').textContent = '외관 보기'; return; }
  if (mode !== 'office') return;
  const fade = $('fade');
  fade.classList.add('on');
  setTimeout(() => {
    player.floor = f;
    arrive();
    bld.setFloor(f);
    officeCamPose(null, pose);
    fade.classList.remove('on');
  }, 450);
}
function arrive() {
  player.x = ELEV.x + 1.6; player.z = ELEV.z + 0.6; player.ry = Math.PI / 2;
  cam.yaw = -Math.PI / 2; cam.pitch = 0.2;
  player.zone = zoneAt(player.floor, player.x, player.z);
  showFloorHud();
  sendState(true);
}
$('btnFloor').onclick = () => { if (mode === 'office' || mode === 'exterior') openFloorMenu(); };
$('noticeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('noticeTitle').value.trim(), body = $('noticeBody').value.trim();
  if (!title) return;
  try {
    await addNotice({ title, body, author: me.name || '익명' });
    $('noticeTitle').value = ''; $('noticeBody').value = '';
    await refreshNotices();
    net?.sendChat({ id: me.id, name: me.name, color: me.color, text: `📌 새 공지: ${title}`, scope: 'all', ts: Date.now() });
  } catch (err) {
    alert('공지를 올리지 못했어요: ' + (err.message || err));
  }
});
$('btnPeople').onclick = () => {
  const rows = [{ name: me.name + ' (나)', color: me.color, zone: player.zone }, ...[...peers.values()]];
  $('peopleList').innerHTML = rows.map((p) => `<li><i style="background:${/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#888'}"></i>${esc(p.name)}<small>${esc(ZONES[p.zone] || '')}</small></li>`).join('');
  openModal('peopleModal');
};
$('btnView').onclick = () => {
  if (mode === 'office') { orbit.radius = 80; orbit.elev = 0.2; orbit.angle = Math.atan2(camera.position.x, camera.position.z); bld.setFloor(player.floor, true); startFly('exterior', 2.2); $('btnView').textContent = '안으로'; $('zoneLabel').textContent = '건물 밖에서 보기'; }
  else if (mode === 'exterior') { startFly('office', 2.2); $('btnView').textContent = '외관 보기'; showFloorHud(); }
};

// ---------- 오락존: 샌드백 치기 ----------
const game = { on: false, booth: null, phase: 'idle', t: 0, score: 0, hits: 0, combo: 1, maxCombo: 1, last: 0, pc: 0, beepAt: 4 };
let best = 0;
try { best = +localStorage.getItem('work-punch-best') || 0; } catch {}
function startGame(b) {
  clearTarget();
  if (player.sit) standUp();
  Object.assign(game, { on: true, booth: b, phase: 'count', t: 3, score: 0, hits: 0, combo: 1, maxCombo: 1, last: 0, beepAt: 4 });
  player.x = b.spot.x; player.z = b.spot.z; player.ry = Math.PI / 2;
  cam.yaw = -0.75; cam.pitch = 0.2; cam.dist = 2.2; // 부스 앞 비스듬히에서 사람과 샌드백이 함께 보이게
  myAvatar.setBoxing(true);
  $('game').hidden = false; $('gResult').hidden = true; $('gPunch').hidden = false;
  $('gScore').textContent = '0'; $('gCombo').textContent = ''; $('gTime').textContent = '10.0';
  $('joy').hidden = true;
  sendState(true);
}
function punch() {
  if (!game.on || game.phase !== 'play') return;
  const since = now - game.last;
  game.combo = since < 0.42 ? Math.min(game.combo + 0.12, 2.5) : 1;
  game.maxCombo = Math.max(game.maxCombo, game.combo);
  game.last = now;
  const dmg = Math.round((8 + Math.random() * 7) * game.combo);
  game.score += dmg; game.hits++; game.pc++;
  bld.hitBag(game.booth.i, 1.4 + game.combo * 0.6);
  myAvatar.punch(now);
  playThump(game.combo);
  $('gScore').textContent = game.score;
  $('gCombo').textContent = game.combo > 1.05 ? `콤보 x${game.combo.toFixed(1)}` : '';
  const f = document.createElement('span');
  f.className = 'gfloat'; f.textContent = `+${dmg}`;
  f.style.left = `${45 + Math.random() * 10}%`;
  if (game.combo > 1.8) f.classList.add('big');
  $('gFloat').appendChild(f);
  setTimeout(() => f.remove(), 700);
  if (performance.now() - lastSend > 250) sendState(true);
}
function updateGame(dt) {
  if (game.phase === 'count') {
    game.t -= dt;
    const n = Math.ceil(game.t);
    $('gBig').textContent = n > 0 ? n : '시작!';
    $('gBig').hidden = false;
    if (n < game.beepAt && n > 0) { game.beepAt = n; playBeep(660); }
    if (game.t <= 0) { game.phase = 'play'; game.t = 10; playBeep(990, 0.25); setTimeout(() => { if (game.phase === 'play') $('gBig').hidden = true; }, 500); }
  } else if (game.phase === 'play') {
    game.t -= dt;
    $('gTime').textContent = Math.max(0, game.t).toFixed(1);
    if (game.combo > 1 && now - game.last > 0.6) { game.combo = 1; $('gCombo').textContent = ''; }
    if (game.t <= 0) endGame();
  }
}
function endGame() {
  game.phase = 'result';
  const newBest = game.score > best;
  if (newBest) { best = game.score; try { localStorage.setItem('work-punch-best', String(best)); } catch {} }
  $('gBig').hidden = true; $('gPunch').hidden = true; $('gResult').hidden = false;
  $('gResText').innerHTML = `<b>${game.score}점</b> · ${game.hits}번 펀치 · 최대 콤보 x${game.maxCombo.toFixed(1)}<br>${newBest ? '🎉 내 최고 기록!' : `내 최고 기록 ${best}점`}`;
  playBeep(523, 0.15); setTimeout(() => playBeep(784, 0.3), 160);
  const m = { id: me.id, name: me.name, color: me.color, text: `🥊 ${game.booth.i + 1}번 부스 샌드백 ${game.score}점!${newBest ? ' (최고 기록)' : ''}`, scope: 'all', ts: Date.now() };
  net?.sendChat(m); showChat(m);
}
function quitGame() {
  game.on = false; game.phase = 'idle';
  myAvatar.setBoxing(false);
  $('game').hidden = true;
  $('joy').hidden = !isTouch;
  cam.dist = 3.4;
  sendState(true);
}
$('gPunch').addEventListener('pointerdown', (e) => { e.preventDefault(); punch(); });
$('gAgain').onclick = () => startGame(game.booth);
$('gQuit').onclick = quitGame;
$('gClose').onclick = quitGame;

// ---------- 낮 / 밤 ----------
let dayTarget = 0, dayVal = -1;
{ // 고른 적이 없으면 실제 시간에 맞춤 (7시~18시는 낮)
  let saved = null;
  try { saved = localStorage.getItem('work-day'); } catch {}
  const h = new Date().getHours();
  dayTarget = saved === '1' ? 1 : saved === '0' ? 0 : (h >= 7 && h < 18 ? 1 : 0);
}
function applyDay(d) {
  uniforms.uDay.value = d;
  uniforms.uFogColor.value.copy(FOG_NIGHT).lerp(FOG_DAY, d);
  scene.background.setRGB(0.008, 0.012, 0.035).lerp(FOG_DAY, d);
  sun.intensity = 2.6 * d;
  bloom.strength = 0.55 - 0.4 * d;
  bloom.threshold = 0.92 + 0.08 * d;
  renderer.toneMappingExposure = 1.0 - 0.1 * d;
  bld.setDay(d);
  garden.setDay(d);
}
function setDayButtons() {
  const label = dayTarget > 0.5 ? '🌙 밤' : '☀️ 낮';
  $('btnDay').textContent = label;
  $('introDay').textContent = dayTarget > 0.5 ? '🌙 밤으로 보기' : '☀️ 낮으로 보기';
}
function toggleDay() {
  dayTarget = dayTarget > 0.5 ? 0 : 1;
  try { localStorage.setItem('work-day', dayTarget ? '1' : '0'); } catch {}
  setDayButtons();
}
$('btnDay').onclick = toggleDay;
$('introDay').onclick = toggleDay;
setDayButtons();

// ---------- 루프 ----------
const clock = new THREE.Clock();
let now = 0, idleTime = 10;
orbitPose(pose);
camera.position.copy(pose.pos);
camera.lookAt(pose.look);

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  now += dt;
  idleTime += dt;
  uniforms.uTime.value = now;
  if (dayVal < 0) { dayVal = dayTarget; applyDay(dayVal); }
  else if (Math.abs(dayVal - dayTarget) > 0.001) { dayVal += Math.sign(dayTarget - dayVal) * Math.min(Math.abs(dayTarget - dayVal), dt * 0.8); applyDay(dayVal); }
  bld.update(dt, myAvatar ? player : null);
  garden.update(dt);
  if (game.on) updateGame(dt);
  if (pingMark.visible) { pingMark.scale.setScalar(Math.max(1, pingMark.scale.x - dt * 3)); pingMark.rotation.z += dt * 2; }
  if (myAvatar) updateWaterSound();
  if (myAvatar && (mode === 'office' || mode === 'fly' || mode === 'exterior')) {
    if (mode === 'office') updatePlayer(dt); else myAvatar.animate(dt, 0, now);
    sendState();
  }
  updatePeers(dt);
  updateCamera(dt);
  if (!$('intro').hidden && pv.av) { pv.av.root.rotation.y += dt * 0.6; pv.av.animate(dt, 0, now); pv.renderer.render(pv.scene, pv.cam); }
  sky.position.copy(camera.position);
  composer.render();
  requestAnimationFrame(frame);
}
if (returning) $('intro').hidden = true; // 바로 출근하므로 시작 화면은 건너뜀
requestAnimationFrame(() => {
  frame();
  if (returning) setTimeout(enter, 600);
  setTimeout(() => $('loading').classList.add('done'), 300);
});

// 테스트용 훅
window.__work = { get mode() { return mode; }, toggleDay, game, bld, get day() { return dayVal; }, player, cam, orbit, peers, enter, keys, goFloor };
window.__workMain = true;
