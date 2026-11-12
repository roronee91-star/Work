// 공지 저장소: Supabase 'notices' 테이블 또는 브라우저 저장소
import { CONFIG } from './config.js';
import { supa } from './net.js';

const LS_KEY = 'work-tower-notices';

function localList() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (Array.isArray(saved)) return saved;
  } catch {}
  return CONFIG.defaultNotices.map((n, i) => ({ ...n, id: 'd' + i, created_at: new Date(Date.now() - i * 86400000).toISOString() }));
}

export async function listNotices() {
  if (supa) {
    const { data, error } = await supa.from('notices').select('*').order('created_at', { ascending: false }).limit(20);
    if (!error && data) return data.length ? data : localList();
    console.warn('공지 불러오기 실패', error);
  }
  return localList();
}

export async function addNotice({ title, body, author }) {
  if (supa) {
    const { error } = await supa.from('notices').insert({ title, body, author });
    if (error) throw error;
    return;
  }
  const list = localList();
  list.unshift({ id: 'l' + Date.now(), title, body, author, created_at: new Date().toISOString() });
  try { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 30))); } catch {}
}

export function drawNoticeBoard(canvas, notices) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0d1424'); g.addColorStop(1, '#151b2e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e8d3a0';
  ctx.font = '700 46px "Pretendard","Noto Sans KR",sans-serif';
  ctx.fillText('공지사항', 48, 76);
  ctx.fillStyle = '#7f8aa3';
  ctx.font = '400 26px sans-serif';
  ctx.fillText(CONFIG.companyName + ' NOTICE BOARD', 270, 74);
  ctx.fillStyle = 'rgba(232,211,160,0.4)';
  ctx.fillRect(48, 100, w - 96, 2);
  notices.slice(0, 4).forEach((n, i) => {
    const y = 160 + i * 100;
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 34px "Pretendard","Noto Sans KR",sans-serif';
    ctx.fillText(clip(ctx, n.title, w - 300), 48, y);
    ctx.fillStyle = '#9aa6bf';
    ctx.font = '400 26px "Pretendard","Noto Sans KR",sans-serif';
    ctx.fillText(clip(ctx, n.body || '', w - 120), 48, y + 40);
    ctx.fillStyle = '#6b7690';
    ctx.font = '400 24px sans-serif';
    const d = n.created_at ? new Date(n.created_at) : null;
    ctx.textAlign = 'right';
    ctx.fillText(d ? `${d.getMonth() + 1}/${d.getDate()}` : '', w - 48, y);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#e8d3a0';
  ctx.font = '500 24px sans-serif';
  ctx.fillText('가까이 와서 E 키 (휴대폰: 공지 버튼)로 전체 보기', 48, h - 28);
}

function clip(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
