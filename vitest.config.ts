import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    alias: {
      '@dimforge/rapier3d': path.resolve(__dirname, './test/stubs/rapier3d.ts'),
    },
  },
})
