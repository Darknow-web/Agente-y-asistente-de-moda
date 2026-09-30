/** Avisos: lo que los departamentos te dejan cuando no estás mirando. */
import { Link } from 'react-router-dom';
import type { Aviso as TipoAviso, TipoAviso as Clase } from '@shared/types';
import { api } from '@/lib/api';
import { useCarga } from '@/lib/useCarga';
import { relativo } from '@/lib/fechas';
import { Cabecera } from '@/components/Cabecera';
import { Columna } from '@/components/Disposicion';
import { Cargando } from '@/components/Cargando';
import { EstadoVacio } from '@/components/EstadoVacio';
import { Aviso } from '@/components/Aviso';

const NOMBRE_TIPO: Record<Clase, string> = {
  'look-del-dia': 'Look del día',
  'plan-semanal': 'Plan semanal',
  lavado: 'Cuidado',
  compra: 'Compras',
  sistema: 'Sistema',
};

const DESTINO: Partial<Record<Clase, string>> = {
  'look-del-dia': '/hoy',
  'plan-semanal': '/semana',
  lavado: '/armario',
  compra: '/perfil#deseos',
};

export function Avisos() {
  const { datos, error, cargando, setDatos } = useCarga(() => api.avisos());
  const nuevos = (datos ?? []).filter((a) => !a.leido).length;

  const marcar = async (a: TipoAviso) => {
    if (a.leido) return;
    setDatos((lista) => (lista ?? []).map((x) => (x.id === a.id ? { ...x, leido: true } : x)));
    try {
      await api.marcarLeido(a.id);
    } catch {
      /* si falla, el aviso volverá a aparecer como nuevo al recargar */
    }
  };

  return (
    <div className="aparece">
      <Columna>
        <Cabecera titulo="Avisos" meta={datos ? (nuevos ? `${nuevos} ${nuevos === 1 ? 'nuevo' : 'nuevos'}` : 'Al día') : undefined} />

        {cargando ? (
          <div className="pt-6">
            <Cargando texto="Revisando avisos" />
          </div>
        ) : error ? (
          <div className="pt-6">
            <Aviso tipo="error">{error}</Aviso>
          </div>
        ) : !datos?.length ? (
          <div className="pt-8">
            <EstadoVacio
              titulo="Todo en silencio, por ahora."
              texto="Sastra te avisará aquí cuando toque lavar algo, cuando tenga el look del día o el plan de la semana listo."
              accion={
                <Link to="/hoy" className="boton-2">
                  Ver el look de hoy
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="m-0 mt-6 max-w-[44rem] list-none border-t border-[var(--texto)] p-0">
            {datos.map((a) => {
              const destino = DESTINO[a.tipo];
              const cuerpo = (
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-[12px] text-[var(--texto-2)]">
                    {!a.leido ? <span className="inline-block h-[6px] w-[6px] rounded-full bg-[var(--anil)]" aria-label="Nuevo" /> : null}
                    {NOMBRE_TIPO[a.tipo]} · {relativo(a.creadoEn)}
                  </span>
                  <span className={`serif text-[18px] leading-[1.25] ${a.leido ? 'text-[var(--texto-2)]' : ''}`}>{a.titulo}</span>
                  <span className="text-[14px] leading-[1.5] text-[var(--texto-2)]">{a.cuerpo}</span>
                </div>
              );
              return (
                <li key={a.id} className="border-b border-[var(--linea)]">
                  {destino ? (
                    <Link to={destino} className="block py-4" onClick={() => void marcar(a)}>
                      {cuerpo}
                    </Link>
                  ) : (
                    <button type="button" className="block w-full py-4 text-left" onClick={() => void marcar(a)}>
                      {cuerpo}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Columna>
    </div>
  );
}
