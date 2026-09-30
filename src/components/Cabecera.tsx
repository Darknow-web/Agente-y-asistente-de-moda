/** Cabecera de sección: título en Bodoni alineado a la base con un dato o acción a la derecha. */
import type { ReactNode } from 'react';

export function Cabecera({
  titulo,
  meta,
  accion,
  children,
}: {
  titulo: ReactNode;
  /** texto pequeño a la derecha ("48 prendas", "29 sep – 5 oct") */
  meta?: ReactNode;
  /** enlace o botón pequeño a la derecha ("Editar") */
  accion?: ReactNode;
  /** párrafo bajo el título */
  children?: ReactNode;
}) {
  return (
    <header className="pt-[30px] lg:pt-12">
      <div className="flex items-end justify-between gap-4">
        <h1 className="h1 m-0 text-[34px] leading-[1] lg:text-[var(--t-h1)]">{titulo}</h1>
        {meta ? <span className="pequeno pb-1 shrink-0 text-right">{meta}</span> : null}
        {accion ? <div className="pb-1 shrink-0">{accion}</div> : null}
      </div>
      {children}
    </header>
  );
}

/** Enlace de texto subrayado con la línea de 1 px (el "Editar" de las maquetas). */
export function EnlaceLinea({
  children,
  className = '',
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`enlace-linea inline-flex min-h-11 items-end text-[13px] ${className}`}
      {...resto}
    >
      <span className="border-b border-[var(--texto)] pb-[2px]">{children}</span>
    </button>
  );
}
