/**
 * Acceso a Firestore. Estructura:
 *   users/{uid}/perfil/perfil          (documento único)
 *   users/{uid}/prendas/{id}
 *   users/{uid}/usos/{id}
 *   users/{uid}/planes/{semanaInicio}
 *   users/{uid}/deseos/{id}
 *   users/{uid}/conversaciones/{id}
 *   users/{uid}/avisos/{id}
 *   users/{uid}/ajustes/{id}           (memoria de cómo le queda la ropa)
 *   users/{uid}/push/{id}              (suscripciones a notificaciones)
 *   users/{uid}/uso/{id}               (registro de tokens y costo)
 *   users/{uid}/contadores/{YYYY-MM-DD} (mensajes del día)
 *   allowlist/{email}
 *   usuarios/{uid}                     (índice: email, último acceso; para tareas programadas)
 */
import { FieldValue } from 'firebase-admin/firestore';
import type {
  Ajuste,
  Aviso,
  Conversacion,
  Deseo,
  Mensaje,
  NivelAjuste,
  Perfil,
  PlanSemanal,
  Prenda,
  RegistroUso,
  SuscripcionPush,
  Uso,
} from '@shared/types.js';
import type { Invitado } from '@shared/api.js';
import { db } from '../auth/admin.js';
import { ahora, fechaLocal, nuevoId } from '../util/ids.js';

const usuario = (uid: string) => db().collection('users').doc(uid);

// ---------------------------------------------------------------- allowlist
export async function estaInvitado(email: string): Promise<boolean> {
  const doc = await db().collection('allowlist').doc(email.toLowerCase()).get();
  return doc.exists;
}

export async function listarInvitados(): Promise<Invitado[]> {
  const snap = await db().collection('allowlist').orderBy('agregadoEn', 'desc').get();
  return snap.docs.map((d) => ({ email: d.id, ...(d.data() as Omit<Invitado, 'email'>) }));
}

export async function agregarInvitado(email: string, agregadoPor: string): Promise<void> {
  await db()
    .collection('allowlist')
    .doc(email.toLowerCase())
    .set({ agregadoEn: ahora(), agregadoPor }, { merge: true });
}

export async function quitarInvitado(email: string): Promise<void> {
  await db().collection('allowlist').doc(email.toLowerCase()).delete();
}

// ---------------------------------------------------------------- índice de usuarios
export async function registrarAcceso(uid: string, email: string, nombre?: string): Promise<void> {
  await db()
    .collection('usuarios')
    .doc(uid)
    .set({ email, nombre: nombre ?? null, ultimoAcceso: ahora() }, { merge: true });
}

export async function listarUsuariosActivos(): Promise<{ uid: string; email: string }[]> {
  const snap = await db().collection('usuarios').get();
  return snap.docs.map((d) => ({ uid: d.id, email: (d.data().email as string) ?? '' }));
}

// ---------------------------------------------------------------- perfil
export async function leerPerfil(uid: string): Promise<Perfil> {
  const doc = await usuario(uid).collection('perfil').doc('perfil').get();
  return (doc.data() as Perfil | undefined) ?? {};
}

export async function guardarPerfil(uid: string, cambios: Partial<Perfil>): Promise<Perfil> {
  const ref = usuario(uid).collection('perfil').doc('perfil');
  const existe = (await ref.get()).exists;
  await ref.set(
    { ...cambios, actualizadoEn: ahora(), ...(existe ? {} : { creadoEn: ahora() }) },
    { merge: true },
  );
  return leerPerfil(uid);
}

/** Añade aprendizajes sin duplicar (los agentes van "conociendo" al cliente). */
export async function agregarAprendizajes(uid: string, nuevos: string[]): Promise<void> {
  if (!nuevos.length) return;
  await usuario(uid)
    .collection('perfil')
    .doc('perfil')
    .set({ aprendizajes: FieldValue.arrayUnion(...nuevos), actualizadoEn: ahora() }, { merge: true });
}

