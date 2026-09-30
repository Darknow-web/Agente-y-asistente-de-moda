import type { NextFunction, Request, Response } from 'express';
import { auth } from './admin.js';
import { adminEmails, env } from '../util/env.js';
import { noAutorizado, prohibido } from '../util/errores.js';
import { estaInvitado } from '../data/repos.js';

export interface UsuarioReq {
  uid: string;
  email: string;
  nombre?: string;
  foto?: string;
  admin: boolean;
  invitado: boolean;
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
    const invitado = admin || (await estaInvitado(email));
    req.usuario = {
      uid: decodificado.uid,
      email,
      nombre: decodificado.name,
      foto: decodificado.picture,
      admin,
      invitado,
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
    return next(prohibido('Tu correo aún no está en la lista de invitados de SASTRA.'));
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
