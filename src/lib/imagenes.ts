/**
 * Preparación de fotos y videos antes de enviarlos a la API.
 * Las fotos se comprimen en el navegador (canvas, JPEG) respetando la orientación EXIF.
 */
import type { Adjunto } from '@shared/types';

export const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
export const VIDEO_MAX_SEGUNDOS = 60;

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    lector.onload = () => {
      const resultado = String(lector.result ?? '');
      const coma = resultado.indexOf(',');
      resolver(coma >= 0 ? resultado.slice(coma + 1) : resultado);
    };
    lector.readAsDataURL(blob);
  });
}

async function cargarFuente(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* algunos navegadores no aceptan la opción: se usa <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => rechazar(new Error('La imagen no se pudo abrir.'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function nombreJpeg(nombre: string): string {
  return nombre.replace(/\.[^.]+$/, '') + '.jpg';
}

/** Comprime una foto a JPEG con lado máximo `ladoMax` y devuelve un Adjunto listo para la API. */
export async function comprimirImagen(
  file: File,
  ladoMax = 1024,
  calidad = 0.82,
): Promise<Adjunto> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
  const fuente = await cargarFuente(file);
  const anchoOrig = 'naturalWidth' in fuente ? fuente.naturalWidth : fuente.width;
  const altoOrig = 'naturalHeight' in fuente ? fuente.naturalHeight : fuente.height;
  const escala = Math.min(1, ladoMax / Math.max(anchoOrig, altoOrig));
  const ancho = Math.max(1, Math.round(anchoOrig * escala));
  const alto = Math.max(1, Math.round(altoOrig * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite procesar la imagen.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(fuente, 0, 0, ancho, alto);
  if ('close' in fuente) fuente.close();

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, 'image/jpeg', calidad),
  );
  if (!blob) throw new Error('No se pudo comprimir la imagen.');
  return {
    tipo: 'imagen',
    mime: 'image/jpeg',
    datos: await blobABase64(blob),
    nombre: nombreJpeg(file.name || 'foto'),
  };
}

function leerDuracion(file: File): Promise<number> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const limpiar = () => URL.revokeObjectURL(url);
    video.onloadedmetadata = () => {
      const d = video.duration;
      limpiar();
      resolver(Number.isFinite(d) ? d : 0);
    };
    video.onerror = () => {
      limpiar();
      rechazar(new Error('El video no se pudo abrir.'));
    };
    video.src = url;
  });
}

/** Valida un video (≤ 20 MB, ≤ 60 s) y lo devuelve como Adjunto en base64. */
export async function prepararVideo(file: File): Promise<Adjunto> {
  if (!file.type.startsWith('video/')) throw new Error('El archivo no es un video.');
  if (file.size > VIDEO_MAX_BYTES) {
    throw new Error('El video pesa más de 20 MB. Graba uno más corto o bájale la calidad.');
  }
  const duracion = await leerDuracion(file);
  if (duracion > VIDEO_MAX_SEGUNDOS) {
    throw new Error('El video dura más de un minuto. Recórtalo antes de enviarlo.');
  }
  return {
    tipo: 'video',
    mime: file.type,
    datos: await blobABase64(file),
    nombre: file.name || 'video',
  };
}

/** Prepara cualquier archivo (foto o video) según su tipo. */
export async function prepararArchivo(file: File): Promise<Adjunto> {
  if (file.type.startsWith('video/')) return prepararVideo(file);
  return comprimirImagen(file);
}

/** URL para mostrar un adjunto en pantalla. */
export function urlDeAdjunto(adjunto: Adjunto): string | undefined {
  if (adjunto.url) return adjunto.url;
  if (adjunto.datos) return `data:${adjunto.mime};base64,${adjunto.datos}`;
  return undefined;
}
