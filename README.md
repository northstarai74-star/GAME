# Space Explorer - 3D Space Game

A quick prototype 3D space exploration game built with Three.js and Vite.

## Features

- **3D Space Environment**: Procedurally generated starfield with planets and asteroids
- **WASD Controls**: Move your spaceship with WASD keys
  - W/↑: Forward
  - S/↓: Backward  
  - A/←: Strafe left
  - D/→: Strafe right
  - Space: Move up
  - Ctrl: Move down
- **Mouse Look**: Click and drag mouse to look around (pointer lock enabled)
- **HUD Display**: Real-time speed and position readout
- **Smooth Physics**: Velocity-based movement with inertia and friction

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The game will open at `http://localhost:5173/`

### Build

```bash
npm build
```

## Game Mechanics

- Navigate through space populated with planets (Jupiter, Saturn, Neptune-like), a sun, and asteroid fields
- Movement uses physics-based velocity with friction for smooth controls
- Boundary limits keep the player from wandering too far (±2000 units)
- Maximum speed limit to prevent unlimited acceleration

## Controls Reference

| Key | Action |
|-----|--------|
| W / ↑ | Move forward |
| S / ↓ | Move backward |
| A / ← | Strafe left |
| D / → | Strafe right |
| Space | Move up |
| Ctrl | Move down |
| Mouse | Look around (click to enable pointer lock) |

## Future Enhancements

- Landing on planets
- Space stations to visit
- Procedural galaxy generation
- Mining asteroids
- Combat with space pirates
- Multiplayer exploration
- Improved textures and models
- Sound effects and music

## Technology Stack

- **Three.js**: 3D graphics library
- **Vite**: Modern build tool and dev server
- **JavaScript**: Pure vanilla JS, no frameworks

## License

MIT
