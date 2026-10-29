// creature garden: the page. draws the world from sim.js and handles input.
(function () {
  'use strict';

  var S = window.CreatureSim;
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var hud = document.getElementById('hud');

  var VIEW_H = 360; // world units shown from top to bottom
  var VIEW_TOP = 170; // world y at the top of the view
  var START_X = 0;
  var START_Y = 240;

  // a soft, slightly bumpy ground line
  function groundY(x) {
    return 300 + 12 * Math.sin(x / 190) + 5 * Math.sin(x / 61 + 1.3);
  }

  var world = S.makeWorld({ groundY: groundY, muscles: true, freq: 3.2 });
  // body presets: how many joints the worm has (the brain is rebuilt for each size)
  var presets = [
    { name: 'short worm', segments: 4 },
    { name: 'worm', segments: 6 },
    { name: 'long worm', segments: 9 }
  ];
  var preset = 1;
  // climb (M4): a wall the body must climb. only in the climb task.
  var WALL = { x: 140, top: 120 };
  var creature = null;
  var cam = { x: START_X };
  var camTop = VIEW_TOP; // the view also rises when the creature jumps up
  var paused = false;
  var dragNode = null;
  var pointer = { x: 0, y: 0, inside: false };
  var scale = 1;
  var width = 0;
  var height = 0;
  var lastT = 0;
  var acc = 0;
  var fixedDt = 1 / 60;

  // the brain is a random net built from a seed. R starts a new seed; B turns the brain off
  // (muscles then follow the plain wave from M1).
  var brainSeed = 1;
  var brainOn = true;

  function reset(newSeed) {
    if (newSeed !== undefined) brainSeed = newSeed;
    world.wall = task === 'climb' ? WALL : null;
    world.creatures = [];
    world.time = 0;
    creature = S.makeWorm({ x: START_X - 60, y: START_Y, segments: presets[preset].segments, gap: 34, name: presets[preset].name });
    // a little bump so the body folds instead of lying perfectly flat
    creature.nodes.forEach(function (n, i) { n.y -= (i % 2) * 4; });
    if (brainOn) S.attachBrain(creature, brainSeed);
    world.creatures.push(creature);
    cam.x = START_X;
    dragNode = null;
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = height / VIEW_H;
  }

  // world -> screen. the camera follows the creature's middle.
  function sx(x) { return (x - cam.x) * scale + width / 2; }
  function sy(y) { return (y - camTop) * scale; }
  function wx(px) { return (px - width / 2) / scale + cam.x; }
  function wy(py) { return py / scale + camTop; }

  function lerpColor(a, b, t) {
    var out = [];
    for (var i = 0; i < 3; i++) {
      out.push(Math.round(a[i] + (b[i] - a[i]) * t));
    }
    return 'rgb(' + out[0] + ',' + out[1] + ',' + out[2] + ')';
  }

  var RELAXED = [88, 200, 190];
  var SQUEEZED = [255, 122, 89];

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#8fd3e8');
    g.addColorStop(0.6, '#dff0e4');
    g.addColorStop(1, '#fbe9c6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  // two layers of far hills that move slower than the camera (parallax)
  function drawHills(factor, base, amp, color, phase) {
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (var px = 0; px <= width; px += 8) {
      var wxp = (px - width / 2) / scale + cam.x * factor;
      var y = base + amp * Math.sin(wxp / 260 + phase) + amp * 0.4 * Math.sin(wxp / 97 + phase * 2);
      ctx.lineTo(px, sy(y));
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawGround() {
    ctx.beginPath();
    var first = true;
    for (var px = 0; px <= width + 8; px += 8) {
      var y = sy(groundY(wx(px)));
      if (first) { ctx.moveTo(px, y); first = false; } else { ctx.lineTo(px, y); }
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, sy(300), 0, height);
    g.addColorStop(0, '#8cc572');
    g.addColorStop(0.25, '#6aa35a');
    g.addColorStop(1, '#3f6b40');
    ctx.fillStyle = g;
    ctx.fill();
    // a thin bright lip along the top edge
    ctx.strokeStyle = 'rgba(255,255,230,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawShadow(c) {
    var x = c.x;
    var lift = Math.max(0, groundY(x) - c.y);
    var k = Math.max(0.15, 1 - lift / 160);
    ctx.save();
    ctx.translate(sx(x), sy(groundY(x) + 2));
    ctx.scale(1, 0.18);
    var rad = 120 * scale * k;
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, 'rgba(30,50,30,' + (0.35 * k).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(30,50,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCreature(c) {
    var i;
    // muscles first, so the bones sit on top
    for (i = 0; i < c.edges.length; i++) {
      var e = c.edges[i];
      if (e.kind !== 'muscle') continue;
      var col = lerpColor(RELAXED, SQUEEZED, e.pull);
      ctx.strokeStyle = col;
      ctx.lineWidth = (3 + 4 * e.pull) * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx(e.a.x), sy(e.a.y));
      ctx.lineTo(sx(e.b.x), sy(e.b.y));
      ctx.stroke();
    }
    for (i = 0; i < c.edges.length; i++) {
      var b = c.edges[i];
      if (b.kind !== 'bone') continue;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#4a3358';
      ctx.lineWidth = 10 * scale;
      ctx.beginPath();
      ctx.moveTo(sx(b.a.x), sy(b.a.y));
      ctx.lineTo(sx(b.b.x), sy(b.b.y));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(230,200,255,0.45)';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(sx(b.a.x), sy(b.a.y - 2.5));
      ctx.lineTo(sx(b.b.x), sy(b.b.y - 2.5));
      ctx.stroke();
    }
    for (i = 0; i < c.nodes.length; i++) {
      var n = c.nodes[i];
      var r = n.r * 1.25 * scale;
      var g = ctx.createRadialGradient(sx(n.x) - r * 0.3, sy(n.y) - r * 0.3, r * 0.1, sx(n.x), sy(n.y), r);
      g.addColorStop(0, '#fff4d6');
      g.addColorStop(1, '#f0a868');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx(n.x), sy(n.y), r, 0, Math.PI * 2);
      ctx.fill();
      if (n === dragNode) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // dust puffs: a joint that lands on the ground throws a few soft puffs (M6 look)
  var puffs = [];
  var lastCheck = null;

  function spawnDust(n, dropSpeed) {
    if (!n) return;
    var k = Math.min(4, Math.max(1, Math.round(dropSpeed / 120)));
    for (var i = 0; i < k; i++) {
      puffs.push({ x: n.x, y: groundY(n.x), vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40, life: 0, max: 0.6 + Math.random() * 0.3, r: 4 + Math.random() * 5 });
    }
  }

  function updatePuffs(dt) {
    for (var i = puffs.length - 1; i >= 0; i--) {
      var p = puffs[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt;
      p.r += 14 * dt;
      if (p.life > p.max) puffs.splice(i, 1);
    }
  }

  function checkLandings() {
    if (!creature) return;
    for (var i = 0; i < creature.nodes.length; i++) {
      var n = creature.nodes[i];
      var onGround = n.y >= groundY(n.x) - n.r - 0.5;
      var wasAir = lastCheck && lastCheck[i];
      if (onGround && wasAir) {
        var speed = (n.y - n.py) * 240; // the last substep is 1/240 s
        if (speed > 80) spawnDust(n, speed);
      }
    }
    lastCheck = creature.nodes.map(function (n) { return n.y < groundY(n.x) - n.r - 0.5; });
  }

  function drawPuffs() {
    for (var i = 0; i < puffs.length; i++) {
      var p = puffs[i];
      var a = (1 - p.life / p.max) * 0.45;
      ctx.fillStyle = 'rgba(244,238,222,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), p.r * scale * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // soft light from the upper right, and darker corners (cheap, drawn over the scene)
  function drawLighting() {
    var sun = ctx.createRadialGradient(width * 0.82, height * 0.05, 0, width * 0.82, height * 0.05, height * 0.9);
    sun.addColorStop(0, 'rgba(255,246,214,0.35)');
    sun.addColorStop(1, 'rgba(255,246,214,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);
    var vig = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.85);
    vig.addColorStop(0, 'rgba(20,30,40,0)');
    vig.addColorStop(1, 'rgba(20,30,40,0.22)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  // the climb wall: a stone face from the ground up to its top
  function drawWall(w) {
    var x0 = sx(w.x);
    var top = sy(w.top);
    var bottom = sy(groundY(w.x) + 10);
    var g = ctx.createLinearGradient(x0, 0, x0 + 26 * scale, 0);
    g.addColorStop(0, '#9a9488');
    g.addColorStop(1, '#6d685f');
    ctx.fillStyle = g;
    ctx.fillRect(x0, top, 26 * scale, bottom - top);
    ctx.fillStyle = 'rgba(255,255,240,0.5)';
    ctx.fillRect(x0, top, 26 * scale, 3 * scale);
  }

  function draw() {
    drawSky();
    drawHills(0.25, 230, 26, 'rgba(170,205,190,0.8)', 0.4);
    drawHills(0.5, 262, 18, 'rgba(120,175,140,0.9)', 2.1);
    drawGround();
    if (world.wall) drawWall(world.wall);
    if (creature) {
      drawShadow(S.centre(creature));
      drawCreature(creature);
    }
    drawPuffs();
    drawLighting();
    drawHud();
  }

  function drawHud() {
    if (!creature) return;
    var c = S.centre(creature);
    var dist = (c.x - START_X + 60) / 34; // body segments travelled
    var secs = world.time;
    var line2 = 'time ' + secs.toFixed(1) + ' s  ·  travelled ' + dist.toFixed(1) + ' body lengths';
    if (evoOn) {
      line2 = 'evolving ' + task + '  ·  gen ' + evo.gen + '  ·  best ' +
        (task === 'run' ? (evo.bestScore / 34).toFixed(1) + ' body lengths' : task === 'jump' ? evo.bestScore.toFixed(0) + ' px high' : evo.bestScore.toFixed(0) + (task === 'climb' ? ' px up the wall' : ' flight')) +
        '  ·  trial ' + evo.index + '/' + evo.size;
    }
    hud.textContent =
      'creature garden  ·  ' + presets[preset].name + '  ·  M5 presets\n' +
      line2 + '\n' +
      'brain ' + (creature.brain ? (evoOn ? 'evolved' : 'random net, seed ' + brainSeed) : 'off (plain wave)') +
      '  ·  muscles ' + (world.muscles ? 'on' : 'off') + '  ·  ' + (paused ? 'paused' : 'running') +
      '\ndrag a joint  ·  E evolve  ·  T run, jump or fly  ·  P body  ·  B brain  ·  M muscles  ·  space pause  ·  R new seed';
  }

  // evolution (M3): a population of brains is tried in the background, and the live
  // creature shows the best brain found so far whenever it improves.
  var evo = null;
  var evoOn = false;
  var shownScore = -Infinity;
  var task = 'run'; // 'run' = how far right, 'jump' = how high, 'fly' = height gained while in the air

  function showBest() {
    world.creatures = [];
    creature = S.makeWorm({ x: START_X - 60, y: START_Y, segments: presets[preset].segments, gap: 34, name: presets[preset].name });
    creature.nodes.forEach(function (n, i) { n.y -= (i % 2) * 4; });
    creature.brain = S.cloneBrain(evo.best);
    world.creatures.push(creature);
    cam.x = START_X;
    shownScore = evo.bestScore;
  }

  function startEvolution(seed) {
    evo = S.newEvolution({ size: 16, elite: 4, sigma: 0.2, seconds: 10, seed: seed, groundY: groundY, task: task, segments: presets[preset].segments, wall: task === 'climb' ? WALL : null });
    evoOn = true;
    shownScore = -Infinity;
    world.time = 0;
  }

  function frame(t) {
    var dt = Math.min((t - lastT) / 1000, 1 / 30);
    lastT = t;
    if (evoOn && !paused) {
      S.evolveTick(evo, 8);
      if (evo.best && evo.bestScore > shownScore) showBest();
    }
    if (!paused) {
      acc += dt;
      while (acc >= fixedDt) {
        S.step(world, fixedDt, 4);
        checkLandings();
        acc -= fixedDt;
      }
    }
    // camera: ease towards the creature's middle
    if (creature) {
      var target = S.centre(creature).x;
      cam.x += (target - cam.x) * Math.min(1, dt * 4);
      // the view only rises when the middle goes above its usual height
      var wantTop = Math.min(VIEW_TOP, VIEW_TOP + S.centre(creature).y - 250);
      camTop += (wantTop - camTop) * Math.min(1, dt * 3);
    }
    updatePuffs(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', function (e) {
    var p = pointerPos(e);
    var n = S.nodeAt(world, wx(p.x), wy(p.y), 26 / scale);
    if (n) {
      dragNode = n;
      n.pinned = true;
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = pointerPos(e);
    pointer.x = p.x;
    pointer.y = p.y;
    if (dragNode) {
      dragNode.x = wx(p.x);
      dragNode.y = wy(p.y);
      dragNode.px = dragNode.x;
      dragNode.py = dragNode.y;
    }
  });
  function release() {
    if (dragNode) {
      dragNode.pinned = false;
      dragNode = null;
    }
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      paused = !paused;
      e.preventDefault();
    } else if (e.key === 'm' || e.key === 'M') {
      world.muscles = !world.muscles;
    } else if (e.key === 'b' || e.key === 'B') {
      brainOn = !brainOn;
      evoOn = false;
      reset();
    } else if (e.key === 'e' || e.key === 'E') {
      if (evoOn) {
        evoOn = false;
        reset();
      } else {
        brainOn = true;
        startEvolution(brainSeed);
      }
    } else if (e.key === 'p' || e.key === 'P') {
      preset = (preset + 1) % presets.length;
      if (evoOn) {
        startEvolution(brainSeed);
      } else {
        reset();
      }
    } else if (e.key === 't' || e.key === 'T') {
      task = task === 'run' ? 'jump' : task === 'jump' ? 'fly' : task === 'fly' ? 'climb' : 'run';
      world.wall = task === 'climb' ? WALL : null;
      if (evoOn) {
        S.setTask(evo, task, world.wall);
        shownScore = -Infinity;
      }
    } else if (e.key === 'r' || e.key === 'R') {
      if (evoOn) {
        startEvolution(++brainSeed);
      } else {
        reset(brainSeed + 1);
      }
    }
  });
  window.addEventListener('resize', resize);

  resize();
  reset();
  requestAnimationFrame(function (t) { lastT = t; requestAnimationFrame(frame); });
})();
