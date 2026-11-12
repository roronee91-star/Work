// 실시간 접속: Supabase Realtime (설정 시) 또는 같은 브라우저 탭끼리(BroadcastChannel)
import { CONFIG } from './config.js';

export const supa = (CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && window.supabase)
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

  let sendRaw;
  let close;

  if (supa) {
    const channel = supa.channel('work-tower-88f', {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });
    channel
      .on('broadcast', { event: 'state' }, ({ payload }) => { touch(payload.id); handlers.onState(payload); })
      .on('broadcast', { event: 'chat' }, ({ payload }) => handlers.onChat(payload))
      .on('presence', { event: 'leave' }, ({ key }) => { lastSeen.delete(key); handlers.onLeave(key); })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: me.name, color: me.color });
          handlers.onStatus('온라인 · 실시간 연결됨', true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          handlers.onStatus('연결 오류 · 다시 시도 중', false);
        }
      });
    sendRaw = (event, payload) => channel.send({ type: 'broadcast', event, payload });
    close = () => supa.removeChannel(channel);
  } else {
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('work-tower-88f') : null;
    if (bc) {
      bc.onmessage = (e) => {
        const { event, payload } = e.data || {};
        if (event === 'state') { touch(payload.id); handlers.onState(payload); }
        else if (event === 'chat') handlers.onChat(payload);
        else if (event === 'leave') { lastSeen.delete(payload.id); handlers.onLeave(payload.id); }
      };
    }
    sendRaw = (event, payload) => bc?.postMessage({ event, payload });
    close = () => { sendRaw('leave', { id: me.id }); bc?.close(); };
    setTimeout(() => handlers.onStatus('로컬 데모 · 같은 브라우저 탭끼리만 보여요', false), 0);
  }

  // 오래 소식이 없는 접속자 정리
  const sweep = setInterval(() => {
    const now = performance.now();
    for (const [id, t] of lastSeen) {
      if (now - t > 12000) { lastSeen.delete(id); handlers.onLeave(id); }
    }
  }, 3000);

  window.addEventListener('beforeunload', () => { try { close(); } catch {} });

  return {
    sendState(p) { sendRaw('state', p); },
    sendChat(m) { sendRaw('chat', m); },
    close() { clearInterval(sweep); close(); },
  };
}
