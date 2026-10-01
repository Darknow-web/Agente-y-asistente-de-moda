/**
 * Fotos de prendas en Firebase Storage. El servidor sube (ya comprimidas por el cliente)
 * y devuelve URLs con token de descarga, que funcionan en <img> sin autenticación adicional
 * pero son imposibles de adivinar.
 */
import { randomUUID } from 'node:crypto';
import { bucketNombre, storage } from '../auth/admin.js';
import type { Adjunto } from '@shared/types.js';

export async function subirFotoPrenda(uid: string, prendaId: string, foto: Adjunto): Promise<{ url: string; ruta: string }> {
  if (!foto.datos) throw new Error('La foto no trae datos.');
  const ext = foto.mime === 'image/png' ? 'png' : foto.mime === 'image/webp' ? 'webp' : 'jpg';
  const ruta = `users/${uid}/prendas/${prendaId}.${ext}`;
  const token = randomUUID();
  const archivo = storage().bucket().file(ruta);
  await archivo.save(Buffer.from(foto.datos, 'base64'), {
    contentType: foto.mime,
    resumable: false,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketNombre()}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
  return { url, ruta };
}

/** Sube bytes ya procesados (foto pulida) como `users/{uid}/prendas/{id}-{sufijo}.jpg`. */
export async function subirBytesPrenda(uid: string, prendaId: string, sufijo: string, datos: Buffer, mime = 'image/jpeg'): Promise<{ url: string; ruta: string }> {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const ruta = `users/${uid}/prendas/${prendaId}-${sufijo}.${ext}`;
  const token = randomUUID();
  const archivo = storage().bucket().file(ruta);
  await archivo.save(datos, { contentType: mime, resumable: false, metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketNombre()}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
  return { url, ruta };
}

/** Ruta dentro del bucket a partir de una URL de descarga nuestra, o null si no es de este bucket. */
export function rutaDeUrl(url: string): string | null {
  const m = /\/o\/([^?]+)/.exec(url);
  if (!m) return null;
  try {
    const ruta = decodeURIComponent(m[1]);
    return ruta.startsWith('users/') ? ruta : null;
  } catch {
    return null;
  }
}

/** Descarga los bytes de una foto de prenda guardada en nuestro bucket. */
export async function descargarFoto(url: string): Promise<{ datos: Buffer; mime: string }> {
  const ruta = rutaDeUrl(url);
  if (!ruta) throw new Error('La foto no está en el almacenamiento de SASTRA.');
  const archivo = storage().bucket().file(ruta);
  const [datos] = await archivo.download();
  const [meta] = await archivo.getMetadata().catch(() => [{ contentType: undefined }]);
  return { datos, mime: (meta as { contentType?: string }).contentType ?? 'image/jpeg' };
}

export async function borrarFotoPrenda(uid: string, prendaId: string): Promise<void> {
  const base = `users/${uid}/prendas/${prendaId}`;
  const [archivos] = await storage().bucket().getFiles({ prefix: base });
  // Solo los archivos de esta prenda: `{id}.jpg` y `{id}-pulida.jpg`, nunca otra prenda con id parecido.
  await Promise.all(archivos.filter((a) => a.name.startsWith(`${base}.`) || a.name.startsWith(`${base}-`)).map((a) => a.delete().catch(() => undefined)));
}
