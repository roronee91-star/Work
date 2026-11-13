// 💻 꾸미기용 터미널: 자리에서 "일하기"를 누르면 화면에 뜨는 까만 창. 진짜 명령은 실행하지 않음 (재미용)
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const n = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const bar = (p) => '[' + '#'.repeat(Math.round(p / 5)).padEnd(20, '.') + `] ${p}%`;

// 한 묶음씩 이어서 출력 (명령 한 줄 → 결과 몇 줄)
function chunk(name) {
  const t = () => new Date().toTimeString().slice(0, 8);
  return pick([
    () => [`$ git pull origin main`, `remote: Counting objects: ${n(20, 400)}, done.`, `Updating ${n(1000, 9999).toString(16)}..${n(1000, 9999).toString(16)}`, `Fast-forward`, ` src/report.js | ${n(2, 40)} ${'+'.repeat(n(2, 8))}${'-'.repeat(n(0, 4))}`],
    () => [`$ npm run build`, `> work-tower@1.0.0 build`, `${bar(25)}`, `${bar(70)}`, `${bar(100)}`, `✔ 빌드 완료 (${(Math.random() * 4 + 1).toFixed(2)}s)`],
    () => [`$ python3 정산.py --month ${n(1, 12)}`, `불러오는 중… 영수증 ${n(30, 300)}건`, `합계: ${(n(100, 9999) * 1000).toLocaleString('ko-KR')}원`, `✔ 정산표.xlsx 저장`],
    () => [`$ ./회의록_정리.sh`, `[${t()}] 회의록 ${n(2, 9)}개 찾음`, `[${t()}] 할 일 ${n(3, 15)}개 뽑아냄`, `[${t()}] 담당자에게 알림 보냄 ✉`],
    () => [`$ ping coffee-machine.local`, ...Array.from({ length: 3 }, (_, i) => `64 bytes from 1F 카페: icmp_seq=${i + 1} time=${(Math.random() * 30 + 2).toFixed(1)} ms ☕`), `커피 머신 정상 작동 중`],
    () => [`$ test --all`, ...Array.from({ length: n(3, 6) }, () => `  ✔ ${pick(['로그인', '공지 올리기', '엘리베이터', '샌드백 점수', '결투 판정', '낮밤 전환', '채팅 보내기'])} (${n(3, 90)}ms)`), `통과 ✔  실패 0`],
    () => [`$ deploy --to staging`, `업로드 중… ${bar(n(40, 90))}`, `${bar(100)}`, `✔ 배포 완료 · ${name}님 수고했어요 👍`],
    () => [`$ top`, `  PID  USER   CPU%  COMMAND`, `  ${n(100, 999)}  ${name.slice(0, 5).padEnd(6)} ${n(10, 99)}.${n(0, 9)}  집중력`, `  ${n(100, 999)}  ${name.slice(0, 5).padEnd(6)} ${n(1, 9)}.${n(0, 9)}   점심메뉴_고민`, `  ${n(100, 999)}  root   0.${n(1, 9)}   퇴근_카운트다운`],
    () => [`$ cat 오늘_할_일.txt`, ...Array.from({ length: 3 }, () => `${pick(['☐', '☑'])} ${pick(['주간 보고서', '메일 답장', '견적서 확인', '회의 준비', '자료 정리', '디자인 검토', '버그 고치기'])}`)],
  ])();
}

export function createTerminal($, getName) {
  const box = $('term'), out = $('termOut');
  let lines = [], queue = [], cur = '', timer = 0;
  const render = () => { out.textContent = lines.join('\n') + (lines.length ? '\n' : '') + cur + '▌'; out.scrollTop = out.scrollHeight; };
  function tick() {
    if (!queue.length) queue = chunk(getName() || '나').concat(['']);
    const line = queue[0];
    // 명령(시작이 $)은 한 글자씩 타닥타닥, 결과는 한 줄씩
    if (line.startsWith('$') && cur.length < line.length) cur = line.slice(0, cur.length + n(1, 3));
    else { lines.push(line); cur = ''; queue.shift(); if (lines.length > 120) lines = lines.slice(-80); }
    render();
    timer = setTimeout(tick, line.startsWith('$') && cur ? n(35, 90) : n(120, 420));
  }
  return {
    open() {
      if (!box.hidden) return;
      lines = [`WORK 사내 터미널 — ${new Date().toLocaleString('ko-KR')}`, `${getName()}님, 오늘도 화이팅! (꾸미기용 화면이에요)`, ''];
      queue = []; cur = ''; box.hidden = false; render(); clearTimeout(timer); timer = setTimeout(tick, 400);
    },
    close() { box.hidden = true; clearTimeout(timer); },
    // 키를 누르면 더 빨리 타닥타닥
    boost() { if (!box.hidden) { clearTimeout(timer); tick(); } },
    get open_() { return !box.hidden; },
  };
}
