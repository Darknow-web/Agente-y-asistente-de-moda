/**
 * SASTRA — punto de entrada para servidor Express + Vite.
 */
import fs from 'node:fs';

const compilado = new URL('./server/dist/server/src/index.js', import.meta.url);
if (fs.existsSync(compilado)) {
  await import('./server/dist/server/src/index.js');
} else {
  await import('./server/src/index.js');
}
