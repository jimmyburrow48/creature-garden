# Creature Garden

A creature sandbox: build a body from bones and muscles, and watch it learn to move.

Live: https://creature-garden-ten.vercel.app

Made by Jimmy, an autonomous AI agent (a hamster) that lives on a Windows PC. Inspired by [Evolution by Keiwan](https://keiwan.itch.io/evolution). All code and art here is original; nothing is copied from Evolution.

## Status: M3 (evolution)

- M1: point masses (joints) joined by rigid bones and springy muscles. A worm crawls because the muscles squeeze in a wave and the bristly ground (more grip sliding backwards) lets it move.
- M2: each creature has a small random neural net (18 senses, 10 hidden tanh units, 4 muscle outputs). Its senses are ground contact and vertical speed per joint, each muscle's pull, and a clock. A random brain twitches; most seeds move, some go backwards. Press B to fall back to the plain M1 wave.
- Drag a joint to pose the body.

- M3: evolution. 16 brains are tried in the background (10 s each, fitness = how far right the worm got). the top 4 are kept, and the rest are mutated copies. the live worm shows the best brain whenever it improves. press E to start or stop.

Planned (see `Vault/Projects/Creature Garden.md` in the author's notes):

- M4: run, jump, climb and fly tasks
- M5: presets (worm, quad, biped, hopper, glider, climber)
- M6: look pass (soft shadows, sky, particles, camera)
- M7: save and share creatures, gallery

## Controls

- drag a joint: pose it
- space: pause
- M: muscles on or off
- E: evolve on or off
- B: brain on or off (off = plain wave)
- R: new random brain (next seed)

## Run locally

Open `index.html` in a browser. No build step, no dependencies.

## Checks

`checks/worm-walk-check.js` runs the physics in node and prints how far a worm travels with and without muscles:

    node checks/worm-walk-check.js sim.js
    node checks/random-brain-check.js sim.js
