// 물소리: 음악 파일 없이 브라우저 안에서 만듦 (네트워크·서버 부담 없음)
let ctx = null, master = null, muted = false;

// 계곡 물소리: "쏴아" 잡음 대신, 작은 물방울이 퐁·졸졸 터지는 소리를 많이 겹치고
// 아래에 아주 낮고 부드러운 흐름 소리만 살짝 깔아 줌
export function buildBrook(ac, dest) {
  // 1) 바닥에 깔리는 낮은 흐름 (고음을 깎은 부드러운 잡음)
  const len = ac.sampleRate * 4;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.5;
  const bg = ac.createGain(); bg.gain.value = 0.2;
  const osc = ac.createOscillator(); osc.frequency.value = 0.09;
  const og = ac.createGain(); og.gain.value = 0.07;
  osc.connect(og); og.connect(bg.gain);
  src.connect(lp); lp.connect(bg); bg.connect(dest);
  src.start(); osc.start();
  // 2) 물방울 (졸졸): 짧은 소리가 위로 살짝 올라가며 사라짐, 두세 개씩 모여서
  const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2200;
  const bus = ac.createGain(); bus.gain.value = 3.6;
  tone.connect(bus); bus.connect(dest);
  function drop(t) {
    const f = 380 + Math.pow(Math.random(), 1.6) * 900;     // 낮은 방울이 더 자주 (잔잔하게)
    const dur = 0.035 + Math.random() * 0.07;
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * (1.25 + Math.random() * 0.5), t + dur);
    const g = ac.createGain();
    const peak = 0.025 + Math.random() * 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(tone);
    o.start(t); o.stop(t + dur + 0.02);
  }
  let next = 0;
  // from ~ to 사이의 물방울을 미리 예약
  return function schedule(from, to) {
    if (next < from) next = from;
    while (next < to) {
      const slow = 0.6 + 0.4 * Math.sin(next * 0.7) * Math.sin(next * 0.23); // 물살이 천천히 강해졌다 약해짐
      drop(next);
      if (Math.random() < 0.35) drop(next + 0.02 + Math.random() * 0.05); // 두세 방울이 연달아
      next += (0.04 + Math.random() * 0.16) / Math.max(0.3, slow);
    }
  };
}

let brook = null, waterVol = 0;
export function startAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  brook = buildBrook(ctx, master);
  // 물소리가 들릴 때만 물방울을 만듦 (멀리 있거나 화면을 안 볼 때는 쉼)
  setInterval(() => {
    if (!ctx || ctx.state !== 'running' || muted || waterVol < 0.005 || document.hidden) return;
    brook(ctx.currentTime + 0.05, ctx.currentTime + 0.35);
  }, 150);
}

export function setWaterVolume(v) {
  waterVol = v;
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(muted ? 0 : v, ctx.currentTime, 0.4);
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
