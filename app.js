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
  var creature = null;
  var cam = { x: START_X };
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
    world.creatures = [];
    world.time = 0;
    creature = S.makeWorm({ x: START_X - 60, y: START_Y, segments: 6, gap: 34, name: 'worm' });
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
  function sy(y) { return (y - VIEW_TOP) * scale; }
  function wx(px) { return (px - width / 2) / scale + cam.x; }
  function wy(py) { return py / scale + VIEW_TOP; }

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

  function draw() {
    drawSky();
    drawHills(0.25, 230, 26, 'rgba(170,205,190,0.8)', 0.4);
    drawHills(0.5, 262, 18, 'rgba(120,175,140,0.9)', 2.1);
    drawGround();
    if (creature) {
      drawShadow(S.centre(creature));
      drawCreature(creature);
    }
    drawHud();
  }

  function drawHud() {
    if (!creature) return;
    var c = S.centre(creature);
    var dist = (c.x - START_X + 60) / 34; // body segments travelled
    var secs = world.time;
    hud.textContent =
      'creature garden  ·  M2 brain\n' +
      'time ' + secs.toFixed(1) + ' s  ·  travelled ' + dist.toFixed(1) + ' body lengths\n' +
      'brain ' + (creature.brain ? 'random net, seed ' + brainSeed : 'off (plain wave)') +
      '  ·  muscles ' + (world.muscles ? 'on' : 'off') + '  ·  ' + (paused ? 'paused' : 'running') +
      '\ndrag a joint to pose  ·  B brain  ·  M muscles  ·  space pause  ·  R new brain';
  }

  function frame(t) {
    var dt = Math.min((t - lastT) / 1000, 1 / 30);
    lastT = t;
    if (!paused) {
      acc += dt;
      while (acc >= fixedDt) {
        S.step(world, fixedDt, 4);
        acc -= fixedDt;
      }
    }
    // camera: ease towards the creature's middle
    if (creature) {
      var target = S.centre(creature).x;
      cam.x += (target - cam.x) * Math.min(1, dt * 4);
    }
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
      reset();
    } else if (e.key === 'r' || e.key === 'R') {
      reset(brainSeed + 1);
    }
  });
  window.addEventListener('resize', resize);

  resize();
  reset();
  requestAnimationFrame(function (t) { lastT = t; requestAnimationFrame(frame); });
})();
