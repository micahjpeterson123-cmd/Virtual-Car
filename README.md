# Virtual Car

A real-time WebGL2 scene featuring a drivable car beneath a glass semisphere that renders live refraction and reflection of the surrounding environment, computed every frame via a dynamically generated environment cubemap.

**[Live Demo →](https://micahjpeterson123-cmd.github.io/Virtual-Car/)**

## Overview

This project renders a small city scene — a car, ground plane, and a mix of short and tall buildings — inside a skybox, with the car drivable in real time via keyboard input. Mounted on top of the car is a glass semisphere that simulates optical refraction and reflection by sampling a cubemap rendered from the semisphere's own position each frame, rather than relying on a static precomputed environment map.

Built with raw WebGL2 (no rendering engine or framework) and TypeScript, with all shaders hand-written in GLSL.

## Features

- **Drivable car** with forward/backward motion, wheel-based steering, and a heading model derived from the car's wheelbase and steering angle (similar to a bicycle/Ackermann steering approximation)
- **Dynamic environment cubemap** — re-rendered from the semisphere's viewpoint every frame across all 6 cube faces, so reflections/refractions stay accurate as the car moves and turns
- **Live refraction and reflection modes**, toggleable at runtime, with an adjustable index of refraction
- **Multi-light Phong-style lighting**: one overhead light plus two independently toggleable headlights, with light positions/directions transformed into eye space per frame
- **Skybox** rendered from a 6-image cubemap for the surrounding environment
- **Chase camera** that follows and orients with the car

## Controls

| Key | Action |
|---|---|
| `↑` | Drive forward |
| `↓` | Drive backward |
| `←` | Turn wheels left |
| `→` | Turn wheels right |
| `Space` | Stop the car |
| `1` | Refraction mode (default) |
| `2` | Reflection mode |
| `0` | Toggle overhead light |
| `9` | Toggle headlights |

## Tech Stack

- **WebGL2** — core rendering, no external 3D libraries
- **TypeScript** — compiled to JS via `tsc` (see `tsconfig.json`)
- **GLSL** — six hand-written shaders (car/scene, skybox, and glass semisphere, each with a vertex + fragment pair)
- **Custom math helpers** (`helperfunctions.ts`) — matrix/vector math, shader compilation utilities, and camera transforms written from scratch (no gl-matrix or similar)

## Project Structure

```
├── index.html                  # entry point, canvas + control legend
├── FinalProject.ts             # main app logic: scene setup, render loop, input handling
├── helperfunctions.ts          # matrix/vector math, shader loading utilities
├── vShader.glsl / fShader.glsl              # car, ground, and building shading
├── vShaderSkybox.glsl / fShaderSkybox.glsl  # skybox rendering
├── vShaderSemisphere.glsl / fShaderSemisphere.glsl  # glass semisphere refraction/reflection
└── px.png, nx.png, py.png, ny.png, pz.png, nz.png   # skybox cubemap faces
```

## Running Locally

Shader and texture files are loaded via `fetch()`, which requires the project to be served over HTTP rather than opened directly from disk. From the project root:

```bash
npx serve .
```

or any equivalent local static server, then open the printed `localhost` URL in a browser that supports WebGL2.

If editing `FinalProject.ts` or `helperfunctions.ts`, recompile with:

```bash
tsc
```

## Notes

The headlights are currently disabled by default. Generating the environment cubemap from the semisphere's own viewpoint interacts unexpectedly with the headlight light sources in a way that hasn't been fully diagnosed yet — the headlights render correctly from the main chase camera, but break specifically when seen through the refractive cubemap pass. Toggle them with `9` to see the effect.
