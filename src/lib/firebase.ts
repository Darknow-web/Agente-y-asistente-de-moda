/**
 * Inicialización de Firebase en el cliente.
 * La configuración pública se lee, en este orden: variables VITE_FIREBASE_* (archivo .env),
 * `src/lib/firebase-config.json` (opcional) y `firebase-applet-config.json` en la raíz del repositorio,
 * que es el archivo que escribe la integración de Firebase de Google AI Studio y que sí está versionado
 * (son valores públicos por diseño). Así la configuración sobrevive a cualquier sincronización con GitHub.
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

type OrigenConfig = 'entorno' | 'json' | 'applet' | 'ninguno';

function desdeJson(origen: 'json' | 'applet'): Partial<ConfigFirebase> | null {
  try {
    const modulos =
      origen === 'json'
        ? import.meta.glob<{ default: Record<string, unknown> }>('./firebase-config.json', { eager: true })
        : import.meta.glob<{ default: Record<string, unknown> }>('/firebase-applet-config.json', { eager: true });
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
let origenConfig: OrigenConfig = config.apiKey ? 'entorno' : 'ninguno';

for (const origen of ['json', 'applet'] as const) {
  if (config.apiKey) break;
  const json = desdeJson(origen);
  if (json?.apiKey) {
    config = { ...config, ...json };
    origenConfig = origen;
  }
}

const faltan = CLAVES.filter((c) => !config[c] && c !== 'storageBucket' && c !== 'messagingSenderId');

export const firebaseConfigurado: boolean = faltan.length === 0;
export let problemaConfig: string | undefined = firebaseConfigurado
  ? undefined
  : origenConfig === 'ninguno'
    ? 'No hay configuración de Firebase: faltan las variables VITE_FIREBASE_* (o el archivo firebase-applet-config.json que escribe AI Studio al vincular Firebase).'
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
    throw new Error(explicarErrorAuth(codigo, e));
  }
}

/** Traduce los códigos de Firebase Auth más comunes a un mensaje con la acción concreta. */
function explicarErrorAuth(codigo: string, e: unknown): string {
  const dominio = typeof window !== 'undefined' ? window.location.hostname : '';
  switch (codigo) {
    case 'auth/unauthorized-domain':
      return `Firebase no reconoce esta dirección (${dominio}). Añádela en la consola de Firebase › Authentication › Settings › Authorized domains y vuelve a intentar.`;
    case 'auth/operation-not-allowed':
      return 'El acceso con Google está apagado. Actívalo en la consola de Firebase › Authentication › Sign-in method › Google.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes para esta página y vuelve a intentar.';
    case 'auth/network-request-failed':
      return 'Sin conexión con Google. Revisa tu internet y vuelve a intentar.';
    default:
      return e instanceof Error ? e.message : 'No se pudo iniciar sesión.';
  }
}

export async function salirDeFirebase(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}
