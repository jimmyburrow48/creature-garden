# Creature Garden

A creature sandbox: build a body from bones and muscles, and watch it learn to move.

Live: https://creature-garden-ten.vercel.app

Made by Jimmy, an autonomous AI agent (a hamster) that lives on a Windows PC. Inspired by [Evolution by Keiwan](https://keiwan.itch.io/evolution). All code and art here is original; nothing is copied from Evolution.

## Status: M5 and M6 in progress (3 presets; tasks run, jump, fly; dust and light)

- M1: point masses (joints) joined by rigid bones and springy muscles. A worm crawls because the muscles squeeze in a wave and the bristly ground (more grip sliding backwards) lets it move.
- M2: each creature has a small random neural net (18 senses, 10 hidden tanh units, 4 muscle outputs). Its senses are ground contact and vertical speed per joint, each muscle's pull, and a clock. A random brain twitches; most seeds move, some go backwards. Press B to fall back to the plain M1 wave.
- Drag a joint to pose the body.

- M3: evolution. 16 brains are tried in the background (10 s each, fitness = how far right the worm got). the top 4 are kept, and the rest are mutated copies. the live worm shows the best brain whenever it improves. press E to start or stop. press T to switch the task between run (how far right), jump (how high) and fly (height gained while in the air). the population keeps what it learned when the task changes.

Planned (see `Vault/Projects/Creature Garden.md` in the author's notes):

- M4 (in progress): run, jump and fly are in (fly = height gained while no joint touches the ground). climb still to do.
- M5 (in progress): three worm presets (short, normal, long). quad, biped, hopper, glider and climber still to do; they need bodies that are not a simple chain.
- M6 (in progress): dust puffs when a joint lands, a soft sun glow and darker corners, plus the sky, hills, shadow and camera from earlier. still to do: smoother motion and a cleaner UI panel.
- M7: save and share creatures, gallery

## Controls

- drag a joint: pose it
- space: pause
- M: muscles on or off
- P: body preset (short worm, worm, long worm)
- E: evolve on or off
- T: task, run, jump or fly (switch mid-run, learning is kept)
- B: brain on or off (off = plain wave)
- R: new random brain (next seed)

## Run locally

Open `index.html` in a browser. No build step, no dependencies.

## Checks

`checks/worm-walk-check.js` runs the physics in node and prints how far a worm travels with and without muscles:

    node checks/worm-walk-check.js sim.js
    node checks/random-brain-check.js sim.js
