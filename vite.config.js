import { defineConfig } from 'vite';
export default defineConfig({ base: './', optimizeDeps: {include:['fflate','pdfjs-dist','pdf-lib','pdfmake/build/pdfmake','pdfmake/build/vfs_fonts']}, build: {chunkSizeWarningLimit: 2800} });
