/** Semana: el plan de lunes a domingo, con hoy destacado y los días pasados atenuados. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanDia, Prenda } from '@shared/types';
import { api } from '@/lib/api';
import { useCarga } from '@/lib/useCarga';
import { aFechaISO, diaCorto, hoyISO, lunesDeSemana, rangoSemana, sumarDias } from '@/lib/fechas';
import { Cabecera } from '@/components/Cabecera';
import { Columna } from '@/components/Disposicion';
import { Cargando } from '@/components/Cargando';
import { EstadoVacio } from '@/components/EstadoVacio';
import { Aviso } from '@/components/Aviso';
import { FotoPrenda } from '@/components/TarjetaPrenda';

export function Semana() {
  const lunes = lunesDeSemana();
  const inicio = aFechaISO(lunes);
  const hoy = hoyISO();

  const { datos: plan, error, cargando, setDatos } = useCarga(() => api.semana(inicio), [inicio]);
  const { datos: prendas } = useCarga(() => api.prendas());
  const [generando, setGenerando] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null);

  const porFecha = new Map<string, PlanDia>((plan?.dias ?? []).map((d) => [d.fecha, d]));
  const prendaPorId = new Map<string, Prenda>((prendas ?? []).map((p) => [p.id, p]));

  const dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(lunes, i);
    const iso = aFechaISO(fecha);
    return { fecha, iso, plan: porFecha.get(iso) ?? null, esHoy: iso === hoy, pasado: iso < hoy };
  });

  const planificar = async () => {
    setGenerando(true);
    setErrorGenerar(null);
    try {
      const nuevo = await api.generarSemana({ inicio });
      setDatos(nuevo);
    } catch (e) {
      setErrorGenerar(e instanceof Error ? e.message : 'No se pudo planificar la semana.');
    } finally {
      setGenerando(false);
    }
  };

  const nombresLook = (dia: PlanDia): string => {
    const nombres = dia.look.prendaIds.map((id) => prendaPorId.get(id)?.nombre).filter(Boolean) as string[];
    return nombres.length ? nombres.join(', ') : dia.look.titulo;
  };

  const metaLook = (dia: PlanDia): string =>
    [dia.look.ocasion, dia.look.clima].filter(Boolean).join(' · ');

  const fotoDeHoy = (dia: PlanDia): Prenda | undefined =>
    dia.look.prendaIds.map((id) => prendaPorId.get(id)).find((p) => p?.fotoUrl);

  return (
    <div className="aparece">
      <Columna>
        <Cabecera titulo="Semana" meta={rangoSemana(lunes)} />

        {cargando ? (
          <div className="pt-6">
            <Cargando texto="Buscando el plan de la semana" />
          </div>
        ) : error ? (
          <div className="pt-6">
            <Aviso tipo="error">{error}</Aviso>
          </div>
        ) : generando ? (
          <div className="pt-8">
            <Cargando texto="Planificación está armando tu semana con tu rutina, el clima y lo que tienes limpio. Puede tardar medio minuto." />
          </div>
        ) : !plan ? (
          <div className="pt-8">
            {errorGenerar ? (
              <div className="mb-6">
                <Aviso tipo="error" onCerrar={() => setErrorGenerar(null)}>
                  {errorGenerar}
                </Aviso>
              </div>
            ) : null}
            <EstadoVacio
              titulo="Aún no hay plan para esta semana."
              texto="Planificación cruza tu rutina, el clima y las prendas limpias para que ninguna se repita sin lavar."
              accion={
                <button type="button" className="boton" onClick={() => void planificar()}>
                  Planificar mi semana
                </button>
              }
            />
          </div>
        ) : (
          <div className="lg:max-w-[52rem]">
            <p className="m-0 mt-[14px] text-[14px] leading-[1.45] text-[var(--texto-2)]">
              Planificada con tu rutina y el clima. Ninguna prenda se repite sin lavar.
            </p>

            <ol className="m-0 mt-4 flex list-none flex-col border-t border-[var(--texto)] p-0">
              {dias.map((d) => {
                const colorBase = d.pasado ? 'text-[var(--texto-2)]' : 'text-[var(--texto)]';
                return (
                  <li
                    key={d.iso}
                    className={`grid grid-cols-[44px_1fr_56px] items-center gap-3 py-3 ${
                      d.esHoy ? 'border-b border-[var(--texto)]' : 'border-b border-[var(--linea)]'
                    } ${colorBase}`}
                    aria-current={d.esHoy ? 'date' : undefined}
                  >
                    <span className={`text-[12px] leading-[1.2] ${d.esHoy ? 'font-semibold' : ''}`}>
                      {diaCorto(d.fecha)}
                      <br />
                      {d.fecha.getDate()}
                    </span>

                    {d.plan ? (
                      d.esHoy ? (
                        <Link to="/hoy" className="flex items-center gap-3">
                          {(() => {
                            const p = fotoDeHoy(d.plan);
                            return p ? (
                              <FotoPrenda prenda={p} className="h-14 w-11 shrink-0" sizes="44px" />
                            ) : (
                              <span className="h-14 w-11 shrink-0 bg-[var(--hilo)]" aria-hidden="true" />
                            );
                          })()}
                          <span className="serif text-[17px] leading-[1.2]">
                            {nombresLook(d.plan)}
                            <br />
                            <span className="font-[family-name:var(--f-ui)] text-[12px] text-[var(--texto-2)]">
                              {metaLook(d.plan)}
                            </span>
                          </span>
                        </Link>
                      ) : (
                        <span className="text-[14px] leading-[1.3]">
                          {nombresLook(d.plan)}
                          <br />
                          <span className="text-[12px] text-[var(--texto-2)]">{metaLook(d.plan)}</span>
                        </span>
                      )
                    ) : (
                      <span className="text-[14px] text-[var(--texto-2)]">Sin plan para este día</span>
                    )}

                    <span className={`text-right text-[12px] ${d.esHoy ? 'text-[var(--anil)]' : ''}`}>
                      {d.esHoy ? 'Hoy' : ''}
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="flex gap-3 pt-[18px]">
              <Link
                to={`/sastra?texto=${encodeURIComponent('Quiero cambiar el look de un día de esta semana')}`}
                className="boton-2 flex-1"
              >
                Cambiar un día
              </Link>
            </div>
          </div>
        )}
      </Columna>
    </div>
  );
}
