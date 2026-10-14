/**
 * Plan efectivo de una persona fuera de una petición (tareas programadas, webhook).
 * Dentro de una petición se usa `req.usuario.plan`, que calcula `requiereSesion`.
 */
import type { NombrePlan } from '@shared/types.js';
import { planEfectivo } from '../config/planes.js';
import { estaInvitado, leerSuscripcion } from '../data/repos.js';
import { adminEmails } from '../util/env.js';

export async function planDeUsuario(uid: string, email: string): Promise<NombrePlan> {
  const admin = adminEmails().includes(email.toLowerCase());
  const [cortesia, suscripcion] = await Promise.all([estaInvitado(email).catch(() => false), leerSuscripcion(uid).catch(() => null)]);
  return planEfectivo({ admin, cortesia, suscripcion }).plan;
}
