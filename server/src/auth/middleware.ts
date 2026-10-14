import type { NextFunction, Request, Response } from 'express';
import { auth } from './admin.js';
import { adminEmails, env } from '../util/env.js';
import { noAutorizado, prohibido } from '../util/errores.js';
import { estaInvitado, leerSuscripcion } from '../data/repos.js';
import { leerPlanes, planEfectivo } from '../config/planes.js';
import type { NombrePlan, OrigenPlan, Suscripcion } from '@shared/types.js';

export interface UsuarioReq {
  uid: string;
  email: string;
  nombre?: string;
  foto?: string;
  admin: boolean;
  /** Puede usar la app: acceso abierto, administrador o cortesía. */
  invitado: boolean;
  /** Correo en la lista de cortesías (Premium sin pagar). */
  cortesia: boolean;
  plan: NombrePlan;
  origenPlan: OrigenPlan;
  suscripcion: Suscripcion | null;
}

/** Caché breve de la suscripción por uid, para no leer Firestore en cada petición. El webhook la invalida. */
const cacheSuscripcion = new Map<string, { s: Suscripcion | null; hasta: number }>();
const TTL_SUSCRIPCION_MS = 20_000;

export function olvidarSuscripcionEnCache(uid: string): void {
  cacheSuscripcion.delete(uid);
}

async function suscripcionDe(uid: string): Promise<Suscripcion | null> {
  const c = cacheSuscripcion.get(uid);
  if (c && c.hasta > Date.now()) return c.s;
  const s = await leerSuscripcion(uid).catch(() => null);
  cacheSuscripcion.set(uid, { s, hasta: Date.now() + TTL_SUSCRIPCION_MS });
  return s;
}

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: UsuarioReq;
  }
}

/** Verifica el ID token de Firebase y carga el usuario en req.usuario. */
export async function requiereSesion(req: Request, _res: Response, next: NextFunction) {
  try {
    const cabecera = req.header('authorization') ?? '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
    if (!token) throw noAutorizado();
    const decodificado = await auth().verifyIdToken(token);
    const email = (decodificado.email ?? '').toLowerCase();
    if (!email) throw noAutorizado('Tu cuenta de Google no tiene correo visible.');
    const admin = adminEmails().includes(email);
    const [cortesia, suscripcion] = await Promise.all([estaInvitado(email), suscripcionDe(decodificado.uid)]);
    const { plan, origen } = planEfectivo({ admin, cortesia, suscripcion });
    req.usuario = {
      uid: decodificado.uid,
      email,
      nombre: decodificado.name,
      foto: decodificado.picture,
      admin,
      invitado: leerPlanes().accesoAbierto || admin || cortesia,
      cortesia,
      plan,
      origenPlan: origen,
      suscripcion,
    };
    next();
  } catch (e) {
    if (e instanceof Error && e.name === 'ErrorHttp') return next(e);
    next(noAutorizado('Tu sesión no es válida o expiró. Vuelve a entrar.'));
  }
}

/** Solo usuarios en la lista de invitados (o administradores). */
export function requiereInvitado(req: Request, _res: Response, next: NextFunction) {
  if (!req.usuario) return next(noAutorizado());
  if (!req.usuario.invitado) {
    return next(prohibido('SASTRA está en acceso por invitación y tu correo aún no está en la lista.'));
  }
  next();
}

export function requiereAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.usuario) return next(noAutorizado());
  if (!req.usuario.admin) return next(prohibido('Solo quien administra SASTRA puede hacer esto.'));
  next();
}

/** Tareas programadas: cabecera x-jobs-secret. */
export function requiereSecretoJobs(req: Request, _res: Response, next: NextFunction) {
  const esperado = env('JOBS_SECRET');
  const recibido = req.header('x-jobs-secret') ?? '';
  if (!esperado || recibido !== esperado) return next(prohibido('Secreto de tareas incorrecto.'));
  next();
}