// ---------------------------------------------------------------- prendas
export async function listarPrendas(uid: string): Promise<Prenda[]> {
  const snap = await usuario(uid).collection('prendas').orderBy('creadaEn', 'desc').get();
  return snap.docs.map((d) => d.data() as Prenda);
}

export async function leerPrenda(uid: string, id: string): Promise<Prenda | null> {
  const doc = await usuario(uid).collection('prendas').doc(id).get();
  return (doc.data() as Prenda | undefined) ?? null;
}

export async function crearPrenda(
  uid: string,
  datos: Omit<Prenda, 'id' | 'creadaEn' | 'actualizadaEn'>,
): Promise<Prenda> {
  const id = nuevoId('p');
  const prenda: Prenda = { ...datos, id, creadaEn: ahora(), actualizadaEn: ahora() };
  await usuario(uid).collection('prendas').doc(id).set(prenda);
  return prenda;
}

export async function actualizarPrenda(uid: string, id: string, cambios: Partial<Prenda>): Promise<Prenda | null> {
  const ref = usuario(uid).collection('prendas').doc(id);
  if (!(await ref.get()).exists) return null;
  const { id: _i, creadaEn: _c, ...resto } = cambios;
  await ref.set({ ...resto, actualizadaEn: ahora() }, { merge: true });
  return leerPrenda(uid, id);
}

export async function eliminarPrenda(uid: string, id: string): Promise<void> {
  await usuario(uid).collection('prendas').doc(id).delete();
}

export async function registrarUso(uid: string, prendaId: string, contexto?: string, ajuste?: NivelAjuste): Promise<Prenda | null> {
  const prenda = await leerPrenda(uid, prendaId);
  if (!prenda) return null;
  const usos = (prenda.usosDesdeLavado ?? 0) + 1;
  const max = prenda.usosMaxAntesDeLavar ?? 3;
  const estado: Prenda['estado'] = usos >= max ? 'para-lavar' : 'usada';
  const fecha = ahora();
  const uso: Uso = { id: nuevoId('u'), prendaId, fecha, contexto };
  const lote = db().batch();
  lote.set(usuario(uid).collection('usos').doc(uso.id), uso);
  lote.set(
    usuario(uid).collection('prendas').doc(prendaId),
    { usosDesdeLavado: usos, estado, usosTotales: (prenda.usosTotales ?? 0) + 1, ultimoUso: fecha, actualizadaEn: fecha },
    { merge: true },
  );
  if (ajuste) {
    const registro: Ajuste = { id: nuevoId('aj'), prendaId, marca: prenda.marca, categoria: prenda.categoria, ajuste, fecha };
    lote.set(usuario(uid).collection('ajustes').doc(registro.id), registro);
  }
  await lote.commit();
  return leerPrenda(uid, prendaId);
}

export async function marcarLavada(uid: string, prendaId: string): Promise<Prenda | null> {
  return actualizarPrenda(uid, prendaId, { usosDesdeLavado: 0, estado: 'limpia' });
}

/** Último uso por prenda, mirando también el historial antiguo (prendas creadas antes de `ultimoUso`). */
export async function ultimoUsoPorPrenda(uid: string): Promise<Map<string, string>> {
  const snap = await usuario(uid).collection('usos').orderBy('fecha', 'desc').limit(2000).get();
  const mapa = new Map<string, string>();
  for (const d of snap.docs) {
    const u = d.data() as Uso;
    if (!mapa.has(u.prendaId)) mapa.set(u.prendaId, u.fecha);
  }
  return mapa;
}

// ---------------------------------------------------------------- ajustes (memoria de calce)
export async function listarAjustes(uid: string, max = 60): Promise<Ajuste[]> {
  const snap = await usuario(uid).collection('ajustes').orderBy('fecha', 'desc').limit(max).get();
  return snap.docs.map((d) => d.data() as Ajuste);
}

