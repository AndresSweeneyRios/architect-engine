# Architect

WebGPU-first game engine prototype built with TypeScript, React, and Vite.

Architect combines a custom deferred renderer, fixed-step simulation, and an asset packing pipeline for large scene workflows.

## Highlights

- Custom WebGPU renderer with WGSL shaders and deferred G-buffer passes
- Stylized lighting/color treatment with palette quantization + ordered dithering
- Fixed-step simulation loop (60 Hz target) with interpolation for rendering
- ECS-style state organization using repository-driven simulation state
- Rapier3D physics integration
- Scene loading via URL query (for example, `?scene=SITE_22`)
- Input layer with keyboard, mouse, and gamepad support
- Asset pipeline for GLTF/GLB processing, atlas/manifest generation, and Brotli workflows
- React-based shell UI (viewport + dialogue UI)

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+
- A browser with WebGPU support (`navigator.gpu` required)
  - Latest Chrome or Edge is recommended
- Optional (for content tooling):
  - Blender (for the Blender add-on workflow)

## Quick Start

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in terminal (typically `http://localhost:5173`).

## Core Commands

### App Runtime

- `npm run dev` - start local development server
- `npm run build` - create production build
- `npm run preview` - preview build output locally
- `npm run test` - run test suite (Vitest)

### Engine + Content Tools

- `npm run engine` - run animation generation and execute `engine/index.ts`
- `npm run optimize-glb` - optimize GLB assets
- `npm run generate-animations` - generate animation artifacts
- `npm run generate-brotli` - generate Brotli-compressed outputs
- `npm run asset-packer` - open interactive asset packer server/UI
- `npm run build-assets` - run asset packer in CLI mode
- `npm run install-blender-addon` - install the Blender add-on helper

## Typical Asset Workflow

1. Place or update scene/model sources under `src/assets`.
2. Run `npm run asset-packer` for interactive file selection and packing.
3. Or run `npm run build-assets` for CLI packing.
4. Run `npm run generate-animations` if animation data changed.
5. Run `npm run dev` and validate scene rendering.

## Project Structure (High-Level)

- `src/graphics/webgpu` - renderer context, camera, GPU resources, draw path
- `src/graphics/shaders` - WGSL shaders and rendering stages
- `src/simulation` - simulation state, systems, commands, and repositories
- `src/scenes` - scene definitions and scene bootstrap loading
- `src/input` - player and device input normalization/control
- `src/audio` - audio loading and volume utilities
- `tools/assetPacker` - interactive + CLI asset packing toolchain
- `engine` - engine-side generation/bootstrap scripts

## Scene Selection

The app supports loading scenes from the URL query string:

- Example: `http://localhost:5173/?scene=SITE_22`

If no scene query is provided, the default scene is loaded.
