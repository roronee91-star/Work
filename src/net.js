// 실시간 접속: Supabase Realtime (설정 시) 또는 같은 브라우저 탭끼리(BroadcastChannel)
import { CONFIG } from './config.js';

// siteHost가 정해져 있으면 그 주소에서 열 때만 Supabase에 연결 (복사해 간 사이트는 로컬 데모 모드)
const hostOk = !CONFIG.siteHost || location.hostname === CONFIG.siteHost;
export const supa = (hostOk && CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && window.supabase)
  ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey)
  : null;

export function makeId() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).slice(0, 12);
}

/**
 * handlers: { onState(p), onChat(m), onLeave(id), onStatus(text, online) }
 */
export function connect(me, handlers) {
  const lastSeen = new Map();
  const touch = (id) => lastSeen.set(id, performance.now());
  // handlers.onSync(): 누가 "다들 위치 알려줘" 하면 내 상태를 바로 보냄
  let sendRaw = () => {};
  let close = () => {};
  let reconnect = () => {};

  if (supa) {
    let channel = null;
    const open = () => {
      if (channel) { try { supa.removeChannel(channel); } catch {} }
      channel = supa.channel('work-tower-88f', {
        config: { broadcast: { self: false }, presence: { key: me.id } },
      });
      channel
        .on('broadcast', { event: 'state' }, ({ payload }) => { touch(payload.id); handlers.onState(payload); })
        .on('broadcast', { event: 'chat' }, ({ payload }) => handlers.onChat(payload))
        .on('broadcast', { event: 'sync' }, () => handlers.onSync?.())
        .on('broadcast', { event: 'ev' }, ({ payload }) => handlers.onEvent?.(payload))
        .on('presence', { event: 'join' }, () => handlers.onSync?.())
        // 잠깐 끊겼다 돌아오는 경우가 많아서, 나갔다는 신호만으로 바로 지우지 않음 (아래 정리에서 판단)
        .on('presence', { event: 'leave' }, ({ key }) => { const t = lastSeen.get(key); if (t) lastSeen.set(key, Math.min(t, performance.now() - 50000)); })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ name: me.name, color: me.color });
            handlers.onStatus('온라인 · 실시간 연결됨', true);
            channel.send({ type: 'broadcast', event: 'sync', payload: { id: me.id } });
            handlers.onSync?.();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            handlers.onStatus('연결 오류 · 다시 시도 중', false);
          }
        });
    };
    open();
    sendRaw = (event, payload) => channel?.send({ type: 'broadcast', event, payload });
    close = () => { try { supa.removeChannel(channel); } catch {} };
    // 탭을 다녀오면 연결 상태를 확인하고, 끊겼으면 다시 연결
    reconnect = () => {
      const st = channel?.state;
      if (st !== 'joined') open();
      else { sendRaw('sync', { id: me.id }); handlers.onSync?.(); }
    };
  } else {
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('work-tower-88f') : null;
    if (bc) {
      bc.onmessage = (e) => {
        const { event, payload } = e.data || {};
        if (event === 'state') { touch(payload.id); handlers.onState(payload); }
        else if (event === 'chat') handlers.onChat(payload);
        else if (event === 'sync') handlers.onSync?.();
        else if (event === 'ev') handlers.onEvent?.(payload);
        else if (event === 'leave') { lastSeen.delete(payload.id); handlers.onLeave(payload.id); }
      };
    }
    sendRaw = (event, payload) => bc?.postMessage({ event, payload });
    close = () => { sendRaw('leave', { id: me.id }); bc?.close(); };
    reconnect = () => { sendRaw('sync', { id: me.id }); handlers.onSync?.(); };
    setTimeout(() => { handlers.onStatus('로컬 데모 · 같은 브라우저 탭끼리만 보여요', false); sendRaw('sync', { id: me.id }); }, 0);
  }

  // 오래(1분) 소식이 없는 접속자만 정리 — 다른 탭에 잠깐 다녀와도 사라지지 않게
  let hiddenAt = 0;
  const sweep = setInterval(() => {
    if (document.hidden) return; // 내가 안 보는 동안은 정리하지 않음
    const now = performance.now();
    for (const [id, t] of lastSeen) {
      if (now - t > 60000) { lastSeen.delete(id); handlers.onLeave(id); }
    }
  }, 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = performance.now(); return; }
    // 돌아오면: 다른 사람들의 마지막 시각을 지금으로 미루고, 다시 연결 · 서로 위치 다시 알림
    const now = performance.now();
    for (const id of lastSeen.keys()) lastSeen.set(id, Math.max(lastSeen.get(id), now - 20000));
    void hiddenAt;
    reconnect();
  });
  addEventListener('online', () => reconnect());

  window.addEventListener('pagehide', () => { try { close(); } catch {} });

  return {
    sendState(p) { sendRaw('state', p); },
    sendChat(m) { sendRaw('chat', m); },
    sendEvent(e) { sendRaw('ev', e); }, // 결투 같은 놀이용 알림
    close() { clearInterval(sweep); close(); },
  };
}