export async function crearAjuste(uid: string, datos: Omit<Ajuste, 'id' | 'fecha'>): Promise<Ajuste> {
  const ajuste: Ajuste = { ...datos, id: nuevoId('aj'), fecha: ahora() };
  await usuario(uid).collection('ajustes').doc(ajuste.id).set(ajuste);
  return ajuste;
}

// ---------------------------------------------------------------- notificaciones push
export async function listarSuscripcionesPush(uid: string): Promise<SuscripcionPush[]> {
  const snap = await usuario(uid).collection('push').get();
  return snap.docs.map((d) => d.data() as SuscripcionPush);
}

export async function guardarSuscripcionPush(uid: string, datos: Omit<SuscripcionPush, 'id' | 'creadoEn'>): Promise<SuscripcionPush> {
  // Una suscripción por endpoint: si ya existe, se conserva.
  const existentes = await listarSuscripcionesPush(uid);
  const previa = existentes.find((s) => s.endpoint === datos.endpoint);
  if (previa) return previa;
  const s: SuscripcionPush = { ...datos, id: nuevoId('push'), creadoEn: ahora() };
  await usuario(uid).collection('push').doc(s.id).set(s);
  return s;
}

export async function eliminarSuscripcionPush(uid: string, endpoint: string): Promise<void> {
  const existentes = await listarSuscripcionesPush(uid);
  const lote = db().batch();
  for (const s of existentes) if (s.endpoint === endpoint) lote.delete(usuario(uid).collection('push').doc(s.id));
  await lote.commit();
}

export async function usosRecientes(uid: string, dias = 14): Promise<Uso[]> {
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const snap = await usuario(uid).collection('usos').where('fecha', '>=', desde).get();
  return snap.docs.map((d) => d.data() as Uso);
}

// ---------------------------------------------------------------- planes
export async function leerPlan(uid: string, semanaInicio: string): Promise<PlanSemanal | null> {
  const doc = await usuario(uid).collection('planes').doc(semanaInicio).get();
  return (doc.data() as PlanSemanal | undefined) ?? null;
}

export async function guardarPlan(uid: string, plan: PlanSemanal): Promise<void> {
  await usuario(uid).collection('planes').doc(plan.semanaInicio).set(plan);
}

// ---------------------------------------------------------------- deseos
export async function listarDeseos(uid: string): Promise<Deseo[]> {
  const snap = await usuario(uid).collection('deseos').orderBy('creadoEn', 'desc').get();
  return snap.docs.map((d) => d.data() as Deseo);
}

const DIAS_ENFRIAMIENTO = 7;

export async function crearDeseo(uid: string, datos: Omit<Deseo, 'id' | 'creadoEn'>): Promise<Deseo> {
  const creadoEn = ahora();
  const recordatorioEn = new Date(Date.parse(creadoEn) + DIAS_ENFRIAMIENTO * 86400000).toISOString();
  const deseo: Deseo = { recordatorioEn, recordado: false, ...datos, id: nuevoId('d'), creadoEn };
  await usuario(uid).collection('deseos').doc(deseo.id).set(deseo);
  return deseo;
}

export async function actualizarDeseo(uid: string, id: string, cambios: Partial<Deseo>): Promise<void> {
  await usuario(uid).collection('deseos').doc(id).set({ ...cambios }, { merge: true });
}

export async function eliminarDeseo(uid: string, id: string): Promise<void> {
  await usuario(uid).collection('deseos').doc(id).delete();
}

// ---------------------------------------------------------------- conversaciones
export async function listarConversaciones(uid: string): Promise<Pick<Conversacion, 'id' | 'titulo' | 'actualizadaEn'>[]> {
  const snap = await usuario(uid).collection('conversaciones').orderBy('actualizadaEn', 'desc').limit(30).get();
  return snap.docs.map((d) => {
    const c = d.data() as Conversacion;
    return { id: c.id, titulo: c.titulo, actualizadaEn: c.actualizadaEn };
  });
}

