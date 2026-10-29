// checks that the M1 worm really crawls with muscles on, and stays put with them off.
// usage: node checks/worm-walk-check.js [path to sim.js]
const path = require('path');
const S = require(path.resolve(process.argv[2] || path.join(__dirname, '..', 'sim.js')));

function run(label, opts) {
  const world = S.makeWorld({ groundY: () => 300, gripBack: opts.gripBack, gripFwd: opts.gripFwd, muscles: opts.muscles, freq: opts.freq });
  const worm = S.makeWorm({ x: 0, y: 250, segments: 6, gap: 34 });
  // a small bump so the body folds instead of lying perfectly flat
  worm.nodes.forEach((n, i) => { n.y -= (i % 2) * 4; });
  world.creatures.push(worm);
  const x0 = S.centre(worm).x;
  for (let t = 0; t < 20; t += 1 / 60) {
    S.step(world, 1 / 60, 4);
  }
  const c = S.centre(worm);
  const travelled = c.x - x0;
  const ok = Number.isFinite(travelled);
  console.log(label.padEnd(30), ok ? `travelled ${travelled.toFixed(1)} px in 20 s` : 'NaN (broken)');
  return ok;
}

const a = run('muscles on (default grip)', { muscles: true, freq: 3.2 });
const b = run('muscles off (default grip)', { muscles: false, freq: 3.2 });
process.exitCode = a && b ? 0 : 1;
