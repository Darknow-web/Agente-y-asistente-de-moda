/** Avisos: lo que los departamentos te dejan cuando no estás mirando, y el diario de lo que hicieron por su cuenta. */
import { Link, useSearchParams } from 'react-router-dom';
import type { Aviso as TipoAviso, TipoAviso as Clase } from '@shared/types';
import { AGENTES } from '@shared/types';
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
  estreno: 'Estreno',
  dormida: 'Ropa dormida',
  deseo: 'Lista de deseos',
  diario: 'Diario',
  sistema: 'Sistema',
};

function destinoDe(a: TipoAviso): string | undefined {
  const prendaId = typeof a.datos?.prendaId === 'string' ? a.datos.prendaId : undefined;
  switch (a.tipo) {
    case 'look-del-dia':
      return '/hoy';
    case 'plan-semanal':
      return '/semana';
    case 'lavado':
      return '/armario';
    case 'estreno':
      return prendaId ? `/armario/${encodeURIComponent(prendaId)}` : '/armario?filtro=sin-estrenar';
    case 'dormida':
      return '/armario?filtro=dormidas';
    case 'compra':
    case 'deseo':
      return '/perfil#deseos';
    default:
      return undefined;
  }
}

export function Avisos() {
  const [params, setParams] = useSearchParams();
  const vista = params.get('vista') === 'diario' ? 'diario' : 'para-ti';
  const { datos, error, cargando, setDatos } = useCarga(() => api.avisos());
  const lista = (datos ?? []).filter((a) => (vista === 'diario' ? a.tipo === 'diario' : a.tipo !== 'diario'));
  const nuevos = (datos ?? []).filter((a) => !a.leido && a.tipo !== 'diario').length;

  const marcar = async (a: TipoAviso) => {
    if (a.leido) return;
    setDatos((l) => (l ?? []).map((x) => (x.id === a.id ? { ...x, leido: true } : x)));
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

        <div role="tablist" aria-label="Vista" className="mt-5 flex gap-2">
          <button type="button" role="tab" aria-selected={vista === 'para-ti'} className="chip" onClick={() => setParams({}, { replace: true })}>
            Para ti
          </button>
          <button type="button" role="tab" aria-selected={vista === 'diario'} className="chip" onClick={() => setParams({ vista: 'diario' }, { replace: true })}>
            Diario del departamento
          </button>
        </div>

        {cargando ? (
          <div className="pt-6">
            <Cargando texto="Revisando avisos" />
          </div>
        ) : error ? (
          <div className="pt-6">
            <Aviso tipo="error">{error}</Aviso>
          </div>
        ) : !lista.length ? (
          <div className="pt-8">
            {vista === 'diario' ? (
              <EstadoVacio
                titulo="El equipo aún no ha anotado nada."
                texto="Aquí verás lo que los departamentos hacen por su cuenta: el look que prepararon, la semana que planificaron, lo que detectaron que toca lavar."
              />
            ) : (
              <EstadoVacio
                titulo="Todo en silencio, por ahora."
                texto="Sastra te avisará aquí cuando toque lavar algo, cuando tenga el look del día, cuando una prenda nueva lleve demasiado sin estrenar o cuando un deseo cumpla su semana de espera."
                accion={
                  <Link to="/hoy" className="boton-2">
                    Ver el look de hoy
                  </Link>
                }
              />
            )}
          </div>
        ) : (
          <ul className="m-0 mt-6 max-w-[44rem] list-none border-t border-[var(--texto)] p-0">
            {lista.map((a) => {
              const destino = destinoDe(a);
              const quien = a.agente ? AGENTES[a.agente]?.titulo : NOMBRE_TIPO[a.tipo];
              const cuerpo = (
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-[12px] text-[var(--texto-2)]">
                    {!a.leido && a.tipo !== 'diario' ? <span className="inline-block h-[6px] w-[6px] rounded-full bg-[var(--anil)]" aria-label="Nuevo" /> : null}
                    {quien} · {relativo(a.creadoEn)}
                  </span>
                  <span className={`serif text-[18px] leading-[1.25] ${a.leido && a.tipo !== 'diario' ? 'text-[var(--texto-2)]' : ''}`}>{a.titulo}</span>
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
