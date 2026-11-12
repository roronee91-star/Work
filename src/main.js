import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG, AVATAR_COLORS } from './config.js';
import { sharedUniforms, createSky, createMountains, createGround, createCity, createBridges } from './world.js';
import { createTower } from './tower.js';
import { createOffice, zoneAt, ZONES, S, CEIL, SPAWN, NOTICE_SPOT } from './office.js';
import { Avatar } from './avatar.js';
import { connect, makeId, supa } from './net.js';
import { listNotices, addNotice, drawNoticeBoard } from './notices.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;

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
scene.add(sky, createMountains(uniforms), createGround(uniforms), createCity(uniforms), createBridges(uniforms));
const tower = createTower(uniforms);
scene.add(tower.group);
const office = createOffice();
scene.add(office.group);

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
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- 상태 ----------
document.title = `${CONFIG.companyName} · ${CONFIG.floorLabel}`;
$('brandName').textContent = CONFIG.companyName;
$('brandTagline').textContent = CONFIG.companyTagline;
$('floorLabel').textContent = CONFIG.floorLabel;

const me = { id: makeId(), name: '', color: AVATAR_COLORS[0] };
const player = { x: SPAWN.x, z: SPAWN.z, ry: SPAWN.yaw + Math.PI, speed: 0, zone: 'lobby' };
const cam = { yaw: SPAWN.yaw, pitch: 0.22, dist: 4.4, cur: 4.4 };
const orbit = { angle: Math.PI - 0.55, elev: 0.08, radius: 900, target: new THREE.Vector3(0, -110, 0) };
let mode = 'intro'; // intro | office | exterior | fly
let fly = null;
let myAvatar = null;
let net = null;
const peers = new Map();
let chatTab = 'all';

// 저장된 이름/색
try {
  const saved = JSON.parse(localStorage.getItem('work-tower-me') || 'null');
  if (saved?.name) $('nameInput').value = saved.name;
  if (saved?.color) me.color = saved.color;
} catch {}

// ---------- 시작 화면 ----------
const colorPick = $('colorPick');
AVATAR_COLORS.forEach((c) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.background = c;
  b.title = c;
  if (c === me.color) b.classList.add('on');
  b.onclick = () => { me.color = c; colorPick.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
  colorPick.appendChild(b);
});
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') enter(); });
$('enterBtn').onclick = enter;

