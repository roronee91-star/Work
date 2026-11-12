const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 560 } });
  const cfg = fs.readFileSync('/home/user/work/src/config.js', 'utf8').replace(/supabaseUrl: '[^']*'/, "supabaseUrl: ''");
  await ctx.route('**/src/config.js', (r) => r.fulfill({ body: cfg, contentType: 'text/javascript' }));
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('work-tower-me', JSON.stringify({ name: '엘리', color: '#ff6b6b', gender: 'f' })); });
  await page.goto('http://127.0.0.1:8123/', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__work && __work.mode === 'office', null, { timeout: 300000 });
  const W = (f) => page.evaluate(f);
  await W(() => document.querySelector('#chatToggle')?.click());
  // 5. 책상 높이
  console.log('desk top', await W(() => __work.bld.floors[0].colliders.find((c) => c.x1 === -5.75 && c.z1 === -5.6)?.top));
  console.log('tops >0.88:', await W(() => __work.bld.floors.map((F, i) => F.colliders.filter((c) => !c.tall && (c.top ?? 0.6) > 0.88 && (c.top ?? 0.6) < 1.3).length).join(',')));
  // 4. 이동 방향 고정
  await W(() => { __work.player.x = 0; __work.player.z = 2; __work.cam.yaw = Math.PI; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700);
  const p1 = await W(() => [__work.player.x, __work.player.z]);
  await W(() => { __work.cam.yaw = Math.PI / 2; }); await page.waitForTimeout(700);
  const p2 = await W(() => [__work.player.x, __work.player.z]);
  await page.keyboard.up('KeyW');
  console.log('walk before turn dir', (p1[0]).toFixed(2), (p1[1] - 2).toFixed(2), '| after turn delta', (p2[0] - p1[0]).toFixed(2), (p2[1] - p1[1]).toFixed(2));
  // 1~3. 엘리베이터: 걸어서 다가가다 창이 뜨면 멈춤
  await W(() => { __work.player.x = -8.75 + 3.2; __work.player.z = -0.9; __work.player.ry = -Math.PI / 2; __work.cam.yaw = Math.PI / 2; });
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => !document.getElementById('floorModal').hidden, null, { timeout: 60000 });
  const s1 = await W(() => [__work.player.x, __work.player.z]); await page.waitForTimeout(1500);
  const s2 = await W(() => [__work.player.x, __work.player.z]);
  console.log('stopped after popup:', Math.hypot(s2[0] - s1[0], s2[1] - s1[1]).toFixed(3));
  await page.keyboard.up('KeyW');
  const sel = () => W(() => [...document.querySelectorAll('#floorList button')].map((b) => (b.classList.contains('sel') ? '[' : '') + b.querySelector('b').textContent + (b.disabled ? 'x' : '') + (b.classList.contains('sel') ? ']' : '')).join(' '));
  console.log('open:', await sel());
  await page.keyboard.press('ArrowUp'); console.log('up:', await sel()); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); console.log('up x5 (stop at top):', await sel());
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); console.log('down x2:', await sel());
  await page.screenshot({ path: process.argv[2] + '/elev.png' });
  await page.keyboard.press('Digit1'); await page.waitForTimeout(800);
  console.log('digit1 same floor -> floor', await W(() => __work.player.floor), 'modal open', await W(() => !document.getElementById('floorModal').hidden));
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  console.log('enter -> floor', await W(() => __work.player.floor));
  // 5. 책상 위에 서 보기 (1층)
  await W(() => __work.goFloor(0)); await page.waitForTimeout(1500);
  await W(() => { const w = __work; w.player.x = -5.4; w.player.z = -3.7; w.av.jy = 1.0; w.av.vy = 0; w.cam.yaw = -Math.PI / 2 + 0.5; w.cam.pitch = 0.15; w.cam.dist = 2.6; });
  await page.waitForTimeout(2500);
  console.log('standing height', await W(() => __work.av.ground.toFixed(3) + ' jy ' + __work.av.jy.toFixed(3)));
  await page.screenshot({ path: process.argv[2] + '/desk.png' });
  console.log('errors:', errs.join('|') || 'none'); await b.close();
})();
