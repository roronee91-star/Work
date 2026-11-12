import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG, AVATAR_COLORS } from './config.js';
import { sharedUniforms, createSky, createMountains, createGround, createCity, createBridges, createSite, createTraffic, FOG_NIGHT, FOG_DAY } from './world.js';
import { createBuilding, FLOORS, ZONES, zoneAt, HX, HZ, LOT, CEIL, ROOF, ELEV, NOTICE, SPAWN, BOOTHS, ARENA } from './building.js';
import { createGarden, STREAM } from './garden.js';
import { createDuel, SWORD, BOT_NAME } from './duel.js';
import { startAudio, setMuted, isMuted, playThump, playBeep } from './audio.js';
import { Avatar, WorkMonster } from './avatar.js';
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
const PR_MAX = Math.min(devicePixelRatio, isTouch ? 1.75 : 2);
let prNow = PR_MAX;
renderer.setPixelRatio(prNow); // 휴대폰도 선명하게 (버벅이면 아래에서 자동으로 조금 낮춤)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
// 배경색은 지우기 색으로 (scene.background를 쓰면 이름표를 따로 그릴 때 화면이 지워짐)
const BG = new THREE.Color(0x020309);
renderer.setClearColor(BG);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 12000);

const uniforms = sharedUniforms();
const sky = createSky(uniforms);
scene.add(sky, createMountains(uniforms), createGround(uniforms), createCity(uniforms), createBridges(uniforms), createSite());
const traffic = createTraffic();
scene.add(traffic.group);
const bld = createBuilding();
scene.add(bld.group);
bld.setFloor(0, true);
const garden = createGarden(uniforms);

// ---------- 1층 안내 비서 (NPC) ----------
const NPC_SPOT = { x: -6.1, z: -4.3 };
const npc = new Avatar('안내 비서', '#a8c4de', 'f');
npc.setSit(true, 0.48);
npc.root.position.set(NPC_SPOT.x, 0, NPC_SPOT.z);
npc.root.rotation.y = Math.PI / 2; // 로비 쪽을 바라봄
scene.add(npc.root);
bld.floors[0].colliders.push({ x1: NPC_SPOT.x - 0.35, z1: NPC_SPOT.z - 0.35, x2: NPC_SPOT.x + 0.3, z2: NPC_SPOT.z + 0.35, tall: false });
const NPC_LINES = [
  '어서 오세요! WORK 사옥에 오신 걸 환영해요 😊',
  '엘리베이터는 왼쪽 뒤에 있어요. 가까이 가면 층을 고를 수 있어요.',
  '카페는 오른쪽이에요. 오늘의 커피는 예가체프예요 ☕',
  '2층은 업무 공간, 3층은 회의실, 4층은 라운지와 오락존이에요.',
  '4층 오락존에서 샌드백 치기 한 판 어떠세요? 🥊',
  '옥상 테라스에서 보는 야경이 정말 예뻐요 🌙',
];
let npcLine = 0, npcGreetAt = -99;
function npcTalk() { npc.say(NPC_LINES[npcLine % NPC_LINES.length], now); npcLine++; }
function updateNpc(dt) {
  npc.root.visible = !(mode === 'office' && player.floor !== 0);
  npc.animate(dt, 0, now);
  // 가까이 오면 먼저 인사 (1분에 한 번)
  if (mode === 'office' && player.floor === 0 && Math.hypot(player.x - (NPC_SPOT.x + 1.5), player.z - NPC_SPOT.z) < 2.6 && now - npcGreetAt > 60) {
    npcGreetAt = now; npcLine = 0; npcTalk();
  }
}
scene.add(garden.group);
bld.floors[0].colliders.push(...garden.colliders);
const sun = new THREE.DirectionalLight(0xfff1dc, 0);
sun.position.set(45, 54, 72);
scene.add(sun);

const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }); // 계단 현상(픽셀 깨짐) 줄이기
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.3, 1.1);
composer.addPass(bloom);
// 이름표 · 말풍선 전용 카메라(층 1): 빛 번짐(bloom) 뒤에 그려서 밤에도 빛나지 않음
const labelCam = new THREE.PerspectiveCamera();
const labelPass = new RenderPass(scene, labelCam);
labelPass.clear = false;
composer.addPass(labelPass);
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

const VIEW_OUT = '<i>🏢</i><span>외관 보기</span>', VIEW_IN = '<i>🚪</i><span>안으로</span>';

// ---------- 상태 ----------
document.title = CONFIG.companyName;
$('brandName').textContent = CONFIG.companyName;
$('brandTagline').textContent = CONFIG.companyTagline;

