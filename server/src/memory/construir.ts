/**
 * Construye el contexto del cliente para una petición: perfil, armario y clima.
 */
import { leerPerfil, listarAjustes, listarPrendas } from '../data/repos.js';
import { geocodificar, pronostico } from '../tools/clima.js';
import { fechaLocal } from '../util/ids.js';
import type { ContextoCliente } from './contexto.js';

const ZONA_POR_DEFECTO = 'America/Lima';

export async function construirContexto(uid: string, email?: string, opciones: { conClima?: boolean } = {}): Promise<ContextoCliente> {
  const [perfil, prendas, ajustes] = await Promise.all([leerPerfil(uid), listarPrendas(uid), listarAjustes(uid, 20).catch(() => [])]);
  const zona = ZONA_POR_DEFECTO;
  const ctx: ContextoCliente = { uid, email, perfil, prendas, ajustes, hoy: fechaLocal(new Date(), zona), zona };
  if (opciones.conClima !== false && perfil.ciudad) {
    try {
      const geo = perfil.lat && perfil.lon ? { lat: perfil.lat, lon: perfil.lon } : await geocodificar(perfil.ciudad, perfil.pais);
      if (geo) ctx.clima = await pronostico(geo.lat, geo.lon, zona);
    } catch (e) {
      console.warn('[sastra] clima no disponible:', e instanceof Error ? e.message : e);
    }
  }
  return ctx;
}
