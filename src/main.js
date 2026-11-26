import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG, AVATAR_COLORS } from './config.js';
import { sharedUniforms, createSky, createMountains, createGround, createCity, createBridges, createSite, createTraffic, FOG_NIGHT, FOG_DAY } from './world.js';
import { createBuilding, FLOORS, ZONES, zoneAt, HX, HZ, LOT, CEIL, ROOF, ELEV, NOTICE, SPAWN, BOOTHS, ARENA, INVEST } from './building.js';
import { createGarden, STREAM } from './garden.js';
import { createDuel, SWORD, BOT_NAME } from './duel.js';
import { createRequests } from './requests.js';
import { createMoney } from './money.js';
import { unseenNews, markNewsSeen } from './news.js';
import { XMAS, createPlazaTree, createSleigh, SLEIGH } from './xmas.js';
import { createShop, createShopUI, SHOP, ITEMS } from './shop.js';
import { createSnowField, createSnowFight } from './snow.js';
import { createXmas } from './advent.js';
import { createRace, createRaceTrack, RACE, inRaceZone } from './race.js';
import { createPartyStage, inParty, DANCES } from './party.js';
import { startAudio, setMuted, isMuted, playThump, playBeep } from './audio.js';
import { Avatar, WorkMonster, HAIR_STYLES, HAIR_COLORS, OUTFITS, BOTTOMS, BOTTOM_COLORS, ACC_SLOTS, parseLook, lookKey } from './avatar.js';
import { connect, makeId, supa } from './net.js';
import { listNotices, addNotice, drawNoticeBoard } from './notices.js';
const WORK_BONUS = false; // 💼 시급 2배 이벤트 (11-25 시작 → 11-26 사용자 요청으로 종료: '사람들이 즐기질 못해서')

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
// 🎄 크리스마스: 광장 트리 · 내리는 눈 · 루돌프 썰매
const snow = null; // 눈 내리기는 느려질 수 있어서 끔 (xmas.js의 createSnow)
const SLEIGH_ON = false; // 🛷 루돌프 썰매 타기 — 11-25 사용자 요청으로 종료(기능이 너무 많아짐). 다시 열려면 true
const sleigh = XMAS && SLEIGH_ON ? createSleigh() : null;
if (XMAS) scene.add(createPlazaTree(garden));
if (sleigh) {
  scene.add(sleigh.root);
  sleigh.root.position.set(SLEIGH.x, 0, SLEIGH.z);
  bld.floors[0].colliders.push({ x1: SLEIGH.x - 1.55, z1: SLEIGH.z - 0.68, x2: SLEIGH.x + 4.0, z2: SLEIGH.z + 0.68, tall: false, top: 1, noStand: true });
}
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

