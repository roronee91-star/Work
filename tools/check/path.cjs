const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
  const cfg = fs.readFileSync('/home/user/work/src/config.js', 'utf8').replace(/supabaseUrl: '[^']*'/, "supabaseUrl: ''");
  await ctx.route('**/src/config.js', (r) => r.fulfill({ body: cfg, contentType: 'text/javascript' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('work-tower-me', JSON.stringify({ name: '엘리', color: '#ff6b6b', gender: 'f' })); });
  await page.goto('http://127.0.0.1:8123/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__work && __work.mode === 'office', null, { timeout: 300000 });
  const r = await page.evaluate(() => {
    const w = __work, out = {};
    const E = [-8.35, -0.7];
    // 각 층 여러 출발점에서 엘리베이터까지 길이 있는지, 길을 따라 실제로 막힘 없이 걸을 수 있는지
    const starts = { 0: [[0, 9.4], [-20, 20], [15, -20], [8, 3], [-5.4, 4.5]], 1: [[8, 5], [-2, 4], [6.5, 2]], 2: [[8, -4], [5, 5], [-3, -4]], 3: [[8.7, -5.5], [3, 4], [-4, 0]], 4: [[8, 5], [-6, 5]] };
    for (const [f, list] of Object.entries(starts)) {
      w.player.floor = +f;
      out[f] = list.map(([sx, sz]) => {
        const p = w.findPath(+f, sx, sz, E[0], E[1]);
        if (!p) return 'NO PATH';
        let x = sx, z = sz, maxDev = 0;
        for (const [tx, tz] of p) for (let i = 0; i < 2000; i++) { const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz); if (d < 0.05) break; const st = Math.min(d, 0.05); const [nx, nz] = w.collide(x + dx / d * st, z + dz / d * st); maxDev = Math.max(maxDev, Math.hypot(nx - (x + dx / d * st), nz - (z + dz / d * st))); x = nx; z = nz; }
        return `ok ${p.length}pts end(${x.toFixed(1)},${z.toFixed(1)}) push${maxDev.toFixed(2)}`;
      });
    }
    w.player.floor = 0;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  console.log('errors:', errs.join('|') || 'none');
  await browser.close();
})();
