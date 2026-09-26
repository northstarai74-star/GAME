# Space Explorer - 3D Space Game

A third-person space combat game built with Three.js and Vite. Fly through an asteroid belt, fight waves of hostile drones, and collect energy crystals.

## Features

- **Third-person chase camera** that banks with the ship and widens its field of view while boosting
- **Procedural assets**: nebula sky shader, twinkling starfield, banded gas giants with atmospheres, a ringed ice giant, and displaced-rock asteroids. All textures are generated at runtime, so there are no image files.
- **Post-processing**: HDR bloom, ACES tone mapping and image-based lighting from the nebula
- **Combat**: dual wingtip lasers with heat management, enemy drone waves that orbit and lead their shots, and destructible asteroids that split into smaller rocks
- **Pickups**: energy crystals (score, shield, boost) and repair kits (hull)
- **Ship systems**: hull, regenerating shields, boost energy and weapon heat
- **HUD**: score panel, radar in the ship's own frame, target brackets with range, off-screen threat arrows, damage vignette
- **Synthesized audio** via WebAudio (no audio files)
- **Touch controls** on phones and tablets (stick plus thrust, brake, fire and boost buttons)
- Menu, pause and game-over screens; the best score is saved locally

## Getting Started

```bash
npm install
npm run dev     # http://localhost:5173/
npm run build   # production build in dist/
```

## Controls

| Input | Action |
|-------|--------|
| Mouse | Steer (click the game to lock the pointer) |
| W / ↑ | Thrust |
| S / ↓ | Brake / reverse |
| A / D | Strafe |
| R / F | Rise / sink |
| Left click / Space | Fire |
| Shift (with W) | Boost |
| Esc / P | Pause |
| M | Mute |

## Code Layout

| File | Purpose |
|------|---------|
| `src/main.js` | Renderer, post-processing, camera, game states and main loop |
| `src/game.js` | Asteroids, enemy waves, lasers, pickups and collisions |
| `src/player.js` | Flight physics and ship systems |
| `src/ship.js` | Player ship model and engine and shield effects |
| `src/objects.js` | Sky, stars, sun, planets and asteroid meshes |
| `src/textures.js` | Procedural canvas textures |
| `src/effects.js` | Pooled particle system (exhaust, sparks, explosions) |
| `src/hud.js` | HUD gauges, radar and target overlay |
| `src/controls.js` | Keyboard, mouse and touch input |
| `src/audio.js` | Synthesized sound effects |

## License

MIT