const me = { id: makeId(), name: '', color: AVATAR_COLORS[0], gender: 'm', jt: 0, dev: '' };
// 이 기기 고유 번호 (같은 기기에서 다시 들어온 것인지 알아보려고)
try { me.dev = localStorage.getItem('work-dev') || makeId(); localStorage.setItem('work-dev', me.dev); } catch { me.dev = makeId(); }
const player = { floor: SPAWN.floor, x: SPAWN.x, z: SPAWN.z, ry: SPAWN.yaw + Math.PI, speed: 0, zone: 'f1' };
const cam = { yaw: SPAWN.yaw, pitch: 0.28, dist: 3.4, cur: 3.4 };
const orbit = { angle: 0.35, elev: 0.2, radius: 85, target: new THREE.Vector3(0, 8, 0) };
let mode = 'intro'; // intro | office | exterior | fly
let fly = null;
let myAvatar = null;
let net = null;
const peers = new Map();
// ⚔️ 결투 (아래 함수들은 실행될 때 찾으므로 여기서 만들어도 됨)
// 이름표: (패배자 칭호) + (Lv) + 이름 — 직함은 바꾸지 않음
const lvName = (name, lv, loser = false) => `${loser ? '😵패배자 ' : ''}${lv > 1 ? `Lv.${lv} ` : ''}${name}`;
const duel = createDuel({
  $, me, peers, isTouch,
  net: () => net,
  openModal: (id) => openModal(id), closeModals: () => closeModals(),
  sys: (t) => sysMessage(t), chatLine: (t) => sysMessage(t),
  beep: (f, d) => playBeep(f, d), thump: (p) => playThump(p),
  hurtMe: () => myAvatar?.hurt(now), peerHurt: (id) => peers.get(id)?.av.hurt(now),
  swing: () => myAvatar?.punch(now), sendNow: () => sendState(true),
  levelChanged: (lv) => { myAvatar?.setName(lvName(me.name, lv, duel.loser)); sendState(true); },
  label: (p) => lvName(p.name, p.lv || 1, p.tt), zoneName: (z) => ZONES[z] || '',
  botSwing: () => duelBot.punch(now), botHurt: () => duelBot.hurt(now),
  knockout: (id) => { if (id === me.id) myAvatar?.knockout(true); else if (id === 'bot') duelBot.knockout(true); else peers.get(id)?.av.knockout(true); },
  spark: (power) => hitSpark(power), shake: (amt) => { camShake = Math.max(camShake, amt); },
  enterArena(side, vsBot) {
    duelBot.root.visible = !!vsBot;
    clearTarget();
    if (player.sit) standUp();
    if (game.on) quitGame();
    myAvatar.setBoxing(true); myAvatar.setSword(true);
    $('joy').hidden = true; $('btnJump').hidden = true;
    const go = () => {
      player.x = ARENA.x + side * 0.42; player.z = ARENA.z; player.ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      cam.yaw = 0; cam.pitch = 0.22; cam.dist = 3.6;
      sendState(true);
    };
    if (player.floor !== ARENA.floor || mode !== 'office') { goFloor(ARENA.floor); setTimeout(go, 560); } else go();
  },
  exitArena() {
    duelBot.root.visible = false; duelBot.knockout(false); myAvatar.knockout(false);
    myAvatar.setBoxing(false); myAvatar.setSword(false);
    $('joy').hidden = !isTouch; $('btnJump').hidden = !isTouch;
    cam.dist = 3.4;
    sendState(true);
  },
});
const busy = () => game.on || duel.fighting;
// 칼이 맞는 자리에 번쩍 (두 사람 사이) · 맞으면 화면 흔들림
let camShake = 0;
const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 1.2), transparent: true, depthWrite: false });
const sparks = [];
function hitSpark(power = 1) {
  const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.09 + 0.04 * power, 0), sparkMat.clone());
  g.position.set(ARENA.x + (Math.random() - 0.5) * 0.15, FLOORS[ARENA.floor].y + 0.65 + Math.random() * 0.2, ARENA.z + (Math.random() - 0.5) * 0.2);
  g.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  scene.add(g); sparks.push({ g, t: 0 });
}
function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.t += dt;
    const k = s.t / 0.18;
    s.g.scale.setScalar(1 + k * 2.2); s.g.material.opacity = Math.max(0, 1 - k); s.g.rotation.z += dt * 8;
    if (k >= 1) { scene.remove(s.g); s.g.geometry.dispose(); s.g.material.dispose(); sparks.splice(i, 1); }
  }
}
// 👾 업무 괴물 (연습 상대, 내 화면에만) · ⚔️ 결투 관리인 (4층 NPC)
const duelBot = new WorkMonster(BOT_NAME);
duelBot.setBoxing(true); duelBot.setSword(true);
duelBot.root.position.set(ARENA.x + 0.42, FLOORS[ARENA.floor].y, ARENA.z); duelBot.root.rotation.y = -Math.PI / 2;
duelBot.root.visible = false;
scene.add(duelBot.root);
const HOST = { x: 3.3, z: -6.0 };
const duelHost = new Avatar('⚔️ 결투 관리인', '#3a3f4a', 'm');
duelHost.setSword(true);
duelHost.root.position.set(HOST.x, FLOORS[ARENA.floor].y, HOST.z);
scene.add(duelHost.root);
bld.floors[ARENA.floor].colliders.push({ x1: HOST.x - 0.3, z1: HOST.z - 0.3, x2: HOST.x + 0.3, z2: HOST.z + 0.3, tall: false, top: 1.3 });
// 패배자 칭호가 하루 지나 풀리면 이름표 다시 그림
let wasLoser = null;
setInterval(() => { if (myAvatar && wasLoser !== duel.loser) { wasLoser = duel.loser; myAvatar.setName(lvName(me.name, duel.level, duel.loser)); sendState(true); } }, 30000); // 게임 · 결투 중에는 걸어다니기 멈춤
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
const nameTaken = (n) => [...peers.values()].some((p) => p.name === n);
let forcedRename = false;
function askNewName() {
  if (forcedRename) return;
  forcedRename = true;
  openProfile();
  $('introCancel').hidden = true;
  $('nameErr').textContent = `"${me.name}" 이름은 이미 다른 분이 쓰고 있어요. 다른 이름을 정해 주세요.`;
  $('nameErr').hidden = false;
  $('nameInput').focus();
}
function saveProfile() {
  const name = ($('nameInput').value.trim() || me.name).slice(0, 16);
  if (nameTaken(name)) {
    $('nameErr').textContent = `"${name}" 이름은 이미 다른 분이 쓰고 있어요. 다른 이름을 정해 주세요.`;
    $('nameErr').hidden = false;
    return;
  }
  $('nameErr').hidden = true;
  forcedRename = false;
  const renamed = name !== me.name;
  me.name = name;
  try { localStorage.setItem('work-tower-me', JSON.stringify({ name: me.name, color: me.color, gender: me.gender })); } catch {}
  myAvatar.setLook(me.color, me.gender);
  if (renamed) myAvatar.setName(lvName(me.name, duel.level, duel.loser));
  if (renamed) duel.load(me.name);
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
  $('btnJump').hidden = !isTouch;
  if (isTouch) setChatOpen(false);
  startAudio();
  myAvatar = new Avatar(me.name, me.color, me.gender);
  if (duel.level > 1 || duel.loser) myAvatar.setName(lvName(me.name, duel.level, duel.loser));
  duel.load(me.name); // 결투 레벨 · 칭호 (Supabase)
  scene.add(myAvatar.root);
  placeAvatar(myAvatar, player);
  me.jt = Date.now();
  net = connect(me, {
    onState, onChat: receiveChat, onLeave: removePeer, onSync: () => sendState(true), onEvent: (e) => duel.onEvent(e),
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
  if (duel.fighting) {
    if (['Space', 'KeyE', 'KeyJ', 'KeyF'].includes(e.code)) { e.preventDefault(); if (!e.repeat) duel.attack(); }
    return;
  }
  if (game.on) {
    if (['Space', 'KeyE', 'KeyJ', 'KeyF'].includes(e.code)) { e.preventDefault(); if (!e.repeat) punch(); }
    if (e.code === 'Escape') quitGame();
    return;
  }
  keys.add(e.code);
  if (e.code === 'Enter') { e.preventDefault(); setChatOpen(true); $('chatInput').focus(); }
  if (e.code === 'KeyE') interact();
  if (e.code === 'Space') { e.preventDefault(); doJump(); }
  if (e.code === 'Escape') closeModals();
  if (/^Digit[1-5]$/.test(e.code) && !$('floorModal').hidden) chooseFloor(+e.code.slice(5) - 1);
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
  el.addEventListener('pointerdown', (e) => { document.activeElement?.blur?.(); joy.id = e.pointerId; el.setPointerCapture(e.pointerId); set(e); });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) set(e); });
  const end = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// ---------- 이동 · 충돌 ----------
