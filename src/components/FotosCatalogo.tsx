/**
 * "Pasar mi armario a foto de catálogo": convierte una a una las prendas que aún no la tienen, dentro del cupo
 * diario de Premium. Lo que no alcance hoy lo continúa la tarea diaria. En Gratis abre la invitación a Premium.
 */
import { useState } from 'react';
import type { Prenda } from '@shared/types';
import { api, ErrorHttp, esRequierePremium } from '@/lib/api';

/** Prendas con foto que todavía pueden pasar a catálogo. */
export function faltanCatalogo(prendas: Prenda[]): Prenda[] {
  return prendas.filter((p) => p.fotoUrl && p.fotoRetoque !== 'catalogo' && p.fotoRetoque !== 'original' && !p.fotoCatalogoDescartada);
}

export function FotosCatalogo({ prendas, onPrenda }: { prendas: Prenda[]; onPrenda: (p: Prenda) => void }) {
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const faltan = faltanCatalogo(prendas).length;
  if (!faltan && !mensaje) return null;

  const empezar = async () => {
    setMensaje(null);
    try {
      const { pendientes, cupoHoy } = await api.fotosCatalogo();
      const hoy = pendientes.slice(0, cupoHoy);
      let hechas = 0;
      setProgreso({ hechas, total: hoy.length });
      for (const id of hoy) {
        try {
          onPrenda(await api.mejorarFoto(id));
        } catch (e) {
          if (e instanceof ErrorHttp && e.codigo === 'cupo-fotos') break;
          // 422 (la IA no fue fiel) u otro fallo puntual: se queda la foto real y seguimos con la siguiente.
        }
        hechas++;
        setProgreso({ hechas, total: hoy.length });
      }
      const resto = pendientes.length - hechas;
      setMensaje(resto > 0 ? `Listas ${hechas}. Las otras ${resto} siguen solas en los próximos días.` : 'Tu armario ya está en foto de catálogo.');
    } catch (e) {
      if (!esRequierePremium(e)) setMensaje(e instanceof Error ? e.message : 'No se pudo empezar.');
    } finally {
      setProgreso(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-[var(--margen)] pt-4 text-[13px] text-[var(--texto-2)] lg:px-16">
      {progreso ? (
        <span aria-live="polite">
          Foto de catálogo {Math.min(progreso.hechas + 1, progreso.total)} de {progreso.total}. Puedes seguir usando la app.
        </span>
      ) : (
        <>
          {mensaje ? <span aria-live="polite">{mensaje}</span> : null}
          {faltan ? (
            <button type="button" className="min-h-11 border-b border-[var(--texto)] text-[var(--texto)]" onClick={() => void empezar()}>
              Pasar {faltan === 1 ? 'una prenda' : `${faltan} prendas`} a foto de catálogo
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
