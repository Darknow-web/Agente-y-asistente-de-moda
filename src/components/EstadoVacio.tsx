/** Estado vacío escrito como invitación a actuar. */
import type { ReactNode } from 'react';

export function EstadoVacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-t border-[var(--texto)] pt-6 max-w-[34rem]">
      <p className="h3 m-0">{titulo}</p>
      {texto ? <p className="m-0 text-[0.9375rem] leading-[1.55] text-[var(--texto-2)]">{texto}</p> : null}
      {accion ? <div className="flex flex-wrap gap-3 pt-2">{accion}</div> : null}
    </div>
  );
}
