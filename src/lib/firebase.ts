/**
 * Inicialización de Firebase en el cliente.
 * La configuración pública se lee de las variables VITE_FIREBASE_* (archivo .env) y, si están
 * vacías, de `src/lib/firebase-config.json` (opcional, ignorado por git).
 * Este módulo nunca lanza al cargar: expone `firebaseConfigurado` y `problemaConfig`.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';

interface ConfigFirebase {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

const CLAVES: (keyof ConfigFirebase)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

function desdeEntorno(): ConfigFirebase {
  const env = import.meta.env;
  return {
    apiKey: String(env.VITE_FIREBASE_API_KEY ?? ''),
    authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN ?? ''),
    projectId: String(env.VITE_FIREBASE_PROJECT_ID ?? ''),
    storageBucket: String(env.VITE_FIREBASE_STORAGE_BUCKET ?? ''),
    messagingSenderId: String(env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ''),
    appId: String(env.VITE_FIREBASE_APP_ID ?? ''),
    firestoreDatabaseId: String(env.VITE_FIREBASE_DATABASE_ID ?? env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ?? ''),
  };
}

function desdeJson(): Partial<ConfigFirebase> | null {
  try {
    const modulos = import.meta.glob<{ default: Record<string, unknown> }>('./firebase-config.json', {
      eager: true,
    });
    const modulo = Object.values(modulos)[0];
    const datos = modulo?.default ?? (modulo as unknown as Record<string, unknown> | undefined);
    if (!datos || typeof datos !== 'object') return null;
    const salida: Partial<ConfigFirebase> = {};
    for (const clave of CLAVES) {
      const valor = datos[clave];
      if (typeof valor === 'string' && valor) salida[clave] = valor;
    }
    const dbId = datos.firestoreDatabaseId ?? datos.databaseId;
    if (typeof dbId === 'string' && dbId) {
      salida.firestoreDatabaseId = dbId;
    }
    return salida;
  } catch {
    return null;
  }
}

let config = desdeEntorno();
let origenConfig: 'entorno' | 'json' | 'ninguno' = config.apiKey ? 'entorno' : 'ninguno';

if (!config.apiKey) {
  const json = desdeJson();
  if (json?.apiKey) {
    config = { ...config, ...json };
    origenConfig = 'json';
  }
}

const faltan = CLAVES.filter((c) => !config[c] && c !== 'storageBucket' && c !== 'messagingSenderId');

export const firebaseConfigurado: boolean = faltan.length === 0;
export let problemaConfig: string | undefined = firebaseConfigurado
  ? undefined
  : origenConfig === 'ninguno'
    ? 'No hay configuración de Firebase: faltan las variables VITE_FIREBASE_* (o src/lib/firebase-config.json).'
    : `La configuración de Firebase está incompleta: falta ${faltan.join(', ')}.`;

export const proyectoId: string = config.projectId;
export const databaseId: string = config.firestoreDatabaseId ?? '';
export { origenConfig };

export let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;

if (firebaseConfigurado) {
  try {
    app = initializeApp(config);
    auth = getAuth(app);
    auth.languageCode = 'es';
    db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);
    // Verificación de conexión inicial a Firestore
    getDocFromServer(doc(db, 'test', 'connection')).catch((error) => {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration.');
      }
    });
  } catch (e) {
    app = null;
    auth = null;
    db = null;
    problemaConfig = `Firebase no pudo iniciarse: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const proveedor = new GoogleAuthProvider();
proveedor.setCustomParameters({ prompt: 'select_account' });

function esMovil(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** Inicia sesión con Google. Popup primero; en móvil, si el popup falla, redirección. */
export async function entrarConGoogle(): Promise<void> {
  if (!auth) throw new Error(problemaConfig ?? 'Firebase no está configurado.');
  try {
    await signInWithPopup(auth, proveedor);
  } catch (e) {
    const codigo = (e as { code?: string })?.code ?? '';
    const popupFallo =
      codigo === 'auth/popup-blocked' ||
      codigo === 'auth/popup-closed-by-user' ||
      codigo === 'auth/cancelled-popup-request' ||
      codigo === 'auth/operation-not-supported-in-this-environment' ||
      codigo === 'auth/web-storage-unsupported';
    if (esMovil() && popupFallo && codigo !== 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, proveedor);
      return;
    }
    if (codigo === 'auth/popup-closed-by-user') return;
    throw e;
  }
}

export async function salirDeFirebase(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}
