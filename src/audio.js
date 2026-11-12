// 효과음(퍽 · 신호음): 파일 없이 브라우저 안에서 만듦. 물소리는 사용자 요청으로 없앰
let ctx = null, muted = false;

export function startAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
}

export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }

// 샌드백 "퍽" 소리 (power 1 ~ 2.5)
export function playThump(power = 1) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140 + power * 20, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.15);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.55 * Math.min(power, 2), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.22);
  // 가죽 치는 잡음
  const len = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = ctx.createBufferSource(); n.buffer = buf;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
  const ng = ctx.createGain(); ng.gain.value = 0.35;
  n.connect(lp); lp.connect(ng); ng.connect(ctx.destination);
  n.start(t);
}
// 짧은 신호음 (카운트다운)
export function playBeep(freq = 660, dur = 0.12) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
