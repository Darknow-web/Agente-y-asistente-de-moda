#!/usr/bin/env node
/**
 * Descarga el modelo de recorte de fondo (U2Net en ONNX, Apache 2.0, 176 MB) a ./modelos.
 * Lo ejecuta el Dockerfile al construir la imagen y `npm run modelo:recorte` en local.
 * Si ya está, no hace nada. Si la descarga falla, avisa y sale con 0: la app funciona sin recorte.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const ARCHIVO = 'u2net.onnx';
const URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx';
const TAMANO_MIN = 170_000_000;

const carpeta = process.env.MODELOS_DIR?.trim() || path.resolve(process.cwd(), 'modelos');
const destino = path.join(carpeta, ARCHIVO);

if (fs.existsSync(destino) && fs.statSync(destino).size > TAMANO_MIN) {
  console.log(`[modelo] ${ARCHIVO} ya está en ${carpeta}.`);
  process.exit(0);
}
fs.mkdirSync(carpeta, { recursive: true });
const temporal = `${destino}.parte`;
try {
  console.log(`[modelo] descargando ${ARCHIVO} (176 MB)…`);
  const res = await fetch(URL, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(temporal));
  if (fs.statSync(temporal).size < TAMANO_MIN) throw new Error('archivo incompleto');
  fs.renameSync(temporal, destino);
  console.log(`[modelo] listo: ${destino}`);
} catch (e) {
  fs.rmSync(temporal, { force: true });
  console.warn(`[modelo] no se pudo descargar ${ARCHIVO}: ${e instanceof Error ? e.message : e}. Las fotos se guardarán sin recortar; vuelve a intentar con "npm run modelo:recorte".`);
  process.exit(0);
}
