// tries 40 random brains (seeds 1 to 40) for 20 s each. checks none blows up (NaN)
// and that most of them actually move the body.
// usage: node checks/random-brain-check.js [path to sim.js]
const path = require('path');
const S = require(path.resolve(process.argv[2] || path.join(__dirname, '..', 'sim.js')));

const moved = [];
let broken = 0;
for (let seed = 1; seed <= 40; seed++) {
  const world = S.makeWorld({ groundY: () => 300 });
  const worm = S.makeWorm({ x: 0, y: 250, segments: 6, gap: 34 });
  worm.nodes.forEach((n, i) => { n.y -= (i % 2) * 4; });
  S.attachBrain(worm, seed);
  world.creatures.push(worm);
  const x0 = S.centre(worm).x;
  for (let t = 0; t < 20; t += 1 / 60) S.step(world, 1 / 60, 4);
  const d = S.centre(worm).x - x0;
  if (Number.isFinite(d)) moved.push(d); else broken++;
}
moved.sort((a, b) => a - b);
const far = moved.filter((d) => Math.abs(d) > 50).length;
console.log('broken (NaN):', broken, '| range px:', moved[0].toFixed(1), 'to', moved[moved.length - 1].toFixed(1));
console.log('brains that moved more than 50 px:', far, 'of', moved.length);
process.exitCode = broken === 0 ? 0 : 1; // the moved count is reported, not a pass gate
