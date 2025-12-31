import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import AutoImport from 'unplugin-auto-import/vite'
import { codeInspectorPlugin } from 'code-inspector-plugin'

// https://vite.dev/config/
export default defineConfig({
  base: './', // utools 需要相对路径
  plugins: [
    codeInspectorPlugin({
      bundler: 'vite',
      hideConsole: true,
      hideDomPathAttr: true,
    }),
    react(),
    AutoImport({
      imports: [
        'react',
        {
          'lucide-react': [
            // Common Icons
            'Plus', 'Trash2', 'FileText', 'MoreHorizontal', 'Check', 'X', 
            'ChevronRight', 'ChevronDown', 'Search', 'Settings', 'Menu',
            'Image', 'Link', 'Code', 'List', 'ListOrdered' 
          ],
          'clsx': ['clsx'],
        }
      ],
      dts: 'src/auto-imports.d.ts',
      dirs: ['src/hooks', 'src/stores', 'src/lib'], // Added src/lib to auto-import utils like cn, UToolsAdapter
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'zustand'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover', '@radix-ui/react-tooltip', 'lucide-react'],
          'vendor-tiptap': [
            '@tiptap/core', 
            '@tiptap/react', 
            '@tiptap/starter-kit', 
            '@tiptap/extension-image',
            '@tiptap/extension-link',
            '@tiptap/extension-placeholder',
            '@tiptap/extension-task-list',
            '@tiptap/extension-task-item',
            '@tiptap/extension-table',
          ],
          'vendor-hightlight': ['lowlight', '@tiptap/extension-code-block-lowlight'],
        }
      }
    },
    chunkSizeWarningLimit: 1000, // Tiptap is heavy, increase limit
  }
})

