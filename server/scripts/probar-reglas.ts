/**
 * Comprueba contra el proyecto real que las reglas de Firestore publicadas cierran la escritura del cliente.
 *
 *   npx tsx server/scripts/probar-reglas.ts
 *
 * Necesita credenciales de servidor (las de Cloud Run, `gcloud auth application-default login` o
 * FIREBASE_SERVICE_ACCOUNT) para crear un usuario de prueba temporal. Usa la configuración pública de
 * firebase-applet-config.json, igual que la app. Al terminar borra el usuario y su documento de prueba.
 */
import { initializeApp as iniciarCliente } from 'firebase/app';
import { getAuth as authCliente, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import fs from 'node:fs';
import { auth as authAdmin, db as dbAdmin } from '../src/auth/admin.js';
import { cargarEnv } from '../src/util/env.js';

cargarEnv();
const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8')) as Record<string, string>;
const uid = `prueba-reglas-${Date.now()}`;
let fallos = 0;

function resultado(ok: boolean, texto: string) {
  if (!ok) fallos++;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${texto}`);
}

try {
  const token = await authAdmin().createCustomToken(uid);
  const app = iniciarCliente(config, 'prueba-reglas');
  await signInWithCustomToken(authCliente(app), token);
  const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

  try {
    await setDoc(doc(db, 'users', uid, 'contadores', 'hoy'), { mensajes: 0 });
    resultado(false, 'el cliente pudo escribir su contador (las reglas siguen abiertas: publícalas)');
  } catch (e) {
    resultado(String(e).includes('permission-denied') || String(e).includes('PERMISSION_DENIED'), `escritura del cliente rechazada (${String(e).slice(0, 80)})`);
  }

  try {
    await setDoc(doc(db, 'users', uid, 'suscripcion', 'actual'), { plan: 'premium' });
    resultado(false, 'el cliente pudo escribirse una suscripción');
  } catch {
    resultado(true, 'el cliente no puede escribirse una suscripción');
  }

  await dbAdmin().collection('users').doc(uid).collection('perfil').doc('datos').set({ prueba: true });
  try {
    const leido = await getDoc(doc(db, 'users', uid, 'perfil', 'datos'));
    resultado(leido.exists(), 'el cliente sigue pudiendo leer sus propios datos');
  } catch (e) {
    resultado(false, `el cliente no pudo leer sus propios datos: ${String(e)}`);
  }

  try {
    await getDoc(doc(db, 'users', 'otro-usuario', 'perfil', 'datos'));
    resultado(false, 'el cliente pudo leer datos de otro usuario');
  } catch {
    resultado(true, 'el cliente no puede leer datos de otro usuario');
  }
} finally {
  await dbAdmin().recursiveDelete(dbAdmin().collection('users').doc(uid)).catch(() => undefined);
  await authAdmin().deleteUser(uid).catch(() => undefined);
}

console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : '\nLas reglas protegen los datos.');
process.exit(fallos ? 1 : 0);
