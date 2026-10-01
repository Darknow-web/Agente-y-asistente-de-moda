/**
 * Un aviso = entrada en la app + notificación push (si el usuario la activó).
 * Los departamentos y las tareas programadas avisan por aquí para que ambas cosas vayan juntas.
 */
import type { Aviso, NombreAgente, TipoAviso } from '@shared/types.js';
import { crearAviso } from './repos.js';
import { enviarPush } from '../util/push.js';

const DESTINO: Partial<Record<TipoAviso, string>> = {
  'look-del-dia': '/hoy',
  'plan-semanal': '/semana',
  lavado: '/armario',
  compra: '/perfil#deseos',
  deseo: '/perfil#deseos',
  estreno: '/hoy',
  dormida: '/armario?filtro=dormidas',
  diario: '/avisos',
};

export async function avisar(
  uid: string,
  datos: { tipo: TipoAviso; titulo: string; cuerpo: string; agente?: NombreAgente; datos?: Record<string, unknown>; url?: string; sinPush?: boolean },
): Promise<Aviso> {
  const { url, sinPush, ...resto } = datos;
  const aviso = await crearAviso(uid, resto);
  if (!sinPush) {
    enviarPush(uid, { titulo: datos.titulo, cuerpo: datos.cuerpo, url: url ?? DESTINO[datos.tipo] ?? '/avisos', etiqueta: datos.tipo }).catch(() => undefined);
  }
  return aviso;
}

/** Anotación en el diario del departamento: qué hizo el equipo por su cuenta. Sin push (no interrumpe). */
export async function anotarDiario(uid: string, agente: NombreAgente, titulo: string, cuerpo: string, datos?: Record<string, unknown>): Promise<void> {
  await crearAviso(uid, { tipo: 'diario', agente, titulo, cuerpo, datos });
}
