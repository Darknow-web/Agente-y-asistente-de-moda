/** Mensaje en línea: confirmación, información o error. Sin iconos ni colores de alarma. */
import { IconoCerrar } from './Iconos';

export type TipoAviso = 'ok' | 'info' | 'error';

export function Aviso({
  tipo = 'info',
  children,
  onCerrar,
  accion,
}: {
  tipo?: TipoAviso;
  children: React.ReactNode;
  onCerrar?: () => void;
  accion?: React.ReactNode;
}) {
  const borde = tipo === 'error' ? 'border-[var(--texto)]' : 'border-[var(--linea)]';
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 border-t ${borde} pt-3 pb-1 text-[0.9375rem] leading-[1.5]`}
    >
      <p className={`m-0 flex-1 ${tipo === 'info' ? 'text-[var(--texto-2)]' : 'text-[var(--texto)]'}`}>
        {children}
      </p>
      {accion}
      {onCerrar ? (
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar aviso"
          className="-mt-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-[var(--texto-2)] hover:text-[var(--texto)]"
        >
          <IconoCerrar tamano={16} />
        </button>
      ) : null}
    </div>
  );
}