const me = { id: makeId(), name: '', color: AVATAR_COLORS[0], gender: 'm', look: '', acc: [], jt: 0, dev: '' };
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
  cash: () => money.cash(), stake: (id, n, opp) => money.stake(id, n, opp), duelReport: (id, r, bet) => money.duelReport(id, r, bet),
  walletKey: (name) => money.keyFor(name), // 🛡 결투 기록도 지갑 주인 키로 저장(security.sql duel_stats_save)
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
const busy = () => game.on || duel.fighting || ride.mine || race?.driving;
// 📋 업무 요청
const reqs = createRequests({
  $, me, esc: (t) => esc(t), openModal: (id) => openModal(id), sys: (t) => sysMessage(t), toast: (t) => toast(t),
  send: (e) => net?.sendEvent(e), onlineNames: () => [...peers.values()].map((p) => p.name),
});
$('btnReq').onclick = () => { if (mode === 'office' || mode === 'exterior') reqs.open('in'); };
let toastTimer = 0;
// 알림은 차례대로 하나씩 (겹치면 앞의 것이 끝난 뒤에)
const toastQ = [];
function toast(text, onClick = () => reqs.open('in')) {
  sysMessage(text);
  if (!$('toast').hidden) { toastQ.push([text, onClick]); return; }
  showToast(text, onClick);
}
function showToast(text, onClick) {
  const el = $('toast'); el.textContent = text; el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  const next = () => { el.hidden = true; const n = toastQ.shift(); if (n) setTimeout(() => showToast(...n), 250); };
  el.onclick = () => { clearTimeout(toastTimer); next(); onClick?.(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(next, toastQ.length ? 4500 : 7000);
  playBeep(740, 0.12);
}
// 💰 월급 · 지갑 · 💹 투자
const money = createMoney({ $, me, priceOf: (id) => ITEMS.find((it) => it.id === id && !it.limited)?.price, canGrant: (id) => !!advent?.earned(id), openItems: () => shopUI.open('mine'), openModal: (id) => openModal(id), sys: (t) => sysMessage(t), toast: (t) => toast(t, () => money.openWallet()),
  atWork: () => !!myAvatar && (mode === 'office' || mode === 'exterior'), rate: () => (WORK_BONUS && player.sit && player.working ? 2 : 1) /* 💼 시급 2배 이벤트(일하기 중) — 11-26 종료, 다시 하려면 WORK_BONUS = true */, get board() { return bld.investBoard; } });
$('workChip').onclick = () => money.openWallet();
// 👜 WORK BOUTIQUE (1층 정원 동쪽): 아이템 사서 착용
const shop = createShop(bld.floors[0].colliders);
scene.add(shop.group);
// ⛄ 눈싸움장 (사옥 뒤쪽 정원)
const snowField = createSnowField(bld.floors[0].colliders);
scene.add(snowField.group);
const snowFight = createSnowFight({
  scene, field: snowField, me, peers, $, isTouch,
  player: () => player, avatar: () => myAvatar, now: () => now, camYaw: () => cam.yaw,
  active: () => !!myAvatar && mode === 'office', busy: () => busy() || player.sit,
  send: (e) => net?.sendEvent(e), sendNow: () => sendState(true), earn: (n) => money.reward('snow', n),
  toast: (t) => toast(t, null), sys: (t) => sysMessage(t),
  thump: () => playThump(0.5), whoosh: () => playBeep(520, 0.05), ding: () => playBeep(1180, 0.1),
});
// 🏁 킥보드 레이스 (회사 밖 도로 한 바퀴)
const raceTrack = createRaceTrack(bld.floors[0].colliders);
scene.add(raceTrack.group);
const race = createRace({
  $, me, peers, isTouch, cam, player: () => player, send: (e) => net?.sendEvent(e), earn: (n) => money.reward('race', n),
  sys: (t) => sysMessage(t), toast: (t) => toast(t, null), beep: (f, d) => playBeep(f, d), ding: () => { playBeep(988, 0.12); setTimeout(() => playBeep(1319, 0.2), 130); },
  ownKick: () => me.kick || (money.ready ? money.items().find((id) => KICK_IDS.includes(id)) : null),
  toFloor0: () => { player.floor = 0; bld.setFloor(0, false); },
  changed: () => { clearTarget(); sendState(true); },
});
// 🪩 옥상 파티 무대: 무대 위에서 💃 버튼(G 키) → 누를 때마다 다른 춤, 움직이면 멈춤
const partyStage = createPartyStage(bld.floors[4]);
let danceNext = 1;
function danceTap() {
  if (!myAvatar || !inParty(player.floor, player.x, player.z) || busy() || player.sit) return;
  const id = danceNext; danceNext = (danceNext % (DANCES.length - 1)) + 1;
  myAvatar.setDance(id); clearTarget(); sendState(true); danceUI();
  toast(`${DANCES[id]}! (다시 누르면 다른 춤 · 움직이면 멈춰요)`, null);
}
function danceUI() {
  const on = !!myAvatar && inParty(player.floor, player.x, player.z) && !race.driving;
  $('btnDance').hidden = !on;
  $('btnDance').classList.toggle('on', !!myAvatar?.danceId);
  $('btnDance').querySelector('span').textContent = myAvatar?.danceId ? '다른 춤' : '춤추기';
}
$('btnDance').addEventListener('pointerdown', (e) => { e.preventDefault(); document.activeElement?.blur?.(); danceTap(); });
$('btnKick').addEventListener('pointerdown', (e) => { e.preventDefault(); document.activeElement?.blur?.(); toggleKick(); });
$('btnSnow').addEventListener('pointerdown', (e) => { e.preventDefault(); document.activeElement?.blur?.(); snowFight.throw(); });
const atShop = () => mode === 'office' && player.floor === 0 && shop.inside(player.x, player.z);
const shopUI = createShopUI({ $, money, openModal: (id) => openModal(id), sys: (t) => sysMessage(t), beep: () => playBeep(880, 0.15), atShop, changed: () => applyWear(), openXmas: () => advent.open() });
// 🎄 크리스마스 출석 (들어올 때 하루 한 번 도장 → 한정판 선물)
const advent = createXmas({ $, money, me, openModal: (id) => openModal(id), sys: (t) => sysMessage(t), beep: () => { playBeep(988, 0.12); setTimeout(() => playBeep(1319, 0.18), 130); }, changed: () => applyWear() });
function adventCheckIn() { if (!$('newsModal').hidden) { setTimeout(adventCheckIn, 500); return; } advent.checkIn().then((s) => { if (s) advent.open(); }); }
function applyWear() {
  const w = money.wear();
  me.acc = Object.entries(w).filter(([k, v]) => k !== 'ride' && v).map(([, v]) => v); me.kick = w.ride || null; // 🛴 탈것은 몸에 붙이지 않고 발밑에
  myAvatar?.setAcc(me.acc); pv.av?.setAcc(me.acc); kickUI(); sendState(true);
}
// 🛴 킥보드: '착용'이 곧 타기. 앉기 · 결투 · 게임 · 썰매 중에는 잠깐 숨겼다가 끝나면 다시 탐 (그때는 저장 안 함)
const KICK_IDS = ['kickblack', 'kickmint', 'kickgold'];
let lastKick = null;
function kickUI() {
  const own = money.ready && money.items().some((id) => KICK_IDS.includes(id));
  $('btnKick').hidden = !own;
  $('btnKick').classList.toggle('on', !!me.kick);
  $('btnKick').querySelector('span').textContent = me.kick ? '내리기' : '타기';
}
function toggleKick() {
  if (!money.ready) return;
  const owned = money.items().filter((id) => KICK_IDS.includes(id));
  if (!owned.length) { toast('🛴 1층 WORK BOUTIQUE에서 킥보드를 사면 탈 수 있어요!', null); return; }
  if (me.kick) { lastKick = me.kick; money.setWear('ride', null); }
  else money.setWear('ride', owned.includes(lastKick) ? lastKick : owned[owned.length - 1]);
  applyWear(); playBeep(me.kick ? 990 : 660, 0.08);
}
let clerkGreetAt = -99;
// 3층 투자 상담원 (NPC)
const advisor = new Avatar('💹 투자 상담원', '#2d3b55', 'f', '21100');
advisor.root.position.set(INVEST.x, FLOORS[INVEST.floor].y, INVEST.z);
advisor.root.rotation.y = (INVEST.s ?? 1) * Math.PI / 2; // 손님 쪽을 바라봄
advisor.setSit(true, 0.42); // 의자에 앉아 상담
scene.add(advisor.root);
bld.floors[INVEST.floor].colliders.push({ x1: INVEST.x - 0.3, z1: INVEST.z - 0.3, x2: INVEST.x + 0.3, z2: INVEST.z + 0.3, tall: false, top: 1.3 });
const ADVISOR_LINES = ['어서 오세요! 💹 투자 상담실이에요. 주식이나 적금 상담해 드릴게요.', '주식은 1시간마다 가격이 바뀌어요. 오르면 빨강, 내리면 파랑!', '안전하게 모으고 싶으면 적금도 좋아요. 하루 0.1%씩 이자가 붙어요.', '일급은 일하는 대로 바로 지갑에 들어와요 💸'];
let advLine = 0, advGreetAt = -99;
function updateAdvisor(dt) {
  advisor.root.visible = !(mode === 'office' && player.floor !== INVEST.floor);
  advisor.animate(dt, 0, now);
  if (mode === 'office' && player.floor === INVEST.floor && Math.hypot(player.x - (INVEST.x + (INVEST.s ?? 1) * 1.7), player.z - INVEST.z) < 2.6 && now - advGreetAt > 60) { advGreetAt = now; advisor.say(ADVISOR_LINES[advLine++ % ADVISOR_LINES.length], now); }
}
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
  if (saved?.look) me.look = String(saved.look).slice(0, 8);
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
  b.onclick = () => {
    if (me.gender !== b.dataset.g) { const L = parseLook(me.look, me.gender); me.gender = b.dataset.g; const D = parseLook('', me.gender); L.hs = D.hs; L.bt = D.bt; me.look = lookKey(L); } // 성별을 바꾸면 머리·하의는 기본으로
    syncLookUI(); updatePreview();
  };
});
// 👗 꾸미기 (옷 종류 · 하의 · 머리 모양 · 머리 색)
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function setLookPart(k, v) { const L = parseLook(me.look, me.gender); L[k] = v; me.look = lookKey(L); syncLookUI(); updatePreview(); }
function chipRow(id, names, k) { $(id).innerHTML = names.map((n, i) => `<button type="button" data-v="${i}">${n}</button>`).join(''); $(id).querySelectorAll('button').forEach((b) => (b.onclick = () => setLookPart(k, +b.dataset.v))); }
function swatchRow(id, cols, k, titles) { $(id).innerHTML = cols.map((c, i) => `<button type="button" data-v="${i}" title="${titles?.[i] || ''}" ${c == null ? 'class="auto"' : `style="background:${hex(c)}"`}></button>`).join(''); $(id).querySelectorAll('button').forEach((b) => (b.onclick = () => setLookPart(k, +b.dataset.v))); }
chipRow('outfitPick', OUTFITS, 'ot'); chipRow('bottomPick', BOTTOMS, 'bt'); chipRow('hairPick', HAIR_STYLES, 'hs');
swatchRow('bottomColorPick', BOTTOM_COLORS, 'bc', ['상의에 맞춰 자동']); swatchRow('hairColorPick', HAIR_COLORS, 'hc');
function syncLookUI() {
  const L = parseLook(me.look, me.gender);
  document.querySelectorAll('#genderPick button').forEach((x) => x.classList.toggle('on', x.dataset.g === me.gender));
  for (const [id, k] of [['outfitPick', 'ot'], ['bottomPick', 'bt'], ['hairPick', 'hs'], ['bottomColorPick', 'bc'], ['hairColorPick', 'hc']]) $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === L[k]));
}
document.querySelectorAll('#lookTabs button').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('#lookTabs button').forEach((x) => x.classList.toggle('on', x === b));
  $('lookTop').hidden = b.dataset.t !== 'top'; $('lookHair').hidden = b.dataset.t !== 'hair'; $('lookItems').hidden = b.dataset.t !== 'items';
  if (b.dataset.t === 'items') renderItemPick();
}));
// 🎒 내 아이템: 캐릭터 창에서 바로 착용 · 벗기 (같은 부위는 하나만, 저장 버튼 없이 바로 적용)
function renderItemPick() {
  const owned = money.ready ? money.items() : [], wear = money.ready ? money.wear() : {};
  const list = ITEMS.filter((it) => owned.includes(it.id));
  $('itemPick').innerHTML = list.length ? list.map((it) => `<button type="button" data-acc="${it.id}" class="${wear[it.slot] === it.id ? 'on' : ''} ${it.limited ? 'xm' : ''}"><i>${it.icon}</i>${it.name}<small>${ACC_SLOTS[it.slot]}</small></button>`).join('')
    : '<p>아직 아이템이 없어요. 1층 <b>WORK BOUTIQUE</b>에서 사거나 <b>🎄 출석 선물</b>로 받을 수 있어요.</p>';
  $('itemPick').querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => {
    const it = ITEMS.find((x) => x.id === b.dataset.acc);
    money.setWear(it.slot, money.wear()[it.slot] === it.id ? null : it.id); applyWear(); renderItemPick();
  }));
}
syncLookUI();

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
  if (pv.av) { pv.av.setLook(me.color, me.gender, me.look); return; }
  pv.av = new Avatar('', me.color, me.gender, me.look);
  pv.av.label.visible = false; pv.av.setAcc(me.acc || []);
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
  before = { name: me.name, color: me.color, gender: me.gender, look: me.look };
  $('nameInput').value = me.name;
  $('enterBtn').textContent = '저장하기';
  $('introCancel').hidden = false;
  $('lookItemsTab').hidden = !money.ready; pv.av?.setAcc(me.acc || []);
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
  try { localStorage.setItem('work-tower-me', JSON.stringify({ name: me.name, color: me.color, gender: me.gender, look: me.look })); } catch {}
  myAvatar.setLook(me.color, me.gender, me.look);
  if (renamed) myAvatar.setName(lvName(me.name, duel.level, duel.loser));
  if (renamed) duel.load(me.name);
  if (renamed) { money.save(); money.load(me.name).then(() => { applyWear(); advent.checkIn(); }); }
  if (renamed) reqs.refresh();
  closeProfile();
  sysMessage('캐릭터를 바꿨어요.');
  sendState(true);
}
$('btnMe').onclick = () => { if (mode === 'office' || mode === 'exterior') openProfile(); };
$('introCancel').onclick = () => {
  // 바꾸지 않고 닫으면 고르던 것을 원래대로
  Object.assign(me, before);
  colorPick.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.title === me.color));
  syncLookUI();
  updatePreview();
  closeProfile();
};

