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

export async function borrarFotoPrenda(uid: string, prendaId: string): Promise<void> {
  const [archivos] = await storage().bucket().getFiles({ prefix: `users/${uid}/prendas/${prendaId}.` });
  await Promise.all(archivos.map((a) => a.delete().catch(() => undefined)));
}
