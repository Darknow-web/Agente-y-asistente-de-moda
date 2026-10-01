/**
 * Pulido de la foto de una prenda: alisado con IA solo cuando hace falta (y hay cupo) y recorte de
 * fondo gratuito siempre. Guarda la versión pulida junto al original y actualiza la prenda.
 */
import type { Prenda } from '@shared/types.js';
import { ErrorProveedor } from '../ai/provider.js';
import { leerLimites } from '../config/limites.js';
import { actualizarPrenda, contarHoy, leerPrenda, sumarHoy } from '../data/repos.js';
import { descargarFoto, subirBytesPrenda } from '../data/storage.js';
import { alisadoDisponible, alisarFoto } from './alisado.js';
import { miniatura, recortarPrenda } from './recorte.js';

export interface OpcionesPulir {
  /** Alisar con IA aunque Guardarropa no haya marcado la foto como arrugada (botón "Mejorar foto"). */
  forzarAlisado?: boolean;
}

export interface ResultadoPulir {
  prenda: Prenda;
  /** Qué pasó, para el aviso en pantalla. */
  resumen: 'alisada-y-recortada' | 'recortada' | 'alisada' | 'sin-cambios' | 'sin-cupo';
}

/** ¿Quedan alisados con IA para este usuario hoy? */
export async function quedaCupoDeRetoque(uid: string): Promise<boolean> {
  const usados = await contarHoy(uid, 'retoques');
  return usados < leerLimites().retoquesPorUsuarioPorDia;
}

export async function pulirFotoDePrenda(uid: string, prendaId: string, op: OpcionesPulir = {}): Promise<ResultadoPulir> {
  const prenda = await leerPrenda(uid, prendaId);
  if (!prenda) throw new Error('Esa prenda no existe.');
  // Siempre se parte del original, nunca de una versión ya pulida.
  const urlOriginal = prenda.fotoOriginalUrl ?? prenda.fotoUrl;
  if (!urlOriginal) throw new Error('La prenda no tiene foto.');

  const original = await descargarFoto(urlOriginal);
  let base = original;
  let alisada = false;
  let sinCupo = false;

  const quiereAlisar = op.forzarAlisado || prenda.fotoArrugada === true;
  if (quiereAlisar && alisadoDisponible()) {
    if (await quedaCupoDeRetoque(uid)) {
      await sumarHoy(uid, 'retoques');
      try {
        const r = await alisarFoto(uid, original);
        if (r) {
          base = { datos: r.datos, mime: r.mime };
          alisada = true;
        }
      } catch (e) {
        // El alisado es opcional: si el motor falla, seguimos con el recorte gratuito.
        if (e instanceof ErrorProveedor) console.warn('[imagenes] alisado no disponible:', e.message);
        else throw e;
      }
    } else {
      sinCupo = true;
    }
  }

  let pulida = await recortarPrenda(base.datos);
  const recortada = pulida !== null;
  if (!pulida && alisada) pulida = base.datos; // sin recorte posible, pero la alisada ya viene sobre fondo liso
  if (!pulida) {
    return { prenda, resumen: sinCupo ? 'sin-cupo' : 'sin-cambios' };
  }

  const { url } = await subirBytesPrenda(uid, prendaId, 'pulida', pulida, 'image/jpeg');
  const { url: urlMini } = await subirBytesPrenda(uid, prendaId, 'mini', await miniatura(pulida), 'image/jpeg');
  const actualizada = await actualizarPrenda(uid, prendaId, {
    fotoUrl: url,
    fotoMiniUrl: urlMini,
    fotoOriginalUrl: urlOriginal,
    fotoRetoque: alisada ? 'alisado' : 'recorte',
    ...(alisada ? { fotoArrugada: false } : {}),
  });
  return { prenda: actualizada ?? prenda, resumen: alisada ? (recortada ? 'alisada-y-recortada' : 'alisada') : 'recortada' };
}

/** Vuelve a la foto tal como se subió. La versión pulida se conserva en el bucket por si se vuelve a pulir. */
export async function restaurarFotoOriginal(uid: string, prendaId: string): Promise<Prenda> {
  const prenda = await leerPrenda(uid, prendaId);
  if (!prenda) throw new Error('Esa prenda no existe.');
  if (!prenda.fotoOriginalUrl) return prenda;
  const actualizada = await actualizarPrenda(uid, prendaId, {
    fotoUrl: prenda.fotoOriginalUrl,
    fotoMiniUrl: prenda.fotoOriginalUrl,
    fotoOriginalUrl: undefined,
    fotoRetoque: undefined,
  });
  return actualizada ?? prenda;
}
