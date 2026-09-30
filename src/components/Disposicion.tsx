/**
 * Disposición de la app con sesión: en teléfono, navegación inferior;
 * a partir de 1024 px, un raíl izquierdo con la marca y las mismas cinco secciones como texto.
 */
import { NavLink, Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Lockup } from './Marca';
import { NavInferior, SECCIONES } from './NavInferior';
import { useSesion } from '@/lib/sesion';

export function Disposicion({ children, sinNav = false }: { children: ReactNode; sinNav?: boolean }) {
  const { yo } = useSesion();
  return (
    <div className="min-h-dvh bg-[var(--fondo)] text-[var(--texto)]">
      <div className="mx-auto max-w-[var(--ancho-max)] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        {!sinNav ? (
          <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-dvh lg:flex-col lg:justify-between lg:border-r lg:border-[var(--linea)] lg:px-10 lg:py-10">
            <div className="flex flex-col gap-12">
              <Link to="/hoy" aria-label="SASTRA, inicio" className="inline-flex w-fit">
                <Lockup altura={30} />
              </Link>
              <nav aria-label="Secciones" className="flex flex-col gap-1 text-[15px] font-medium">
                {SECCIONES.map((s) => (
                  <NavLink
                    key={s.a}
                    to={s.a}
                    className={({ isActive }) =>
                      `inline-flex min-h-11 w-fit items-center border-b py-2 ${
                        isActive
                          ? 'border-[var(--texto)] text-[var(--texto)]'
                          : 'border-transparent text-[var(--texto-2)] hover:text-[var(--texto)]'
                      }`
                    }
                  >
                    {s.texto}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex flex-col gap-1 text-[13px]">
              <Link to="/probador" className="inline-flex min-h-11 items-center text-[var(--texto-2)] hover:text-[var(--texto)]">
                Probador
              </Link>
              <Link to="/avisos" className="inline-flex min-h-11 items-center text-[var(--texto-2)] hover:text-[var(--texto)]">
                Avisos
              </Link>
              {yo?.admin ? (
                <Link to="/invitados" className="inline-flex min-h-11 items-center text-[var(--texto-2)] hover:text-[var(--texto)]">
                  Invitados
                </Link>
              ) : null}
              {yo?.email ? <span className="pequeno truncate pt-2">{yo.email}</span> : null}
            </div>
          </aside>
        ) : null}
        <main className={sinNav ? 'min-h-dvh' : 'min-h-dvh pb-[96px] lg:pb-0'}>{children}</main>
      </div>
      {!sinNav ? <NavInferior /> : null}
    </div>
  );
}

/** Columna de contenido con los márgenes de la retícula (20 / 40 / 80). */
export function Columna({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-[var(--margen)] lg:px-16 ${className}`}>{children}</div>;
}
