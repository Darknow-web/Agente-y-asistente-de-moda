/**
 * Invitación a Premium. Aparece abajo, sobre la navegación, cuando cualquier llamada a la API responde
 * 402 'requiere-premium' (límite del plan Gratis). Sin pop-ups ni urgencia: una franja que se cierra.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EVENTO_REQUIERE_PREMIUM } from '@/lib/api';
import { IconoCerrar } from './Iconos';

export function AvisoPremium({ sinNav = false }: { sinNav?: boolean }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const alRecibir = (e: Event) => setMensaje((e as CustomEvent<string>).detail || 'Esto es parte de Premium.');
    window.addEventListener(EVENTO_REQUIERE_PREMIUM, alRecibir);
    return () => window.removeEventListener(EVENTO_REQUIERE_PREMIUM, alRecibir);
  }, []);

  // Al cambiar de pantalla, se retira.
  useEffect(() => setMensaje(null), [pathname]);

  // En el chat el límite se explica junto al cuadro de texto, y en Plan ya se está viendo Premium.
  if (!mensaje || pathname === '/plan' || pathname === '/sastra') return null;
  return (
    <div
      role="status"
      className={`aparece fixed inset-x-0 z-30 ${sinNav ? 'bottom-0' : 'bottom-[76px]'} border-t border-[var(--texto)] bg-[var(--papel)] px-[var(--margen)] py-4 lg:bottom-0 ${sinNav ? '' : 'lg:left-[240px]'}`}
    >
      <div className="mx-auto flex max-w-[48rem] items-start gap-4">
        <p className="m-0 flex-1 text-[14px] leading-[1.45]">{mensaje}</p>
        <Link to="/plan" className="boton shrink-0">
          Ver Premium
        </Link>
        <button type="button" onClick={() => setMensaje(null)} aria-label="Cerrar" className="inline-flex h-11 w-8 shrink-0 items-center justify-center">
          <IconoCerrar />
        </button>
      </div>
    </div>
  );
}