export async function leerConversacion(uid: string, id: string): Promise<Conversacion | null> {
  const doc = await usuario(uid).collection('conversaciones').doc(id).get();
  return (doc.data() as Conversacion | undefined) ?? null;
}

export async function guardarConversacion(uid: string, conversacion: Conversacion): Promise<void> {
  // Los adjuntos en base64 no se guardan en Firestore (pesan demasiado): solo su URL si la hay.
  const limpia: Conversacion = {
    ...conversacion,
    mensajes: conversacion.mensajes.map((m) => {
      const { adjuntos, ...resto } = m;
      return adjuntos?.length ? { ...resto, adjuntos: adjuntos.map(({ datos: _d, ...a }) => a) } : resto;
    }),
  };
  await usuario(uid).collection('conversaciones').doc(conversacion.id).set(limpia);
}

export function nuevoMensaje(rol: Mensaje['rol'], texto: string, extra: Partial<Mensaje> = {}): Mensaje {
  return { id: nuevoId('m'), rol, texto, creadoEn: ahora(), ...extra };
}

// ---------------------------------------------------------------- avisos
export async function listarAvisos(uid: string): Promise<Aviso[]> {
  const snap = await usuario(uid).collection('avisos').orderBy('creadoEn', 'desc').limit(50).get();
  return snap.docs.map((d) => d.data() as Aviso);
}

export async function crearAviso(uid: string, datos: Omit<Aviso, 'id' | 'creadoEn' | 'leido'>): Promise<Aviso> {
  const aviso: Aviso = { ...datos, id: nuevoId('a'), creadoEn: ahora(), leido: false };
  await usuario(uid).collection('avisos').doc(aviso.id).set(aviso);
  return aviso;
}

export async function marcarAvisoLeido(uid: string, id: string): Promise<Aviso | null> {
  const ref = usuario(uid).collection('avisos').doc(id);
  const doc = await ref.get();
  if (!doc.exists) return null;
  await ref.set({ leido: true }, { merge: true });
  return { ...(doc.data() as Aviso), leido: true };
}

/** Evita duplicar el mismo aviso (por tipo) en el mismo día. */
export async function existeAvisoHoy(uid: string, tipo: Aviso['tipo']): Promise<boolean> {
  const hoy = fechaLocal();
  const snap = await usuario(uid)
    .collection('avisos')
    .where('tipo', '==', tipo)
    .where('creadoEn', '>=', `${hoy}T00:00:00.000Z`)
    .limit(1)
    .get();
  return !snap.empty;
}

// ---------------------------------------------------------------- uso y contadores
export async function registrarConsumo(uid: string, registro: Omit<RegistroUso, 'id'>): Promise<void> {
  const id = nuevoId('c');
  await usuario(uid).collection('uso').doc(id).set({ ...registro, id });
}

export async function resumenConsumoMes(mes: string): Promise<RegistroUso[]> {
  // collectionGroup para sumar todos los usuarios (solo admin)
  const snap = await db()
    .collectionGroup('uso')
    .where('fecha', '>=', `${mes}-01T00:00:00.000Z`)
    .where('fecha', '<', `${mes}-31T23:59:59.999Z`)
    .get();
  return snap.docs.map((d) => d.data() as RegistroUso);
}

export async function mensajesHoy(uid: string): Promise<number> {
  const doc = await usuario(uid).collection('contadores').doc(fechaLocal()).get();
  return (doc.data()?.mensajes as number | undefined) ?? 0;
}

export async function sumarMensajeHoy(uid: string): Promise<number> {
  const ref = usuario(uid).collection('contadores').doc(fechaLocal());
  await ref.set({ mensajes: FieldValue.increment(1) }, { merge: true });
  return mensajesHoy(uid);
}