// 소리는 화면을 처음 누를 때 켜짐 (브라우저 규칙)
['pointerdown', 'keydown', 'touchend'].forEach((t) => addEventListener(t, () => { if (myAvatar) startAudio(); }, { capture: true, passive: true }));

function enter() {
  me.name = ($('nameInput').value.trim() || '게스트' + Math.floor(Math.random() * 900 + 100)).slice(0, 16);
  try { localStorage.setItem('work-tower-me', JSON.stringify({ name: me.name, color: me.color, gender: me.gender, look: me.look })); } catch {}
  $('intro').hidden = true;
  camera.clearViewOffset(); camera.updateProjectionMatrix();
  $('hud').hidden = false;
  $('joy').hidden = !isTouch;
  $('btnJump').hidden = !isTouch;
  if (isTouch) setChatOpen(false);
  startAudio();
  myAvatar = new Avatar(me.name, me.color, me.gender, me.look);
  if (duel.level > 1 || duel.loser) myAvatar.setName(lvName(me.name, duel.level, duel.loser));
  duel.load(me.name); // 결투 레벨 · 칭호 (Supabase)
  money.load(me.name).then((notes) => { applyWear(); // 입구에 도착하면(날아 들어오는 장면이 끝나면) 오늘의 일급 알림
    const t = setInterval(() => { if (mode !== 'office') return; clearInterval(t); showNews(); setTimeout(() => { notes.forEach((n) => toast(n, () => money.openWallet())); toast(money.greeting(), () => money.openWallet()); }, 300); setTimeout(adventCheckIn, 900); }, 200);
  });
  reqs.refresh().then(() => { if (reqs.pending) toast(`📋 아직 끝나지 않은 업무 요청이 ${reqs.pending}개 있어요. (위쪽 📋 업무)`); });
  scene.add(myAvatar.root);
  placeAvatar(myAvatar, player);
  me.jt = Date.now();
  net = connect(me, {
    onState, onChat: receiveChat, onLeave: removePeer, onSync: (scope) => { sendState(true, scope === 'all'); race.announce(); } /* 새로 온 사람에게 내 레이스 참가도 알림 */, onEvent: (e) => { duel.onEvent(e); reqs.onEvent(e); rideEvent(e); snowFight.onEvent(e); race.onEvent(e); },
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
  // 대결·샌드백 중에는 채팅 칸에 커서가 남아 있어도 스페이스바 등으로 바로 공격 (채팅 칸에서 빠져나옴)
  if ((duel.fighting || game.on) && document.activeElement?.id === 'chatInput') document.activeElement.blur();
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
  if (floorOpen()) { floorKey(e); return; }
  keys.add(e.code);
  if (e.code === 'Enter') { e.preventDefault(); setChatOpen(true); $('chatInput').focus(); }
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyF' && snowFight.inField) { e.preventDefault(); if (!e.repeat) snowFight.throw(); }
  if (e.code === 'KeyR' && !e.repeat && myAvatar) toggleKick();
  if (e.code === 'KeyG' && !e.repeat) danceTap();
  if (e.code === 'Space') { e.preventDefault(); doJump(); }
  if (e.code === 'Escape') closeModals();
});
addEventListener('keyup', (e) => { keys.delete(e.code); heldAtOpen.delete(e.code); });
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
  return clampFloor(player.floor, x, z);
}

