/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves the site from /civ/; the dev server stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/civ/' : '/',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
