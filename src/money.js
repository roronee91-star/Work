// 💰 월급 · 지갑 · 💹 투자 (모두 게임 속 가상 돈)
// - 사옥에 접속해 있는 시간만큼 시급(2026년 최저임금 10,320원)으로 일급이 쌓임 (다른 탭에 가 있어도 셈, 하루 최대 12시간)
// - 일급은 일하는 대로 바로 지갑 현금으로 들어옴 (예전에 25일 월급으로 쌓여 있던 돈도 들어오면 바로 지급)
// - 3층 투자 상담실: 가상 주식 4종목(가격이 1시간마다 바뀜, 모두 같은 가격) · 적금(하루 0.1% 이자)
// 저장: Supabase 'wallets' 표 (없으면 이 브라우저에만)
import { supa } from './net.js';

export const WAGE = 10320;            // 원/시간 (2026년 최저임금) — 기본 시급
// 11-25 사용자 요청: 2층 업무 자리에서 일하면 2배, 일하지 않으면(자리에 앉아 일하는 중이 아니면) 1/2
export const RATE = { desk2: 2, idle: 1 }; // 11-25: '일하기' 중이면 2배 이벤트 — 11-26 종료(main.js WORK_BONUS), 지금은 api.rate()가 늘 1
const MAX_SECS = 12 * 3600;            // 하루 최대 12시간
const PAYDAY = 25;
const WELCOME = 100000;                // 입사 축하금 (처음 한 번)
const SAV_RATE = 0.001;                // 적금 하루 이자 0.1%
const LS = 'work-wallet';

