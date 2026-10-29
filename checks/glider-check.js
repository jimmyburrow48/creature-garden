// glider on the fly task (M5, not in the page yet): 150 gens, four seeds, replay the best for 10 s.
// reports height gained, peak centre speed, worst bone stretch, and the height with muscles off.
// usage: node checks/glider-check.js [path to sim.js]
const path = require('path');
const S = require(path.resolve(process.argv[2] || path.join(__dirname, '..', 'sim.js')));
const groundY = () => 300;
const segs = 'glider';
for (const seed of [1, 2, 3, 4]) {
  const ev = S.newEvolution({ size: 16, elite: 4, sigma: 0.2, seconds: 10, seed, groundY, task: 'fly', segments: segs });
  while (ev.gen < 150) S.evolveTick(ev, 2000);
  const run = (muscles) => {
    const world = S.makeWorld({ groundY, muscles }); const b = S.makeBody({ x: 0, y: 250, segments: segs }); b.brain = ev.best; world.creatures.push(b);
    const s0 = S.centre(b); let prev = s0, peak = 0, bs = 0, highest = 0;
    for (let t = 0; t < 600; t++) {
      S.step(world, 1 / 60, 4); const c = S.centre(b);
      peak = Math.max(peak, Math.hypot(c.x - prev.x, c.y - prev.y) * 60); prev = c;
      highest = Math.max(highest, s0.y - c.y);
      for (const e of b.edges) if (e.kind === 'bone') bs = Math.max(bs, Math.abs(Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) - e.rest) / e.rest);
    }
    return { dx: S.centre(b).x - s0.x, highest, peak, bs };
  };
  const on = run(true), off = run(false);
  console.log('glider seed', seed, 'best fly score', ev.bestScore.toFixed(1),
    '| replay: rise', on.highest.toFixed(1), 'dx', on.dx.toFixed(0), 'peak', on.peak.toFixed(0), 'bone stretch', (on.bs * 100).toFixed(1) + '%',
    '| muscles off rise', off.highest.toFixed(1));
}
