// ⚔️ 소환의 검 결투
// 4층 결투 관리인(NPC)에게 정식 신청 → 접속자 중 선택(하루 2번까지) 또는 👾 업무 괴물(연습) → 상대 수락 →
// 모든 층에 "대결이 시작되었습니다" → 4층 결투장에서 연타 → 이기면 Lv +1 / 지면 😵패배자 칭호(그날 하루만, 이기면 바로 떨어짐)
// 서로 결투 알림만 주고받고, 레벨 · 칭호는 Supabase 'duel_stats' 표에 이름별로 저장 (어느 기기로 들어와도 같음)
// 표가 없거나 로컬 데모 모드면 이 기기(localStorage)에만 저장
import { supa } from './net.js';

const HP = 100, FIGHT = 30;   // 체력, 제한 시간(초)
const DAILY = 2;              // 사람에게 하는 도전: 하루 최대 횟수
export const SWORD = '소환의 검';
export const BOT_NAME = '👾 업무 괴물';

export function createDuel(api) {
  const { $, me, peers } = api;
  const st = { active: false, phase: 'idle', id: null, opp: null, oppName: '', role: '', t: 0, myHp: HP, oppHp: HP, last: 0, combo: 1, pending: 0, sendAt: 0, sc: 0, referee: false, oppGoneAt: 0, bot: false, botNext: 0 };
  let stats = { level: 1, loser: false, win: 0, lose: 0, day: '', challenges: 0, loseDay: '' }; // loseDay: 진 날 (이 기기에만 기록)
  try { const s = JSON.parse(localStorage.getItem('work-duel2') || '{}'); stats = { ...stats, ...s }; } catch {}
  let owner = '';   // 지금 레벨이 누구(이름) 것인지
  const KEYS = ['level', 'loser', 'win', 'lose', 'day', 'challenges'];
  const pick = (o) => Object.fromEntries(KEYS.map((k) => [k, o[k]]));
  const save = () => {
    try { localStorage.setItem('work-duel2', JSON.stringify(stats)); } catch {}
    if (supa && owner) supa.from('duel_stats').upsert({ name: owner, ...pick(stats), updated_at: new Date().toISOString() }, { onConflict: 'name' })
      .then(({ error }) => { if (error) console.warn('결투 기록 저장 실패', error.message); });
  };
  // 들어올 때 · 이름을 바꿨을 때: 그 이름의 기록을 불러옴 (없으면 이 기기 기록을 그 이름으로 올림)
  async function load(name) {
    owner = name;
    if (!supa || !name) return;
    const { data, error } = await supa.from('duel_stats').select('*').eq('name', name).maybeSingle();
    if (owner !== name) return;
    if (error) { console.warn('결투 기록 불러오기 실패', error.message); return; }
    if (data) {
      // 패배자 칭호는 진 날 하루만: 기록이 마지막으로 바뀐 날이 오늘이 아니면 이미 지난 칭호
      const upd = data.updated_at ? new Date(data.updated_at).toLocaleDateString('ko-KR') : '';
      stats = { ...stats, ...pick(data), level: Math.max(1, data.level | 0), loser: !!data.loser, loseDay: data.loser ? upd : '' };
      if (expire()) save();
      try { localStorage.setItem('work-duel2', JSON.stringify(stats)); } catch {}
      api.levelChanged(stats.level);
    } else save();
  }
  const today = () => new Date().toLocaleDateString('ko-KR');
  // 날짜가 바뀌면 패배자 칭호를 뗌 (바뀌었으면 true)
  const expire = () => { if (stats.loser && stats.loseDay !== today()) { stats.loser = false; stats.loseDay = ''; return true; } return false; };
  const left = () => { if (stats.day !== today()) { stats.day = today(); stats.challenges = 0; save(); } return Math.max(0, DAILY - stats.challenges); };
  let invite = null, outgoing = null;

  const send = (e) => api.net()?.sendEvent(e);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 화면 ----------
  let bannerTimer = 0;
  function banner(text, sec = 4.5) {
    const el = $('duelBanner');
    el.textContent = text; el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { el.hidden = true; }, sec * 1000);
  }
  function bars(aName, aHp, bName, bHp, t) {
    $('dvA').textContent = aName; $('dvB').textContent = bName;
    $('dvAhp').style.width = `${Math.max(0, aHp)}%`; $('dvBhp').style.width = `${Math.max(0, bHp)}%`;
    $('dvTime').textContent = t > 0 ? Math.ceil(t) : '';
  }
  const showBars = (on) => { $('duelBars').hidden = !on; };
  let watch = null;

  // ---------- 결투 관리인에게 신청: 상대 고르기 ----------
  function openPicker() {
    if (st.active) return;
    if (expire()) save();
    const n = left();
    const list = [...peers.entries()];
    $('dPickInfo').innerHTML = `오늘 남은 도전: <b>${n} / ${DAILY}</b> · 내 레벨 <b>Lv.${stats.level}</b>${stats.loser ? ' · 😵패배자' : ''}`;
    $('dPickList').innerHTML =
      list.map(([id, p]) => `<button type="button" data-id="${esc(id)}" ${n ? '' : 'disabled'}><i style="background:${/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#888'}"></i>${esc(api.label(p))}<small>${esc(api.zoneName(p.zone))}</small></button>`).join('') +
      (list.length ? '' : '<p class="sub">지금 접속한 다른 사람이 없어요.</p>') +
      `<button type="button" data-id="bot" class="bot">${BOT_NAME}<small>연습 · 몇 번이든 · 레벨 영향 없음</small></button>`;
    $('dPickList').querySelectorAll('button').forEach((b) => (b.onclick = () => challenge(b.dataset.id)));
    api.openModal('duelPick');
  }
  function challenge(id) {
    api.closeModals();
    if (id === 'bot') { const s = { t: 'start', id: `${me.id}-bot-${Date.now().toString(36)}`, a: me.id, aName: me.name, b: 'bot', bName: BOT_NAME, bot: 1 }; send(s); onEvent(s); return; }
    const p = peers.get(id);
    if (!p) return;
    if (left() <= 0) { api.sys(`오늘은 더 도전할 수 없어요. (하루 ${DAILY}번까지)`); return; }
    const did = `${me.id}-${Date.now().toString(36)}`;
    outgoing = { to: id, name: p.name, id: did };
    send({ t: 'invite', id: did, from: me.id, fromName: me.name, fromLv: stats.level, to: id });
    api.sys(`⚔️ ${p.name}님에게 정식으로 결투를 신청했어요. 수락을 기다리는 중…`);
    setTimeout(() => { if (outgoing?.id === did && !st.active) { api.sys(`${outgoing.name}님이 답이 없어요. 결투 신청이 취소됐어요.`); outgoing = null; } }, 25000);
  }
  $('dAccept').onclick = () => {
    if (!invite) return;
    send({ t: 'accept', id: invite.id, from: me.id, to: invite.from });
    api.closeModals(); api.sys('⚔️ 결투를 수락했어요! 곧 4층 결투장으로 이동해요.');
    invite = null;
  };
  $('dDecline').onclick = () => { if (invite) send({ t: 'decline', id: invite.id, from: me.id, to: invite.from }); invite = null; api.closeModals(); };

  // ---------- 메시지 ----------
  function onEvent(e) {
    if (!e || !e.t) return;
    if (e.t === 'invite' && e.to === me.id) {
      if (st.active || invite) { send({ t: 'decline', id: e.id, from: me.id, to: e.from, busy: 1 }); return; }
      invite = e;
      $('dAskText').innerHTML = `<b>Lv.${e.fromLv || 1} ${esc(e.fromName)}</b>님이 <b>${SWORD}</b>으로 정식 결투를 신청했어요!<br><small>이기면 레벨 +1, 지면 오늘 하루 😵패배자 칭호가 붙어요.</small>`;
      api.openModal('duelAsk'); api.beep(880, 0.15);
      setTimeout(() => { if (invite?.id === e.id) { send({ t: 'decline', id: e.id, from: me.id, to: e.from }); invite = null; api.closeModals(); } }, 20000);
    } else if (e.t === 'decline' && e.to === me.id && outgoing?.id === e.id) {
      api.sys(e.busy ? `${outgoing.name}님은 지금 결투 중이에요.` : `${outgoing.name}님이 결투를 거절했어요. (도전 횟수는 그대로예요)`);
      outgoing = null;
    } else if (e.t === 'accept' && e.to === me.id && outgoing?.id === e.id) {
      left(); stats.challenges++; save(); // 상대가 수락했을 때만 도전 횟수 차감
      const s = { t: 'start', id: e.id, a: me.id, aName: me.name, b: e.from, bName: outgoing.name };
      send(s); onEvent(s); outgoing = null;
    } else if (e.t === 'start') {
      banner(`⚔️ ${e.aName} vs ${e.bName} 대결이 시작되었습니다! (4층 결투장)`);
      api.chatLine(`⚔️ ${e.aName} vs ${e.bName} 대결 시작!${e.bot ? ' (연습)' : ''}`);
      if (e.a === me.id || e.b === me.id) begin(e);
      else if (!e.bot) { watch = { id: e.id, a: e.aName, b: e.bName, aId: e.a, bId: e.b, aHp: HP, bHp: HP, until: performance.now() + (FIGHT + 12) * 1000 }; showBars(true); }
    } else if (e.t === 'hit' && st.active && !st.bot && e.id === st.id && e.to === me.id) {
      takeHit(e.dmg);
      send({ t: 'hp', id: st.id, who: me.id, hp: st.myHp });
    } else if (e.t === 'hp') {
      if (st.active && e.id === st.id && e.who === st.opp) st.oppHp = e.hp;
      if (watch && e.id === watch.id) { if (e.who === watch.aId) watch.aHp = e.hp; else watch.bHp = e.hp; }
      api.peerHurt(e.who);
    } else if (e.t === 'end') {
      const wName = e.winner ? (e.winner === me.id ? me.name : e.winnerName) : '';
      banner(e.winner ? `🏆 ${wName} 승리!${e.bot ? ' (연습)' : ''}` : `🤝 무승부! (${e.aName} vs ${e.bName})`, 5);
      api.chatLine(e.winner ? `🏆 ${e.aName} vs ${e.bName} — ${wName} 승리!` : `🤝 ${e.aName} vs ${e.bName} 무승부`);
      if (e.loser) api.knockout(e.loser); // 진 사람은 뒤로 쓰러짐
      if (st.active && e.id === st.id) result(e);
      if (watch && e.id === watch.id) { watch = null; showBars(false); }
    }
  }

  // ---------- 대결 ----------
  function begin(e) {
    const mineA = e.a === me.id;
    Object.assign(st, { active: true, phase: 'count', id: e.id, opp: mineA ? e.b : e.a, oppName: mineA ? e.bName : e.aName, role: mineA ? 'a' : 'b', referee: mineA, bot: !!e.bot, t: 3.5, myHp: HP, oppHp: HP, combo: 1, pending: 0, sc: 0, oppGoneAt: 0, botNext: 0 });
    invite = null; outgoing = null; api.closeModals();
    api.enterArena(mineA ? -1 : 1, st.bot);
    $('duelUI').hidden = false; $('dResult').hidden = true; $('dAttack').hidden = false;
    showBars(true);
    api.sys(`🗡️ ${SWORD}을(를) 소환했다!`);
  }
  function takeHit(dmg) {
    if (st.phase !== 'fight') return;
    st.myHp = Math.max(0, st.myHp - dmg);
    api.hurtMe(); api.thump(1.2); floatText(`-${dmg}`, true); api.shake(0.12 + dmg * 0.03);
    if (st.myHp <= 0) finish(st.opp);
  }
  function attack() {
    if (!st.active || st.phase !== 'fight') return;
    const now = performance.now() / 1000;
    st.combo = now - st.last < 0.4 ? Math.min(st.combo + 0.1, 2) : 1;
    st.last = now;
    const dmg = Math.max(1, Math.round((0.7 + Math.random() * 0.8) * st.combo));
    st.sc++; api.swing(); api.thump(st.combo); floatText(`+${dmg}`, false); api.spark(st.combo);
    if (st.bot) { st.oppHp = Math.max(0, st.oppHp - dmg); api.botHurt(); if (st.oppHp <= 0) finish(me.id); }
    else st.pending += dmg;
  }
  function finish(winnerId) {
    if (st.phase === 'done') return;
    st.phase = 'done';
    const loser = !winnerId ? null : winnerId === me.id ? st.opp : me.id;
    const e = { t: 'end', id: st.id, winner: winnerId, loser, winnerName: winnerId === me.id ? me.name : st.oppName, bot: st.bot ? 1 : 0,
      aName: st.role === 'a' ? me.name : st.oppName, bName: st.role === 'a' ? st.oppName : me.name };
    send(e); onEvent(e);
  }
  function result(e) {
    st.phase = 'done';
    let msg;
    if (st.bot) msg = e.winner === me.id ? `🏆 ${BOT_NAME}을(를) 물리쳤어요! 오늘 업무도 이렇게만! (연습이라 레벨은 그대로)` : !e.winner ? '🤝 무승부! (연습)' : `📚 ${BOT_NAME}에게 깔렸어요… (연습이라 칭호는 안 붙어요)`;
    else if (!e.winner) msg = '🤝 무승부! 레벨 · 칭호는 그대로예요.';
    else if (e.winner === me.id) { stats.win++; stats.level++; const was = stats.loser; stats.loser = false; msg = `🏆 승리! <b>Lv.${stats.level}</b>로 올랐어요 🎉${was ? '<br>😵패배자 칭호도 떨어졌어요!' : ''}`; api.beep(784, 0.3); }
    else { stats.lose++; stats.loser = true; stats.loseDay = today(); msg = `😵 패배… 이름표에 <b>패배자</b> 칭호가 붙었어요.<br><small>오늘 하루만 붙어요. 오늘 다시 이기면 바로 떨어져요.</small>`; }
    save();
    $('dResText').innerHTML = `${msg}<br><small>전적 ${stats.win}승 ${stats.lose}패 · Lv.${stats.level}</small>`;
    $('dResult').hidden = false; $('dAttack').hidden = true;
    api.levelChanged(stats.level);
  }
  function leave() {
    Object.assign(st, { active: false, phase: 'idle', id: null, bot: false });
    $('duelUI').hidden = true; showBars(false);
    api.exitArena();
  }
  $('dAttack').addEventListener('pointerdown', (ev) => { ev.preventDefault(); attack(); });
  $('dLeave').onclick = leave;

  function floatText(t, bad) {
    const f = document.createElement('span');
    f.className = 'gfloat' + (bad ? ' big' : ''); f.textContent = t;
    f.style.left = `${bad ? 30 + Math.random() * 10 : 55 + Math.random() * 10}%`;
    $('dFloat').appendChild(f); setTimeout(() => f.remove(), 700);
  }

  // ---------- 매 프레임 ----------
  function update(dt) {
    const tnow = performance.now();
    if (watch) { bars(watch.a, watch.aHp, watch.b, watch.bHp, 0); if (tnow > watch.until) { watch = null; showBars(false); } }
    if (!st.active) return;
    if (st.role === 'a') bars(me.name, st.myHp, st.oppName, st.oppHp, st.phase === 'fight' ? st.t : 0);
    else bars(st.oppName, st.oppHp, me.name, st.myHp, st.phase === 'fight' ? st.t : 0);
    if (st.phase === 'count') {
      st.t -= dt;
      $('dBig').hidden = false; $('dBig').textContent = st.t > 0.5 ? Math.ceil(st.t - 0.5) : '시작!';
      if (st.t <= 0) { st.phase = 'fight'; st.t = FIGHT; setTimeout(() => { $('dBig').hidden = true; }, 400); api.beep(990, 0.25); }
    } else if (st.phase === 'fight') {
      st.t -= dt;
      if (st.bot) {
        // 업무 괴물: 결재 도장을 마구 휘두름 (사람이 빠르게 연타하면 이길 수 있는 정도)
        st.botNext -= dt;
        if (st.botNext <= 0) { st.botNext = 0.16 + Math.random() * 0.22; api.botSwing(); takeHit(Math.random() < 0.25 ? 2 : 1); }
      } else {
        if (st.pending > 0 && tnow - st.sendAt > 200) { send({ t: 'hit', id: st.id, from: me.id, to: st.opp, dmg: st.pending }); st.pending = 0; st.sendAt = tnow; api.sendNow(); }
        if (!peers.has(st.opp)) { st.oppGoneAt ||= tnow; if (tnow - st.oppGoneAt > 5000) finish(me.id); } else st.oppGoneAt = 0;
      }
      const judge = () => finish(st.myHp === st.oppHp ? null : st.myHp > st.oppHp ? me.id : st.opp);
      if (st.t <= 0 && (st.referee || st.bot)) judge();
      if (st.t < -3) judge(); // 심판이 답이 없을 때
    }
  }

  return {
    st, onEvent, update, openPicker, attack, leave, load,
    get active() { return st.active; },
    get fighting() { return st.active && st.phase !== 'done'; },
    get level() { return stats.level; },
    get loser() { if (expire()) save(); return stats.loser; },
    get swings() { return st.bot ? 0 : st.sc; },
    get vsBot() { return st.active && st.bot; },
  };
}
