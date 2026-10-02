/**
 * Recorte y pulido de fotos de prendas, sin IA generativa y sin costo por foto.
 *
 *  - La máscara de la prenda la calcula U2Net (licencia Apache 2.0), un modelo abierto de
 *    segmentación de 176 MB que corre en el propio servidor con ONNX Runtime: un segundo por foto
 *    y menos de 1 GB de memoria. Se carga una sola vez y las fotos se procesan de una en una.
 *  - `componerPrenda` es pura (probada en recorte.test.ts): recorta al contorno de la prenda,
 *    la centra sobre el lino de la marca en formato 4:5 y nivela la luz.
 *
 * Si el modelo no está disponible (descarga fallida, sin memoria), `mascaraDePrenda` devuelve
 * null y la foto se queda como la subió el cliente. Nunca bloquea el catálogo.
 */
import path from 'node:path';
import fs from 'node:fs';
import type { ReadableStream as FlujoWeb } from 'node:stream/web';
import sharp from 'sharp';

/** Color de fondo del armario: el lino de la marca (docs/DISEÑO.md). */
export const LINO = '#eeeae1';
/** Formato de la foto pulida: 4:5, el mismo de las tarjetas del armario. */
export const ANCHO_SALIDA = 1080;
export const ALTO_SALIDA = 1350;

/** Modelo U2Net en ONNX, publicado por rembg (Apache 2.0). Lo descarga server/scripts/descargar-modelo.mjs. */
export const ARCHIVO_MODELO = 'u2net.onnx';
export const URL_MODELO = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx';
/** Carpeta donde queda el modelo (el Dockerfile lo descarga en la imagen; en local, `npm run modelo:recorte`). */
export const CARPETA_MODELOS = process.env.MODELOS_DIR?.trim() || path.resolve(process.cwd(), 'modelos');

export interface Mascara {
  ancho: number;
  alto: number;
  /** Un byte por píxel: 0 fondo, 255 prenda. */
  datos: Buffer;
}

export interface Encuadre {
  izquierda: number;
  arriba: number;
  ancho: number;
  alto: number;
  /** Fracción del área de la imagen que ocupa la prenda (0..1). */
  cobertura: number;
}

/**
 * Rectángulo que contiene la prenda, con un margen alrededor. Devuelve null si la máscara está
 * casi vacía (el modelo no encontró nada) o cubre casi toda la imagen (no hay fondo que quitar).
 */
