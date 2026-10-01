/**
 * Notificaciones push en el navegador o el móvil (Web Push). Si el navegador no las soporta o el
 * servidor no tiene claves, `soportaPush` devuelve false y la app simplemente no lo ofrece.
 */
import { api } from './api';

export function soportaPush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registro(): Promise<ServiceWorkerRegistration> {
  const r = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return r;
}

function aClave(base64url: string): ArrayBuffer {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes.buffer;
}

/** ¿Este dispositivo ya está suscrito? */
export async function estadoPush(): Promise<'activo' | 'inactivo' | 'bloqueado' | 'no-disponible'> {
  if (!soportaPush()) return 'no-disponible';
  if (Notification.permission === 'denied') return 'bloqueado';
  try {
    const r = await navigator.serviceWorker.getRegistration('/');
    const s = await r?.pushManager.getSubscription();
    return s ? 'activo' : 'inactivo';
  } catch {
    return 'inactivo';
  }
}

/** Pide permiso, se suscribe y registra la suscripción en el servidor. */
export async function activarPush(): Promise<void> {
  if (!soportaPush()) throw new Error('Este navegador no permite notificaciones.');
  const { clavePublica } = await api.clavePush();
  if (!clavePublica) throw new Error('Las notificaciones no están configuradas en el servidor todavía.');
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('No diste permiso para las notificaciones.');
  const r = await registro();
  const existente = await r.pushManager.getSubscription();
  const s = existente ?? (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aClave(clavePublica) }));
  await api.suscribirPush({ ...s.toJSON(), dispositivo: navigator.userAgent.slice(0, 120) });
}

export async function desactivarPush(): Promise<void> {
  if (!soportaPush()) return;
  const r = await navigator.serviceWorker.getRegistration('/');
  const s = await r?.pushManager.getSubscription();
  if (!s) return;
  await api.desuscribirPush(s.endpoint).catch(() => undefined);
  await s.unsubscribe();
}