// 걸어 다닐 수 있는 범위: 층 안 / 1층은 부지 + 정문 앞 광장(🏁 레이스 참가 칸, RACE.plaza)
function clampFloor(f, x, z) {
  const lx = f === 0 ? LOT - 0.4 : HX - 0.5, lz = f === 0 ? LOT - 0.4 : HZ - 0.5, zs = f === 0 ? RACE.plaza.z1 : lz;
  x = Math.max(-lx, Math.min(lx, x)); z = Math.max(-lz, Math.min(zs, z));
  if (f === 0 && z > lz) x = Math.max(RACE.plaza.x0, Math.min(RACE.plaza.x1, x));
  return [x, z];
}
let moveYaw = null; // 걷는 동안 기준이 되는 방향
function updatePlayer(dt) {
  let f = 0, s = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
  f -= joy.y; s += joy.x;
  if (floorOpen()) { f = 0; s = 0; } // 층 선택 창이 열려 있으면 멈춤 (방향키는 층 고르기에 씀)
  if ((Math.abs(f) > 0.05 || Math.abs(s) > 0.05) && moveTarget) clearTarget();
  const mag = Math.min(Math.hypot(f, s), 1);
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joy.x, joy.y) > 0.95;
  let moved = 0;
  if (race.driving) moved = race.drive(dt, f, s); // 🏁 레이스 중엔 킥보드를 직접 몬다
  if (busy()) { f = 0; s = 0; }
  if (player.sit && mag > 0.05 && !busy()) standUp();
  if (mag <= 0.05) moveYaw = null;
  if (!player.sit && !busy() && mag > 0.05) {
    // 걷기 시작할 때의 시점 방향을 기준으로 고정: 걷는 중에 화면을 돌려도 가던 방향 그대로, 시점만 돌아감
    if (moveYaw === null) moveYaw = cam.yaw;
    const fx = -Math.sin(moveYaw), fz = -Math.cos(moveYaw);
    const rx = Math.cos(moveYaw), rz = -Math.sin(moveYaw);
    let mx = fx * f + rx * s, mz = fz * f + rz * s;
    const l = Math.hypot(mx, mz) || 1;
    mx /= l; mz /= l;
    const speed = (myAvatar.kick ? (run ? 9 : 6.6) : run ? 6.2 : 3.4) * mag; // 🛴 킥보드는 두 배쯤
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
      const step = Math.min(d, (myAvatar.kick ? 6.6 : 3.4) * dt);
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
  if (myAvatar.danceId && (moved > 0.02 || player.sit || busy() || !inParty(player.floor, player.x, player.z))) { myAvatar.setDance(0); sendState(true); }
  { const was = $('btnDance').hidden; danceUI(); if (was && !$('btnDance').hidden) sysMessage('🪩 옥상 파티 무대예요! 💃 춤추기 버튼(컴퓨터는 G 키)을 누르면 춤춰요. 누를 때마다 다른 춤!'); }
  { const k = race.driving ? race.kick : me.kick && !player.sit && !busy() && !myAvatar.danceId ? me.kick : null; if (k !== (myAvatar.kickId || null)) { myAvatar.setKick(k); sendState(true); } }
  { const g = player.sit ? 0 : groundAt(player.x, player.z, myAvatar.jy); if (Math.abs(g - myAvatar.ground) > 0.05 && performance.now() - lastSend > 300) { myAvatar.ground = g; sendState(true); } else myAvatar.ground = g; }
  if (race.driving) myAvatar.ground = -0.3; // 회사 밖 도로 높이
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
  else if (what === 'elev' && !elevAsked && !elevMoving && !moveTarget?.then && !busy() && !player.sit && document.querySelectorAll('.modal:not([hidden])').length === 0) { elevAsked = true; openFloorMenu(); }
  if (ride.mine || what === 'sleigh') { pr.textContent = rideText(); pr.hidden = false; }
  else if (busy()) pr.hidden = true;
  else if (what && what.booth) { pr.textContent = isTouch ? `🥊 ${what.booth.i + 1}번 샌드백 치기 (누르기)` : `E  🥊 ${what.booth.i + 1}번 샌드백 치기`; pr.hidden = false; }
  else if (player.sit && player.working) { pr.textContent = isTouch ? '일 그만하기 (누르기)' : '일 그만하기: E 또는 이동 키'; pr.hidden = false; }
  else if (player.sit) { pr.textContent = isTouch ? '일어나기 (누르기)' : '이동 키를 누르면 일어나요'; pr.hidden = false; }
  else if (what && what.seat && what.seat.desk) { pr.textContent = isTouch ? '💻 일하기 (누르기)' : 'E  💻 일하기'; pr.hidden = false; }
  else if (what && what.seat) { pr.textContent = isTouch ? '앉기 (누르기)' : 'E  앉기'; pr.hidden = false; }
  else if (what === 'host') { pr.textContent = isTouch ? `⚔️ 정식 결투 신청 (누르기)` : `E  ⚔️ 정식 결투 신청`; pr.hidden = false; }
  else if (what === 'shop') { pr.textContent = isTouch ? '👜 부티크 쇼핑하기 (누르기)' : 'E  👜 부티크 쇼핑하기'; pr.hidden = false; }
  else if (what === 'invest') { pr.textContent = isTouch ? '💹 투자 상담 받기 (누르기)' : 'E  💹 투자 상담 받기'; pr.hidden = false; }
  else if (what === 'npc') { pr.textContent = isTouch ? '💬 비서에게 말 걸기 (누르기)' : 'E  💬 비서에게 말 걸기'; pr.hidden = false; }
  else if (what === 'notice') { pr.textContent = isTouch ? '공지판 보기 (누르기)' : 'E  공지판 보기'; pr.hidden = false; }
  else if (what === 'elev') { pr.textContent = isTouch ? '엘리베이터 타기 (누르기)' : 'E  엘리베이터 타기'; pr.hidden = false; }
  else if (what === 'race') { pr.textContent = race.lobbyText; pr.hidden = false; }
  else if (snowFight.inField) { pr.textContent = isTouch ? '❄ 버튼: 캐릭터가 보는 쪽으로 눈 던지기' : 'F  ❄ 눈 던지기 (캐릭터가 보는 쪽으로)'; pr.hidden = false; }
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
  if (player.floor === INVEST.floor && Math.hypot(player.x - (INVEST.x + (INVEST.s ?? 1) * 1.55), player.z - INVEST.z) < 1.0) return 'invest';
  if (player.floor === 0 && Math.hypot(player.x - SHOP.counter.x, player.z - SHOP.counter.z) < 1.2) return 'shop';
  if (sleigh && player.floor === 0 && !ride.flying && Math.hypot(player.x - (SLEIGH.x - 0.3), player.z - SLEIGH.z) < 2.0) return 'sleigh';
  if (!race.driving && inRaceZone(player.floor, player.x, player.z)) return 'race';
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
  const [x, z] = clampFloor(player.floor, hit.x, hit.z);
  if (Math.hypot(x - player.x, z - player.z) > 40) return;
  if (player.sit) standUp();
  if (!walkTo(x, z)) { moveTarget = { x, z, stuck: 0 }; pingMark.position.set(x, fy + 0.04, z); pingMark.visible = true; pingMark.scale.setScalar(1.6); }
}

