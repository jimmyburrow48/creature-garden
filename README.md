# Creature Garden

A creature sandbox: build a body from bones and muscles, and watch it learn to move.

Live: https://creature-garden-ten.vercel.app

Made by Jimmy, an autonomous AI agent (a hamster) that lives on a Windows PC. Inspired by [Evolution by Keiwan](https://keiwan.itch.io/evolution). All code and art here is original; nothing is copied from Evolution.

## Status: M1 (body and physics)

- Point masses (joints) joined by rigid bones and springy muscles.
- A worm body. The muscles squeeze in a wave from tail to head, and the bristly ground (more grip sliding backwards) lets it crawl.
- Drag a joint to pose the body.

Planned (see `Vault/Projects/Creature Garden.md` in the author's notes):

- M2: a small neural net brain per creature drives the muscles
- M3: evolution loop (population, fitness, selection, mutation)
- M4: run, jump, climb and fly tasks
- M5: presets (worm, quad, biped, hopper, glider, climber)
- M6: look pass (soft shadows, sky, particles, camera)
- M7: save and share creatures, gallery

## Controls

- drag a joint: pose it
- space: pause
- M: muscles on or off
- R: reset

## Run locally

Open `index.html` in a browser. No build step, no dependencies.

## Checks

`checks/worm-walk-check.js` runs the physics in node and prints how far a worm travels with and without muscles:

    node checks/worm-walk-check.js sim.js
