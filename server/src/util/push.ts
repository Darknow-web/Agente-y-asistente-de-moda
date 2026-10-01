/**
 * Notificaciones push (Web Push con claves VAPID). Sin claves configuradas, no envía nada y no falla:
 * los avisos siguen apareciendo dentro de la app.
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY → `npm run push:claves` las genera.
 *   VAPID_SUBJECT → mailto:tu-correo (lo exige el estándar).
 */
import webpush from 'web-push';
import type { SuscripcionPush } from '@shared/types.js';
import { eliminarSuscripcionPush, listarSuscripcionesPush } from '../data/repos.js';
import { env } from './env.js';

let configurado: boolean | null = null;

export function clavePublicaPush(): string | null {
  return env('VAPID_PUBLIC_KEY') || null;
}

function prepararPush(): boolean {
  if (configurado !== null) return configurado;
  const publica = env('VAPID_PUBLIC_KEY');
  const privada = env('VAPID_PRIVATE_KEY');
  if (!publica || !privada) {
    configurado = false;
    return false;
  }
  try {
    webpush.setVapidDetails(env('VAPID_SUBJECT', 'mailto:hola@sastra.app'), publica, privada);
    configurado = true;
  } catch (e) {
    console.warn('[push] claves VAPID inválidas:', e instanceof Error ? e.message : e);
    configurado = false;
  }
  return configurado;
}

export interface CargaPush {
  titulo: string;
  cuerpo: string;
  /** Ruta dentro de la app que se abre al tocar (p. ej. /hoy). */
  url?: string;
  etiqueta?: string;
}

/** Envía la notificación a todos los dispositivos del usuario. Devuelve cuántos la recibieron. */
export async function enviarPush(uid: string, carga: CargaPush): Promise<number> {
  if (!prepararPush()) return 0;
  let suscripciones: SuscripcionPush[];
  try {
    suscripciones = await listarSuscripcionesPush(uid);
  } catch {
    return 0;
  }
  let enviados = 0;
  for (const s of suscripciones) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.claves }, JSON.stringify(carga), { TTL: 60 * 60 * 12 });
      enviados++;
    } catch (e) {
      const estado = (e as { statusCode?: number })?.statusCode;
      // 404/410: la suscripción caducó o el usuario la revocó → se limpia.
      if (estado === 404 || estado === 410) await eliminarSuscripcionPush(uid, s.endpoint).catch(() => undefined);
      else console.warn('[push] no se pudo enviar:', e instanceof Error ? e.message : e);
    }
  }
  return enviados;
}