// ---------- 길 찾기 (가구 · 나무 · 벽을 돌아서 걸어감) ----------
const CELL = 0.25;
const GRIDS = new Map();
function gridFor(f) {
  if (GRIDS.has(f)) return GRIDS.get(f);
  const lx = f === 0 ? LOT - 0.4 : HX - 0.4, lz = f === 0 ? LOT - 0.4 : HZ - 0.4, zs = f === 0 ? RACE.plaza.z1 : lz;
  const nx = Math.ceil((2 * lx) / CELL) + 1, nz = Math.ceil((lz + zs) / CELL) + 1;
  const blocked = new Uint8Array(nx * nz);
  if (f === 0) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = -lx + i * CELL, z = -lz + j * CELL; if (z > lz && (x < RACE.plaza.x0 || x > RACE.plaza.x1)) blocked[j * nx + i] = 1; } // 광장 밖
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
  let g = player.floor === 0 && z > LOT + 0.05 ? -0.3 : 0; // 정문 앞 광장은 부지보다 30cm 낮음
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
  if (player.working) sysMessage(WORK_BONUS ? '💻 일하는 중이에요. 지금 시급 2배(20,640원)! 다른 사람 화면에 "일하는 중..." 풍선이 보여요.' : '💻 일하는 중이에요. 다른 사람 화면에 "일하는 중..." 풍선이 보여요.');
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
  const bx = race.driving ? 400 : player.floor === 0 ? LOT : HX, bz = race.driving ? 400 : player.floor === 0 ? (player.z > LOT - 3 ? RACE.plaza.z1 + 6 : LOT) : HZ;
  camLift += (((myAvatar && !player.sit) ? myAvatar.ground : 0) - camLift) * 0.1;
  const jumpLift = myAvatar && !player.sit ? Math.max(0, myAvatar.jy - myAvatar.ground) * 0.4 : 0;
  const tx = player.x, ty = fy + 0.85 + camLift + jumpLift, tz = player.z;
  const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  let allowed = cam.dist;
  for (let t = 0.3; t <= cam.dist; t += 0.12) {
    const x = tx + dir.x * t, y = ty + dir.y * t, z = tz + dir.z * t;
    const inBld = Math.abs(x) < HX && Math.abs(z) < HZ;
    if (Math.abs(x) > bx - 0.15 || Math.abs(z) > bz - 0.15 || y > fy + (inBld && !outside ? top : 7) || (outside && inBld && y > CEIL - 0.1 && y < 4.1) || y < fy + (race.driving ? -0.1 : 0.15) || insideTall(x, z)) { allowed = Math.max(0.3, t - 0.12); break; }
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
let lastAll = -1e9;
const IDLE_MS = 50000; // 11-25: 가만히 있는 사람은 50초에 한 번만 '나 여기 있어요'(사용량 절약). 접속자 정리(net.js)는 150초라 넉넉함
function sendState(force = false, all = false) {
  if (!net) return;
  const t = performance.now();
  net.setFloor(player.floor); // 🏢 같은 층 채널로 갈아탐 (층이 바뀔 때만)
  const movedEnough = Math.abs(player.x - lastSent.x) + Math.abs(player.z - lastSent.z) > 0.02 || Math.abs(player.ry - lastSent.ry) > 0.05;
    // 무료 사용량을 아끼려고: 움직일 때 초당 약 3번, 가만히 있을 땐 10초에 한 번 (받는 쪽에서 부드럽게 이어 그림)
  if (!force && player.floor === lastSent.floor && !(movedEnough && t - lastSend > 300) && t - lastSend < IDLE_MS) return; // 가만히 있을 땐 50초에 한 번(공용)
  lastSend = t;
  // 모두에게(공용 채널): 50초마다 · 층을 옮겼을 때 · 누가 새로 들어왔을 때 → 접속자 목록 · 층 표시용. 나머지 움직임은 같은 층에만
  if (player.floor !== lastSent.floor || t - lastAll > IDLE_MS) all = true;
  if (all) lastAll = t;
  lastSent = { x: player.x, z: player.z, ry: player.ry, floor: player.floor };
  net.sendState({ id: me.id, name: me.name, color: me.color, g: me.gender, lk: me.look, ac: (me.acc || []).join(','), jt: me.jt, dv: me.dev, floor: player.floor, x: +player.x.toFixed(2), z: +player.z.toFixed(2), ry: +player.ry.toFixed(2), sp: +player.speed.toFixed(1), zone: player.zone, st: player.sit ? player.sit.h : ride.mine && sleigh ? sleigh.seatH : 0, bx: game.on ? game.booth.i : -1, pc: game.pc, wk: player.working ? 1 : 0, jc: player.jc || 0, dl: duel.active ? 1 : 0, sc: duel.swings, lv: duel.level, tt: duel.loser ? 1 : 0, hy: myAvatar ? +myAvatar.ground.toFixed(2) : 0, kb: myAvatar?.kickId || '', rp: race.progress, dn: myAvatar?.danceId || 0 }, all);
}

function onState(p) {
  if (!p?.id || p.id === me.id) return;
  // 같은 기기에서 예전에 열어 둔 내 화면이면(새로 고침 · 탭 다녀오기) 유령으로 보고 지움
  if (p.dv && p.dv === me.dev && (p.jt || 0) < me.jt) { if (peers.has(p.id)) removePeer(p.id, true); return; }
  // 같은 이름: 나중에 들어온 사람이 이름을 바꿔야 함
  if (p.name === me.name && myAvatar && ((p.jt || 0) < me.jt || ((p.jt || 0) === me.jt && p.id < me.id))) askNewName();
  // 11-26 같은 이름이 여러 명 보이던 것: ① 같은 기기에서 새로 고침해 남은 예전 화면(유령)은 지우고 ② 다른 기기에서 나중에 온 같은 이름은 이름을 바꿀 때까지 안 보여 줌
  const later = (aj, aid, bj, bid) => (aj || 0) > (bj || 0) || ((aj || 0) === (bj || 0) && aid > bid); // a가 b보다 나중에 왔나
  if (p.name === me.name && myAvatar && later(p.jt, p.id, me.jt, me.id)) { if (peers.has(p.id)) removePeer(p.id, true); return; }
  for (const [id, q] of peers) {
    if (id === p.id || q.name !== p.name) continue;
    const pLater = later(p.jt, p.id, q.jt, id);
    if (q.dv && q.dv === p.dv) { if (pLater) removePeer(id, true); else return; }            // 같은 기기: 예전 것(유령) 정리
    else if (pLater) { if (peers.has(p.id)) removePeer(p.id, true); return; }                 // 다른 기기 · 나중에 옴: 숨김
    else removePeer(id, true);                                                                 // 먼저 보인 쪽이 사실은 나중에 온 사람
  }
  let peer = peers.get(p.id);
  if (!peer || peer.name !== p.name) {
    if (peer) { scene.remove(peer.av.root); peer.av.dispose(); }
    const fresh = !peer;
    peer = { av: new Avatar(p.name, p.color, p.g, p.lk), x: p.x, z: p.z, ry: p.ry, floor: p.floor || 0, name: p.name, color: p.color };
    scene.add(peer.av.root);
    peers.set(p.id, peer);
    if (fresh) { if (Date.now() - (recentlyGone.get(p.name) || 0) > 5 * 60000) sysMessage(`${p.name}님이 들어왔어요.`); sendState(true); }
    updateOnline();
  }
  peer.jt = p.jt; peer.dv = p.dv;
  peer.av.setLook(p.color, p.g, p.lk); peer.color = p.color; // 같으면 아무것도 안 함
  peer.av.setAcc(p.ac || '');
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
  peer.av.setKick(p.kb || null);
  peer.rp = p.rp;
  peer.av.setDance(p.dn || 0);
}
const recentlyGone = new Map(); // 이름 → 나간 시각 (잠깐 다녀온 사람은 '들어왔어요'를 또 띄우지 않음)
function removePeer(id, quiet = false) {
  const peer = peers.get(id);
  if (!peer) return;
  scene.remove(peer.av.root);
  peer.av.dispose();
  peers.delete(id);
  if (!quiet) sysMessage(`${peer.name}님이 나갔어요.`);
  recentlyGone.set(peer.name, Date.now());
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
  let color = /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#fff';
  { const n = parseInt(color.slice(1), 16), l = 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255); if (l < 110) color = '#c9ced8'; } // 검정 · 차콜 옷이면 어두운 채팅창에서 이름이 안 보여서 밝은 회색으로
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

// 🆕 들어왔을 때 아직 안 본 업데이트 소식 (확인하면 이 기기에서는 다시 안 뜸)
function showNews() {
  const list = unseenNews(); if (!list.length) return;
  $('newsBody').innerHTML = list.map((n) => `<h3>${n.title}</h3><ul>${n.items.map((t) => `<li>${t}</li>`).join('')}</ul>`).join('');
  openModal('newsModal');
}
$('newsOk').onclick = () => { markNewsSeen(); closeModals(); };
document.querySelector('#newsModal [data-close]').addEventListener('click', markNewsSeen);
function openModal(id) { closeModals(); $(id).hidden = false; }
function closeModals() { document.querySelectorAll('.modal').forEach((m) => (m.hidden = true)); }
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m || e.target.hasAttribute('data-close')) closeModals(); }));
$('btnNotice').onclick = () => { refreshNotices(); openModal('noticeModal'); };
$('prompt').onclick = () => interact();
function interact() {
  if (mode !== 'office') return;
  const what = nearWhat();
  if (ride.mine) { if (!ride.flying) rideLeave(); return; }
  if (what === 'sleigh') { rideJoin(); return; }
  if (what === 'race') return; // 칸에 들어가면 자동 참가
  if (player.sit) { standUp(); return; }
  if (what && what.booth) startGame(what.booth);
  else if (what && what.seat) sitDown(what.seat);
  else if (what === 'host') duel.openPicker();
  else if (what === 'npc') npcTalk();
  else if (what === 'shop') { shop.clerk.say('어서 오세요, WORK BOUTIQUE예요 ✨ 천천히 둘러보세요.', now); shopUI.open('buy'); }
  else if (what === 'invest') { advisor.say('네, 어떤 투자를 도와드릴까요? 😊', now); money.openInvest(); }
  else if (what === 'notice') { refreshNotices(); openModal('noticeModal'); }
  else if (what === 'elev') openFloorMenu();
}
$('btnSound').onclick = () => { setMuted(!isMuted()); $('btnSound').innerHTML = isMuted() ? '🔇' : '🔊'; startAudio(); try { localStorage.setItem('work-mute', isMuted() ? '1' : '0'); } catch {} };
try { if (localStorage.getItem('work-mute') === '1') { setMuted(true); $('btnSound').textContent = '🔇'; } } catch {}

