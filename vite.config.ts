import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'
import wasm from "vite-plugin-wasm"
import { ViteEjsPlugin } from 'vite-plugin-ejs'
import { analyzer } from 'vite-bundle-analyzer'

const ENV = process.env.ENV || 'production'

console.table({ ENV })

const config = defineConfig({
  base: './',
  assetsInclude: ['**/*.glb', '**/*.mid'],
  plugins: [
    {
      name: 'remove-sourcemaps',
      transform(code) {
        return {
          code,
          map: { mappings: '' }
        }
      }
    },
    ViteEjsPlugin({
      ENV: ENV,
      PROJECT: 'architect',
    }),
    wasm(),
    checker({
      typescript: true,
    }),
    // process.env.NODE_ENV === 'production' && analyzer()
  ],
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  define: {
    'process.env.ENV': JSON.stringify(ENV),
    'process.env.PROJECT': JSON.stringify('architect'),
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    assetsInlineLimit: 1024 * 4,
    chunkSizeWarningLimit: 1024 * 4,
    emptyOutDir: true,
    outDir: `dist/architect`,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  },
  preview: {
    port: 3000,
    open: true,
    host: '0.0.0.0',
    cors: false,
    proxy: {},
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
})

export default config
