# Asset Packer Tool

A powerful web-based tool for managing and packing GLTF assets into a single optimized GLB file with Draco compression.

## Features

- 🔍 **Auto-scan**: Automatically scans `src/assets` directory for all GLTF files
- ✅ **Interactive Selection**: Web interface with checkboxes to select files
- 🔎 **Real-time Filter**: Search/filter files by name or path
- 💾 **Persistent Storage**: Selection persists across sessions
- 📝 **TypeScript Manifest**: Auto-generates `src/assets/manifest.ts` file
- 📦 **GLB Packing**: Combines selected files into one `packed.glb` with Draco compression
- 🔄 **Live Updates**: WebSocket connection for real-time updates
- 🌐 **Auto Browser**: Automatically opens browser when started
- 🚪 **Auto Shutdown**: Server stops when browser tab is closed

## Usage

```bash
npm run asset-packer
```

This will:
1. Start a local HTTP server on port 3456
2. Automatically open your browser to the interface
3. Scan for all GLTF files in `src/assets`
4. Load your previous selection (if any)

## Interface

### Filter Bar
Type to search files by name or path. Works with both visible file names and full paths.

### Selection Controls
- **Select All**: Selects all visible (filtered) files
- **Deselect All**: Deselects all visible (filtered) files
- **PACK**: Combines selected files into a single GLB

### File List
- Click anywhere on a file row to toggle selection
- Files with associated `.bin` files show a "+ BIN" badge
- Shows full relative path from `src/assets`

## Output Files

### `src/assets/manifest.ts`
TypeScript manifest as a constant array of safe names that match the GLB hierarchy:
```typescript
export const ASSET_MANIFEST = [
  "3d_scenes_SITE_22_SITE_22_gltf"
] as const;
```

Each entry is the `safeName` used to prefix all scenes, nodes, and meshes for that model in the packed GLB file.

### `src/assets/packed.glb`
Single GLB file containing all selected models with Draco compression. All scenes, nodes, and meshes are prefixed with their `safeName` to ensure uniqueness.

For example:
- Scene: `3d_scenes_SITE_22_SITE_22_gltf_scene_0`
- Nodes: `3d_scenes_SITE_22_SITE_22_gltf_node_0`, `3d_scenes_SITE_22_SITE_22_gltf_CustomNodeName`
- Meshes: `3d_scenes_SITE_22_SITE_22_gltf_mesh_0`, `3d_scenes_SITE_22_SITE_22_gltf_MeshName`

### `tools/assetPacker.config.json`
Persistent configuration storing your selection:
```json
{
  "selected": [
    "3d/scenes/SITE_22/SITE_22.gltf"
  ]
}
```

## Architecture

- **Server**: Native Node.js HTTP server (no Express)
- **WebSocket**: Real-time bidirectional communication
- **Heartbeat**: 500ms heartbeat to detect tab closure
- **Auto-shutdown**: Server closes 1 second after last client disconnects

## Technical Details

### GLTF Merging
The tool merges GLTF files by combining:
- Scenes
- Nodes
- Meshes
- Materials
- Textures
- Accessors
- Buffers

### Draco Compression
Uses `@gltf-transform/functions` with `draco()` transform and `draco3dgltf` encoder/decoder modules for maximum compression.

## Files Structure

```
tools/
  assetPackerServer.js     # Main server file
  assetPacker.config.json  # Persistent selection config
  assetPacker/             # Client files
    index.html             # Web interface
    styles.css             # Styling
    client.js              # Client-side logic
```

## Dependencies

Required packages (already in package.json):
- `ws` - WebSocket server
- `@gltf-transform/core` - GLTF manipulation
- `@gltf-transform/extensions` - GLTF extensions support
- `@gltf-transform/functions` - GLTF transforms including Draco
- `draco3dgltf` - Draco compression codecs
