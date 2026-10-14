/**
 * Pulido de la foto de una prenda: foto de catálogo con IA cuando corresponde (y hay cupo) y recorte de
 * fondo gratuito siempre. Guarda la versión pulida junto al original y actualiza la prenda.
 */
import { FieldValue } from 'firebase-admin/firestore';
import type { Prenda } from '@shared/types.js';
import { ErrorProveedor } from '../ai/provider.js';
import { actualizarPrenda, contarHoy, leerPrenda, sumarHoy } from '../data/repos.js';
import { descargarFoto, subirBytesPrenda } from '../data/storage.js';
import { catalogoDisponible, generarFotoCatalogo } from './catalogo.js';
import { miniatura, recortarPrenda } from './recorte.js';

export interface OpcionesPulir {
  /** Fotos de catálogo con IA permitidas al día según el plan (0 = solo recorte gratuito). */
  catalogosPorDia: number;
  /** El plan genera la foto de catálogo sola en cada prenda nueva (Premium). */
  catalogoAutomatico?: boolean;
  /** Generarla aunque el plan no lo haga solo o ya se haya intentado (botón "Mejorar foto"). */
  forzarCatalogo?: boolean;
}

export interface ResultadoPulir {
  prenda: Prenda;
  /** Qué pasó, para el aviso en pantalla. */
  resumen: 'catalogo' | 'recortada' | 'descartada' | 'sin-cambios' | 'sin-cupo';
}

/**
 * ¿Toca generar la foto de catálogo con IA? Pura (probada).
 * Siempre con el botón; si no, solo cuando el plan lo hace automático (o la foto vino arrugada), y nunca si la
 * prenda ya la tiene, la persona eligió su original o la IA ya falló en ser fiel.
 */
export function debeGenerarCatalogo(op: { automatico: boolean; forzar?: boolean; prenda: Pick<Prenda, 'fotoRetoque' | 'fotoArrugada' | 'fotoCatalogoDescartada'> }): boolean {
  if (op.forzar) return true;
  const { fotoRetoque, fotoArrugada, fotoCatalogoDescartada } = op.prenda;
  if (fotoRetoque === 'catalogo' || fotoRetoque === 'original' || fotoCatalogoDescartada) return false;
  return op.automatico || fotoArrugada === true;
}

/** ¿Quedan fotos de catálogo con IA para este usuario hoy, con el cupo de su plan? */
export async function quedaCupoDeRetoque(uid: string, catalogosPorDia: number): Promise<boolean> {
  if (catalogosPorDia <= 0) return false;
  const usados = await contarHoy(uid, 'retoques');
  return usados < catalogosPorDia;
}

export async function pulirFotoDePrenda(uid: string, prendaId: string, op: OpcionesPulir): Promise<ResultadoPulir> {
  const prenda = await leerPrenda(uid, prendaId);
  if (!prenda) throw new Error('Esa prenda no existe.');
  // Siempre se parte del original, nunca de una versión ya pulida.
  const urlOriginal = prenda.fotoOriginalUrl ?? prenda.fotoUrl;
  if (!urlOriginal) throw new Error('La prenda no tiene foto.');

  const original = await descargarFoto(urlOriginal);
  let base = original;
  let enCatalogo = false;
  let sinCupo = false;
  let falloMotor = false;
  let descartada = false;
  const quiereCatalogo = debeGenerarCatalogo({ automatico: !!op.catalogoAutomatico, forzar: op.forzarCatalogo, prenda });
  if (quiereCatalogo && catalogoDisponible()) {
    if (await quedaCupoDeRetoque(uid, op.catalogosPorDia)) {
      await sumarHoy(uid, 'retoques');
      try {
        const r = await generarFotoCatalogo(uid, original);
        if (r) {
          base = { datos: r.datos, mime: r.mime };
          enCatalogo = true;
        } else {
          descartada = true; // la IA cambiaba la prenda: se queda la foto real
        }
      } catch (e) {
        // La foto de catálogo es opcional: si el motor falla, seguimos con el recorte gratuito.
        if (!(e instanceof ErrorProveedor)) throw e;
        console.warn('[imagenes] foto de catálogo no disponible:', e.message);
        falloMotor = true;
      }
    } else {
      sinCupo = true;
    }
  }

  // Estado de la cola: si quería catálogo y no hubo cupo (o el motor falló), queda pendiente para la tarea diaria.
  const cola: Partial<Prenda> = {
    fotoCatalogoPendiente: quiereCatalogo && (sinCupo || falloMotor),
    ...(descartada ? { fotoCatalogoDescartada: true } : {}),
  };
  // A pedido y sin cupo, la foto ya tiene su recorte: no hay nada nuevo que hacer hoy.
  if (sinCupo && op.forzarCatalogo) return { prenda: (await actualizarPrenda(uid, prendaId, cola)) ?? prenda, resumen: 'sin-cupo' };

  let pulida = await recortarPrenda(base.datos);
  if (!pulida && enCatalogo) pulida = base.datos; // sin recorte posible, pero la de catálogo ya viene sobre fondo liso
  if (!pulida) {
    const actual = await actualizarPrenda(uid, prendaId, cola);
    return { prenda: actual ?? prenda, resumen: descartada ? 'descartada' : sinCupo ? 'sin-cupo' : 'sin-cambios' };
  }

  const { url } = await subirBytesPrenda(uid, prendaId, 'pulida', pulida, 'image/jpeg');
  const { url: urlMini } = await subirBytesPrenda(uid, prendaId, 'mini', await miniatura(pulida), 'image/jpeg');
  const actualizada = await actualizarPrenda(uid, prendaId, {
    fotoUrl: url,
    fotoMiniUrl: urlMini,
    fotoOriginalUrl: urlOriginal,
    fotoRetoque: enCatalogo ? 'catalogo' : 'recorte',
    ...cola,
    ...(enCatalogo ? { fotoArrugada: false, fotoCatalogoDescartada: false } : {}),
  });
  return { prenda: actualizada ?? prenda, resumen: enCatalogo ? 'catalogo' : descartada ? 'descartada' : 'recortada' };
}

/** Vuelve a la foto tal como se subió. La versión pulida se conserva en el bucket por si se vuelve a pulir. */
export async function restaurarFotoOriginal(uid: string, prendaId: string): Promise<Prenda> {
  const prenda = await leerPrenda(uid, prendaId);
  if (!prenda) throw new Error('Esa prenda no existe.');
  if (!prenda.fotoOriginalUrl) return prenda;
  // FieldValue.delete(): con ignoreUndefinedProperties, un `undefined` no borraría el campo.
  const actualizada = await actualizarPrenda(uid, prendaId, {
    fotoUrl: prenda.fotoOriginalUrl,
    fotoMiniUrl: prenda.fotoOriginalUrl,
    fotoOriginalUrl: FieldValue.delete() as unknown as string,
    // 'original': la persona prefiere su foto; no se vuelve a generar sola (solo con el botón).
    fotoRetoque: 'original',
    fotoCatalogoPendiente: false,
  });
  return actualizada ?? prenda;
}
