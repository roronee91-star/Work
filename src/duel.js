// ⚔️ 칼싸움 결투: 신청 → 수락 → 모든 층에 알림 → 4층 결투장에서 연타 대결 → 승패 · 레벨
// 서로 메시지(결투 알림)만 주고받고, 점수 · 레벨은 각자 기기에 저장 (서버 표 필요 없음)

export const BETS = ['☕ 커피 쏘기', '🍪 간식 쏘기', '🎫 가상 휴가권 (배지)', '🏅 명예만 걸기'];
const HP = 100, FIGHT = 30; // 체력, 제한 시간(초)

// 레벨: 이기면 경험치 30, 지거나 비기면 10. Lv.n 까지 필요한 경험치 = 20 × (n-1)²
export const levelOf = (xp) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 20));

export function createDuel(api) {
  const { $, me, peers, isTouch } = api;
  const st = { active: false, phase: 'idle', id: null, opp: null, oppName: '', bet: '', role: '', t: 0, myHp: HP, oppHp: HP, last: 0, combo: 1, pending: 0, sendAt: 0, sc: 0, referee: false, oppGoneAt: 0 };
  let stats = { xp: 0, win: 0, lose: 0, draw: 0, vacation: 0 };
  try { stats = { ...stats, ...JSON.parse(localStorage.getItem('work-duel') || '{}') }; } catch {}
  const save = () => { try { localStorage.setItem('work-duel', JSON.stringify(stats)); } catch {} };
  let invite = null; // 내가 받은 신청
  let outgoing = null; // 내가 보낸 신청
  let banners = [];

  const send = (e) => api.net()?.sendEvent(e);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 화면 ----------
  function banner(text, sec = 4) {
    const el = $('duelBanner');
    el.textContent = text; el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    banners.push(setTimeout(() => { el.hidden = true; }, sec * 1000));
  }
  function bars(aName, aHp, bName, bHp, t) {
    $('dvA').textContent = aName; $('dvB').textContent = bName;
    $('dvAhp').style.width = `${Math.max(0, aHp)}%`; $('dvBhp').style.width = `${Math.max(0, bHp)}%`;
    $('dvTime').textContent = t > 0 ? Math.ceil(t) : '';
  }
  let watch = null; // 구경 중인 결투 { id, a, b, aHp, bHp, until }

  // ---------- 신청 ----------
  function openInvite(peerId) {
    const p = peers.get(peerId);
    if (!p || st.active) return;
    outgoing = { to: peerId, name: p.name };
    $('dInvName').textContent = p.name;
    $('dBets').innerHTML = BETS.map((b, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'on' : ''}">${b}</button>`).join('') + '<button type="button" data-i="custom">✍️ 직접 쓰기</button>';
    $('dCustom').hidden = true; $('dCustom').value = '';
    $('dBets').querySelectorAll('button').forEach((b) => (b.onclick = () => {
      $('dBets').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      $('dCustom').hidden = b.dataset.i !== 'custom';
      if (b.dataset.i === 'custom') $('dCustom').focus();
    }));
    api.openModal('duelInvite');
  }
  $('dSend').onclick = () => {
    if (!outgoing) return;
    const on = $('dBets').querySelector('button.on');
    const bet = on?.dataset.i === 'custom' ? ($('dCustom').value.trim().slice(0, 30) || '🏅 명예만 걸기') : BETS[+on?.dataset.i || 0];
    const id = `${me.id}-${Date.now().toString(36)}`;
    outgoing = { ...outgoing, id, bet };
    send({ t: 'invite', id, from: me.id, fromName: me.name, to: outgoing.to, bet });
    api.closeModals();
    api.sys(`⚔️ ${outgoing.name}님에게 결투를 신청했어요. (내기: ${bet}) 수락을 기다리는 중…`);
    setTimeout(() => { if (outgoing?.id === id && !st.active) { api.sys(`${outgoing.name}님이 답이 없어요. 결투 신청이 취소됐어요.`); outgoing = null; } }, 25000);
  };
  $('dCancel').onclick = () => { outgoing = null; api.closeModals(); };
  $('dAccept').onclick = () => {
    if (!invite) return;
    send({ t: 'accept', id: invite.id, from: me.id, to: invite.from });
    api.closeModals();
    api.sys('⚔️ 결투를 수락했어요! 곧 4층 결투장으로 이동해요.');
    invite = null;
  };
  $('dDecline').onclick = () => {
    if (invite) send({ t: 'decline', id: invite.id, from: me.id, to: invite.from });
    invite = null; api.closeModals();
  };

  // ---------- 메시지 받기 ----------
  function onEvent(e) {
    if (!e || !e.t) return;
    if (e.t === 'invite' && e.to === me.id) {
      if (st.active || invite) { send({ t: 'decline', id: e.id, from: me.id, to: e.from, busy: 1 }); return; }
      invite = e;
      $('dAskText').innerHTML = `<b>${esc(e.fromName)}</b>님이 결투를 신청했어요!<br>내기: <b>${esc(e.bet)}</b>`;
      api.openModal('duelAsk');
      api.beep(880, 0.15);
      setTimeout(() => { if (invite?.id === e.id) { send({ t: 'decline', id: e.id, from: me.id, to: e.from }); invite = null; api.closeModals(); } }, 20000);
    } else if (e.t === 'decline' && e.to === me.id && outgoing?.id === e.id) {
      api.sys(e.busy ? `${outgoing.name}님은 지금 결투 중이에요.` : `${outgoing.name}님이 결투를 거절했어요.`);
      outgoing = null;
    } else if (e.t === 'accept' && e.to === me.id && outgoing?.id === e.id) {
      // 신청한 사람이 심판: 모두에게 시작을 알림
      const start = { t: 'start', id: e.id, a: me.id, aName: me.name, b: e.from, bName: outgoing.name, bet: outgoing.bet };
      send(start); onEvent(start);
      outgoing = null;
    } else if (e.t === 'start') {
      banner(`⚔️ ${e.aName} vs ${e.bName} 대결이 시작되었습니다! (4층 결투장)`, 4.5);
      api.chatLine(`⚔️ ${e.aName} vs ${e.bName} 대결 시작! 내기: ${e.bet}`);
      if (e.a === me.id || e.b === me.id) begin(e);
      else { watch = { id: e.id, a: e.aName, b: e.bName, aId: e.a, bId: e.b, aHp: HP, bHp: HP, until: performance.now() + (FIGHT + 10) * 1000 }; showBars(true); }
    } else if (e.t === 'hit' && st.active && e.id === st.id && e.to === me.id) {
      st.myHp = Math.max(0, st.myHp - e.dmg);
      api.hurtMe(); api.thump(1.2);
      floatText(`-${e.dmg}`, true);
      send({ t: 'hp', id: st.id, who: me.id, hp: st.myHp });
      if (st.myHp <= 0 && st.phase === 'fight') finish(st.opp);
    } else if (e.t === 'hp') {
      if (st.active && e.id === st.id && e.who === st.opp) st.oppHp = e.hp;
      if (watch && e.id === watch.id) { if (e.who === watch.aId) watch.aHp = e.hp; else watch.bHp = e.hp; }
      api.peerHurt(e.who);
    } else if (e.t === 'end') {
      const wName = e.winner ? (e.winner === me.id ? me.name : e.winnerName) : '';
      banner(e.winner ? `🏆 ${wName} 승리! (내기: ${e.bet})` : `🤝 무승부! (${e.aName} vs ${e.bName})`, 5);
      api.chatLine(e.winner ? `🏆 ${e.aName} vs ${e.bName} — ${wName} 승리! 내기: ${e.bet}` : `🤝 ${e.aName} vs ${e.bName} 무승부`);
      if (st.active && e.id === st.id) result(e);
      if (watch && e.id === watch.id) { watch = null; showBars(false); }
    }
  }

  // ---------- 대결 ----------
  function begin(e) {
    const mineA = e.a === me.id;
    Object.assign(st, { active: true, phase: 'count', id: e.id, opp: mineA ? e.b : e.a, oppName: mineA ? e.bName : e.aName, bet: e.bet, role: mineA ? 'a' : 'b', referee: mineA, t: 3.5, myHp: HP, oppHp: HP, combo: 1, pending: 0, sc: 0, oppGoneAt: 0 });
    invite = null; outgoing = null; api.closeModals();
    api.enterArena(mineA ? -1 : 1);
    $('duelUI').hidden = false; $('dResult').hidden = true; $('dAttack').hidden = false;
    showBars(true);
  }
  function attack() {
    if (!st.active || st.phase !== 'fight') return;
    const now = performance.now() / 1000;
    st.combo = now - st.last < 0.4 ? Math.min(st.combo + 0.1, 2) : 1;
    st.last = now;
    const dmg = Math.max(1, Math.round((0.7 + Math.random() * 0.8) * st.combo));
    st.pending += dmg; st.sc++;
    api.swing(); api.thump(st.combo);
    floatText(`+${dmg}`, false);
  }
  function finish(winnerId) {
    if (st.phase === 'done') return;
    st.phase = 'done';
    const e = { t: 'end', id: st.id, winner: winnerId, winnerName: winnerId === me.id ? me.name : st.oppName, bet: st.bet,
      aName: st.role === 'a' ? me.name : st.oppName, bName: st.role === 'a' ? st.oppName : me.name };
    send(e); onEvent(e);
  }
  function result(e) {
    st.phase = 'done';
    const before = levelOf(stats.xp);
    let msg;
    if (!e.winner) { stats.draw++; stats.xp += 10; msg = '🤝 무승부! 경험치 +10'; }
    else if (e.winner === me.id) {
      stats.win++; stats.xp += 30;
      if (/휴가권/.test(e.bet)) stats.vacation++;
      msg = `🏆 승리! 경험치 +30${/휴가권/.test(e.bet) ? ` · 🎫 가상 휴가권 ${stats.vacation}장` : ''}<br>내기: ${esc(e.bet)} — ${esc(st.oppName)}님이 갚을 차례!`;
    } else { stats.lose++; stats.xp += 10; msg = `😵 패배… 경험치 +10<br>내기: ${esc(e.bet)} — ${esc(st.oppName)}님께!`; }
    save();
    const after = levelOf(stats.xp);
    $('dResText').innerHTML = `${msg}<br><small>전적 ${stats.win}승 ${stats.lose}패 ${stats.draw}무 · Lv.${after}${after > before ? ' 🎉 레벨 업!' : ''}</small>`;
    $('dResult').hidden = false; $('dAttack').hidden = true;
    if (after > before) { api.levelChanged(after); api.beep(784, 0.3); }
  }
  function leave() {
    Object.assign(st, { active: false, phase: 'idle', id: null });
    $('duelUI').hidden = true; showBars(false);
    api.exitArena();
  }
  $('dAttack').addEventListener('pointerdown', (ev) => { ev.preventDefault(); attack(); });
  $('dLeave').onclick = leave;

  function showBars(on) { $('duelBars').hidden = !on; }
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
    const meName = me.name;
    if (st.role === 'a') bars(meName, st.myHp, st.oppName, st.oppHp, st.phase === 'fight' ? st.t : 0);
    else bars(st.oppName, st.oppHp, meName, st.myHp, st.phase === 'fight' ? st.t : 0);
    if (st.phase === 'count') {
      st.t -= dt;
      $('dBig').hidden = false; $('dBig').textContent = st.t > 0.5 ? Math.ceil(st.t - 0.5) : '시작!';
      if (st.t <= 0) { st.phase = 'fight'; st.t = FIGHT; setTimeout(() => { $('dBig').hidden = true; }, 400); api.beep(990, 0.25); }
    } else if (st.phase === 'fight') {
      st.t -= dt;
      // 때린 만큼 0.2초마다 묶어서 보냄 (서버 부담 줄이기)
      if (st.pending > 0 && tnow - st.sendAt > 200) { send({ t: 'hit', id: st.id, from: me.id, to: st.opp, dmg: st.pending }); st.pending = 0; st.sendAt = tnow; api.sendNow(); }
      // 상대가 나가 버리면 5초 뒤 기권승
      if (!peers.has(st.opp)) { st.oppGoneAt ||= tnow; if (tnow - st.oppGoneAt > 5000) finish(me.id); } else st.oppGoneAt = 0;
      // 시간이 다 되면 심판(신청한 사람)이 체력으로 판정
      if (st.t <= 0 && st.referee) finish(st.myHp === st.oppHp ? null : st.myHp > st.oppHp ? me.id : st.opp);
      if (st.t < -3 && !st.referee) finish(st.myHp === st.oppHp ? null : st.myHp > st.oppHp ? me.id : st.opp); // 심판이 답이 없을 때
    }
  }

  return {
    st, stats, onEvent, update, openInvite, attack, leave,
    get active() { return st.active; },
    get fighting() { return st.active && st.phase !== 'done'; },
    get level() { return levelOf(stats.xp); },
    get swings() { return st.sc; },
  };
}