// ---------- 엘리베이터 · 층 이동 ----------
let elevAsked = false;
let elevMoving = false; // 층 이동 중(화면 어두워지는 동안)에는 층 선택 창을 다시 띄우지 않음
const floorOpen = () => !$('floorModal').hidden;
let floorSel = 0, heldAtOpen = new Set();
// 지금 있는 층은 고를 수 없음 (건물 밖에서 볼 때는 그 층으로 들어갈 수 있게 허용)
const floorBlocked = (i) => mode === 'office' && i === player.floor;
function openFloorMenu() {
  heldAtOpen = new Set(keys); keys.clear(); clearTarget(); // 창이 뜨면 캐릭터는 멈춤 (걷던 키를 계속 누르고 있어도 층이 마구 바뀌지 않게)
  // 실제 엘리베이터처럼 위층이 위에 (↑ = 위층)
  $('floorList').innerHTML = FLOORS.map((f, i) => [f, i]).reverse().map(([f, i]) => `<button data-f="${i}" class="${i === player.floor ? 'here' : ''}"${floorBlocked(i) ? ' disabled' : ''}><b>${f.label}</b>${f.name}${floorBlocked(i) ? '<small>지금 있는 층</small>' : ''}</button>`).join('');
  $('floorList').querySelectorAll('button').forEach((b) => (b.onclick = () => chooseFloor(+b.dataset.f)));
  floorSel = floorBlocked(player.floor) ? (player.floor + 1 < FLOORS.length ? player.floor + 1 : player.floor - 1) : player.floor;
  markFloorSel();
  openModal('floorModal');
  document.activeElement?.blur?.();
}
function markFloorSel() { $('floorList').querySelectorAll('button').forEach((b) => b.classList.toggle('sel', +b.dataset.f === floorSel)); }
// 층 선택 창: ↑↓(또는 W·S)로 고르고 Enter(또는 E · Space)로 이동, 숫자 1~5로 바로, Esc로 닫기
function floorKey(e) {
  const c = e.code;
  if (e.repeat && heldAtOpen.has(c)) { e.preventDefault(); return; }
  if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Enter', 'NumpadEnter', 'Space', 'KeyE'].includes(c)) e.preventDefault();
  if (c === 'ArrowUp' || c === 'KeyW' || c === 'ArrowDown' || c === 'KeyS') {
    const d = c === 'ArrowUp' || c === 'KeyW' ? 1 : -1; // ↑ 위층, ↓ 아래층 (끝에서 멈춤)
    let i = floorSel + d;
    if (i >= 0 && i < FLOORS.length && floorBlocked(i)) i += d;
    if (i >= 0 && i < FLOORS.length) { floorSel = i; markFloorSel(); }
  } else if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || (c === 'KeyE' && !e.repeat)) {
    if (!floorBlocked(floorSel)) chooseFloor(floorSel);
  } else if (/^(Digit|Numpad)[1-5]$/.test(c)) {
    const i = +c.slice(-1) - 1;
    if (!floorBlocked(i)) chooseFloor(i);
  } else if (c === 'Escape') closeModals();
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
  elevMoving = true;
  setTimeout(() => {
    elevMoving = false;
    player.floor = f;
    arrive();
    bld.setFloor(f);
    officeCamPose(null, pose);
    fade.classList.remove('on');
  }, 450);
}
// 층을 고르면: 엘리베이터 앞이면 바로, 멀면 엘리베이터까지 걸어가서 탐
function chooseFloor(f) {
  if (floorBlocked(f)) return; // 같은 층은 이동하지 않음
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
  const html = rows.map((p) => `<li${p.me ? ' class="me"' : ` data-name="${esc(p.name)}" title="눌러서 업무 요청"`}><i></i><span>${esc(p.name)}${p.me ? ' (나)' : ''}</span><small>${fl(p.floor)}</small></li>`).join('');
  $('onlineNum').textContent = rows.length;
  if (html !== onlineHtml) { onlineHtml = html; $('onlineList').innerHTML = html; }
}
setInterval(renderOnline, 1000);
$('onlineList').addEventListener('click', (e) => { const li = e.target.closest('li[data-name]'); if (li) reqs.open('new', li.dataset.name); });
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
  if (XMAS) garden.fountain.light.intensity *= 4; // 광장 트리 조명
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

// 다른 탭에 가 있어도(화면이 숨어 있어도) 20초마다 '여기 있어요' 소식을 보냄 → 다른 사람 화면에서 나갔다 들어왔다 하지 않게
setInterval(() => { if (document.hidden && myAvatar && net) sendState(true); }, 20000);

