// creature garden: the body, the brain and the physics core (M1 + M2).
// a creature is point masses (nodes) joined by springs (edges).
// bones are rigid rods. muscles are springs whose rest length follows a pull (0 to 1).
// the pull comes from a small neural net brain (M2), or from a fixed wave when there is no brain.
// no drawing in here, so the same code runs in the page and in node tests.
(function (global) {
  'use strict';

  var MUSCLE_CONTRACT = 0.25; // a muscle can shorten by up to 25%
  var BRAIN_HIDDEN = 10;

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
      edges.push(edge(nodes, i, i + 2, 'muscle', 2 * gap, i * 0.9, 0.7));
    }
    var muscles = edges.filter(function (e) { return e.kind === 'muscle'; });
    return { nodes: nodes, edges: edges, muscles: muscles, brain: null, name: opts.name || 'worm' };
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
  function drive(world, creature) {
    var m = creature.muscles;
    var i;
    if (!world.muscles) {
      for (i = 0; i < m.length; i++) m[i].pull = 0;
      return;
    }
    if (creature.brain) {
      var out = think(creature.brain, senses(world, creature));
      for (i = 0; i < m.length; i++) m[i].pull = out[i];
      return;
    }
    for (i = 0; i < m.length; i++) {
      m[i].pull = 0.5 + 0.5 * Math.sin(world.time * world.freq * Math.PI * 2 + m[i].phase);
    }
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
    makeWorld: makeWorld,
    attachBrain: attachBrain,
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