// 가상 회사 (실제 회사와 관계없음)
export const STOCKS = [
  { code: 'WRK', name: '워크전자', base: 52000, vol: 0.012, vol2: 0.03, color: '#4f8cff' },
  { code: 'HGB', name: '한강바이오', base: 18000, vol: 0.026, vol2: 0.06, color: '#3ecf8e' },
  { code: 'GRM', name: '구름게임즈', base: 34000, vol: 0.018, vol2: 0.045, color: '#b47cff' },
  { code: 'BYF', name: '별빛푸드', base: 9800, vol: 0.008, vol2: 0.02, color: '#ffb547' },
];
// 가격: 2026-11-01부터 1시간마다 정해진 규칙(씨앗 난수)으로 오르내림 → 서버 없이도 모두 같은 가격
const EPOCH = Date.UTC(2026, 10, 1) / 3600000;
// 11-26 사용자 요청 '변동 폭을 키우자': 11/26 11:00(한국)부터는 vol2(한 시간 최대 ±2~6%). 그 전 가격은 그대로라 이미 산 주식 값이 갑자기 튀지 않음
const BIG_FROM = Date.UTC(2026, 10, 26, 2) / 3600000 - EPOCH;
function rnd(seed) { let t = (seed + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const series = new Map(); // code → [시간별 가격]
// 🛡 11-26 서버 모드: 주가는 서버가 매시간 정함(security.sql) → 지난 48시간만 받아 옴, 미래는 알 수 없음
let SP = null;
function priceAt(st, h) {
  const sa = SP?.prices?.[st.code];
  if (sa?.length) return sa[Math.max(0, Math.min(sa.length - 1, sa.length - 1 - (SP.h - h)))];
  let arr = series.get(st.code);
  if (!arr) { arr = [st.base]; series.set(st.code, arr); }
  const salt = st.code.charCodeAt(0) * 7919 + st.code.charCodeAt(2) * 131;
  while (arr.length <= h) {
    const p = arr[arr.length - 1], i = arr.length;
    const v = i >= BIG_FROM && st.vol2 ? st.vol2 : st.vol;
    const r = (rnd(i * 2654435761 + salt) * 2 - 1) * v + 0.12 * v * Math.log(st.base / p) + 0.0001; // 기준가 쪽으로 살짝 돌아옴
    arr.push(Math.max(st.base * 0.2, p * (1 + r)));
  }
  return arr[Math.max(0, h)];
}
const hourNow = () => Math.max(0, Math.floor(Date.now() / 3600000 - EPOCH));
export const price = (st, h = hourNow()) => Math.round(priceAt(st, h) / 10) * 10;

const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const month = () => today().slice(0, 7);
const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const hms = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const hm = (s) => `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;

export function createMoney(api) {
  const { $, me } = api;
  let w = null, owner = '', dirty = false, useLocal = !supa, tab = 'stock';
  // 🛡 서버 모드: Supabase에 security.sql을 실행했으면 돈은 서버 함수로만 바뀜 (사이트는 화면만 먼저 바꾸고, 서버가 돌려준 값으로 맞춤)
  let server = false, lastTickCall = 0, lastPriceFetch = 0;
  const KEYS_LS = 'work-keys';
  const keys = () => { try { return JSON.parse(localStorage.getItem(KEYS_LS) || '{}'); } catch { return {}; } };
  function keyFor(name) {
    const m = keys();
    if (!m[name]) { const a = new Uint8Array(14); crypto.getRandomValues(a); m[name] = [...a].map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''); try { localStorage.setItem(KEYS_LS, JSON.stringify(m)); } catch {} }
    return m[name];
  }
  function setKey(name, k) { const m = keys(); m[name] = k; try { localStorage.setItem(KEYS_LS, JSON.stringify(m)); } catch {} }
  function fromRow(row) {
    const x = { ...blank(), ...pick(row) };
    x.cash = +x.cash || 0; x.unpaid = 0; x.savings = +x.savings || 0; x.day_secs = +x.day_secs || 0; x.stocks = x.stocks || {};
    x.stocks.__daypay = [x.day, +row.day_pay || 0];
    return x;
  }
  function apply(row) {
    if (!row || !owner || row.name !== owner) return;
    w = fromRow(row); chip();
    if (!$('walletModal').hidden) renderWallet();
    if (!$('investModal').hidden) renderInvest();
  }
  const rpc = async (fn, args = {}) => { const { data, error } = await supa.rpc(fn, { p_name: owner, p_key: keyFor(owner), ...args }); if (error) throw error; return data; };
  const sv = (fn, args, done) => rpc(fn, args).then((row) => { apply(row); done?.(true); }).catch((e) => {
    console.warn(fn, e.message); done?.(false);
    if (/no_cash/.test(e.message)) api.toast?.('💸 서버 확인 결과 돈이 모자라요.');
    rpc('wallet_get').then(apply).catch(() => {}); // 화면을 서버 값으로 되돌림
  });
  async function fetchPrices() {
    if (!server) return; lastPriceFetch = Date.now();
    const { data, error } = await supa.rpc('stock_prices_now');
    if (!error && data?.prices) { SP = data; drawBoard(); if (!$('investModal').hidden) renderInvest(); }
  }
  const blank = () => ({ cash: WELCOME, unpaid: 0, day: today(), day_secs: 0, paid_month: new Date().getDate() >= PAYDAY ? month() : '', savings: 0, sav_day: today(), stocks: {} });
  const KEYS = ['cash', 'unpaid', 'day', 'day_secs', 'paid_month', 'savings', 'sav_day', 'stocks'];
  const pick = (o) => Object.fromEntries(KEYS.map((k) => [k, o[k]]));

  const localAll = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  function save() {
    if (!w || !owner) return;
    dirty = false;
    if (server) return; // 서버 모드: 바뀔 때마다 서버 함수가 저장함
    const all = localAll(); all[owner] = pick(w); try { localStorage.setItem(LS, JSON.stringify(all)); } catch {}
    if (!useLocal) supa.from('wallets').upsert({ name: owner, ...pick(w), day_secs: Math.floor(w.day_secs), updated_at: new Date().toISOString() }, { onConflict: 'name' })
      .then(({ error }) => { if (error) { console.warn('지갑 저장 실패', error.message); if (/wallets|relation|schema|permission|42P01|42501|PGRST/i.test(error.message + (error.code || ''))) useLocal = true; } });
  }

  // 날짜가 바뀌었는지 · 월급날인지 · 적금 이자 확인 → 알릴 말 목록
  function settle() {
    const notes = [];
    const t = today();
    if (w.day !== t) { if (w.day_secs > 0) notes.push(`📅 지난 근무일(${w.day.slice(5).replace('-', '/')}) 일급 ${won(dayPay())}을 받았어요.`); w.day = t; w.day_secs = 0; }
    // 예전 '25일 월급'으로 쌓여 있던 급여는 바로 지갑으로 (이제는 일급이 일하는 대로 바로 들어옴)
    if (w.unpaid >= 1) { notes.push(`💸 그동안 쌓여 있던 급여 ${won(w.unpaid)}이 지갑에 들어왔어요! 이제 일급은 일하는 대로 바로 들어와요.`); w.cash += w.unpaid; w.unpaid = 0; }
    const days = dayDiff(w.sav_day || t, t);
    if (days > 0) { const before = w.savings; w.savings = w.savings * Math.pow(1 + SAV_RATE, days); w.sav_day = t; if (w.savings - before >= 1) notes.push(`🏦 적금 이자 ${won(w.savings - before)}이 붙었어요.`); }
    if (notes.length) dirty = true;
    return notes;
  }

  // 📦 서버 지갑으로 바뀌기 전 이 브라우저에 있던 지갑을 한 번만 옮김(서버가 상한 300만 원 · 진짜 상품만 받아 줌)
  function importOld(name, row) {
    if (!row || row.imported) return;
    const old = localAll()[name];
    if (!old) return; /* 새로 온 사람은 옮길 것 없음 */
    const st = old.stocks || {};
    const sv = STOCKS.reduce((s, x) => s + (st[x.code]?.q || 0) * price(x), 0);
    rpc('wallet_import', { p_cash: (+old.cash || 0) + (+old.unpaid || 0) + sv, p_savings: +old.savings || 0, p_items: st.__items || [], p_wear: st.__wear || {}, p_xmas: st.__xmas || [] })
      .then((r) => { apply(r); api.toast?.('📦 이 기기에 있던 지갑과 아이템을 옮겨 왔어요.'); }).catch(() => {});
  }
  async function load(name) {
    owner = name; w = null;
    if (supa && !useLocal) {
      for (let tries = 0; tries < 3; tries++) {
        const { data, error } = await supa.rpc('wallet_get', { p_name: name, p_key: keyFor(name) });
        if (owner !== name) return [];
        if (!error) { server = true; w = fromRow(data); chip(); importOld(name, data); fetchPrices(); rpc('wallet_tick').then(apply).catch(() => {}); lastTickCall = Date.now(); return []; }
        if (!/not_owner/.test(error.message)) { if (/function|PGRST202|404/i.test(error.message + error.code)) break; console.warn('지갑 불러오기 실패', error.message); break; }
        server = true;
        const code = prompt(`💳 "${name}" 지갑은 다른 기기에 연결돼 있어요.\n\n그 기기에서 👛 지갑 → [📱 다른 기기에서도 쓰기]를 누르면 나오는 12자리 연결 코드를 입력하세요.\n(다른 분이라면 [취소]를 누르고 👤 내 캐릭터에서 이름을 바꿔 주세요)`);
        if (!code || !code.trim()) { api.toast?.('💳 지갑을 쓰려면 연결 코드를 입력하거나 이름을 바꿔 주세요.'); return []; }
        setKey(name, code.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));
      }
      if (server) return [];
    }
    let row = null;
    if (!useLocal) {
      const { data, error } = await supa.from('wallets').select('*').eq('name', name).maybeSingle();
      if (error) { console.warn('지갑 불러오기 실패', error.message); useLocal = true; } else row = data;
    }
    if (!row) row = localAll()[name] || null;
    const fresh = !row;
    w = { ...blank(), ...(row ? pick(row) : {}) };
    w.cash = +w.cash || 0; w.unpaid = +w.unpaid || 0; w.savings = +w.savings || 0; w.day_secs = +w.day_secs || 0; w.stocks = w.stocks || {};
    const notes = settle();
    if (fresh) notes.unshift(`🎉 입사 축하금 ${won(WELCOME)}이 지갑에 들어왔어요! (게임 속 가상 돈)`);
    save();
    chip();
    return notes;
  }
  // 입구에서 보여 줄 오늘의 일급
  const greeting = () => w ? `💰 오늘 근무 ${hm(w.day_secs)} · 오늘의 일급 ${won(dayPay())} (시급 ${won(WAGE * (api.rate?.() ?? 1))}, 일하는 대로 지갑에 바로 들어와요) · 지갑 ${won(w.cash)}` : '';
  // 오늘 일급: 시급이 일하는 방식에 따라 달라서 실제로 받은 돈을 지갑(stocks.__daypay = [날짜, 금액])에 따로 적어 둠
  const dayPay = () => { const d = w.stocks?.__daypay; return d && d[0] === w.day ? d[1] : Math.min(w.day_secs, MAX_SECS) / 3600 * WAGE; };

  // 1초마다: 화면이 켜져 있고 사옥 안에 있으면 근무 시간 +1초
  // 실제 지난 시간(시계)으로 더함 → 다른 탭에 다녀와도(화면이 숨어 타이머가 느려져도) 멈추지 않고 이어짐
  // 단, 컴퓨터가 잠자기했던 것처럼 한 번에 5분 넘게 비면 그 사이는 빼고 셈
  let tick = 0, last = Date.now();
  setInterval(() => {
    const t = Date.now(), gap = (t - last) / 1000; last = t;
    if (server && w && t - lastPriceFetch > 30000 && (!SP || hourNow() > SP.h)) fetchPrices();
    if (!w || !api.atWork()) return;
    if (server) { if (t - lastTickCall > 55000) { lastTickCall = t; sv('wallet_tick'); } } // 일급은 서버 시계로 (화면은 아래에서 미리 더해 보여 줌)
    else { const notes = settle(); notes.forEach((n) => api.toast(n)); }
    const add = Math.min(gap > 300 ? 0 : gap, MAX_SECS - w.day_secs);
    if (add > 0) {
      const rate = api.rate?.() ?? 1; // 지금 하는 일에 따라 2배 · 1배 · 0.5배
      w.day_secs += add; w.stocks.__daypay = [w.day, dayPay() + (WAGE / 3600) * add * rate]; w.cash += (WAGE / 3600) * add * rate; dirty = true; // 일급: 일한 만큼 바로 지갑으로
      if (w.day_secs >= MAX_SECS) api.toast(`⏰ 오늘 근무 12시간을 채웠어요! 오늘 일급은 ${won(dayPay())}이에요. 푹 쉬세요 😊`);
    }
    if (document.hidden) { if (dirty && ++tick % 2 === 0) save(); return; }
    chip();
    if (!$('walletModal').hidden) renderWallet();
    if (++tick % 60 === 0 && dirty) save();
    if (tick % 60 === 0) drawBoard();
  }, 1000);
  addEventListener('visibilitychange', () => { if (document.hidden && dirty) save(); });
  addEventListener('pagehide', () => { if (dirty) save(); });

  function chip() { if (!w) return; const r = api.rate?.() ?? 1; $('workChip').innerHTML = `⏱ <b>${hms(Math.min(w.day_secs, MAX_SECS))}</b> · ${won(dayPay())}${r !== 1 ? ` <i class="rate r${String(r).replace('.', '')}">×${r}</i>` : ''}`; } // 배수는 이벤트 중일 때만

  // ---------- 지갑 ----------
  const stockValue = () => STOCKS.reduce((s, st) => s + (w.stocks[st.code]?.q || 0) * price(st), 0);
  const stockCost = () => STOCKS.reduce((s, st) => s + (w.stocks[st.code]?.q || 0) * (w.stocks[st.code]?.c || 0), 0);
  function renderWallet() {
    if (!w) return;
    const sv = stockValue(), pl = sv - stockCost(), d = new Date();
    $('walletBody').innerHTML = `
      <div class="wal-big"><small>지갑 (현금)</small><b>${won(w.cash)}</b></div>
      <dl class="wal">
        <dt>⏱ 오늘 근무</dt><dd>${hms(Math.min(w.day_secs, MAX_SECS))} <small>(최대 12시간)</small></dd>
        <dt>💵 오늘의 일급</dt><dd>${won(dayPay())}</dd>
        <dt>🏦 적금</dt><dd>${won(w.savings)}</dd>
        <dt>📈 주식 평가액</dt><dd>${won(sv)} ${sv ? `<small class="${pl >= 0 ? 'up' : 'down'}">${pl >= 0 ? '+' : ''}${won(pl)}</small>` : ''}</dd>
        <dt>💎 총 자산</dt><dd><b>${won(w.cash + w.savings + sv)}</b></dd>
      </dl>
      <button type="button" class="link" id="walletItems" style="display:block;margin:4px 0 10px">👜 내 아이템 보기 · 착용하기</button>
      ${server ? '<button type="button" class="link" id="walletLink" style="display:block;margin:0 0 10px">📱 다른 기기에서도 쓰기 (기기 연결 코드)</button>' : ''}
      <p class="sub">시급 <b>${won(WAGE * (api.rate?.() ?? 1))}</b> · 사옥에 접속해 있는 동안 세요(다른 탭에 가 있어도 OK) · 일급은 일하는 대로 <b>바로 지갑</b>에 들어와요.<br>투자는 3층 <b>💹 투자 상담실</b>에서 할 수 있어요. 모두 게임 속 가상 돈이에요.</p>`;
  }
  function openWallet() { if (!w) return; renderWallet(); api.openModal('walletModal'); }
  document.addEventListener('click', async (e) => {
    if (e.target?.id === 'walletItems') api.openItems?.();
    if (e.target?.id === 'walletLink') { const c = await linkCode(); if (c) prompt('📱 다른 기기에서 같은 이름으로 들어가면 코드를 물어봐요. 이 코드를 입력하세요. (한 번만 쓰면 그 기기도 계속 쓸 수 있어요)', c); }
  });

  // ---------- 투자 ----------
  function spark(st) {
    const h = hourNow(), pts = []; for (let i = 47; i >= 0; i--) pts.push(priceAt(st, h - i));
    const lo = Math.min(...pts), hi = Math.max(...pts), W = 90, H = 28;
    const d = pts.map((p, i) => `${(i / 47) * W},${H - ((p - lo) / (hi - lo || 1)) * H}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${d}" fill="none" stroke="${pts[47] >= pts[0] ? '#ff6b6b' : '#4f8cff'}" stroke-width="1.6"/></svg>`;
  }
  const chg = (st) => { const h = hourNow(), a = price(st, h - 24), b = price(st, h); return (b - a) / a * 100; };
  function renderInvest() {
    if (!w) return;
    document.querySelectorAll('#invTabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    $('invCash').innerHTML = `지갑 현금 <b>${won(w.cash)}</b>`;
    if (tab === 'stock') {
      $('invBody').innerHTML = STOCKS.map((st) => {
        const p = price(st), c = chg(st), h = w.stocks[st.code] || { q: 0, c: 0 }, pl = h.q ? (p - h.c) * h.q : 0;
        return `<li><div class="inv-top"><i style="background:${st.color}"></i><b>${st.name}</b>${spark(st)}<span class="inv-p">${won(p)}<small class="${c >= 0 ? 'up' : 'down'}">${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(1)}%</small></span></div>
          <div class="inv-row"><small>${h.q ? `${h.q}주 보유 · 평균 ${won(h.c)} · <span class="${pl >= 0 ? 'up' : 'down'}">${pl >= 0 ? '+' : ''}${won(pl)}</span>` : '보유 없음'}</small>
          <span class="inv-act"><input type="number" min="1" value="1" inputmode="numeric" data-q="${st.code}"><button data-buy="${st.code}">사기</button><button data-sell="${st.code}" ${h.q ? '' : 'disabled'}>팔기</button></span></div></li>`;
      }).join('') + `<p class="sub">가격은 1시간마다 바뀌어요(▲빨강 오름 · ▼파랑 내림, 24시간 전과 비교). 가상 회사라 실제 주식과는 관계없어요.</p>`;
      $('invBody').querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => trade(b.dataset.buy, +1)));
      $('invBody').querySelectorAll('[data-sell]').forEach((b) => (b.onclick = () => trade(b.dataset.sell, -1)));
    } else {
      $('invBody').innerHTML = `<li class="sav"><div class="wal-big"><small>🏦 적금 잔액</small><b>${won(w.savings)}</b></div>
        <p class="sub">하루에 <b>0.1%</b>씩 이자가 붙어요 (복리). 언제든 뺄 수 있어요.</p>
        <div class="inv-act wide"><input type="number" min="1000" step="1000" value="10000" inputmode="numeric" id="savAmt"><button id="savIn">넣기</button><button id="savOut" ${w.savings >= 1 ? '' : 'disabled'}>빼기</button><button id="savAll" class="link">전부</button></div></li>`;
      $('savIn').onclick = () => saving(+1); $('savOut').onclick = () => saving(-1);
      $('savAll').onclick = () => { $('savAmt').value = Math.floor(Math.max(w.cash, w.savings)); };
    }
  }
  function trade(code, dir) {
    const st = STOCKS.find((s) => s.code === code), p = price(st);
    let q = Math.floor(+$('invBody').querySelector(`[data-q="${code}"]`).value || 0);
    const h = w.stocks[code] || { q: 0, c: 0 };
    if (q < 1) return;
    if (dir > 0) {
      if (q * p > w.cash) { q = Math.floor(w.cash / p); if (q < 1) { alert(`현금이 모자라요. (1주 ${won(p)})`); return; } if (!confirm(`현금이 모자라서 ${q}주만 살 수 있어요. 살까요?`)) return; }
      w.cash -= q * p; h.c = (h.c * h.q + p * q) / (h.q + q); h.q += q;
      api.sys(`📈 ${st.name} ${q}주를 ${won(q * p)}에 샀어요.`);
    } else {
      q = Math.min(q, h.q); if (q < 1) return;
      w.cash += q * p; h.q -= q; if (!h.q) h.c = 0;
      api.sys(`📉 ${st.name} ${q}주를 ${won(q * p)}에 팔았어요.`);
    }
    w.stocks[code] = h; if (!h.q) delete w.stocks[code];
    if (server) sv('stock_trade', { p_code: code, p_qty: dir > 0 ? q : -q });
    save(); renderInvest(); chip();
  }
  function saving(dir) {
    let a = Math.floor(+$('savAmt').value || 0); if (a < 1) return;
    if (dir > 0) { a = Math.min(a, Math.floor(w.cash)); if (a < 1) { alert('지갑에 현금이 없어요.'); return; } w.cash -= a; w.savings += a; api.sys(`🏦 적금에 ${won(a)}을 넣었어요.`); }
    else { a = Math.min(a, Math.floor(w.savings)); if (a < 1) return; w.savings -= a; w.cash += a; api.sys(`🏦 적금에서 ${won(a)}을 뺐어요.`); }
    if (server) sv('saving_move', { p_amount: dir > 0 ? a : -a });
    save(); renderInvest();
  }
  function openInvest() { if (!w) return; renderInvest(); api.openModal('investModal'); }
  document.querySelectorAll('#invTabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.t; renderInvest(); }));

  // 3층 시세 전광판
  function drawBoard() {
    const B = api.board; if (!B?.canvas) return;
    const ctx = B.canvas.getContext('2d'), W = B.canvas.width, H = B.canvas.height;
    ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e8d3a0'; ctx.font = '700 46px "Pretendard","Noto Sans KR",sans-serif'; ctx.fillText('오늘의 시세', 40, 70);
    const d = new Date(); ctx.fillStyle = '#7d8aa3'; ctx.font = '400 26px "Pretendard","Noto Sans KR",sans-serif';
    ctx.fillText(`${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00 기준 · 1시간마다 바뀜`, 330, 68);
    STOCKS.forEach((st, i) => {
      const y = 140 + i * 105, p = price(st), c = chg(st), up = c >= 0;
      ctx.fillStyle = st.color; ctx.fillRect(40, y - 34, 12, 48);
      ctx.fillStyle = '#fff'; ctx.font = '700 42px "Pretendard","Noto Sans KR",sans-serif'; ctx.fillText(st.name, 70, y + 4);
      ctx.textAlign = 'right'; ctx.fillText(p.toLocaleString('ko-KR'), 760, y + 4);
      ctx.fillStyle = up ? '#ff6b6b' : '#5b8cff'; ctx.fillText(`${up ? '▲' : '▼'} ${Math.abs(c).toFixed(1)}%`, 980, y + 4); ctx.textAlign = 'left';
      // 작은 그래프
      const h = hourNow(), pts = []; for (let k = 23; k >= 0; k--) pts.push(priceAt(st, h - k));
      const lo = Math.min(...pts), hi = Math.max(...pts);
      ctx.strokeStyle = up ? 'rgba(255,107,107,.7)' : 'rgba(91,140,255,.7)'; ctx.lineWidth = 3; ctx.beginPath();
      pts.forEach((v, k) => { const x = 330 + k * 9, yy = y + 6 - ((v - lo) / (hi - lo || 1)) * 40; k ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }); ctx.stroke();
    });
    B.texture.needsUpdate = true;
  }
  drawBoard();

  // 👜 상점 아이템 (따로 표를 만들지 않으려고 stocks 안에 __items · __wear로 보관)
  const items = () => (w?.stocks?.__items || []);
  const wear = () => (w?.stocks?.__wear || {});
  function buy(id) { // 🛡 11-26: 가격은 부르는 쪽이 아니라 상품 목록(api.priceOf)에서 직접 찾음 → buy('diacrown', 0) 같은 0원 구매 막음
    const price = api.priceOf?.(id);
    if (!w || !(price > 0) || w.cash < price || items().includes(id)) return false;
    w.cash -= price; w.stocks.__items = [...items(), id]; if (server) sv('shop_buy', { p_id: id }); save(); chip(); return true;
  }
  // ⚔️ 결투 판돈
  function spend(n) { if (!w || n <= 0 || w.cash < n) return false; w.cash -= n; save(); chip(); return true; }
  function earn(n) { if (!w || n <= 0 || server) return; w.cash += n; save(); chip(); } // 서버 모드에선 아래 reward · duelReport로만
  // 눈싸움 · 레이스 상금: 서버가 한 번 · 하루 상한을 확인
  function reward(kind, n) { if (!w || n <= 0) return; if (!server) { earn(n); return; } w.cash += n; chip(); sv('wallet_reward', { p_kind: kind, p_amount: n }); }
  // ⚔️ 판돈: 서버가 보관 → 두 사람 결과가 맞을 때만 이긴 쪽에 2배
  // 🛡 opp: 고른 상대 이름 → 서버는 서로 고른 두 사람일 때만 정산(남이 끼어들어 판돈을 가로채지 못하게)
  function stake(id, n, opp) { if (!w || n <= 0 || w.cash < n) return false; w.cash -= n; if (server) sv('duel_stake', { p_duel: id, p_amount: n, p_opp: opp || null }); else save(); chip(); return true; }
  function duelReport(id, result, bet) {
    if (!server) { if (result === 'win') earn(bet * 2); else if (result === 'draw') earn(bet); return; }
    sv('duel_report', { p_duel: id, p_result: result });
    for (const ms of [4000, 15000, 200000]) setTimeout(() => rpc('wallet_get').then(apply).catch(() => {}), ms); // 상대 결과가 오면 서버가 정산
  }
  // 📱 기기 연결 코드 (서버 모드)
  async function linkCode() { try { return await rpc('wallet_link_code'); } catch (e) { alert('코드를 만들지 못했어요: ' + e.message); return null; } }
  // 🎄 출석 (서버 모드): 오늘 도장 + 조건 채운 선물을 서버가 줌
  async function adventCheckin() {
    const beforeDays = xmasDays(), beforeItems = items();
    const row = await rpc('advent_checkin'); apply(row);
    return { stamped: xmasDays().length > beforeDays.length, got: items().filter((id) => !beforeItems.includes(id)) };
  }
  function setWear(slot, id) { if (!w) return; const v = { ...wear() }; if (id) v[slot] = id; else delete v[slot]; w.stocks.__wear = v; if (server) sv('wallet_wear', { p_slot: slot, p_id: id || '' }); save(); }
  // 🎄 크리스마스 출석 (stocks 안에 __xmas = ['2026-11-24', ...]) · 출석 선물은 돈 없이 지급
  const xmasDays = () => (w?.stocks?.__xmas || []);
  function stampDay(day) { if (!w || xmasDays().includes(day)) return false; w.stocks.__xmas = [...xmasDays(), day]; save(); return true; }
  // 🛡 출석 조건을 채운 선물만 (api.canGrant)
  function grant(id) { if (!w || items().includes(id) || !api.canGrant?.(id)) return false; w.stocks.__items = [...items(), id]; save(); return true; }
  return { reward, stake, duelReport, linkCode, keyFor, adventCheckin, get server() { return server; }, xmasDays, stampDay, grant, today, items, wear, buy, setWear, spend, earn, cash: () => (w ? w.cash : 0), load, greeting, openWallet, openInvest, save, get ready() { return !!w; }, get mode() { return useLocal ? 'local' : 'server'; } };
}