function enter() {
  me.name = ($('nameInput').value.trim() || '게스트' + Math.floor(Math.random() * 900 + 100)).slice(0, 16);
  try { localStorage.setItem('work-tower-me', JSON.stringify({ name: me.name, color: me.color })); } catch {}
  $('intro').hidden = true;
  $('hud').hidden = false;
  $('joy').hidden = !isTouch;
  if (isTouch) setChatOpen(false);
  myAvatar = new Avatar(me.name, me.color);
  scene.add(myAvatar.root);
  placeAvatar(myAvatar, player);
  net = connect(me, {
    onState, onChat: receiveChat, onLeave: removePeer,
    onStatus(text, online) { $('netText').textContent = text; $('netDot').classList.toggle('on', online); },
  });
  sysMessage(`${CONFIG.floorLabel}에 오신 걸 환영해요, ${me.name}님! 창가로 가서 야경을 보세요.`);
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
  keys.add(e.code);
  if (e.code === 'Enter') { e.preventDefault(); setChatOpen(true); $('chatInput').focus(); }
  if (e.code === 'KeyE') interact();
  if (e.code === 'Escape') closeModals();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const pointers = new Map();
let pinchDist = 0;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) pinchDist = pinchLen();
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
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY * 0.002); }, { passive: false });
function pinchLen() { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
function zoom(d) {
  if (mode === 'office') cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + d), 1.2, 9);
  else orbit.radius = THREE.MathUtils.clamp(orbit.radius * (1 + d), 160, 2200);
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
const R = 0.32;
function collide(x, z) {
  for (let it = 0; it < 3; it++) {
    for (const c of office.colliders) {
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
  const lim = S - 0.4;
  return [Math.max(-lim, Math.min(lim, x)), Math.max(-lim, Math.min(lim, z))];
}

function updatePlayer(dt) {
  let f = 0, s = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
  f -= joy.y; s += joy.x;
  const mag = Math.min(Math.hypot(f, s), 1);
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joy.x, joy.y) > 0.95;
  let moved = 0;
  if (mag > 0.05) {
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
  player.speed = dt > 0 ? moved / dt : 0;
  placeAvatar(myAvatar, player);
  myAvatar.animate(dt, player.speed, now);

  const z = zoneAt(player.x, player.z);
  if (z !== player.zone) {
    player.zone = z;
    $('zoneLabel').textContent = ZONES[z];
    $('zoneTab').textContent = ZONES[z];
    sendState(true);
  }
  const nearNotice = Math.hypot(player.x - NOTICE_SPOT.x, player.z - NOTICE_SPOT.z) < 2.6;
  const pr = $('prompt');
  if (nearNotice) { pr.textContent = isTouch ? '공지판 보기 (누르기)' : 'E  공지판 보기'; pr.hidden = false; }
  else pr.hidden = true;
}

function placeAvatar(av, p) {
  av.root.position.set(p.x, 0, p.z);
  av.root.rotation.y = p.ry;
}
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

// ---------- 카메라 ----------
const tmpV = new THREE.Vector3();
function insideTall(x, z) {
  for (const c of office.colliders) if (c.tall && x > c.x1 - 0.15 && x < c.x2 + 0.15 && z > c.z1 - 0.15 && z < c.z2 + 0.15) return true;
  return false;
}
function officeCamPose(dt, out) {
  const tx = player.x, ty = 1.5, tz = player.z;
  const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  let allowed = cam.dist;
  for (let t = 0.3; t <= cam.dist; t += 0.12) {
    const x = tx + dir.x * t, y = ty + dir.y * t, z = tz + dir.z * t;
    if (Math.abs(x) > S - 0.15 || Math.abs(z) > S - 0.15 || y > CEIL - 0.15 || y < 0.15 || insideTall(x, z)) { allowed = Math.max(0.3, t - 0.12); break; }
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
    p.y += Math.sin(k * Math.PI) * (fly.to === 'office' ? 60 : 40);
    camera.position.copy(p);
    curLook.copy(fly.fromLook).lerp(pose.look, Math.min(1, k * 1.15));
    camera.lookAt(curLook);
    if (fly.t >= 1) { mode = fly.to; fly = null; }
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
  const inside = Math.abs(camera.position.y) < 30 && Math.hypot(camera.position.x, camera.position.z) < 40;
  const near = inside ? 0.08 : THREE.MathUtils.clamp(camera.position.distanceTo(curLook) * 0.004, 0.1, 3);
  if (Math.abs(camera.near - near) > 0.01) { camera.near = near; camera.updateProjectionMatrix(); }
  if (myAvatar) myAvatar.root.visible = !(mode === 'office' && cam.cur < 0.7);
}

// ---------- 네트워크 ----------
let lastSend = 0, lastSent = { x: 0, z: 0, ry: 0 };
function sendState(force = false) {
  if (!net) return;
  const t = performance.now();
  const movedEnough = Math.abs(player.x - lastSent.x) + Math.abs(player.z - lastSent.z) > 0.02 || Math.abs(player.ry - lastSent.ry) > 0.05;
  if (!force && !(movedEnough && t - lastSend > 120) && t - lastSend < 2000) return;
  lastSend = t;
  lastSent = { x: player.x, z: player.z, ry: player.ry };
  net.sendState({ id: me.id, name: me.name, color: me.color, x: +player.x.toFixed(2), z: +player.z.toFixed(2), ry: +player.ry.toFixed(2), sp: +player.speed.toFixed(1), zone: player.zone });
}

function onState(p) {
  if (!p?.id || p.id === me.id) return;
  let peer = peers.get(p.id);
  if (!peer || peer.name !== p.name) {
    if (peer) { scene.remove(peer.av.root); peer.av.dispose(); }
    const fresh = !peer;
    peer = { av: new Avatar(p.name, p.color), x: p.x, z: p.z, ry: p.ry, name: p.name, color: p.color };
    scene.add(peer.av.root);
    peers.set(p.id, peer);
    if (fresh) { sysMessage(`${p.name}님이 들어왔어요.`); sendState(true); }
    updateOnline();
  }
  if (peer.color !== p.color) { peer.av.setColor(p.color); peer.color = p.color; }
  Object.assign(peer, { tx: p.x, tz: p.z, tr: p.ry, sp: p.sp || 0, zone: p.zone });
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
    const k = Math.min(1, dt * 8);
    p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k;
    p.ry = lerpAngle(p.ry, p.tr, k);
    placeAvatar(p.av, p);
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
  drawNoticeBoard(office.notice.canvas, notices);
  office.notice.texture.needsUpdate = true;
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
  if (Math.hypot(player.x - NOTICE_SPOT.x, player.z - NOTICE_SPOT.z) < 2.6) { refreshNotices(); openModal('noticeModal'); }
}
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
  if (mode === 'office') { orbit.radius = 520; orbit.elev = 0.15; orbit.angle = Math.atan2(camera.position.x, camera.position.z); startFly('exterior', 2.6); $('btnView').textContent = '사무실로'; $('zoneLabel').textContent = '외관'; }
  else if (mode === 'exterior') { startFly('office', 2.6); $('btnView').textContent = '외관 보기'; $('zoneLabel').textContent = ZONES[player.zone]; }
};

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
  tower.update(now);
  if (myAvatar && (mode === 'office' || mode === 'fly' || mode === 'exterior')) {
    if (mode === 'office') updatePlayer(dt); else myAvatar.animate(dt, 0, now);
    sendState();
  }
  updatePeers(dt);
  updateCamera(dt);
  sky.position.copy(camera.position);
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(() => {
  frame();
  setTimeout(() => $('loading').classList.add('done'), 300);
});

// 테스트용 훅
window.__tower = { get mode() { return mode; }, player, cam, orbit, peers, enter, keys };