const R = 0.26;
function collide(x, z) {
  // 점프해서 높이 떠 있으면 낮은 가구(의자 · 테이블 · 소파 · 화단)는 넘어감. 벽 · 유리 · 큰 가구는 그대로 막힘
  const feet = myAvatar ? myAvatar.jy : 0; // 지금 발 높이: 이보다 낮은 가구는 넘어감 / 위에 서 있음
  for (let it = 0; it < 3; it++) {
    for (const c of bld.floors[player.floor].colliders) {
      if (!c.tall && (c.top ?? 0.6) <= feet + 0.03) continue;
      if (c.circle) {
        const dx = x - c.cx, dz = z - c.cz, d = Math.hypot(dx, dz), m = c.r + R;
        if (d < m) { if (d > 1e-6) { x = c.cx + (dx / d) * m; z = c.cz + (dz / d) * m; } else z = c.cz + m; }
        continue;
      }
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
  if (busy()) { f = 0; s = 0; }
  if (player.sit && mag > 0.05 && !busy()) standUp();
  if (!player.sit && !busy() && mag > 0.05) {
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
  if (moveTarget && !busy() && !player.sit && mag <= 0.05) {
    const dx = moveTarget.x - player.x, dz = moveTarget.z - player.z, d = Math.hypot(dx, dz);
    if (d < 0.12) {
      if (moveTarget.path?.length) { const [nx, nz] = moveTarget.path.shift(); moveTarget.x = nx; moveTarget.z = nz; moveTarget.stuck = 0; }
      else finishTarget();
    } else {
      const step = Math.min(d, 3.4 * dt);
      const [nx, nz] = collide(player.x + (dx / d) * step, player.z + (dz / d) * step);
      moved = Math.hypot(nx - player.x, nz - player.z);
      player.x = nx; player.z = nz;
      player.ry = lerpAngle(player.ry, Math.atan2(dx, dz), Math.min(1, dt * 12));
      // 막혀서 못 가면 멈춤
      moveTarget.stuck = moved < step * 0.3 ? (moveTarget.stuck || 0) + dt : 0;
      if (moveTarget.stuck > 0.6 && !moveTarget.repathed) {
        const fin = moveTarget.path?.length ? moveTarget.path[moveTarget.path.length - 1] : [moveTarget.x, moveTarget.z];
        const keep = { then: moveTarget.then, until: moveTarget.until, repathed: true };
        if (!walkTo(fin[0], fin[1], keep)) finishTarget();
      } else if (moveTarget.stuck > 1.2 || (moveTarget.until && now > moveTarget.until)) finishTarget();
    }
  }
  player.speed = dt > 0 ? moved / dt : 0;
  { const g = player.sit ? 0 : groundAt(player.x, player.z, myAvatar.jy); if (Math.abs(g - myAvatar.ground) > 0.05 && performance.now() - lastSend > 300) { myAvatar.ground = g; sendState(true); } else myAvatar.ground = g; }
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
  // 엘리베이터 앞에 오면 몇 층 갈지 자동으로 물어봄 (한 번 뜨면 멀어졌다 다시 와야 또 뜸)
  const elevD = Math.hypot(player.x - ELEV.x, player.z - ELEV.z);
  if (elevD > 2.4) elevAsked = false;
  else if (what === 'elev' && !elevAsked && !busy() && !player.sit && document.querySelectorAll('.modal:not([hidden])').length === 0) { elevAsked = true; openFloorMenu(); }
  if (busy()) pr.hidden = true;
  else if (what && what.booth) { pr.textContent = isTouch ? `🥊 ${what.booth.i + 1}번 샌드백 치기 (누르기)` : `E  🥊 ${what.booth.i + 1}번 샌드백 치기`; pr.hidden = false; }
  else if (player.sit && player.working) { pr.textContent = isTouch ? '일 그만하기 (누르기)' : '일 그만하기: E 또는 이동 키'; pr.hidden = false; }
  else if (player.sit) { pr.textContent = isTouch ? '일어나기 (누르기)' : '이동 키를 누르면 일어나요'; pr.hidden = false; }
  else if (what && what.seat && what.seat.desk) { pr.textContent = isTouch ? '💻 일하기 (누르기)' : 'E  💻 일하기'; pr.hidden = false; }
  else if (what && what.seat) { pr.textContent = isTouch ? '앉기 (누르기)' : 'E  앉기'; pr.hidden = false; }
  else if (what === 'host') { pr.textContent = isTouch ? `⚔️ 정식 결투 신청 (누르기)` : `E  ⚔️ 정식 결투 신청`; pr.hidden = false; }
  else if (what === 'npc') { pr.textContent = isTouch ? '💬 비서에게 말 걸기 (누르기)' : 'E  💬 비서에게 말 걸기'; pr.hidden = false; }
  else if (what === 'notice') { pr.textContent = isTouch ? '공지판 보기 (누르기)' : 'E  공지판 보기'; pr.hidden = false; }
  else if (what === 'elev') { pr.textContent = isTouch ? '엘리베이터 타기 (누르기)' : 'E  엘리베이터 타기'; pr.hidden = false; }
  else pr.hidden = true;
}

// 다른 사람이 이미 앉아 있는 자리인지
function seatTaken(s) {
  for (const p of peers.values()) if (p.floor === player.floor && p.av.sitting && Math.hypot((p.tx ?? p.x) - s.x, (p.tz ?? p.z) - s.z) < 0.35) return true;
  return false;
}
function nearWhat() {
  if (player.floor === NOTICE.floor && Math.hypot(player.x - NOTICE.x, player.z - NOTICE.z) < 2.4) return 'notice';
  if (player.floor === 0 && Math.hypot(player.x - (NPC_SPOT.x + 1.4), player.z - NPC_SPOT.z) < 1.3) return 'npc';
  if (player.floor === ARENA.floor && Math.hypot(player.x - HOST.x, player.z - (HOST.z + 0.8)) < 1.2) return 'host';
  if (Math.hypot(player.x - ELEV.x, player.z - ELEV.z) < 1.9) return 'elev';
  if (player.floor === 3) for (const b of BOOTHS) if (Math.hypot(player.x - b.spot.x, player.z - b.spot.z) < 0.85) return { booth: b };
  {
    const list = player.floor === 0 ? null : bld.floors[player.floor].seats;
    let best = null, bd = 1.2;
    if (list) for (const s of list) { const d = Math.hypot(player.x - s.x, player.z - s.z); if (d < bd && !seatTaken(s)) { bd = d; best = s; } }
    if (player.floor === 0)
    for (const s of [...bld.floors[0].seats, ...garden.seats]) { const d = Math.hypot(player.x - s.x, player.z - s.z); if (d < bd && !seatTaken(s)) { bd = d; best = s; } }
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
// 목적지에 닿거나 막혔을 때: 할 일이 있으면 실행 (예: 엘리베이터 타기)
function finishTarget() { const cb = moveTarget?.then; clearTarget(); cb?.(); }
function tapMove(cx, cy) {
  if (mode !== 'office' || busy() || !myAvatar) return;
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);

  const fy = FLOORS[player.floor].y;
  const hit = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -fy), new THREE.Vector3());
  if (!hit) return;
  const lx = player.floor === 0 ? LOT - 0.4 : HX - 0.5, lz = player.floor === 0 ? LOT - 0.4 : HZ - 0.5;
  const x = THREE.MathUtils.clamp(hit.x, -lx, lx), z = THREE.MathUtils.clamp(hit.z, -lz, lz);
  if (Math.hypot(x - player.x, z - player.z) > 40) return;
  if (player.sit) standUp();
  if (!walkTo(x, z)) { moveTarget = { x, z, stuck: 0 }; pingMark.position.set(x, fy + 0.04, z); pingMark.visible = true; pingMark.scale.setScalar(1.6); }
}

// ---------- 길 찾기 (가구 · 나무 · 벽을 돌아서 걸어감) ----------
const CELL = 0.25;
const GRIDS = new Map();
function gridFor(f) {
  if (GRIDS.has(f)) return GRIDS.get(f);
  const lx = f === 0 ? LOT - 0.4 : HX - 0.4, lz = f === 0 ? LOT - 0.4 : HZ - 0.4;
  const nx = Math.ceil((2 * lx) / CELL) + 1, nz = Math.ceil((2 * lz) / CELL) + 1;
  const blocked = new Uint8Array(nx * nz);
  const pad = R + 0.06;
  for (const c of bld.floors[f].colliders) {
    const x1 = Math.max(0, Math.floor((c.x1 - pad + lx) / CELL)), x2 = Math.min(nx - 1, Math.ceil((c.x2 + pad + lx) / CELL));
    const z1 = Math.max(0, Math.floor((c.z1 - pad + lz) / CELL)), z2 = Math.min(nz - 1, Math.ceil((c.z2 + pad + lz) / CELL));
    for (let i = x1; i <= x2; i++) for (let j = z1; j <= z2; j++) {
      const x = -lx + i * CELL, z = -lz + j * CELL;
      if (c.circle) { if (Math.hypot(x - c.cx, z - c.cz) < c.r + pad) blocked[j * nx + i] = 1; continue; }
      if (x > c.x1 - pad && x < c.x2 + pad && z > c.z1 - pad && z < c.z2 + pad) blocked[j * nx + i] = 1;
    }
  }
  const g = { lx, lz, nx, nz, blocked };
  GRIDS.set(f, g);
  return g;
}
function findPath(f, sx, sz, tx, tz) {
  const g = gridFor(f), { nx, nz, lx, lz, blocked } = g;
  const toI = (x, z) => [Math.max(0, Math.min(nx - 1, Math.round((x + lx) / CELL))), Math.max(0, Math.min(nz - 1, Math.round((z + lz) / CELL)))];
  const free = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && !blocked[j * nx + i];
  // 막힌 칸에서 시작/끝나면 가장 가까운 빈 칸으로
  const nearestFree = ([i, j]) => { if (free(i, j)) return [i, j]; for (let rr = 1; rr < 12; rr++) for (let di = -rr; di <= rr; di++) for (let dj = -rr; dj <= rr; dj++) if (free(i + di, j + dj)) return [i + di, j + dj]; return null; };
  const s = nearestFree(toI(sx, sz)), t = nearestFree(toI(tx, tz));
  if (!s || !t) return null;
  const N = nx * nz, gS = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const h = (i, j) => { const dx = Math.abs(i - t[0]), dz = Math.abs(j - t[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const open = [[h(...s), s[0], s[1]]]; gS[s[1] * nx + s[0]] = 0;
  let found = false, steps = 0;
  while (open.length && steps++ < 40000) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const [, i, j] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    const id = j * nx + i; if (closed[id]) continue; closed[id] = 1;
    if (i === t[0] && j === t[1]) { found = true; break; }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (!free(a, b) || (di && dj && (!free(i + di, j) || !free(i, j + dj)))) continue;
      const nid = b * nx + a, ng = gS[id] + (di && dj ? 1.414 : 1);
      if (ng < gS[nid]) { gS[nid] = ng; came[nid] = id; open.push([ng + h(a, b), a, b]); }
    }
  }
  if (!found) return null;
  const cells = []; for (let id = t[1] * nx + t[0]; id !== -1; id = came[id]) cells.push([id % nx, Math.floor(id / nx)]);
  cells.reverse();
  // 곧게 갈 수 있는 구간은 한 번에 (지그재그 없애기)
  const clear = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2); for (let k = 0; k <= n; k++) { const i = Math.round(a[0] + ((b[0] - a[0]) * k) / n), j = Math.round(a[1] + ((b[1] - a[1]) * k) / n); if (!free(i, j)) return false; } return true; };
  const pts = []; let a = cells[0];
  for (let k = 1; k < cells.length; k++) if (!clear(a, cells[k])) { a = cells[k - 1]; pts.push(a); }
  pts.push(cells[cells.length - 1]);
  const w = pts.map(([i, j]) => [-lx + i * CELL, -lz + j * CELL]);
  w[w.length - 1] = free(...toI(tx, tz)) ? [tx, tz] : w[w.length - 1];
  return w;
}
// 경로를 따라 걷기 시작
function walkTo(tx, tz, extra = {}) {
  const path = findPath(player.floor, player.x, player.z, tx, tz);
  if (!path || !path.length) return false;
  const [x, z] = path.shift();
  moveTarget = { x, z, path, stuck: 0, ...extra };
  const [fx, fz] = path.length ? path[path.length - 1] : [x, z];
  pingMark.position.set(fx, FLOORS[player.floor].y + 0.04, fz);
  pingMark.visible = true; pingMark.scale.setScalar(1.6);
  return true;
}

// ---------- 가구 위에 서기 ----------
// 발밑에 있는 가구 중 발보다 낮은(또는 같은) 가장 높은 윗면 = 서 있을 높이
function groundAt(x, z, feet) {
  let g = 0;
  for (const c of bld.floors[player.floor].colliders) {
    if (c.tall || c.noStand) continue;
    const top = c.top ?? 0.6;
    const e = 0.18; // 가장자리에 걸쳐도 위에 서게 (밀려나며 덜컥거리지 않게)
    if (c.circle) { if (top <= feet + 0.03 && top > g && Math.hypot(x - c.cx, z - c.cz) < c.r + e) g = top; continue; }
    if (top <= feet + 0.03 && top > g && x > c.x1 - e && x < c.x2 + e && z > c.z1 - e && z < c.z2 + e) g = top;
  }
  return g;
}

// ---------- 점프 ----------
function doJump() {
  if (mode !== 'office' || !myAvatar || player.sit || busy()) return;
  if (myAvatar.jump()) { player.jc = (player.jc || 0) + 1; sendState(true); }
}
$('btnJump').addEventListener('pointerdown', (e) => { e.preventDefault(); document.activeElement?.blur?.(); doJump(); });

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
function showFloorHud() {
  $('floorLabel').textContent = FLOORS[player.floor].label;
  const name = ZONES[player.zone].replace(/^\dF /, '');
  $('zoneLabel').textContent = name;
  $('zoneTab').textContent = name;
}
function placeAvatar(av, p) {
  av.root.position.set(p.x, FLOORS[p.floor || 0].y + (av.jy || 0), p.z);
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
let camLift = 0;
function officeCamPose(dt, out) {
  const outside = player.floor === 0 && (Math.abs(player.x) > HX || Math.abs(player.z) > HZ);
  const fy = FLOORS[player.floor].y, top = player.floor === ROOF || outside ? 7 : CEIL - 0.15;
  const bx = player.floor === 0 ? LOT : HX, bz = player.floor === 0 ? LOT : HZ;
  camLift += (((myAvatar && !player.sit) ? myAvatar.ground : 0) - camLift) * 0.1;
  const jumpLift = myAvatar && !player.sit ? Math.max(0, myAvatar.jy - myAvatar.ground) * 0.4 : 0;
  const tx = player.x, ty = fy + 0.85 + camLift + jumpLift, tz = player.z;
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
    if (camShake > 0.001) { // 맞았을 때 화면 흔들림
      camera.position.x += (Math.random() - 0.5) * camShake * 0.5; camera.position.y += (Math.random() - 0.5) * camShake * 0.4;
      camShake *= Math.pow(0.002, dt);
    }
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
setInterval(() => sendState(), 4000); // 화면이 멈춰도(다른 탭) 살아 있다고 알림
let lastSend = 0, lastSent = { x: 0, z: 0, ry: 0 };
function sendState(force = false) {
  if (!net) return;
  const t = performance.now();
  const movedEnough = Math.abs(player.x - lastSent.x) + Math.abs(player.z - lastSent.z) > 0.02 || Math.abs(player.ry - lastSent.ry) > 0.05;
    // 무료 사용량을 아끼려고: 움직일 때 초당 약 3번, 가만히 있을 땐 10초에 한 번 (받는 쪽에서 부드럽게 이어 그림)
  if (!force && !(movedEnough && t - lastSend > 300) && t - lastSend < 10000) return;
  lastSend = t;
  lastSent = { x: player.x, z: player.z, ry: player.ry };
  net.sendState({ id: me.id, name: me.name, color: me.color, g: me.gender, jt: me.jt, dv: me.dev, floor: player.floor, x: +player.x.toFixed(2), z: +player.z.toFixed(2), ry: +player.ry.toFixed(2), sp: +player.speed.toFixed(1), zone: player.zone, st: player.sit ? player.sit.h : 0, bx: game.on ? game.booth.i : -1, pc: game.pc, wk: player.working ? 1 : 0, jc: player.jc || 0, dl: duel.active ? 1 : 0, sc: duel.swings, lv: duel.level, tt: duel.loser ? 1 : 0, hy: myAvatar ? +myAvatar.ground.toFixed(2) : 0 });
}

function onState(p) {
  if (!p?.id || p.id === me.id) return;
  // 같은 기기에서 예전에 열어 둔 내 화면이면(새로 고침 · 탭 다녀오기) 유령으로 보고 지움
  if (p.dv && p.dv === me.dev && (p.jt || 0) < me.jt) { if (peers.has(p.id)) removePeer(p.id, true); return; }
  // 같은 이름: 나중에 들어온 사람이 이름을 바꿔야 함
  if (p.name === me.name && myAvatar && ((p.jt || 0) < me.jt || ((p.jt || 0) === me.jt && p.id < me.id))) askNewName();
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
  // 받은 위치를 시간과 함께 모아 두고, 조금 늦게(0.45초) 그 사이를 부드럽게 이어 그림
  const tnow = performance.now() / 1000;
  if ((p.floor || 0) !== peer.floor || !peer.buf) { peer.x = p.x; peer.z = p.z; peer.ry = p.ry; peer.buf = []; }
  peer.buf.push({ t: tnow, x: p.x, z: p.z, ry: p.ry });
  if (peer.buf.length > 8) peer.buf.shift();
  Object.assign(peer, { tx: p.x, tz: p.z, tr: p.ry, sp: p.sp || 0, zone: p.zone, floor: p.floor || 0 });
  peer.av.setSit(!!p.st, +p.st || 0);
  peer.av.setWorking(!!p.wk && !!p.st);
  const bx = Number.isInteger(p.bx) ? p.bx : -1;
  peer.av.setBoxing(bx >= 0 || !!p.dl);
  peer.av.setSword(!!p.dl);
  if (!p.dl && peer.av.ko) peer.av.knockout(false);
  if (p.dl && (p.sc || 0) > (peer.sc || 0)) peer.av.punch(now);
  peer.sc = p.sc || 0;
  if ((p.lv || 1) !== peer.lv || !!p.tt !== !!peer.tt) { peer.lv = p.lv || 1; peer.tt = !!p.tt; peer.av.setName(lvName(p.name, peer.lv, peer.tt)); }
  if (bx >= 0 && (p.pc || 0) > (peer.pc || 0)) { peer.av.punch(now); if (peer.floor === player.floor) bld.hitBag(bx, 2); }
  peer.pc = p.pc || 0;
  if (peer.jc !== undefined && (p.jc || 0) > peer.jc) peer.av.jump();
  peer.jc = p.jc || 0;
  peer.av.ground = +p.hy || 0;
}
function removePeer(id, quiet = false) {
  const peer = peers.get(id);
  if (!peer) return;
  scene.remove(peer.av.root);
  peer.av.dispose();
  peers.delete(id);
  if (!quiet) sysMessage(`${peer.name}님이 나갔어요.`);
  updateOnline();
}
function updatePeers(dt) {
  for (const p of peers.values()) {
    if (p.tx === undefined) continue;
    let gx = p.tx, gz = p.tz, gr = p.tr;
    const b = p.buf || [];
    if (b.length) {
      const rt = performance.now() / 1000 - 0.45;
      if (rt <= b[0].t) { gx = b[0].x; gz = b[0].z; gr = b[0].ry; }
      else if (rt >= b[b.length - 1].t) {
        // 새 소식이 늦으면 잠깐(최대 0.3초)만 같은 방향으로 이어 가고 멈춤
        const L = b[b.length - 1], P = b[b.length - 2];
        gx = L.x; gz = L.z; gr = L.ry;
        if (P && L.t - P.t > 0.05 && L.t - P.t < 1.2) {
          const e = Math.min(rt - L.t, 0.3);
          gx += ((L.x - P.x) / (L.t - P.t)) * e; gz += ((L.z - P.z) / (L.t - P.t)) * e;
        }
      } else {
        for (let i = 0; i < b.length - 1; i++) if (rt >= b[i].t && rt <= b[i + 1].t) {
          const u = (rt - b[i].t) / Math.max(1e-3, b[i + 1].t - b[i].t);
          gx = b[i].x + (b[i + 1].x - b[i].x) * u; gz = b[i].z + (b[i + 1].z - b[i].z) * u; gr = lerpAngle(b[i].ry, b[i + 1].ry, u);
          break;
        }
      }
    }
    // 너무 멀면(순간이동 · 층 이동) 바로 옮기고, 아니면 살짝 부드럽게
    if (Math.hypot(gx - p.x, gz - p.z) > 4) { p.x = gx; p.z = gz; }
    const k = Math.min(1, dt * 12);
    const ox = p.x, oz = p.z;
    p.x += (gx - p.x) * k; p.z += (gz - p.z) * k;
    p.ry = lerpAngle(p.ry, gr, Math.min(1, dt * 10));
    p.sp = dt > 0 ? Math.hypot(p.x - ox, p.z - oz) / dt : 0;
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
  else if (what === 'host') duel.openPicker();
  else if (what === 'npc') npcTalk();
  else if (what === 'notice') { refreshNotices(); openModal('noticeModal'); }
  else if (what === 'elev') openFloorMenu();
}
$('btnSound').onclick = () => { setMuted(!isMuted()); $('btnSound').innerHTML = isMuted() ? '🔇' : '🔊'; startAudio(); try { localStorage.setItem('work-mute', isMuted() ? '1' : '0'); } catch {} };
try { if (localStorage.getItem('work-mute') === '1') { setMuted(true); $('btnSound').textContent = '🔇'; } } catch {}

// ---------- 엘리베이터 · 층 이동 ----------
let elevAsked = false;
function openFloorMenu() {
  $('floorList').innerHTML = FLOORS.map((f, i) => `<button data-f="${i}" class="${i === player.floor ? 'here' : ''}"><b>${f.label}</b>${f.name}</button>`).join('');
  $('floorList').querySelectorAll('button').forEach((b) => (b.onclick = () => chooseFloor(+b.dataset.f)));
  openModal('floorModal');
}
function goFloor(f) {
  closeModals();
  clearTarget();
  if (player.sit) standUp();
  if (game.on) quitGame();
  if (mode === 'exterior') { player.floor = f; arrive(); startFly('office', 2.6); $('btnView').innerHTML = VIEW_OUT; return; }
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
// 층을 고르면: 엘리베이터 앞이면 바로, 멀면 엘리베이터까지 걸어가서 탐
function chooseFloor(f) {
  closeModals();
  if (mode !== 'office' || Math.hypot(player.x - ELEV.x, player.z - ELEV.z) < 2.2) { goFloor(f); return; }
  if (f === player.floor) return;
  if (player.sit) standUp();
  if (game.on) quitGame();
  elevAsked = true;
  // 가구 · 나무를 돌아 엘리베이터까지 걸어감 (길이 없으면 바로 이동)
  if (!walkTo(ELEV.x + 0.4, ELEV.z + 0.2, { until: now + 25, then: () => goFloor(f) })) { goFloor(f); return; }
  sysMessage(`🛗 ${FLOORS[f].label} ${FLOORS[f].name}(으)로 가요. 엘리베이터까지 걸어가는 중…`);
}
function arrive() {
  elevAsked = true; // 도착하자마자 다시 팝업이 뜨지 않게
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
// 왼쪽 접속자 목록: 연두색 불 + 이름 + 층 (1초마다, 바뀐 것만 다시 그림)
let onlineHtml = '';
function renderOnline() {
  const box = $('online');
  const hide = mode !== 'office' && mode !== 'exterior' || game.on || duel.active;
  box.hidden = hide;
  if (hide) return;
  const tb = document.querySelector('.topbar').getBoundingClientRect();
  box.style.top = `${Math.round(tb.bottom + 6)}px`;
  const fl = (f) => FLOORS[f]?.label || '';
  const rows = [{ name: me.name, floor: player.floor, me: true }, ...[...peers.values()].sort((a, b) => (a.floor - b.floor) || String(a.name).localeCompare(b.name, 'ko'))];
  const html = rows.map((p) => `<li${p.me ? ' class="me"' : ''}><i></i><span>${esc(p.name)}${p.me ? ' (나)' : ''}</span><small>${fl(p.floor)}</small></li>`).join('');
  $('onlineNum').textContent = rows.length;
  if (html !== onlineHtml) { onlineHtml = html; $('onlineList').innerHTML = html; }
}
setInterval(renderOnline, 1000);
$('onlineHead').onclick = () => { const f = $('online').classList.toggle('fold'); $('onlineFold').textContent = f ? '▸' : '▾'; try { localStorage.setItem('work-online-fold', f ? '1' : '0'); } catch {} };
try { if (localStorage.getItem('work-online-fold') === '1') { $('online').classList.add('fold'); $('onlineFold').textContent = '▸'; } } catch {}
$('btnPeople').onclick = () => {
  const rows = [{ name: me.name + ' (나)', color: me.color, zone: player.zone, lv: duel.level, me: true }, ...[...peers.entries()].map(([id, p]) => ({ ...p, id }))];
  $('peopleList').innerHTML = rows.map((p) => `<li><i style="background:${/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#888'}"></i>${esc(lvName(p.name, p.lv || 1, p.me ? duel.loser : p.tt))}<small>${esc(ZONES[p.zone] || '')}</small></li>`).join('');
  openModal('peopleModal');
};
$('btnView').onclick = () => {
  if (mode === 'office') { orbit.radius = 80; orbit.elev = 0.2; orbit.angle = Math.atan2(camera.position.x, camera.position.z); bld.setFloor(player.floor, true); startFly('exterior', 2.2); $('btnView').innerHTML = VIEW_IN; $('zoneLabel').textContent = '건물 밖에서 보기'; }
  else if (mode === 'exterior') { startFly('office', 2.2); $('btnView').innerHTML = VIEW_OUT; showFloorHud(); }
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
  $('btnJump').hidden = true;
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
  camShake = Math.max(camShake, 0.05 + game.combo * 0.03); // 칠 때마다 화면이 살짝 툭
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
  $('btnJump').hidden = !isTouch;
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
  renderer.setClearColor(BG.setRGB(0.008, 0.012, 0.035).lerp(FOG_DAY, d));
  sun.intensity = 2.6 * d;
  // 밤에도 은은하게: 아주 밝은 것(줄 전구 · 간판 LED)만 살짝 번지게
  bloom.strength = 0.3 - 0.18 * d;
  bloom.threshold = 1.1 + 0.1 * d;
  bloom.radius = 0.3;
  renderer.toneMappingExposure = 1.0 - 0.1 * d;
  bld.setDay(d);
  garden.setDay(d);
  traffic.setDay(d);
}
function setDayButtons() {
  const label = dayTarget > 0.5 ? '🌙 밤' : '☀️ 낮';
  $('btnDay').innerHTML = dayTarget > 0.5 ? '<i>🌙</i><span>밤</span>' : '<i>☀️</i><span>낮</span>'; void label;
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
let now = 0, idleTime = 10, fpsN = 0, fpsT = 0, slowRuns = 0, prDrops = 0;
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
  traffic.update(dt);
  if (game.on) updateGame(dt);
  duel.update(dt);
  updateSparks(dt);
  duelHost.root.visible = !(mode === 'office' && player.floor !== ARENA.floor); duelHost.animate(dt, 0, now);
  if (duelBot.root.visible) duelBot.animate(dt, 0, now);
  if (pingMark.visible) { pingMark.scale.setScalar(Math.max(1, pingMark.scale.x - dt * 3)); pingMark.rotation.z += dt * 2; }
  if (myAvatar && (mode === 'office' || mode === 'fly' || mode === 'exterior')) {
    if (mode === 'office') updatePlayer(dt); else myAvatar.animate(dt, 0, now);
    sendState();
  }
  updatePeers(dt);
  updateNpc(dt);
  updateCamera(dt);
  if (!$('intro').hidden && pv.av) { pv.av.root.rotation.y += dt * 0.6; pv.av.animate(dt, 0, now); pv.renderer.render(pv.scene, pv.cam); }
  sky.position.copy(camera.position);
  labelCam.copy(camera); labelCam.layers.set(1);
  composer.render();
  // 버벅임 자동 조절: 2초마다 초당 화면 수를 보고 해상도를 조금씩 올리고 내림
  // (해상도를 바꾸는 순간 화면이 한 번 멈칫하므로: 3초씩 두 번 연속 느릴 때만, 낮추기만, 최대 두 번)
  fpsN++; fpsT += dt;
  if (fpsT > 3) {
    const fps = fpsN / fpsT; fpsN = 0; fpsT = 0;
    slowRuns = fps < 26 ? slowRuns + 1 : 0;
    if (slowRuns >= 2 && prDrops < 2 && prNow > 1 && !document.hidden) {
      slowRuns = 0; prDrops++;
      prNow = Math.max(1, prNow - 0.35); renderer.setPixelRatio(prNow); composer.setPixelRatio(prNow); resize();
    }
  }
  requestAnimationFrame(frame);
}
if (returning) $('intro').hidden = true; // 바로 출근하므로 시작 화면은 건너뜀
requestAnimationFrame(() => {
  frame();
  if (returning) setTimeout(enter, 600);
  setTimeout(() => $('loading').classList.add('done'), 300);
});

// 테스트용 훅
window.__work = { duel, findPath, get mode() { return mode; }, get av() { return myAvatar; }, toggleDay, game, bld, collide, get day() { return dayVal; }, player, cam, orbit, peers, enter, keys, goFloor, chooseFloor };
window.__workMain = true;
