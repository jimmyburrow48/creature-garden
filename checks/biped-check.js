// M5 biped check. three parts:
// 1. passive: the biped with muscles off, 5 s. does it stay up or fall over?
// 2. evolution: 30 gens of run (16 brains, 10 s each), same as the page.
// 3. replay: the best brain for 10 s. distance, peak centre speed, and any joint below the ground.
// usage: node checks/biped-check.js [path to sim.js] [gens]
const path = require('path');
const S = require(path.resolve(process.argv[2] || path.join(__dirname, '..', 'sim.js')));
const GENS = Number(process.argv[3] || 30);
const GROUND = 300;
const groundY = () => GROUND;

// 1. passive
{
  const world = S.makeWorld({ groundY, muscles: false });
  const b = S.makeBody({ x: 0, y: 250, segments: 'biped' });
  world.creatures.push(b);
  const y0 = S.centre(b).y;
  for (let t = 0; t < 5; t += 1 / 60) S.step(world, 1 / 60, 4);
  const c = S.centre(b);
  console.log('passive 5 s: centre dx', (c.x).toFixed(1), 'dy', (c.y - y0).toFixed(1));
}

// 2. evolution (run)
const ev = S.newEvolution({ size: 16, elite: 4, sigma: 0.2, seconds: 10, seed: 1, groundY, task: 'run', segments: 'biped' });
const t0 = Date.now();
while (ev.gen < GENS) S.evolveTick(ev, 2000);
console.log('evolved', ev.gen, 'gens in', ((Date.now() - t0) / 1000).toFixed(1), 's; best trial score', ev.bestScore.toFixed(1));

// 3. replay the best brain
{
  const world = S.makeWorld({ groundY });
  const b = S.makeBody({ x: 0, y: 250, segments: 'biped' });
  b.brain = ev.best;
  world.creatures.push(b);
  const start = S.centre(b);
  let prev = start;
  let peak = 0;
  let worst = -Infinity; // deepest a joint sinks into the ground (px, positive = below)
  let stretch = 0; // worst bone stretch (a bone should keep its length; a big value means the solver is fighting itself)
  for (let t = 0; t < 10; t += 1 / 60) {
    S.step(world, 1 / 60, 4);
    const c = S.centre(b);
    peak = Math.max(peak, Math.hypot(c.x - prev.x, c.y - prev.y) * 60);
    prev = c;
    for (const p of b.nodes) worst = Math.max(worst, p.y - (groundY(p.x) - p.r));
    for (const e of b.edges) if (e.kind === 'bone') stretch = Math.max(stretch, Math.abs(Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) - e.rest) / e.rest);
  }
  const end = S.centre(b);
  console.log('replay 10 s: dx', (end.x - start.x).toFixed(1), 'px, peak speed', peak.toFixed(1), 'px/s, deepest joint into ground', worst.toFixed(2), 'px, worst bone stretch', (stretch * 100).toFixed(1) + '%');
}