// ---------- 🛷 루돌프 썰매 타기 (1~4명, 맨 처음 탄 사람이 조종) ----------
// 탄 사람이 생기면 SLEIGH.wait초 뒤 출발 (4명이 차면 3초 뒤). 출발 시각은 모두에게 알림.
// 날 때는 처음 탄 사람(조종사)이 ←→ 방향 · ↑↓ 높이 (휴대폰은 조이스틱)로 조종하고, 위치를 0.1초마다 보내면 다른 화면은 그걸 부드럽게 따라 그림.
// 비행 시간(FREE초)이 끝나면 자동으로 돌아와 제자리에 내려앉음.
const FLY = { speed: 16, turn: 1.5, climb: 7, free: 45, maxT: 110, minY: 3, maxY: 45, range: 52 }; // range: 회사에서 이만큼 넘게 가면 스스로 돌아옴 (주변 빌딩에 부딪히지 않게)
const ride = { riders: new Map(), departAt: 0, start: 0, mine: false, flying: false, captain: null, sim: null, net: null, netAt: 0, sentAt: 0, roll: 0, camPos: null, camT: 0 };
const _pose = { x: SLEIGH.x, y: 0, z: SLEIGH.z, yaw: 0, pitch: 0, roll: 0 };
function riderList() { return [...ride.riders.entries()].sort((a, b) => a[1].ts - b[1].ts || (a[0] < b[0] ? -1 : 1)); }
const iAmCaptain = () => ride.flying && ride.sim && ride.captain === me.id;
function rideText() {
  const n = ride.riders.size, left = ride.departAt ? Math.max(0, Math.ceil((ride.departAt - Date.now()) / 1000)) : 0;
  if (ride.flying) {
    if (iAmCaptain()) {
      const sim = ride.sim, rest = Math.max(0, Math.ceil(FLY.free - sim.t));
      if (sim.phase === 'takeoff') return '🛷 날아오르는 중… 꽉 잡으세요!';
      if (sim.phase === 'free') return isTouch ? `🛷 조이스틱으로 조종 (좌우 방향 · 위아래 높이) · 남은 ${rest}초` : `🛷 조종 중! ←→ 방향 · ↑↓ 높이 · 남은 ${rest}초`;
      return '🛷 착륙하러 돌아가는 중…';
    }
    const cap = ride.riders.get(ride.captain);
    return `🛷 ${cap ? `${cap.name}님이 조종 중` : '날아가는 중'}! 꽉 잡으세요 ✨`;
  }
  if (ride.mine) return `🛷 출발까지 ${left}초 · ${n}/${SLEIGH.max}명 · ${riderList()[0]?.[0] === me.id ? '내가 조종사!' : `${riderList()[0]?.[1].name}님이 조종`} · ${isTouch ? '내리기 (누르기)' : '내리기: E'}`;
  if (n >= SLEIGH.max) return '🛷 썰매가 꽉 찼어요 (4명)';
  return `${isTouch ? '' : 'E  '}🛷 루돌프 썰매 타기 (${n}/${SLEIGH.max}명${n ? ` · ${left}초 뒤 출발` : ' · 처음 탄 사람이 조종해요'})${isTouch ? ' (누르기)' : ''}`;
}
function rideJoin() {
  if (ride.flying || ride.riders.has(me.id)) return;
  if (ride.riders.size >= SLEIGH.max) { toast('🛷 썰매가 꽉 찼어요. 다음 비행을 기다려 주세요!', null); return; }
  if (player.sit) standUp();
  const ts = Date.now();
  let at = ride.departAt || ts + SLEIGH.wait * 1000;
  if (ride.riders.size + 1 >= SLEIGH.max) at = Math.min(at, ts + 3000);
  const e = { t: 'sleigh', k: 'join', id: me.id, name: me.name, ts, at };
  net?.sendEvent(e); rideEvent(e);
}
function rideLeave() {
  const e = { t: 'sleigh', k: 'leave', id: me.id };
  net?.sendEvent(e); rideEvent(e);
}
function rideEvent(e) {
  if (!sleigh || !e || e.t !== 'sleigh') return;
  if (e.k === 'pose') { // 조종사가 보낸 위치
    if (ride.captain === me.id && ride.sim) return;
    ride.net = e; ride.netAt = performance.now();
    if (!ride.flying) { ride.flying = true; ride.start = Date.now(); ride.captain = e.id; if (!ride.netInit) Object.assign(_pose, e); }
    ride.netInit = true;
    return;
  }
  if (e.k === 'land') { if (ride.flying) rideLand(); return; }
  if (ride.flying) return;
  if (e.k === 'join' && ride.riders.size < SLEIGH.max && !ride.riders.has(e.id)) {
    ride.riders.set(e.id, { ts: e.ts, name: e.name });
    ride.departAt = ride.departAt ? Math.min(ride.departAt, e.at) : e.at;
    if (e.id === me.id) { ride.mine = true; clearTarget(); sysMessage(`🛷 썰매에 탔어요! ${Math.ceil((ride.departAt - Date.now()) / 1000)}초 뒤 출발해요. ${riderList()[0][0] === me.id ? '처음 탔으니 내가 조종해요 (←→ 방향 · ↑↓ 높이)!' : ''}`); playBeep(880, 0.12); }
    else sysMessage(`🛷 ${e.name}님이 루돌프 썰매에 탔어요! (${ride.riders.size}/${SLEIGH.max}명)`);
  } else if (e.k === 'leave' && ride.riders.has(e.id)) {
    ride.riders.delete(e.id);
    if (e.id === me.id) { ride.mine = false; myAvatar.setSit(false); player.x = SLEIGH.x - 0.4; player.z = SLEIGH.z + 1.4; sendState(true); }
    if (!ride.riders.size) ride.departAt = 0;
  }
}
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// 조종사 화면에서 썰매를 움직임
function simStep(dt) {
  const sim = ride.sim; sim.t += dt;
  let turn = 0, climb = 0, speed = FLY.speed;
  if (sim.phase === 'takeoff') { climb = 0.9; if (sim.y > 6 || sim.t > 2.5) sim.phase = 'free'; }
  else if (sim.phase === 'free') {
    if (keys.has('ArrowLeft') || keys.has('KeyA')) turn += 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) turn -= 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) climb += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) climb -= 1;
    turn -= joy.x; climb -= joy.y;
    // 너무 멀리 가면 스스로 건물 쪽으로 돌아옴
    if (Math.hypot(sim.x, sim.z) > FLY.range) { const want = Math.atan2(sim.z, -sim.x); turn = THREE.MathUtils.clamp(wrapA(want - sim.yaw) * 2, -1, 1); }
    if (sim.t > FLY.free) sim.phase = 'return';
  }
  if (sim.phase === 'return') {
    // 동쪽 문 앞 길(서쪽에서 들어오는 방향)으로 돌아옴
    const ax = SLEIGH.x - 18, az = SLEIGH.z, want = Math.atan2(-(az - sim.z), ax - sim.x);
    turn = THREE.MathUtils.clamp(wrapA(want - sim.yaw) * 2, -1, 1);
    climb = THREE.MathUtils.clamp((5 - sim.y) * 0.4, -1, 1);
    if (Math.hypot(ax - sim.x, az - sim.z) < 7 || sim.t > FLY.maxT - 8) sim.phase = 'final';
  }
  if (sim.phase === 'final') {
    const dx = SLEIGH.x - sim.x, dz = SLEIGH.z - sim.z, d = Math.hypot(dx, dz);
    speed = THREE.MathUtils.clamp(d * 1.1, 1.5, 12);
    const step = Math.min(d, speed * dt);
    if (d > 0.01) { sim.x += (dx / d) * step; sim.z += (dz / d) * step; }
    const yawT = d > 2 ? Math.atan2(-dz, dx) : 0;
    sim.yaw += wrapA(yawT - sim.yaw) * Math.min(1, dt * 3);
    sim.y += (Math.min(sim.y, d * 0.35) - sim.y) * Math.min(1, dt * 2.5);
    sim.pitch = -Math.min(0.25, sim.y * 0.05); sim.roll += (0 - sim.roll) * Math.min(1, dt * 4);
    if (d < 0.08 && sim.y < 0.05) return true; // 내려앉음
    return false;
  }
  sim.yaw += turn * FLY.turn * dt;
  sim.x += Math.cos(sim.yaw) * speed * dt; sim.z += -Math.sin(sim.yaw) * speed * dt;
  const vy = climb * FLY.climb;
  sim.y += vy * dt;
  // 땅 · 건물에 부딪히지 않게
  const overBld = Math.abs(sim.x) < HX + 2.5 && Math.abs(sim.z) < HZ + 2.5;
  const floorY = sim.phase === 'takeoff' ? 0 : overBld ? 21 : FLY.minY;
  if (sim.y < floorY) sim.y += (floorY - sim.y) * Math.min(1, dt * 6);
  sim.y = Math.min(FLY.maxY, sim.y);
  sim.pitch += (Math.atan2(vy, speed) * 0.8 - sim.pitch) * Math.min(1, dt * 4);
  sim.roll += (-turn * 0.45 - sim.roll) * Math.min(1, dt * 3);
  return sim.t > FLY.maxT;
}
const _seat = new THREE.Vector3();
function updateRide(dt) {
  if (!sleigh) return;
  const t = Date.now();
  for (const id of ride.riders.keys()) if (id !== me.id && !peers.has(id) && !ride.flying) ride.riders.delete(id); // 접속이 끊긴 사람은 빼기
  if (!ride.riders.size && !ride.flying) ride.departAt = 0;
  // 출발
  if (!ride.flying && ride.departAt && ride.riders.size && t >= ride.departAt) {
    ride.flying = true; ride.start = ride.departAt; ride.captain = riderList()[0][0]; ride.netAt = performance.now();
    if (ride.captain === me.id) ride.sim = { x: SLEIGH.x, y: 0, z: SLEIGH.z, yaw: 0, pitch: 0, roll: 0, t: 0, phase: 'takeoff' };
    if (ride.mine) { bld.setFloor(0, true); sysMessage(ride.captain === me.id ? '🛷 출발! 내가 조종해요 — ←→ 방향 · ↑↓ 높이 (휴대폰은 조이스틱)' : '🛷 출발! 꽉 잡으세요 🎄'); playBeep(990, 0.2); }
  }
  let speed = 0;
  if (ride.flying) {
    // 조종사가 사라지면(위치 소식이 3초 넘게 없으면) 탄 사람 중 하나가 이어받아 착륙시킴
    if (!ride.sim && performance.now() - ride.netAt > 3000) {
      const next = riderList().find(([id]) => id === me.id || peers.has(id));
      if (next && next[0] === me.id) { ride.captain = me.id; ride.sim = { ..._pose, t: FLY.free, phase: 'return' }; }
      else if (!next) { rideLand(); return; }
    }
    if (ride.sim) {
      // 화면이 버벅여도 같은 빠르기로 날도록 실제 지난 시간으로 계산 (잘게 나눠서)
      const tn = performance.now(); let real = Math.min(0.3, (tn - (ride.simT || tn)) / 1000); ride.simT = tn;
      let done = false;
      while (real > 1e-4 && !done) { const st = Math.min(0.04, real); real -= st; done = simStep(st); }
      Object.assign(_pose, ride.sim);
      if (performance.now() - ride.sentAt > 120 || done) { ride.sentAt = performance.now(); net?.sendEvent({ t: 'sleigh', k: 'pose', id: me.id, x: +_pose.x.toFixed(2), y: +_pose.y.toFixed(2), z: +_pose.z.toFixed(2), yaw: +_pose.yaw.toFixed(3), pitch: +_pose.pitch.toFixed(3), roll: +_pose.roll.toFixed(3) }); }
      if (done) { net?.sendEvent({ t: 'sleigh', k: 'land' }); rideLand(); return; }
      speed = FLY.speed;
    } else if (ride.net) { // 받은 위치를 부드럽게 따라감
      const tn = performance.now(), real = Math.min(0.3, (tn - (ride.followT || tn)) / 1000); ride.followT = tn;
      const n = ride.net, k = Math.min(1, real * 8), ox = _pose.x, oz = _pose.z;
      _pose.x += (n.x - _pose.x) * k; _pose.y += (n.y - _pose.y) * k; _pose.z += (n.z - _pose.z) * k;
      _pose.yaw += wrapA(n.yaw - _pose.yaw) * k; _pose.pitch += (n.pitch - _pose.pitch) * k; _pose.roll += (n.roll - _pose.roll) * k;
      speed = real > 0 ? Math.hypot(_pose.x - ox, _pose.z - oz) / real : 0;
    }
    sleigh.root.position.set(_pose.x, _pose.y, _pose.z);
    sleigh.root.rotation.set(_pose.roll, _pose.yaw, _pose.pitch, 'YZX');
  } else {
    Object.assign(_pose, { x: SLEIGH.x, y: 0, z: SLEIGH.z, yaw: 0, pitch: 0, roll: 0 });
    sleigh.root.position.set(SLEIGH.x, 0, SLEIGH.z); sleigh.root.rotation.set(0, 0, 0);
  }
  sleigh.animate(dt, speed);
  // 탄 사람들을 자리에 앉힘
  sleigh.root.updateMatrixWorld(true);
  riderList().forEach(([id], i) => {
    const av = id === me.id ? myAvatar : peers.get(id)?.av; if (!av) return;
    _seat.copy(sleigh.seats[i]); sleigh.root.localToWorld(_seat);
    av.root.position.copy(_seat);
    av.root.quaternion.copy(sleigh.root.quaternion); av.root.rotateY(Math.PI / 2); // 아바타 앞(+z)을 썰매 앞(+x)으로
    av.setSit(true, sleigh.seatH);
    av.root.visible = true;
    if (id !== me.id) av.animate(0, 0, now);
  });
  if (ride.mine) { player.x = sleigh.root.position.x; player.z = sleigh.root.position.z; player.floor = 0; }
}
function rideLand() {
  const wasMine = ride.mine, myIdx = riderList().findIndex(([id]) => id === me.id);
  for (const [id] of ride.riders) { const av = id === me.id ? myAvatar : peers.get(id)?.av; if (av) { av.root.rotation.set(0, av.root.rotation.y, 0); av.setSit(false); } }
  Object.assign(ride, { flying: false, mine: false, departAt: 0, start: 0, captain: null, sim: null, simT: 0, net: null, netInit: false, camPos: null, camT: 0 });
  ride.riders.clear();
  if (wasMine) {
    player.floor = 0; player.x = SLEIGH.x - 1.3 + Math.max(0, myIdx) * 0.75; player.z = SLEIGH.z + 1.35; player.ry = Math.PI; myAvatar.root.rotation.set(0, Math.PI, 0);
    bld.setFloor(0); player.zone = zoneAt(0, player.x, player.z); showFloorHud(); sendState(true);
    cam.yaw = Math.PI / 2; cam.pitch = 0.25;
    toast('🛷 즐거운 비행이었어요! 메리 크리스마스 🎄', null);
  }
}
// 비행 중에는 썰매 뒤를 따라가는 카메라
const _cp = new THREE.Vector3(), _cl = new THREE.Vector3();
function rideCamera() {
  if (!ride.mine || !ride.flying || mode !== 'office') return;
  const p = sleigh.root.position, y = _pose.yaw, fx = Math.cos(y), fz = -Math.sin(y);
  _cp.set(p.x - fx * 8 + fz * 1.5, p.y + 3.6, p.z - fz * 8 - fx * 1.5);
  _cl.set(p.x + fx * 4, p.y + 0.9, p.z + fz * 4);
  const tn = performance.now(), rdt = Math.min(0.5, (tn - (ride.camT || tn)) / 1000); ride.camT = tn; // 화면이 버벅여도 놓치지 않게 실제 시간으로
  if (!ride.camPos) ride.camPos = camera.position.clone();
  ride.camPos.lerp(_cp, Math.min(1, rdt * 6));
  camera.position.copy(ride.camPos); camera.lookAt(_cl);
  if (camera.near !== 0.3) { camera.near = 0.3; camera.updateProjectionMatrix(); }
  if (myAvatar) myAvatar.root.visible = true;
}

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
  snowFight.update(dt);
  race.tick(); raceTrack.update(now); partyStage.update(now);
  if (myAvatar && !race.driving && !race.running) { const inZ = inRaceZone(player.floor, player.x, player.z); if (inZ !== race.joined) inZ ? race.join() : race.leave(); } // 🏁 칸 안 = 참가
  duelHost.root.visible = !(mode === 'office' && player.floor !== ARENA.floor); duelHost.animate(dt, 0, now);
  if (duelBot.root.visible) duelBot.animate(dt, 0, now);
  if (pingMark.visible) { pingMark.scale.setScalar(Math.max(1, pingMark.scale.x - dt * 3)); pingMark.rotation.z += dt * 2; }
  if (myAvatar && (mode === 'office' || mode === 'fly' || mode === 'exterior')) {
    if (mode === 'office') updatePlayer(dt); else myAvatar.animate(dt, 0, now);
    sendState();
  }
  updatePeers(dt);
  updateNpc(dt); updateAdvisor(dt);
  shop.update(dt, now, player.x, player.z, mode === 'office' && player.floor === 0);
  if (mode === 'office' && player.floor === 0 && shop.inside(player.x, player.z) && now - clerkGreetAt > 90) { clerkGreetAt = now; shop.clerk.say('어서 오세요! 오늘 새로 들어온 왕관 보셨어요? 👑', now); }
  if (XMAS) updateRide(dt);
  updateCamera(dt);
  if (XMAS) rideCamera();
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
// 🛡 11-26: 개발자 콘솔에서 돈 · 결투를 건드릴 수 있던 통로 → 서버 없는 로컬 데모(점검용)에서만 열어 둠
if (!supa || /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) window.__work = { danceTap, sitDown, race, advent, snowFight, shop, shopUI, money, ride, rideJoin, sleigh, FLY, duel, findPath, get mode() { return mode; }, get av() { return myAvatar; }, toggleDay, game, bld, collide, get day() { return dayVal; }, player, cam, orbit, peers, enter, keys, goFloor, chooseFloor };
window.__workMain = true;
