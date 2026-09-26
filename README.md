# Stellar Drift

A 3D space flight game built with Three.js. Pilot the Kestrel through an uncharted star system and recover all 30 energy cores as fast as you can.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

`dist/` is fully static (relative asset paths), so it deploys as-is to Vercel, Netlify, or GitHub Pages.

## Controls

| Input | Action |
|-------|--------|
| Mouse | Steer (click the game to lock the pointer; or drag) |
| W / S | Thrust / reverse |
| A / D | Strafe |
| Space / C | Rise / descend |
| Q / E | Roll |
| Shift | Boost (drains energy, cores refill it) |
| M | Mute |
| Esc / P | Pause |

## What's in it

- **Procedural planets**: textures generated at load from 3D noise (seamless). They include an Earth-like world with clouds and polar ice, a lava world with glowing cracks, an ice world, and two banded gas giants (one with rings and a storm). There is also a cratered moon.
- **Atmospheres**: sun-aware Fresnel rim and halo shaders.
- **Animated sun**: a noise-driven surface shader with a corona sprite and HDR bloom.
- **Nebula skybox**: an fbm shader, also used as the environment map for metal reflections.
- **Starfield**: 6,000 twinkling colored stars, plus parallax space dust for a sense of speed.
- **Asteroid belt**: 1,800 instanced, noise-deformed, tumbling rocks with collisions.
- **Orbital station**: a rotating habitat ring, solar arrays, and blinking beacons.
- **Ship**: modeled from primitives, with a particle engine exhaust, banking, and a chase camera with FOV kick and shake.
- **Post-processing**: bloom, chromatic aberration (scales with boost), vignette, film grain, and an impact flash.
- **HUD**: radar, target markers with distances, an off-screen arrow to the nearest core, and screen-space lens flares.
- **Synthesized audio**: engine hum, boost rumble, collection chimes, and impact thuds.
- **Scoring**: collection chains, a mission timer, and a best time saved locally.

## Structure

```
src/
  main.js            game state, loop, camera, collisions
  ship.js            ship model + flight model
  hud.js             HUD, radar, markers, lens flares
  postfx.js          bloom + lens shader pipeline
  input.js, audio.js
  noise.js, glsl.js  CPU Perlin noise, GLSL simplex noise
  world/             sky, sun, planets, textures, asteroids, station, cores
  effects/           exhaust particles, collection bursts
```
