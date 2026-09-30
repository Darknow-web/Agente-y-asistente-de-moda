/** Navegación inferior en teléfono: cinco pestañas de texto, la activa subrayada. */
import { NavLink } from 'react-router-dom';

export const SECCIONES = [
  { a: '/hoy', texto: 'Hoy' },
  { a: '/sastra', texto: 'Sastra' },
  { a: '/armario', texto: 'Armario' },
  { a: '/semana', texto: 'Semana' },
  { a: '/perfil', texto: 'Perfil' },
] as const;

export function NavInferior() {
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-20 flex h-[76px] items-center justify-around border-t border-[var(--linea)] bg-[var(--fondo)] px-2 pb-3 text-[12px] font-medium tracking-[0.02em] lg:hidden"
    >
      {SECCIONES.map((s) => (
        <NavLink
          key={s.a}
          to={s.a}
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center px-[6px] py-[10px] border-b ${
              isActive
                ? 'border-[var(--texto)] text-[var(--texto)]'
                : 'border-transparent text-[var(--texto-2)]'
            }`
          }
        >
          {s.texto}
        </NavLink>
      ))}
    </nav>
  );
}
