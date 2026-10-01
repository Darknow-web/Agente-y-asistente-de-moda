/** Armario: retícula de prendas con filtros por categoría. */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CategoriaPrenda } from '@shared/types';
import { api } from '@/lib/api';
import { useCarga } from '@/lib/useCarga';
import { Cabecera } from '@/components/Cabecera';
import { Columna } from '@/components/Disposicion';
import { Cargando } from '@/components/Cargando';
import { EstadoVacio } from '@/components/EstadoVacio';
import { Aviso } from '@/components/Aviso';
import { TarjetaPrenda } from '@/components/TarjetaPrenda';
import { IconoCamara } from '@/components/Iconos';

export const NOMBRE_CATEGORIA: Record<CategoriaPrenda, string> = {
  superior: 'Superior',
  inferior: 'Inferior',
  vestido: 'Vestido',
  abrigo: 'Abrigo',
  calzado: 'Calzado',
  accesorio: 'Accesorio',
  'ropa-interior': 'Ropa interior',
  deporte: 'Deporte',
  otro: 'Otro',
};

const ORDEN: CategoriaPrenda[] = [
  'superior',
  'inferior',
  'vestido',
  'abrigo',
  'calzado',
  'accesorio',
  'deporte',
  'ropa-interior',
  'otro',
];

type Filtro = CategoriaPrenda | 'todo' | 'dormidas' | 'sin-estrenar';

export function Armario() {
  const { datos: prendas, error, cargando } = useCarga(() => api.prendas());
  const { datos: resumen } = useCarga(() => api.resumenArmario());
  const [params, setParams] = useSearchParams();
  const inicial = params.get('filtro');
  const [filtro, setFiltroEstado] = useState<Filtro>(inicial === 'dormidas' || inicial === 'sin-estrenar' ? inicial : 'todo');
  const setFiltro = (f: Filtro) => {
    setFiltroEstado(f);
    setParams(f === 'dormidas' || f === 'sin-estrenar' ? { filtro: f } : {}, { replace: true });
  };

  const categorias = useMemo(() => {
    const presentes = new Set((prendas ?? []).map((p) => p.categoria));
    return ORDEN.filter((c) => presentes.has(c));
  }, [prendas]);

  const visibles = useMemo(() => {
    const lista = prendas ?? [];
    if (filtro === 'dormidas') {
      const ids = new Set((resumen?.dormidas ?? []).map((p) => p.id));
      return lista.filter((p) => ids.has(p.id));
    }
    if (filtro === 'sin-estrenar') {
      const ids = new Set((resumen?.sinEstrenar ?? []).map((p) => p.id));
      return lista.filter((p) => ids.has(p.id));
    }
    return lista.filter((p) => filtro === 'todo' || p.categoria === filtro);
  }, [prendas, filtro, resumen]);

  const total = prendas?.length ?? 0;

  return (
    <div className="aparece relative">
      <Columna>
        <Cabecera
          titulo="Armario"
          meta={
            !cargando && prendas
              ? `${total} ${total === 1 ? 'prenda' : 'prendas'}`
              : undefined
          }
          accion={
            total > 0 ? (
              <Link to="/armario/nueva" className="boton hidden lg:inline-flex">
                <IconoCamara tamano={18} />
                Añadir prenda
              </Link>
            ) : undefined
          }
        />
      </Columna>

      {cargando ? (
        <Columna className="pt-6">
          <Cargando texto="Abriendo tu armario" />
        </Columna>
      ) : error ? (
        <Columna className="pt-6">
          <Aviso tipo="error">{error}</Aviso>
        </Columna>
      ) : total === 0 ? (
        <Columna className="pt-8">
          <EstadoVacio
            titulo="Aún no hay prendas."
            texto="Sube la primera foto y Sastra la cataloga: nombre, tela, colores y cuántos usos aguanta antes de lavar."
            accion={
              <Link to="/armario/nueva" className="boton">
                <IconoCamara tamano={18} />
                Añadir prenda
              </Link>
            }
          />
        </Columna>
      ) : (
        <>
          {categorias.length > 1 ? (
            <div
              role="tablist"
              aria-label="Categorías"
              className="sin-barra flex gap-2 overflow-x-auto px-[var(--margen)] pt-4 lg:px-16 lg:pt-6"
            >
              <button
                type="button"
                role="tab"
                aria-selected={filtro === 'todo'}
                className="chip"
                onClick={() => setFiltro('todo')}
              >
                Todo
              </button>
              {categorias.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={filtro === c}
                  className="chip"
                  onClick={() => setFiltro(c)}
                >
                  {NOMBRE_CATEGORIA[c]}
                </button>
              ))}
              {resumen?.dormidas.length ? (
                <button type="button" role="tab" aria-selected={filtro === 'dormidas'} className="chip" onClick={() => setFiltro('dormidas')}>
                  Dormidas · {resumen.dormidas.length}
                </button>
              ) : null}
              {resumen?.sinEstrenar.length ? (
                <button type="button" role="tab" aria-selected={filtro === 'sin-estrenar'} className="chip" onClick={() => setFiltro('sin-estrenar')}>
                  Sin estrenar · {resumen.sinEstrenar.length}
                </button>
              ) : null}
            </div>
          ) : null}

          {filtro === 'dormidas' || filtro === 'sin-estrenar' ? (
            <p className="m-0 px-[var(--margen)] pt-4 text-[14px] leading-[1.5] text-[var(--texto-2)] lg:px-16">
              {filtro === 'dormidas'
                ? `Más de dos meses sin uso.${resumen?.valorSinUso ? ` Entre dormidas y sin estrenar suman ${resumen.moneda === 'PEN' ? 'S/' : resumen.moneda} ${resumen.valorSinUso}.` : ''} Abre una y pídele a Estilismo tres formas de ponértela.`
                : 'Prendas nuevas que todavía no han salido. Abre una y Estilismo te propone su estreno.'}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-x-4 gap-y-[22px] px-[var(--margen)] pt-5 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10 lg:px-16 lg:pt-8">
            {visibles.map((p) => (
              <TarjetaPrenda key={p.id} prenda={p} />
            ))}
          </div>

          <Link
            to="/armario/nueva"
            className="fixed bottom-[96px] right-[var(--margen)] z-10 inline-flex h-12 items-center gap-[10px] bg-[var(--texto)] px-5 text-[14px] font-medium tracking-[0.04em] text-[var(--inverso)] lg:hidden"
          >
            <IconoCamara tamano={18} />
            Añadir prenda
          </Link>
        </>
      )}
    </div>
  );
}