export function encuadreDeMascara(m: Mascara, margen = 0.06, umbral = 128): Encuadre | null {
  let minX = m.ancho, minY = m.alto, maxX = -1, maxY = -1, pixeles = 0;
  for (let y = 0; y < m.alto; y++) {
    const fila = y * m.ancho;
    for (let x = 0; x < m.ancho; x++) {
      if (m.datos[fila + x] >= umbral) {
        pixeles++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cobertura = pixeles / (m.ancho * m.alto);
  if (maxX < 0 || cobertura < 0.02 || cobertura > 0.97) return null;
  const mx = Math.round((maxX - minX + 1) * margen);
  const my = Math.round((maxY - minY + 1) * margen);
  const izquierda = Math.max(0, minX - mx);
  const arriba = Math.max(0, minY - my);
  const derecha = Math.min(m.ancho - 1, maxX + mx);
  const abajo = Math.min(m.alto - 1, maxY + my);
  return { izquierda, arriba, ancho: derecha - izquierda + 1, alto: abajo - arriba + 1, cobertura };
}

/**
 * Compone la foto pulida: aplica la máscara como transparencia, recorta al encuadre, da un toque de
 * contraste y centra la prenda sobre el lino en 4:5. Devuelve JPEG. Si la máscara no sirve, devuelve null.
 */
export async function componerPrenda(imagen: Buffer, mascara: Mascara): Promise<Buffer | null> {
  const encuadre = encuadreDeMascara(mascara);
  if (!encuadre) return null;

  // Suavizar el borde de la máscara para que el recorte no quede dentado.
  const mascaraSuave = await sharp(mascara.datos, { raw: { width: mascara.ancho, height: mascara.alto, channels: 1 } })
    .blur(1.2)
    .toColourspace('b-w') // sharp devolvería 3 canales si no se lo pedimos en gris
    .raw()
    .toBuffer();

  const base = await sharp(imagen)
    .rotate() // respeta la orientación EXIF del celular
    .resize(mascara.ancho, mascara.alto, { fit: 'fill' })
    .removeAlpha()
    // Toque de contraste y nitidez muy suave: la foto debe seguir siendo fiel a la prenda (sin estirar
    // el histograma, que oscurece prendas negras sobre fondos claros).
    .linear(1.04, -4)
    .sharpen({ sigma: 0.8 })
    .raw()
    .toBuffer();

  const rgba = Buffer.alloc(mascara.ancho * mascara.alto * 4);
  for (let i = 0, j = 0; i < mascaraSuave.length; i++, j += 4) {
    rgba[j] = base[i * 3];
    rgba[j + 1] = base[i * 3 + 1];
    rgba[j + 2] = base[i * 3 + 2];
    rgba[j + 3] = mascaraSuave[i];
  }

  // La prenda ocupa como máximo el 86 % del lienzo, centrada.
  const maxAncho = Math.round(ANCHO_SALIDA * 0.86);
  const maxAlto = Math.round(ALTO_SALIDA * 0.86);
  const prenda = await sharp(rgba, { raw: { width: mascara.ancho, height: mascara.alto, channels: 4 } })
    .extract({ left: encuadre.izquierda, top: encuadre.arriba, width: encuadre.ancho, height: encuadre.alto })
    .resize(maxAncho, maxAlto, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();

  return sharp({ create: { width: ANCHO_SALIDA, height: ALTO_SALIDA, channels: 3, background: LINO } })
    .composite([{ input: prenda, gravity: 'centre' }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/** Miniatura 4:5 (400 px de ancho) para listas y tarjetas. */
export async function miniatura(jpeg: Buffer): Promise<Buffer> {
  return sharp(jpeg).resize(400, 500, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
}

// ------------------------------------------------------------------ modelo de segmentación

/** Lado de entrada de U2Net. */
const LADO_MODELO = 320;
const MEDIA = [0.485, 0.456, 0.406];
const DESVIACION = [0.229, 0.224, 0.225];

type Segmentador = (imagen: Buffer) => Promise<Mascara | null>;
let segmentador: Promise<Segmentador | null> | null = null;
let cola: Promise<unknown> = Promise.resolve();

export function rutaDelModelo(): string {
  return path.join(CARPETA_MODELOS, ARCHIVO_MODELO);
}

export function modeloDisponibleEnDisco(): boolean {
  return fs.existsSync(rutaDelModelo());
}

/**
 * Si el constructor no dejó el modelo en la imagen (por ejemplo, AI Studio sin nuestro Dockerfile), se descarga
 * una vez al primer uso. En Cloud Run el disco es memoria, así que cuenta dentro de los 2 GiB del servicio.
 */
async function asegurarModelo(): Promise<boolean> {
  if (modeloDisponibleEnDisco()) return true;
  const destino = rutaDelModelo();
  const temporal = `${destino}.parte`;
  try {
    console.log(`[imagenes] descargando el modelo de recorte (176 MB) a ${destino}…`);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    const res = await fetch(URL_MODELO, { redirect: 'follow', signal: AbortSignal.timeout(180_000) });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const { pipeline } = await import('node:stream/promises');
    const { Readable } = await import('node:stream');
    await pipeline(Readable.fromWeb(res.body as FlujoWeb), fs.createWriteStream(temporal));
    if (fs.statSync(temporal).size < 170_000_000) throw new Error('archivo incompleto');
    fs.renameSync(temporal, destino);
    return true;
  } catch (e) {
    fs.rmSync(temporal, { force: true });
    console.warn(`[imagenes] no se pudo descargar el modelo de recorte: ${e instanceof Error ? e.message : e}. Las fotos se guardan sin recortar.`);
    return false;
  }
}

async function cargarSegmentador(): Promise<Segmentador | null> {
  if (!(await asegurarModelo())) return null;
  try {
    const ort = await import('onnxruntime-node');
    const sesion = await ort.InferenceSession.create(rutaDelModelo(), { executionProviders: ['cpu'], graphOptimizationLevel: 'all' });
    const entradaNombre = sesion.inputNames[0];
    const salidaNombre = sesion.outputNames[0];
    console.log(`[imagenes] modelo de recorte cargado (${ARCHIVO_MODELO})`);
    return async (imagen: Buffer) => {
      // Tamaño de trabajo: 1024 px de lado mayor (suficiente para el armario).
      const trabajo = await sharp(imagen).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const { data } = await sharp(trabajo.data, { raw: { width: trabajo.info.width, height: trabajo.info.height, channels: 3 } })
        .resize(LADO_MODELO, LADO_MODELO, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const n = LADO_MODELO * LADO_MODELO;
      const entrada = new Float32Array(3 * n);
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < 3; c++) entrada[c * n + i] = (data[i * 3 + c] / 255 - MEDIA[c]) / DESVIACION[c];
      }
      const salida = await sesion.run({ [entradaNombre]: new ort.Tensor('float32', entrada, [1, 3, LADO_MODELO, LADO_MODELO]) });
      const pred = salida[salidaNombre].data as Float32Array;
      const chica = mascaraDesdePrediccion(pred, LADO_MODELO, LADO_MODELO);
      const datos = await sharp(chica, { raw: { width: LADO_MODELO, height: LADO_MODELO, channels: 1 } })
        .resize(trabajo.info.width, trabajo.info.height, { fit: 'fill' })
        .toColourspace('b-w')
        .raw()
        .toBuffer();
      return { ancho: trabajo.info.width, alto: trabajo.info.height, datos };
    };
  } catch (e) {
    console.warn('[imagenes] no se pudo cargar el modelo de recorte; las fotos se guardan sin recortar:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Normaliza la predicción (mín..máx → 0..255), como hace rembg con U2Net. Pura, probada. */
export function mascaraDesdePrediccion(pred: ArrayLike<number>, ancho: number, alto: number): Buffer {
  const n = ancho * alto;
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pred[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const rango = mx - mn || 1;
  const salida = Buffer.alloc(n);
  for (let i = 0; i < n; i++) salida[i] = Math.round(((pred[i] - mn) / rango) * 255);
  return salida;
}

/**
 * Máscara de la prenda (0 fondo, 255 prenda) a 1024 px de lado mayor, o null si el modelo no está.
 * Las llamadas se encolan: una foto a la vez, para que varias subidas en paralelo no disparen la memoria.
 */
export async function mascaraDePrenda(imagen: Buffer): Promise<Mascara | null> {
  segmentador ??= cargarSegmentador();
  const seg = await segmentador;
  if (!seg) return null;
  const tarea = cola.then(() => seg(imagen));
  cola = tarea.catch(() => undefined);
  return tarea;
}

/** Recorte completo: máscara + composición. Null si no se pudo (sin modelo o prenda no detectada). */
export async function recortarPrenda(imagen: Buffer): Promise<Buffer | null> {
  const mascara = await mascaraDePrenda(imagen);
  if (!mascara) return null;
  return componerPrenda(imagen, mascara);
}
