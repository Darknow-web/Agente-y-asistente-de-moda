/**
 * Firebase Admin: se inicializa con las credenciales por defecto del entorno
 * (en Cloud Run, la cuenta de servicio del servicio; en local, `gcloud auth application-default login`
 * o los emuladores). No requiere archivo de llave.
 */
import { applicationDefault, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../util/env.js';

let app: App | null = null;
let problema: string | null = null;

interface ConfigApplet {
  projectId?: string;
  storageBucket?: string;
  firestoreDatabaseId?: string;
}

let appletCache: ConfigApplet | null | undefined;

/**
 * `firebase-applet-config.json` lo escribe la integración de Firebase de Google AI Studio en la raíz
 * del repositorio (valores públicos). Sirve de respaldo cuando las variables de entorno no llegan.
 */
export function configApplet(): ConfigApplet {
  if (appletCache !== undefined) return appletCache ?? {};
  appletCache = null;
  const candidatos = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(import.meta.dirname ?? '.', '../../../../firebase-applet-config.json'),
    path.resolve(import.meta.dirname ?? '.', '../../firebase-applet-config.json'),
  ];
  for (const archivo of candidatos) {
    try {
      if (!fs.existsSync(archivo)) continue;
      const datos = JSON.parse(fs.readFileSync(archivo, 'utf8')) as Record<string, unknown>;
      appletCache = {
        projectId: typeof datos.projectId === 'string' ? datos.projectId : undefined,
        storageBucket: typeof datos.storageBucket === 'string' ? datos.storageBucket : undefined,
        firestoreDatabaseId: typeof datos.firestoreDatabaseId === 'string' ? datos.firestoreDatabaseId : undefined,
      };
      break;
    } catch {
      /* archivo ilegible: se ignora */
    }
  }
  return appletCache ?? {};
}

export function proyectoId(): string {
  return (
    env('FIREBASE_PROJECT_ID') ||
    env('GOOGLE_CLOUD_PROJECT') ||
    env('GCLOUD_PROJECT') ||
    env('VITE_FIREBASE_PROJECT_ID') ||
    configApplet().projectId ||
    ''
  );
}

export function bucketNombre(): string {
  return (
    env('FIREBASE_STORAGE_BUCKET') ||
    env('VITE_FIREBASE_STORAGE_BUCKET') ||
    configApplet().storageBucket ||
    (proyectoId() ? `${proyectoId()}.firebasestorage.app` : '')
  );
}

/** AI Studio crea Firestore como base de datos con nombre propio, no "(default)". */
export function baseDeDatosId(): string {
  return env('FIRESTORE_DATABASE_ID') || env('VITE_FIREBASE_DATABASE_ID') || configApplet().firestoreDatabaseId || '';
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

let firestoreCache: Firestore | null = null;

export function db(): Firestore {
  if (firestoreCache) return firestoreCache;
  const a = iniciarFirebase();
  if (!a) throw new Error(problema ?? 'Firebase no disponible');
  const dbId = baseDeDatosId();
  const instancia = dbId ? getFirestore(a, dbId) : getFirestore(a);
  try {
    // Firestore rechaza documentos con campos `undefined` (p. ej. un mensaje sin adjuntos). Con esto
    // los ignora en vez de fallar el guardado. Solo puede llamarse antes del primer uso.
    instancia.settings({ ignoreUndefinedProperties: true });
  } catch {
    /* ya estaba inicializada: se usa tal cual */
  }
  firestoreCache = instancia;
  return instancia;
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
