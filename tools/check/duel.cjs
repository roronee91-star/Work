const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-proxy-server'] });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 520 } });
  const cfg = fs.readFileSync('/home/user/work/src/config.js', 'utf8').replace(/supabaseUrl: '[^']*'/, "supabaseUrl: ''");
  await ctx.route('**/src/config.js', (r) => r.fulfill({ body: cfg, contentType: 'text/javascript' }));
  const tab = async (name, color) => {
    const page = await ctx.newPage(); page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message));
    await page.addInitScript(([n, c]) => { localStorage.setItem('work-day', '0'); localStorage.setItem('work-tower-me', JSON.stringify({ name: n, color: c, gender: n === '엘리' ? 'f' : 'm' })); localStorage.setItem('work-dev', 'dev-' + n); localStorage.removeItem('work-duel'); }, [name, color]);
    await page.goto('http://127.0.0.1:8123/', { waitUntil: 'commit', timeout: 60000 });
    await page.waitForFunction(() => window.__work && __work.mode === 'office', null, { timeout: 300000 });
    await page.evaluate(() => document.querySelector('#chatToggle').click());
    return page;
  };
  const a = await tab('엘리', '#ff6b6b');
  const b = await tab('민수', '#4f8cff');
  await a.waitForTimeout(3000);
  // A가 접속자 목록에서 민수에게 결투 신청 (휴가권 걸기)
  // 4층 결투 관리인 앞으로 가서 신청
  await a.evaluate(() => __work.goFloor(3)); await a.waitForTimeout(2500);
  await a.evaluate(() => { __work.player.x = 3.3; __work.player.z = -5.1; });
  await a.waitForTimeout(1500);
  console.log('A prompt:', await a.textContent('#prompt'));
  await a.keyboard.press('KeyE'); await a.waitForTimeout(800);
  console.log('picker:', (await a.textContent('#dPickList')).replace(/\s+/g, ' ').slice(0, 120), '|', await a.textContent('#dPickInfo'));
  await a.evaluate(() => document.querySelector('#dPickList button:not(.bot)').click());
  await b.waitForFunction(() => !document.getElementById('duelAsk').hidden, null, { timeout: 30000 });
  console.log('B got invite:', await b.textContent('#dAskText'));
  await b.evaluate(() => document.getElementById('dAccept').click());
  await a.waitForFunction(() => __work.duel.active, null, { timeout: 30000 });
  await b.waitForFunction(() => __work.duel.active, null, { timeout: 30000 });
  console.log('banner on A:', await a.textContent('#duelBanner'));
  await a.waitForTimeout(4000);
  console.log('after 4s A:', await a.evaluate(() => [__work.mode, __work.player.floor, __work.player.x.toFixed(2), __work.player.z.toFixed(2)].join(',')));
  // 카운트다운 건너뛰기
  await a.evaluate(() => { __work.duel.st.t = 0.01; }); await b.evaluate(() => { __work.duel.st.t = 0.01; });
  await a.waitForFunction(() => __work.duel.st.phase === 'fight', null, { timeout: 60000 });
  await b.waitForFunction(() => __work.duel.st.phase === 'fight', null, { timeout: 60000 });
  console.log('A floor/pos:', await a.evaluate(() => [__work.player.floor, __work.player.x.toFixed(2), __work.player.z.toFixed(2)].join(',')), '| B:', await b.evaluate(() => [__work.player.floor, __work.player.x.toFixed(2), __work.player.z.toFixed(2)].join(',')));
  // A가 연타
  for (let i = 0; i < 160 && !(await b.evaluate(() => __work.duel.st.phase === 'done')); i++) { await a.evaluate(() => __work.duel.attack()); if (i % 3 === 0) await b.evaluate(() => __work.duel.attack()); await a.waitForTimeout(60); if (i === 25) { await b.bringToFront(); await b.waitForTimeout(1200); await b.screenshot({ path: out + '/duel-mid.png', timeout: 120000 }); } }
  await a.waitForTimeout(2500);
  await a.screenshot({ path: out + '/duel-a.png', timeout: 120000 });
  console.log('B hp:', await b.evaluate(() => __work.duel.st.myHp), '| A result:', (await a.textContent('#dResText')).slice(0, 80));
  console.log('B result:', (await b.textContent('#dResText')).slice(0, 80));
  console.log('A level:', await a.evaluate(() => __work.duel.level), JSON.stringify(await a.evaluate(() => __work.duel.stats)));
  await b.waitForTimeout(2000);
  console.log('B loser:', await b.evaluate(() => __work.duel.loser), '| A sees B label:', await a.evaluate(() => [...__work.peers.values()].map(p => p.av.label && (p.tt ? '패배자 ' : '') + p.name).join(',')));
  await a.bringToFront(); await a.evaluate(() => { document.getElementById('dLeave').click(); }); await a.waitForTimeout(1500);
  await a.screenshot({ path: out + '/loser.png', timeout: 120000 });
  // 분노 인간과 연습
  await a.evaluate(() => { __work.duel.leave(); __work.player.x = 3.3; __work.player.z = -5.1; });
  await a.waitForTimeout(1500);
  await a.evaluate(() => { __work.duel.openPicker(); document.querySelector('#dPickList button.bot').click(); });
  await a.waitForFunction(() => __work.duel.active, null, { timeout: 30000 });
  await a.evaluate(() => { __work.duel.st.t = 0.01; });
  await a.waitForFunction(() => __work.duel.st.phase === 'fight', null, { timeout: 60000 });
  for (let i = 0; i < 25; i++) { await a.evaluate(() => __work.duel.attack()); await a.waitForTimeout(50); }
  await a.waitForTimeout(800);
  await a.screenshot({ path: out + '/bot.png', timeout: 120000 });
  console.log('bot fight hp me/bot:', await a.evaluate(() => [__work.duel.st.myHp, __work.duel.st.oppHp].join('/')));
  console.log('errors:', [...a.errs, ...b.errs].join(' | ') || 'none');
  await browser.close();
})();
