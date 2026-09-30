/**
 * Firebase Admin: se inicializa con las credenciales por defecto del entorno
 * (en Cloud Run, la cuenta de servicio del servicio; en local, `gcloud auth application-default login`
 * o los emuladores). No requiere archivo de llave.
 */
import { applicationDefault, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { env } from '../util/env.js';

let app: App | null = null;
let problema: string | null = null;

export function proyectoId(): string {
  return (
    env('FIREBASE_PROJECT_ID') ||
    env('GOOGLE_CLOUD_PROJECT') ||
    env('GCLOUD_PROJECT') ||
    env('VITE_FIREBASE_PROJECT_ID')
  );
}

export function bucketNombre(): string {
  return env('FIREBASE_STORAGE_BUCKET') || env('VITE_FIREBASE_STORAGE_BUCKET') || (proyectoId() ? `${proyectoId()}.firebasestorage.app` : '');
}

export function firebaseListo(): { listo: boolean; problema?: string } {
  if (app) return { listo: true };
  if (problema) return { listo: false, problema };
  return { listo: false, problema: 'Firebase no se ha inicializado todavía.' };
}

export function iniciarFirebase(): App | null {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }
  const id = proyectoId();
  if (!id) {
    if (!problema) {
      problema =
        'Falta el ID del proyecto de Firebase (FIREBASE_PROJECT_ID o VITE_FIREBASE_PROJECT_ID). Vincula Firestore desde AI Studio o completa el .env.';
      console.warn('[sastra] ' + problema);
    }
    return null;
  }
  try {
    const usaEmulador = !!env('FIRESTORE_EMULATOR_HOST');
    app = initializeApp({
      projectId: id,
      storageBucket: bucketNombre() || undefined,
      ...(usaEmulador ? {} : { credential: applicationDefault() }),
    });
    return app;
  } catch (e) {
    problema = `No se pudo inicializar Firebase Admin: ${e instanceof Error ? e.message : String(e)}`;
    console.warn('[sastra] ' + problema);
    return null;
  }
}

export function db(): Firestore {
  const a = iniciarFirebase();
  if (!a) throw new Error(problema ?? 'Firebase no disponible');
  // AI Studio crea Firestore como base de datos con nombre propio (FIRESTORE_DATABASE_ID), no "(default)".
  const nombreBd = env('FIRESTORE_DATABASE_ID') || env('VITE_FIREBASE_DATABASE_ID');
  return nombreBd ? getFirestore(a, nombreBd) : getFirestore(a);
}

export function auth() {
  const a = iniciarFirebase();
  if (!a) throw new Error(problema ?? 'Firebase no disponible');
  return getAuth(a);
}

export function storage() {
  const a = iniciarFirebase();
  if (!a) throw new Error(problema ?? 'Firebase no disponible');
  return getStorage(a);
}

/** Comprueba conexión real a Firestore (lectura ligera). */
export async function probarFirestore(): Promise<'ok' | 'sin-configurar' | 'error'> {
  if (!iniciarFirebase()) return 'sin-configurar';
  try {
    await db().collection('allowlist').limit(1).get();
    return 'ok';
  } catch (e) {
    console.warn('[sastra] Firestore no responde:', e instanceof Error ? e.message : e);
    return 'error';
  }
}

export async function probarStorage(): Promise<'ok' | 'sin-configurar' | 'error'> {
  if (!iniciarFirebase() || !bucketNombre()) return 'sin-configurar';
  try {
    const [existe] = await storage().bucket().exists();
    return existe ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}
