/** Marco común de las páginas legales: públicas, sin sesión, con la marca y el aviso de datos por completar. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lockup } from '@/components/Marca';
import { PROVEEDOR, proveedorIncompleto } from '@/lib/legal';

export function PaginaLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--fondo)] text-[var(--texto)]">
      <div className="mx-auto max-w-[44rem] px-[var(--margen)] pb-20 pt-8">
        <Link to="/" aria-label="SASTRA, inicio" className="inline-flex w-fit">
          <Lockup altura={26} />
        </Link>
        <h1 className="h1 m-0 mt-10 text-[34px] leading-[1.05]">{titulo}</h1>
        <p className="pequeno m-0 mt-3">Vigente desde el {PROVEEDOR.vigencia}</p>
        {proveedorIncompleto ? (
          <p className="m-0 mt-4 border-t border-[var(--texto)] pt-3 text-[13px] leading-[1.5]">
            Borrador: faltan los datos del titular (nombre, RUC y domicilio). Revísalo con un abogado antes de cobrar.
          </p>
        ) : null}
        <div className="legal mt-8 flex flex-col gap-5 text-[15px] leading-[1.6]">{children}</div>
        <nav aria-label="Más información legal" className="mt-12 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[var(--texto-2)]">
          <Link to="/terminos" className="border-b border-current">
            Términos y condiciones
          </Link>
          <Link to="/privacidad" className="border-b border-current">
            Privacidad
          </Link>
          <Link to="/libro-de-reclamaciones" className="border-b border-current">
            Libro de Reclamaciones
          </Link>
        </nav>
      </div>
    </div>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="h3 m-0">{titulo}</h2>
      {children}
    </section>
  );
}
