import { defineConfig } from 'vite';
import { generatePages, sourceFiles, basePath } from './scripts/pages.mjs';

const input = generatePages();

export default defineConfig({
  base: basePath,
  plugins: [{
    name: 'resume-pages',
    configureServer(server) {
      server.watcher.add(sourceFiles);
    },
    handleHotUpdate(ctx) {
      if (!sourceFiles.includes(ctx.file)) return;
      generatePages();
      ctx.server.ws.send({ type: 'full-reload' });
      return [];
    },
    buildStart() {
      for (const file of sourceFiles) this.addWatchFile(file);
      generatePages();
    },
  }],
  build: { rolldownOptions: { input } },
});
