// 📋 업무 요청: 받는 사람 · 제목 · 내용 · 마감일 → 받은 사람은 요청 → 진행 중 → 완료 로 상태를 바꿈
// 저장: Supabase 'requests' 표 (없으면 이 브라우저 저장소 = 로컬 데모). 알림: 실시간 채널의 이벤트로 바로 전달
import { supa } from './net.js';

const LS = 'work-requests';
const STATUS = ['요청', '진행', '완료'];
const LABEL = { 요청: '요청', 진행: '진행 중', 완료: '완료' };

export function createRequests(api) {
  const { $, me, esc } = api;
  let list = [], tab = 'in', loaded = false, useLocal = !supa, why = supa ? '' : '로컬 데모 모드';

  // ---------- 저장소 ----------
  const localAll = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } };
  const localSave = (a) => { try { localStorage.setItem(LS, JSON.stringify(a.slice(0, 300))); } catch {} };
  async function fetchMine() {
    const name = me.name;
    if (supa) useLocal = false; // 매번 서버부터 다시 시도 (SQL을 나중에 실행해도 새로 고침 없이 연결)
    if (!useLocal) {
      const sel = 'id,from_name,to_name,title,body,due,status,created_at,updated_at';
      const [a, b] = await Promise.all([
        supa.from('requests').select(sel).eq('to_name', name).order('created_at', { ascending: false }).limit(50),
        supa.from('requests').select(sel).eq('from_name', name).order('created_at', { ascending: false }).limit(50),
      ]);
      if (!a.error && !b.error) { why = ''; return [...a.data, ...b.data]; }
      const err = a.error || b.error;
      console.warn('업무 요청 불러오기 실패', err);
      why = [err.code, err.message].filter(Boolean).join(' ').slice(0, 120);
      if (/requests|relation|schema|permission|42P01|42501|PGRST/i.test(why)) useLocal = true; // 표가 없거나 권한 없음 → 이 기기에만
      else return list;
    }
    return localAll().filter((r) => r.to_name === name || r.from_name === name);
  }
  async function insert(r) {
    if (!useLocal) {
      const { data, error } = await supa.from('requests').insert(r).select('id').single();
      if (error) throw error;
      return data.id;
    }
    const all = localAll(); const id = Date.now(); all.unshift({ ...r, id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); localSave(all); return id;
  }
  async function setStatus(id, status) {
    const updated_at = new Date().toISOString();
    if (!useLocal) { const { error } = await supa.from('requests').update({ status, updated_at }).eq('id', id); if (error) throw error; return; }
    const all = localAll(); const r = all.find((x) => x.id === id); if (r) { r.status = status; r.updated_at = updated_at; } localSave(all);
  }

  // ---------- 화면 ----------
  const fmtDue = (d) => { if (!d) return ''; const t = new Date(d + 'T00:00:00'), t0 = new Date(); t0.setHours(0, 0, 0, 0); const left = Math.round((t - t0) / 86400000); return `${t.getMonth() + 1}/${t.getDate()}까지${left < 0 ? ' · 지남' : left === 0 ? ' · 오늘' : left <= 2 ? ` · ${left}일 남음` : ''}`; };
  const fmtTime = (s) => { const d = new Date(s); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function badge() {
    const n = list.filter((r) => r.to_name === me.name && r.status !== '완료').length; // 아직 끝나지 않은 받은 요청
    const b = $('reqBadge'); b.textContent = n; b.hidden = !n;
  }
  function render() {
    document.querySelectorAll('#reqTabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    $('reqForm').hidden = tab !== 'new'; $('reqList').hidden = tab === 'new';
    const inN = list.filter((r) => r.to_name === me.name && r.status !== '완료').length;
    $('reqInN').textContent = inN ? ` ${inN}` : '';
    if (tab === 'new') return;
    const rows = list.filter((r) => (tab === 'in' ? r.to_name === me.name : r.from_name === me.name))
      .sort((a, b) => (a.status === '완료') - (b.status === '완료') || new Date(b.created_at) - new Date(a.created_at));
    $('reqList').innerHTML = rows.length ? rows.map((r) => {
      const who = tab === 'in' ? `${esc(r.from_name)} → 나` : `나 → ${esc(r.to_name)}`;
      const next = tab === 'in' && r.status !== '완료' ? `<button type="button" class="req-next" data-id="${r.id}" data-s="${r.status === '요청' ? '진행' : '완료'}">${r.status === '요청' ? '▶ 시작하기' : '✔ 완료하기'}</button>` : '';
      return `<li class="st-${r.status}"><div class="req-top"><b class="req-st">${LABEL[r.status] || r.status}</b><h3>${esc(r.title)}</h3></div>
        ${r.body ? `<p>${esc(r.body)}</p>` : ''}
        <div class="req-meta"><small>${who} · ${fmtTime(r.created_at)}${r.due ? ` · <em>${fmtDue(r.due)}</em>` : ''}</small>${next}</div></li>`;
    }).join('') : `<p class="sub">${tab === 'in' ? '받은 요청이 없어요.' : '보낸 요청이 없어요.'}</p>`;
    $('reqList').querySelectorAll('.req-next').forEach((b) => (b.onclick = () => advance(+b.dataset.id || b.dataset.id, b.dataset.s)));
  }
  async function refresh() {
    try { list = await fetchMine(); loaded = true; } catch (e) { console.warn(e); }
    badge(); if (!$('reqModal').hidden) render();
    $('reqMode').textContent = useLocal ? `지금은 이 브라우저에만 저장돼요 (Supabase 표 준비 전).${why ? ` [이유: ${why}]` : ''}` : '요청은 회사 서버(Supabase)에 저장돼요. 비밀 업무는 적지 마세요.';
  }
  function open(t = 'in', to = '') {
    tab = t;
    if (to) $('reqTo').value = to;
    const names = [...new Set([...api.onlineNames(), ...list.map((r) => r.from_name), ...list.map((r) => r.to_name)])].filter((n) => n && n !== me.name);
    $('reqNames').innerHTML = names.map((n) => `<option value="${esc(n)}"></option>`).join('');
    render(); api.openModal('reqModal'); refresh();
    if (t === 'new') setTimeout(() => (to ? $('reqTitle') : $('reqTo')).focus(), 50);
  }
  async function advance(id, status) {
    const r = list.find((x) => x.id === id); if (!r) return;
    try { await setStatus(id, status); } catch (e) { alert('상태를 바꾸지 못했어요: ' + (e.message || e)); return; }
    r.status = status; render(); badge();
    api.send({ t: 'req', kind: 'status', to: r.from_name, from: me.name, title: r.title, status });
  }
  document.querySelectorAll('#reqTabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.t; render(); }));
  $('reqForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = $('reqTo').value.trim().slice(0, 16), title = $('reqTitle').value.trim().slice(0, 60), body = $('reqBody').value.trim().slice(0, 500), due = $('reqDue').value || null;
    if (!to || !title) return;
    if (to === me.name) { alert('나에게는 보낼 수 없어요.'); return; }
    const btn = $('reqForm').querySelector('button.primary'); btn.disabled = true;
    try {
      await insert({ from_name: me.name, to_name: to, title, body, due, status: '요청' });
      api.send({ t: 'req', kind: 'new', to, from: me.name, title });
      $('reqTitle').value = ''; $('reqBody').value = ''; $('reqDue').value = ''; $('reqTo').value = '';
      api.sys(`📋 ${to}님에게 업무를 요청했어요: ${title}`);
      tab = 'out'; await refresh(); render();
    } catch (err) { alert('요청을 보내지 못했어요: ' + (err.message || err)); }
    btn.disabled = false;
  });

  // 다른 사람이 보낸 알림 (실시간)
  function onEvent(e) {
    if (!e || e.t !== 'req' || e.to !== me.name) return;
    if (e.kind === 'new') api.toast(`📋 ${e.from}님이 업무를 요청했어요: ${e.title}`);
    else api.toast(`📋 ${e.from}님이 "${e.title}" 요청을 ${e.status === '완료' ? '✔ 완료했어요' : '▶ 시작했어요'}`);
    refresh();
  }
  setInterval(() => { if (!document.hidden && loaded) refresh(); }, 90000); // 접속 안 했을 때 온 요청도 가끔 확인 (부담 적게)
  return { open, refresh, onEvent, get pending() { return list.filter((r) => r.to_name === me.name && r.status !== '완료').length; } };
}
