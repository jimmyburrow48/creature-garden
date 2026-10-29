// creature garden: the body, the brain and the physics core (M1 + M2).
// a creature is point masses (nodes) joined by springs (edges).
// bones are rigid rods. muscles are springs whose rest length follows a pull (0 to 1).
// the pull comes from a small neural net brain (M2), or from a fixed wave when there is no brain.
// no drawing in here, so the same code runs in the page and in node tests.
(function (global) {
  'use strict';

  var MUSCLE_CONTRACT = 0.25; // a muscle can shorten by up to 25%
  var BRAIN_HIDDEN = 10;
  var MUSCLE_RATE = 0.02; // how far a muscle can move its pull in one substep (a real muscle takes time to squeeze)

  // a worm: a chain of nodes, bones between neighbours, muscles across every
  // other node. the wave phases run along the body so the squeeze travels
  // from tail to head, like a peristaltic wave.
  function makeWorm(opts) {
    var n = opts.segments || 6;
    var gap = opts.gap || 34;
    var x0 = opts.x || 0;
    var y0 = opts.y || 0;
    var nodes = [];
    var i;
    for (i = 0; i < n; i++) {
      nodes.push(node(x0 + i * gap, y0, opts.radius || 6));
    }
    var edges = [];
    for (i = 0; i + 1 < n; i++) {
      edges.push(edge(nodes, i, i + 1, 'bone', gap, 0, 1));
    }
    for (i = 0; i + 2 < n; i++) {
      edges.push(edge(nodes, i, i + 2, "muscle", 2 * gap, i * -0.9, 0.7));
    }
    var muscles = edges.filter(function (e) { return e.kind === 'muscle'; });
    return { nodes: nodes, edges: edges, muscles: muscles, brain: null, name: opts.name || 'worm' };
  }

  // a quadruped (M5): a spine of 4 joints, a foot under each spine joint, and 6 muscles.
  function makeQuad(opts) {
    var x0 = opts.x || 0;
    var y0 = opts.y || 0;
    var gap = 40;
    var spine = [];
    var feet = [];
    var i;
    for (i = 0; i < 4; i++) spine.push(node(x0 + i * gap, y0, opts.radius || 6));
    for (i = 0; i < 4; i++) feet.push(node(x0 + i * gap, y0 + 28, opts.radius || 6));
    var nodes = spine.concat(feet);
    var edges = [];
    for (i = 0; i < 3; i++) edges.push(edge2(spine[i], spine[i + 1], 'bone', gap, 0, 1));
    for (i = 0; i < 4; i++) edges.push(edge2(spine[i], feet[i], 'bone', 28, 0, 1));
    edges.push(edge2(spine[0], spine[2], 'muscle', 2 * gap, 0, 0.7));
    edges.push(edge2(spine[1], spine[3], 'muscle', 2 * gap, 1.6, 0.7));
    var legRest = Math.hypot(gap, 28);
    edges.push(edge2(feet[0], spine[1], 'muscle', legRest, 0.5, 0.6));
    edges.push(edge2(feet[1], spine[2], 'muscle', legRest, 2.1, 0.6));
    edges.push(edge2(feet[2], spine[3], 'muscle', legRest, 3.7, 0.6));
    edges.push(edge2(feet[3], spine[2], 'muscle', legRest, 4.3, 0.6));
    var muscles = edges.filter(function (e) { return e.kind === 'muscle'; });
    return { nodes: nodes, edges: edges, muscles: muscles, brain: null, name: 'quad' };
  }

  // a biped (M5): a torso (back, hip, shoulder), a head on the shoulder, and two feet hung off the hip.
  // 6 joints, 5 bones and 4 muscles = 9 edges. that matches the 9 free directions of 6 joints in 2D,
  // so the bones are not fought by the muscles. (a 5-joint version with 8 edges let the bones
  // stretch 19 percent: the muscles pulled against each other and the rigid bones gave way.)
  function makeBiped(opts) {
    var x0 = opts.x || 0;
    var y0 = opts.y || 0;
    var gap = 40;
    var r = opts.radius || 6;
    var back = node(x0, y0, r);
    var hip = node(x0 + gap, y0, r);
    var shoulder = node(x0 + 2 * gap, y0, r);
    var head = node(x0 + 2 * gap, y0 - 26, r);
    var footL = node(x0 + gap - 12, y0 + 30, r);
    var footR = node(x0 + gap + 12, y0 + 30, r);
    var nodes = [back, hip, shoulder, head, footL, footR];
    var edges = [];
    edges.push(edge2(back, hip, 'bone', gap, 0, 1));
    edges.push(edge2(hip, shoulder, 'bone', gap, 0, 1));
    edges.push(edge2(shoulder, head, 'bone', 26, 0, 1));
    edges.push(edge2(hip, footL, 'bone', Math.hypot(12, 30), 0, 1));
    edges.push(edge2(hip, footR, 'bone', Math.hypot(12, 30), 0, 1));
    // muscles are soft (stiff 0.2): at 0.6 to 1.0 the muscles fought the bones, the bones stretched 20 to 27 percent
    // and the feet flung the body at 800 to 1200 px/s. at 0.2 the peak is about 240 px/s, stretch about 6 percent.
    edges.push(edge2(back, shoulder, 'muscle', 2 * gap, 0, 0.2));
    edges.push(edge2(footL, back, 'muscle', Math.hypot(gap - 12, 30), 0.8, 0.2));
    edges.push(edge2(footR, shoulder, 'muscle', Math.hypot(gap - 12, 30), 2.4, 0.2));
    edges.push(edge2(footL, footR, 'muscle', 24, 3.2, 0.2));
    var muscles = edges.filter(function (e) { return e.kind === 'muscle'; });
    return { nodes: nodes, edges: edges, muscles: muscles, brain: null, name: 'biped' };
  }

  // a glider (M5): a spine of 4 joints with a wing out on each side of the middle, 6 joints in all.
  // 3 spine bones and 2 wing bones (5 bones) and 4 soft muscles: 9 edges for 6 joints, as in the biped.
  // built for the fly task. the wings have no feet, so it lives in the air.
  function makeGlider(opts) {
    var x0 = opts.x || 0;
    var y0 = opts.y || 0;
    var gap = 36;
    var r = opts.radius || 6;
    var s0 = node(x0, y0, r);
    var s1 = node(x0 + gap, y0, r);
    var s2 = node(x0 + 2 * gap, y0, r);
    var s3 = node(x0 + 3 * gap, y0, r);
    var wL = node(x0 + gap - 60, y0 - 10, r);
    var wR = node(x0 + 2 * gap + 60, y0 - 10, r);
    var nodes = [s0, s1, s2, s3, wL, wR];
    var edges = [];
    edges.push(edge2(s0, s1, 'bone', gap, 0, 1));
    edges.push(edge2(s1, s2, 'bone', gap, 0, 1));
    edges.push(edge2(s2, s3, 'bone', gap, 0, 1));
    edges.push(edge2(s1, wL, 'bone', Math.hypot(60, 10), 0, 1));
    edges.push(edge2(s2, wR, 'bone', Math.hypot(60, 10), 0, 1));
    // soft muscles (stiff 0.2, as in the biped): they flex the spine and the wings
    edges.push(edge2(s0, s2, 'muscle', 2 * gap, 0, 0.2));
    edges.push(edge2(s1, s3, 'muscle', 2 * gap, 1.6, 0.2));
    // rest = the distance at the start (wing tip to the spine end: 24 across, 10 up), so the start is in balance
    edges.push(edge2(wL, s0, 'muscle', Math.hypot(24, 10), 2.4, 0.2));
    edges.push(edge2(wR, s3, 'muscle', Math.hypot(24, 10), 3.2, 0.2));
    var muscles = edges.filter(function (e) { return e.kind === 'muscle'; });
    // noBump: the worm start nudge (odd joints up 4 px) makes the wings jump, so the glider starts level
    return { nodes: nodes, edges: edges, muscles: muscles, brain: null, name: 'glider', noBump: true };
  }

  // any body: opts.segments is a number (a worm with that many joints), 'quad', 'biped' or 'glider'
  function makeBody(opts) {
    if (opts.segments === 'quad') return makeQuad(opts);
    if (opts.segments === 'biped') return makeBiped(opts);
    if (opts.segments === 'glider') return makeGlider(opts);
    return makeWorm(opts);
  }

  function edge2(a, b, kind, rest, phase, stiff) {
    return { a: a, b: b, kind: kind, rest: rest, phase: phase, stiff: stiff, pull: 0 };
  }

  function node(x, y, r) {
    return { x: x, y: y, px: x, py: y, r: r, invMass: 1, pinned: false };
  }

  function edge(nodes, a, b, kind, rest, phase, stiff) {
    return {
      a: nodes[a],
      b: nodes[b],
      kind: kind,
      rest: rest,
      phase: phase,
      stiff: stiff,
      // 0 = fully relaxed, 1 = fully squeezed. drawn by the renderer.
      pull: 0
    };
  }

  // one world holds the creature(s), the ground and the settings.
  function makeWorld(opts) {
    return {
      creatures: [],
      groundY: opts.groundY || function () { return 0; },
      gravity: opts.gravity || 900,
      damping: opts.damping === undefined ? 0.985 : opts.damping,
      gripBack: opts.gripBack === undefined ? 0.6 : opts.gripBack,
      gripFwd: opts.gripFwd === undefined ? 0.1 : opts.gripFwd,
      iterations: opts.iterations || 12,
      freq: opts.freq || 3.2,
      muscles: opts.muscles === undefined ? true : opts.muscles,
      time: 0
    };
  }

  // ---- brain (M2) -------------------------------------------------------

  // a tiny seeded random generator, so a brain can be rebuilt from its seed.
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(r) {
    var u = r() || 1e-9;
    var v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // a random brain: inputs -> tanh hidden layer -> sigmoid output per muscle.
  function makeBrain(seed, nIn, nOut) {
    var r = rng(seed);
    var brain = { seed: seed, nIn: nIn, nHid: BRAIN_HIDDEN, nOut: nOut, w1: [], b1: [], w2: [], b2: [] };
    var i;
    for (i = 0; i < BRAIN_HIDDEN * nIn; i++) brain.w1.push(gauss(r) * 1.2 / Math.sqrt(nIn));
    for (i = 0; i < BRAIN_HIDDEN; i++) brain.b1.push(0);
    for (i = 0; i < nOut * BRAIN_HIDDEN; i++) brain.w2.push(gauss(r) * 1.2 / Math.sqrt(BRAIN_HIDDEN));
    for (i = 0; i < nOut; i++) brain.b2.push(0);
    return brain;
  }

  function attachBrain(creature, seed) {
    // senses: per node contact flag and vertical speed, per muscle its pull, then two clock signals
    var nIn = creature.nodes.length * 2 + creature.muscles.length + 2;
    creature.brain = makeBrain(seed, nIn, creature.muscles.length);
    return creature.brain;
  }

  function senses(world, creature) {
    var out = [];
    var i;
    for (i = 0; i < creature.nodes.length; i++) {
      var p = creature.nodes[i];
      var gy = world.groundY(p.x) - p.r;
      out.push(p.y >= gy - 0.5 ? 1 : 0);
      var vy = (p.y - p.py) / 5;
      out.push(vy > 1 ? 1 : vy < -1 ? -1 : vy);
    }
    for (i = 0; i < creature.muscles.length; i++) out.push(creature.muscles[i].pull);
    out.push(Math.sin(world.time * 2));
    out.push(Math.cos(world.time * 2));
    return out;
  }

  function think(brain, input) {
    var hid = new Array(brain.nHid);
    var i, j;
    for (j = 0; j < brain.nHid; j++) {
      var s = brain.b1[j];
      for (i = 0; i < brain.nIn; i++) s += brain.w1[j * brain.nIn + i] * input[i];
      hid[j] = Math.tanh(s);
    }
    var out = new Array(brain.nOut);
    for (var k = 0; k < brain.nOut; k++) {
      var t = brain.b2[k];
      for (j = 0; j < brain.nHid; j++) t += brain.w2[k * brain.nHid + j] * hid[j];
      out[k] = 1 / (1 + Math.exp(-t));
    }
    return out;
  }

  // set every muscle's pull for this moment: from the brain, or the fixed wave.
  // the pull eases towards its target, so a muscle cannot snap from relaxed to squeezed in one step.
  function drive(world, creature) {
    var m = creature.muscles;
    var i;
    var target = new Array(m.length);
    if (!world.muscles) {
      for (i = 0; i < m.length; i++) target[i] = 0;
    } else if (creature.brain) {
      target = think(creature.brain, senses(world, creature));
    } else {
      for (i = 0; i < m.length; i++) {
        target[i] = 0.5 + 0.5 * Math.sin(world.time * world.freq * Math.PI * 2 + m[i].phase);
      }
    }
    for (i = 0; i < m.length; i++) {
      var d = target[i] - m[i].pull;
      m[i].pull += d > MUSCLE_RATE ? MUSCLE_RATE : d < -MUSCLE_RATE ? -MUSCLE_RATE : d;
    }
  }


  // ---- evolution (M3) ---------------------------------------------------

  function cloneBrain(b) {
    return { seed: b.seed, nIn: b.nIn, nHid: b.nHid, nOut: b.nOut,
      w1: b.w1.slice(), b1: b.b1.slice(), w2: b.w2.slice(), b2: b.b2.slice() };
  }

  // a child: every weight nudged by a little gaussian noise.
  function mutateBrain(b, sigma, r) {
    var c = cloneBrain(b);
    function nudge(arr) { for (var i = 0; i < arr.length; i++) arr[i] += gauss(r) * sigma; }
    nudge(c.w1); nudge(c.b1); nudge(c.w2); nudge(c.b2);
    return c;
  }

  // one trial: a fresh worm with this brain, run for some seconds.
  // task "run": fitness = how far it went right. task "jump": fitness = how high its middle got.
  // task "fly": fitness = height gained, summed over the time no joint touches the ground (airtime).
  function trial(brain, seconds, groundY, task, segments, wall) {
    var world = makeWorld({ groundY: groundY });
    world.wall = wall || null;
    var startX = wall ? wall.x - 260 : 0;
    var worm = makeBody({ x: startX, y: 250, segments: segments || 6, gap: 34 });
    if (!worm.noBump) worm.nodes.forEach(function (n, i) { n.y -= (i % 2) * 4; });
    worm.brain = brain;
    world.creatures.push(worm);
    var start = centre(worm);
    var highest = 0;
    var flight = 0;
    var climbed = 0;
    for (var t = 0; t < seconds; t += 1 / 60) {
      step(world, 1 / 60, 4);
      var c = centre(worm);
      highest = Math.max(highest, start.y - c.y);
      if (!touching(world, worm)) flight += Math.max(0, start.y - c.y) / 60;
      if (wall) climbed = Math.max(climbed, wallHeight(world, worm, wall));
    }
    var score = task === 'jump' ? highest : task === 'fly' ? flight : task === 'climb' ? climbed : c.x - start.x;
    return Number.isFinite(score) ? score : -1e9;
  }

  // a population of random brains, plus the bookkeeping for generations.
  function newEvolution(opts) {
    var size = opts.size || 16;
    var seed = opts.seed || 1;
    var segs = opts.segments || 6;
    var probe = makeBody({ x: 0, y: 0, segments: segs, gap: 34 });
    var nIn = probe.nodes.length * 2 + probe.muscles.length + 2;
    var pop = [];
    for (var i = 0; i < size; i++) pop.push(makeBrain(seed * 1000 + i, nIn, probe.muscles.length));
    return {
      size: size,
      elite: opts.elite || 4,
      sigma: opts.sigma || 0.2,
      seconds: opts.seconds || 10,
      task: opts.task || 'run',
      wall: opts.wall || null,
      segments: segs,
      groundY: opts.groundY,
      rng: rng(seed * 7919 + 1),
      pop: pop,
      scores: new Array(size),
      index: 0,
      gen: 0,
      best: null,
      bestScore: -Infinity
    };
  }

  // score the population, then breed the next one. selection: keep the elite, fill the rest with mutants.
  function breed(ev) {
    var order = ev.scores.map(function (s, i) { return i; });
    order.sort(function (a, b) { return ev.scores[b] - ev.scores[a]; });
    if (ev.scores[order[0]] > ev.bestScore) {
      ev.bestScore = ev.scores[order[0]];
      ev.best = cloneBrain(ev.pop[order[0]]);
    }
    var next = [];
    var i;
    for (i = 0; i < ev.elite; i++) next.push(cloneBrain(ev.pop[order[i]]));
    while (next.length < ev.size) {
      var parent = ev.pop[order[Math.floor(ev.rng() * ev.elite)]];
      next.push(mutateBrain(parent, ev.sigma, ev.rng));
    }
    ev.pop = next;
    ev.scores = new Array(ev.size);
    ev.index = 0;
    ev.gen++;
  }

  // switch the task mid-run. the population (and what it learned) is kept; the scores start again.
  function setTask(ev, task, wall) {
    ev.task = task;
    ev.wall = wall || null;
    ev.scores = new Array(ev.size);
    ev.index = 0;
    ev.best = null;
    ev.bestScore = -Infinity;
  }

  // do trials until the time budget is used up. one trial, or one breeding, at a time.
  function evolveTick(ev, budgetMs) {
    var start = Date.now();
    do {
      if (ev.index < ev.pop.length) {
        ev.scores[ev.index] = trial(ev.pop[ev.index], ev.seconds, ev.groundY, ev.task, ev.segments, ev.wall);
        ev.index++;
      } else {
        breed(ev);
      }
    } while (Date.now() - start < budgetMs);
  }

  // how high a joint has got up the face of the wall (0 if none is touching it).
  function wallHeight(world, creature, wall) {
    var h = 0;
    for (var i = 0; i < creature.nodes.length; i++) {
      var p = creature.nodes[i];
      // only the height up to the wall top counts (a joint leaning over the top gets no extra)
      if (Math.abs(p.x - (wall.x - p.r)) < 1.5) h = Math.max(h, Math.min(world.groundY(p.x) - p.y, world.groundY(p.x) - wall.top));
    }
    return h;
  }

  // true if any joint is on the ground right now.
  function touching(world, creature) {
    for (var i = 0; i < creature.nodes.length; i++) {
      var p = creature.nodes[i];
      if (p.y >= world.groundY(p.x) - p.r - 0.5) return true;
    }
    return false;
  }

  // ---- physics ----------------------------------------------------------

  // move the world forward by dt seconds (split into small substeps for stability).
  function step(world, dt, substeps) {
    var n = substeps || 4;
    var h = dt / n;
    for (var s = 0; s < n; s++) {
      world.time += h;
      for (var c = 0; c < world.creatures.length; c++) {
        drive(world, world.creatures[c]);
        integrate(world, world.creatures[c], h);
      }
    }
  }

  function integrate(world, creature, h) {
    var nodes = creature.nodes;
    var edges = creature.edges;
    var i;
    for (i = 0; i < nodes.length; i++) {
      var p = nodes[i];
      if (p.pinned) continue;
      var vx = (p.x - p.px) * world.damping;
      var vy = (p.y - p.py) * world.damping;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + world.gravity * h * h;
    }
    for (var k = 0; k < world.iterations; k++) {
      for (i = 0; i < edges.length; i++) {
        solveEdge(edges[i]);
      }
      for (i = 0; i < nodes.length; i++) {
        collideGround(world, nodes[i]);
      }
    }
  }

  function solveEdge(e) {
    var a = e.a;
    var b = e.b;
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    var rest = e.rest;
    if (e.kind === 'muscle') {
      rest = e.rest * (1 - MUSCLE_CONTRACT * e.pull);
    }
    var wa = a.pinned ? 0 : a.invMass;
    var wb = b.pinned ? 0 : b.invMass;
    var wsum = wa + wb;
    if (wsum === 0) return;
    var corr = ((d - rest) / d) * e.stiff / wsum;
    var cx = dx * corr;
    var cy = dy * corr;
    a.x += cx * wa;
    a.y += cy * wa;
    b.x -= cx * wb;
    b.y -= cy * wb;
  }

  // a bristly ground: sliding backwards meets more friction than sliding forwards.
  // that lopsidedness is what lets a squeezing body crawl somewhere.
  function collideGround(world, p) {
    if (p.pinned) return;
    var gy = world.groundY(p.x) - p.r;
    if (p.y > gy) {
      p.y = gy;
      var vx = p.x - p.px;
      var grip = vx < 0 ? world.gripBack : world.gripFwd;
      p.px = p.x - vx * (1 - grip);
    }
    // a wall (M4 climb): a face from the ground up to wall.top, joints stop at its left side
    var w = world.wall;
    if (w && p.y > w.top && p.x > w.x - p.r) {
      p.x = w.x - p.r;
      p.px = p.x;
    }
  }

  // centre of mass (mean of nodes), used by the camera and the distance meter.
  function centre(creature) {
    var sx = 0;
    var sy = 0;
    for (var i = 0; i < creature.nodes.length; i++) {
      sx += creature.nodes[i].x;
      sy += creature.nodes[i].y;
    }
    var n = creature.nodes.length || 1;
    return { x: sx / n, y: sy / n };
  }

  // find the node under a point (in world units), or null.
  function nodeAt(world, x, y, reach) {
    var best = null;
    var bestD = reach * reach;
    for (var c = 0; c < world.creatures.length; c++) {
      var nodes = world.creatures[c].nodes;
      for (var i = 0; i < nodes.length; i++) {
        var dx = nodes[i].x - x;
        var dy = nodes[i].y - y;
        var d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = nodes[i];
        }
      }
    }
    return best;
  }

  var api = {
    makeWorm: makeWorm,
    makeBody: makeBody,
    makeWorld: makeWorld,
    attachBrain: attachBrain,
    newEvolution: newEvolution,
    evolveTick: evolveTick,
    setTask: setTask,
    cloneBrain: cloneBrain,
    trial: trial,
    step: step,
    centre: centre,
    nodeAt: nodeAt,
    MUSCLE_CONTRACT: MUSCLE_CONTRACT
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.CreatureSim = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
