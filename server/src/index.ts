/**
 * SASTRA — servidor Express: API + cliente compilado (dist/) en el mismo puerto.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { cargarEnv, env, esProduccion } from './util/env.js';
cargarEnv();

import { iniciarFirebase } from './auth/admin.js';
import { manejadorErrores } from './util/errores.js';
import { rutasSalud } from './routes/salud.js';
import { rutasCuenta } from './routes/cuenta.js';
import { rutasArmario } from './routes/armario.js';
import { rutasPlanes } from './routes/planes.js';
import { rutasChat } from './routes/chat.js';
import { rutasJobs } from './routes/jobs.js';
import { rutasProbador } from './routes/probador.js';
import { leerLimites } from './config/limites.js';

// Un fallo asíncrono fuera de una ruta (p. ej. credenciales de Firestore) no debe tumbar el servidor:
// se registra y la ruta correspondiente responderá con error.
process.on('unhandledRejection', (razon) => {
  console.error('[sastra] promesa sin manejar:', razon instanceof Error ? razon.message : razon);
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

const limites = leerLimites();
// Fotos y videos viajan en base64 dentro del JSON; el límite se calcula desde limites.json
app.use(express.json({ limit: `${Math.ceil(limites.videoMaxMB * 1.4) + 2}mb` }));

// Cabeceras de seguridad básicas
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
  next();
});

app.use('/api', rutasSalud);
app.use('/api', rutasCuenta);
app.use('/api', rutasArmario);
app.use('/api', rutasPlanes);
app.use('/api', rutasChat);
app.use('/api', rutasProbador);
app.use('/api', rutasJobs);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Esa ruta no existe.' }));

// Cliente: en desarrollo se usa Vite en modo middleware; en producción se sirve dist/
if (esProduccion()) {
  const dist = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(import.meta.dirname ?? '.', '../../../dist'),
  ].find((d) => fs.existsSync(path.join(d, 'index.html')));

  if (dist) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    app.get('/', (_req, res) =>
      res.type('text').send('SASTRA API en marcha. El cliente no está compilado: ejecuta `npm run build`.')
    );
  }
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, host: '0.0.0.0', hmr: false },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.use(manejadorErrores);

const puerto = esProduccion() ? Number(env('PORT', '8080')) : 3000;
app.listen(puerto, '0.0.0.0', () => {
  const fb = iniciarFirebase();
  console.log(
    `[sastra] servidor en http://0.0.0.0:${puerto} · modo motor: ${env('MOTOR_MODO', 'real')} · firebase: ${
      fb ? 'inicializado' : 'sin configurar'
    } · llave gemini: ${env('GEMINI_API_KEY') ? 'sí' : 'no'} · llave claude: ${
      env('ANTHROPIC_API_KEY') ? 'sí' : 'no'
    }`
  );
});
